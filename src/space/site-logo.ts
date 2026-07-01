/* Reads an image File and returns a base64 data-URL suitable for Site.image.
   Raster images are downscaled via <canvas> and re-encoded until the data-URL
   fits under LOGO_MAX_CHARS: we try progressively smaller sizes as PNG, then
   fall back to JPEG with decreasing quality. SVGs are passed through as text.
   No React, no app state. */

import { LOGO_MAX_CHARS } from './space-plan-model'

export const LOGO_MAX_PX = 256

// Ordered from best quality to most aggressive. The first candidate whose
// encoded data-URL fits under LOGO_MAX_CHARS wins.
const RASTER_ATTEMPTS: ReadonlyArray<{ px: number; type: 'image/png' | 'image/jpeg'; quality?: number }> = [
  { px: 256, type: 'image/png' },
  { px: 192, type: 'image/png' },
  { px: 128, type: 'image/png' },
  { px: 256, type: 'image/jpeg', quality: 0.85 },
  { px: 192, type: 'image/jpeg', quality: 0.8 },
  { px: 128, type: 'image/jpeg', quality: 0.7 },
  { px: 96, type: 'image/jpeg', quality: 0.6 },
  { px: 64, type: 'image/jpeg', quality: 0.5 },
]

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    // readAsDataURL always yields a string result; narrow for the type checker.
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(new Error("No s'ha pogut llegir el fitxer"))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Imatge no vàlida'))
    img.src = dataUrl
  })
}

function encodeAt(img: HTMLImageElement, maxPx: number, type: string, quality?: number): string {
  const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("No s'ha pogut processar la imatge")
  // JPEG has no alpha; paint a white backdrop so transparent areas don't go black.
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL(type, quality)
}

async function resizeRaster(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl)
  for (const attempt of RASTER_ATTEMPTS) {
    const out = encodeAt(img, attempt.px, attempt.type, attempt.quality)
    if (out.length <= LOGO_MAX_CHARS) return out
  }
  // Even the most aggressive attempt overflowed — surface it rather than save junk.
  throw new Error('La imatge és massa gran')
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El fitxer ha de ser una imatge')
  }
  const raw = await readAsDataUrl(file)
  if (file.type === 'image/svg+xml') {
    // SVGs can't be rasterised down losslessly here; pass through, reject if huge.
    if (raw.length > LOGO_MAX_CHARS) throw new Error('La imatge és massa gran')
    return raw
  }
  return resizeRaster(raw)
}
