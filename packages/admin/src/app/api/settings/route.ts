import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getAllSettings, upsertSetting, deleteSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { settingKey, settingValue, category, description, masked } = body;

  if (!settingKey || settingValue === undefined) {
    return NextResponse.json({ error: 'settingKey and settingValue required' }, { status: 400 });
  }

  await upsertSetting({
    settingKey,
    settingValue,
    category: category || 'system',
    description,
    masked,
    updatedBy: (session.user as any)?.id,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any)?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key required' }, { status: 400 });
  }

  await deleteSetting(key);
  return NextResponse.json({ success: true });
}
