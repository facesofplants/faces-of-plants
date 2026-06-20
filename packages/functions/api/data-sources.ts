import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';

// SST V3 handler signature
export async function handler() {
  console.log('[DEBUG] Lambda ENV:', process.env);
  const tableName = process.env.DATA_SOURCES_TABLE;
  if (!tableName) {
    console.error('[DEBUG] DATA_SOURCES_TABLE env var is undefined');
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'DATA_SOURCES_TABLE env var is undefined',
        data: null,
      }),
    };
  }

  const client = new DynamoDBClient({});
  try {
    const result = await client.send(new ScanCommand({ TableName: tableName }));
    const items = result.Items ? result.Items.map((item) => unmarshall(item)) : [];
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: items }),
    };
  } catch (error) {
    console.error('DynamoDB scan error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null,
      }),
    };
  }
}
