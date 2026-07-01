# FaceOfPlants — Piano Tecnico Features

## Architettura Client-Side First

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Edge)                           │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  IndexedDB  │  │ Web Workers │  │ ONNX Runtime (WASM)     │ │
│  │  (storage)  │  │ (clustering │  │ (ML inference in browser)│ │
│  │             │  │  SDM calc)  │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              React + Leaflet + MapLibre                  │   │
│  │              (UI + Map Rendering)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  GBIF API    │ │  PlantNet    │ │  WorldClim   │
    │  (occurrences│ │  API         │ │  API         │
    │   taxonomy)  │ │  (recognition│ │  (bioclim)   │
    └──────────────┘ └──────────────┘ └──────────────┘
```

---

## Feature 1: Riconoscimento Istantaneo + Scheda Tecnica

### 1.1 Riconoscimento Pianta

**Complessità:** Bassa  
**Tecnologia:** API esterne (Pl@ntNet)  
**Esecuzione:** Client-side (fetch diretto)

#### Implementazione

```typescript
// src/lib/plantnet.ts
const PLANTNET_API = 'https://my-api.plantnet.org/v2';

interface PlantNetResult {
  score: number;
  species: {
    scientificName: string;
    commonNames: string[];
    family: string;
    genus: string;
  };
  gbifId?: number; // ID GBIF per collegamento dati
}

export async function identifyPlant(imageFile: File): Promise<PlantNetResult[]> {
  const formData = new FormData();
  formData.append('images', imageFile);
  formData.append('organs', 'auto'); // Auto-detect organ (leaf, flower, etc.)
  formData.append('api-key', process.env.NEXT_PUBLIC_PLANTNET_API_KEY || '');

  const response = await fetch(`${PLANTNET_API}/identification`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return data.results || [];
}
```

#### Flusso Utente
1. Utente scatta/carica foto
2. Fetch a Pl@ntNet API (client-side)
3. Risultati mostrati con confidenza %
4. Utente seleziona la specie corretta
5. Lookup su GBIF per dati aggiuntivi

#### API Key
- Pl@ntNet offre 100 identificazioni/mese gratis
- Chiave pubblica (`NEXT_PUBLIC_`) — sicura nel browser

---

### 1.2 Scheda Tecnica Dual-Use

**Complessità:** Molto Bassa  
**Tecnologia:** IndexedDB + JSON strutturato  
**Esecuzione:** Client-side

#### Struttura Dati

```typescript
// src/types/technical-sheet.ts
interface TechnicalSheet {
  id: string;
  scientificName: string;
  commonName: string;
  family: string;
  genus: string;
  
  // Dati Domestici/Agricoli
  domestic: {
    light: string;           // "Full sun", "Partial shade"
    water: string;           // "Weekly", "Keep moist"
    soil: string;            // "Well-drained", "Acidic"
    temperature: string;     // "15-25°C"
    humidity: string;        // "40-60%"
    difficulty: 'easy' | 'medium' | 'hard';
    season: string;          // "Spring-Fall"
    tips: string[];          // ["Prune in winter", "Fertilize monthly"]
  };
  
  // Dati Laboratorio
  lab: {
    growthMedium: string;    // "MS agar", "Hoagland solution"
    sterileConditions: boolean;
    temperature: string;     // "22±1°C"
    photoperiod: string;     // "16h light / 8h dark"
    subculturing: string;    // "Every 4 weeks"
    contaminationRisk: string;
    protocols: string[];     // ["Autoclave media", "Laminar flow"]
  };
  
  // Fonte dati
  source: 'openfarm' | 'manual' | 'gbif';
  lastUpdated: number;
}
```

#### Storage IndexedDB

```typescript
// Salva scheda tecnica
await storeTechnicalSheet({
  id: 'quercus-ilex',
  scientificName: 'Quercus ilex',
  domestic: { /* ... */ },
  lab: { /* ... */ },
});

// Recupera scheda
const sheet = await getTechnicalSheet('quercus-ilex');
```

#### Fonti Dati
- **Domestico:** OpenFarm API + database manuale (Eva/Isabella)
- **Laboratorio:** Mappatura manuale da letteratura scientifica

---

## Feature 2: Analisi Patologie + Mutazioni Climatiche

### 2.1 Rilevamento Patologie (ONNX in Browser)

**Complessità:** Media-Alta  
**Tecnologia:** ONNX Runtime Web + TensorFlow Lite  
**Esecuzione:** Client-side (WASM)

#### Modello: PlantVillage Dataset

Il dataset PlantVillage contiene ~54,000 immagini di piante sane e malate:
- 38 classi di patologie
- Piante: Pomodoro, Patata, Pepe, Melone, Mais, Grano
- Patologie: Peronospora, Septoria, Virus, Batteriosi, ecc.

#### Implementazione

```typescript
// src/lib/pathology-detector.ts
import * as ort from 'onnxruntime-web';

interface PathologyResult {
  className: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const MODEL_URL = '/models/plant-pathology.onnx';
const CLASS_NAMES = [
  'Tomato_Bacterial_spot',
  'Tomato_Early_blight',
  'Tomato_Late_blight',
  'Tomato_Leaf_Mold',
  'Tomato_Septoria_leaf_spot',
  // ... 38 classi
];

let session: ort.InferenceSession | null = null;

async function loadModel() {
  if (!session) {
    session = await ort.InferenceSession.create(MODEL_URL);
  }
  return session;
}

export async function detectPathology(
  imageFile: File
): Promise<PathologyResult[]> {
  const session = await loadModel();
  
  // Pre-processa immagine (resize, normalize)
  const imageData = await preprocessImage(imageFile);
  
  // Inference ONNX
  const input = new ort.Tensor('float32', imageData, [1, 3, 224, 224]);
  const output = await session.run({ input: input });
  
  // Post-processa risultati
  const probabilities = output.output.data;
  const results: PathologyResult[] = [];
  
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    const confidence = probabilities[i];
    if (confidence > 0.1) { // Soglia minima
      results.push({
        className: CLASS_NAMES[i],
        confidence,
        severity: getSeverity(confidence),
      });
    }
  }
  
  return results.sort((a, b) => b.confidence - a.confidence);
}
```

#### Vantaggi Client-Side
- **Privacy:** L'immagine non lascia il browser
- **Velocità:** Nessun round-trip al server
- **Offline:** Funziona senza rete dopo primo caricamento
- **Costi:** Zero costi server per inference

---

### 2.2 Modellazione Nicchia Ecologica (SDM)

**Complessità:** Media  
**Tecnologia:** WorldClim API + GBIF Historical + Web Workers  
**Esecuzione:** Client-side

#### Concept

Species Distribution Modelling (SDM) predice dove una specie potrebbe vivere basandosi su:
- Dati di occorrenza storici (GBIF)
- Variabili bioclimatiche (WorldClim)
- Algoritmo di modellazione (MaxEnt, GLM, o Random Forest semplificato)

#### Flusso Dati

```
1. Utente seleziona specie (es. Quercus ilex)
         │
         ▼
2. Fetch GBIF storico (ultimi 30 anni)
   GET /v1/occurrence/search?speciesKey=2877951&year=1994,2024
         │
         ▼
3. Fetch WorldClim variabili bioclimatiche
   GET https://biogeo.ucdavis.edu/data/worldclim/v2.1/hist/dbounds/...
         │
         ▼
4. Web Worker calcola SDM
   - Estrae coordinate da GBIF
   - Legge valori bioclimatiche per ogni coordinate
   - Addestra modello semplificato
   - Predice distribuzione futura
         │
         ▼
5. Risultato: GeoJSON con aree idonee
   - Distribuzione attuale
   - Distribuzione predetta 2050
   - Spostamento areale (nord/sud/quote)
```

#### Implementazione SDM Semplificato

```typescript
// src/workers/sdm.worker.ts

interface Occurrence {
  lat: number;
  lng: number;
  year: number;
  bioclim: number[]; // 19 variabili WorldClim
}

function simpleSDM(
  occurrences: Occurrence[],
  futureClimate: number[][]
): { current: [number, number][]; future: [number, number][] } {
  
  // 1. Calcola statistiche bioclimatiche per occorrenze
  const bioclimStats = calculateBioclimStats(occurrences);
  
  // 2. Trova aree con clima simile (current)
  const currentSuitable = findSuitableAreas(bioclimStats, 'current');
  
  // 3. Trova aree con clima simile (future 2050)
  const futureSuitable = findSuitableAreas(bioclimStats, 'future');
  
  return {
    current: currentSuitable,
    future: futureSuitable,
  };
}
```

#### Fonti Dati Aperte
- **WorldClim v2.1:** https://www.worldclim.org/data/worldclim21.html
  - Variabili bioclimatiche storiche (1970-2000)
  - Proiezioni future (2041-2060, SSP2-4.5)
- **GBIF:** Storico occorrenze per specie target
- **CHELSA:** Dati climatici ad alta risoluzione

---

## Feature 3: Atlante Botanico + Corridoi

### 3.1 Geolocalizzazione Locale

**Complessità:** Bassa  
**Tecnologia:** Geolocation API + GBIF API  
**Esecuzione:** Client-side

#### Implementazione

```typescript
// src/lib/geolocation.ts

interface NearbySpecies {
  species: string;
  count: number;
  distance: number; // km
  lastSeen: string;
}

export async function getNearbySpecies(
  radiusKm: number = 5
): Promise<NearbySpecies[]> {
  // 1. Ottieni posizione utente
  const position = await new Promise<GeolocationPosition>(
    (resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    }
  );

  const { latitude, longitude } = position.coords;

  // 2. Crea bounding box
  const latDelta = radiusKm / 111; // ~111 km per degree
  const lngDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

  const geometry = `POLYGON((${longitude - lngDelta} ${latitude - latDelta}, ${longitude + lngDelta} ${latitude - latDelta}, ${longitude + lngDelta} ${latitude + latDelta}, ${longitude - lngDelta} ${latitude + latDelta}, ${longitude - lngDelta} ${latitude - latDelta}))`;

  // 3. Query GBIF
  const response = await fetch(
    `https://api.gbif.org/v1/occurrence/search?kingdom=Plantae&hasCoordinate=true&geometry=${geometry}&limit=300`
  );

  const data = await response.json();
  
  // 4. Raggruppa per specie
  const speciesMap = new Map<string, { count: number; lastSeen: string }>();
  
  for (const occ of data.results) {
    const species = occ.species || occ.scientificName;
    const existing = speciesMap.get(species);
    
    if (existing) {
      existing.count++;
    } else {
      speciesMap.set(species, {
        count: 1,
        lastSeen: occ.eventDate || 'Unknown',
      });
    }
  }

  // 5. Calcola distanza per ogni specie
  const results: NearbySpecies[] = [];
  for (const [species, info] of speciesMap) {
    results.push({
      species,
      count: info.count,
      distance: calculateDistance(latitude, longitude, /* centroid */),
      lastSeen: info.lastSeen,
    });
  }

  return results.sort((a, b) => a.distance - b.distance);
}
```

---

### 3.2 Corridoi Biologici

**Complessità:** Media  
**Tecnologia:** Turf.js + Web Workers  
**Esecuzione:** Client-side

#### Pipeline

```
GBIF Occurrences
      │
      ▼
┌─────────────────┐
│ DBSCAN Clustering│ (già implementato)
│ (Aree Core)      │
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Resistance Map   │ (Dati Copernicus land-use)
│ (Costo Trasporto)│
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Least-Cost Path  │ (ngraph.path)
│ (Corridoi)       │
└─────────────────┘
      │
      ▼
GeoJSON LineString
(viene visualizzato sulla mappa)
```

#### Implementazione Least-Cost Path

```typescript
// src/lib/corridor-analysis.ts
import { point, lineString, featureCollection } from '@turf/turf';
import { clustersDbscan } from '@turf/clusters-dbscan';

interface Corridor {
  id: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  path: [number, number][];
  resistance: number; // punteggio resistenza
}

export function findCorridors(
  occurrences: Array<{ lat: number; lng: number }>,
  resistanceMap: Map<string, number> // grid cell → resistance
): Corridor[] {
  // 1. Clustering per trovare aree core
  const points = occurrences.map((o, i) =>
    point([o.lng, o.lat], { index: i })
  );
  const clustered = clustersDbscan(featureCollection(points), 10); // 10km
  
  // 2. Trova centroidi dei cluster
  const coreAreas = extractClusterCentroids(clustered);
  
  // 3. Calcola least-cost path tra ogni coppia di aree core
  const corridors: Corridor[] = [];
  
  for (let i = 0; i < coreAreas.length; i++) {
    for (let j = i + 1; j < coreAreas.length; j++) {
      const path = leastCostPath(
        coreAreas[i],
        coreAreas[j],
        resistanceMap
      );
      
      corridors.push({
        id: corridors.length + 1,
        from: coreAreas[i],
        to: coreAreas[j],
        path,
        resistance: calculateTotalResistance(path, resistanceMap),
      });
    }
  }
  
  return corridors;
}
```

#### Dati Resistenze (Land-Use)

Fonti aperte per mappa di resistenza:
- **Copernicus Land Monitoring:** https://land.copernicus.eu/
- **ESA WorldCover:** https://esa-worldcover.org/
- **OpenStreetMap:** Tag `landuse=*`

Ogni tipo di terreno ha un punteggio di resistenza:

| Land-Use | Resistenza | Note |
|----------|------------|------|
| Foresta | 1 | Corridoio ideale |
| Prato/Pascolo | 2 | Buono |
| Agricolo | 3 | Discreto |
| Acqua | 10 | Barriera parziale |
| Strada | 50 | Barriera forte |
| Città | 100 | Barriera totale |

---

## Tabella Riepilogativa

| Feature | Complessità | Librerie | Stato | Priorità |
|---------|-------------|----------|-------|----------|
| Riconoscimento Pianta | Bassa | Pl@ntNet API | ❌ Da fare | 1 |
| Scheda Tecnica Dual-Use | Molto Bassa | IndexedDB | ❌ Da fare | 1 |
| Rilevamento Patologie | Media-Alta | ONNX Runtime Web | ❌ Da fare | 2 |
| Mutazioni Climatiche | Media | WorldClim + GBIF | ❌ Da fare | 2 |
| Geolocalizzazione Locale | Bassa | Geolocation API | ❌ Da fare | 1 |
| Corridoi Biologici | Media | Turf.js + ngraph | ❌ Da fare | 2 |
| Mappa Interattiva | Bassa | React-Leaflet | ✅ Fatto | - |
| Offline-First | Bassa | IndexedDB + SW | ✅ Fatto | - |
| Clustering DBSCAN | Bassa | Web Worker | ✅ Fatto | - |

---

## Ordine di Implementazione Consigliato

1. **Fase 1** (MVP):
   - Geolocalizzazione locale
   - Scheda tecnica dual-use
   - Riconoscimento pianta (Pl@ntNet)

2. **Fase 2** (Feature avanzate):
   - Corridoi biologici (Turf.js)
   - Rilevamento patologie (ONNX)
   - Mutazioni climatiche (SDM)

3. **Fase 3** (Ottimizzazione):
   - DuckDB-WASM per query complesse
   - MapLibre GL per rendering GPU
   - Offline completo
