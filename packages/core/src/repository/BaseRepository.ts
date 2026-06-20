import {
  type DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  QueryCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { DatabaseError, NotFoundError } from './types';

export interface BaseRepositoryConfig {
  tableName: string;
  client: DynamoDBClient;
  partitionKey: string;
  sortKey?: string;
}

/**
 * Base repository class providing common DynamoDB operations
 * Uses Query operations instead of Scan for better performance
 */
export abstract class BaseRepository<T extends Record<string, any>> {
  protected readonly tableName: string;
  protected readonly client: DynamoDBClient;
  protected readonly partitionKey: string;
  protected readonly sortKey?: string;

  constructor(config: BaseRepositoryConfig) {
    this.tableName = config.tableName;
    this.client = config.client;
    this.partitionKey = config.partitionKey;
    this.sortKey = config.sortKey;
  }

  /**
   * Find an item by its partition key (and sort key if applicable)
   */
  async findById(id: string, sortKeyValue?: string): Promise<T | null> {
    try {
      const key: Record<string, AttributeValue> = {
        [this.partitionKey]: { S: id },
      };

      if (this.sortKey && sortKeyValue) {
        key[this.sortKey] = { S: sortKeyValue };
      }

      const command = new GetItemCommand({
        TableName: this.tableName,
        Key: key,
      });

      const result = await this.client.send(command);

      if (!result.Item) {
        return null;
      }

      return unmarshall(result.Item) as T;
    } catch (error) {
      throw new DatabaseError(`Failed to find item with id ${id}`, error as Error);
    }
  }

  /**
   * Create a new item in the table
   */
  async create(item: T): Promise<T> {
    try {
      const timestamp = new Date().toISOString();
      const itemWithTimestamps = {
        ...item,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const command = new PutItemCommand({
        TableName: this.tableName,
        Item: marshall(itemWithTimestamps, { removeUndefinedValues: true }),
        ConditionExpression: `attribute_not_exists(${this.partitionKey})`,
      });

      await this.client.send(command);
      return itemWithTimestamps;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new DatabaseError(`Item with key ${item[this.partitionKey]} already exists`, error);
      }
      throw new DatabaseError('Failed to create item', error);
    }
  }

  /**
   * Update an existing item
   */
  async update(id: string, updates: Partial<T>, sortKeyValue?: string): Promise<T> {
    try {
      const key: Record<string, AttributeValue> = {
        [this.partitionKey]: { S: id },
      };

      if (this.sortKey && sortKeyValue) {
        key[this.sortKey] = { S: sortKeyValue };
      }

      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, AttributeValue> = {};

      // Add updatedAt timestamp
      const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      let index = 0;
      for (const [key, value] of Object.entries(updatesWithTimestamp)) {
        if (value !== undefined) {
          const nameKey = `#attr${index}`;
          const valueKey = `:val${index}`;
          updateExpressions.push(`${nameKey} = ${valueKey}`);
          expressionAttributeNames[nameKey] = key;
          expressionAttributeValues[valueKey] = marshall(value) as AttributeValue;
          index++;
        }
      }

      if (updateExpressions.length === 0) {
        throw new DatabaseError('No valid updates provided');
      }

      const command = new UpdateItemCommand({
        TableName: this.tableName,
        Key: key,
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: `attribute_exists(${this.partitionKey})`,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.client.send(command);

      if (!result.Attributes) {
        throw new NotFoundError('Item', id);
      }

      return unmarshall(result.Attributes) as T;
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new NotFoundError('Item', id);
      }
      throw new DatabaseError(`Failed to update item with id ${id}`, error);
    }
  }

  /**
   * Delete an item by its partition key
   */
  async delete(id: string, sortKeyValue?: string): Promise<void> {
    try {
      const key: Record<string, AttributeValue> = {
        [this.partitionKey]: { S: id },
      };

      if (this.sortKey && sortKeyValue) {
        key[this.sortKey] = { S: sortKeyValue };
      }

      const command = new DeleteItemCommand({
        TableName: this.tableName,
        Key: key,
        ConditionExpression: `attribute_exists(${this.partitionKey})`,
      });

      await this.client.send(command);
    } catch (error: any) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new NotFoundError('Item', id);
      }
      throw new DatabaseError(`Failed to delete item with id ${id}`, error);
    }
  }

  /**
   * Query items by partition key
   * Uses Query operation instead of Scan for better performance
   */
  protected async query(
    partitionKeyValue: string,
    options?: {
      limit?: number;
      sortKeyCondition?: string;
      sortKeyValue?: string;
      scanIndexForward?: boolean;
    }
  ): Promise<T[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: `${this.partitionKey} = :pk`,
        ExpressionAttributeValues: marshall({
          ':pk': partitionKeyValue,
        }),
        Limit: options?.limit,
        ScanIndexForward: options?.scanIndexForward ?? true,
      });

      const result = await this.client.send(command);

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      return result.Items.map((item) => unmarshall(item) as T);
    } catch (error) {
      throw new DatabaseError(
        `Failed to query items with partition key ${partitionKeyValue}`,
        error as Error
      );
    }
  }
}
