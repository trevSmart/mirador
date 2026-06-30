/* Reads an image File and returns a base64 data-URL suitable for Site.image.
   Raster images are downscaled to LOGO_MAX_PX via <canvas> (re-encoded PNG) so
   the data-URL stays well under the Salesforce Long Text cap. SVGs are passed
   through as text. No React, no app state. */

import { LOGO_MAX_CHARS } from './space-plan-model'

export const LOGO_MAX_PX = 256

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("No s'ha pogut llegir el fitxer"))
    reader.readAsDataURL(file)
  })
}

function resizeRaster(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, LOGO_MAX_PX / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error("No s'ha pogut processar la imatge"))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error("Imatge no vàlida"))
    img.src = dataUrl
  })
}

export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El fitxer ha de ser una imatge')
  }
  const raw = await readAsDataUrl(file)
  const result = file.type === 'image/svg+xml' ? raw : await resizeRaster(raw)
  if (result.length > LOGO_MAX_CHARS) {
    throw new Error('La imatge és massa gran')
  }
  return result
}
