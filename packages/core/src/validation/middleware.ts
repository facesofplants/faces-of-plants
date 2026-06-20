import { type APIGatewayProxyEvent, type APIGatewayProxyResult } from 'aws-lambda';
import { z, type ZodSchema } from 'zod';

import { ValidationError } from './errors';

/**
 * Validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    path: string[];
    message: string;
    code: string;
  }>;
}

/**
 * Validated request with parsed body
 */
export interface ValidatedRequest<T = any> extends APIGatewayProxyEvent {
  validatedBody: T;
}

/**
 * Lambda handler type
 */
export type LambdaHandler<T = any> = (event: ValidatedRequest<T>) => Promise<APIGatewayProxyResult>;

/**
 * Validate data against a Zod schema
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
  try {
    const parsed = schema.parse(data);
    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((err) => ({
          path: err.path.map(String),
          message: err.message,
          code: err.code,
        })),
      };
    }
    throw error;
  }
}

/**
 * Validate request body against schema
 */
export async function validateRequest<T>(
  event: APIGatewayProxyEvent,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    return validate(schema, body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        errors: [
          {
            path: ['body'],
            message: 'Invalid JSON in request body',
            code: 'invalid_json',
          },
        ],
      };
    }
    throw error;
  }
}

/**
 * Create validation middleware for Lambda handlers
 * Returns a wrapped handler that validates the request body before processing
 */
export function withValidation<T>(
  schema: ZodSchema<T>,
  handler: LambdaHandler<T>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const validationResult = await validateRequest(event, schema);

    if (!validationResult.success) {
      const validationError = new ValidationError(
        'Validation failed',
        validationResult.errors || []
      );

      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify(validationError.toJSON()),
      };
    }

    // Add validated data to event
    const validatedEvent: ValidatedRequest<T> = {
      ...event,
      validatedBody: validationResult.data!,
    };

    return handler(validatedEvent);
  };
}

/**
 * Validate query string parameters
 */
export function validateQueryParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | undefined>
): ValidationResult<T> {
  return validate(schema, params);
}

/**
 * Validate path parameters
 */
export function validatePathParams<T>(
  schema: ZodSchema<T>,
  params: Record<string, string | undefined>
): ValidationResult<T> {
  return validate(schema, params);
}

/**
 * Validated request with file upload
 */
export interface ValidatedFileRequest<T = any> extends APIGatewayProxyEvent {
  validatedFile: T;
}

/**
 * Lambda handler type for file uploads
 */
export type FileUploadHandler<T = any> = (
  event: ValidatedFileRequest<T>
) => Promise<APIGatewayProxyResult>;

/**
 * Create file upload validation middleware for Lambda handlers
 * Returns a wrapped handler that validates file uploads before processing
 */
export function withFileUploadValidation<T>(
  schema: ZodSchema<T>,
  handler: FileUploadHandler<T>
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      // Parse request body
      const body = event.body ? JSON.parse(event.body) : {};

      // Validate against schema
      const validationResult = validate(schema, body);

      if (!validationResult.success) {
        const validationError = new ValidationError(
          'File upload validation failed',
          validationResult.errors || []
        );

        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(validationError.toJSON()),
        };
      }

      // Add validated file data to event
      const validatedEvent: ValidatedFileRequest<T> = {
        ...event,
        validatedFile: validationResult.data!,
      };

      return handler(validatedEvent);
    } catch (error) {
      if (error instanceof SyntaxError) {
        const validationError = new ValidationError('Invalid JSON in request body', [
          { path: ['body'], message: 'Invalid JSON', code: 'invalid_json' },
        ]);

        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(validationError.toJSON()),
        };
      }
      throw error;
    }
  };
}
