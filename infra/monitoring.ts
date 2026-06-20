/// <reference path="../.sst/platform/config.d.ts" />

import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { createResourceName, getResourceTags } from "./utils";

interface MonitoringConfig {
  api: {
    api: {
      id: pulumi.Output<string>;
      name: pulumi.Output<string>;
    };
  };
  alarmEmail?: string;
}

/**
 * Create CloudWatch alarms and SNS notifications for monitoring
 * Implements Requirement 6.2: Error rate and latency monitoring with alerts
 */
export function createMonitoring({ api, alarmEmail }: MonitoringConfig) {
  // Create SNS topic for alarm notifications
  const alarmTopic = new aws.sns.Topic(
    createResourceName("monitoring", "alarms"),
    {
      displayName: "Faces of Plants - CloudWatch Alarms",
      tags: getResourceTags(),
    }
  );

  // Subscribe email to SNS topic if provided
  if (alarmEmail) {
    new aws.sns.TopicSubscription(
      createResourceName("monitoring", "alarm-email-subscription"),
      {
        topic: alarmTopic.arn,
        protocol: "email",
        endpoint: alarmEmail,
      }
    );
  }

  // Create CloudWatch Log Group for metrics (if not exists)
  const logGroup = new aws.cloudwatch.LogGroup(
    createResourceName("monitoring", "api-logs"),
    {
      name: pulumi.interpolate`/aws/apigateway/${api.api.name}`,
      retentionInDays: 30,
      tags: getResourceTags(),
    }
  );

  // Metric filter for error rate calculation
  // This counts 4xx and 5xx responses
  const errorMetricFilter = new aws.cloudwatch.LogMetricFilter(
    createResourceName("monitoring", "error-metric-filter"),
    {
      logGroupName: logGroup.name,
      name: "ApiErrorRate",
      pattern: '[request_id, timestamp, method, path, status_code>=400, ...]',
      metricTransformation: {
        name: "ErrorCount",
        namespace: "FacesOfPlants/API",
        value: "1",
        defaultValue: "0",
        unit: "Count",
      },
    }
  );

  // Metric filter for total request count
  const requestMetricFilter = new aws.cloudwatch.LogMetricFilter(
    createResourceName("monitoring", "request-metric-filter"),
    {
      logGroupName: logGroup.name,
      name: "ApiRequestCount",
      pattern: "[request_id, timestamp, method, path, status_code, ...]",
      metricTransformation: {
        name: "RequestCount",
        namespace: "FacesOfPlants/API",
        value: "1",
        defaultValue: "0",
        unit: "Count",
      },
    }
  );

  // CloudWatch Alarm: Error Rate > 5%
  // This alarm triggers when error rate exceeds 5% over a 5-minute period
  const errorRateAlarm = new aws.cloudwatch.MetricAlarm(
    createResourceName("monitoring", "error-rate-alarm"),
    {
      name: createResourceName("monitoring", "error-rate-gt-5-percent"),
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2, // 2 consecutive periods
      threshold: 5, // 5% error rate
      actionsEnabled: true,
      alarmActions: [alarmTopic.arn],
      okActions: [alarmTopic.arn],
      alarmDescription:
        "Triggers when API error rate exceeds 5% over 10 minutes (2 consecutive 5-minute periods)",
      treatMissingData: "notBreaching",
      tags: getResourceTags(),
      
      // Calculate error rate as percentage
      // (ErrorCount / RequestCount) * 100
      metricQueries: [
        {
          id: "errorRate",
          expression: "(errors / requests) * 100",
          label: "Error Rate (%)",
          returnData: true,
        },
        {
          id: "errors",
          metric: {
            namespace: "FacesOfPlants/API",
            metricName: "ErrorCount",
            stat: "Sum",
            period: 300, // 5 minutes
          },
          returnData: false,
        },
        {
          id: "requests",
          metric: {
            namespace: "FacesOfPlants/API",
            metricName: "RequestCount",
            stat: "Sum",
            period: 300, // 5 minutes
          },
          returnData: false,
        },
      ],
    }
  );

  // CloudWatch Alarm: P95 Latency > 5 seconds
  // This alarm triggers when 95th percentile latency exceeds 5000ms
  const latencyAlarm = new aws.cloudwatch.MetricAlarm(
    createResourceName("monitoring", "latency-alarm"),
    {
      name: createResourceName("monitoring", "p95-latency-gt-5s"),
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 2, // 2 consecutive periods
      threshold: 5000, // 5000 milliseconds = 5 seconds
      actionsEnabled: true,
      alarmActions: [alarmTopic.arn],
      okActions: [alarmTopic.arn],
      alarmDescription:
        "Triggers when API P95 latency exceeds 5 seconds over 10 minutes (2 consecutive 5-minute periods)",
      treatMissingData: "notBreaching",
      tags: getResourceTags(),

      // Use API Gateway's built-in latency metric
      metricName: "Latency",
      namespace: "AWS/ApiGateway",
      statistic: "Average", // Changed from p95 to Average
      period: 300, // 5 minutes
      dimensions: {
        ApiId: api.api.id,
      },
    }
  );

  // Additional alarm: High error count (absolute threshold)
  // This catches scenarios where error rate might be low but absolute errors are high
  const highErrorCountAlarm = new aws.cloudwatch.MetricAlarm(
    createResourceName("monitoring", "high-error-count-alarm"),
    {
      name: createResourceName("monitoring", "high-error-count"),
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 1,
      threshold: 50, // 50 errors in 5 minutes
      actionsEnabled: true,
      alarmActions: [alarmTopic.arn],
      okActions: [alarmTopic.arn],
      alarmDescription:
        "Triggers when API error count exceeds 50 in a 5-minute period",
      treatMissingData: "notBreaching",
      tags: getResourceTags(),

      metricName: "ErrorCount",
      namespace: "FacesOfPlants/API",
      statistic: "Sum",
      period: 300, // 5 minutes
    }
  );

  // Alarm for 5xx errors specifically (server errors)
  const serverErrorAlarm = new aws.cloudwatch.MetricAlarm(
    createResourceName("monitoring", "server-error-alarm"),
    {
      name: createResourceName("monitoring", "server-errors"),
      comparisonOperator: "GreaterThanThreshold",
      evaluationPeriods: 1,
      threshold: 10, // 10 server errors in 5 minutes
      actionsEnabled: true,
      alarmActions: [alarmTopic.arn],
      okActions: [alarmTopic.arn],
      alarmDescription:
        "Triggers when API 5xx error count exceeds 10 in a 5-minute period",
      treatMissingData: "notBreaching",
      tags: getResourceTags(),

      metricName: "5XXError",
      namespace: "AWS/ApiGateway",
      statistic: "Sum",
      period: 300, // 5 minutes
      dimensions: {
        ApiId: api.api.id,
      },
    }
  );

  // Create CloudWatch Dashboard
  // Implements Requirement 6.5: Dashboard for real-time metrics visualization
  const dashboard = new aws.cloudwatch.Dashboard(
    createResourceName("monitoring", "dashboard"),
    {
      dashboardName: createResourceName("monitoring", "dashboard"),
      dashboardBody: pulumi
        .all([api.api.id, api.api.name])
        .apply(([apiId, apiName]) =>
          JSON.stringify({
            widgets: [
              // Row 1: Request Metrics
              {
                type: "metric",
                x: 0,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                  title: "API Request Count",
                  metrics: [
                    [
                      "AWS/ApiGateway",
                      "Count",
                      { stat: "Sum", label: "Total Requests" },
                    ],
                    [
                      "FacesOfPlants/API",
                      "RequestCount",
                      { stat: "Sum", label: "Custom Request Count" },
                    ],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
              {
                type: "metric",
                x: 12,
                y: 0,
                width: 12,
                height: 6,
                properties: {
                  title: "API Request Latency (P50, P95, P99)",
                  metrics: [
                    [
                      "AWS/ApiGateway",
                      "Latency",
                      { stat: "p50", label: "P50" },
                    ],
                    ["...", { stat: "p95", label: "P95" }],
                    ["...", { stat: "p99", label: "P99" }],
                    ["...", { stat: "Average", label: "Average" }],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Milliseconds",
                      showUnits: false,
                    },
                  },
                },
              },

              // Row 2: Error Rates
              {
                type: "metric",
                x: 0,
                y: 6,
                width: 8,
                height: 6,
                properties: {
                  title: "Error Rate (%)",
                  metrics: [
                    [
                      {
                        expression: "(errors / requests) * 100",
                        label: "Error Rate",
                        id: "errorRate",
                      },
                    ],
                    [
                      "FacesOfPlants/API",
                      "ErrorCount",
                      { id: "errors", visible: false, stat: "Sum" },
                    ],
                    [
                      ".",
                      "RequestCount",
                      { id: "requests", visible: false, stat: "Sum" },
                    ],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Percent",
                      showUnits: false,
                      min: 0,
                    },
                  },
                  annotations: {
                    horizontal: [
                      {
                        label: "5% Threshold",
                        value: 5,
                        fill: "above",
                        color: "#d62728",
                      },
                    ],
                  },
                },
              },
              {
                type: "metric",
                x: 8,
                y: 6,
                width: 8,
                height: 6,
                properties: {
                  title: "Error Count by Type",
                  metrics: [
                    [
                      "AWS/ApiGateway",
                      "4XXError",
                      { stat: "Sum", label: "4xx Errors" },
                    ],
                    [".", "5XXError", { stat: "Sum", label: "5xx Errors" }],
                    [
                      "FacesOfPlants/API",
                      "ErrorCount",
                      { stat: "Sum", label: "Total Errors" },
                    ],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
              {
                type: "metric",
                x: 16,
                y: 6,
                width: 8,
                height: 6,
                properties: {
                  title: "Alarm Status",
                  metrics: [
                    [
                      "AWS/CloudWatch",
                      "AlarmState",
                      "AlarmName",
                      createResourceName(
                        "monitoring",
                        "error-rate-gt-5-percent"
                      ),
                      { label: "Error Rate Alarm" },
                    ],
                    [
                      "...",
                      createResourceName("monitoring", "p95-latency-gt-5s"),
                      { label: "Latency Alarm" },
                    ],
                    [
                      "...",
                      createResourceName("monitoring", "high-error-count"),
                      { label: "High Error Count" },
                    ],
                    [
                      "...",
                      createResourceName("monitoring", "server-errors"),
                      { label: "Server Errors" },
                    ],
                  ],
                  view: "singleValue",
                  region: "eu-central-1",
                  period: 300,
                },
              },

              // Row 3: Provider Health
              {
                type: "metric",
                x: 0,
                y: 12,
                width: 12,
                height: 6,
                properties: {
                  title: "Provider API Call Count",
                  metrics: [
                    [
                      "FacesOfPlants",
                      "ProviderCallCount",
                      "Provider",
                      "gbif",
                      { stat: "Sum", label: "GBIF" },
                    ],
                    [
                      "...",
                      "inaturalist",
                      { stat: "Sum", label: "iNaturalist" },
                    ],
                    ["...", "eol", { stat: "Sum", label: "EOL" }],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
              {
                type: "metric",
                x: 12,
                y: 12,
                width: 12,
                height: 6,
                properties: {
                  title: "Provider API Response Time",
                  metrics: [
                    [
                      "FacesOfPlants",
                      "ProviderCallDuration",
                      "Provider",
                      "gbif",
                      { stat: "Average", label: "GBIF Avg" },
                    ],
                    ["...", { stat: "p95", label: "GBIF P95" }],
                    [
                      "...",
                      "inaturalist",
                      { stat: "Average", label: "iNaturalist Avg" },
                    ],
                    ["...", { stat: "p95", label: "iNaturalist P95" }],
                    ["...", "eol", { stat: "Average", label: "EOL Avg" }],
                    ["...", { stat: "p95", label: "EOL P95" }],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Milliseconds",
                      showUnits: false,
                    },
                  },
                },
              },

              // Row 4: Provider Health (continued)
              {
                type: "metric",
                x: 0,
                y: 18,
                width: 12,
                height: 6,
                properties: {
                  title: "Provider Error Count",
                  metrics: [
                    [
                      "FacesOfPlants",
                      "ProviderErrorCount",
                      "Provider",
                      "gbif",
                      { stat: "Sum", label: "GBIF Errors" },
                    ],
                    [
                      "...",
                      "inaturalist",
                      { stat: "Sum", label: "iNaturalist Errors" },
                    ],
                    ["...", "eol", { stat: "Sum", label: "EOL Errors" }],
                  ],
                  view: "timeSeries",
                  stacked: true,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
              {
                type: "metric",
                x: 12,
                y: 18,
                width: 12,
                height: 6,
                properties: {
                  title: "Provider Success Rate (%)",
                  metrics: [
                    [
                      {
                        expression:
                          "(gbifSuccess / gbifTotal) * 100",
                        label: "GBIF Success Rate",
                        id: "gbifRate",
                      },
                    ],
                    [
                      {
                        expression:
                          "(inatSuccess / inatTotal) * 100",
                        label: "iNaturalist Success Rate",
                        id: "inatRate",
                      },
                    ],
                    [
                      {
                        expression: "(eolSuccess / eolTotal) * 100",
                        label: "EOL Success Rate",
                        id: "eolRate",
                      },
                    ],
                    [
                      "FacesOfPlants",
                      "ProviderCallCount",
                      "Provider",
                      "gbif",
                      "Success",
                      "true",
                      { id: "gbifSuccess", visible: false, stat: "Sum" },
                    ],
                    [
                      "...",
                      ".",
                      { id: "gbifTotal", visible: false, stat: "Sum" },
                    ],
                    [
                      "...",
                      "inaturalist",
                      ".",
                      "true",
                      { id: "inatSuccess", visible: false, stat: "Sum" },
                    ],
                    [
                      "...",
                      ".",
                      { id: "inatTotal", visible: false, stat: "Sum" },
                    ],
                    [
                      "...",
                      "eol",
                      ".",
                      "true",
                      { id: "eolSuccess", visible: false, stat: "Sum" },
                    ],
                    [
                      "...",
                      ".",
                      { id: "eolTotal", visible: false, stat: "Sum" },
                    ],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Percent",
                      showUnits: false,
                      min: 0,
                      max: 100,
                    },
                  },
                },
              },

              // Row 5: Cache Performance
              {
                type: "metric",
                x: 0,
                y: 24,
                width: 12,
                height: 6,
                properties: {
                  title: "Cache Hit vs Miss Count",
                  metrics: [
                    [
                      "FacesOfPlants",
                      "CacheHit",
                      { stat: "Sum", label: "Cache Hits" },
                    ],
                    [".", "CacheMiss", { stat: "Sum", label: "Cache Misses" }],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
              {
                type: "metric",
                x: 12,
                y: 24,
                width: 12,
                height: 6,
                properties: {
                  title: "Cache Hit Rate (%)",
                  metrics: [
                    [
                      {
                        expression: "(hits / (hits + misses)) * 100",
                        label: "Cache Hit Rate",
                        id: "hitRate",
                      },
                    ],
                    [
                      "FacesOfPlants",
                      "CacheHit",
                      { id: "hits", visible: false, stat: "Sum" },
                    ],
                    [
                      ".",
                      "CacheMiss",
                      { id: "misses", visible: false, stat: "Sum" },
                    ],
                  ],
                  view: "timeSeries",
                  stacked: false,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Percent",
                      showUnits: false,
                      min: 0,
                      max: 100,
                    },
                  },
                  annotations: {
                    horizontal: [
                      {
                        label: "Target: 50%",
                        value: 50,
                        fill: "below",
                        color: "#ff7f0e",
                      },
                    ],
                  },
                },
              },

              // Row 6: Cache Performance by Provider
              {
                type: "metric",
                x: 0,
                y: 30,
                width: 12,
                height: 6,
                properties: {
                  title: "Cache Hits by Provider",
                  metrics: [
                    [
                      "FacesOfPlants",
                      "CacheHit",
                      "Provider",
                      "gbif",
                      { stat: "Sum", label: "GBIF" },
                    ],
                    [
                      "...",
                      "inaturalist",
                      { stat: "Sum", label: "iNaturalist" },
                    ],
                    ["...", "eol", { stat: "Sum", label: "EOL" }],
                  ],
                  view: "timeSeries",
                  stacked: true,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
              {
                type: "metric",
                x: 12,
                y: 30,
                width: 12,
                height: 6,
                properties: {
                  title: "Cache Misses by Provider",
                  metrics: [
                    [
                      "FacesOfPlants",
                      "CacheMiss",
                      "Provider",
                      "gbif",
                      { stat: "Sum", label: "GBIF" },
                    ],
                    [
                      "...",
                      "inaturalist",
                      { stat: "Sum", label: "iNaturalist" },
                    ],
                    ["...", "eol", { stat: "Sum", label: "EOL" }],
                  ],
                  view: "timeSeries",
                  stacked: true,
                  region: "eu-central-1",
                  period: 300,
                  yAxis: {
                    left: {
                      label: "Count",
                      showUnits: false,
                    },
                  },
                },
              },
            ],
          })
        ),
    }
  );

  return {
    alarmTopic,
    logGroup,
    dashboard,
    alarms: {
      errorRate: errorRateAlarm,
      latency: latencyAlarm,
      highErrorCount: highErrorCountAlarm,
      serverError: serverErrorAlarm,
    },
  };
}
