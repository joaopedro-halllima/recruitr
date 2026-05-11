"use client";

type OptimizeImageOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to load image."));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Unable to read file."));
    };
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function scaleSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function optimizeImageForStorage(
  file: File,
  options: OptimizeImageOptions
): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(rawDataUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to process image.");
  }

  let { width, height } = scaleSize(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    options.maxWidth,
    options.maxHeight
  );
  let quality = options.quality ?? 0.82;
  const mimeType = options.mimeType ?? "image/jpeg";

  for (let attempt = 0; attempt < 4; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const out = canvas.toDataURL(mimeType, quality);
    if (out.length <= 350_000 || attempt === 3) {
      return out;
    }

    width = Math.max(160, Math.round(width * 0.85));
    height = Math.max(160, Math.round(height * 0.85));
    quality = Math.max(0.55, quality - 0.08);
  }

  return rawDataUrl;
}

export function safeSetStoredImage(storageKey: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey, value);
    return true;
  } catch {
    try {
      window.localStorage.removeItem(storageKey);
      window.localStorage.setItem(storageKey, value);
      return true;
    } catch {
      return false;
    }
  }
}
