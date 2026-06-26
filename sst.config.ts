/// <reference path="./.sst/platform/config.d.ts" />

export default {
  stage: "dev", // Default stage - never uses username
  app(input: any) {
    // Ensure we always have a predictable stage name
    const stage = input?.stage || "dev";
    
    // Validate stage names to prevent unwanted ones
    const allowedStages = ["dev", "staging", "production"];
    if (!allowedStages.includes(stage)) {
      throw new Error(`Invalid stage "${stage}". Allowed stages: ${allowedStages.join(", ")}`);
    }
    
    return {
      name: "faces-of-plants", // This becomes the prefix for all resources
      region: "eu-central-1",
      removal: stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const stage = $app.stage;
    const accountId = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
    const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "eu-central-1";
    console.log(`🚀 Deploying to stage: ${stage}`);

    const domainName = "facesofplants.org";
    const apiSubdomain = `api.${domainName}`;

    const isDomainStage = stage === "production" || stage === "staging";
    const customDomain = isDomainStage ? {
      domainName,
      domainAlias: `www.${domainName}`,
      apiDomainName: apiSubdomain,
    } : undefined;

    // Dynamic imports as required by SST v3
    const { createDatabase } = await import("./infra/database");
    const { createSecrets } = await import("./infra/secrets");
    const { createApi } = await import("./infra/api");
    const { createFrontend } = await import("./infra/frontend");
    const { createAdminFrontend } = await import("./infra/admin-frontend");
    const { createMonitoring } = await import("./infra/monitoring");

    // Create infrastructure modules with consistent naming
    const secrets = createSecrets();
    const database = createDatabase();
    // Note: Cognito Identity Pool removed - not needed with JWT strategy
    const api = createApi({ 
      database, 
      secrets, 
      auth: undefined, 
      accountId, 
      region,
      customDomain,
    });
  const frontend = createFrontend({ 
    stage, 
    api, 
    authJsTable: database.authJsTable, 
    loginHistoryTable: database.loginHistoryTable, 
    systemSettingsTable: database.systemSettingsTable,
    searchLogsTable: database.searchLogsTable,
    secrets,
    customDomain,
  });

    // Admin console frontend
    const adminFrontend = createAdminFrontend({
      stage,
      authJsTable: database.authJsTable,
      systemSettingsTable: database.systemSettingsTable,
      loginHistoryTable: database.loginHistoryTable,
      searchLogsTable: database.searchLogsTable,
      secrets,
      customDomain,
    });
    
    // Create monitoring infrastructure with CloudWatch alarms
    // Set ALARM_EMAIL environment variable to receive notifications
    const monitoring = createMonitoring({ 
      api, 
      alarmEmail: process.env.ALARM_EMAIL 
    });

    // Export environment variables for backend/API
    return {
      stage,
      api: api.api.url,
      web: frontend.web.url,
      admin: adminFrontend.admin.url,
      // Note: auth.identityPoolId removed - Cognito Identity Pool not needed
      tables: {
        userCollections: database.userCollectionsTable.name,
        queryHistory: database.queryHistoryTable.name,
        dataSources: database.dataSourcesTable.name,
      },
      monitoring: {
        alarmTopicArn: monitoring.alarmTopic.arn,
        logGroupName: monitoring.logGroup.name,
        dashboardName: monitoring.dashboard.dashboardName,
      },
      env: {
        DATA_SOURCES_TABLE: database.dataSourcesTable.name,
        AWS_REGION: region,
        USERS_TABLE_NAME: database.authJsTable.name,
      },
      outputs: {
        DATA_SOURCES_TABLE: database.dataSourcesTable.name,
      },
    };
  },
};
