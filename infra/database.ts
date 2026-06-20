/// <reference path="../.sst/platform/config.d.ts" />

import { createResourceName, getResourceTags } from "./utils";

export function createDatabase() {
  // DynamoDB tables for user collections and query history
  const userCollectionsTable = new sst.aws.Dynamo(
    createResourceName("database", "user-collections"),
    {
      fields: {
        userId: "string",
        collectionId: "string",
      },
      primaryIndex: { hashKey: "userId", rangeKey: "collectionId" },
      transform: {
        table: (args) => {
          args.tags = getResourceTags();
        },
      },
    }
  );

  const queryHistoryTable = new sst.aws.Dynamo(
    createResourceName("database", "query-history"),
    {
      fields: {
        userId: "string",
        queryId: "string",
      },
      primaryIndex: { hashKey: "userId", rangeKey: "queryId" },
      transform: {
        table: (args) => {
          args.tags = getResourceTags();
        },
      },
    }
  );

  // DataSources table for documenting external data sources
  const dataSourcesTable = new sst.aws.Dynamo(
    createResourceName("database", "data-sources"),
    {
      fields: {
        id: "string", // unique identifier
      },
      primaryIndex: { hashKey: "id" },
      transform: {
        table: (args) => {
          args.tags = getResourceTags();
        },
      },
    }
  );


  const authJsTable = new sst.aws.Dynamo(createResourceName("database", "auth-js"), {
    fields: {
      PK: "string",
      SK: "string",
      GSI1PK: "string", // For legacy lookup
      GSI1SK: "string",
      email: "string", // Add email as a field for GSI
      userId: "string", // Add userId as a field for GSI
      expires: "string", // Add expires as a field for UserSessionIndex
      firstName: "string",
      lastName: "string",
    },
    primaryIndex: { hashKey: "PK", rangeKey: "SK" },
    globalIndexes: {
      GSI1: { hashKey: "GSI1PK", rangeKey: "GSI1SK" },
      EmailIndex: { hashKey: "email" },
      UserSessionIndex: { hashKey: "userId", rangeKey: "expires" }, // userId as PK, expires as SK for sorting
      NameIndex: { hashKey: "lastName", rangeKey: "firstName" },
    },
  });


  const loginHistoryTable = new sst.aws.Dynamo(createResourceName("database", "login-history"), {
    fields: {
      userId: "string",
      timestamp: "string",
    },
    primaryIndex: { hashKey: "userId", rangeKey: "timestamp" },
  });

  // Rate limiting table with TTL for automatic cleanup
  const rateLimitsTable = new sst.aws.Dynamo(
    createResourceName("database", "rate-limits"),
    {
      fields: {
        limitKey: "string", // IP address or user ID (primary key)
        // Note: tokens, lastRefill, ttl are stored but not indexed
      },
      primaryIndex: { hashKey: "limitKey" },
      ttl: "ttl", // Enable TTL on the ttl attribute
      transform: {
        table: (args) => {
          args.tags = getResourceTags();
        },
      },
    }
  );

  // Cache table with TTL for automatic expiration
  const cacheTable = new sst.aws.Dynamo(
    createResourceName("database", "cache"),
    {
      fields: {
        cacheKey: "string", // Primary key
        // Note: data, provider, createdAt, ttl are stored but not indexed
      },
      primaryIndex: { hashKey: "cacheKey" },
      ttl: "ttl", // Enable TTL on the ttl attribute
      transform: {
        table: (args) => {
          args.tags = getResourceTags();
        },
      },
    }
  );

  return {
    userCollectionsTable,
    queryHistoryTable,
    dataSourcesTable,
    authJsTable,
    loginHistoryTable,
    rateLimitsTable,
    cacheTable,
  };
}
