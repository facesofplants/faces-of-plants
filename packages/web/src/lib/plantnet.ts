/**
 * Plant recognition using Pl@ntNet API.
 * Calls our server-side proxy to avoid CORS issues.
 */

export interface PlantNetResult {
  score: number;
  species: {
    scientificNameWithoutAuthor: string;
    scientificNameAuthorship: string;
    scientificName: string;
    commonNames: Array<{ value: string; lang: string }>;
    genus: { scientificNameWithoutAuthor: string };
    family: { scientificNameWithoutAuthor: string };
  };
  gbif?: {
    id: number;
    citation: string;
    url: string;
  };
}

export interface PlantIdentification {
  species: string;
  scientificName: string;
  commonName: string;
  family: string;
  genus: string;
  confidence: number;
  gbifId?: number;
  allResults: PlantNetResult[];
}

/**
 * Identify a plant from an image file.
 * Uses server-side proxy at /api/plantnet.
 */
export async function identifyPlant(
  imageFile: File,
  apiKey: string,
): Promise<PlantIdentification[]> {
  const formData = new FormData();
  formData.append('images', imageFile);
  formData.append('organs', 'auto');
  formData.append('api-key', apiKey);

  const response = await fetch('/api/plantnet', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Pl@ntNet API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    return [];
  }

  return data.results.map((result: PlantNetResult) => ({
    species: result.species.scientificNameWithoutAuthor,
    scientificName: result.species.scientificName,
    commonName: result.species.commonNames?.[0]?.value || 'No common name',
    family: result.species.family.scientificNameWithoutAuthor,
    genus: result.species.genus.scientificNameWithoutAuthor,
    confidence: result.score,
    gbifId: result.gbif?.id,
    allResults: data.results,
  }));
}

/**
 * Validate image file before upload.
 */
export function validateImageFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPEG, PNG, or WebP.',
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 10MB.',
    };
  }

  return { valid: true };
}

/**
 * Convert File to base64 data URL (for preview).
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
