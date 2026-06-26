import { createHash } from 'crypto';

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 10) {
      return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const result = await client.send(new ScanCommand({
      TableName: process.env.AUTH_JS_TABLE || 'auth-js',
      FilterExpression: 'begins_with(PK, :prefix) AND adminInviteTokenHash = :tokenHash',
      ExpressionAttributeValues: {
        ':prefix': { S: 'USER#' },
        ':tokenHash': { S: tokenHash },
      },
      Limit: 1,
    }));

    const user = result.Items?.[0];
    if (!user) {
      return NextResponse.json({ error: 'Invite not found or already used' }, { status: 400 });
    }

    const expiresAt = user.adminInviteExpiresAt?.S;
    if (!expiresAt || new Date(expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
    }

    const pk = user.PK?.S;
    const sk = user.SK?.S;
    if (!pk || !sk) {
      return NextResponse.json({ error: 'Invalid user record' }, { status: 500 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await client.send(new UpdateItemCommand({
      TableName: process.env.AUTH_JS_TABLE || 'auth-js',
      Key: {
        PK: { S: pk },
        SK: { S: sk },
      },
      UpdateExpression: [
        'SET password = :password,',
        'userType = :adminType,',
        'adminInviteUsedAt = :usedAt',
        'REMOVE adminInviteTokenHash, adminInviteExpiresAt',
      ].join(' '),
      ExpressionAttributeValues: {
        ':password': { S: hashedPassword },
        ':adminType': { S: 'admin' },
        ':usedAt': { S: new Date().toISOString() },
      },
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to accept invite' },
      { status: 500 },
    );
  }
}
