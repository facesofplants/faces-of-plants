import { type DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { BaseRepository } from './BaseRepository';
import { type User, type CreateUserDto, NotFoundError, DatabaseError } from './types';

/**
 * Repository for user authentication and profile operations
 * Uses Query operations for efficient data access
 */
export class UserRepository extends BaseRepository<User> {
  constructor(tableName: string, client: DynamoDBClient) {
    super({
      tableName,
      client,
      partitionKey: 'id',
    });
  }

  /**
   * Find a user by email address using EmailIndex GSI
   * Uses Query operation on GSI instead of Scan
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: marshall({
          ':email': email,
        }),
        Limit: 1,
      });

      const result = await this.client.send(command);

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return unmarshall(result.Items[0]) as User;
    } catch (error) {
      throw new DatabaseError(`Failed to find user by email ${email}`, error as Error);
    }
  }

  /**
   * Create a new user with generated ID
   */
  async createUser(dto: CreateUserDto): Promise<User> {
    const user: User = {
      id: this.generateUserId(),
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      tier: dto.tier || 'authenticated',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.create(user);
  }

  /**
   * Update user profile information
   */
  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User> {
    return this.update(id, updates);
  }

  /**
   * Find users by last name using NameIndex GSI
   * Uses Query operation on GSI
   */
  async findByLastName(lastName: string, limit?: number): Promise<User[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'NameIndex',
        KeyConditionExpression: 'lastName = :lastName',
        ExpressionAttributeValues: marshall({
          ':lastName': lastName,
        }),
        Limit: limit,
      });

      const result = await this.client.send(command);

      if (!result.Items || result.Items.length === 0) {
        return [];
      }

      return result.Items.map((item) => unmarshall(item) as User);
    } catch (error) {
      throw new DatabaseError(`Failed to find users by last name ${lastName}`, error as Error);
    }
  }

  /**
   * Generate a unique user ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
