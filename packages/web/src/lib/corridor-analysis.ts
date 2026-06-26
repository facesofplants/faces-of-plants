/**
 * Corridor Analysis — ecological corridor detection between habitat areas.
 *
 * Uses DBSCAN clustering for core areas + A* least-cost path for corridors.
 * Includes stepping stone detection, connectivity assessment, and
 * protected area integration per ecological network theory.
 * All computation runs in a Web Worker.
 */

import createGraph from 'ngraph.graph';
import path from 'ngraph.path';

import { type ResistanceGrid, type GridCell } from './resistance-map';
import { getDispersalProfile, assessCorridorViability, type DispersalProfile } from './dispersal-distance';
import { type ProtectedArea } from './protected-areas';

export interface Corridor {
  id: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  path: [number, number][];
  resistance: number;
  lengthKm: number;
  /** Functional connectivity assessment */
  viability?: {
    viable: boolean;
    rating: 'optimal' | 'feasible' | 'marginal' | 'unlikely';
    reason: string;
  };
  /** Stepping stones along this corridor */
  steppingStones?: SteppingStone[];
}

export interface CoreArea {
  id: number;
  lat: number;
  lng: number;
  occurrenceCount: number;
  /** Whether this core area coincides with an official protected area */
  protectedArea?: { name: string; designationType: string };
}

/** An isolated occurrence that serves as a habitat patch between core areas */
export interface SteppingStone {
  lat: number;
  lng: number;
  /** Distance from the nearest corridor path in km */
  distanceToCorridorKm: number;
  /** Whether this stone is within viable stepping range */
  withinRange: boolean;
}

/** Connectivity assessment for the entire network */
export interface ConnectivityAssessment {
  /** Overall connectivity score 0-100 */
  score: number;
  /** Rating */
  rating: 'well-connected' | 'partially-connected' | 'fragmented' | 'isolated';
  /** Isolated populations (clusters with no viable corridor to others) */
  isolatedPopulations: CoreArea[];
  /** Active corridors (viable dispersal paths) */
  activeCorridors: number;
  /** Total possible connections between core areas */
  totalPossibleConnections: number;
  /** Genus-specific dispersal info */
  dispersalProfile: DispersalProfile;
  /** Summary message */
  summary: string;
}

/**
 * Find corridors between core habitat areas using least-cost path.
 * Uses a Minimum Spanning Tree (Kruskal's) to select which pairs to connect,
 * avoiding the combinatorial explosion of all-pairs connections.
 * Optionally adds a few extra edges for network redundancy.
 *
 * @param occurrences - GBIF occurrence coordinates
 * @param resistanceGrid - Land-use resistance grid
 * @param coreAreas - Detected core areas (from DBSCAN clustering)
 * @param genus - Plant genus for dispersal-based distance cutoff
 * @returns Array of corridor paths
 */
