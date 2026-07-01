'use client';

import {
  Download,
  Globe,
  Mountains,
  Planet,
  Clock,
  ArrowsOutSimple,
  X,
} from '@phosphor-icons/react';
import { Icon, divIcon, icon as leafletIcon } from 'leaflet';
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvent } from 'react-leaflet';

import type { GBIFOccurrence } from '@faces-of-plants/core/src/types';


import 'leaflet/dist/leaflet.css';
import AdvancedFilters from '../components/AdvancedFilters';

import type { FilterState } from '../components/AdvancedFilters';
import type L from 'leaflet';

// Fix for default markers in React Leaflet — pass explicit icon to all markers
const defaultIcon = leafletIcon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
delete (Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface InteractiveMapProps {
  occurrences: GBIFOccurrence[];
  dateRange?: { start: string; end: string };
  enableClustering?: boolean;
  showHeatmap?: boolean;
  showAdvancedFilters?: boolean;
  onShowAdvancedFilters?: (show: boolean) => void;
  onEnableClusteringChange?: (enable: boolean) => void;
  onShowHeatmapChange?: (show: boolean) => void;
  filters?: FilterState;
  setFilters?: (filters: FilterState) => void;
  theme?: string;
  showTemporalSlider?: boolean;
  onShowTemporalSliderChange?: (show: boolean) => void;
  onBoundsChange?: (bbox: [[number, number], [number, number]]) => void;
  loading?: boolean;
  corridors?: { id: number; path: [number, number][]; resistance: number; lengthKm: number }[];
  coreAreas?: { id: number; lat: number; lng: number; occurrenceCount: number; protectedArea?: { name: string; designationType: string } }[];
  steppingStones?: { lat: number; lng: number; distanceToCorridorKm: number; withinRange: boolean }[];
  suggestedBounds?: { south: number; north: number; west: number; east: number } | null;
  onResetMap?: () => void;
}

// Custom Zoom Control Component
// ...CustomZoomControl removed (unused)...

// Component to capture map instance
const MapInstanceCapture = ({ setMapInstance }: { setMapInstance: (map: L.Map) => void }) => {
  const map = useMap();

  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);

  return null;
};

// Smooth a polyline path using Chaikin's corner-cutting algorithm
// Makes grid-aligned A* paths look like natural ecological corridors
function smoothPath(points: [number, number][], iterations: number = 2): [number, number][] {
  if (points.length < 3) return points;

  let result = points;
  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: [number, number][] = [result[0]]; // Keep first point
    for (let i = 0; i < result.length - 1; i++) {
      const p0 = result[i];
      const p1 = result[i + 1];
      // Chaikin: 25% and 75% interpolation
      smoothed.push([
        p0[0] * 0.75 + p1[0] * 0.25,
        p0[1] * 0.75 + p1[1] * 0.25,
      ]);
      smoothed.push([
        p0[0] * 0.25 + p1[0] * 0.75,
        p0[1] * 0.25 + p1[1] * 0.75,
      ]);
    }
    smoothed.push(result[result.length - 1]); // Keep last point
    result = smoothed;
  }
  return result;
}

