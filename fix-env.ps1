# Fix malformed environment variables
Write-Host "Fixing .env.local file..." -ForegroundColor Green

# Read current content
$currentContent = Get-Content .env.local -Raw

# Fix the POSTGRES_URL (complete the truncated URL)
$fixedContent = $currentContent -replace 'POSTGRES_URL=postgresql://neondb_owner:npg_jEcwZ7JOVad9@ep-young-glade-a53uzpdx-pooler\.us-east-2\.aws\.neon.*', 'POSTGRES_URL=postgresql://neondb_owner:npg_jEcwZ7JOVad9@ep-young-glade-a53uzpdx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'

# Add Slack configuration section if not present
if ($fixedContent -notlike "*SLACK_CLIENT_ID*") {
    $slackConfig = @"

# Slack Integration (uncomment and add your actual values)
# SLACK_CLIENT_ID=your_slack_client_id_here
# SLACK_CLIENT_SECRET=your_slack_client_secret_here
# SLACK_REDIRECT_URI=http://localhost:3000/api/slack/oauth
"@
    $fixedContent += $slackConfig
}

# Write back to file
$fixedContent | Out-File -FilePath .env.local -Encoding UTF8 -NoNewline

Write-Host "✅ Fixed POSTGRES_URL and added Slack configuration template" -ForegroundColor Green
Write-Host "📝 Edit .env.local to add your actual Slack credentials" -ForegroundColor Yellow 