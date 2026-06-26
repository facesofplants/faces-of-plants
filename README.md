# Faces of Plants

Open-source platform for plant biodiversity exploration with multilingual natural-language search, interactive maps, and multi-source enrichment.

- Live site: https://facesofplants.org
- License: MIT

## What It Is

Faces of Plants helps users explore plant occurrence data with a search experience that combines:

- GBIF as primary occurrence backbone
- iNaturalist and EOL as complementary sources
- AI-assisted query interpretation (LLM optional)
- Geographic resolution (country, region, city) with geometry-aware filtering

The project is a pnpm monorepo deployed on AWS using SST v3.

## Current Architecture

### Applications

- `packages/web`: public Next.js app (maps, education, auth, profile, API routes)
- `packages/admin`: admin Next.js console (settings, logs, operational tools)

### Shared Runtime and Services

- `packages/core`: shared TypeScript services and models (query engine, LLM client, taxonomy/location resolution, rate limiting, retries, cache abstractions)
- `packages/functions`: Lambda handlers and data providers (GBIF, iNaturalist, EOL, API handlers, LLM proxy)

### Infrastructure (SST)

- `infra/api.ts`: API Gateway v2 + Lambda routes
- `infra/frontend.ts`: public web deployment
- `infra/admin-frontend.ts`: admin console deployment
- `infra/database.ts`: DynamoDB tables
- `infra/secrets.ts`: SST secrets
- `sst.config.ts`: stage, region, domain wiring, module composition

Default region: `eu-central-1`.
Supported stages: `dev`, `staging`, `production`.

## Key Features in the Current Codebase

- Multilingual plant name resolution pipeline with scientific-name validation and dynamic GBIF lookup
- Explicit location parsing and geocoding with sub-country geometry filtering support
- Multi-source query orchestration with merge strategies (`union`, `intersection`, `priority`)
- Provider graceful degradation: partial source failures do not fail the full response
- DynamoDB-backed caching, auth/session storage, search logs, system settings, and user collections
- NextAuth-based auth flows (credentials + OAuth providers when configured)

## API Surface (High-Level)

### Next.js API routes (web app)

- `/api/map-search`
- `/api/multi-source`
- `/api/plantnet`
- `/api/feature-flags`
- `/api/homepage-examples`
- `/api/education/progress`
- `/api/auth/*`

### API Gateway routes (SST/Lambda)

- `POST /v1/query`
- `GET /v1/species/{id}`
- `POST /v1/collections`
- `GET /v1/collections/{userId}`
- `GET /v1/data-sources`
- `DELETE /admin/cache`
- `GET /health`
- `POST /llm-proxy`

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- AWS credentials configured (required for `sst dev` / deploy workflows)

### Install

```bash
git clone https://github.com/facesofplants/faces-of-plants.git
cd faces-of-plants
pnpm install
cp .env.example .env.local
```

Update `.env.local` with local values as needed (especially auth and LLM settings).

### Run (recommended full-stack dev)

```bash
pnpm dev
```

This starts SST development mode and connects the apps/functions to deployed or live cloud resources for development.

### Run apps directly (without `sst dev`)

```bash
# Public app
pnpm -C packages/web dev

# Admin app (port 3001)
pnpm -C packages/admin dev
```

## Common Commands

### Repository-level

```bash
pnpm dev
pnpm build
pnpm deploy
pnpm remove

pnpm typecheck
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check

pnpm test
pnpm test:all
pnpm test:core
pnpm test:functions
pnpm test:coverage
```

### Package-level

```bash
pnpm -C packages/web lint
pnpm -C packages/web typecheck

pnpm -C packages/admin lint
pnpm -C packages/admin typecheck

pnpm -C packages/core test
pnpm -C packages/functions test
```

## Environment and Secrets

### Local

- Use `.env.example` as template for `.env.local`
- GBIF is open-access and does not require an API key
- LLM behavior is controlled by `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_ENDPOINT`, `LLM_MODEL`

### SST Secrets (stage-specific)

The infrastructure expects secrets for:

- LLM API key
- Auth secret
- Google OAuth client ID/secret
- GitHub OAuth client ID/secret
- Admin invite sender email

Use SST secret commands for each stage before deployment.

## Deploy

### Dev (default script)

```bash
pnpm deploy
```

### Staging / Production

```bash
pnpm exec sst deploy --stage staging
pnpm exec sst deploy --stage production
```

Production uses retention-safe removal policy in `sst.config.ts`.

## Repository Layout

```text
faces-of-plants/
├── infra/
├── packages/
│   ├── admin/
│   ├── core/
│   ├── functions/
│   └── web/
├── docs/
├── scripts/
├── DATA_PROVENANCE.md
├── sst.config.ts
└── README.md
```

## Documentation

- Getting started: `docs/getting-started.md`
- Development guide: `docs/development.md`
- Architecture details: `docs/architecture.md`
- Deployment guide: `docs/deployment.md`
- API reference: `docs/api-reference.md`
- Data provenance and attribution: `DATA_PROVENANCE.md`

## Data and Attribution

This project integrates biodiversity data from GBIF, iNaturalist, and EOL.
Respect source licenses and attribution requirements, and consult `DATA_PROVENANCE.md` for details.

## Contributing

1. Fork the repository
2. Create a branch (`feature/...`)
3. Commit with clear messages
4. Open a pull request

## License

MIT. See `LICENSE`.