import { NextResponse } from 'next/server';

import { getSystemSettings } from '../../../lib/system-settings';

export const dynamic = 'force-dynamic';

const DEFAULT_FLAGS: Record<string, boolean> = {
  'feature:pathology': false,
  'feature:corridors': false,
  'feature:sdm': false,
  'feature:plantnet': false,
  'feature:nearby': false,
};

export async function GET() {
  const keys = Object.keys(DEFAULT_FLAGS);
  const settings = await getSystemSettings(keys, { bypassCache: true });

  const flags = Object.fromEntries(
    keys.map((key) => [key, settings[key]?.trim().toLowerCase() === 'true']),
  );

  return NextResponse.json({
    success: true,
    flags,
  });
}
