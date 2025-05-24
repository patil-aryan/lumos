import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    
    return NextResponse.json({
      message: 'Test route working',
      hasClientId: !!clientId,
      hasRedirectUri: !!redirectUri,
      clientIdPrefix: clientId?.substring(0, 10) || 'missing',
      redirectUri: redirectUri || 'missing',
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ message: 'Slack test route is working' });
} 