export function findCorridors(
  occurrences: Array<{ lat: number; lng: number }>,
  resistanceGrid: ResistanceGrid,
  coreAreas: CoreArea[],
  genus?: string,
): Corridor[] {
  if (coreAreas.length < 2) return [];

  // Get dispersal profile to determine max viable corridor length
  const profile = getDispersalProfile(genus);
  // Hard cutoff: corridors longer than 5x max dispersal are ecologically meaningless
  // But cap at 100 km to keep computations reasonable
  const maxEdgeDistKm = Math.min(profile.maxDistanceKm * 5, 100);

  // Limit core areas to the top N by occurrence count to avoid huge computation
  const MAX_CORES = 20;
  const sortedCores = [...coreAreas]
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    .slice(0, MAX_CORES);

  // Compute edges sorted by Euclidean distance (proxy for MST)
  // Only consider edges within the max viable distance
  const edges: { i: number; j: number; dist: number }[] = [];
  for (let i = 0; i < sortedCores.length; i++) {
    for (let j = i + 1; j < sortedCores.length; j++) {
      const dist = haversineDistance(
        sortedCores[i].lat, sortedCores[i].lng,
        sortedCores[j].lat, sortedCores[j].lng,
      );
      if (dist <= maxEdgeDistKm) {
        edges.push({ i, j, dist });
      }
    }
  }
  edges.sort((a, b) => a.dist - b.dist);

  if (edges.length === 0) return [];

  // Kruskal's MST using Union-Find
  const parent = sortedCores.map((_, idx) => idx);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number): boolean {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent[ra] = rb;
    return true;
  }

  // Select MST edges + up to 30% extra short edges for redundancy
  const mstEdges: { i: number; j: number }[] = [];
  const extraEdges: { i: number; j: number }[] = [];
  const maxExtra = Math.ceil(sortedCores.length * 0.3);

  for (const edge of edges) {
    if (mstEdges.length >= sortedCores.length - 1 && extraEdges.length >= maxExtra) break;
    if (union(edge.i, edge.j)) {
      mstEdges.push(edge);
    } else if (extraEdges.length < maxExtra) {
      extraEdges.push(edge);
    }
  }

  const selectedPairs = [...mstEdges, ...extraEdges];

  // Build graph from resistance grid
  const graph = buildGraph(resistanceGrid);

  // Find least-cost path for each selected pair
  const corridors: Corridor[] = [];
  const pathFinder = path.aStar(graph, {
    distance: (fromNode: any, toNode: any) => {
      const fromId = typeof fromNode === 'object' ? fromNode.id : fromNode;
      const toId = typeof toNode === 'object' ? toNode.id : toNode;
      const from = resistanceGrid.cells[Math.floor(fromId / resistanceGrid.cols)]?.[
        fromId % resistanceGrid.cols
      ];
      const to = resistanceGrid.cells[Math.floor(toId / resistanceGrid.cols)]?.[
        toId % resistanceGrid.cols
      ];
      if (!from || !to) return Infinity;
      return haversineDistance(from.lat, from.lng, to.lat, to.lng);
    },
  });

  for (const { i, j } of selectedPairs) {
    const from = sortedCores[i];
    const to = sortedCores[j];

    const fromCell = findClosestCell(resistanceGrid, from.lat, from.lng);
    const toCell = findClosestCell(resistanceGrid, to.lat, to.lng);

    if (!fromCell || !toCell) continue;

    const fromNodeId = fromCell.row * resistanceGrid.cols + fromCell.col;
    const toNodeId = toCell.row * resistanceGrid.cols + toCell.col;

    try {
      const result = pathFinder.find(fromNodeId, toNodeId);

      if (result.length > 0) {
        const nodeIds: number[] = result.map((n: any) => (typeof n === 'object' ? n.id : n));

        const pathCoords: [number, number][] = nodeIds.map((nid) => {
          const row = Math.floor(nid / resistanceGrid.cols);
          const col = nid % resistanceGrid.cols;
          const cell = resistanceGrid.cells[row]?.[col];
          return cell ? [cell.lng, cell.lat] : [0, 0];
        });

        let totalResistance = 0;
        let totalLength = 0;
        for (let k = 0; k < nodeIds.length; k++) {
          const nid = nodeIds[k];
          const row = Math.floor(nid / resistanceGrid.cols);
          const col = nid % resistanceGrid.cols;
          const cell = resistanceGrid.cells[row]?.[col];
          if (cell) {
            totalResistance += cell.resistance;
          }
          if (k > 0) {
            const prevNid = nodeIds[k - 1];
            const prevRow = Math.floor(prevNid / resistanceGrid.cols);
            const prevCol = prevNid % resistanceGrid.cols;
            const prevCell = resistanceGrid.cells[prevRow]?.[prevCol];
            if (prevCell && cell) {
              totalLength += haversineDistance(prevCell.lat, prevCell.lng, cell.lat, cell.lng);
            }
          }
        }

        const viability = assessCorridorViability(totalLength, genus);

        corridors.push({
          id: corridors.length + 1,
          from: { lat: from.lat, lng: from.lng },
          to: { lat: to.lat, lng: to.lng },
          path: pathCoords,
          resistance: totalResistance,
          lengthKm: totalLength,
          viability,
        });
      }
    } catch {
      // A* may fail if no path exists; skip this pair
    }
  }

  return corridors;
}

/**
 * Extract core areas from clustered occurrence data.
 * Each cluster centroid becomes a core area.
 * Uses adaptive minimum threshold based on total occurrences to avoid
 * generating too many micro-clusters with dense datasets.
 */
