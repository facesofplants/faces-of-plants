// Repository layer types for DynamoDB access patterns

export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  create(item: T): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface QueryOptions {
  limit?: number;
  nextToken?: string;
  sortAscending?: boolean;
}

export interface QueryResult<T> {
  items: T[];
  nextToken?: string;
  count: number;
}

// User entity for authentication
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
  tier?: 'anonymous' | 'authenticated' | 'premium';
}

export interface CreateUserDto {
  email: string;
  firstName?: string;
  lastName?: string;
  tier?: 'anonymous' | 'authenticated' | 'premium';
}

// Cache entity
export interface CacheEntry {
  cacheKey: string;
  data: string;
  provider: string;
  createdAt: number;
  ttl: number;
}

// Rate limit entity
export interface RateLimitEntry {
  limitKey: string;
  tokens: number;
  lastRefill: number;
  ttl: number;
}

// Repository errors
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} already exists`, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends RepositoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'DATABASE_ERROR', cause);
    this.name = 'DatabaseError';
  }
}
