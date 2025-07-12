"""
Integration endpoints for Slack, Confluence, and Jira with knowledge graph building.
"""

import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, func, String

from app.models.database import User, SlackWorkspace, SlackMessage, HybridEmbedding, KnowledgeEpisode
from app.database.postgresql import get_db, AsyncSessionLocal
from app.database.neo4j_client import add_to_knowledge_graph
from app.api.auth import get_current_user
from app.utils.embeddings import generate_embedding
from app.integrations.slack import SlackClient
from app.integrations.confluence import ConfluenceClient
from app.integrations.jira import JiraClient

router = APIRouter()
logger = logging.getLogger(__name__)

class IntegrationStatus(BaseModel):
    """Integration status response."""
    integration_type: str
    connected: bool
    workspace_name: Optional[str] = None
    last_sync: Optional[datetime] = None
    total_messages: Optional[int] = None
    total_embeddings: Optional[int] = None
    total_episodes: Optional[int] = None

async def process_slack_message_for_kg(
    message: SlackMessage,
    workspace: SlackWorkspace,
    db: AsyncSession
):
    """Process a Slack message for knowledge graph and embeddings."""
    try:
        # Create episode for knowledge graph
        episode_id = f"slack_msg_{message.id}"
        episode_content = f"""
        Slack Message from {message.username} in {workspace.team_name}:
        Channel: {message.channel_id}
        Timestamp: {message.timestamp}
        Content: {message.text}
        """

        # Add to knowledge graph
        await add_to_knowledge_graph(
            content=episode_content,
            source=f"slack_{workspace.team_name}",
            episode_id=episode_id,
            metadata={
                "message_id": str(message.id),
                "workspace_id": str(workspace.id),
                "channel_id": message.channel_id,
                "username": message.username,
                "timestamp": message.timestamp
            }
        )

        # Create knowledge episode record
        episode = KnowledgeEpisode(
            episode_id=episode_id,
            content=episode_content,
            source=f"slack_{workspace.team_name}",
            workspace_id=workspace.id,
            metadata={
                "message_id": str(message.id),
                "channel_id": message.channel_id,
                "username": message.username
            }
        )
        db.add(episode)

        # Generate embedding
        if message.text and len(message.text.strip()) > 10:  # Only embed substantial content
            embedding = await generate_embedding(message.text)

            hybrid_embedding = HybridEmbedding(
                content_id=message.id,
                content_type="slack_message",
                content=message.text,
                embedding=embedding,
                workspace_id=workspace.id,
                metadata={
                    "channel_id": message.channel_id,
                    "username": message.username,
                    "timestamp": message.timestamp,
                    "thread_ts": message.thread_ts
                }
            )
            db.add(hybrid_embedding)

        await db.flush()
        logger.debug(f"Processed message {message.id} for KG and embeddings")

    except Exception as e:
        logger.error(f"Failed to process message {message.id} for KG: {e}")

@router.get("/slack/status")
async def get_slack_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> IntegrationStatus:
    """Get Slack integration status."""
    try:
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.user_id == user.id)
        )
        workspace = result.scalar_one_or_none()

        if not workspace:
            return IntegrationStatus(
                integration_type="slack",
                connected=False
            )

        # Get counts
        messages_result = await db.execute(
            select(func.count(SlackMessage.id)).where(SlackMessage.workspace_id == workspace.id)
        )
        message_count = messages_result.scalar()

        embeddings_result = await db.execute(
            select(func.count(HybridEmbedding.id)).where(
                HybridEmbedding.workspace_id == workspace.id,
                HybridEmbedding.content_type == "slack_message"
            )
        )
        embedding_count = embeddings_result.scalar()

        episodes_result = await db.execute(
            select(func.count(KnowledgeEpisode.id)).where(KnowledgeEpisode.workspace_id == workspace.id)
        )
        episode_count = episodes_result.scalar()

        return IntegrationStatus(
            integration_type="slack",
            connected=True,
            workspace_name=workspace.team_name,
            last_sync=workspace.last_sync_at,
            total_messages=message_count,
            total_embeddings=embedding_count,
            total_episodes=episode_count
        )

    except Exception as e:
        logger.error(f"Failed to get Slack status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/slack/sync")
