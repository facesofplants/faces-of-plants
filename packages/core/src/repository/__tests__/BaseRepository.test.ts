import {
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { describe, it, expect, beforeEach } from 'vitest';

import { BaseRepository } from '../BaseRepository';
import { DatabaseError, NotFoundError } from '../types';

import { createMockDynamoDBClient } from './test-utils';

// Concrete implementation for testing
class TestRepository extends BaseRepository<{ id: string; name: string }> {
  constructor(client: DynamoDBClient) {
    super({
      tableName: 'test-table',
      client,
      partitionKey: 'id',
    });
  }
}

describe('BaseRepository', () => {
  let mockClient: ReturnType<typeof createMockDynamoDBClient>;
  let repository: TestRepository;

  beforeEach(() => {
    mockClient = createMockDynamoDBClient();
    repository = new TestRepository(mockClient as unknown as DynamoDBClient);
  });

  describe('findById', () => {
    it('should return item when found', async () => {
      const item = { id: 'test-id', name: 'Test Item' };
      mockClient.on(GetItemCommand).resolves({
        Item: marshall(item),
      });

      const result = await repository.findById('test-id');

      expect(result).toEqual(item);
    });

    it('should return null when item not found', async () => {
      mockClient.on(GetItemCommand).resolves({});

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on DynamoDB failure', async () => {
      mockClient.on(GetItemCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.findById('test-id')).rejects.toThrow(DatabaseError);
    });
  });

  describe('create', () => {
    it('should create item with timestamps', async () => {
      const item = { id: 'test-id', name: 'Test Item' };
      mockClient.on(PutItemCommand).resolves({});

      const result = await repository.create(item);

      expect(result).toMatchObject(item);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw DatabaseError when item already exists', async () => {
      const item = { id: 'test-id', name: 'Test Item' };
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockClient.on(PutItemCommand).rejects(error);

      await expect(repository.create(item)).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on other failures', async () => {
      const item = { id: 'test-id', name: 'Test Item' };
      mockClient.on(PutItemCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.create(item)).rejects.toThrow(DatabaseError);
    });
  });

  describe('update', () => {
    it('should update item and return updated values', async () => {
      const updates = { name: 'Updated Name' };
      const updatedItem = {
        id: 'test-id',
        name: 'Updated Name',
        updatedAt: new Date().toISOString(),
      };

      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall(updatedItem),
      });

      const result = await repository.update('test-id', updates);

      expect(result.name).toBe('Updated Name');
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw NotFoundError when item does not exist', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockClient.on(UpdateItemCommand).rejects(error);

      await expect(repository.update('non-existent', { name: 'New Name' })).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw DatabaseError when no updates provided', async () => {
      await expect(repository.update('test-id', {})).rejects.toThrow(DatabaseError);
    });

    it('should throw DatabaseError on other failures', async () => {
      mockClient.on(UpdateItemCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.update('test-id', { name: 'New Name' })).rejects.toThrow(
        DatabaseError
      );
    });
  });

  describe('delete', () => {
    it('should delete item successfully', async () => {
      mockClient.on(DeleteItemCommand).resolves({});

      await expect(repository.delete('test-id')).resolves.toBeUndefined();
    });

    it('should throw NotFoundError when item does not exist', async () => {
      const error = new Error('ConditionalCheckFailedException');
      error.name = 'ConditionalCheckFailedException';
      mockClient.on(DeleteItemCommand).rejects(error);

      await expect(repository.delete('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw DatabaseError on other failures', async () => {
      mockClient.on(DeleteItemCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.delete('test-id')).rejects.toThrow(DatabaseError);
    });
  });
});
