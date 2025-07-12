import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
      # Application settings
      app_name: str = "Lumos Hybrid RAG"
      app_version: str = "1.0.0"
      debug: bool = False

      # Server settings
      host: str = "0.0.0.0"
      port: int = 8000

      # Database settings
      database_url: str

      # Neo4j settings
      neo4j_uri: str = "bolt://localhost:7687"
      neo4j_user: str = "neo4j"
      neo4j_password: str

      # LLM settings
      llm_provider: str = "openai"
      llm_api_key: str
      llm_base_url: str = "https://api.openai.com/v1"
      llm_model: str = "gpt-4-turbo-preview"

      # Embedding settings
      embedding_api_key: str
      embedding_model: str = "text-embedding-3-small"
      embedding_dimensions: int = 1536

      # Authentication
      jwt_secret: str
      jwt_algorithm: str = "HS256"
      access_token_expire_minutes: int = 30

      # Integration settings
      slack_client_id: Optional[str] = None
      slack_client_secret: Optional[str] = None
      confluence_client_id: Optional[str] = None
      confluence_client_secret: Optional[str] = None
      jira_client_id: Optional[str] = None
      jira_client_secret: Optional[str] = None

      # CORS settings
      allowed_origins: list[str] = ["http://localhost:3000", "https://your-frontend-domain.com"]

      class Config:
          env_file = ".env"
          case_sensitive = False

settings = Settings()