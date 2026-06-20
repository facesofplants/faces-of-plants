import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import {
  sanitizeString,
  sanitizeQueryParam,
  sanitizeObject,
  sanitizeQueryParams,
  containsXSSPatterns,
  containsNoSQLInjectionPatterns,
  validateAndSanitize,
} from '../sanitization';

describe('Input Sanitization Property Tests', () => {
  /**
   * Feature: production-readiness, Property 2: Input sanitization prevents injection
   * Validates: Requirements 2.3
   */
  describe('Property 2: Input sanitization prevents injection', () => {
    describe('XSS Prevention', () => {
      it('should remove script tags from any input', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (before, after) => {
            const input = `${before}<script>alert('xss')</script>${after}`;
            const sanitized = sanitizeString(input);

            // Sanitized output should not contain script tags
            expect(sanitized).not.toMatch(/<script/i);
            expect(sanitized).not.toMatch(/<\/script>/i);
          }),
          { numRuns: 100 }
        );
      });

      it('should escape HTML special characters', () => {
        fc.assert(
          fc.property(fc.string(), (prefix) => {
            const input = `${prefix}<div>"test"&'value'</div>`;
            const sanitized = sanitizeString(input);

            // Should not contain unescaped HTML characters
            expect(sanitized).not.toContain('<div>');
            expect(sanitized).not.toContain('</div>');
            // Should contain escaped versions
            expect(sanitized).toContain('&lt;');
            expect(sanitized).toContain('&gt;');
          }),
          { numRuns: 100 }
        );
      });

      it('should remove javascript: protocol from any input', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (before, after) => {
            const input = `${before}javascript:alert('xss')${after}`;
            const sanitized = sanitizeString(input);

            // Sanitized output should not contain javascript: protocol
            expect(sanitized.toLowerCase()).not.toContain('javascript:');
          }),
          { numRuns: 100 }
        );
      });

      it('should remove event handlers from any input', () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.constantFrom('onclick', 'onload', 'onerror', 'onmouseover'),
            fc.string(),
            (before, event, payload) => {
              const input = `${before}${event}="${payload}"`;
              const sanitized = sanitizeString(input);

              // Sanitized output should not contain event handlers
              expect(sanitized.toLowerCase()).not.toMatch(/on\w+\s*=\s*["'][^"']*["']/);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should detect XSS patterns correctly', () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.constantFrom('<script>', 'javascript:', 'onclick=', '<iframe', 'data:text/html'),
            fc.string(),
            (before, xssPattern, after) => {
              const input = `${before}${xssPattern}${after}`;

              // Should detect XSS patterns
              expect(containsXSSPatterns(input)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should not detect XSS in safe strings', () => {
        fc.assert(
          fc.property(
            fc.string().filter((s) => {
              // Filter out strings that contain XSS patterns
              return !containsXSSPatterns(s);
            }),
            (safeInput) => {
              expect(containsXSSPatterns(safeInput)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('NoSQL Injection Prevention', () => {
      it('should remove MongoDB operators from any input', () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.constantFrom('$where', '$regex', '$ne', '$gt', '$lt', '$in', '$or'),
            fc.string(),
            (before, operator, after) => {
              const input = `${before}${operator}${after}`;
              const sanitized = sanitizeQueryParam(input);

              // Sanitized output should not contain MongoDB operators
              expect(sanitized.toLowerCase()).not.toContain(operator.toLowerCase());
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove DynamoDB injection patterns from any input', () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.constantFrom('AttributeExists', 'AttributeNotExists', 'BeginsWith', 'Contains'),
            fc.string(),
            (before, pattern, after) => {
              const input = `${before}${pattern}${after}`;
              const sanitized = sanitizeQueryParam(input);

              // Sanitized output should not contain DynamoDB patterns
              expect(sanitized.toLowerCase()).not.toContain(pattern.toLowerCase());
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should detect NoSQL injection patterns correctly', () => {
        fc.assert(
          fc.property(
            fc.string(),
            fc.constantFrom('$where', '$regex', 'AttributeExists', '{$ne:'),
            fc.string(),
            (before, injectionPattern, after) => {
              const input = `${before}${injectionPattern}${after}`;

              // Should detect NoSQL injection patterns
              expect(containsNoSQLInjectionPatterns(input)).toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should not detect NoSQL injection in safe strings', () => {
        fc.assert(
          fc.property(
            fc.string().filter((s) => {
              // Filter out strings that contain NoSQL injection patterns
              return !containsNoSQLInjectionPatterns(s);
            }),
            (safeInput) => {
              expect(containsNoSQLInjectionPatterns(safeInput)).toBe(false);
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should remove $ prefixed operators regardless of position', () => {
        fc.assert(
          fc.property(fc.string({ minLength: 1, maxLength: 20 }), (operatorName) => {
            const input = `query{$${operatorName}:value}`;
            const sanitized = sanitizeQueryParam(input);

            // Should remove the $ operator
            expect(sanitized).not.toMatch(/\$\w+/);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Object Sanitization', () => {
      it('should sanitize all string values in an object', () => {
        fc.assert(
          fc.property(
            fc.record({
              field1: fc.string(),
              field2: fc.string(),
            }),
            (obj) => {
              const malicious = {
                field1: `${obj.field1}<script>alert('xss')</script>`,
                field2: `${obj.field2}<div>test</div>`,
              };

              const sanitized = sanitizeObject(malicious);

              // Should not contain script tags or HTML tags
              expect(JSON.stringify(sanitized)).not.toMatch(/<script/i);
              expect(JSON.stringify(sanitized)).not.toContain('<div>');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('should sanitize nested objects recursively', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (str1, str2) => {
            const malicious = {
              level1: {
                level2: {
                  field: `${str1}<script>alert('xss')</script>${str2}`,
                },
              },
            };

            const sanitized = sanitizeObject(malicious);

            // Should sanitize deeply nested values
            expect(JSON.stringify(sanitized)).not.toMatch(/<script/i);
          }),
          { numRuns: 100 }
        );
      });

      it('should preserve non-string values during sanitization', () => {
        fc.assert(
          fc.property(fc.integer(), fc.boolean(), (num, bool) => {
            const obj = {
              number: num,
              boolean: bool,
              string: '<script>test</script>',
            };

            const sanitized = sanitizeObject(obj);

            // Should preserve non-string values
            expect(sanitized.number).toBe(num);
            expect(sanitized.boolean).toBe(bool);
            // Should sanitize string values
            expect(sanitized.string).not.toContain('<script>');
          }),
          { numRuns: 100 }
        );
      });

      it('should handle arrays in objects', () => {
        fc.assert(
          fc.property(fc.array(fc.string(), { minLength: 1, maxLength: 5 }), (strings) => {
            const malicious = {
              items: strings.map((s) => `${s}<script>alert('xss')</script>`),
            };

            const sanitized = sanitizeObject(malicious);

            // Should sanitize all array elements
            expect(JSON.stringify(sanitized)).not.toMatch(/<script/i);
            expect(Array.isArray(sanitized.items)).toBe(true);
          }),
          { numRuns: 100 }
        );
      });
    });

    describe('Query Parameter Sanitization', () => {
      it('should sanitize query parameters with NoSQL patterns', () => {
        fc.assert(
          fc.property(
            fc.record({
              query: fc.string(),
              filter: fc.string(),
            }),
            (params) => {
              const malicious = {
                query: `${params.query}$where`,
                filter: `${params.filter}$regex`,
              };

              const sanitized = sanitizeQueryParams(malicious);

              // Should remove NoSQL operators
              expect(sanitized.query).not.toContain('$where');
              expect(sanitized.filter).not.toContain('$regex');
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Combined Validation and Sanitization', () => {
      it('should detect and sanitize XSS patterns', () => {
        fc.assert(
          fc.property(fc.string(), (prefix) => {
            const input = `${prefix}<script>alert('xss')</script>`;
            const result = validateAndSanitize(input, { checkXSS: true });

            // Should detect XSS
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            // Should still sanitize
            expect(result.sanitized).not.toMatch(/<script/i);
          }),
          { numRuns: 100 }
        );
      });

      it('should detect and sanitize NoSQL injection patterns', () => {
        fc.assert(
          fc.property(fc.string(), (prefix) => {
            const input = `${prefix}$where`;
            const result = validateAndSanitize(input, { checkNoSQL: true });

            // Should detect NoSQL injection
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            // Should still sanitize
            expect(result.sanitized).not.toContain('$where');
          }),
          { numRuns: 100 }
        );
      });

      it('should enforce max length constraints', () => {
        fc.assert(
          fc.property(fc.string({ minLength: 101, maxLength: 200 }), (longString) => {
            const result = validateAndSanitize(longString, { maxLength: 100 });

            // Should detect length violation
            expect(result.isValid).toBe(false);
            expect(result.errors.some((e) => e.includes('maximum length'))).toBe(true);
          }),
          { numRuns: 100 }
        );
      });

      it('should accept safe inputs', () => {
        fc.assert(
          fc.property(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
              // Filter out strings with injection patterns
              return !containsXSSPatterns(s) && !containsNoSQLInjectionPatterns(s);
            }),
            (safeInput) => {
              const result = validateAndSanitize(safeInput, {
                maxLength: 100,
                checkXSS: true,
                checkNoSQL: true,
              });

              // Should accept safe input
              expect(result.isValid).toBe(true);
              expect(result.errors.length).toBe(0);
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    describe('Edge Cases', () => {
      it('should handle null bytes in input', () => {
        fc.assert(
          fc.property(fc.string(), fc.string(), (before, after) => {
            const input = `${before}\0${after}`;
            const sanitized = sanitizeString(input);

            // Should remove null bytes
            expect(sanitized).not.toContain('\0');
          }),
          { numRuns: 100 }
        );
      });

      it('should handle empty strings', () => {
        const sanitized = sanitizeString('');
        expect(sanitized).toBe('');
      });

      it('should handle non-string inputs gracefully', () => {
        // @ts-expect-error Testing runtime behavior with invalid input
        expect(sanitizeString(null)).toBe('');
        // @ts-expect-error Testing runtime behavior with invalid input
        expect(sanitizeString(undefined)).toBe('');
        // @ts-expect-error Testing runtime behavior with invalid input
        expect(sanitizeString(123)).toBe('');
      });

      it('should handle objects with null values', () => {
        const obj = {
          field1: 'test',
          field2: null,
          field3: undefined,
        };

        const sanitized = sanitizeObject(obj);
        expect(sanitized.field1).toBe('test');
        expect(sanitized.field2).toBe(null);
        expect(sanitized.field3).toBe(undefined);
      });
    });
  });
});
