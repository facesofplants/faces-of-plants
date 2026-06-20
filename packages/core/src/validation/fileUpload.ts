import { ValidationError } from './errors';
import { validate } from './middleware';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, fileUploadSchema, type FileUpload } from './schemas';

/**
 * File upload validation result
 */
export interface FileValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate file type against whitelist
 */
export function validateFileType(contentType: string): FileValidationResult {
  const isValid = ALLOWED_FILE_TYPES.includes(contentType as any);

  if (!isValid) {
    return {
      valid: false,
      errors: [
        `File type '${contentType}' is not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
      ],
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(size: number): FileValidationResult {
  if (size <= 0) {
    return {
      valid: false,
      errors: ['File size must be greater than 0'],
    };
  }

  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      errors: [
        `File size ${size} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      ],
    };
  }

  return { valid: true };
}

/**
 * Validate filename
 */
export function validateFilename(filename: string): FileValidationResult {
  if (!filename || filename.trim().length === 0) {
    return {
      valid: false,
      errors: ['Filename is required'],
    };
  }

  if (filename.length > 255) {
    return {
      valid: false,
      errors: ['Filename is too long (max 255 characters)'],
    };
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return {
      valid: false,
      errors: ['Filename contains invalid characters'],
    };
  }

  return { valid: true };
}

/**
 * Validate complete file upload
 */
export function validateFileUpload(file: {
  filename: string;
  contentType: string;
  size: number;
  content?: string;
}): FileValidationResult {
  const errors: string[] = [];

  // Validate filename
  const filenameResult = validateFilename(file.filename);
  if (!filenameResult.valid) {
    errors.push(...(filenameResult.errors || []));
  }

  // Validate file type
  const typeResult = validateFileType(file.contentType);
  if (!typeResult.valid) {
    errors.push(...(typeResult.errors || []));
  }

  // Validate file size
  const sizeResult = validateFileSize(file.size);
  if (!sizeResult.valid) {
    errors.push(...(sizeResult.errors || []));
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return { valid: true };
}

/**
 * Validate file upload using Zod schema
 */
export function validateFileUploadWithSchema(file: unknown): {
  success: boolean;
  data?: FileUpload;
  errors?: Array<{ path: string[]; message: string; code: string }>;
} {
  return validate(fileUploadSchema, file);
}

/**
 * Parse multipart form data file upload
 * This is a simplified parser for demonstration
 */
export function parseFileFromMultipart(body: string, contentType: string): FileUpload | null {
  // In a real implementation, you would use a proper multipart parser
  // This is a simplified version for the validation layer
  try {
    // For now, assume JSON body with file metadata
    const parsed = JSON.parse(body);
    return parsed as FileUpload;
  } catch {
    return null;
  }
}

/**
 * Create file upload validation error
 */
export function createFileUploadError(errors: string[]): ValidationError {
  return new ValidationError(
    'File upload validation failed',
    errors.map((error, index) => ({
      path: ['file'],
      message: error,
      code: 'file_validation_error',
    }))
  );
}
