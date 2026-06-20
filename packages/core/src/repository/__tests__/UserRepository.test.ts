import {
  QueryCommand,
  PutItemCommand,
  UpdateItemCommand,
  type DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { describe, it, expect, beforeEach } from 'vitest';

import { DatabaseError } from '../types';
import { UserRepository } from '../UserRepository';

import { createMockDynamoDBClient, sampleUser } from './test-utils';

describe('UserRepository', () => {
  let mockClient: ReturnType<typeof createMockDynamoDBClient>;
  let repository: UserRepository;

  beforeEach(() => {
    mockClient = createMockDynamoDBClient();
    repository = new UserRepository('users-table', mockClient as unknown as DynamoDBClient);
  });

  describe('findByEmail', () => {
    it('should find user by email using EmailIndex GSI', async () => {
      mockClient.on(QueryCommand).resolves({
        Items: [marshall(sampleUser)],
      });

      const result = await repository.findByEmail('test@example.com');

      expect(result).toEqual(sampleUser);
      expect(mockClient.calls()).toHaveLength(1);
      const call = mockClient.call(0);
      expect(call.args[0].input).toMatchObject({
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
      });
    });

    it('should return null when user not found', async () => {
      mockClient.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });

    it('should throw DatabaseError on query failure', async () => {
      mockClient.on(QueryCommand).rejects(new Error('DynamoDB error'));

      await expect(repository.findByEmail('test@example.com')).rejects.toThrow(DatabaseError);
    });
  });

  describe('createUser', () => {
    it('should create user with generated ID and timestamps', async () => {
      mockClient.on(PutItemCommand).resolves({});

      const dto = {
        email: 'new@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        tier: 'premium' as const,
      };

      const result = await repository.createUser(dto);

      expect(result.id).toMatch(/^user_/);
      expect(result.email).toBe(dto.email);
      expect(result.firstName).toBe(dto.firstName);
      expect(result.lastName).toBe(dto.lastName);
      expect(result.tier).toBe(dto.tier);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should default tier to authenticated', async () => {
      mockClient.on(PutItemCommand).resolves({});

      const dto = {
        email: 'new@example.com',
      };

      const result = await repository.createUser(dto);

      expect(result.tier).toBe('authenticated');
    });
  });

  describe('updateUser', () => {
    it('should update user profile', async () => {
      const updates = {
        firstName: 'Updated',
        tier: 'premium' as const,
      };

      mockClient.on(UpdateItemCommand).resolves({
        Attributes: marshall({
          ...sampleUser,
          ...updates,
          updatedAt: new Date().toISOString(),
        }),
      });

      const result = await repository.updateUser('user_123', updates);

      expect(result.firstName).toBe('Updated');
      expect(result.tier).toBe('premium');
    });
  });

  describe('findByLastName', () => {
    it('should find users by last name using NameIndex GSI', async () => {
      const users = [sampleUser, { ...sampleUser, id: 'user_456' }];
      mockClient.on(QueryCommand).resolves({
        Items: users.map((u) => marshall(u)),
      });

      const result = await repository.findByLastName('Doe');

      expect(result).toHaveLength(2);
      expect(mockClient.calls()).toHaveLength(1);
      const call = mockClient.call(0);
      expect(call.args[0].input).toMatchObject({
        IndexName: 'NameIndex',
        KeyConditionExpression: 'lastName = :lastName',
      });
    });

    it('should return empty array when no users found', async () => {
      mockClient.on(QueryCommand).resolves({
        Items: [],
      });

      const result = await repository.findByLastName('NonExistent');

      expect(result).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      mockClient.on(QueryCommand).resolves({
        Items: [marshall(sampleUser)],
      });

      await repository.findByLastName('Doe', 10);

      const call = mockClient.call(0);
      expect(call.args[0].input.Limit).toBe(10);
    });
  });
});
