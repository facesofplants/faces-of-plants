import { NextResponse } from 'next/server';

const dataSources = [
  { id: 'gbif', name: 'GBIF', type: 'gbif', isActive: true, endpoint: 'https://api.gbif.org/v1' },
  { id: 'eol', name: 'Encyclopedia of Life', type: 'eol', isActive: true, endpoint: 'https://eol.org/api' },
  { id: 'inaturalist', name: 'iNaturalist', type: 'inaturalist', isActive: true, endpoint: 'https://api.inaturalist.org/v1' },
];

export async function GET() {
  return NextResponse.json(dataSources);
}