// Simple Heatmap Component with optimized rendering
const SimpleHeatmapLayer = ({ points }: { points: [number, number, number?][] }) => {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);

  // Throttle function to limit rendering frequency
  const throttle = useCallback((func: () => void, delay: number) => {
    return () => {
      const now = Date.now();
      if (now - lastRenderTimeRef.current >= delay) {
        lastRenderTimeRef.current = now;

        // Cancel any pending animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        // Schedule the update for the next frame
        animationFrameRef.current = requestAnimationFrame(func);
      }
    };
  }, []);

  const initializeCanvas = useCallback(() => {
    if (!map || canvasRef.current) {return null;}

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {return null;}

    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '400';
    canvas.style.mixBlendMode = 'multiply';

    const mapContainer = map.getContainer();
    mapContainer.appendChild(canvas);
    canvasRef.current = canvas;

    return { canvas, ctx };
  }, [map]);

  const drawHeatmap = useCallback(() => {
    if (!map || !points.length) {return;}

    let canvas = canvasRef.current;
    let ctx: CanvasRenderingContext2D | null = null;

    if (!canvas) {
      const result = initializeCanvas();
      if (!result) {return;}
      canvas = result.canvas;
      ctx = result.ctx;
    } else {
      ctx = canvas.getContext('2d');
      if (!ctx) {return;}
    }

    const size = map.getSize();

    // Resize canvas if map size changed
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate point density for better visualization
    const pointCount = points.length;
    const baseRadius = Math.max(10, Math.min(30, pointCount / 20));

    // Draw heat points with varying intensity based on zoom level
    const zoom = map.getZoom();
    const zoomFactor = Math.max(0.5, Math.min(2, zoom / 10));

    // Batch drawing operations for better performance
    points.forEach(([lat, lng, intensity = 1]) => {
      const point = map.latLngToContainerPoint([lat, lng]);

      // Skip points that are outside the current view (with larger buffer for smoother transitions)
      if (point.x < -100 || point.x > size.x + 100 || point.y < -100 || point.y > size.y + 100) {
        return;
      }

      const radius = baseRadius * zoomFactor;

      // Enhanced gradient with better color transitions
      const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, `rgba(220, 38, 127, ${0.8 * intensity})`); // Hot pink center
      gradient.addColorStop(0.2, `rgba(249, 115, 22, ${0.7 * intensity})`); // Orange
      gradient.addColorStop(0.4, `rgba(234, 179, 8, ${0.6 * intensity})`); // Yellow
      gradient.addColorStop(0.6, `rgba(34, 197, 94, ${0.4 * intensity})`); // Green
      gradient.addColorStop(0.8, `rgba(59, 130, 246, ${0.2 * intensity})`); // Blue
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0)'); // Transparent blue edge

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [map, points, initializeCanvas]);

  // Throttled version of drawHeatmap for real-time events
  const throttledDrawHeatmap = useMemo(() => throttle(drawHeatmap, 50), [throttle, drawHeatmap]);

  useEffect(() => {
    if (!map || !points.length) {return;}

    // Initial draw
    drawHeatmap();

    // Handle map events with different strategies
    const handleMapUpdate = () => {
      drawHeatmap();
    };

    // Use throttled version for real-time events (zoom, move)
    const handleRealTimeUpdate = throttledDrawHeatmap;

    // Only redraw on final events for better performance
    map.on('zoomend', handleMapUpdate);
    map.on('moveend', handleMapUpdate);

    // Use throttled updates for real-time events
    map.on('move', handleRealTimeUpdate);
    map.on('zoom', handleRealTimeUpdate);

    return () => {
      map.off('zoomend', handleMapUpdate);
      map.off('moveend', handleMapUpdate);
      map.off('move', handleRealTimeUpdate);
      map.off('zoom', handleRealTimeUpdate);

      // Cancel any pending animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Clean up canvas
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
    };
  }, [map, points.length, drawHeatmap, throttledDrawHeatmap]);

  return null;
};

interface ClusterData {
  id: string;
  lat: number;
  lng: number;
  count: number;
  occurrences: GBIFOccurrence[];
}

// Custom clustering algorithm
const clusterOccurrences = (
  occurrences: GBIFOccurrence[],
  clusterRadius = 0.5,
): ClusterData[] => {
  const clusters: ClusterData[] = [];
  const processed = new Set<number>();

  occurrences.forEach((occurrence, index) => {
    if (processed.has(index)) {return;}

    const lat = occurrence.decimalLatitude!;
    const lng = occurrence.decimalLongitude!;
    const cluster: ClusterData = {
      id: `cluster-${index}`,
      lat,
      lng,
      count: 1,
      occurrences: [occurrence],
    };

    // Find nearby occurrences to cluster
    occurrences.forEach((other, otherIndex) => {
      if (processed.has(otherIndex) || index === otherIndex) {return;}

      const otherLat = other.decimalLatitude!;
      const otherLng = other.decimalLongitude!;

      // Simple distance calculation
      const distance = Math.sqrt(Math.pow(lat - otherLat, 2) + Math.pow(lng - otherLng, 2));

      if (distance <= clusterRadius) {
        cluster.occurrences.push(other);
        cluster.count++;
        cluster.lat = (cluster.lat + otherLat) / 2; // Update cluster center
        cluster.lng = (cluster.lng + otherLng) / 2;
        processed.add(otherIndex);
      }
    });

    processed.add(index);
    clusters.push(cluster);
  });

  return clusters;
};

