'use client';

import {
  Download,
  Globe,
  Mountains,
  Planet,
  Funnel,
  CirclesFour,
  ChartBar,
  Clock,
  ArrowsOutSimple,
  X,
} from '@phosphor-icons/react';
import { Icon, divIcon, icon as leafletIcon } from 'leaflet';
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvent } from 'react-leaflet';

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
}: InteractiveMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'terrain' | 'satellite'>('standard');

  // Ensure map only renders on client
  useEffect(() => {
    setIsClient(true);
  }, []);

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
    const ignoreNextRef = React.useRef(false);
    const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null);
    const onBoundsChangeRef = React.useRef(onBoundsChange);
    React.useEffect(() => {
      onBoundsChangeRef.current = onBoundsChange;
    }, [onBoundsChange]);

    const handleBoundsChange = React.useCallback((map: L.Map) => {
      if (ignoreNextRef.current) {
        ignoreNextRef.current = false;
        return;
      }
      const bounds = map.getBounds();
      const sw: [number, number] = [bounds.getSouthWest().lat, bounds.getSouthWest().lng];
      const ne: [number, number] = [bounds.getNorthEast().lat, bounds.getNorthEast().lng];
      const boundsStr = `${sw[0]},${sw[1]},${ne[0]},${ne[1]}`;
      if (lastBoundsRef.current !== boundsStr) {
        lastBoundsRef.current = boundsStr;
        if (onBoundsChangeRef.current) {
          if (debounceTimeout.current) {clearTimeout(debounceTimeout.current);}
          debounceTimeout.current = setTimeout(() => {
            onBoundsChangeRef.current && onBoundsChangeRef.current([sw, ne]);
          }, 100);
        }
      }
    }, []);

    useMapEvent('moveend', (e) => {
      handleBoundsChange(e.target);
    });
    useMapEvent('zoomend', (e) => {
      handleBoundsChange(e.target);
    });
    useMapEvent('movestart', () => {
      if (
        typeof window !== 'undefined' &&
        document.activeElement &&
        document.activeElement.tagName === 'BODY'
      ) {
        ignoreNextRef.current = false;
      } else {
        ignoreNextRef.current = true;
      }
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
    <div className="relative z-10">
      {/* Top-left controls area */}
      <div className="absolute top-4 left-4 z-40 flex items-start space-x-2">
        {/* Map Layer Switcher - vertical */}
        <div className="flex flex-col space-y-1">
          <button
            onClick={() => setMapLayer('standard')}
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
              mapLayer === 'standard'
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
            }`}
            title="Standard Map"
          >
            <Globe size={20} />
          </button>
          <button
            onClick={() => setMapLayer('terrain')}
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
              mapLayer === 'terrain'
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
            }`}
            title="Terrain Map"
          >
            <Mountains size={20} />
          </button>
          <button
            onClick={() => setMapLayer('satellite')}
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
              mapLayer === 'satellite'
                ? 'bg-blue-500 text-white border-blue-600'
                : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
            }`}
            title="Satellite Map"
          >
            <Planet size={20} />
          </button>
        </div>

        {/* Map Controls - horizontal */}
        <div className="flex items-center space-x-1 relative">
          <button
            onClick={() => onShowAdvancedFilters && onShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
              showAdvancedFilters
                ? `${theme === 'light' ? 'bg-blue-600 text-white border-blue-700' : 'bg-blue-400 text-white border-blue-500'} ring-2 ring-blue-400`
                : filters &&
                    Object.keys(filters).some((key) => {
                      const value = filters[key as keyof typeof filters];
                      return Array.isArray(value) ? value.length > 0 : value !== undefined;
                    })
                  ? `${theme === 'light' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-blue-900/50 text-blue-300 border-blue-700'} backdrop-blur-sm`
                  : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
            }`}
            title="Filters"
            aria-pressed={showAdvancedFilters}
          >
            <Funnel size={16} />
          </button>
          {/* Advanced Filters Panel - positioned below filter icon, right of terrain switcher */}
          {showAdvancedFilters && setFilters && (
            <div
              className={`absolute left-0 top-[56px] z-[1200] transition-all duration-200`}
              style={{
                transform: 'translateX(0)', // align horizontally with the filter icon
                minWidth: 320,
                maxWidth: 380,
                height: 340,
              }}
              aria-hidden={!showAdvancedFilters}
            >
              <div
                className="shadow-2xl rounded-xl border border-gray-200 bg-white/95 dark:bg-gray-900/95 p-4 max-h-full overflow-y-auto flex flex-col"
                style={{ height: '100%' }}
              >
                <AdvancedFilters
                  isOpen={true}
                  onClose={() => onShowAdvancedFilters && onShowAdvancedFilters(false)}
                  onFiltersChange={setFilters}
                  currentFilters={filters as FilterState}
                  compact
                />
              </div>
            </div>
          )}
          <button
            onClick={() => onEnableClusteringChange && onEnableClusteringChange(!enableClustering)}
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
              enableClustering
                ? `${theme === 'light' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-purple-900/50 text-purple-300 border-purple-700'} backdrop-blur-sm`
                : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
            }`}
            title="Clustering"
          >
            <CirclesFour size={16} />
          </button>

          <button
            onClick={() => onShowHeatmapChange && onShowHeatmapChange(!showHeatmap)}
            className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
              showHeatmap
                ? `${theme === 'light' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-orange-900/50 text-orange-300 border-orange-700'} backdrop-blur-sm`
                : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
            }`}
            title="Heatmap"
          >
            <ChartBar size={16} />
          </button>
        </div>
      </div>

      {/* Combined Occurrence Count & Export Button - top-right */}
      <div className="absolute top-4 right-4 z-40 w-48">
        <button
          onClick={() =>
            exportToCSV(
              validOccurrences,
              `species-occurrences-${new Date().toISOString().split('T')[0]}.csv`,
            )
          }
          disabled={validOccurrences.length === 0 || loading}
          className={`w-full flex items-center justify-center space-x-2 px-3 py-2 h-12 rounded-lg transition-all shadow-lg bg-white/90 backdrop-blur-sm border border-gray-200 ${
            validOccurrences.length > 0 && !loading
              ? 'hover:bg-gray-50 text-gray-700 hover:shadow-md cursor-pointer'
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title="Export occurrence data as CSV"
        >
          <span className="text-sm font-medium text-center flex-1">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 mr-1 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
                Loading...
              </span>
            ) : (
              <>
                {validOccurrences.length} occurrence{validOccurrences.length !== 1 ? 's' : ''}
              </>
            )}
          </span>
          <Download size={16} className="flex-shrink-0" />
        </button>
      </div>

      {/* Heatmap Legend - positioned below the combined button */}
      {showHeatmap && (
        <div
          className="absolute right-4 z-40 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg w-48"
          style={{ top: '68px' }}
        >
          <div className="text-sm font-medium text-gray-800 mb-2 text-center">Density Scale</div>
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Low</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>↑</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>↑</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              <span>↑</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 rounded-full bg-pink-600"></div>
              <span>High</span>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Controls - positioned outside map container */}
      <div className="absolute bottom-8 right-4 z-50 bg-white rounded-lg shadow-lg w-12 border border-gray-200">
        <div className="flex flex-col">
          <button
            onClick={() => {
              if (mapInstance) {
                mapInstance.zoomIn();
              }
            }}
            className="h-12 text-gray-700 hover:bg-gray-100 rounded-t-lg transition-colors border-b border-gray-200 flex items-center justify-center font-black text-xl"
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
            className="h-12 text-gray-700 hover:bg-gray-100 rounded-b-lg transition-colors flex items-center justify-center font-black text-xl"
            title="Zoom out"
          >
            -
          </button>
        </div>
      </div>

      {/* Time Explorer Button - positioned at bottom-left */}
      <div className="absolute bottom-8 left-4 z-50">
        <button
          onClick={() =>
            onShowTemporalSliderChange && onShowTemporalSliderChange(!showTemporalSlider)
          }
          className={`flex items-center justify-center w-12 h-12 rounded-lg transition-colors shadow-lg border ${
            showTemporalSlider
              ? `${theme === 'light' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-green-900/50 text-green-300 border-green-700'} backdrop-blur-sm`
              : 'bg-white/90 text-gray-700 hover:bg-gray-100 border-gray-200 backdrop-blur-sm'
          }`}
          title="Time Explorer"
        >
          <Clock size={16} />
        </button>
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
        className="rounded-lg shadow-lg h-[400px] sm:h-[500px] lg:h-[600px] xl:h-[700px] 2xl:h-[800px] relative z-10"
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
                          className="p-2 min-w-[220px] max-w-[320px] max-h-[340px] overflow-y-auto"
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
                          <h3 className="font-bold text-base mb-1 text-center">
                            {occurrence.species || occurrence.scientificName || 'Unknown species'}
                          </h3>
                          <div className="space-y-1">
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
                      className="p-2 min-w-[220px] max-w-[320px] max-h-[340px] overflow-y-auto"
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
                      <h3 className="font-bold text-base mb-1 text-center">
                        {occurrence.species || occurrence.scientificName || 'Unknown species'}
                      </h3>
                      <div className="space-y-1">
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
      </MapContainer>
      <div className="flex items-center justify-between px-2 py-1 text-xs text-gray-400 bg-gray-50/80 border-t border-gray-100">
        <span>Biodiversity data provided by <a href="https://www.gbif.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600 font-medium">GBIF.org</a></span>
        <span>License: <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">CC BY 4.0</a></span>
      </div>
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
