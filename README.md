# Faces of Plants

An open-source platform for biodiversity exploration, powered by [GBIF](https://www.gbif.org) data and AI-powered natural language search.

**Live:** [facesofplants.org](https://facesofplants.org)  
**License:** MIT  
**Challenge:** [GBIF Ebbe Nielsen Challenge 2026](https://www.gbif.org/awards/ebbe-2026-rules)

## Overview

Faces of Plants makes global biodiversity data accessible to everyone. Ask questions in natural language, explore species on interactive maps, and analyze distribution patterns — all powered by GBIF's global network of scientific institutions.

## Features

- **Interactive Botanical Atlas** — Search and visualize plant occurrences worldwide with clustering, heatmap, and temporal filtering
- **Natural Language Query** — Ask questions like "Show me oak trees in Italy" and get structured results from GBIF
- **Multi-source Enrichment** — Data combined from GBIF, iNaturalist, and Encyclopedia of Life
- **Temporal Analysis** — Analyze how species distributions change over time
- **Species Lookup** — Detailed species information from GBIF's taxonomy API
- **User Collections** — Save and organize your favorite species and searches

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Maps   │  │  About   │  │Education │  │  Profile   │  │
│  └────┬─────┘  └──────────┘  └──────────┘  └────────────┘  │
│       │                                                      │
│  ┌────▼─────────────────────────────────────────────────┐   │
│  │              API Routes (Next.js)                     │   │
│  │  /api/map-search  /api/multi-source  /api/auth/*     │   │
│  └────┬─────────────────────────────────────────────────┘   │
└───────┼─────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    AWS Cloud (SST v3)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ API GW   │  │ Lambda   │  │ DynamoDB │  │ CloudFront │  │
│  │ (v2)     │  │ (query,  │  │ (auth,   │  │ (CDN)      │  │
│  │          │  │ species, │  │ cache,   │  │            │  │
│  │          │  │ collect.)│  │ collect.)│  │            │  │
│  └──────────┘  └────┬─────┘  └──────────┘  └────────────┘  │
│                     │                                       │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  External APIs (Open Data)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  GBIF    │  │iNaturalist│  │   EOL    │                  │
│  │ (primary)│  │          │  │          │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### AWS Services Used

| Service | Purpose | Cost Tier |
|---------|---------|-----------|
| **Lambda** | Serverless compute for API endpoints | Free tier eligible |
| **API Gateway v2** | HTTP API routing | Free tier eligible |
| **DynamoDB** | Auth sessions, caching, user collections | Free tier eligible |
| **CloudFront** | CDN for frontend static assets | Free tier eligible |
| **S3** | Static hosting for Next.js build | Free tier eligible |

### Running Locally

The application can run locally without AWS for development:

```bash
# Install dependencies
pnpm install

# Start local development (uses SST dev mode with local AWS emulation)
pnpm dev
```

For full functionality locally, you need:
- Node.js 18+
- AWS CLI configured (for SST dev mode)
- A Mistral AI API key (for natural language queries)

The GBIF API requires no authentication — it's open access.

## GBIF Integration

This platform uses data from [GBIF.org](https://www.gbif.org) available under a [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license.

### How we use GBIF data

- **Occurrence Search API** (`api.gbif.org/v1/occurrence/search`) — Real-time plant occurrence queries with georeferenced coordinates
- **Species API** (`api.gbif.org/v1/species/{key}`) — Taxonomic information and species details
- **Caching** — DynamoDB-backed cache to reduce API load and improve response times
- **Natural Language → GBIF Query** — AI (Mistral) converts plain-language questions into structured GBIF API parameters

All occurrence data is attributed to its original sources as required by GBIF's data usage policy. See [DATA_PROVENANCE.md](DATA_PROVENANCE.md) for detailed documentation.

### API Calls

```bash
# Search occurrences
curl "https://api.gbif.org/v1/occurrence/search?kingdom=Plantae&hasCoordinate=true&q=Quercus&limit=10"

# Get species info
curl "https://api.gbif.org/v1/species/2877951"
```

No API key required. All requests include a custom User-Agent header for identification.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS, React-Leaflet |
| Backend | AWS Lambda, API Gateway v2, SST v3 |
| Database | DynamoDB (auth, collections, cache) |
| AI | Mistral LLM for natural language query conversion |
| Auth | NextAuth v4, Google OAuth, GitHub OAuth, Credentials |
| Infrastructure | SST (Serverless Stack), AWS, CloudFront |

## Architecture: Core Logic vs AWS Lambda

The codebase is structured with a clear separation between **core logic** (AWS-agnostic) and **Lambda handlers** (thin AWS wrappers):

```
packages/
├── core/                    # Pure TypeScript — NO AWS dependencies
│   └── src/
│       ├── types.ts         # GBIFOccurrence, SearchParams, etc.
│       └── services/
│           ├── queryEngine.ts    # Multi-source query orchestration
│           ├── CacheService.ts   # DynamoDB caching (swappable)
│           ├── llm.ts            # Mistral AI client
│           └── RetryService.ts   # Retry logic
│
├── functions/               # Lambda handlers — thin wrappers
│   ├── api/
│   │   ├── query.ts         # Parses API Gateway event → calls core
│   │   ├── species.ts       # Species lookup
│   │   └── collections.ts   # User collections CRUD
│   └── gbif/
│       └── client.ts        # GBIF API client (pure fetch, no AWS)
│
└── web/                     # Next.js frontend
    └── src/app/api/         # Alternative API routes (no Lambda needed)
```

**Key insight:** The GBIF client (`packages/functions/gbif/client.ts`) uses plain `fetch()` — no AWS SDK. The core query engine (`packages/core/`) is pure TypeScript. Lambda handlers are just event-parsing wrappers.

### Testing Core Logic Locally (No AWS Required)

The GBIF integration and query engine can be tested without any AWS credentials:

```bash
# Test GBIF client directly
node -e "
  const { GBIFClient } = require('./packages/functions/gbif/client');
  const client = new GBIFClient();
  client.searchOccurrences({ q: 'Quercus', limit: 5 }).then(r => console.log(r));
"

# Or use the Next.js API routes (runs locally with pnpm dev)
curl http://localhost:3000/api/map-search -X POST \
  -H "Content-Type: application/json" \
  -d '{"species": "Quercus", "limit": 10}'
```

### Production: AWS Lambda + SST

In production, the same code runs on AWS Lambda via SST (Serverless Stack):

```bash
# Deploy to AWS (requires AWS CLI configured)
npx sst deploy --stage production
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/giuseppeserrecchia/faces-of-plants-1.git
cd faces-of-plants-1

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Start development (uses SST dev mode — simulates AWS locally)
pnpm dev

# Build for production
pnpm build

# Deploy to AWS
npx sst deploy --stage production
```

## Project Structure

```
faces-of-plants-1/
├── infra/                    # SST infrastructure (API, database, frontend)
│   ├── api.ts               # API Gateway + Lambda definitions
│   ├── database.ts          # DynamoDB table definitions
│   ├── frontend.ts          # Next.js + CloudFront + custom domain
│   └── secrets.ts           # SST secrets management
├── packages/
│   ├── core/                # Shared types, GBIF client, services
│   │   └── src/
│   │       ├── types/       # TypeScript types (GBIFOccurrence, etc.)
│   │       └── services/    # CacheService, RetryService, etc.
│   ├── functions/           # Lambda handlers
│   │   ├── api/             # query, species, collections, health
│   │   ├── gbif/            # GBIF API client
│   │   └── llm/             # Mistral AI proxy
│   └── web/                 # Next.js frontend
│       └── src/
│           ├── app/         # Pages (maps, about, education, auth)
│           ├── components/  # React components
│           ├── context/     # Mode/theme context
│           └── lib/         # Auth config, DynamoDB adapter
├── DATA_PROVENANCE.md       # How we use GBIF data
├── LICENSE                  # MIT License
├── README.md                # This file
└── .env.example             # Environment variables template
```

## Data Citation

When using data from Faces of Plants in publications, please cite the original GBIF datasets:

> GBIF.org (2026) GBIF Occurrence Download. Available at: https://www.gbif.org

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [GBIF](https://www.gbif.org) — Open biodiversity data
- [iNaturalist](https://www.inaturalist.org) — Community observation data
- [Encyclopedia of Life](https://eol.org) — Species information
- [Mistral AI](https://mistral.ai) — Natural language processing

---

Built with ❤️ for biodiversity research and education.