// Create custom cluster icon
const createClusterIcon = (count: number) => {
  let size = 30;
  let className = 'custom-cluster-small';

  if (count > 100) {
    size = 44;
    className = 'custom-cluster-large';
  } else if (count > 20) {
    size = 36;
    className = 'custom-cluster-medium';
  }

  return divIcon({
    html: `<div class="cluster-inner">${count}</div>`,
    className,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

interface InteractiveMapProps {
  occurrences: GBIFOccurrence[];
  dateRange?: { start: string; end: string };
  showHeatmap?: boolean;
  enableClustering?: boolean;
  showAdvancedFilters?: boolean;
  onShowAdvancedFilters?: (show: boolean) => void;
  onEnableClusteringChange?: (enabled: boolean) => void;
  onShowHeatmapChange?: (show: boolean) => void;
  filters?: FilterState;
  setFilters?: (filters: FilterState) => void;
  theme?: string;
  showTemporalSlider?: boolean;
  onShowTemporalSliderChange?: (show: boolean) => void;
  onBoundsChange?: (bounds: [[number, number], [number, number]]) => void;
  corridors?: { id: number; path: [number, number][]; resistance: number; lengthKm: number }[];
  coreAreas?: { id: number; lat: number; lng: number; occurrenceCount: number; protectedArea?: { name: string; designationType: string } }[];
  steppingStones?: { lat: number; lng: number; distanceToCorridorKm: number; withinRange: boolean }[];
  suggestedBounds?: { south: number; north: number; west: number; east: number } | null;
  flyToPoint?: { lat: number; lng: number; zoom?: number } | null;
  highlightedPoint?: { lat: number; lng: number; label?: string; image?: string } | null;
  onResetMap?: () => void;
}

// Export functions
const exportToCSV = (
  occurrences: GBIFOccurrence[],
  filename = 'species-occurrences.csv',
) => {
  const headers = [
    'Species',
    'Scientific Name',
    'Latitude',
    'Longitude',
    'Date',
    'Country',
    'Recorded By',
  ];
  const rows = occurrences.map((occ) => [
    occ.species || occ.scientificName || 'Unknown',
    occ.scientificName || '',
    occ.decimalLatitude?.toString() || '',
    occ.decimalLongitude?.toString() || '',
    occ.eventDate ? new Date(occ.eventDate).toISOString().split('T')[0] : '',
    occ.country || '',
    occ.recordedBy || '',
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Fullscreen image modal component
const FullscreenImageModal = ({ src, onClose }: { src: string; onClose: () => void }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {onClose();}
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Render modal at the top-level of the DOM using a portal
  return typeof window !== 'undefined' && document.body
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/95 w-screen h-screen flex items-center justify-center"
          style={{ animation: 'fadeIn 0.2s' }}
          onClick={onClose}
        >
          <button
            className="absolute top-4 right-4 text-white bg-black/60 rounded-full p-2 hover:bg-black/80 z-10"
            onClick={onClose}
            aria-label="Close fullscreen"
            style={{ pointerEvents: 'auto' }}
          >
            <X size={28} />
          </button>
          <img
            src={src}
            alt="Species"
            className="max-w-full max-h-full w-auto h-auto object-contain"
            style={{ background: '#222', zIndex: 1000, pointerEvents: 'none' }}
            draggable={false}
          />
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0 }
              to { opacity: 1 }
            }
          `}</style>
        </div>,
        document.body,
      )
    : null;
};

// Spinner and image loader for popup, now with fullscreen support
export const ImageWithSpinner = ({
  src,
  enableFullscreen = false,
}: {
  src?: string;
  enableFullscreen?: boolean;
}) => {
  const [loading, setLoading] = React.useState(!!src);
  const [error, setError] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const size = 220; // match min/max width

  if (fullscreen && src) {
    return <FullscreenImageModal src={src} onClose={() => setFullscreen(false)} />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        margin: '0 auto',
        background: '#f3f3f3',
        borderRadius: 8,
        overflow: 'hidden',
      }}
      className="mb-2 flex items-center justify-center"
    >
      {src && !error ? (
        <>
          {enableFullscreen && (
            <button
              className="absolute top-2 left-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1"
              style={{ lineHeight: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                setFullscreen(true);
              }}
              aria-label="Expand image"
            >
              <ArrowsOutSimple size={22} />
            </button>
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-gray-400" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            </div>
          )}
          <img
            src={src}
            alt="Species image"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: loading ? 'none' : 'block',
            }}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
          />
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs">
          No image
        </div>
      )}
    </div>
  );
};

export default function InteractiveMap({
  occurrences = [],
  dateRange,
  showHeatmap = false,
  enableClustering = true,
  showAdvancedFilters = false,
  onShowAdvancedFilters,
  onEnableClusteringChange,
  onShowHeatmapChange,
  filters = {} as FilterState,
  setFilters,
  theme = 'light',
  showTemporalSlider = false,
  onShowTemporalSliderChange,
  onBoundsChange,
  loading = false,
  corridors = [],
  coreAreas = [],
  steppingStones = [],
  suggestedBounds,
  flyToPoint,
  highlightedPoint,
  onResetMap,
}: InteractiveMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [mapLayer, setMapLayerState] = useState<'standard' | 'terrain' | 'satellite'>('satellite');

  // Persist map layer preference
  const setMapLayer = (layer: 'standard' | 'terrain' | 'satellite') => {
    setMapLayerState(layer);
    try {
      const raw = localStorage.getItem('fop-preferences');
      const prefs = raw ? JSON.parse(raw) : {};
      prefs.mapLayer = layer;
      localStorage.setItem('fop-preferences', JSON.stringify(prefs));
    } catch { /* ignore */ }
  };

  // Ensure map only renders on client
  useEffect(() => {
    setIsClient(true);
    // Load saved map layer preference
    try {
      const raw = localStorage.getItem('fop-preferences');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.mapLayer && ['standard', 'terrain', 'satellite'].includes(prefs.mapLayer)) {
          setMapLayerState(prefs.mapLayer);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Fly to suggested bounds when LLM extracts geographic info
  useEffect(() => {
    if (mapInstance && suggestedBounds) {
      const { south, north, west, east } = suggestedBounds;
      mapInstance.flyToBounds(
        [[south, west], [north, east]],
        { padding: [50, 50], maxZoom: 10, animate: true, duration: 1.0, easeLinearity: 0.5 }
      );
    }
  }, [mapInstance, suggestedBounds]);

  // Fly to a specific point (e.g. when user clicks a core area)
  useEffect(() => {
    if (mapInstance && flyToPoint) {
      mapInstance.flyTo(
        [flyToPoint.lat, flyToPoint.lng],
        flyToPoint.zoom ?? 12,
        { animate: true, duration: 0.8 }
      );
    }
  }, [mapInstance, flyToPoint]);

  // Map layer configurations
  const mapLayers = {
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
    terrain: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri — Source: USGS, Esri, TANA, DeLorme, and NPS',
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution:
        'Tiles &copy; Esri — Source: Esri, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
    },
  };

  // Filter occurrences by date range in real-time
  const filteredOccurrences = useMemo(() => {
    if (!dateRange) {return occurrences;}

    return occurrences.filter((occ) => {
      if (!occ.eventDate) {return false;}

      try {
        const occDate = new Date(occ.eventDate);
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        // Check if date is valid and within range
        if (isNaN(occDate.getTime())) {return false;}
        return occDate >= startDate && occDate <= endDate;
      } catch {
        // If date parsing fails, exclude the occurrence
        return false;
      }
    });
  }, [occurrences, dateRange]);

  // Filter for valid coordinates
  const validOccurrences = useMemo(() => {
    return filteredOccurrences.filter(
      (occ) =>
        occ.decimalLatitude &&
        occ.decimalLongitude &&
        !isNaN(occ.decimalLatitude) &&
        !isNaN(occ.decimalLongitude),
    );
  }, [filteredOccurrences]);

  // Create clusters when clustering is enabled
  const clusters = useMemo(() => {
    if (!enableClustering) {return [];}
    return clusterOccurrences(validOccurrences);
  }, [validOccurrences, enableClustering]);

  // Prepare heatmap data with density calculation
  const heatmapPoints = useMemo(() => {
    if (!showHeatmap) {return [];}

    // Calculate point density in a grid to create intensity values
    const gridSize = 0.1; // degrees for grid cells
    const densityMap = new Map<string, number>();

    // Count occurrences in each grid cell
    validOccurrences.forEach((occ) => {
      const gridLat = Math.floor(occ.decimalLatitude! / gridSize) * gridSize;
      const gridLng = Math.floor(occ.decimalLongitude! / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;
      densityMap.set(key, (densityMap.get(key) || 0) + 1);
    });

    // Find max density for normalization
    const maxDensity = Math.max(...Array.from(densityMap.values()));

    // Create heatmap points with calculated intensity
    return validOccurrences.map((occ) => {
      const gridLat = Math.floor(occ.decimalLatitude! / gridSize) * gridSize;
      const gridLng = Math.floor(occ.decimalLongitude! / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;
      const density = densityMap.get(key) || 1;
      const intensity = Math.min(1, (density / maxDensity) * 2); // Normalize and boost

      return [occ.decimalLatitude!, occ.decimalLongitude!, intensity] as [number, number, number];
    });
  }, [validOccurrences, showHeatmap]);

  // Custom hook to track map bounds
  function useReportBounds(
    onBoundsChange: ((bounds: [[number, number], [number, number]]) => void) | undefined,
  ) {
    const lastBoundsRef = React.useRef<string | null>(null);
    const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);
    const onBoundsChangeRef = React.useRef(onBoundsChange);
    React.useEffect(() => {
      onBoundsChangeRef.current = onBoundsChange;
    }, [onBoundsChange]);

    const handleBoundsChange = React.useCallback((map: L.Map) => {
      const bounds = map.getBounds();
      const sw: [number, number] = [bounds.getSouthWest().lat, bounds.getSouthWest().lng];
      const ne: [number, number] = [bounds.getNorthEast().lat, bounds.getNorthEast().lng];
      const boundsStr = `${sw[0].toFixed(4)},${sw[1].toFixed(4)},${ne[0].toFixed(4)},${ne[1].toFixed(4)}`;
      if (lastBoundsRef.current !== boundsStr) {
        lastBoundsRef.current = boundsStr;
        if (onBoundsChangeRef.current) {
          // Debounce: only report after map stops moving for 800ms
          if (debounceTimeout.current) {clearTimeout(debounceTimeout.current);}
          debounceTimeout.current = setTimeout(() => {
            onBoundsChangeRef.current && onBoundsChangeRef.current([sw, ne]);
          }, 800);
        }
      }
    }, []);

    useMapEvent('moveend', (e) => {
      handleBoundsChange(e.target);
    });

    React.useEffect(() => {
      return () => {
        if (debounceTimeout.current) {clearTimeout(debounceTimeout.current);}
      };
    }, []);
    // No return needed; this hook does not render anything.
  }
  // Component to use the hook in JSX
  const ReportBounds = ({
    onBoundsChange,
  }: {
    onBoundsChange?: (bounds: [[number, number], [number, number]]) => void;
  }) => {
    useReportBounds(onBoundsChange);
    return null;
  };

  if (!isClient) {
    return (
      <div className="h-96 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <div className="text-gray-600">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative z-10 h-full">
      {/* Map Layer Switcher - bottom-left, Google Maps style with thumbnails */}
      <div className="absolute bottom-8 left-4 z-50 group">
        {/* Collapsed: show current layer thumbnail */}
        <div className="relative">
          <button
            className="w-[40px] h-[40px] rounded-lg shadow-lg border-2 border-white overflow-hidden cursor-pointer hover:shadow-xl transition-shadow group-hover:opacity-0 group-hover:pointer-events-none"
            title={mapLayer === 'standard' ? 'Map' : mapLayer === 'terrain' ? 'Terrain' : 'Satellite'}
          >
            {mapLayer === 'standard' && (
              <div className="w-full h-full bg-[#e8e4d8] flex items-center justify-center">
                <Globe size={18} className="text-gray-600" />
              </div>
            )}
            {mapLayer === 'terrain' && (
              <div className="w-full h-full bg-[#d4cbb8] flex items-center justify-center">
                <Mountains size={18} className="text-gray-600" />
              </div>
            )}
            {mapLayer === 'satellite' && (
              <div className="w-full h-full bg-[#2d4a2d] flex items-center justify-center">
                <Planet size={18} className="text-white" />
              </div>
            )}
          </button>

          {/* Expanded: show all layer options on hover */}
          <div className="absolute bottom-0 left-0 flex gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 bg-white/95 backdrop-blur-sm rounded-lg p-1.5 shadow-xl border border-gray-200">
            <button
              onClick={() => setMapLayer('standard')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${mapLayer === 'standard' ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
            >
              <div className="w-[44px] h-[44px] rounded-lg overflow-hidden border border-gray-200">
                <div className="w-full h-full bg-[#e8e4d8] flex items-center justify-center">
                  <Globe size={16} className="text-gray-600" />
                </div>
              </div>
              <span className={`text-[9px] font-medium ${mapLayer === 'standard' ? 'text-blue-600' : 'text-gray-600'}`}>Map</span>
            </button>
            <button
              onClick={() => setMapLayer('terrain')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${mapLayer === 'terrain' ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
            >
              <div className="w-[44px] h-[44px] rounded-lg overflow-hidden border border-gray-200">
                <div className="w-full h-full bg-[#d4cbb8] flex items-center justify-center">
                  <Mountains size={16} className="text-gray-600" />
                </div>
              </div>
              <span className={`text-[9px] font-medium ${mapLayer === 'terrain' ? 'text-blue-600' : 'text-gray-600'}`}>Terrain</span>
            </button>
            <button
              onClick={() => setMapLayer('satellite')}
              className={`flex flex-col items-center gap-0.5 cursor-pointer ${mapLayer === 'satellite' ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}
            >
              <div className="w-[44px] h-[44px] rounded-lg overflow-hidden border border-gray-200">
                <div className="w-full h-full bg-[#2d4a2d] flex items-center justify-center">
                  <Planet size={16} className="text-white" />
                </div>
              </div>
              <span className={`text-[9px] font-medium ${mapLayer === 'satellite' ? 'text-blue-600' : 'text-gray-600'}`}>Satellite</span>
            </button>
          </div>
        </div>
      </div>

      {/* Zoom Controls - positioned outside map container */
      /* Time Explorer button moved to tools page top-right toolbar */}
      <div className="absolute bottom-8 right-4 z-50 bg-white rounded-md shadow-lg w-8 border border-gray-200">
        <div className="flex flex-col">
          <button
            onClick={() => {
              if (mapInstance) {
                mapInstance.setView([25.0, 0.0], 2, { animate: true });
              }
              if (onResetMap) {
                onResetMap();
              }
            }}
            className="h-8 text-gray-700 hover:bg-gray-100 rounded-t-md transition-colors border-b border-gray-200 flex items-center justify-center"
            title="Reset map"
            aria-label="Reset map"
          >
            <ArrowsOutSimple size={14} />
          </button>
          <button
            onClick={() => {
              if (mapInstance) {
                mapInstance.zoomIn();
              }
            }}
            className="h-8 text-gray-700 hover:bg-gray-100 transition-colors border-b border-gray-200 flex items-center justify-center font-black text-xl"
            title="Zoom in"
          >
            +
          </button>
          <button
            onClick={() => {
              if (mapInstance) {
                mapInstance.zoomOut();
              }
            }}
            className="h-8 text-gray-700 hover:bg-gray-100 rounded-b-md transition-colors flex items-center justify-center font-black text-xl"
            title="Zoom out"
          >
            -
          </button>
        </div>
      </div>

      <MapContainer
        center={[25.0, 0.0]}
        zoom={2}
        minZoom={2}
        maxBounds={[
          [-90, -180],
          [90, 180],
        ]}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        style={{ width: '100%', zIndex: 1 }}
        className="rounded-lg shadow-lg h-full relative z-10"
      >
        <MapInstanceCapture setMapInstance={setMapInstance} />
        {/* Report bounds to parent */}
        {typeof onBoundsChange === 'function' && <ReportBounds onBoundsChange={onBoundsChange} />}
        <TileLayer
          key={mapLayer} // Force re-render when layer changes
          attribution={mapLayers[mapLayer].attribution}
          url={mapLayers[mapLayer].url}
        />

        {/* Heatmap Layer */}
        {showHeatmap && heatmapPoints.length > 0 && <SimpleHeatmapLayer points={heatmapPoints} />}

        {/* Markers/Clusters - hidden when heatmap is active for better visualization */}
        {!showHeatmap &&
          (enableClustering
            ? // Render clusters
              clusters.map((cluster) => {
                if (cluster.count === 1) {
                  // Single occurrence - render as normal marker
                  const occurrence = cluster.occurrences[0];
                  return (
                    <Marker
                      key={occurrence.key}
                      position={[occurrence.decimalLatitude!, occurrence.decimalLongitude!]}
                      icon={defaultIcon}
                    >
                      <Popup autoPan={false}>
                        <div
                          className="p-1.5 min-w-[200px] max-w-[300px] max-h-[340px] overflow-y-auto"
                          style={{ boxSizing: 'border-box' }}
                        >
                          {/* Image at the top, square, spinner while loading */}
                          <ImageWithSpinner
                            src={
                              occurrence.media &&
                              Array.isArray(occurrence.media) &&
                              occurrence.media.length > 0
                                ? occurrence.media[0].identifier
                                : undefined
                            }
                            enableFullscreen={true}
                          />
                          <h3 className="font-bold text-sm mb-0.5 text-center">
                            {occurrence.species || occurrence.scientificName || 'Unknown species'}
                          </h3>
                          <div className="space-y-0.5">
                            <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                              <span className="font-semibold">Location:</span>{' '}
                              {occurrence.decimalLatitude?.toFixed(4)},{' '}
                              {occurrence.decimalLongitude?.toFixed(4)}
                            </p>
                            {occurrence.eventDate && (
                              <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                                <span className="font-semibold">Date:</span>{' '}
                                {new Date(occurrence.eventDate).toLocaleDateString()}
                              </p>
                            )}
                            {occurrence.country && (
                              <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                                <span className="font-semibold">Country:</span> {occurrence.country}
                              </p>
                            )}
                            {occurrence.recordedBy && (
                              <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                                <span className="font-semibold">Recorded by:</span>{' '}
                                {occurrence.recordedBy}
                              </p>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                } else {
                  // Multiple occurrences - render as cluster
                  return (
                    <Marker
                      key={cluster.id}
                      position={[cluster.lat, cluster.lng]}
                      icon={createClusterIcon(cluster.count)}
                    >
                      <Popup autoPan={false}>
                        <div className="p-2">
                          <h3 className="font-bold text-lg mb-2">
                            Cluster of {cluster.count} occurrences
                          </h3>
                          <div className="max-h-48 overflow-y-auto">
                            {cluster.occurrences.slice(0, 10).map((occurrence, index) => (
                              <div
                                key={occurrence.key || index}
                                className="mb-2 pb-2 border-b border-gray-200 last:border-b-0"
                              >
                                <p className="font-medium text-sm">
                                  {occurrence.species ||
                                    occurrence.scientificName ||
                                    'Unknown species'}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {occurrence.decimalLatitude?.toFixed(4)},{' '}
                                  {occurrence.decimalLongitude?.toFixed(4)}
                                </p>
                                {occurrence.eventDate && (
                                  <p className="text-xs text-gray-600">
                                    {new Date(occurrence.eventDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            ))}
                            {cluster.count > 10 && (
                              <p className="text-xs text-gray-500 italic">
                                and {cluster.count - 10} more occurrences...
                              </p>
                            )}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                }
              })
            : // Render individual markers
              validOccurrences.map((occurrence) => (
                <Marker
                  key={occurrence.key}
                  position={[occurrence.decimalLatitude!, occurrence.decimalLongitude!]}
                  icon={defaultIcon}
                >
                  <Popup autoPan={false}>
                    <div
                      className="p-1.5 min-w-[200px] max-w-[300px] max-h-[340px] overflow-y-auto"
                      style={{ boxSizing: 'border-box' }}
                    >
                      {/* Image at the top, square, spinner while loading */}
                      <ImageWithSpinner
                        src={
                          occurrence.media &&
                          Array.isArray(occurrence.media) &&
                          occurrence.media.length > 0
                            ? occurrence.media[0].identifier
                            : undefined
                        }
                        enableFullscreen={true}
                      />
                      <h3 className="font-bold text-sm mb-0.5 text-center">
                        {occurrence.species || occurrence.scientificName || 'Unknown species'}
                      </h3>
                      <div className="space-y-0.5">
                        <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                          <span className="font-semibold">Location:</span>{' '}
                          {occurrence.decimalLatitude?.toFixed(4)},{' '}
                          {occurrence.decimalLongitude?.toFixed(4)}
                        </p>
                        {occurrence.eventDate && (
                          <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                            <span className="font-semibold">Date:</span>{' '}
                            {new Date(occurrence.eventDate).toLocaleDateString()}
                          </p>
                        )}
                        {occurrence.country && (
                          <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                            <span className="font-semibold">Country:</span> {occurrence.country}
                          </p>
                        )}
                        {occurrence.recordedBy && (
                          <p className="text-xs text-gray-700 flex flex-row gap-1 items-center">
                            <span className="font-semibold">Recorded by:</span>{' '}
                            {occurrence.recordedBy}
                          </p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )))}

        {/* Corridor overlays — smooth curves between core areas */}
        {corridors.map((corridor) => {
          // Skip corridors rated "unlikely" — ecologically meaningless
          const viability = (corridor as any).viability;
          if (viability?.rating === 'unlikely') return null;

          // Smooth the raw grid path into a natural-looking curve
          const rawPositions = corridor.path.map(([lng, lat]) => [lat, lng] as [number, number]);
          const smoothed = smoothPath(rawPositions, 3);
          // Color based on viability assessment
          const mainColor = !viability ? '#f59e0b' :
            viability.rating === 'optimal' ? '#10b981' :
            viability.rating === 'feasible' ? '#3b82f6' :
            viability.rating === 'marginal' ? '#f59e0b' : '#ef4444';
          const glowColor = !viability ? '#fbbf24' :
            viability.rating === 'optimal' ? '#6ee7b7' :
            viability.rating === 'feasible' ? '#93c5fd' :
            viability.rating === 'marginal' ? '#fbbf24' : '#fca5a5';
          return (
            <React.Fragment key={`corridor-${corridor.id}`}>
              {/* Corridor glow/outline */}
              <Polyline
                positions={smoothed}
                pathOptions={{
                  color: glowColor,
                  weight: 10,
                  opacity: 0.25,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Corridor main line */}
              <Polyline
                positions={smoothed}
                pathOptions={{
                  color: mainColor,
                  weight: 4,
                  opacity: 0.85,
                  lineCap: 'round',
                  lineJoin: 'round',
                  dashArray: viability?.rating === 'marginal' ? '8 6' : undefined,
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Core area overlays */}
        {coreAreas.map((area) => (
          <CircleMarker
            key={`core-${area.id}`}
            center={[area.lat, area.lng]}
            radius={12 + Math.min(area.occurrenceCount, 10)}
            pathOptions={{
              color: area.protectedArea ? '#059669' : '#10b981',
              fillColor: area.protectedArea ? '#059669' : '#10b981',
              fillOpacity: area.protectedArea ? 0.4 : 0.3,
              weight: area.protectedArea ? 3 : 2,
              dashArray: area.protectedArea ? '4 4' : undefined,
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">
                  {area.protectedArea ? area.protectedArea.name : `Core Area ${area.id + 1}`}
                </p>
                {area.protectedArea && (
                  <p className="text-emerald-600">{area.protectedArea.designationType.replace(/_/g, ' ')}</p>
                )}
                <p>{area.occurrenceCount > 0 ? `${area.occurrenceCount} observations` : 'Official protected area'}</p>
                <p className="text-gray-500">{area.lat.toFixed(3)}, {area.lng.toFixed(3)}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Stepping stone overlays */}
        {steppingStones.filter(s => s.withinRange).map((stone, i) => (
          <CircleMarker
            key={`stone-${i}`}
            center={[stone.lat, stone.lng]}
            radius={5}
            pathOptions={{
              color: '#8b5cf6',
              fillColor: '#8b5cf6',
              fillOpacity: 0.5,
              weight: 1.5,
            }}
          >
            <Popup>
              <div className="text-xs">
                <p className="font-semibold text-purple-700">Stepping Stone</p>
                <p>Intermediate habitat patch</p>
                <p className="text-gray-500">{stone.distanceToCorridorKm.toFixed(1)} km from corridor</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Highlighted point marker */}
        {highlightedPoint && (
          <Marker
            position={[highlightedPoint.lat, highlightedPoint.lng]}
            icon={defaultIcon}
          >
            <Popup>
              <div className="text-xs max-w-[200px]">
                {highlightedPoint.image && (
                  <img
                    src={highlightedPoint.image}
                    alt={highlightedPoint.label || ''}
                    className="w-full h-24 object-cover rounded mb-1.5"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                {highlightedPoint.label && <p className="font-semibold">{highlightedPoint.label}</p>}
                <p className="text-gray-500">{highlightedPoint.lat.toFixed(5)}, {highlightedPoint.lng.toFixed(5)}</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
      {/* GBIF credits overlay — visible only when occurrences are loaded */}
      {occurrences.length > 0 && (
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded px-3 py-1 text-[10px] text-gray-500 shadow-sm border border-gray-200/50">
            Data: <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700 font-medium">GBIF.org</a>
            {' · '}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">CC BY 4.0</a>
          </div>
        </div>
      )}
      {/* Attribution CSS override for bottom/right margin and cluster styles */}
      <style>{`
        .leaflet-control-attribution {
          bottom: 2px !important;
          right: 2px !important;
        }
        .custom-cluster-small {
          background-color: rgba(59, 130, 246, 0.8);
          border: 2px solid rgba(59, 130, 246, 1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
        }
        .custom-cluster-medium {
          background-color: rgba(234, 179, 8, 0.8);
          border: 2px solid rgba(234, 179, 8, 1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
        }
        .custom-cluster-large {
          background-color: rgba(239, 68, 68, 0.8);
          border: 2px solid rgba(239, 68, 68, 1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          text-shadow: 1px 1px 1px rgba(0,0,0,0.5);
        }
        .cluster-inner {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
}
