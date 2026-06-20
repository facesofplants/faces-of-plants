# Faces of Plants - Project Re-engineering Plan

## Project Overview
Transform the existing `facesofplants` project into **Faces of Plants** - a modern AI-powered biodiversity discovery platform that makes GBIF data accessible to both citizen scientists and researchers through natural language queries.

**Brand Identity**: "Faces of Plants" - *Powered by GBIF*
**Domain**: facesofplants.com

## Technical Architecture

### Frontend Stack (Next.js 14+)
```
faces-of-plants/
├── sst.config.ts                # SST configuration
├── stacks/                      # Infrastructure stacks
│   ├── ApiStack.ts              # API Gateway + Lambda
│   ├── DatabaseStack.ts         # DynamoDB tables
│   ├── StorageStack.ts          # S3 buckets
│   └── FrontendStack.ts         # Static site hosting
├── packages/
│   ├── web/                     # Next.js frontend
│   │   ├── app/                 # App Router (Next.js 14+)
│   │   ├── components/
│   │   ├── lib/
│   │   └── public/
│   ├── functions/               # Lambda functions
│   │   ├── api/                 # API handlers
│   │   ├── gbif/                # GBIF integration
│   │   └── llm/                 # LLM proxy functions
│   └── core/                    # Shared types and utilities
├── .env                         # Environment variables
└── README.md
```

### AWS Infrastructure (Serverless & Cost-Optimized)

#### Core Services (Pay-as-you-use)
1. **Vercel/Netlify** - Frontend hosting (Free tier available) *or* **AWS Amplify**
2. **AWS Lambda** - Serverless backend functions (1M free requests/month)
3. **Amazon API Gateway** - API management (1M free requests/month)
4. **Amazon DynamoDB** - User data, query history (25GB free tier)
5. **Amazon S3** - Static assets, cached results (5GB free tier)
6. **Amazon CloudFront** - CDN (1TB free transfer/month)

#### Infrastructure as Code
**SST Framework (Serverless Stack)** - Modern IaC for serverless applications
- Type-safe infrastructure definitions
- Hot reloading for development
- Built-in AWS CDK support
- Optimized for serverless architectures

#### LLM Integration (Flexible & Cost-Effective)
**Configurable LLM Endpoints** - API-based approach with swappable providers:
1. **OpenAI API** (GPT-3.5/4) - Primary option
2. **Anthropic Claude API** - Alternative endpoint
3. **Groq API** - Fast inference option
4. **Local/Self-hosted** - Ultimate cost control
5. **AWS Bedrock** - Premium fallback option

```typescript
// Configurable LLM client
interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'groq' | 'custom';
  apiKey: string;
  endpoint: string;
  model: string;
}
```

## Migration Strategy

### Phase 1: Foundation (Weeks 1-2)
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Set up AWS Amplify for hosting
- [ ] Configure basic AWS services (Cognito, DynamoDB)
- [ ] Implement basic UI components from the React prototype
- [ ] Set up GBIF API integration

### Phase 2: Core Features (Weeks 3-4)
- [ ] Integrate Amazon Bedrock for AI query processing
- [ ] Implement dual-interface (citizen/researcher modes)
- [ ] Build natural language query parser
- [ ] Create results visualization components
- [ ] Add user authentication and profiles

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Implement collections and saved queries
- [ ] Add geolocation-based suggestions
- [ ] Build data export functionality for researchers
- [ ] Integrate real-time GBIF data caching
- [ ] Performance optimization and caching strategies

### Phase 4: Polish & Launch (Weeks 7-8)
- [ ] Mobile responsiveness and PWA features
- [ ] Advanced analytics and insights
- [ ] SEO optimization
- [ ] Documentation and user guides
- [ ] Beta testing and feedback integration

## Key Components to Preserve from Prototype

### 1. User Interface Components
```typescript
// Preserve the dual-mode toggle
const UserTypeToggle = () => { /* ... */ }

// Natural language search interface
const SearchInterface = () => { /* ... */ }

// Results display for both user types
const CitizenResults = () => { /* ... */ }
const ResearcherResults = () => { /* ... */ }

// Feature cards and landing elements
const FeatureCard = () => { /* ... */ }
```

### 2. Design System
- Glassmorphism aesthetic with backdrop blur
- Green-to-blue gradient color scheme
- Card-based layout with rounded corners
- Smooth transitions and micro-interactions

### 3. User Experience Patterns
- Example queries for onboarding
- Progressive disclosure of complexity
- Context-aware suggestions
- Visual feedback for loading states

## AWS Services Integration

### LLM Integration (Cost-Optimized)
```typescript
// packages/functions/llm/proxy.ts
import { ApiHandler } from "sst/node/api";

export const handler = ApiHandler(async (evt) => {
  const config = {
    provider: process.env.LLM_PROVIDER || 'openai',
    apiKey: process.env.LLM_API_KEY,
    endpoint: process.env.LLM_ENDPOINT,
    model: process.env.LLM_MODEL || 'gpt-3.5-turbo'
  };

  // Route to appropriate LLM provider
  switch (config.provider) {
    case 'openai':
      return await processWithOpenAI(query, config);
    case 'anthropic':
      return await processWithClaude(query, config);
    case 'groq':
      return await processWithGroq(query, config);
    default:
      return await processWithCustomEndpoint(query, config);
  }
});
```

