# Slack Integration Setup

This guide will help you set up Slack integration for Lumos to extract messages, files, and conversations.

## Prerequisites

1. A Slack workspace where you have admin permissions
2. Environment variables configured in your `.env.local` file

## Step 1: Create a Slack App

1. Go to [Slack API Portal](https://api.slack.com/apps)
2. Click "Create New App" → "From Scratch"
3. Name your app (e.g., "Lumos Integration")
4. Select your workspace

## Step 2: Configure OAuth & Permissions

1. In your Slack app settings, go to "OAuth & Permissions"
2. Add the following **Bot Token Scopes**:
   - `channels:history` - Read messages from public channels
   - `groups:history` - Read messages from private channels
   - `im:history` - Read direct messages
   - `mpim:history` - Read group direct messages
   - `channels:read` - View basic information about public channels
   - `groups:read` - View basic information about private channels
   - `im:read` - View basic information about direct messages
   - `mpim:read` - View basic information about group direct messages
   - `users:read` - View people in the workspace
   - `users:read.email` - View email addresses of people in the workspace
   - `files:read` - View files shared in channels and conversations
   - `team:read` - View the workspace name, domain, and icon

3. Set the **Redirect URL**:

### For Local Development/Testing (Temporary Solution)

**Option A: Use ngrok (Recommended for testing)**
```bash
# Install ngrok: https://ngrok.com/download
# Run your app locally first
npm run dev

# In another terminal, create a tunnel
ngrok http 3000

# Use the https URL provided by ngrok (e.g., https://abc123.ngrok.io/api/slack/oauth)
```

**Option B: Local testing only**
- Use: `http://localhost:3000/api/slack/oauth`
- Note: This only works if your Slack workspace allows localhost redirect URLs

### For Production
- Use: `https://yourdomain.com/api/slack/oauth`

## Step 3: Environment Variables

Add these to your `.env.local` file:

```env
# Slack Integration
SLACK_CLIENT_ID="your_slack_client_id"
SLACK_CLIENT_SECRET="your_slack_client_secret"

# For local development with ngrok
SLACK_REDIRECT_URI="https://your-ngrok-url.ngrok.io/api/slack/oauth"

# For localhost testing (if allowed by your Slack workspace)
# SLACK_REDIRECT_URI="http://localhost:3000/api/slack/oauth"

# For production
# SLACK_REDIRECT_URI="https://yourdomain.com/api/slack/oauth"
```

You can find the Client ID and Secret in your Slack app's "Basic Information" page.

## Step 4: Install the App

1. In your Slack app settings, go to "Install App"
2. Click "Install to Workspace"
3. Authorize the app

## Step 5: Test the Integration

### Local Testing Setup

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Set up ngrok (if using Option A):**
   ```bash
   # In a new terminal
   ngrok http 3000
   ```

3. **Update your environment variables** with the ngrok URL

4. **Test the integration:**
   - Navigate to `/integrations` in your app
   - Click "Connect" on the Slack integration
   - Complete the OAuth flow
   - Click "Sync Data" to import messages and files

### Without Production Domain

If you don't have a production domain yet, you have several options:

1. **Use ngrok** (recommended): Creates a temporary public URL for testing
2. **Deploy to Vercel/Netlify**: Get a free subdomain instantly
3. **Test locally**: Some Slack workspaces allow localhost URLs

**Quick Vercel deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (follow the prompts)
vercel

# Your app will get a URL like: https://your-app-name.vercel.app
```

## Features

### What Gets Synced

- **Messages**: All text messages from channels, DMs, and group messages
- **Files**: Text-based files (code, documents, CSVs, etc.) with content extraction
- **User Information**: Names and basic profile data for context
- **Channel Information**: Channel names and types

### File Processing

The integration automatically extracts text content from:
- Plain text files
- Code files (JavaScript, Python, Java, etc.)
- JSON, XML, CSV files
- Markdown files

Binary files (images, videos) are stored with metadata but content is not extracted.

### Data Storage

All Slack data is stored in your PostgreSQL database:
- `SlackWorkspace` - Connected workspaces
- `SlackMessage` - Individual messages with metadata
- `SlackFile` - Files with extracted content

## Security Notes

- Tokens are encrypted and stored securely in your database
- Only authorized users can connect workspaces
- Data is only accessible to the user who connected the workspace
- All API calls use proper authentication

## Troubleshooting

### Common Issues

1. **OAuth fails**: Check that your redirect URI matches exactly
2. **No data synced**: Ensure the bot has proper permissions
3. **Files not downloading**: Check that `files:read` scope is granted
4. **ngrok tunnel expired**: Free ngrok tunnels expire after 2 hours, restart ngrok
5. **Localhost not allowed**: Some Slack workspaces restrict localhost URLs
6. **Redirect loops with tunneling**: See workaround below

### Redirect Loop Fix (Tunneling Services)

If you're getting 307 redirects or "too many redirects" when using ngrok/localtunnel:

**Quick Fix - Bypass Auth for Development:**

1. **Temporarily disable auth middleware** by updating your `middleware.ts`:
   ```typescript
   // Add this at the top of the middleware function, after pathname check
   if (isDevelopmentEnvironment) {
     return NextResponse.next();
   }
   ```

2. **Or use the direct localhost URL** in your Slack app instead of tunneled URL:
   - Set redirect URI to: `http://localhost:3000/api/slack/oauth`
   - Note: This requires your Slack workspace to allow localhost URLs

3. **Alternative: Use a quick deployment**:
   ```bash
   # Deploy to get a real URL
   npx vercel --prod
   # Use the provided URL for Slack OAuth
   ```

**What causes this:**
- The auth middleware redirects unauthenticated users
- Tunneling services can cause URL parsing issues
- This creates a redirect loop between middleware and guest auth

**Production fix:**
- This issue only affects development with tunneling
- In production with real domains, this doesn't occur

### Rate Limits

Slack has rate limits on API calls. The sync process includes:
- Automatic retry logic
- Pagination for large datasets
- Progress tracking

For large workspaces, consider running syncs during off-peak hours.

## Production Deployment

1. Deploy your app to a hosting service (Vercel, Netlify, etc.)
2. Update `SLACK_REDIRECT_URI` to your production domain
3. Update the redirect URL in your Slack app settings
4. Ensure environment variables are set in your production environment
5. Consider implementing a job queue for large syncs

## Next Steps

Once Slack is connected and synced:
1. The chat interface will have access to Slack context
2. You can ask questions about team conversations
3. File contents are searchable and referenceable
4. Use the data for better AI responses with team context 