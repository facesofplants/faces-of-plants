import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

const PLANTNET_API = 'https://my-api.plantnet.org/v2';

async function getPlantNetKey(): Promise<string | null> {
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

  const result = await client.send(new GetItemCommand({
    TableName: process.env.SYSTEM_SETTINGS_TABLE || 'system-settings',
    Key: { settingKey: { S: 'api:plantnet' } },
  }));
  return result.Item?.settingValue?.S || null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = await getPlantNetKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'PlantNet API key not configured. Contact admin.' },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const plantnetFormData = new FormData();
    const images = formData.get('images') as File;
    const organs = formData.get('organs') as string;

    if (images) plantnetFormData.append('images', images);
    if (organs) plantnetFormData.append('organs', organs);
    plantnetFormData.append('api-key', apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response: Response;
    try {
      response = await fetch(`${PLANTNET_API}/identification`, {
        method: 'POST',
        body: plantnetFormData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

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
    const message = error instanceof Error ? error.message : 'Identification failed';
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return NextResponse.json(
      { error: isTimeout ? 'PlantNet API timed out. Please try again.' : message },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