export function extractCoreAreas(
  occurrences: Array<{ lat: number; lng: number }>,
  radiusKm: number = 10,
): CoreArea[] {
  if (occurrences.length === 0) return [];

  // Simple grid-based clustering (faster than full DBSCAN for this use case)
  const gridSize = radiusKm / 111; // Convert km to degrees
  const clusters = new Map<string, Array<{ lat: number; lng: number }>>();

  for (const occ of occurrences) {
    const gridKey = `${Math.floor(occ.lat / gridSize)}_${Math.floor(occ.lng / gridSize)}`;
    const cluster = clusters.get(gridKey) || [];
    cluster.push(occ);
    clusters.set(gridKey, cluster);
  }

  // Adaptive minimum: at least 3, but scale up for large datasets
  // so we don't get 100+ tiny clusters that overwhelm the network
  const minOccurrences = Math.max(3, Math.ceil(occurrences.length / 100));

  const coreAreas: CoreArea[] = [];
  let id = 0;

  for (const [, points] of clusters) {
    if (points.length < minOccurrences) continue;

    const avgLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const avgLng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;

    coreAreas.push({
      id: id++,
      lat: avgLat,
      lng: avgLng,
      occurrenceCount: points.length,
    });
  }

  return coreAreas;
}

/**
 * Build a graph from the resistance grid for pathfinding.
 */
function buildGraph(grid: ResistanceGrid) {
  const graph = createGraph();

  // Add nodes
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const nodeId = row * grid.cols + col;
      const cell = grid.cells[row]?.[col];
      if (cell) {
        graph.addNode(nodeId, { resistance: cell.resistance });
      }
    }
  }

  // Add edges (8-connected grid)
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const nodeId = row * grid.cols + col;
      const cell = grid.cells[row]?.[col];
      if (!cell) continue;

      // 8 neighbors
      const neighbors = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ];

      for (const [dr, dc] of neighbors) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols) continue;

        const neighborId = nr * grid.cols + nc;
        const neighborCell = grid.cells[nr]?.[nc];
        if (!neighborCell) continue;

        // Edge weight = destination cell resistance
        // Diagonal edges cost more (sqrt(2))
        const isDiagonal = dr !== 0 && dc !== 0;
        const baseCost = neighborCell.resistance;
        const edgeWeight = isDiagonal ? baseCost * 1.414 : baseCost;

        graph.addLink(nodeId, neighborId, edgeWeight);
      }
    }
  }

  return graph;
}

/**
 * Find the grid cell closest to a given coordinate.
 */
function findClosestCell(
  grid: ResistanceGrid,
  lat: number,
  lng: number,
): GridCell | null {
  let closest: GridCell | null = null;
  let minDist = Infinity;

  for (const row of grid.cells) {
    for (const cell of row) {
      const dist = haversineDistance(lat, lng, cell.lat, cell.lng);
      if (dist < minDist) {
        minDist = dist;
        closest = cell;
      }
    }
  }

  return closest;
}

/**
 * Haversine distance in km.
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── STEPPING STONES ─────────────────────────────────────────────────────────

/**
 * Identify stepping stones — isolated occurrences that lie near corridor paths.
 * These are habitat patches between core areas that facilitate multi-generational
 * dispersal for species with limited single-event range.
 */
export function findSteppingStones(
  occurrences: Array<{ lat: number; lng: number }>,
  coreAreas: CoreArea[],
  corridors: Corridor[],
  genus?: string,
): SteppingStone[] {
  const profile = getDispersalProfile(genus);
  const maxGap = profile.maxSteppingStoneGapKm;

  // Collect all points that belong to core areas (within core radius)
  const corePointSet = new Set<string>();
  for (const occ of occurrences) {
    for (const core of coreAreas) {
      if (haversineDistance(occ.lat, occ.lng, core.lat, core.lng) < 5) {
        corePointSet.add(`${occ.lat.toFixed(5)}_${occ.lng.toFixed(5)}`);
        break;
      }
    }
  }

  const steppingStones: SteppingStone[] = [];

  // For each occurrence NOT in a core area, check if it's near a corridor
  for (const occ of occurrences) {
    const key = `${occ.lat.toFixed(5)}_${occ.lng.toFixed(5)}`;
    if (corePointSet.has(key)) continue;

    let minDistToCorridor = Infinity;

    for (const corridor of corridors) {
      for (const [lng, lat] of corridor.path) {
        const d = haversineDistance(occ.lat, occ.lng, lat, lng);
        if (d < minDistToCorridor) minDistToCorridor = d;
      }
    }

    // Only include if within a reasonable distance from any corridor
    if (minDistToCorridor < maxGap * 2) {
      steppingStones.push({
        lat: occ.lat,
        lng: occ.lng,
        distanceToCorridorKm: minDistToCorridor,
        withinRange: minDistToCorridor <= maxGap,
      });
    }
  }

  return steppingStones;
}

// ─── CONNECTIVITY ASSESSMENT ─────────────────────────────────────────────────

/**
 * Assess the functional connectivity of the ecological network.
 * Evaluates whether corridors are viable for the given genus based on
 * dispersal distance and stepping stone availability.
 */
