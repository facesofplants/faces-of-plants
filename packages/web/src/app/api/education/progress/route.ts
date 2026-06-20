import { NextResponse } from 'next/server';

const progressStore = new Map<string, Record<string, unknown>>();

export async function GET() {
  return NextResponse.json({ message: 'Use POST to save progress' });
}

export async function POST(request: Request) {
  const userId = request.headers.get('x-user-id') || 'anonymous';
  const body = await request.json();
  const existing = progressStore.get(userId) || {};
  progressStore.set(userId, { ...existing, ...body });
  return NextResponse.json({ success: true });
}