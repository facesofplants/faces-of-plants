/**
 * Corridor Analysis — ecological corridor detection between habitat areas.
 *
 * Uses DBSCAN clustering for core areas + A* least-cost path for corridors.
 * All computation runs in a Web Worker.
 */

import createGraph from 'ngraph.graph';
import path from 'ngraph.path';

import { type ResistanceGrid, type GridCell } from './resistance-map';

export interface Corridor {
  id: number;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  path: [number, number][];
  resistance: number;
  lengthKm: number;
}

export interface CoreArea {
  id: number;
  lat: number;
  lng: number;
  occurrenceCount: number;
}

/**
 * Find corridors between core habitat areas using least-cost path.
 *
 * @param occurrences - GBIF occurrence coordinates
 * @param resistanceGrid - Land-use resistance grid
 * @param coreAreas - Detected core areas (from DBSCAN clustering)
 * @returns Array of corridor paths
 */
export function findCorridors(
  occurrences: Array<{ lat: number; lng: number }>,
  resistanceGrid: ResistanceGrid,
  coreAreas: CoreArea[],
): Corridor[] {
  if (coreAreas.length < 2) return [];

  // Build graph from resistance grid
  const graph = buildGraph(resistanceGrid);

  // Find least-cost path between each pair of core areas
  const corridors: Corridor[] = [];
  const pathFinder = path.aStar(graph, {
    // A* heuristic: haversine distance
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

  for (let i = 0; i < coreAreas.length; i++) {
    for (let j = i + 1; j < coreAreas.length; j++) {
      const from = coreAreas[i];
      const to = coreAreas[j];

      // Find grid cells closest to each core area
      const fromCell = findClosestCell(resistanceGrid, from.lat, from.lng);
      const toCell = findClosestCell(resistanceGrid, to.lat, to.lng);

      if (!fromCell || !toCell) continue;

      const fromNodeId = fromCell.row * resistanceGrid.cols + fromCell.col;
      const toNodeId = toCell.row * resistanceGrid.cols + toCell.col;

      try {
        const result = pathFinder.find(fromNodeId, toNodeId);

        if (result.length > 0) {
          // ngraph.path returns Node objects with .id property
          const nodeIds: number[] = result.map((n: any) => (typeof n === 'object' ? n.id : n));

          const pathCoords: [number, number][] = nodeIds.map((nid) => {
            const row = Math.floor(nid / resistanceGrid.cols);
            const col = nid % resistanceGrid.cols;
            const cell = resistanceGrid.cells[row]?.[col];
            return cell ? [cell.lng, cell.lat] : [0, 0];
          });

          // Calculate total resistance and length
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

          corridors.push({
            id: corridors.length + 1,
            from: { lat: from.lat, lng: from.lng },
            to: { lat: to.lat, lng: to.lng },
            path: pathCoords,
            resistance: totalResistance,
            lengthKm: totalLength,
          });
        }
      } catch {
        // A* may fail if no path exists; skip this pair
      }
    }
  }

  return corridors;
}

/**
 * Extract core areas from clustered occurrence data.
 * Each cluster centroid becomes a core area.
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

  const coreAreas: CoreArea[] = [];
  let id = 0;

  for (const [, points] of clusters) {
    if (points.length < 3) continue; // Minimum occurrences for a core area

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
