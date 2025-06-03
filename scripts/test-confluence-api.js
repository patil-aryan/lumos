const axios = require('axios');
require('dotenv').config();

async function testConfluenceAPI() {
  // This script helps debug Confluence API connection issues
  
  const CONFLUENCE_CLIENT_ID = process.env.CONFLUENCE_CLIENT_ID;
  const CONFLUENCE_CLIENT_SECRET = process.env.CONFLUENCE_CLIENT_SECRET;
  const CONFLUENCE_REDIRECT_URI = process.env.CONFLUENCE_REDIRECT_URI;

  console.log('Confluence API Debug Test');
  console.log('=========================');
  console.log('Client ID:', CONFLUENCE_CLIENT_ID ? 'Set' : 'Missing');
  console.log('Client Secret:', CONFLUENCE_CLIENT_SECRET ? 'Set' : 'Missing');
  console.log('Redirect URI:', CONFLUENCE_REDIRECT_URI);
  console.log('');

  // You'll need to get this from the OAuth flow
  console.log('To test with a real token:');
  console.log('1. Complete the OAuth flow in the browser');
  console.log('2. Copy the access token from the database or logs');
  console.log('3. Set the ACCESS_TOKEN and CLOUD_ID in this script');
  console.log('');

  // Example token testing (replace with real values)
  const ACCESS_TOKEN = 'your-access-token-here';
  const CLOUD_ID = 'your-cloud-id-here';

  if (ACCESS_TOKEN === 'your-access-token-here') {
    console.log('Please update the ACCESS_TOKEN and CLOUD_ID in this script to test API calls');
    return;
  }

  try {
    // Test 1: Get accessible resources
    console.log('Test 1: Getting accessible resources...');
    const resourcesResponse = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json',
      },
    });
    console.log('✓ Accessible resources:', resourcesResponse.data.length);
    
    // Test 2: Try v2 API spaces endpoint
    console.log('\nTest 2: Testing v2 API spaces endpoint...');
    try {
      const v2Response = await axios.get(`https://api.atlassian.com/ex/confluence/${CLOUD_ID}/wiki/api/v2/spaces`, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Accept': 'application/json',
        },
        params: { limit: 1 }
      });
      console.log('✓ v2 API spaces successful:', v2Response.data);
    } catch (v2Error) {
      console.log('✗ v2 API spaces failed:', v2Error.response?.status, v2Error.response?.data);
    }

    // Test 3: Try v1 API spaces endpoint
    console.log('\nTest 3: Testing v1 API spaces endpoint...');
    try {
      const v1Response = await axios.get(`https://api.atlassian.com/ex/confluence/${CLOUD_ID}/wiki/rest/api/space`, {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Accept': 'application/json',
        },
        params: { limit: 1 }
      });
      console.log('✓ v1 API spaces successful:', v1Response.data);
    } catch (v1Error) {
      console.log('✗ v1 API spaces failed:', v1Error.response?.status, v1Error.response?.data);
    }

  } catch (error) {
    console.error('Error testing Confluence API:', error.response?.data || error.message);
  }
}

testConfluenceAPI(); 