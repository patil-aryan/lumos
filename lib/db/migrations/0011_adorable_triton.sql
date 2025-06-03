DROP INDEX IF EXISTS "slack_embedding_cosine_idx";--> statement-breakpoint
ALTER TABLE "SlackMessageEmbedding" DROP COLUMN IF EXISTS "embedding";