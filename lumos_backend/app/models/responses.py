"""
Pydantic response models.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime

class ToolCall(BaseModel):
    """Tool call information."""
    tool_name: str
    args: Dict[str, Any]
    tool_call_id: Optional[str] = None
    execution_time_ms: Optional[int] = None

class ChunkResult(BaseModel):
    """Vector search result."""
    chunk_id: str
    document_id: str
    content: str
    score: float
    metadata: Dict[str, Any] = Field(default_factory=dict)
    document_title: str
    document_source: str

class GraphSearchResult(BaseModel):
    """Graph search result."""
    fact: str
    uuid: str
    valid_at: Optional[str] = None
    invalid_at: Optional[str] = None
    source_node_uuid: Optional[str] = None

class ChatResponse(BaseModel):
    """Chat response model."""
    message: str
    session_id: str
    tools_used: List[ToolCall] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.now)

class SearchResponse(BaseModel):
    """Search response model."""
    results: List[ChunkResult] = Field(default_factory=list)
    graph_results: List[GraphSearchResult] = Field(default_factory=list)
    total_results: int
    search_type: str
    query_time_ms: float
    metadata: Dict[str, Any] = Field(default_factory=dict)

class HealthStatus(BaseModel):
    """Health check response."""
    status: str
    database: bool
    graph_database: bool
    llm_connection: bool
    version: str
    timestamp: datetime

class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    error_type: str
    request_id: str
    timestamp: datetime = Field(default_factory=datetime.now)