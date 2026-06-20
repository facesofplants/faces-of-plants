/// <reference path="../.sst/platform/config.d.ts" />

import { createResourceName, getResourceTags } from "./utils";

interface FrontendConfig {
  stage: string;
  api: {
    api: any;
  };
  authJsTable: any;
  loginHistoryTable: any;
  secrets: {
    googleClientId: any;
    googleClientSecret: any;
    authSecret: any;
    githubClientId: any;
    githubClientSecret: any;
  };
  customDomain?: {
    domainName: string;
    domainAlias?: string;
    apiDomainName?: string;
  };
}

export function createFrontend({ stage, api, authJsTable, loginHistoryTable, secrets, customDomain }: FrontendConfig) {
  // Next.js site (served via CloudFront)
  const nextjsProps: any = {
    path: "packages/web",
    environment: {
      NEXT_PUBLIC_APP_NAME: "Faces of Plants",
      NEXT_PUBLIC_APP_TAGLINE: "Powered by GBIF",
      NEXT_PUBLIC_API_URL: api.api.url,
      AUTH_JS_TABLE_NAME: authJsTable.name,
      LOGIN_HISTORY_TABLE_NAME: loginHistoryTable.name,
      AUTH_SECRET: secrets.authSecret.value,
      NEXTAUTH_URL: customDomain
        ? `https://${customDomain.domainName}`
        : `https://${process.env.NEXT_PUBLIC_SITE_URL || "localhost:3000"}`,
      GOOGLE_CLIENT_ID: secrets.googleClientId.value,
      GOOGLE_CLIENT_SECRET: secrets.googleClientSecret.value,
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: secrets.googleClientId.value,
      GITHUB_CLIENT_ID: secrets.githubClientId.value,
      GITHUB_CLIENT_SECRET: secrets.githubClientSecret.value,
    },
    link: [authJsTable, loginHistoryTable],
    buildCommand: "bash scripts/build-open-next.sh",
    server: {
      install: ["openid-client"],
    },
    permissions: [
      {
        actions: [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:Scan",
          "dynamodb:DeleteItem",
        ],
        resources: [
          authJsTable.arn,
          authJsTable.arn.apply((arn: string) => `${arn}/*`),
          loginHistoryTable.arn,
        ],
      },
    ],
    transform: {
      distribution: (args: any) => {
        args.tags = getResourceTags();
      },
      cdn: (args: any) => {
        args.cachePolicy = new aws.cloudfront.CachePolicy("ServerCachePolicy", {
          name: "facesofplants-server-cache-policy",
          defaultTtl: 0,
          minTtl: 0,
          maxTtl: 31536000,
          parametersInCacheKeyAndForwardedToOrigin: {
            cookiesConfig: {
              cookieBehavior: "all",
            },
            headersConfig: {
              headerBehavior: "whitelist",
              headers: {
                items: ["x-open-next-cache-key"],
              },
            },
            queryStringsConfig: {
              queryStringBehavior: "all",
            },
          },
        });
      },
    },
  };

  if (customDomain) {
    nextjsProps.domain = {
      name: customDomain.domainName,
      dns: sst.aws.dns(),
    };
  }

  const web = new sst.aws.Nextjs(
    createResourceName("frontend", "site"),
    nextjsProps
  );

  return {
    web,
  };
}

