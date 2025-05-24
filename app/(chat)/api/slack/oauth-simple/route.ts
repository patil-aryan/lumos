import { NextRequest, NextResponse } from 'next/server';
import { SlackClient } from '@/lib/slack/client';

export async function GET(req: NextRequest) {
  try {
    console.log('=== Simple OAuth Callback Test ===');
    
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      console.log('Slack OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/integrations?error=${encodeURIComponent(error)}`, req.url)
      );
    }

    if (!code) {
      console.log('Missing authorization code');
      return NextResponse.redirect(
        new URL('/integrations?error=missing_code', req.url)
      );
    }

    console.log('Testing token exchange only...');
    const oauthData = await SlackClient.exchangeCodeForToken(code);
    
    console.log('Token exchange result:', {
      ok: oauthData.ok,
      hasToken: !!oauthData.access_token,
      teamName: oauthData.team?.name,
      error: oauthData.error
    });

    if (!oauthData.ok) {
      return NextResponse.redirect(
        new URL(`/integrations?error=token_exchange_failed&details=${encodeURIComponent(oauthData.error || 'unknown')}`, req.url)
      );
    }

    // Success - just show the token exchange worked
    return NextResponse.redirect(
      new URL(`/integrations?success=token_exchange_successful&team=${encodeURIComponent(oauthData.team?.name || 'unknown')}`, req.url)
    );
  } catch (error) {
    console.error('Simple OAuth test error:', error);
    return NextResponse.redirect(
      new URL(`/integrations?error=simple_test_failed&details=${encodeURIComponent(error instanceof Error ? error.message : 'unknown')}`, req.url)
    );
  }
} 