from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
import logging
from contextlib import asynccontextmanager

from app.config import settings
from app.api import chat, integrations, auth, health
from app.database.postgresql import init_db, close_db
from app.database.neo4j_client import init_neo4j, close_neo4j
from app.utils.logging import setup_logging

  # Setup logging
setup_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
      """Application lifespan events."""
      # Startup
      logger.info("Starting Lumos Hybrid RAG backend...")
      await init_db()
      await init_neo4j()
      logger.info("Database connections initialized")

      yield

      # Shutdown
      logger.info("Shutting down...")
      await close_db()
      await close_neo4j()
      logger.info("Shutdown complete")

app = FastAPI(
      title=settings.app_name,
      version=settings.app_version,
      debug=settings.debug,
      lifespan=lifespan
)

# Middleware
app.add_middleware(
      CORSMiddleware,
      allow_origins=settings.allowed_origins,
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
)

app.add_middleware(
      TrustedHostMiddleware,
      allowed_hosts=["localhost", "127.0.0.1", "*.vercel.app"]
)

  # Include routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(integrations.router, prefix="/integrations", tags=["integrations"])

@app.get("/")
async def root():
      """Root endpoint."""
      return {
          "message": "Lumos Hybrid RAG API",
          "version": settings.app_version,
          "status": "running"
      }

if __name__ == "__main__":
      uvicorn.run(
          "app.main:app",
          host=settings.host,
          port=settings.port,
          reload=settings.debug,
          log_level="info"
        )