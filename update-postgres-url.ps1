# Read the current .env.local file
$envContent = Get-Content -Path ".env.local" -Raw

# Update the POSTGRES_URL with SSL mode
$updatedContent = $envContent -replace 'POSTGRES_URL=.*', 'POSTGRES_URL=postgresql://neondb_owner:npg_jEcwZ7JOVad9@ep-young-glade-a53uzpdx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'

# Write the updated content back to .env.local
Set-Content -Path ".env.local" -Value $updatedContent

# Set the environment variable for current session
$env:POSTGRES_URL = "postgresql://neondb_owner:npg_jEcwZ7JOVad9@ep-young-glade-a53uzpdx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"

Write-Host "PostgreSQL URL updated with SSL mode!" -ForegroundColor Green
Write-Host "Testing database connection..." -ForegroundColor Yellow

# Test the connection
npx tsx lib/db/check-connection.ts 