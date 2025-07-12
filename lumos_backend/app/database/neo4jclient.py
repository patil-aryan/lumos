import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from graphiti_core import Graphiti
from graphiti_core.llm_client.openai_client import OpenAIClient
from graphiti_core.embedder.openai_embedder import OpenAIEmbedder
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.embedder.config import OpenAIEmbedderConfig
from graphiti_core.reranker.openai_reranker import OpenAIRerankerClient
from graphiti_core.nodes import EpisodeType
from graphiti_core.utils.maintenance.graph_data_operations import clear_data

from app.config import settings

logger = logging.getLogger(__name__)

class GraphitiClient:
    """Manages Graphiti knowledge graph operations."""

    def __init__(self):
        """Initialize Graphiti client configuration."""
        self.neo4j_uri = settings.neo4j_uri
        self.neo4j_user = settings.neo4j_user
        self.neo4j_password = settings.neo4j_password

        # LLM configuration
        self.llm_api_key = settings.llm_api_key
        self.llm_model = settings.llm_model
        self.llm_base_url = settings.llm_base_url

        # Embedding configuration
        self.embedding_api_key = settings.embedding_api_key
        self.embedding_model = settings.embedding_model
        self.embedding_dimensions = settings.embedding_dimensions

        self.graphiti: Optional[Graphiti] = None
        self._initialized = False

    async def initialize(self):
        """Initialize Graphiti client."""
        if self._initialized:
            return

        try:
            # Create LLM config
            llm_config = LLMConfig(
                api_key=self.llm_api_key,
                model=self.llm_model,
                small_model=self.llm_model,  # Use same model for both
                base_url=self.llm_base_url
            )

            # Create OpenAI LLM client
            llm_client = OpenAIClient(config=llm_config)

            # Create OpenAI embedder
            embedder = OpenAIEmbedder(
                config=OpenAIEmbedderConfig(
                    api_key=self.embedding_api_key,
                    embedding_model=self.embedding_model,
                    embedding_dim=self.embedding_dimensions,
                    base_url=self.llm_base_url.replace("/v1", "/v1") if "/v1" in self.llm_base_url else self.llm_base_url
                )
            )

            # Initialize Graphiti
            self.graphiti = Graphiti(
                self.neo4j_uri,
                self.neo4j_user,
                self.neo4j_password,
                llm_client=llm_client,
                embedder=embedder,
                cross_encoder=OpenAIRerankerClient(client=llm_client, config=llm_config)
            )

            # Build indices and constraints
            await self.graphiti.build_indices_and_constraints()

            self._initialized = True
            logger.info(f"Graphiti client initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Graphiti: {e}")
            raise

    async def close(self):
        """Close Graphiti connection."""
        if self.graphiti:
            await self.graphiti.close()
            self.graphiti = None
            self._initialized = False
            logger.info("Graphiti client closed")

    async def add_episode(
        self,
        episode_id: str,
        content: str,
        source: str,
        timestamp: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add an episode to the knowledge graph.

        Args:
            episode_id: Unique episode identifier
            content: Episode content
            source: Source of the content
            timestamp: Episode timestamp
            metadata: Additional metadata

        Returns:
            Episode ID
        """
        if not self._initialized:
            await self.initialize()

        episode_timestamp = timestamp or datetime.now(timezone.utc)

        try:
            await self.graphiti.add_episode(
                name=episode_id,
                episode_body=content,
                source=EpisodeType.text,
                source_description=source,
                reference_time=episode_timestamp
            )

            logger.info(f"Added episode {episode_id} to knowledge graph")
            return episode_id

        except Exception as e:
            logger.error(f"Failed to add episode {episode_id}: {e}")
            raise

    async def search(
        self,
        query: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Search the knowledge graph.

        Args:
            query: Search query
            limit: Maximum results (not used by Graphiti directly)

        Returns:
            Search results
        """
        if not self._initialized:
            await self.initialize()

        try:
            results = await self.graphiti.search(query)

            # Convert results to dictionaries
            return [
                {
                    "fact": result.fact,
                    "uuid": str(result.uuid),
                    "valid_at": str(result.valid_at) if hasattr(result, 'valid_at') and result.valid_at else None,
                    "invalid_at": str(result.invalid_at) if hasattr(result, 'invalid_at') and result.invalid_at else None,
                    "source_node_uuid": str(result.source_node_uuid) if hasattr(result, 'source_node_uuid') and result.source_node_uuid else None
                }
                for result in results[:limit]  # Apply limit manually
            ]

        except Exception as e:
            logger.error(f"Graph search failed: {e}")
            return []

    async def get_related_entities(
        self,
        entity_name: str,
        depth: int = 2
    ) -> Dict[str, Any]:
        """
        Get entities related to a given entity.

        Args:
            entity_name: Name of the entity
            depth: Maximum depth to traverse

        Returns:
            Related entities and relationships
        """
        if not self._initialized:
            await self.initialize()

        try:
            # Use Graphiti search to find related information
            results = await self.graphiti.search(f"relationships involving {entity_name}")

            # Extract entity information from search results
            related_facts = []

            for result in results:
                fact_data = {
                    "fact": result.fact,
                    "uuid": str(result.uuid),
                    "valid_at": str(result.valid_at) if hasattr(result, 'valid_at') and result.valid_at else None
                }
                related_facts.append(fact_data)

            return {
                "central_entity": entity_name,
                "related_facts": related_facts,
                "search_method": "graphiti_semantic_search",
                "depth": depth
            }

        except Exception as e:
            logger.error(f"Failed to get related entities for {entity_name}: {e}")
            return {
                "central_entity": entity_name,
                "related_facts": [],
                "error": str(e)
            }

    async def get_entity_timeline(
        self,
        entity_name: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get timeline of facts for an entity.

        Args:
            entity_name: Name of the entity
            start_date: Start of time range
            end_date: End of time range

        Returns:
            Timeline of facts
        """
        if not self._initialized:
            await self.initialize()

        try:
            # Search for temporal information about the entity
            timeline_query = f"timeline history evolution of {entity_name}"
            if start_date and end_date:
                timeline_query += f" between {start_date.isoformat()} and {end_date.isoformat()}"

            results = await self.graphiti.search(timeline_query)

            timeline = []
            for result in results:
                timeline.append({
                    "fact": result.fact,
                    "uuid": str(result.uuid),
                    "valid_at": str(result.valid_at) if hasattr(result, 'valid_at') and result.valid_at else None,
                    "invalid_at": str(result.invalid_at) if hasattr(result, 'invalid_at') and result.invalid_at else None
                })

            # Sort by valid_at if available
            timeline.sort(
                key=lambda x: x.get('valid_at') or '1900-01-01T00:00:00Z',
                reverse=True
            )

            return timeline

        except Exception as e:
            logger.error(f"Failed to get timeline for {entity_name}: {e}")
            return []

    async def get_graph_statistics(self) -> Dict[str, Any]:
        """
        Get basic statistics about the knowledge graph.

        Returns:
            Graph statistics
        """
        if not self._initialized:
            await self.initialize()

        try:
            # Perform a test search to verify graph is working
            test_results = await self.graphiti.search("test")

            return {
                "graphiti_initialized": True,
                "sample_search_results": len(test_results),
                "neo4j_uri": self.neo4j_uri,
                "llm_model": self.llm_model,
                "embedding_model": self.embedding_model,
                "note": "Detailed statistics require direct Neo4j access"
            }

        except Exception as e:
            logger.error(f"Failed to get graph statistics: {e}")
            return {
                "graphiti_initialized": False,
                "error": str(e)
            }

    async def clear_graph(self):
        """Clear all data from the graph (USE WITH CAUTION)."""
        if not self._initialized:
            await self.initialize()

        try:
            # Use Graphiti's clear_data function
            await clear_data(self.graphiti.driver)
            logger.warning("Cleared all data from knowledge graph")

        except Exception as e:
            logger.error(f"Failed to clear graph: {e}")
            # Fallback: reinitialize
            await self.close()
            await self.initialize()
            logger.warning("Reinitialized Graphiti client (fresh indices created)")

# Global client instance
graph_client = GraphitiClient()

# Convenience functions
async def init_neo4j():
    """Initialize Neo4j client."""
    await graph_client.initialize()

async def close_neo4j():
    """Close Neo4j client."""
    await graph_client.close()

async def add_to_knowledge_graph(
    content: str,
    source: str,
    episode_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Add content to the knowledge graph.

    Args:
        content: Content to add
        source: Source of the content
        episode_id: Optional episode ID
        metadata: Optional metadata

    Returns:
        Episode ID
    """
    if not episode_id:
        episode_id = f"episode_{datetime.now(timezone.utc).isoformat()}"

    return await graph_client.add_episode(
        episode_id=episode_id,
        content=content,
        source=source,
        metadata=metadata
    )

async def search_knowledge_graph(query: str) -> List[Dict[str, Any]]:
    """
    Search the knowledge graph.

    Args:
        query: Search query

    Returns:
        Search results
    """
    return await graph_client.search(query)

async def get_entity_relationships(
    entity: str,
    depth: int = 2
) -> Dict[str, Any]:
    """
    Get relationships for an entity.

    Args:
        entity: Entity name
        depth: Maximum traversal depth

    Returns:
        Entity relationships
    """
    return await graph_client.get_related_entities(entity, depth=depth)

async def test_graph_connection() -> bool:
    """
    Test graph database connection.

    Returns:
        True if connection successful
    """
    try:
        await graph_client.initialize()
        stats = await graph_client.get_graph_statistics()
        logger.info(f"Graph connection successful. Stats: {stats}")
        return stats.get("graphiti_initialized", False)
    except Exception as e:
        logger.error(f"Graph connection test failed: {e}")
        return False