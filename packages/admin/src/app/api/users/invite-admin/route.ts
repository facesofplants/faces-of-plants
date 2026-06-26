import { randomBytes, createHash } from 'crypto';

import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth-options';

export const dynamic = 'force-dynamic';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const ses = new SESv2Client({ region: process.env.AWS_REGION || 'eu-central-1' });

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, email, name } = await request.json();
  if (!userId || !email) {
    return NextResponse.json({ error: 'userId and email required' }, { status: 400 });
  }

  const fromEmail = process.env.ADMIN_INVITE_FROM_EMAIL?.trim();
  if (!fromEmail) {
    return NextResponse.json({ error: 'ADMIN_INVITE_FROM_EMAIL is not configured' }, { status: 500 });
  }

  const token = randomBytes(24).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  await client.send(new UpdateItemCommand({
    TableName: process.env.AUTH_JS_TABLE || 'auth-js',
    Key: {
      PK: { S: `USER#${userId}` },
      SK: { S: `USER#${userId}` },
    },
    UpdateExpression: [
      'SET userType = :adminType,',
      'adminInviteTokenHash = :tokenHash,',
      'adminInviteExpiresAt = :expiresAt,',
      'adminInviteCreatedAt = :createdAt',
      'REMOVE adminInviteUsedAt',
    ].join(' '),
    ExpressionAttributeValues: {
      ':adminType': { S: 'admin' },
      ':tokenHash': { S: tokenHash },
      ':expiresAt': { S: expiresAt },
      ':createdAt': { S: now.toISOString() },
    },
  }));

  const origin = request.headers.get('origin') || process.env.NEXTAUTH_URL || '';
  const inviteUrl = `${origin.replace(/\/$/, '')}/invite-admin?token=${encodeURIComponent(token)}`;

  const recipientName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : email;
  const expiresLabel = new Date(expiresAt).toLocaleString();

  await ses.send(new SendEmailCommand({
    FromEmailAddress: fromEmail,
    Destination: {
      ToAddresses: [email],
    },
    Content: {
      Simple: {
        Subject: {
          Data: 'Faces of Plants Admin Invite',
        },
        Body: {
          Text: {
            Data: [
              `Hello ${recipientName},`,
              '',
              'You have been invited to become an administrator for Faces of Plants.',
              `This invite expires on ${expiresLabel}.`,
              '',
              'Set your admin password using this link:',
              inviteUrl,
              '',
              'If you were not expecting this email, please ignore it.',
            ].join('\n'),
          },
          Html: {
            Data: `
              <p>Hello ${recipientName},</p>
              <p>You have been invited to become an administrator for <strong>Faces of Plants</strong>.</p>
              <p>This invite expires on <strong>${expiresLabel}</strong>.</p>
              <p>
                <a href="${inviteUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;">
                  Set Admin Password
                </a>
              </p>
              <p>If the button does not work, use this link:<br /><a href="${inviteUrl}">${inviteUrl}</a></p>
              <p>If you were not expecting this email, you can ignore this message.</p>
            `,
          },
        },
      },
    },
  }));

  return NextResponse.json({ success: true, inviteUrl, expiresAt, emailSent: true });
}
