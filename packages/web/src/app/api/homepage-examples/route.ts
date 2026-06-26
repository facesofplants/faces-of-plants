import { NextResponse } from 'next/server';

import { getSystemSettings } from '../../../lib/system-settings';

const DEFAULT_EXAMPLES = [
  'Quercus in Tuscany',
  'Cherry blossoms in Japan',
  'Orchids in Colombia',
  'Betula pendula',
];

export async function GET() {
  try {
    const settings = await getSystemSettings(['content:homepage_examples']);
    const raw = settings['content:homepage_examples'];

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return NextResponse.json({ examples: parsed });
        }
      } catch {
        // Invalid JSON, fall through to defaults
      }
    }

    return NextResponse.json({ examples: DEFAULT_EXAMPLES });
  } catch {
    return NextResponse.json({ examples: DEFAULT_EXAMPLES });
  }
}