export function assessConnectivity(
  corridors: Corridor[],
  coreAreas: CoreArea[],
  genus?: string,
): ConnectivityAssessment {
  const profile = getDispersalProfile(genus);
  const totalPossible = (coreAreas.length * (coreAreas.length - 1)) / 2;

  // Assess each corridor's viability
  let activeCount = 0;
  for (const corridor of corridors) {
    const viability = assessCorridorViability(corridor.lengthKm, genus);
    corridor.viability = viability;
    if (viability.viable) activeCount++;
  }

  // Find isolated populations (core areas with no viable corridor)
  const connectedCoreIds = new Set<number>();
  for (const corridor of corridors) {
    if (corridor.viability?.viable) {
      // Find which core areas this corridor connects
      for (const core of coreAreas) {
        const distFrom = haversineDistance(core.lat, core.lng, corridor.from.lat, corridor.from.lng);
        const distTo = haversineDistance(core.lat, core.lng, corridor.to.lat, corridor.to.lng);
        if (distFrom < 5 || distTo < 5) {
          connectedCoreIds.add(core.id);
        }
      }
    }
  }

  const isolatedPopulations = coreAreas.filter(ca => !connectedCoreIds.has(ca.id));

  // Calculate score
  const connectivityRatio = totalPossible > 0 ? activeCount / totalPossible : 0;
  const score = Math.round(connectivityRatio * 100);

  let rating: ConnectivityAssessment['rating'];
  let summary: string;

  if (score >= 70) {
    rating = 'well-connected';
    summary = `Strong ecological network: ${activeCount}/${corridors.length} corridors viable for ${profile.genus} (${profile.mechanism}).`;
  } else if (score >= 40) {
    rating = 'partially-connected';
    summary = `Partial connectivity: ${activeCount} viable corridors. ${isolatedPopulations.length} population(s) at risk of genetic isolation.`;
  } else if (score > 0) {
    rating = 'fragmented';
    summary = `Fragmented network: only ${activeCount} corridor(s) within dispersal range. ${isolatedPopulations.length} isolated population(s) need habitat restoration.`;
  } else {
    rating = 'isolated';
    summary = `No viable connections detected for ${profile.genus}. All populations may be genetically isolated. Max dispersal: ${profile.maxDistanceKm} km (${profile.mechanism}).`;
  }

  return {
    score,
    rating,
    isolatedPopulations,
    activeCorridors: activeCount,
    totalPossibleConnections: totalPossible,
    dispersalProfile: profile,
    summary,
  };
}

// ─── PROTECTED AREA INTEGRATION ──────────────────────────────────────────────

/**
 * Merge official protected areas into core areas list.
 * Only includes protected areas that are within proximity of actual occurrences.
 */
export function integratProtectedAreas(
  coreAreas: CoreArea[],
  protectedAreas: ProtectedArea[],
  occurrences: Array<{ lat: number; lng: number }>,
  proximityKm: number = 10,
): CoreArea[] {
  const merged = [...coreAreas];
  let nextId = coreAreas.length > 0 ? Math.max(...coreAreas.map(c => c.id)) + 1 : 0;

  for (const pa of protectedAreas) {
    // Only consider protected areas that have at least one occurrence nearby
    const hasNearbyOccurrence = occurrences.some(
      occ => haversineDistance(occ.lat, occ.lng, pa.centroid.lat, pa.centroid.lng) < proximityKm,
    );
    if (!hasNearbyOccurrence) continue;

    // Check if any existing core area already overlaps with this protected area
    const overlaps = coreAreas.some(
      ca => haversineDistance(ca.lat, ca.lng, pa.centroid.lat, pa.centroid.lng) < 5,
    );

    if (overlaps) {
      // Tag the existing core area with the protected area info
      const closest = coreAreas.reduce((best, ca) => {
        const d = haversineDistance(ca.lat, ca.lng, pa.centroid.lat, pa.centroid.lng);
        const bestD = haversineDistance(best.lat, best.lng, pa.centroid.lat, pa.centroid.lng);
        return d < bestD ? ca : best;
      });
      closest.protectedArea = { name: pa.name, designationType: pa.designationType };
    } else {
      // Add protected area as a new core area
      merged.push({
        id: nextId++,
        lat: pa.centroid.lat,
        lng: pa.centroid.lng,
        occurrenceCount: 0, // No direct observations, but officially protected
        protectedArea: { name: pa.name, designationType: pa.designationType },
      });
    }
  }

  return merged;
}
