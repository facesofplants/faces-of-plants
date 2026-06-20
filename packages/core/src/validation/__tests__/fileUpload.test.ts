import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  validateFileType,
  validateFileSize,
  validateFilename,
  validateFileUpload,
  validateFileUploadWithSchema,
} from '../fileUpload';
import { validate } from '../middleware';
import { fileUploadSchema, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../schemas';

describe('File Upload Validation Property Tests', () => {
  /**
   * Feature: production-readiness, Property 3: File upload validation enforces constraints
   * Validates: Requirements 2.4
   */
  describe('Property 3: File upload validation enforces constraints', () => {
    it('should reject files with disallowed content types', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc
              .string({ minLength: 1, maxLength: 255 })
              .filter((s) => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
            contentType: fc.constantFrom(
              'application/x-executable',
              'application/x-msdownload',
              'application/x-sh',
              'text/x-script',
              'application/octet-stream',
              'video/mp4',
              'audio/mpeg',
              'application/zip'
            ), // Invalid: not in whitelist
            size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors!.some((e) => e.includes('not allowed'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files exceeding maximum size', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc
              .string({ minLength: 1, maxLength: 255 })
              .filter((s) => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 2 }), // Invalid: too large
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors!.some((e) => e.includes('exceeds maximum'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files with zero or negative size', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc
              .string({ minLength: 1, maxLength: 255 })
              .filter((s) => !s.includes('..') && !s.includes('/') && !s.includes('\\')),
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: -1000, max: 0 }), // Invalid: zero or negative
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors!.some((e) => e.includes('greater than 0'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files with empty filename', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc.constant(''), // Invalid: empty
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors!.some((e) => e.includes('required'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files with excessively long filename', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc.string({ minLength: 256, maxLength: 500 }), // Invalid: too long
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors!.some((e) => e.includes('too long'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files with path traversal attempts in filename', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc.constantFrom(
              '../etc/passwd',
              '../../secret.txt',
              'folder/../file.txt',
              'C:\\Windows\\System32\\file.exe',
              '/etc/shadow'
            ), // Invalid: path traversal
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(result.errors!.some((e) => e.includes('invalid characters'))).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept valid file uploads', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc
              .string({ minLength: 1, maxLength: 255 })
              .filter(
                (s) =>
                  !s.includes('..') && !s.includes('/') && !s.includes('\\') && s.trim().length > 0
              ),
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          }),
          (validFile) => {
            const result = validateFileUpload(validFile);
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject files violating multiple constraints simultaneously', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc.constant(''), // Invalid: empty
            contentType: fc.constant('application/x-executable'), // Invalid: not allowed
            size: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 2 }), // Invalid: too large
          }),
          (invalidFile) => {
            const result = validateFileUpload(invalidFile);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            // Should have multiple errors (one for each violation)
            expect(result.errors!.length).toBeGreaterThanOrEqual(2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('File type validation', () => {
    it('should accept all whitelisted file types', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALLOWED_FILE_TYPES), (contentType) => {
          const result = validateFileType(contentType);
          expect(result.valid).toBe(true);
          expect(result.errors).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject non-whitelisted file types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'application/x-executable',
            'text/x-script',
            'application/octet-stream',
            'video/mp4',
            'audio/mpeg'
          ),
          (contentType) => {
            const result = validateFileType(contentType);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('File size validation', () => {
    it('should accept valid file sizes', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: MAX_FILE_SIZE }), (size) => {
          const result = validateFileSize(size);
          expect(result.valid).toBe(true);
          expect(result.errors).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject sizes exceeding maximum', () => {
      fc.assert(
        fc.property(fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 }), (size) => {
          const result = validateFileSize(size);
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should reject zero and negative sizes', () => {
      fc.assert(
        fc.property(fc.integer({ min: -10000, max: 0 }), (size) => {
          const result = validateFileSize(size);
          expect(result.valid).toBe(false);
          expect(result.errors).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Filename validation', () => {
    it('should accept valid filenames', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 255 })
            .filter(
              (s) =>
                !s.includes('..') && !s.includes('/') && !s.includes('\\') && s.trim().length > 0
            ),
          (filename) => {
            const result = validateFilename(filename);
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject filenames with path traversal', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('../file.txt', '../../secret', 'a/../b', 'C:\\file'),
          (filename) => {
            const result = validateFilename(filename);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Schema-based validation', () => {
    it('should validate using Zod schema for valid files', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc
              .string({ minLength: 1, maxLength: 255 })
              .filter(
                (s) =>
                  !s.includes('..') && !s.includes('/') && !s.includes('\\') && s.trim().length > 0
              ),
            contentType: fc.constantFrom(...ALLOWED_FILE_TYPES),
            size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
          }),
          (validFile) => {
            const result = validate(fileUploadSchema, validFile);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid files using Zod schema', () => {
      fc.assert(
        fc.property(
          fc.record({
            filename: fc.constant(''),
            contentType: fc.constant('invalid/type'),
            size: fc.integer({ min: -100, max: 0 }),
          }),
          (invalidFile) => {
            const result = validate(fileUploadSchema, invalidFile);
            expect(result.success).toBe(false);
            expect(result.errors).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
