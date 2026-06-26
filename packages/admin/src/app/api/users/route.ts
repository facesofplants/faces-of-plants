import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { DynamoDBClient, ScanCommand, UpdateItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

export const dynamic = 'force-dynamic';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [usersResult, accountsResult] = await Promise.all([
    client.send(new ScanCommand({
      TableName: process.env.AUTH_JS_TABLE || 'auth-js',
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': { S: 'USER#' } },
    })),
    client.send(new ScanCommand({
      TableName: process.env.AUTH_JS_TABLE || 'auth-js',
      FilterExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: { ':prefix': { S: 'ACCOUNT#' } },
    })),
  ]);

  const authMethods = new Map<string, Set<string>>();
  for (const item of accountsResult.Items || []) {
    const userId = item.userId?.S;
    const provider = item.provider?.S;
    if (userId && provider) {
      if (!authMethods.has(userId)) authMethods.set(userId, new Set());
      authMethods.get(userId)!.add(provider);
    }
  }

  const byEmail = new Map<string, any>();
  for (const item of usersResult.Items || []) {
    const email = item.email?.S;
    if (!email) continue;

    const userId = item.userId?.S || item.PK?.S?.replace('USER#', '') || '';
    const methods = authMethods.get(userId) || new Set();
    const userType = item.userType?.S || 'citizen';

    const existing = byEmail.get(email);
    if (existing) {
      for (const m of methods) existing.authMethods.add(m);
      if (userType === 'admin') existing.userType = 'admin';
      if (item.firstName?.S && !existing.name) {
        existing.name = `${item.firstName?.S || ''} ${item.lastName?.S || ''}`.trim();
      }
    } else {
      byEmail.set(email, {
        id: userId,
        email,
        name: `${item.firstName?.S || ''} ${item.lastName?.S || ''}`.trim() || null,
        userType,
        authMethods: methods,
        createdAt: item.createdAt?.S,
        pk: item.PK?.S,
      });
    }
  }

  return NextResponse.json({ users: Array.from(byEmail.values()) });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, userType } = await request.json();
  if (!userId || !userType) {
    return NextResponse.json({ error: 'userId and userType required' }, { status: 400 });
  }

  await client.send(new UpdateItemCommand({
    TableName: process.env.AUTH_JS_TABLE || 'auth-js',
    Key: { PK: { S: `USER#${userId}` }, SK: { S: `USER#${userId}` } },
    UpdateExpression: 'SET userType = :type',
    ExpressionAttributeValues: { ':type': { S: userType } },
  }));

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pk = searchParams.get('pk');
  if (!pk) {
    return NextResponse.json({ error: 'pk required' }, { status: 400 });
  }

  await client.send(new DeleteItemCommand({
    TableName: process.env.AUTH_JS_TABLE || 'auth-js',
    Key: { PK: { S: pk }, SK: { S: pk } },
  }));

  return NextResponse.json({ success: true });
}
