import { describe, expect, it } from 'vitest'
import { fileToLogoDataUrl } from './site-logo'

function fileFrom(content: string, type: string, name = 'f'): File {
  return new File([content], name, { type })
}

describe('fileToLogoDataUrl', () => {
  it('rejects a non-image file', async () => {
    await expect(fileToLogoDataUrl(fileFrom('x', 'text/plain'))).rejects.toThrow(/imatge/i)
  })

  it('passes an SVG through as a data-URL', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'
    const url = await fileToLogoDataUrl(fileFrom(svg, 'image/svg+xml'))
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true)
  })

  it('rejects an oversized image', async () => {
    const huge = '<svg xmlns="http://www.w3.org/2000/svg">' + 'x'.repeat(200_000) + '</svg>'
    await expect(fileToLogoDataUrl(fileFrom(huge, 'image/svg+xml'))).rejects.toThrow(/gran/i)
  })
})
