"""
Embedding generation utilities.
"""

import logging
import asyncio
from typing import List, Optional
import openai
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = AsyncOpenAI(
    api_key=settings.embedding_api_key,
    base_url=settings.llm_base_url,
)

async def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding for a single text.

    Args:
        text: Text to embed

    Returns:
        Embedding vector
    """
    try:
        # Clean and prepare text
        clean_text = text.strip()
        if not clean_text:
            return [0.0] * settings.embedding_dimensions

        # Generate embedding
        response = await openai_client.embeddings.create(
            model=settings.embedding_model,
            input=clean_text,
        )

        return response.data[0].embedding

    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        # Return zero vector as fallback
        return [0.0] * settings.embedding_dimensions

async def generate_embeddings_batch(texts: List[str], batch_size: int = 10) -> List[List[float]]:
    """
    Generate embeddings for multiple texts in batches.

    Args:
        texts: List of texts to embed
        batch_size: Number of texts to process at once

    Returns:
        List of embedding vectors
    """
    embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]

        try:
            # Process batch
            response = await openai_client.embeddings.create(
                model=settings.embedding_model,
                input=batch,
            )

            batch_embeddings = [data.embedding for data in response.data]
            embeddings.extend(batch_embeddings)

            # Rate limiting
            await asyncio.sleep(0.1)

        except Exception as e:
            logger.error(f"Failed to generate batch embeddings: {e}")
            # Add zero vectors for failed batch
            fallback_embeddings = [[0.0] * settings.embedding_dimensions] * len(batch)
            embeddings.extend(fallback_embeddings)

    return embeddings

def cosine_similarity(a: List[float], b: List[float]) -> float:
    """
    Calculate cosine similarity between two vectors.

    Args:
        a: First vector
        b: Second vector

    Returns:
        Cosine similarity score
    """
    import math

    dot_product = sum(x * y for x, y in zip(a, b))
    magnitude_a = math.sqrt(sum(x * x for x in a))
    magnitude_b = math.sqrt(sum(x * x for x in b))

    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0

    return dot_product / (magnitude_a * magnitude_b)