### SST Configuration
```typescript
// sst.config.ts
import { SSTConfig } from "sst";
import { ApiStack } from "./stacks/ApiStack";
import { DatabaseStack } from "./stacks/DatabaseStack";
import { FrontendStack } from "./stacks/FrontendStack";

export default {
  config(_input) {
    return {
      name: "faces-of-plants",
      region: "us-east-1",
    };
  },
  stacks(app) {
    app
      .stack(DatabaseStack)
      .stack(ApiStack)
      .stack(FrontendStack);
  },
} satisfies SSTConfig;
```

### GBIF API Integration
```typescript
// lib/gbif/client.ts
export class GBIFClient {
  async searchOccurrences(params: GBIFSearchParams) {
    // Proxy GBIF API calls through Next.js API routes
    // Handle rate limiting and caching
    // Transform data for frontend consumption
  }
}
```

### DynamoDB Schema
```typescript
// User Collections
interface UserCollection {
  userId: string;
  collectionId: string;
  name: string;
  description: string;
  queries: SavedQuery[];
  species: string[];
  createdAt: string;
  updatedAt: string;
}

// Query History
interface QueryHistory {
  userId: string;
  queryId: string;
  query: string;
  userType: 'citizen' | 'researcher';
  results: any;
  timestamp: string;
}
```

## Environment Configuration

### Local Development
```bash
# .env
LLM_PROVIDER=openai
LLM_API_KEY=your_openai_api_key
LLM_ENDPOINT=https://api.openai.com/v1
LLM_MODEL=gpt-3.5-turbo
GBIF_API_URL=https://api.gbif.org/v1
NEXT_PUBLIC_APP_NAME="Faces of Plants"
NEXT_PUBLIC_APP_TAGLINE="Powered by GBIF"
```

### Production Deployment (SST)
```bash
# Deploy with SST
npx sst deploy --stage production

# Environment variables managed through SST
# Secrets stored in AWS Systems Manager Parameter Store
```

## Performance Considerations

### Caching Strategy
1. **CloudFront**: Static assets and API responses
2. **DynamoDB**: Frequently accessed species data
3. **S3**: Generated visualizations and reports
4. **Browser**: Query results and user preferences

### Optimization Techniques
1. **Image Optimization**: Next.js Image component with S3 integration
2. **Code Splitting**: Dynamic imports for heavy components
3. **Streaming**: Server-side rendering with streaming
4. **Edge Functions**: Geolocation-based content delivery

## Monitoring & Analytics

### Application Monitoring
- AWS CloudWatch for infrastructure metrics
- AWS X-Ray for request tracing
- Custom metrics for user engagement
- Error tracking with AWS CloudWatch Logs

### User Analytics
- Query pattern analysis
- Popular species and regions
- User journey optimization
- A/B testing for interface improvements

## Security Considerations

### Data Protection
- End-to-end encryption for user data
- GDPR compliance for EU users
- Rate limiting on API endpoints
- Input validation and sanitization

### Access Control
- Role-based access (citizen vs researcher)
- API key management for GBIF access
- Resource-level permissions in AWS
- Audit logging for compliance

## Budget Estimation (Monthly) - Optimized for Low Cost

### Free Tier Usage (First 12 months)
- **AWS Lambda**: 1M requests/month (FREE)
- **API Gateway**: 1M requests/month (FREE)
- **DynamoDB**: 25GB storage + 25 WCU/RCU (FREE)
- **S3**: 5GB storage + 20k GET requests (FREE)
- **CloudFront**: 1TB data transfer (FREE)

### LLM API Costs (Variable)
- **OpenAI GPT-3.5**: ~$0.002/1k tokens (~$20-50/month for moderate usage)
- **Anthropic Claude**: ~$0.008/1k tokens (~$30-80/month)
- **Groq**: ~$0.0002/1k tokens (~$5-15/month - very cost effective)

### Domain & Hosting
- **Domain (facesofplants.com)**: ~$12/year
- **Vercel/Netlify**: FREE tier available

**Total Estimated Monthly Cost**: $5-50/month (primarily LLM API usage)
**After Free Tier**: Add ~$10-30/month for AWS services

## Success Metrics

### User Engagement
- Daily/Monthly Active Users
- Query completion rates
- Time spent on platform
- Collection creation and sharing

### Technical Performance
- API response times (<2s for queries)
- Error rates (<1%)
- Uptime (99.9%+)
- Cache hit rates (>80%)

### Scientific Impact
- Data downloads by researchers
- Citations in scientific papers
- Species discovery contributions
- Educational usage statistics

## Migration Commands

### 1. Project Initialization with SST
```bash
# Clone and setup new project
git clone https://github.com/juserr/facesofplants.git
cd facesofplants
git checkout -b rewrite-v2

# Initialize SST project
npx create-sst@latest --template=base/example
npm install

# Add Next.js to the web package
cd packages/web
npx create-next-app@latest . --typescript --tailwind --eslint --app
cd ../..

# Install dependencies
npm install @aws-sdk/client-dynamodb
```

### 2. SST Stack Setup
```bash
# Initialize stacks
mkdir stacks
touch stacks/ApiStack.ts stacks/DatabaseStack.ts stacks/FrontendStack.ts

# Deploy development environment
npx sst dev
```

### 3. LLM Provider Configuration
```bash
# Set up environment variables for different providers
echo "LLM_PROVIDER=openai" >> .env
echo "LLM_API_KEY=your_api_key_here" >> .env

# Test different providers
npm run test:llm
```

This architecture provides a solid foundation for transforming your project into a modern, scalable, and user-friendly biodiversity discovery platform while preserving the innovative UI/UX concepts from our prototype.