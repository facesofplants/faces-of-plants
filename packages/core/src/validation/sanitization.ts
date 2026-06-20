/**
 * Input sanitization utilities for preventing injection attacks
 * Implements XSS prevention and NoSQL injection prevention
 */

/**
 * Sanitize string input to prevent XSS attacks
 * Escapes HTML special characters and removes potentially dangerous patterns
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Escape HTML special characters
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  // Remove script tags and event handlers (case-insensitive)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  return sanitized;
}

/**
 * Sanitize query parameters to prevent NoSQL injection
 * Removes MongoDB operators and other potentially dangerous patterns
 */
export function sanitizeQueryParam(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove MongoDB operators (starting with $)
  sanitized = sanitized.replace(/\$\w+/g, '');

  // Remove potential regex injection patterns
  sanitized = sanitized.replace(/\$regex/gi, '');
  sanitized = sanitized.replace(/\$where/gi, '');
  sanitized = sanitized.replace(/\$ne/gi, '');
  sanitized = sanitized.replace(/\$gt/gi, '');
  sanitized = sanitized.replace(/\$gte/gi, '');
  sanitized = sanitized.replace(/\$lt/gi, '');
  sanitized = sanitized.replace(/\$lte/gi, '');
  sanitized = sanitized.replace(/\$in/gi, '');
  sanitized = sanitized.replace(/\$nin/gi, '');
  sanitized = sanitized.replace(/\$or/gi, '');
  sanitized = sanitized.replace(/\$and/gi, '');
  sanitized = sanitized.replace(/\$not/gi, '');
  sanitized = sanitized.replace(/\$nor/gi, '');
  sanitized = sanitized.replace(/\$exists/gi, '');
  sanitized = sanitized.replace(/\$type/gi, '');
  sanitized = sanitized.replace(/\$expr/gi, '');
  sanitized = sanitized.replace(/\$jsonSchema/gi, '');
  sanitized = sanitized.replace(/\$mod/gi, '');
  sanitized = sanitized.replace(/\$text/gi, '');
  sanitized = sanitized.replace(/\$elemMatch/gi, '');
  sanitized = sanitized.replace(/\$size/gi, '');

  // Remove potential DynamoDB injection patterns
  sanitized = sanitized.replace(/AttributeExists/gi, '');
  sanitized = sanitized.replace(/AttributeNotExists/gi, '');
  sanitized = sanitized.replace(/AttributeType/gi, '');
  sanitized = sanitized.replace(/BeginsWith/gi, '');
  sanitized = sanitized.replace(/Contains/gi, '');

  return sanitized;
}

/**
 * Sanitize object recursively to prevent injection attacks
 * Applies sanitization to all string values in the object
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  sanitizer: (input: string) => string = sanitizeString
): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        sanitized[key] = sanitizer(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value, sanitizer);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized as T;
}

/**
 * Sanitize query parameters object
 * Applies query parameter sanitization to all string values
 */
export function sanitizeQueryParams<T extends Record<string, any>>(params: T): T {
  return sanitizeObject(params, sanitizeQueryParam);
}

/**
 * Check if a string contains potential XSS patterns
 * Returns true if dangerous patterns are detected
 */
export function containsXSSPatterns(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /data:text\/html/i,
    /vbscript:/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Check if a string contains potential NoSQL injection patterns
 * Returns true if dangerous patterns are detected
 */
export function containsNoSQLInjectionPatterns(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  const injectionPatterns = [
    /\$\w+/,
    /\{\s*\$\w+/,
    /AttributeExists/i,
    /AttributeNotExists/i,
    /BeginsWith/i,
  ];

  return injectionPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate and sanitize user input
 * Combines validation checks with sanitization
 */
export function validateAndSanitize(
  input: string,
  options: {
    maxLength?: number;
    allowHTML?: boolean;
    checkXSS?: boolean;
    checkNoSQL?: boolean;
  } = {}
): { sanitized: string; isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  let sanitized = input;

  // Check max length
  if (options.maxLength && input.length > options.maxLength) {
    errors.push(`Input exceeds maximum length of ${options.maxLength}`);
  }

  // Check for XSS patterns
  if (options.checkXSS !== false && containsXSSPatterns(input)) {
    errors.push('Input contains potentially dangerous XSS patterns');
  }

  // Check for NoSQL injection patterns
  if (options.checkNoSQL !== false && containsNoSQLInjectionPatterns(input)) {
    errors.push('Input contains potentially dangerous NoSQL injection patterns');
  }

  // Apply sanitization
  if (!options.allowHTML) {
    sanitized = sanitizeString(input);
  }

  if (options.checkNoSQL !== false) {
    sanitized = sanitizeQueryParam(sanitized);
  }

  return {
    sanitized,
    isValid: errors.length === 0,
    errors,
  };
}
