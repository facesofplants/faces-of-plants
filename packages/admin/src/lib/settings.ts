import { DynamoDBClient, GetItemCommand, ScanCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import type { SystemSetting } from '@/types';

function marshallString(value: string) {
  return { S: value };
}

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

const TABLES = {
  SYSTEM_SETTINGS: process.env.SYSTEM_SETTINGS_TABLE || 'system-settings',
};

export async function getSetting(key: string): Promise<SystemSetting | null> {
  const result = await client.send(new GetItemCommand({
    TableName: TABLES.SYSTEM_SETTINGS,
    Key: { settingKey: marshallString(key) },
  }));
  if (!result.Item) return null;
  return {
    settingKey: result.Item.settingKey?.S || key,
    settingValue: result.Item.settingValue?.S || '',
    category: (result.Item.category?.S as any) || 'system',
    description: result.Item.description?.S,
    masked: result.Item.masked?.BOOL,
    updatedBy: result.Item.updatedBy?.S,
    updatedAt: result.Item.updatedAt?.S,
  };
}

export async function getAllSettings(): Promise<SystemSetting[]> {
  const result = await client.send(new ScanCommand({
    TableName: TABLES.SYSTEM_SETTINGS,
  }));
  return (result.Items || []).map((item: any) => ({
    settingKey: item.settingKey?.S || '',
    settingValue: item.settingValue?.S || '',
    category: (item.category?.S as any) || 'system',
    description: item.description?.S,
    masked: item.masked?.BOOL,
    updatedBy: item.updatedBy?.S,
    updatedAt: item.updatedAt?.S,
  }));
}

export async function upsertSetting(setting: SystemSetting): Promise<void> {
  await client.send(new PutItemCommand({
    TableName: TABLES.SYSTEM_SETTINGS,
    Item: {
      settingKey: marshallString(setting.settingKey),
      settingValue: marshallString(setting.settingValue),
      category: marshallString(setting.category),
      ...(setting.description ? { description: marshallString(setting.description) } : {}),
      ...(setting.masked !== undefined ? { masked: { BOOL: setting.masked } } : {}),
      ...(setting.updatedBy ? { updatedBy: marshallString(setting.updatedBy) } : {}),
      updatedAt: marshallString(new Date().toISOString()),
    },
  }));
}

export async function deleteSetting(key: string): Promise<void> {
  await client.send(new DeleteItemCommand({
    TableName: TABLES.SYSTEM_SETTINGS,
    Key: { settingKey: marshallString(key) },
  }));
}

export async function getApiKey(key: string): Promise<string | null> {
  const setting = await getSetting(key);
  return setting?.settingValue || null;
}
