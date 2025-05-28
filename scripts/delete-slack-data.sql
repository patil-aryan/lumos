-- Delete all Slack data from database
-- Execute this before implementing the new Slack integration

-- Delete in order to respect foreign key constraints
DELETE FROM "SlackMessageEmbedding";
DELETE FROM "SlackFile";
DELETE FROM "SlackMessage";
DELETE FROM "SlackChannel";
DELETE FROM "SlackUser";
DELETE FROM "SlackWorkspace";

-- Reset any auto-increment sequences if needed
-- (PostgreSQL UUID fields don't need sequence reset)

-- Verify deletion
SELECT 'SlackWorkspace' as table_name, COUNT(*) as remaining_rows FROM "SlackWorkspace"
UNION ALL
SELECT 'SlackUser' as table_name, COUNT(*) as remaining_rows FROM "SlackUser"  
UNION ALL
SELECT 'SlackChannel' as table_name, COUNT(*) as remaining_rows FROM "SlackChannel"
UNION ALL
SELECT 'SlackMessage' as table_name, COUNT(*) as remaining_rows FROM "SlackMessage"
UNION ALL
SELECT 'SlackFile' as table_name, COUNT(*) as remaining_rows FROM "SlackFile"
UNION ALL
SELECT 'SlackMessageEmbedding' as table_name, COUNT(*) as remaining_rows FROM "SlackMessageEmbedding"; 