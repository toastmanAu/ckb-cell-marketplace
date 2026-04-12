/** Options for image processing */
export interface ImageProcessOptions {
  maxDimension: number;    // max width or height in pixels
  format: 'jpeg' | 'webp' | 'png';
  quality: number;         // 0.0 - 1.0 (only applies to jpeg/webp)
}

const FORMAT_MIME: Record<ImageProcessOptions['format'], string> = {
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  png: 'image/png',
};

/**
 * Load an image from bytes into an HTMLImageElement.
 * Works in browser only (uses createObjectURL).
 */
function loadImage(bytes: Uint8Array, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Process an image: resize to maxDimension, convert format, adjust quality.
 * Returns the processed image as Uint8Array and the output MIME type.
 */
export async function processImage(
  input: Uint8Array,
  inputMime: string,
  opts: ImageProcessOptions,
): Promise<{ data: Uint8Array; mimeType: string; width: number; height: number }> {
  const img = await loadImage(input, inputMime);

  // Calculate target dimensions (maintain aspect ratio)
  let { width, height } = img;
  if (width > opts.maxDimension || height > opts.maxDimension) {
    const scale = opts.maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  // Draw to canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Export as blob
  const outputMime = FORMAT_MIME[opts.format];
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Canvas export failed')),
      outputMime,
      opts.format === 'png' ? undefined : opts.quality,
    );
  });

  const buffer = await blob.arrayBuffer();
  return {
    data: new Uint8Array(buffer),
    mimeType: outputMime,
    width,
    height,
  };
}

/** Check if a MIME type is an image that can be processed */
export function isProcessableImage(mimeType: string): boolean {
  return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
}

/** Get a human-readable size string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
