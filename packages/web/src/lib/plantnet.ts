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
 * Resize/compress image to fit Pl@ntNet API limits.
 * Target: max 1500px on longest side, JPEG quality 0.8, under 500KB.
 */
async function compressImage(file: File): Promise<File> {
  // If already small enough, send as-is
  if (file.size <= 500 * 1024) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1500;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.8
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Identify a plant from an image file.
 * Uses server-side proxy at /api/plantnet.
 */
export async function identifyPlant(
  imageFile: File,
): Promise<PlantIdentification[]> {
  const compressed = await compressImage(imageFile);
  const formData = new FormData();
  formData.append('images', compressed);
  formData.append('organs', 'auto');

  const response = await fetch('/api/plantnet', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const status = response.status;
    if (status === 404) {
      throw new Error('Nessuna pianta riconosciuta. Prova con un primo piano di foglie, fiori o frutti.');
    }
    if (status === 413) {
      throw new Error('Immagine troppo grande. Prova con una foto più piccola.');
    }
    throw new Error(errorData?.error || `Pl@ntNet API error: ${status}`);
  }

  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    throw new Error('Nessuna corrispondenza trovata. Prova con un\'immagine più ravvicinata della pianta.');
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
