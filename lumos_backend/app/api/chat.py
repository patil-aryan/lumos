"""
Chat endpoints for agent interaction.
"""

import json
import uuid
import asyncio
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update
from pydantic_ai.messages import PartStartEvent, PartDeltaEvent, TextPartDelta

from app.models.requests import ChatRequest, SearchRequest
from app.models.responses import ChatResponse, SearchResponse, ToolCall
from app.models.database import AgentConversation, AgentMessage, ToolUsage, User
from app.database.postgresql import get_db
from app.api.auth import get_current_user_optional
from app.agents.rag_agent import rag_agent, AgentDependencies, extract_tool_calls
from app.agents.tools import (
    vector_search_tool, graph_search_tool, hybrid_search_tool,
    perform_comprehensive_search
)

router = APIRouter()
logger = logging.getLogger(__name__)

async def get_or_create_session(
    request: ChatRequest,
    db: AsyncSession,
    user: Optional[User] = None
) -> str:
    """Get existing session or create new one."""
    session_id = request.session_id

    if not session_id:
        session_id = str(uuid.uuid4())

    # Check if session exists
    result = await db.execute(
        select(AgentConversation).where(AgentConversation.session_id == session_id)
    )
    session = result.scalar_one_or_none()

    if not session:
        # Create new session
        new_session = AgentConversation(
            session_id=session_id,
            user_id=user.id if user else None,
            metadata=request.metadata
        )
        db.add(new_session)
        await db.flush()

    return session_id

async def get_conversation_context(session_id: str, db: AsyncSession) -> list:
    """Get conversation history for context."""
    result = await db.execute(
        select(AgentMessage)
        .join(AgentConversation)
        .where(AgentConversation.session_id == session_id)
        .order_by(AgentMessage.created_at.desc())
        .limit(10)
    )

    messages = result.scalars().all()

    # Return in chronological order
    return [
        {
            "role": msg.role,
            "content": msg.content,
            "timestamp": msg.created_at.isoformat()
        }
        for msg in reversed(messages)
    ]

async def save_message(
    session_id: str,
    role: str,
    content: str,
    tools_used: list = None,
    metadata: dict = None,
    db: AsyncSession = None
):
    """Save message to database."""
    # Get conversation
    result = await db.execute(
        select(AgentConversation).where(AgentConversation.session_id == session_id)
    )
    conversation = result.scalar_one()

    # Create message
    message = AgentMessage(
        conversation_id=conversation.id,
        role=role,
        content=content,
        tools_used=tools_used or [],
        metadata=metadata or {}
    )
    db.add(message)
    await db.flush()

    # Save tool usage analytics
    if tools_used:
        for tool in tools_used:
            tool_usage = ToolUsage(
                message_id=message.id,
                tool_name=tool.get("tool_name", ""),
                tool_args=tool.get("args", {}),
                execution_time_ms=tool.get("execution_time_ms"),
                success=True
            )
            db.add(tool_usage)

    return message

@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """Non-streaming chat endpoint."""
    try:
        # Get or create session
        session_id = await get_or_create_session(request, db, user)

        # Get conversation context
        context = await get_conversation_context(session_id, db)

        # Create agent dependencies
        deps = AgentDependencies(
            session_id=session_id,
            user_id=str(user.id) if user else None
        )
        deps.conversation_history = context

        # Build prompt with context
        full_prompt = request.message
        if context:
            context_str = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in context[-6:]  # Last 3 turns
            ])
            full_prompt = f"Previous conversation:\n{context_str}\n\nCurrent question: {request.message}"

        # Save user message
        await save_message(
            session_id=session_id,
            role="user",
            content=request.message,
            metadata={"user_id": str(user.id) if user else None},
            db=db
        )

        # Run agent
        result = await rag_agent.run(full_prompt, deps=deps)
        response = result.data
        tools_used = extract_tool_calls(result)

        # Convert tools to ToolCall objects
        tool_calls = [
            ToolCall(
                tool_name=tool["tool_name"],
                args=tool["args"],
                tool_call_id=tool.get("tool_call_id")
            )
            for tool in tools_used
        ]

        # Save assistant message
        await save_message(
            session_id=session_id,
            role="assistant",
            content=response,
            tools_used=tools_used,
            metadata={"search_type": request.search_type},
            db=db
        )

        await db.commit()

        return ChatResponse(
            message=response,
            session_id=session_id,
            tools_used=tool_calls,
            metadata={"search_type": request.search_type}
        )

    except Exception as e:
        logger.error(f"Chat endpoint failed: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stream")
