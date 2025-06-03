CREATE TABLE "confluence_workspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cloud_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"scopes" text,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"metadata" jsonb,
	"last_sync_at" timestamp,
	"last_full_sync_at" timestamp,
	"total_spaces" integer DEFAULT 0,
	"total_pages" integer DEFAULT 0,
	"total_blog_posts" integer DEFAULT 0,
	"total_users" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "confluence_workspace_cloud_id_unique" UNIQUE("cloud_id")
);
--> statement-breakpoint
CREATE TABLE "confluence_space" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"space_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text,
	"status" text,
	"homepage_id" text,
	"metadata" jsonb,
	"permissions" jsonb,
	"page_count" integer DEFAULT 0,
	"blog_post_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "confluence_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"space_id" uuid NOT NULL,
	"page_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"status" text,
	"content" text,
	"content_html" text,
	"excerpt" text,
	"parent_id" text,
	"position" integer,
	"author_id" text,
	"author_display_name" text,
	"last_modifier_id" text,
	"last_modifier_display_name" text,
	"labels" jsonb,
	"metadata" jsonb,
	"restrictions" jsonb,
	"web_url" text,
	"edit_url" text,
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"version_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "confluence_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email_address" text,
	"account_type" text,
	"active" boolean DEFAULT true,
	"profile_picture" text,
	"time_zone" text,
	"locale" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "confluence_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"comment_id" text NOT NULL,
	"content" text,
	"content_html" text,
	"author_id" text,
	"author_display_name" text,
	"parent_comment_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_sync_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "confluence_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"total_items" integer DEFAULT 0,
	"processed_items" integer DEFAULT 0,
	"successful_items" integer DEFAULT 0,
	"failed_items" integer DEFAULT 0,
	"results" jsonb,
	"errors" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_space" ADD CONSTRAINT "confluence_space_workspace_id_confluence_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."confluence_workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_page" ADD CONSTRAINT "confluence_page_workspace_id_confluence_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."confluence_workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_page" ADD CONSTRAINT "confluence_page_space_id_confluence_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."confluence_space"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_user" ADD CONSTRAINT "confluence_user_workspace_id_confluence_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."confluence_workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_comment" ADD CONSTRAINT "confluence_comment_workspace_id_confluence_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."confluence_workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_comment" ADD CONSTRAINT "confluence_comment_page_id_confluence_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."confluence_page"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "confluence_sync_log" ADD CONSTRAINT "confluence_sync_log_workspace_id_confluence_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."confluence_workspace"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX "confluence_workspace_user_id_idx" ON "confluence_workspace" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "confluence_workspace_cloud_id_idx" ON "confluence_workspace" USING btree ("cloud_id");--> statement-breakpoint
CREATE INDEX "confluence_space_workspace_space_idx" ON "confluence_space" USING btree ("workspace_id","space_id");--> statement-breakpoint
CREATE INDEX "confluence_space_key_idx" ON "confluence_space" USING btree ("key");--> statement-breakpoint
CREATE INDEX "confluence_page_workspace_page_idx" ON "confluence_page" USING btree ("workspace_id","page_id");--> statement-breakpoint
CREATE INDEX "confluence_page_space_idx" ON "confluence_page" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "confluence_page_parent_idx" ON "confluence_page" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "confluence_page_status_idx" ON "confluence_page" USING btree ("status");--> statement-breakpoint
CREATE INDEX "confluence_page_type_idx" ON "confluence_page" USING btree ("type");--> statement-breakpoint
CREATE INDEX "confluence_page_updated_at_idx" ON "confluence_page" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "confluence_user_workspace_account_idx" ON "confluence_user" USING btree ("workspace_id","account_id");--> statement-breakpoint
CREATE INDEX "confluence_user_display_name_idx" ON "confluence_user" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "confluence_comment_workspace_comment_idx" ON "confluence_comment" USING btree ("workspace_id","comment_id");--> statement-breakpoint
CREATE INDEX "confluence_comment_page_idx" ON "confluence_comment" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "confluence_comment_author_idx" ON "confluence_comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "confluence_sync_log_workspace_idx" ON "confluence_sync_log" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "confluence_sync_log_status_idx" ON "confluence_sync_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "confluence_sync_log_started_at_idx" ON "confluence_sync_log" USING btree ("started_at"); 