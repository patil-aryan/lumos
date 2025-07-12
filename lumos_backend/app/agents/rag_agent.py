"""
Main RAG agent using Pydantic AI.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIModel

from app.config import settings
from app.agents.prompts import get_system_prompt, get_context_prompt
from app.agents.tools import (
    vector_search_tool, graph_search_tool, hybrid_search_tool,
    get_entity_relationships_tool, get_entity_timeline_tool
)
from app.models.requests import (
    VectorSearchInput, GraphSearchInput, HybridSearchInput,
    EntityRelationshipInput, EntityTimelineInput
)

logger = logging.getLogger(__name__)

class AgentDependencies:
    """Dependencies for the RAG agent."""

    def __init__(self, session_id: str, user_id: Optional[str] = None):
        self.session_id = session_id
        self.user_id = user_id
        self.conversation_history: List[Dict[str, Any]] = []

# Initialize the model
model = OpenAIModel(
    model_name=settings.llm_model,
    api_key=settings.llm_api_key,
    base_url=settings.llm_base_url,
)

# Create the agent
rag_agent = Agent(
    model=model,
    system_prompt=get_system_prompt(),
    deps_type=AgentDependencies,
)

@rag_agent.tool
async def vector_search(ctx: RunContext[AgentDependencies], query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Perform vector similarity search across document chunks.

    Use this tool when you need to find documents or content that are semantically similar
    to the user's query. Good for finding relevant conversations, documents, or content
    about specific topics.

    Args:
        query: The search query
        limit: Maximum number of results to return (default: 10)

    Returns:
        List of relevant document chunks with similarity scores
    """
    logger.info(f"Agent using vector_search with query: {query}")

    input_data = VectorSearchInput(query=query, limit=limit)
    results = await vector_search_tool(input_data)

    # Convert to dict for agent consumption
    return [
        {
            "content": r.content,
            "score": r.score,
            "source": r.document_source,
            "title": r.document_title,
            "metadata": r.metadata
        }
        for r in results
    ]

@rag_agent.tool
async def graph_search(ctx: RunContext[AgentDependencies], query: str) -> List[Dict[str, Any]]:
    """
    Search the knowledge graph for entities, relationships, and facts.

    Use this tool when you need to understand connections between entities,
    find relationships, or get factual information from the knowledge graph.
    Good for questions about partnerships, collaborations, or entity relationships.

    Args:
        query: The search query focusing on entities and relationships

    Returns:
        List of facts and relationships from the knowledge graph
    """
    logger.info(f"Agent using graph_search with query: {query}")

    input_data = GraphSearchInput(query=query)
    results = await graph_search_tool(input_data)

    # Convert to dict for agent consumption
    return [
        {
            "fact": r.fact,
            "uuid": r.uuid,
            "valid_at": r.valid_at,
            "invalid_at": r.invalid_at,
            "source_node": r.source_node_uuid
        }
        for r in results
    ]

@rag_agent.tool
async def hybrid_search(ctx: RunContext[AgentDependencies], query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Perform hybrid search combining vector similarity and graph context.

    Use this as the default search method when you need comprehensive results
    that combine both semantic similarity and relational understanding.
    This provides both relevant content and contextual relationships.

    Args:
        query: The search query
        limit: Maximum number of results to return (default: 10)

    Returns:
        List of document chunks enhanced with graph context
    """
    logger.info(f"Agent using hybrid_search with query: {query}")

    input_data = HybridSearchInput(query=query, limit=limit)
    results = await hybrid_search_tool(input_data)

    # Convert to dict for agent consumption
    return [
        {
            "content": r.content,
            "score": r.score,
            "source": r.document_source,
            "title": r.document_title,
            "metadata": r.metadata,
            "graph_context": r.metadata.get("graph_context", [])
        }
        for r in results
    ]

@rag_agent.tool
async def get_entity_relationships(ctx: RunContext[AgentDependencies], entity: str) -> Dict[str, Any]:
    """
    Get relationships and connections for a specific entity.

    Use this tool when you need to understand how a specific person, company,
    or concept is connected to other entities. Good for questions like
    "How is X connected to Y?" or "What partnerships does company X have?"

    Args:
        entity: The entity name to find relationships for

    Returns:
        Dictionary containing entity relationships and connections
    """
    logger.info(f"Agent using get_entity_relationships for entity: {entity}")

    input_data = EntityRelationshipInput(entity_name=entity)
    return await get_entity_relationships_tool(input_data)

@rag_agent.tool
async def get_entity_timeline(ctx: RunContext[AgentDependencies], entity: str, start_date: Optional[str] = None,
end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get timeline of facts and events for a specific entity.

    Use this tool when you need to understand how something evolved over time,
    or to get a chronological view of facts about an entity. Good for questions
    about project timelines, company evolution, or historical changes.

    Args:
        entity: The entity name to get timeline for
        start_date: Optional start date (ISO format)
        end_date: Optional end date (ISO format)

    Returns:
        List of timeline events and facts
    """
    logger.info(f"Agent using get_entity_timeline for entity: {entity}")

    input_data = EntityTimelineInput(
        entity_name=entity,
        start_date=start_date,
        end_date=end_date
    )
    return await get_entity_timeline_tool(input_data)

# Helper function to extract tool calls from agent results
def extract_tool_calls(result) -> List[Dict[str, Any]]:
    """Extract tool calls from agent result for analytics."""
    tools_used = []

    try:
        if hasattr(result, 'all_messages'):
            for message in result.all_messages():
                if hasattr(message, 'parts'):
                    for part in message.parts:
                        if hasattr(part, 'tool_name') and part.tool_name:
                            tool_data = {
                                "tool_name": part.tool_name,
                                "args": getattr(part, 'args', {}),
                                "tool_call_id": getattr(part, 'tool_call_id', None)
                            }
                            tools_used.append(tool_data)
    except Exception as e:
        logger.warning(f"Failed to extract tool calls: {e}")

    return tools_used