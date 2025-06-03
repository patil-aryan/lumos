const axios = require('axios');

// Debug script to test Confluence OAuth scopes
async function testConfluenceScopes() {
  console.log('🔧 Confluence OAuth Scopes Debug Tool');
  console.log('=====================================\n');

  // Configuration check
  const CLIENT_ID = process.env.CONFLUENCE_CLIENT_ID;
  const CLIENT_SECRET = process.env.CONFLUENCE_CLIENT_SECRET;
  const REDIRECT_URI = process.env.CONFLUENCE_REDIRECT_URI;

  console.log('📋 Environment Configuration:');
  console.log(`   Client ID: ${CLIENT_ID ? 'Set ✓' : 'Missing ✗'}`);
  console.log(`   Client Secret: ${CLIENT_SECRET ? 'Set ✓' : 'Missing ✗'}`);
  console.log(`   Redirect URI: ${REDIRECT_URI || 'Missing ✗'}`);
  console.log('');

  // Current scopes being requested (from your updated code)
  const requestedScopes = [
    // Classic scopes
    'read:confluence-content.all',
    'read:confluence-user',
    'read:confluence-space.summary',
    
    // Granular scopes
    'read:page:confluence',
    'read:content:confluence',
    'read:content-details:confluence',
    'read:space-details:confluence',
    'read:blogpost:confluence',
    'read:comment:confluence',
    'read:watcher:confluence',
    'read:group:confluence',
    'read:user:confluence',
    'read:analytics.content:confluence',
    'read:content.metadata:confluence',
    
    // Refresh token
    'offline_access'
  ];

  console.log('🎯 Scopes Requesting in OAuth Flow:');
  console.log(`   Total Scopes: ${requestedScopes.length}`);
  console.log('   Classic Scopes:');
  requestedScopes.filter(s => s.includes('confluence-')).forEach(scope => {
    console.log(`     - ${scope}`);
  });
  console.log('   Granular Scopes:');
  requestedScopes.filter(s => s.includes(':confluence') && !s.includes('confluence-')).forEach(scope => {
    console.log(`     - ${scope}`);
  });
  console.log('');

  // Generate OAuth URL for manual testing
  if (CLIENT_ID && REDIRECT_URI) {
    const authUrl = new URL('https://auth.atlassian.com/authorize');
    authUrl.searchParams.set('audience', 'api.atlassian.com');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('scope', requestedScopes.join(' '));
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', `test-${Date.now()}`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('prompt', 'consent');

    console.log('🔗 OAuth Authorization URL (for manual testing):');
    console.log(authUrl.toString());
    console.log('');
  }

  console.log('📝 Next Steps:');
  console.log('   1. ⚠️  IMPORTANT: Configure scopes in Atlassian Developer Console');
  console.log('   2. Go to: https://developer.atlassian.com/console/myapps');
  console.log('   3. Select your Confluence app');
  console.log('   4. Go to "Permissions" → Add each required API scope');
  console.log('   5. Ensure you add ALL scopes listed above to your app');
  console.log('   6. Save changes in the developer console');
  console.log('   7. Try the OAuth flow again');
  console.log('');

  console.log('🔍 API Scope Configuration Requirements:');
  console.log('   - Classic scopes must be added to "Confluence Cloud API"');
  console.log('   - Granular scopes must be added to "Confluence Cloud API"');
  console.log('   - Without proper console configuration, scopes will be rejected');
  console.log('');

  // Test API call if we have a token (you can manually add one here for testing)
  const TEST_ACCESS_TOKEN = 'your-access-token-here'; // Replace with real token for testing
  const TEST_CLOUD_ID = 'your-cloud-id-here'; // Replace with real cloud ID for testing

  if (TEST_ACCESS_TOKEN !== 'your-access-token-here' && TEST_CLOUD_ID !== 'your-cloud-id-here') {
    console.log('🧪 Testing API access with provided token...');
    
    try {
      // Test v2 API
      const response = await axios.get(
        `https://api.atlassian.com/ex/confluence/${TEST_CLOUD_ID}/wiki/api/v2/spaces`,
        {
          headers: {
            'Authorization': `Bearer ${TEST_ACCESS_TOKEN}`,
            'Accept': 'application/json',
          },
          params: { limit: 1 }
        }
      );
      console.log('✅ API Test Successful:', response.data);
    } catch (error) {
      console.log('❌ API Test Failed:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        scopes: error.response?.data?.scopes
      });
    }
  }
}

// Run the test
testConfluenceScopes().catch(console.error); 