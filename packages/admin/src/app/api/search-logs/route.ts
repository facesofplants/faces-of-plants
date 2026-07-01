import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { DynamoDBClient, DeleteItemCommand, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

export const dynamic = 'force-dynamic';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const TABLE = process.env.SEARCH_LOGS_TABLE || 'search-logs';

function getPublicWebBaseUrl(): string {
  const configured = process.env.PUBLIC_WEB_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  return (configured || 'https://facesofplants.org').replace(/\/$/, '');
}

function buildReplayUrls(query: string) {
  const baseUrl = getPublicWebBaseUrl();
  const qs = new URLSearchParams({ q: query });
  const apiQs = new URLSearchParams({ species: query, limit: '1' });

  return {
    exploreUrl: `${baseUrl}/explore?${qs.toString()}`,
    apiUrl: `${baseUrl}/api/map-search?${apiQs.toString()}`,
  };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return null;
  }
  return session;
}

export async function GET(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get('limit') || '500', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 50), 2000) : 500;
    const problematicOnly = searchParams.get('problematicOnly') === 'true';

    const result = await client.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': { S: 'LOG' } },
      ScanIndexForward: false, // newest first
      Limit: limit,
    }));

    let logs = (result.Items || []).map(item => {
      const record = unmarshall(item);
      return {
        timestamp: record.timestamp,
        query: record.query,
        gbifParams: record.gbifParams ? JSON.parse(record.gbifParams) : {},
        resolvedName: record.resolvedName,
        resolverSource: record.resolverSource,
        occurrences: record.occurrences,
        totalCount: record.totalCount,
        sessionId: record.sessionId || null,
        userEmail: record.userEmail || null,
        ip: record.ip,
        statusCode: typeof record.statusCode === 'number' ? record.statusCode : null,
        isFailure: record.isFailure === true,
        errorType: record.errorType || null,
        errorMessage: record.errorMessage || null,
      };
    });

    if (problematicOnly) {
      logs = logs.filter((log) => Number(log.occurrences) === 0 && Number(log.totalCount) === 0);
    }

    const issuesResult = await client.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': { S: 'ISSUE' } },
      ScanIndexForward: false,
      Limit: 5000,
    }));

    const resolvedIssues = (issuesResult.Items || []).map((item) => {
      const issue = unmarshall(item);
      return {
        normalizedQuery: issue.timestamp,
        query: issue.query,
        status: issue.status,
        resolvedAt: issue.resolvedAt,
        resolvedBy: issue.resolvedBy,
        reason: issue.reason || '',
      };
    });

    return NextResponse.json({ logs, resolvedIssues });
  } catch (error) {
    console.error('[ADMIN] Search logs fetch failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search logs', logs: [], resolvedIssues: [] },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const normalizedQuery = typeof body?.normalizedQuery === 'string' ? body.normalizedQuery.trim().toLowerCase() : '';
    const query = typeof body?.query === 'string' ? body.query.trim() : normalizedQuery;
    const action = body?.action === 'reopen' ? 'reopen' : body?.action === 'verify' ? 'verify' : 'resolve';
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 240) : '';

    if (!normalizedQuery) {
      return NextResponse.json({ error: 'normalizedQuery is required' }, { status: 400 });
    }

    if (action === 'verify') {
      const { exploreUrl, apiUrl } = buildReplayUrls(query);

      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Verification failed with status ${response.status}`, exploreUrl, apiUrl },
          { status: 502 },
        );
      }

      const payload = await response.json();
      const totalCount = Number(payload?.data?.count || 0);
      const validCoordinates = Number(payload?.data?.validCoordinates || 0);
      const resolvedName = typeof payload?.data?.resolver?.resolvedName === 'string' ? payload.data.resolver.resolvedName : '';
      const resolverSource = typeof payload?.data?.resolver?.source === 'string' ? payload.data.resolver.source : '';

      return NextResponse.json({
        ok: true,
        status: 'verified',
        normalizedQuery,
        query,
        exploreUrl,
        apiUrl,
        verification: {
          totalCount,
          validCoordinates,
          resolvedName,
          resolverSource,
          hasResults: totalCount > 0 || validCoordinates > 0,
        },
      });
    }

    if (action === 'resolve') {
      const now = new Date().toISOString();
      await client.send(new PutItemCommand({
        TableName: TABLE,
        Item: marshall({
          pk: 'ISSUE',
          timestamp: normalizedQuery,
          query,
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: (session.user as any)?.email || 'admin',
          reason,
        }),
      }));

      return NextResponse.json({ ok: true, status: 'resolved', normalizedQuery });
    }

    await client.send(new DeleteItemCommand({
      TableName: TABLE,
      Key: marshall({ pk: 'ISSUE', timestamp: normalizedQuery }),
    }));

    return NextResponse.json({ ok: true, status: 'reopened', normalizedQuery });
  } catch (error) {
    console.error('[ADMIN] Search issue update failed:', error);
    return NextResponse.json(
      { error: 'Failed to update issue status' },
      { status: 500 },
    );
  }
}