async def sync_slack_data(
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Sync Slack data with knowledge graph and embeddings."""
    try:
        result = await db.execute(
            select(SlackWorkspace).where(SlackWorkspace.user_id == user.id)
        )
        workspace = result.scalar_one_or_none()

        if not workspace:
            raise HTTPException(status_code=404, detail="Slack workspace not connected")

        # Background task for sync
        background_tasks.add_task(
            sync_slack_workspace_data,
            workspace.id,
            user.id
        )

        return {
            "message": "Slack sync started",
            "workspace": workspace.team_name,
            "status": "processing"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start Slack sync: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def sync_slack_workspace_data(workspace_id: str, user_id: str):
    """Background task to sync Slack workspace data."""
    try:
        async with AsyncSessionLocal() as db:
            # Get workspace
            result = await db.execute(
                select(SlackWorkspace).where(SlackWorkspace.id == workspace_id)
            )
            workspace = result.scalar_one()

            if not workspace:
                logger.error(f"Workspace {workspace_id} not found")
                return

            # Initialize Slack client
            slack_client = SlackClient(workspace.bot_token)

            # Get messages that haven't been processed for KG
            messages_result = await db.execute(
                select(SlackMessage)
                .where(SlackMessage.workspace_id == workspace.id)
                .outerjoin(KnowledgeEpisode, KnowledgeEpisode.metadata['message_id'].astext == SlackMessage.id.cast(String))
                .where(KnowledgeEpisode.id.is_(None))
                .limit(100)  # Process in batches
            )
            messages = messages_result.scalars().all()

            logger.info(f"Processing {len(messages)} messages for workspace {workspace.team_name}")

            # Process messages in batches
            batch_size = 10
            for i in range(0, len(messages), batch_size):
                batch = messages[i:i + batch_size]

                # Process batch
                for message in batch:
                    await process_slack_message_for_kg(message, workspace, db)

                # Commit batch
                await db.commit()
                logger.info(f"Processed batch {i//batch_size + 1} of {len(messages)//batch_size + 1}")

                # Small delay to avoid overwhelming the system
                await asyncio.sleep(1)

            # Update last sync time
            workspace.last_sync_at = datetime.now()
            await db.commit()

            logger.info(f"Completed sync for workspace {workspace.team_name}")

    except Exception as e:
        logger.error(f"Failed to sync workspace data: {e}")

@router.post("/slack/oauth")
async def slack_oauth_callback(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Handle Slack OAuth callback."""
    try:
        # Initialize Slack client for OAuth
        slack_client = SlackClient()

        # Exchange code for tokens
        oauth_response = await slack_client.oauth_v2_access(code)

        if not oauth_response.get("ok"):
            raise HTTPException(status_code=400, detail="OAuth exchange failed")

        team_info = oauth_response["team"]
        access_token = oauth_response["access_token"]
        bot_token = oauth_response.get("bot_user", {}).get("bot_access_token")

        # Create or update workspace
        result = await db.execute(
            select(SlackWorkspace).where(
                SlackWorkspace.user_id == user.id,
                SlackWorkspace.team_id == team_info["id"]
            )
        )
        workspace = result.scalar_one_or_none()

        if workspace:
            # Update existing
            workspace.access_token = access_token
            workspace.bot_token = bot_token
            workspace.team_name = team_info["name"]
        else:
            # Create new
            workspace = SlackWorkspace(
                user_id=user.id,
                team_id=team_info["id"],
                team_name=team_info["name"],
                access_token=access_token,
                bot_token=bot_token
            )
            db.add(workspace)

        await db.commit()

        return {
            "message": "Slack workspace connected successfully",
            "workspace_name": team_info["name"],
            "team_id": team_info["id"]
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Slack OAuth failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Similar endpoints for Confluence and Jira...
@router.get("/confluence/status")
async def get_confluence_status(user: User = Depends(get_current_user)):
    """Get Confluence integration status."""
    return IntegrationStatus(
        integration_type="confluence",
        connected=False  # TODO: Implement
    )

@router.get("/jira/status")
async def get_jira_status(user: User = Depends(get_current_user)):
    """Get Jira integration status."""
    return IntegrationStatus(
        integration_type="jira",
        connected=False  # TODO: Implement
    )

@router.get("/status")
async def get_all_integrations_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get status of all integrations."""
    try:
        slack_status = await get_slack_status(user, db)
        confluence_status = await get_confluence_status(user)
        jira_status = await get_jira_status(user)

        return {
            "slack": slack_status,
            "confluence": confluence_status,
            "jira": jira_status,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Failed to get integrations status: {e}")
        raise HTTPException(status_code=500, detail=str(e))