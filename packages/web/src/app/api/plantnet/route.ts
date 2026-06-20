import { NextRequest, NextResponse } from 'next/server';

const PLANTNET_API = 'https://my-api.plantnet.org/v2';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const apiKey = formData.get('api-key') as string;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    // Forward to Pl@ntNet API
    const plantnetFormData = new FormData();
    const images = formData.get('images') as File;
    const organs = formData.get('organs') as string;

    if (images) plantnetFormData.append('images', images);
    if (organs) plantnetFormData.append('organs', organs);
    plantnetFormData.append('api-key', apiKey);

    const response = await fetch(`${PLANTNET_API}/identification`, {
      method: 'POST',
      body: plantnetFormData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return NextResponse.json(
        { error: errorData?.message || `Pl@ntNet API error: ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Identification failed' },
      { status: 500 },
    );
  }
}
