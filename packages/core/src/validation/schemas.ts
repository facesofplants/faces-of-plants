import { z } from 'zod';

/**
 * Schema for query request parameters
 * Validates search queries with filters and pagination
 */
export const queryRequestSchema = z.object({
  query: z.string().min(1, 'Query must not be empty').max(500, 'Query too long'),
  userType: z.enum(['citizen', 'researcher']).optional().default('citizen'),
  filters: z
    .object({
      country: z.string().optional(),
      basisOfRecord: z.string().optional(),
      scientificName: z.string().optional(),
      hasCoordinate: z.boolean().optional(),
      hasGeospatialIssue: z.boolean().optional(),
      year: z.string().optional(),
      kingdom: z.string().optional(),
      phylum: z.string().optional(),
      class: z.string().optional(),
      order: z.string().optional(),
      family: z.string().optional(),
      genus: z.string().optional(),
      species: z.string().optional(),
      mediaType: z.string().optional(),
      hasImage: z.boolean().optional(),
    })
    .optional()
    .default({}),
  pagination: z
    .object({
      limit: z.number().int().min(1).max(300).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    })
    .optional()
    .default({ limit: 20, offset: 0 }),
});

export type QueryRequest = z.infer<typeof queryRequestSchema>;

/**
 * Schema for pagination parameters
 */
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(300).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
  cursor: z.string().optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

/**
 * Schema for authentication tokens (JWT)
 */
export const authTokenSchema = z.object({
  token: z.string().min(1, 'Token must not be empty'),
  type: z.enum(['Bearer', 'JWT']).optional().default('Bearer'),
});

export type AuthToken = z.infer<typeof authTokenSchema>;

/**
 * Schema for user registration
 */
export const userRegistrationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  userType: z.enum(['citizen', 'researcher']).optional().default('citizen'),
});

export type UserRegistration = z.infer<typeof userRegistrationSchema>;

/**
 * Schema for user login
 */
export const userLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type UserLogin = z.infer<typeof userLoginSchema>;

/**
 * Schema for creating a collection
 */
export const createCollectionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  name: z.string().min(1, 'Collection name is required').max(200, 'Name too long'),
  description: z.string().max(1000, 'Description too long').optional().default(''),
  queries: z
    .array(
      z.object({
        id: z.string(),
        query: z.string(),
        userType: z.enum(['citizen', 'researcher']),
        timestamp: z.string(),
      })
    )
    .optional()
    .default([]),
  species: z.array(z.string()).optional().default([]),
});

export type CreateCollection = z.infer<typeof createCollectionSchema>;

/**
 * Schema for updating a collection
 */
export const updateCollectionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  collectionId: z.string().min(1, 'Collection ID is required'),
  name: z.string().min(1, 'Collection name is required').max(200, 'Name too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  queries: z
    .array(
      z.object({
        id: z.string(),
        query: z.string(),
        userType: z.enum(['citizen', 'researcher']),
        timestamp: z.string(),
      })
    )
    .optional(),
  species: z.array(z.string()).optional(),
});

export type UpdateCollection = z.infer<typeof updateCollectionSchema>;

/**
 * Schema for getting collections
 */
export const getCollectionsSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export type GetCollections = z.infer<typeof getCollectionsSchema>;

/**
 * Schema for Cognito authentication request
 */
export const cognitoAuthSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export type CognitoAuth = z.infer<typeof cognitoAuthSchema>;

/**
 * Allowed file types for uploads (whitelist approach)
 */
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/json',
] as const;

export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * File upload metadata schema
 */
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
  contentType: z.enum(ALLOWED_FILE_TYPES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: `File type must be one of: ${ALLOWED_FILE_TYPES.join(', ')}` }),
  }),
  size: z
    .number()
    .int('File size must be an integer')
    .min(1, 'File size must be greater than 0')
    .max(MAX_FILE_SIZE, `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB`),
  content: z.string().optional(), // Base64 encoded content
});

export type FileUpload = z.infer<typeof fileUploadSchema>;
