# Create a .env.local file with the required environment variables
$envContent = @"
# Database Configuration
# The connection string to your PostgreSQL database
POSTGRES_URL=postgres://postgres.xvkupmmpnkgqrvvxshqc:Vy3Jm7Fw76eRFN95@aws-0-us-west-1.pooler.supabase.com:5432/postgres

# Authentication
# Generate a random string with: openssl rand -base64 32
AUTH_SECRET=3c17da0996edc94a55c0e50c038e22da

# Optional - OpenAI API Key for AI features
# OPENAI_API_KEY=your-openai-api-key-here
"@

# Write the content to .env.local
Set-Content -Path ".env.local" -Value $envContent

Write-Host "Created .env.local file with necessary environment variables" -ForegroundColor Green
Write-Host "Setting environment variables for current session..." -ForegroundColor Yellow

# Set environment variables for current session
$env:POSTGRES_URL = "postgres://postgres.xvkupmmpnkgqrvvxshqc:Vy3Jm7Fw76eRFN95@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
$env:AUTH_SECRET = "3c17da0996edc94a55c0e50c038e22da"

Write-Host "Environment variables set successfully!" -ForegroundColor Green
Write-Host "You can now run 'npm run dev' to start your application" -ForegroundColor Cyan 