import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { PMOrchestrator } from '@/lib/ai/pm-orchestrator';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, workspaceId, context } = await req.json();
    
    if (!query || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: query and workspaceId' },
        { status: 400 }
      );
    }

    console.log(`🎯 PM Insights Query: "${query}" for workspace: ${workspaceId}`);

    // Initialize the PM orchestrator with high accuracy settings
    const pmOrchestrator = new PMOrchestrator({
      confidenceThreshold: 0.85, // Only surface high-confidence insights
      maxResults: 10,
      enableRealTimeAnalysis: true,
      primaryModel: 'gpt-4' // Use the best model for accuracy
    });

    // Process the query with full PM intelligence
    const response = await pmOrchestrator.processQuery(
      query,
      workspaceId,
      context
    );

    // Add metadata for frontend
    const enrichedResponse = {
      ...response,
      metadata: {
        query_processed_at: new Date().toISOString(),
        processing_method: response.confidence > 0.8 && response.insights.length > 0 ? 'rag_engine' : 'hybrid',
        total_insights: response.insights.length,
        high_confidence_insights: response.insights.filter(i => i.confidence > 0.9).length,
        critical_insights: response.insights.filter(i => i.severity === 'critical').length,
        source_channels: [...new Set(response.sources.flatMap(s => s.contextInfo?.channelName || []))],
        confidence_bucket: response.confidence > 0.9 ? 'high' : response.confidence > 0.7 ? 'medium' : 'low'
      }
    };

    console.log(`✅ PM Insights Response: confidence=${response.confidence}, insights=${response.insights.length}`);

    return NextResponse.json(enrichedResponse);

  } catch (error) {
    console.error('PM Insights API Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to process PM insights',
        answer: 'I encountered an error while analyzing your request. Please try again with a more specific question.',
        insights: [],
        confidence: 0.0,
        sources: [],
        actionable_recommendations: [
          'Try rephrasing your question',
          'Check if the workspace has recent Slack data',
          'Contact support if the issue persists'
        ],
        confidence_explanation: 'Error occurred during processing'
      },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
} 