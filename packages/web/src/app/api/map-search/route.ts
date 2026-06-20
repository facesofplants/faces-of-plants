import { type NextRequest, NextResponse } from 'next/server';

import type { GBIFSearchParams, GBIFOccurrence } from '@faces-of-plants/core/src/types';

import { GBIFClient } from '../../../../../functions/gbif/client';

const gbifClient = new GBIFClient();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      species,
      country,
      hasCoordinate,
      limit,
      // Advanced filters
      basisOfRecord,
      countries,
      dateRange,
      elevationRange,
      selectedHabitats,
      boundingBox,
    } = body;

    // Build search parameters
    const searchParams: GBIFSearchParams = {
      hasCoordinate: hasCoordinate ?? true, // Default to true for map display
      limit: limit || 200,
    };

    // Add species search
    if (species) {
      searchParams.q = species;
    }

    // Add country filter (single country from legacy API)
    if (country) {
      searchParams.country = country;
    }

    // Add advanced filters
    if (basisOfRecord && basisOfRecord.length > 0) {
      // GBIF API supports multiple basis of record values
      searchParams.basisOfRecord = basisOfRecord.join(',');
    }

    // Countries filter (multiple countries from advanced filters)
    if (countries && countries.length > 0) {
      searchParams.country = countries.join(',');
    }

    // Date range filter
    if (dateRange?.start && dateRange?.end) {
      const startYear = new Date(dateRange.start).getFullYear();
      const endYear = new Date(dateRange.end).getFullYear();

      // Use year range if same year, otherwise individual years
      if (startYear === endYear) {
        searchParams.year = startYear.toString();
      } else {
        searchParams.year = `${startYear},${endYear}`;
      }
    }

    // Add image filter
    if (body.hasImage) {
      searchParams.mediaType = 'StillImage';
    }

    // Note: GBIF API doesn't directly support elevation or habitat filters
    // These would need to be filtered client-side or require additional API calls

    console.log('[MAP-SEARCH] Search parameters:', searchParams);

    // Call GBIF API
    const result = await gbifClient.searchOccurrences(searchParams);

    console.log(`[MAP-SEARCH] Found ${result.results.length} occurrences`);

    // Filter for valid coordinates and bounding box
    let validOccurrences = result.results.filter(
      (occurrence: GBIFOccurrence) =>
        occurrence.decimalLatitude &&
        occurrence.decimalLongitude &&
        Math.abs(occurrence.decimalLatitude) <= 90 &&
        Math.abs(occurrence.decimalLongitude) <= 180,
    );

    // If boundingBox is provided, filter occurrences within the bounding box
    // boundingBox: [[southWestLat, southWestLng], [northEastLat, northEastLng]]
    if (boundingBox && Array.isArray(boundingBox) && boundingBox.length === 2) {
      const [[swLat, swLng], [neLat, neLng]] = boundingBox;
      validOccurrences = validOccurrences.filter((occ: GBIFOccurrence) => {
        const lat = occ.decimalLatitude;
        const lng = occ.decimalLongitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') {return false;}
        // Handle antimeridian crossing
        const inLat = lat >= swLat && lat <= neLat;
        let inLng = false;
        if (swLng <= neLng) {
          inLng = lng >= swLng && lng <= neLng;
        } else {
          // Bounding box crosses the antimeridian
          inLng = lng >= swLng || lng <= neLng;
        }
        return inLat && inLng;
      });
    }

    // Apply client-side filters for parameters not supported by GBIF API
    if (elevationRange?.min !== undefined || elevationRange?.max !== undefined) {
      // Note: GBIF API doesn't provide elevation data in occurrence records
      // This would require additional data sources or elevation lookup services
      console.log('[MAP-SEARCH] Elevation filtering requested but not available in GBIF data');
    }

    if (selectedHabitats && selectedHabitats.length > 0) {
      // Note: GBIF API doesn't provide habitat data in standard occurrence records
      // This would require additional taxonomic or ecological databases
      console.log('[MAP-SEARCH] Habitat filtering requested but not available in GBIF data');
    }

    console.log(`[MAP-SEARCH] Valid occurrences with coordinates: ${validOccurrences.length}`);

    return NextResponse.json({
      success: true,
      data: {
        results: validOccurrences,
        count: result.count,
        endOfRecords: result.endOfRecords,
        totalFound: result.results.length,
        validCoordinates: validOccurrences.length,
        appliedFilters: {
          basisOfRecord: basisOfRecord?.length > 0,
          countries: countries?.length > 0,
          dateRange: !!(dateRange?.start && dateRange?.end),
          elevationRange: !!(
            elevationRange?.min !== undefined || elevationRange?.max !== undefined
          ),
          selectedHabitats: selectedHabitats?.length > 0,
        },
      },
    });
  } catch (error) {
    console.error('[MAP-SEARCH] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        data: null,
      },
      { status: 500 },
    );
  }
}
