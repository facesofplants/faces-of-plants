/// <reference path="../.sst/platform/config.d.ts" />

import { createResourceName, getResourceTags } from "./utils";
import { versionRoute, API_VERSIONS } from "./versioning";

interface ApiConfig {
  database: {
    userCollectionsTable: any;
    queryHistoryTable: any;
    dataSourcesTable: any;
  // usersTable removed
    authJsTable: any;
    cacheTable: any;
  };
  secrets: {
    llmApiKey: any;
  };
  auth?: {
    identityPool: any;
    identityPoolId: any;
  };
  accountId: string;
  region: string;
  customDomain?: {
    domainName: string;
    domainAlias?: string;
    apiDomainName?: string;
  };
}

export function createApi({ database, secrets, auth, accountId, region, customDomain }: ApiConfig) {
  // API Gateway (HTTP API) with Lambda routes
  const apiProps: any = {
    transform: {
      api: (args) => {
        args.tags = getResourceTags();
      },
    },
  };

  if (customDomain?.apiDomainName) {
    apiProps.domain = {
      name: customDomain.apiDomainName,
      dns: sst.aws.dns(),
    };
  }

  const api = new sst.aws.ApiGatewayV2(
    createResourceName("api", "gateway"),
    apiProps
  );

  // Define common environment variables
  const commonEnvironment = {
    GBIF_API_URL: "https://api.gbif.org/v1",
    USER_COLLECTIONS_TABLE: database.userCollectionsTable.name,
    QUERY_HISTORY_TABLE: database.queryHistoryTable.name,
  };

  // Define common links
  const commonLinks = [
    database.userCollectionsTable,
    database.queryHistoryTable,
    database.authJsTable,
  ];

  // Query endpoint (includes LLM functionality)
  api.route(`POST ${versionRoute("/query")}`, {
    handler: "packages/functions/api/query.handler",
    link: [...commonLinks, secrets.llmApiKey, database.cacheTable],
    environment: {
      ...commonEnvironment,
      CACHE_TABLE: database.cacheTable.name,
      LLM_PROVIDER: process.env.LLM_PROVIDER || "mistral",
      LLM_ENDPOINT: process.env.LLM_ENDPOINT || "https://api.mistral.ai/v1",
      LLM_MODEL: process.env.LLM_MODEL || "mistral-large-latest",
    },
    timeout: "30 seconds", // Configure Lambda timeout
    permissions: [
      {
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:Scan"
        ],
        resources: [database.authJsTable.arn, database.cacheTable.arn],
      },
    ],
  });

  // usersTable removed

  // Species endpoint
  api.route(`GET ${versionRoute("/species/{id}")}`, {
    handler: "packages/functions/api/species.handler",
    link: commonLinks,
    environment: commonEnvironment,
    timeout: "15 seconds", // Configure Lambda timeout
    permissions: [
      {
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:Scan"
        ],
        resources: [database.authJsTable.arn],
      },
    ],
  });

  // Collections endpoints
  api.route(`POST ${versionRoute("/collections")}`, {
    handler: "packages/functions/api/collections.handler",
    link: commonLinks,
    environment: commonEnvironment,
    timeout: "15 seconds", // Configure Lambda timeout
    permissions: [
      {
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:Scan"
        ],
        resources: [database.authJsTable.arn],
      },
    ],
  });

  api.route(`GET ${versionRoute("/collections/{userId}")}`, {
    handler: "packages/functions/api/collections.handler",
    link: commonLinks,
    environment: commonEnvironment,
    timeout: "15 seconds", // Configure Lambda timeout
    permissions: [
      {
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:DeleteItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
          "dynamodb:Scan"
        ],
        resources: [database.authJsTable.arn],
      },
    ],
  });

  // Data Sources API route for DynamoDB table access
  api.route(`GET ${versionRoute("/data-sources")}`, {
    handler: "packages/functions/api/data-sources.handler",
    link: [{ resource: database.dataSourcesTable, operations: ["scan"] }],
    environment: {
      DATA_SOURCES_TABLE: database.dataSourcesTable.name,
    },
    timeout: "10 seconds", // Configure Lambda timeout
  });

  // Cache invalidation endpoint (admin only) - unversioned
  api.route("DELETE /admin/cache", {
    handler: "packages/functions/api/cache-admin.handler",
    link: [database.cacheTable],
    environment: {
      CACHE_TABLE: database.cacheTable.name,
    },
    timeout: "20 seconds", // Configure Lambda timeout
    permissions: [
      {
        actions: [
          "dynamodb:GetItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
        ],
        resources: [database.cacheTable.arn],
      },
    ],
  });

  // Health check endpoint - unversioned
  api.route("GET /health", {
    handler: "packages/functions/api/health.handler",
    link: [database.cacheTable],
    environment: {
      CACHE_TABLE: database.cacheTable.name,
    },
    timeout: "10 seconds",
  });

  // LLM Proxy endpoint - unversioned
  api.route("POST /llm-proxy", {
    handler: "packages/functions/llm/proxy.handler",
    link: [secrets.llmApiKey],
    environment: {
      LLM_PROVIDER: "mistral",
      LLM_ENDPOINT: process.env.LLM_ENDPOINT || "https://api.mistral.ai/v1",
      LLM_MODEL: process.env.LLM_MODEL || "mistral-large-latest",
    },
    timeout: "30 seconds",
  });

  return {
    api,
  };
}
