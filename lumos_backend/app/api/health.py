"""
Health check endpoints.
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import logging

from app.models.responses import HealthStatus
from app.database.postgresql import test_connection
from app.database.neo4j_client import test_graph_connection
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/", response_model=HealthStatus)
async def health_check():
    """Comprehensive health check."""
    try:
        # Test database connections
        db_status = await test_connection()
        graph_status = await test_graph_connection()

        # Determine overall status
        if db_status and graph_status:
            status = "healthy"
        elif db_status or graph_status:
            status = "degraded"
        else:
            status = "unhealthy"

        return HealthStatus(
            status=status,
            database=db_status,
            graph_database=graph_status,
            llm_connection=True,  # Assume OK if we can respond
            version=settings.app_version,
            timestamp=datetime.now()
        )

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")

@router.get("/database")
async def check_database():
    """Check database connection only."""
    db_status = await test_connection()
    return {"database": db_status, "timestamp": datetime.now()}

@router.get("/graph")
async def check_graph():
    """Check graph database connection only."""
    graph_status = await test_graph_connection()
    return {"graph_database": graph_status, "timestamp": datetime.now()}