async def chat_stream(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: Optional[User] = Depends(get_current_user_optional)
):
    """Streaming chat endpoint using Server-Sent Events."""
    try:
        # Get or create session
        session_id = await get_or_create_session(request, db, user)

        async def generate_stream():
            """Generate streaming response."""
            try:
                yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

                # Get conversation context
                context = await get_conversation_context(session_id, db)

                # Create agent dependencies
                deps = AgentDependencies(
                    session_id=session_id,
                    user_id=str(user.id) if user else None
                )
                deps.conversation_history = context

                # Build prompt with context
                full_prompt = request.message
                if context:
                    context_str = "\n".join([
                        f"{msg['role']}: {msg['content']}"
                        for msg in context[-6:]
                    ])
                    full_prompt = f"Previous conversation:\n{context_str}\n\nCurrent question: {request.message}"

                # Save user message
                await save_message(
                    session_id=session_id,
                    role="user",
                    content=request.message,
                    metadata={"user_id": str(user.id) if user else None},
                    db=db
                )

                full_response = ""

                # Stream using agent.iter() pattern
                async with rag_agent.iter(full_prompt, deps=deps) as run:
                    async for node in run:
                        if rag_agent.is_model_request_node(node):
                            # Stream tokens from the model
                            async with node.stream(run.ctx) as request_stream:
                                async for event in request_stream:
                                    if isinstance(event, PartStartEvent) and event.part.part_kind == 'text':
                                        delta_content = event.part.content
                                        yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                        full_response += delta_content

                                    elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                        delta_content = event.delta.content_delta
                                        yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                        full_response += delta_content

                # Extract tools used
                result = run.result
                tools_used = extract_tool_calls(result)

                # Send tools used information
                if tools_used:
                    tools_data = [
                        {
                            "tool_name": tool["tool_name"],
                            "args": tool["args"],
                            "tool_call_id": tool.get("tool_call_id")
                        }
                        for tool in tools_used
                    ]
                    yield f"data: {json.dumps({'type': 'tools', 'tools': tools_data})}\n\n"

                # Save assistant response
                await save_message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    tools_used=tools_used,
                    metadata={"streamed": True, "search_type": request.search_type},
                    db=db
                )

                await db.commit()
                yield f"data: {json.dumps({'type': 'end'})}\n\n"

            except Exception as e:
                logger.error(f"Stream error: {e}")
                await db.rollback()
                error_chunk = {
                    "type": "error",
                    "content": f"Stream error: {str(e)}"
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )

    except Exception as e:
        logger.error(f"Streaming chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/vector", response_model=SearchResponse)
async def search_vector(request: SearchRequest):
    """Direct vector search endpoint."""
    try:
        from app.models.requests import VectorSearchInput

        input_data = VectorSearchInput(
            query=request.query,
            limit=request.limit
        )

        start_time = datetime.now()
        results = await vector_search_tool(input_data)
        end_time = datetime.now()

        query_time = (end_time - start_time).total_seconds() * 1000

        return SearchResponse(
            results=results,
            total_results=len(results),
            search_type="vector",
            query_time_ms=query_time
        )

    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/graph", response_model=SearchResponse)
async def search_graph(request: SearchRequest):
    """Direct graph search endpoint."""
    try:
        from app.models.requests import GraphSearchInput

        input_data = GraphSearchInput(query=request.query)

        start_time = datetime.now()
        results = await graph_search_tool(input_data)
        end_time = datetime.now()

        query_time = (end_time - start_time).total_seconds() * 1000

        return SearchResponse(
            graph_results=results,
            total_results=len(results),
            search_type="graph",
            query_time_ms=query_time
        )

    except Exception as e:
        logger.error(f"Graph search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search/hybrid", response_model=SearchResponse)
async def search_hybrid(request: SearchRequest):
    """Direct hybrid search endpoint."""
    try:
        from app.models.requests import HybridSearchInput

        input_data = HybridSearchInput(
            query=request.query,
            limit=request.limit
        )

        start_time = datetime.now()
        results = await hybrid_search_tool(input_data)
        end_time = datetime.now()

        query_time = (end_time - start_time).total_seconds() * 1000

        return SearchResponse(
            results=results,
            total_results=len(results),
            search_type="hybrid",
            query_time_ms=query_time
        )

    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions/{session_id}")
async def get_session_info(
    session_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get session information and history."""
    try:
        result = await db.execute(
            select(AgentConversation).where(AgentConversation.session_id == session_id)
        )
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get messages
        messages_result = await db.execute(
            select(AgentMessage)
            .where(AgentMessage.conversation_id == session.id)
            .order_by(AgentMessage.created_at)
        )
        messages = messages_result.scalars().all()

        return {
            "session_id": session.session_id,
            "created_at": session.created_at.isoformat(),
            "last_activity": session.last_activity.isoformat(),
            "message_count": len(messages),
            "messages": [
                {
                    "id": str(msg.id),
                    "role": msg.role,
                    "content": msg.content,
                    "tools_used": msg.tools_used,
                    "created_at": msg.created_at.isoformat()
                }
                for msg in messages
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))