/**
 * Unit tests for MetricsService
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

import { MetricsService, type MetricData } from '../MetricsService';

describe('MetricsService', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('creates metrics service with default configuration', () => {
      const metrics = new MetricsService();
      expect(metrics).toBeDefined();
    });

    test('creates metrics service with custom namespace', () => {
      const metrics = new MetricsService({
        namespace: 'CustomNamespace',
      });
      expect(metrics).toBeDefined();
    });

    test('can be disabled via configuration', () => {
      const metrics = new MetricsService({
        enabled: false,
      });

      metrics.recordRequest('/test', 'GET', 200, 100);

      // Should not log anything when disabled
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('respects environment configuration', () => {
      const metrics = new MetricsService({
        environment: 'test',
      });
      expect(metrics).toBeDefined();
    });
  });

  describe('recordRequest', () => {
    test('records request count metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordRequest('/api/query', 'POST', 200, 150);

      expect(consoleLogSpy).toHaveBeenCalled();

      // Find the RequestCount metric
      const calls = consoleLogSpy.mock.calls;
      const requestCountCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'RequestCount';
      });

      expect(requestCountCall).toBeDefined();
      const requestCountMetric = JSON.parse(requestCountCall[0]);
      expect(requestCountMetric.value).toBe(1);
      expect(requestCountMetric.unit).toBe('Count');
      expect(requestCountMetric.dimensions.Path).toBe('/api/query');
      expect(requestCountMetric.dimensions.Method).toBe('POST');
      expect(requestCountMetric.dimensions.StatusCode).toBe('200');
    });

    test('records request duration metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordRequest('/api/query', 'POST', 200, 150);

      const calls = consoleLogSpy.mock.calls;
      const durationCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'RequestDuration';
      });

      expect(durationCall).toBeDefined();
      const durationMetric = JSON.parse(durationCall[0]);
      expect(durationMetric.value).toBe(150);
      expect(durationMetric.unit).toBe('Milliseconds');
      expect(durationMetric.dimensions.Path).toBe('/api/query');
      expect(durationMetric.dimensions.Method).toBe('POST');
    });

    test('records error count for 4xx status codes', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordRequest('/api/query', 'POST', 400, 50);

      const calls = consoleLogSpy.mock.calls;
      const errorCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ErrorCount';
      });

      expect(errorCall).toBeDefined();
      const errorMetric = JSON.parse(errorCall[0]);
      expect(errorMetric.value).toBe(1);
      expect(errorMetric.dimensions.StatusCode).toBe('400');
    });

    test('records error count for 5xx status codes', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordRequest('/api/query', 'POST', 500, 50);

      const calls = consoleLogSpy.mock.calls;
      const errorCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ErrorCount';
      });

      expect(errorCall).toBeDefined();
    });

    test('does not record error count for 2xx status codes', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      consoleLogSpy.mockClear();
      metrics.recordRequest('/api/query', 'POST', 200, 50);

      const calls = consoleLogSpy.mock.calls;
      const errorCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ErrorCount';
      });

      expect(errorCall).toBeUndefined();
    });

    test('does not record error count for 3xx status codes', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      consoleLogSpy.mockClear();
      metrics.recordRequest('/api/redirect', 'GET', 301, 10);

      const calls = consoleLogSpy.mock.calls;
      const errorCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ErrorCount';
      });

      expect(errorCall).toBeUndefined();
    });
  });

  describe('recordCacheHit', () => {
    test('records cache hit metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordCacheHit('gbif');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logOutput.metric).toBe('CacheHit');
      expect(logOutput.value).toBe(1);
      expect(logOutput.unit).toBe('Count');
      expect(logOutput.dimensions.Provider).toBe('gbif');
    });

    test('includes environment in dimensions', () => {
      const metrics = new MetricsService({
        environment: 'test',
      });

      metrics.recordCacheHit('inaturalist');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.dimensions.Environment).toBe('test');
    });
  });

  describe('recordCacheMiss', () => {
    test('records cache miss metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordCacheMiss('eol');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logOutput.metric).toBe('CacheMiss');
      expect(logOutput.value).toBe(1);
      expect(logOutput.unit).toBe('Count');
      expect(logOutput.dimensions.Provider).toBe('eol');
    });
  });

  describe('recordProviderCall', () => {
    test('records successful provider call', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordProviderCall('gbif', 250, true);

      expect(consoleLogSpy).toHaveBeenCalled();

      const calls = consoleLogSpy.mock.calls;

      // Check for call count metric
      const countCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ProviderCallCount';
      });
      expect(countCall).toBeDefined();
      const countMetric = JSON.parse(countCall[0]);
      expect(countMetric.value).toBe(1);
      expect(countMetric.dimensions.Provider).toBe('gbif');
      expect(countMetric.dimensions.Success).toBe('true');

      // Check for duration metric
      const durationCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ProviderCallDuration';
      });
      expect(durationCall).toBeDefined();
      const durationMetric = JSON.parse(durationCall[0]);
      expect(durationMetric.value).toBe(250);
      expect(durationMetric.unit).toBe('Milliseconds');
    });

    test('records failed provider call with error count', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordProviderCall('inaturalist', 500, false);

      const calls = consoleLogSpy.mock.calls;

      // Check for error count metric
      const errorCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ProviderErrorCount';
      });
      expect(errorCall).toBeDefined();
      const errorMetric = JSON.parse(errorCall[0]);
      expect(errorMetric.value).toBe(1);
      expect(errorMetric.dimensions.Provider).toBe('inaturalist');
    });

    test('does not record error count for successful calls', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      consoleLogSpy.mockClear();
      metrics.recordProviderCall('gbif', 100, true);

      const calls = consoleLogSpy.mock.calls;
      const errorCall = calls.find((call: any[]) => {
        const log = JSON.parse(call[0]);
        return log.metric === 'ProviderErrorCount';
      });

      expect(errorCall).toBeUndefined();
    });
  });

  describe('recordError', () => {
    test('records error occurrence metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordError('VALIDATION_ERROR', '/api/query');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logOutput.metric).toBe('ErrorOccurrence');
      expect(logOutput.value).toBe(1);
      expect(logOutput.unit).toBe('Count');
      expect(logOutput.dimensions.ErrorCode).toBe('VALIDATION_ERROR');
      expect(logOutput.dimensions.Path).toBe('/api/query');
    });
  });

  describe('putMetric', () => {
    test('puts custom metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      const customMetric: MetricData = {
        name: 'CustomMetric',
        value: 42,
        unit: 'Count',
        dimensions: {
          CustomDimension: 'CustomValue',
        },
      };

      metrics.putMetric(customMetric);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logOutput.metric).toBe('CustomMetric');
      expect(logOutput.value).toBe(42);
      expect(logOutput.unit).toBe('Count');
      expect(logOutput.dimensions.CustomDimension).toBe('CustomValue');
    });

    test('includes timestamp in metric', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      const customMetric: MetricData = {
        name: 'TimestampedMetric',
        value: 1,
        unit: 'Count',
      };

      metrics.putMetric(customMetric);

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.timestamp).toBeDefined();
      expect(new Date(logOutput.timestamp)).toBeInstanceOf(Date);
    });

    test('respects custom timestamp', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      const customTimestamp = new Date('2024-01-01T00:00:00Z');
      const customMetric: MetricData = {
        name: 'CustomTimestampMetric',
        value: 1,
        unit: 'Count',
        timestamp: customTimestamp,
      };

      metrics.putMetric(customMetric);

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(new Date(logOutput.timestamp).toISOString()).toBe(customTimestamp.toISOString());
    });
  });

  describe('Metric Units', () => {
    test('supports different metric units', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      const units: Array<MetricData['unit']> = [
        'Seconds',
        'Microseconds',
        'Milliseconds',
        'Count',
        'Percent',
        'None',
      ];

      units.forEach((unit, index) => {
        consoleLogSpy.mockClear();
        metrics.putMetric({
          name: `Metric${index}`,
          value: index,
          unit,
        });

        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.unit).toBe(unit);
      });
    });
  });

  describe('Environment Handling', () => {
    test('logs metrics in development environment', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordCacheHit('gbif');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('logs metrics in test environment', () => {
      const metrics = new MetricsService({
        environment: 'test',
      });

      metrics.recordCacheHit('gbif');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('includes namespace in logged metrics', () => {
      const metrics = new MetricsService({
        namespace: 'TestNamespace',
        environment: 'development',
      });

      metrics.recordCacheHit('gbif');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.namespace).toBe('TestNamespace');
    });
  });

  describe('flush', () => {
    test('flush method completes successfully', async () => {
      const metrics = new MetricsService();
      await expect(metrics.flush()).resolves.toBeUndefined();
    });
  });

  describe('Disabled Metrics', () => {
    test('does not emit metrics when disabled', () => {
      const metrics = new MetricsService({
        enabled: false,
      });

      metrics.recordRequest('/test', 'GET', 200, 100);
      metrics.recordCacheHit('gbif');
      metrics.recordCacheMiss('eol');
      metrics.recordProviderCall('inaturalist', 200, true);
      metrics.recordError('TEST_ERROR', '/test');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metric Log Format', () => {
    test('logs metrics with correct structure', () => {
      const metrics = new MetricsService({
        environment: 'development',
      });

      metrics.recordCacheHit('gbif');

      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logOutput).toHaveProperty('type', 'metric');
      expect(logOutput).toHaveProperty('namespace');
      expect(logOutput).toHaveProperty('metric');
      expect(logOutput).toHaveProperty('value');
      expect(logOutput).toHaveProperty('unit');
      expect(logOutput).toHaveProperty('timestamp');
    });
  });
});
