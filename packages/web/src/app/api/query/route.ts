import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, userType, filters } = await request.json();

    // For now, return a mock response since the backend isn't deployed yet
    const mockResults = {
      query,
      userType,
      results: [
        {
          key: 1,
          scientificName: 'Quercus alba',
          kingdom: 'Plantae',
          phylum: 'Tracheophyta',
          class: 'Magnoliopsida',
          order: 'Fagales',
          family: 'Fagaceae',
          genus: 'Quercus',
          species: 'alba',
          decimalLatitude: 40.7128,
          decimalLongitude: -74.006,
          country: 'United States',
          stateProvince: 'New York',
          locality: 'Central Park',
          eventDate: '2023-06-15',
          basisOfRecord: 'HUMAN_OBSERVATION',
          institutionCode: 'GBIF',
        },
        {
          key: 2,
          scientificName: 'Acer rubrum',
          kingdom: 'Plantae',
          phylum: 'Tracheophyta',
          class: 'Magnoliopsida',
          order: 'Sapindales',
          family: 'Sapindaceae',
          genus: 'Acer',
          species: 'rubrum',
          decimalLatitude: 42.3601,
          decimalLongitude: -71.0589,
          country: 'United States',
          stateProvince: 'Massachusetts',
          locality: 'Boston Common',
          eventDate: '2023-10-12',
          basisOfRecord: 'HUMAN_OBSERVATION',
          institutionCode: 'GBIF',
        },
      ],
      count: 2,
      endOfRecords: true,
      searchParams: {
        q: query,
        limit: userType === 'researcher' ? 100 : 20,
        hasCoordinate: true,
        hasGeospatialIssue: false,
        ...filters,
      },
    };

    return NextResponse.json(mockResults);
  } catch (error) {
    console.error('API Query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
