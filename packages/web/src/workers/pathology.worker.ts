/**
 * Web Worker for plant pathology detection using ONNX Runtime.
 * Runs inference in a background thread to keep UI responsive.
 */

import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;

const CLASS_NAMES: string[] = [
  'Apple___Apple_scab',
  'Apple___Black_rot',
  'Apple___Cedar_apple_rust',
  'Apple___Healthy',
  'Blueberry___Healthy',
  'Cherry_(including_sour)___Powdery_mildew',
  'Cherry_(including_sour)___Healthy',
  'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
  'Corn_(maize)___Common_rust_',
  'Corn_(maize)___Northern_Leaf_Blight',
  'Corn_(maize)___Healthy',
  'Grape___Black_rot',
  'Grape___Esca_(Black_Measles)',
  'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
  'Grape___Healthy',
  'Orange___Haunglongbing_(Citrus_greening)',
  'Peach___Bacterial_spot',
  'Peach___Healthy',
  'Pepper,_bell___Bacterial_spot',
  'Pepper,_bell___Healthy',
  'Potato___Early_blight',
  'Potato___Late_blight',
  'Potato___Healthy',
  'Raspberry___Healthy',
  'Soybean___Healthy',
  'Squash___Powdery_mildew',
  'Strawberry___Leaf_scorch',
  'Strawberry___Healthy',
  'Tomato___Bacterial_spot',
  'Tomato___Early_blight',
  'Tomato___Late_blight',
  'Tomato___Leaf_Mold',
  'Tomato___Septoria_leaf_spot',
  'Tomato___Spider_mites Two-spotted_spider_mite',
  'Tomato___Target_Spot',
  'Tomato___Tomato_Yellow_Leaf_Curl_Virus',
  'Tomato___Tomato_mosaic_virus',
  'Tomato___Healthy',
];

function parseClassName(className: string) {
  const parts = className.split('___');
  const crop = (parts[0] || '').replace(/_/g, ' ').replace(/\(.*?\)/g, '').trim();
  const condition = (parts[1] || '').replace(/_/g, ' ').trim();
  const isHealthy = condition.toLowerCase() === 'healthy';
  return { crop, condition, isHealthy };
}

function getSeverity(confidence: number, isHealthy: boolean): string {
  if (isHealthy) return 'healthy';
  if (confidence >= 0.8) return 'critical';
  if (confidence >= 0.6) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

async function preprocessImage(data: ArrayBuffer): Promise<Float32Array> {
  const blob = new Blob([data]);
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(224, 224);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get OffscreenCanvas context');

  ctx.drawImage(bitmap, 0, 0, 224, 224);
  const imageData = ctx.getImageData(0, 0, 224, 224);
  const pixels = imageData.data;

  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const tensor = new Float32Array(3 * 224 * 224);

  for (let i = 0; i < 224 * 224; i++) {
    for (let c = 0; c < 3; c++) {
      const pixel = pixels[i * 4 + c] / 255.0;
      tensor[c * 224 * 224 + i] = (pixel - mean[c]) / std[c];
    }
  }

  return tensor;
}

let session: ort.InferenceSession | null = null;

async function loadModel(): Promise<ort.InferenceSession> {
  if (session) return session;

  const response = await fetch('/models/plant-pathology.onnx');
  const modelBuffer = await response.arrayBuffer();
  session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  return session;
}

interface WorkerMessage {
  type: 'detect';
  imageData: ArrayBuffer;
  topK: number;
}

interface WorkerResponse {
  type: 'result';
  results: Array<{
    className: string;
    commonName: string;
    crop: string;
    isHealthy: boolean;
    confidence: number;
    severity: string;
  }>;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, imageData, topK } = event.data;

  if (type !== 'detect') return;

  try {
    const sess = await loadModel();
    const tensorData = await preprocessImage(imageData);

    const input = new ort.Tensor('float32', tensorData, [1, 3, 224, 224]);
    const output = await sess.run({ input });
    const probabilities = output.output.data;
    const probs = Float32Array.from(probabilities as any);

    const results: WorkerResponse['results'] = [];
    for (let i = 0; i < CLASS_NAMES.length; i++) {
      const confidence = probs[i];
      const { crop, condition, isHealthy } = parseClassName(CLASS_NAMES[i]);
      results.push({
        className: CLASS_NAMES[i],
        commonName: condition,
        crop,
        isHealthy,
        confidence,
        severity: getSeverity(confidence, isHealthy),
      });
    }

    results.sort((a, b) => b.confidence - a.confidence);

    const response: WorkerResponse = {
      type: 'result',
      results: results.slice(0, topK),
    };

    self.postMessage(response);
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown inference error',
    });
  }
};

export {};
