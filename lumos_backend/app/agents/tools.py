"""
Agent tools for hybrid RAG functionality.
"""

import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.models.requests import (
    VectorSearchInput, GraphSearchInput, HybridSearchInput,
    EntityRelationshipInput, EntityTimelineInput
)
from app.models.responses import ChunkResult, GraphSearchResult
from app.utils.embeddings import generate_embedding
from app.database.postgresql import AsyncSessionLocal
from app.database.neo4j_client import graph_client
from app.models.database import HybridEmbedding, SlackMessage, SlackWorkspace
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload

logger = logging.getLogger(__name__)

async def vector_search_tool(input_data: VectorSearchInput) -> List[ChunkResult]:
    """
    Perform vector similarity search.

    Args:
        input_data: Search parameters

    Returns:
        List of matching chunks
    """
    try:
        # Generate embedding for query
        embedding = await generate_embedding(input_data.query)

        async with AsyncSessionLocal() as session:
            # Perform vector similarity search
            query = text("""
                SELECT
                    he.id::text as chunk_id,
                    he.content_id::text as document_id,
                    he.content,
                    1 - (he.embedding <=> :embedding) as score,
                    he.metadata,
                    COALESCE(sm.username, 'Unknown') as document_title,
                    he.content_type as document_source
                FROM hybrid_embeddings he
                LEFT JOIN slack_messages sm ON he.content_id = sm.id
                WHERE he.embedding IS NOT NULL
                ORDER BY he.embedding <=> :embedding
                LIMIT :limit
            """)

            result = await session.execute(
                query,
                {
                    "embedding": str(embedding),
                    "limit": input_data.limit
                }
            )

            results = []
            for row in result:
                results.append(ChunkResult(
                    chunk_id=row.chunk_id,
                    document_id=row.document_id,
                    content=row.content,
                    score=float(row.score),
                    metadata=row.metadata or {},
                    document_title=row.document_title,
                    document_source=row.document_source
                ))

            return results

    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return []

async def graph_search_tool(input_data: GraphSearchInput) -> List[GraphSearchResult]:
    """
    Perform knowledge graph search using Graphiti.

    Args:
        input_data: Search parameters

    Returns:
        List of graph search results
    """
    try:
        # Initialize graph client if needed
        await graph_client.initialize()

        # Search the knowledge graph
        results = await graph_client.search(
            query=input_data.query
        )

        # Convert to GraphSearchResult models
        return [
            GraphSearchResult(
                fact=r["fact"],
                uuid=r["uuid"],
                valid_at=r.get("valid_at"),
                invalid_at=r.get("invalid_at"),
                source_node_uuid=r.get("source_node_uuid")
            )
            for r in results
        ]

    except Exception as e:
        logger.error(f"Graph search failed: {e}")
        return []

async def hybrid_search_tool(input_data: HybridSearchInput) -> List[ChunkResult]:
    """
    Perform hybrid search (vector + graph context).

    Args:
        input_data: Search parameters

    Returns:
        List of matching chunks with enhanced context
    """
    try:
        # Perform vector search
        vector_results = await vector_search_tool(
            VectorSearchInput(query=input_data.query, limit=input_data.limit)
        )

        # Perform graph search for context
        graph_results = await graph_search_tool(
            GraphSearchInput(query=input_data.query)
        )

        # Enhance vector results with graph context
        for result in vector_results:
            # Add graph context to metadata
            relevant_facts = [
                gr.fact for gr in graph_results
                if any(keyword in gr.fact.lower()
                        for keyword in input_data.query.lower().split())
            ]

            if relevant_facts:
                result.metadata["graph_context"] = relevant_facts[:3]  # Top 3 relevant facts

        return vector_results

    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        return []

async def get_entity_relationships_tool(input_data: EntityRelationshipInput) -> Dict[str, Any]:
    """
    Get relationships for an entity using the knowledge graph.

    Args:
        input_data: Entity relationship parameters

    Returns:
        Entity relationships
    """
    try:
        await graph_client.initialize()

        return await graph_client.get_related_entities(
            entity_name=input_data.entity_name,
            depth=input_data.depth
        )

    except Exception as e:
        logger.error(f"Entity relationship query failed: {e}")
        return {
            "central_entity": input_data.entity_name,
            "related_entities": [],
            "relationships": [],
            "depth": input_data.depth,
            "error": str(e)
        }

async def get_entity_timeline_tool(input_data: EntityTimelineInput) -> List[Dict[str, Any]]:
    """
    Get timeline of facts for an entity.

    Args:
        input_data: Timeline query parameters

    Returns:
        Timeline of facts
    """
    try:
        await graph_client.initialize()

        # Parse dates if provided
        start_date = None
        end_date = None

        if input_data.start_date:
            start_date = datetime.fromisoformat(input_data.start_date)
        if input_data.end_date:
            end_date = datetime.fromisoformat(input_data.end_date)

        return await graph_client.get_entity_timeline(
            entity_name=input_data.entity_name,
            start_date=start_date,
            end_date=end_date
        )

    except Exception as e:
        logger.error(f"Entity timeline query failed: {e}")
        return []

# Combined search function for comprehensive queries
async def perform_comprehensive_search(
    query: str,
    use_vector: bool = True,
    use_graph: bool = True,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Perform comprehensive search using multiple methods.

    Args:
        query: Search query
        use_vector: Whether to use vector search
        use_graph: Whether to use graph search
        limit: Maximum results per search type

    Returns:
        Combined search results
    """
    results = {
        "query": query,
        "vector_results": [],
        "graph_results": [],
        "total_results": 0,
        "search_methods_used": []
    }

    tasks = []

    if use_vector:
        tasks.append(vector_search_tool(VectorSearchInput(query=query, limit=limit)))
        results["search_methods_used"].append("vector_search")

    if use_graph:
        tasks.append(graph_search_tool(GraphSearchInput(query=query)))
        results["search_methods_used"].append("graph_search")

    if tasks:
        search_results = await asyncio.gather(*tasks, return_exceptions=True)

        result_index = 0
        if use_vector and not isinstance(search_results[result_index], Exception):
            results["vector_results"] = search_results[result_index]
            result_index += 1

        if use_graph and result_index < len(search_results):
            if not isinstance(search_results[result_index], Exception):
                results["graph_results"] = search_results[result_index]

    results["total_results"] = len(results["vector_results"]) + len(results["graph_results"])

    return results