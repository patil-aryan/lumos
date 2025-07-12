from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
import uuid
from datetime import datetime

Base = declarative_base()

class User(Base):
    """User model - keeping compatibility with existing Lumos."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255))
    name = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    conversations = relationship("AgentConversation", back_populates="user")
    slack_workspaces = relationship("SlackWorkspace", back_populates="user")

class SlackWorkspace(Base):
    """Slack workspace integration - enhanced from existing."""
    __tablename__ = "slack_workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    team_id = Column(String(255), unique=True, nullable=False)
    team_name = Column(String(255))
    access_token = Column(Text)
    bot_token = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_sync_at = Column(DateTime(timezone=True))
    sync_start_date = Column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="slack_workspaces")
    messages = relationship("SlackMessage", back_populates="workspace")
    embeddings = relationship("HybridEmbedding", back_populates="slack_workspace")
    episodes = relationship("KnowledgeEpisode", back_populates="workspace")

class SlackMessage(Base):
    """Slack message - enhanced from existing."""
    __tablename__ = "slack_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("slack_workspaces.id"))
    message_id = Column(String(255), nullable=False)
    channel_id = Column(String(255))
    user_id = Column(String(255))
    username = Column(String(255))
    text = Column(Text)
    timestamp = Column(String(255))
    thread_ts = Column(String(255))
    metadata = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace = relationship("SlackWorkspace", back_populates="messages")
    embeddings = relationship("HybridEmbedding", back_populates="slack_message")

class AgentConversation(Base):
    """Agent conversation tracking."""
    __tablename__ = "agent_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(255), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    metadata = Column(JSON, default={})

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("AgentMessage", back_populates="conversation")

class AgentMessage(Base):
    """Agent message tracking."""
    __tablename__ = "agent_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("agent_conversations.id"))
    role = Column(String(50), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text, nullable=False)
    tools_used = Column(JSON, default=[])
    metadata = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("AgentConversation", back_populates="messages")
    tool_usage = relationship("ToolUsage", back_populates="message")

class ToolUsage(Base):
    """Tool usage analytics."""
    __tablename__ = "tool_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(UUID(as_uuid=True), ForeignKey("agent_messages.id"))
    tool_name = Column(String(100), nullable=False)
    tool_args = Column(JSON)
    execution_time_ms = Column(Integer)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    message = relationship("AgentMessage", back_populates="tool_usage")

class HybridEmbedding(Base):
    """Enhanced embeddings for hybrid search."""
    __tablename__ = "hybrid_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_id = Column(UUID(as_uuid=True), nullable=False)
    content_type = Column(String(50), nullable=False, index=True)  # 'slack_message', 'confluence_page', etc.
    content = Column(Text, nullable=False)
    embedding = Column(Vector(1536))
    chunk_index = Column(Integer, default=0)
    metadata = Column(JSON, default={})
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("slack_workspaces.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    slack_workspace = relationship("SlackWorkspace", back_populates="embeddings")
    slack_message = relationship("SlackMessage", back_populates="embeddings")

class KnowledgeEpisode(Base):
    """Knowledge graph episodes linking to Neo4j."""
    __tablename__ = "knowledge_episodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    episode_id = Column(String(255), unique=True, nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(255), nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("slack_workspaces.id"), nullable=True)
    neo4j_node_id = Column(String(255))
    metadata = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    workspace = relationship("SlackWorkspace", back_populates="episodes")