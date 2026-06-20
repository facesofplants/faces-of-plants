# Phase 2 Implementation Plan

## Overview

Implement three advanced features for Faces of Plants:
1. **Plant Pathology Detection** — ONNX-based disease detection in browser
2. **Ecological Corridors** — Least-cost path analysis between core habitat areas
3. **Climate Envelope SDM** — Species distribution modeling with WorldClim data

All features follow the client-side-first architecture: computation in Web Workers, data in IndexedDB, zero server costs.

---

## Feature 1: Plant Pathology Detection (ONNX)

### Goal
Detect plant diseases from leaf photos directly in the browser using a pre-trained ONNX model.

### Dependencies to Install
- `onnxruntime-web` — ONNX inference in browser via WASM

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `public/models/plant-pathology.onnx` | Create | Pre-trained MobileNetV2 model (~10MB) |
| `src/lib/pathology-detector.ts` | Create | ONNX session management, image preprocessing, inference |
| `src/workers/pathology.worker.ts` | Create | Web Worker for non-blocking inference |
| `src/hooks/usePathology.ts` | Create | React hook wrapping the worker |
| `src/components/PathologyPanel.tsx` | Create | UI panel for disease detection |
| `src/config/features.ts` | Modify | Add `pathology` feature config |
| `src/app/maps/page.tsx` | Modify | Add PathologyPanel to sidebar |

### Algorithm
1. Load ONNX model (lazy, cached in memory)
2. Preprocess image: resize to 224x224, normalize to [0,1], convert to NCHW tensor
3. Run inference via `ort.InferenceSession.run()`
4. Post-process: map output indices to 38 PlantVillage class names
5. Return top results with confidence scores and severity classification

### Model Source
- Use a public MobileNetV2 model trained on PlantVillage dataset
- 38 classes: Tomato_Bacterial_spot, Tomato_Early_blight, Tomato_Late_blight, etc.
- Model size: ~10MB (quantized INT8)

### UI Integration
- New toggle button "Detect Disease" in maps page sidebar
- Panel shows: image upload/preview, disease results with confidence bars, severity indicators
- Results link to GBIF for affected species data

---

## Feature 2: Ecological Corridors

### Goal
Find least-cost paths between core habitat areas (DBSCAN clusters) using real land-use resistance data.

### Dependencies to Install
- `@turf/turf` — Spatial analysis (buffer, convex hull, point-in-polygon, centroid)
- `ngraph.path` — Graph-based least-cost path algorithm
- `ngraph.graph` — Graph data structure

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/corridor-analysis.ts` | Create | Core corridor logic: resistance grid, least-cost path |
| `src/lib/resistance-map.ts` | Create | Copernicus land-use data fetcher and resistance grid builder |
| `src/workers/corridor.worker.ts` | Create | Web Worker for corridor computation |
| `src/hooks/useCorridors.ts` | Create | React hook wrapping the worker |
| `src/components/CorridorPanel.tsx` | Create | UI panel for corridor visualization |
| `src/config/features.ts` | Modify | Add `corridors` feature config |
| `src/app/maps/page.tsx` | Modify | Add CorridorPanel to sidebar |

### Algorithm
1. **Core Areas**: Use existing DBSCAN clustering on GBIF occurrences
2. **Resistance Grid**: Fetch Copernicus land-use data for the map viewport
   - Grid resolution: ~1km cells
   - Map land-use classes to resistance values (forest=1, urban=100)
3. **Graph Construction**: Build a grid graph where each cell is a node
   - Edges to 8 neighbors (including diagonals)
   - Edge weights = resistance value of destination cell
4. **Least-Cost Path**: Use `ngraph.path` with A* heuristic
   - Calculate paths between all pairs of core area centroids
   - Return paths as GeoJSON LineStrings
5. **Visualization**: Render corridors as colored lines on the map

### Data Source
- **Copernicus Land Monitoring Service** — Global Land Cover dataset
- API endpoint: `https://land.copernicus.eu/landcover/`
- Resolution: 100m (resampled to 1km for browser performance)
- Classes: Forest, Shrub, Grassland, Cropland, Water, Urban, Bare

### Resistance Map Values

| Land-Use | Resistance | Description |
|----------|------------|-------------|
| Forest | 1 | Ideal corridor |
| Shrub/Grassland | 2 | Good |
| Cropland | 3 | Moderate |
| Water | 10 | Partial barrier |
| Road/Infrastructure | 50 | Strong barrier |
| Urban | 100 | Total barrier |

### UI Integration
- New toggle button "Ecological Corridors" in maps page sidebar
- Panel shows: corridor analysis controls, corridor lines on map
- Color-coded by resistance score (green=low, red=high)

