-- Slack Database Inspection Commands
-- Copy and paste these into your database client or psql

-- 1. WORKSPACE OVERVIEW
SELECT 
    sw."teamName",
    sw."teamId", 
    sw."createdAt",
    sw."lastSyncAt",
    sw."syncStartDate",
    sw."isActive"
FROM "SlackWorkspace" sw
WHERE sw."isActive" = true
ORDER BY sw."createdAt" DESC;

-- 2. MESSAGE COUNTS BY WORKSPACE
SELECT 
    sw."teamName",
    COUNT(sm.id) as message_count,
    COUNT(DISTINCT sm."channelId") as channels_with_messages,
    MIN(sm."createdAt") as oldest_message,
    MAX(sm."createdAt") as newest_message
FROM "SlackWorkspace" sw
LEFT JOIN "SlackMessage" sm ON sw.id = sm."workspaceId"
GROUP BY sw.id, sw."teamName"
ORDER BY message_count DESC;

-- 3. USER BREAKDOWN (HUMANS VS BOTS)
SELECT 
    sw."teamName",
    COUNT(CASE WHEN su."isBot" = false THEN 1 END) as human_users,
    COUNT(CASE WHEN su."isBot" = true THEN 1 END) as bot_users,
    COUNT(su.id) as total_users
FROM "SlackWorkspace" sw
LEFT JOIN "SlackUser" su ON sw.id = su."workspaceId" AND su."isDeleted" = false
GROUP BY sw.id, sw."teamName"
ORDER BY total_users DESC;

-- 4. CHANNEL BREAKDOWN  
SELECT 
    sw."teamName",
    COUNT(CASE WHEN sc."isPrivate" = false THEN 1 END) as public_channels,
    COUNT(CASE WHEN sc."isPrivate" = true THEN 1 END) as private_channels,
    COUNT(sc.id) as total_channels
FROM "SlackWorkspace" sw
LEFT JOIN "SlackChannel" sc ON sw.id = sc."workspaceId" AND sc."isArchived" = false
GROUP BY sw.id, sw."teamName"
ORDER BY total_channels DESC;

-- 5. RECENT MESSAGES (LAST 20)
SELECT 
    sm."channelName",
    sm."userName", 
    LEFT(sm."text", 100) as message_preview,
    sm."timestamp",
    sm."createdAt",
    sm."hasFiles"
FROM "SlackMessage" sm
JOIN "SlackWorkspace" sw ON sm."workspaceId" = sw.id
WHERE sw."isActive" = true
ORDER BY sm."timestamp" DESC
LIMIT 20;

-- 6. FILES WITH CONTENT
SELECT 
    sf."name",
    sf."filetype",
    sf."size",
    LENGTH(sf."content") as content_length,
    sf."createdAt"
FROM "SlackFile" sf
JOIN "SlackWorkspace" sw ON sf."workspaceId" = sw.id
WHERE sw."isActive" = true 
AND sf."content" IS NOT NULL
ORDER BY sf."createdAt" DESC
LIMIT 10;

-- 7. SYNC PROGRESS CHECK
SELECT 
    sw."teamName",
    sw."lastSyncAt",
    EXTRACT(EPOCH FROM (NOW() - sw."lastSyncAt"))/3600 as hours_since_last_sync,
    COUNT(sm.id) as total_messages,
    COUNT(DISTINCT DATE(sm."createdAt")) as days_with_messages
FROM "SlackWorkspace" sw
LEFT JOIN "SlackMessage" sm ON sw.id = sm."workspaceId"
GROUP BY sw.id, sw."teamName", sw."lastSyncAt"
ORDER BY sw."lastSyncAt" DESC;

-- 8. HISTORICAL DATA RANGE CHECK
SELECT 
    sw."teamName",
    sw."syncStartDate",
    MIN(sm."timestamp") as oldest_message_timestamp,
    MAX(sm."timestamp") as newest_message_timestamp,
    MIN(TO_TIMESTAMP(sm."timestamp"::bigint)) as oldest_message_date,
    MAX(TO_TIMESTAMP(sm."timestamp"::bigint)) as newest_message_date,
    EXTRACT(DAYS FROM (MAX(TO_TIMESTAMP(sm."timestamp"::bigint)) - MIN(TO_TIMESTAMP(sm."timestamp"::bigint)))) as days_of_history
FROM "SlackWorkspace" sw
LEFT JOIN "SlackMessage" sm ON sw.id = sm."workspaceId"
WHERE sw."isActive" = true
GROUP BY sw.id, sw."teamName", sw."syncStartDate"; 