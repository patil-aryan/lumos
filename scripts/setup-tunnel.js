#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function updateEnvFile(tunnelUrl) {
  const envPath = path.join(__dirname, '..', '.env.local');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update NEXTAUTH_URL
  envContent = envContent.replace(
    /NEXTAUTH_URL=.*/,
    `NEXTAUTH_URL=${tunnelUrl}`
  );
  
  // Update SLACK_REDIRECT_URI
  envContent = envContent.replace(
    /SLACK_REDIRECT_URI=.*/,
    `SLACK_REDIRECT_URI=${tunnelUrl}/api/slack/oauth`
  );
  
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Updated .env.local with tunnel URL: ${tunnelUrl}`);
}

// Get tunnel URL from command line argument
const tunnelUrl = process.argv[2];

if (!tunnelUrl) {
  console.error('❌ Please provide a tunnel URL');
  console.log('Usage: node scripts/setup-tunnel.js https://your-tunnel-url.ngrok.io');
  process.exit(1);
}

updateEnvFile(tunnelUrl); 