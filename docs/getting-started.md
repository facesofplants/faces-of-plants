# Getting Started with Faces of Plants

Welcome to the Faces of Plants platform! This guide provides the essential steps to get you started with exploring and using our multi-source biodiversity data.

## 1. Quick Start

### For Everyone: Explore with the Web App

The easiest way to start is by using the web interface.

1.  **Launch the App**: Visit our website at `https://facesofplants.org` or run it locally with `pnpm dev`.
2.  **Search for Plants**: Use the search bar to look for a species, like "bluebonnet" or "Lupinus texensis".
3.  **Explore Results**: Browse the aggregated results from GBIF, iNaturalist, and EOL, complete with photos, maps, and detailed information.

### For Developers: Make Your First API Call

Jump right into the data with a simple API call.

```bash
# Get data for "Quercus" (oaks) from all sources
curl "https://api.facesofplants.org/multi-source?query=Quercus&limit=5"
```

This will return a JSON object with unified occurrence data. For more advanced queries, see the [API Reference](./api-reference.md).

## 2. Core Concepts

-   **Multi-Source Integration**: We query top biodiversity databases (GBIF, iNaturalist, EOL) simultaneously, so you don't have to.
-   **Unified Data Model**: We standardize the data into a single, easy-to-use format, saving you significant data cleaning and mapping effort.

## 3. Local Development Setup

Want to run the project locally or contribute?

### Prerequisites

-   Node.js 18+
-   pnpm

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/facesofplants/faces-of-plants.git
cd faces-of-plants

# 2. Install dependencies
pnpm install

# 3. Start the development server
pnpm run dev
```

For detailed instructions on environment setup, project structure, and contribution guidelines, please see our complete [**Development Guide**](./development.md).

## 4. Next Steps

Where do you want to go from here?

-   **Dive deep into the API?**
    -   Read the full [**API Reference**](./api-reference.md) for endpoints, data models, and advanced usage.
-   **Build an application or add a new data source?**
    -   Follow the [**Development Guide**](./development.md) for setup, architecture, and contribution workflows.
-   **Understand the system architecture?**
    -   Explore the [**Architecture Guide**](./architecture.md) for a high-level overview.
-   **Have questions?**
    -   Check our [**FAQ**](./faq.md) for answers to common questions.

We're excited to see what you build with Faces of Plants!