---

## Feature 3: Climate Envelope SDM

### Goal
Predict current and future species suitable habitat using GBIF occurrences + WorldClim bioclimatic variables.

### Dependencies to Install
- None new — uses existing GBIF infrastructure + Web Workers

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `public/data/worldclim-subset.json` | Create | Pre-bundled WorldClim bioclim variables (~2MB) |
| `src/lib/sdm-engine.ts` | Create | Core SDM logic: bioclim stats, suitability scoring |
| `src/workers/sdm.worker.ts` | Create | Web Worker for SDM computation |
| `src/hooks/useSDM.ts` | Create | React hook wrapping the worker |
| `src/components/SDMPanel.tsx` | Create | UI panel for SDM visualization (replace mock) |
| `src/app/maps/page.tsx` | Modify | Integrate SDMPanel |

### Algorithm
1. **Data Collection**: Fetch GBIF occurrences for selected species (last 30 years)
2. **Bioclim Extraction**: For each occurrence, extract 19 WorldClim variables from pre-bundled subset
3. **Bioclim Stats**: Calculate min/max/mean/std for each variable across all occurrences
4. **Suitability Score**: For each grid cell in the study area:
   - Compare cell's bioclim values to species' bioclim envelope
   - Score = percentage of variables within 1 std dev of occurrence mean
5. **Current Distribution**: Grid cells with score > threshold (e.g., 60%)
6. **Future Projection**: Apply climate shift factors (SSP2-4.5, 2041-2060) to bioclim values
   - Pre-bundled shift factors per grid cell
7. **Range Shift**: Calculate northward/altitudinal shift from current to future distribution

### Data Source
- **WorldClim v2.1** — 19 bioclimatic variables at 10min resolution (~2MB for subset)
- Pre-bundled for regions: Europe, North America, Global (coarse)
- Variables: BIO1-BIO19 (temperature, precipitation, seasonality)

### UI Integration
- Replace existing mock `SpeciesDistributionPrediction` component with real SDM
- Panel shows: suitability heatmap overlay, range shift visualization, confidence metrics
- Toggle between current and future projections

---

## Implementation Order

1. **Plant Pathology Detection** — self-contained, no external data dependencies
2. **Ecological Corridors** — depends on existing clustering, adds spatial analysis
3. **Climate Envelope SDM** — most complex, needs data preparation

---

## Feature Gate Config Updates

```typescript
// Add to src/config/features.ts
pathology: {
  name: 'Plant Disease Detection',
  description: 'Detect plant diseases from leaf photos using AI',
  anonymousAccess: true,
  citizenAccess: true,
  researcherAccess: true,
  adminAccess: true,
  usageLimits: { anonymous: 5, citizen: 20, researcher: undefined },
  upgradeMessage: {
    anonymous: 'Sign up for free to get more disease detections!',
    citizen: 'Upgrade to Researcher for unlimited detections.',
  },
},

corridors: {
  name: 'Ecological Corridors',
  description: 'Find wildlife corridors between habitat areas',
  anonymousAccess: false,
  citizenAccess: true,
  researcherAccess: true,
  adminAccess: true,
  upgradeMessage: {
    anonymous: 'Sign up for free to access corridor analysis!',
    citizen: 'Upgrade to Researcher for advanced corridor analytics.',
  },
},

sdm: {
  name: 'Species Distribution Modeling',
  description: 'Predict species habitat suitability under climate change',
  anonymousAccess: false,
  citizenAccess: false,
  researcherAccess: true,
  adminAccess: true,
  upgradeMessage: {
    anonymous: 'Sign up for a Researcher account to access SDM tools.',
    citizen: 'Upgrade to Researcher to unlock distribution modeling.',
  },
},
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| ONNX model too large for browser | Use quantized INT8 model (~10MB), lazy load |
| Copernicus API rate limits | Cache resistance grids in IndexedDB, retry with backoff |
| WorldClim subset too large | Pre-bundle only essential variables, compress with gzip |
| Web Worker memory pressure | Limit grid resolution, process in chunks, terminate workers |
| A* pathfinding too slow | Limit graph size, use hierarchical pathfinding for large areas |

---

## Acceptance Criteria

- [ ] Pathology detection works with uploaded leaf photos
- [ ] Corridors render as lines on the map between habitat clusters
- [ ] SDM shows current vs future suitable habitat overlay
- [ ] All computation runs in Web Workers (no UI freezing)
- [ ] All features work offline after first load (except API calls for GBIF data)
- [ ] All features integrate into the maps page sidebar
- [ ] Build succeeds with no TypeScript errors
- [ ] Deployed to production
