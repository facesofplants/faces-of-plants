declare module 'react-leaflet-heatmap-layer' {
  import { type LatLngTuple } from 'leaflet';
  import { type ComponentType } from 'react';

  export interface HeatmapLayerProps {
    points: LatLngTuple[] | Array<[number, number, number]>;
    longitudeExtractor?: (point: unknown) => number;
    latitudeExtractor?: (point: unknown) => number;
    intensityExtractor?: (point: unknown) => number;
    fitBoundsOnLoad?: boolean;
    fitBoundsOnUpdate?: boolean;
    radius?: number;
    blur?: number;
    maxZoom?: number;
    max?: number;
    minOpacity?: number;
    gradient?: Record<string, string>;
  }

  export const HeatmapLayer: ComponentType<HeatmapLayerProps>;
}
