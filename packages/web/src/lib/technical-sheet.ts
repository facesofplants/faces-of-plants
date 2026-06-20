/**
 * Technical sheet storage for plants.
 * Dual-use: Domestic/Agricultural + Laboratory protocols.
 * Stored in IndexedDB for offline access.
 */

const DB_NAME = 'faces-of-plants';
const DB_VERSION = 1;
const STORE_NAME = 'technical-sheets';

export interface DomesticCare {
  light: string;
  water: string;
  soil: string;
  temperature: string;
  humidity: string;
  difficulty: 'easy' | 'medium' | 'hard';
  season: string;
  tips: string[];
  commonPests: string[];
  fertilizing: string;
}

export interface LabProtocol {
  growthMedium: string;
  sterileConditions: boolean;
  temperature: string;
  photoperiod: string;
  subculturing: string;
  contaminationRisk: 'low' | 'medium' | 'high';
  protocols: string[];
  equipment: string[];
  references: string[];
}

export interface TechnicalSheet {
  id: string;
  scientificName: string;
  commonName: string;
  family: string;
  genus: string;
  description: string;
  domestic: DomesticCare;
  lab: LabProtocol;
  source: 'plantnet' | 'manual' | 'openfarm' | 'gbif';
  lastUpdated: number;
}

// Pre-loaded technical sheets for common plants
const DEFAULT_SHEETS: TechnicalSheet[] = [
  {
    id: 'quercus-ilex',
    scientificName: 'Quercus ilex',
    commonName: 'Holm Oak',
    family: 'Fagaceae',
    genus: 'Quercus',
    description:
      'Evergreen oak native to the Mediterranean region. Important for Mediterranean forest ecosystems.',
    domestic: {
      light: 'Full sun to partial shade',
      water: 'Drought-tolerant once established. Water deeply but infrequently.',
      soil: 'Well-drained, sandy or loamy soil. Tolerates alkaline soils.',
      temperature: '-10°C to 35°C. Hardy and adaptable.',
      humidity: 'Tolerates low humidity. Avoid humid, stagnant air.',
      difficulty: 'medium',
      season: 'Plant in fall or spring. Growth period: March-September.',
      tips: [
        'Prune in late winter before new growth',
        'Mulch around base to retain moisture',
        'Protect young trees from frost',
        'Can be grown from acorns collected in autumn',
      ],
      commonPests: ['Oak processionary moth', 'Powdery mildew', 'Galls'],
      fertilizing: 'Light fertilization in spring. Avoid high nitrogen.',
    },
    lab: {
      growthMedium: 'MS medium with BAP (1 mg/L) for shoot induction',
      sterileConditions: true,
      temperature: '22±2°C',
      photoperiod: '16h light / 8h dark (150 μmol m⁻² s⁻¹)',
      subculturing: 'Every 4-6 weeks',
      contaminationRisk: 'medium',
      protocols: [
        'Surface sterilize acorns with 70% ethanol (30s) then 1% NaOCl (15min)',
        'Excise embryonic axis under laminar flow',
        'Culture on MS + BAP for shoot induction',
        'Transfer to MS + IBA for rooting',
      ],
      equipment: [
        'Laminar flow hood',
        'Autoclave',
        'Growth chamber',
        'Sterile forceps and scalpels',
      ],
      references: [
        'Vieitez et al. (1991) In vitro propagation of Quercus ilex L.',
        'Sánchez et al. (2008) Micropropagation of holm oak',
      ],
    },
    source: 'manual',
    lastUpdated: Date.now(),
  },
  {
    id: 'solanum-lycopersicum',
    scientificName: 'Solanum lycopersicum',
    commonName: 'Tomato',
    family: 'Solanaceae',
    genus: 'Solanum',
    description:
      'Major vegetable crop worldwide. Widely used in research for plant genetics and pathology.',
    domestic: {
      light: 'Full sun (6-8 hours minimum)',
      water: 'Regular watering. Keep soil consistently moist but not waterlogged.',
      soil: 'Rich, well-drained soil with pH 6.0-6.8',
      temperature: '18-29°C optimal. Frost-sensitive.',
      humidity: '50-70%. Avoid excessive humidity to prevent disease.',
      difficulty: 'easy',
      season: 'Start indoors 6-8 weeks before last frost. Transplant after danger of frost.',
      tips: [
        'Stake or cage plants for support',
        'Prune suckers for larger fruit',
        'Rotate crops annually',
        'Companion plant with basil',
      ],
      commonPests: ['Aphids', 'Tomato hornworm', 'Whiteflies', 'Late blight'],
      fertilizing: 'Balanced fertilizer at planting, then high potassium when fruiting.',
    },
    lab: {
      growthMedium: 'MS medium with BAP (2 mg/L) for shoot multiplication',
      sterileConditions: true,
      temperature: '25±2°C',
      photoperiod: '16h light / 8h dark',
      subculturing: 'Every 3 weeks',
      contaminationRisk: 'low',
      protocols: [
        'Surface sterilize seeds with 1% NaOCl (10min)',
        'Germinate on MS basal medium',
        'Multiplication: MS + BAP (2 mg/L)',
        'Rooting: MS + IBA (0.5 mg/L)',
        'Acclimatize in mist chamber',
      ],
      equipment: [
        'Laminar flow hood',
        'Autoclave',
        'Growth room',
        'pH meter',
      ],
      references: [
        'Kharrazi et al. (2011) Tissue culture in tomato',
        'Bhatia et al. (2004) Micropropagation of tomato',
      ],
    },
    source: 'manual',
    lastUpdated: Date.now(),
  },
  {
    id: 'monstera-deliciosa',
    scientificName: 'Monstera deliciosa',
    commonName: 'Swiss Cheese Plant',
    family: 'Araceae',
    genus: 'Monstera',
    description:
      'Tropical climbing plant popular as houseplant. Native to Central American rainforests.',
    domestic: {
      light: 'Bright indirect light. Tolerates low light but won\'t produce fenestrations.',
      water: 'Water when top inch of soil is dry. Reduce in winter.',
      soil: 'Well-draining potting mix with perlite and peat',
      temperature: '18-30°C. Minimum 13°C.',
      humidity: '60%+. Benefits from regular misting.',
      difficulty: 'easy',
      season: 'year-round indoor plant',
      tips: [
        'Provide a moss pole or trellis for climbing',
        'Wipe leaves regularly to remove dust',
        'Yellow leaves usually indicate overwatering',
        'Fenestrations develop with maturity and light',
      ],
      commonPests: ['Spider mites', 'Mealybugs', 'Scale insects'],
      fertilizing: 'Monthly during growing season with diluted balanced fertilizer.',
    },
    lab: {
      growthMedium: 'MS medium with NAA (1 mg/L) and BAP (0.5 mg/L)',
      sterileConditions: true,
      temperature: '24-28°C',
      photoperiod: '14h light / 10h dark',
      subculturing: 'Every 4-6 weeks',
      contaminationRisk: 'low',
      protocols: [
        'Take nodal cuttings with at least one axillary bud',
        'Surface sterilize with 70% ethanol (30s) + 2% NaOCl (10min)',
        'Culture on MS + NAA + BAP for shoot induction',
        'Root on half-strength MS + IBA',
      ],
      equipment: [
        'Laminar flow hood',
        'Autoclave',
        'Growth chamber',
      ],
      references: [
        'Chen et al. (2006) Micropropagation of Monstera deliciosa',
      ],
    },
    source: 'manual',
    lastUpdated: Date.now(),
  },
];

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('scientificName', 'scientificName', { unique: false });
        store.createIndex('family', 'family', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // Verify the store exists
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        dbInstance = null;
        // Delete and recreate at higher version
        const deleteReq = indexedDB.deleteDatabase(DB_NAME);
        deleteReq.onsuccess = () => resolve(openDB());
        deleteReq.onerror = () => reject(new Error('Failed to reset database'));
        return;
      }
      dbInstance = db;
      resolve(db);
    };

    request.onerror = (event) => {
      dbInstance = null;
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Initialize IndexedDB with default sheets.
 */
export async function initTechnicalSheets(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  for (const sheet of DEFAULT_SHEETS) {
    store.put(sheet);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a technical sheet by ID.
 */
export async function getTechnicalSheet(
  id: string
): Promise<TechnicalSheet | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get technical sheet by scientific name.
 */
export async function getTechnicalSheetByName(
  scientificName: string
): Promise<TechnicalSheet | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('scientificName');

  return new Promise((resolve, reject) => {
    const request = index.get(scientificName);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Search technical sheets by name (partial match).
 */
export async function searchTechnicalSheets(
  query: string
): Promise<TechnicalSheet[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result as TechnicalSheet[];
      const q = query.toLowerCase();
      const filtered = all.filter(
        (s) =>
          s.scientificName.toLowerCase().includes(q) ||
          s.commonName.toLowerCase().includes(q) ||
          s.family.toLowerCase().includes(q)
      );
      resolve(filtered);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a technical sheet.
 */
export async function saveTechnicalSheet(
  sheet: TechnicalSheet
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  store.put({ ...sheet, lastUpdated: Date.now() });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all technical sheets.
 */
export async function getAllTechnicalSheets(): Promise<TechnicalSheet[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
