CREATE TABLE IF NOT EXISTS "SlackFile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fileId" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"mimetype" varchar(128),
	"filetype" varchar(32),
	"size" varchar(32),
	"urlPrivate" text,
	"content" text,
	"slackUserId" varchar(32) NOT NULL,
	"userName" text,
	"workspaceId" uuid NOT NULL,
	"messageId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"extractedAt" timestamp,
	"metadata" json,
	CONSTRAINT "SlackFile_fileId_unique" UNIQUE("fileId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SlackMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"messageId" varchar(64) NOT NULL,
	"channelId" varchar(32) NOT NULL,
	"channelName" text,
	"slackUserId" varchar(32) NOT NULL,
	"userName" text,
	"text" text,
	"timestamp" varchar(32) NOT NULL,
	"messageType" varchar(16) DEFAULT 'message' NOT NULL,
	"workspaceId" uuid NOT NULL,
	"threadTs" varchar(32),
	"hasFiles" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SlackWorkspace" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" varchar(32) NOT NULL,
	"teamName" text NOT NULL,
	"accessToken" text NOT NULL,
	"botUserId" varchar(32),
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	CONSTRAINT "SlackWorkspace_teamId_unique" UNIQUE("teamId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SlackFile" ADD CONSTRAINT "SlackFile_workspaceId_SlackWorkspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."SlackWorkspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SlackFile" ADD CONSTRAINT "SlackFile_messageId_SlackMessage_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."SlackMessage"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SlackMessage" ADD CONSTRAINT "SlackMessage_workspaceId_SlackWorkspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."SlackWorkspace"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SlackWorkspace" ADD CONSTRAINT "SlackWorkspace_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
