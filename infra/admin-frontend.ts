/// <reference path="../.sst/platform/config.d.ts" />

import { createResourceName, getResourceTags } from "./utils";

interface AdminFrontendConfig {
  stage: string;
  authJsTable: any;
  systemSettingsTable: any;
  loginHistoryTable: any;
  searchLogsTable: any;
  secrets: {
    authSecret: any;
    adminInviteFromEmail: any;
  };
  customDomain?: {
    domainName: string;
    domainAlias?: string;
  };
}

export function createAdminFrontend({ stage, authJsTable, systemSettingsTable, loginHistoryTable, searchLogsTable, secrets, customDomain }: AdminFrontendConfig) {
  const adminDomain = customDomain
    ? { name: `console.${customDomain.domainName}`, dns: sst.aws.dns() }
    : undefined;

  const nextjsProps: any = {
    path: "packages/admin",
    environment: {
      AUTH_JS_TABLE: authJsTable.name,
      LOGIN_HISTORY_TABLE: loginHistoryTable.name,
      SYSTEM_SETTINGS_TABLE: systemSettingsTable.name,
      SEARCH_LOGS_TABLE: searchLogsTable.name,
      ADMIN_INVITE_FROM_EMAIL: secrets.adminInviteFromEmail.value,
      AUTH_SECRET: secrets.authSecret.value,
      NEXTAUTH_URL: customDomain
        ? `https://console.${customDomain.domainName}`
        : `http://localhost:3001`,
    },
    link: [authJsTable, systemSettingsTable, loginHistoryTable, searchLogsTable],
    buildCommand: "bash scripts/build-open-next.sh",
    server: {
      install: ["openid-client"],
    },
    permissions: [
      {
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
          "ses:SendEmail",
        ],
        resources: [
          authJsTable.arn,
          systemSettingsTable.arn,
          loginHistoryTable.arn,
          searchLogsTable.arn,
        ],
      },
      {
        actions: ["ses:SendEmail"],
        resources: ["*"],
      },
    ],
    transform: {
      distribution: (args: any) => {
        args.tags = getResourceTags();
      },
    },
  };

  if (adminDomain) {
    nextjsProps.domain = adminDomain;
  }

  const admin = new sst.aws.Nextjs(
    createResourceName("admin", "site"),
    nextjsProps
  );

  return { admin };
}
