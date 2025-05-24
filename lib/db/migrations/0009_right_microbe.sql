-- Custom SQL migration file, put you code below! --

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create SlackMessageEmbedding table for RAG functionality
CREATE TABLE IF NOT EXISTS "SlackMessageEmbedding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" uuid NOT NULL,
	"workspaceId" uuid NOT NULL,
	"content" text NOT NULL,
	"contextInfo" json NOT NULL,
	"embedding" vector(1536),
	"createdAt" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "SlackMessageEmbedding" ADD CONSTRAINT "SlackMessageEmbedding_messageId_SlackMessage_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."SlackMessage"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "SlackMessageEmbedding" ADD CONSTRAINT "SlackMessageEmbedding_workspaceId_SlackWorkspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."SlackWorkspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Create vector similarity index for fast retrieval
CREATE INDEX IF NOT EXISTS "slack_embedding_cosine_idx" ON "SlackMessageEmbedding" USING hnsw (embedding vector_cosine_ops);