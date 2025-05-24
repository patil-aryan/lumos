CREATE TABLE IF NOT EXISTS "SlackChannel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channelId" varchar(32) NOT NULL,
	"workspaceId" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text,
	"topic" text,
	"isPrivate" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"memberCount" varchar(16) DEFAULT '0',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SlackUser" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" varchar(32) NOT NULL,
	"workspaceId" uuid NOT NULL,
	"username" text,
	"realName" text,
	"displayName" text,
	"email" text,
	"title" text,
	"phone" text,
	"isBot" boolean DEFAULT false NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"isOwner" boolean DEFAULT false NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"profileImage" text,
	"status" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"metadata" json
);
--> statement-breakpoint
ALTER TABLE "SlackWorkspace" ADD COLUMN "syncStartDate" timestamp;--> statement-breakpoint
ALTER TABLE "SlackWorkspace" ADD COLUMN "lastSyncAt" timestamp;--> statement-breakpoint
ALTER TABLE "SlackWorkspace" ADD COLUMN "totalChannels" varchar(16) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "SlackWorkspace" ADD COLUMN "totalUsers" varchar(16) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "SlackWorkspace" ADD COLUMN "syncSettings" json;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SlackChannel" ADD CONSTRAINT "SlackChannel_workspaceId_SlackWorkspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."SlackWorkspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SlackUser" ADD CONSTRAINT "SlackUser_workspaceId_SlackWorkspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."SlackWorkspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
