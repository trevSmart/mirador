/* Paleta del render 3D (SpaceView3D) — noms de variable, no valors.
   Els colors per tema viuen com a variables CSS a :root /
   :root[data-theme='dark'] (index.css, secció «Paleta SpaceView3D»). Els
   presentation attributes SVG (fill, stroke, stop-color) sí que resolen
   var(), així que el canvi de tema és cascada CSS pura: cap component s'ha
   de re-renderitzar. El mode de fusió dels feixos de llum (multiply sobre
   clar, screen sobre fosc) també és variable (--fv3d-beam-blend), aplicada
   via la classe .fv3d-beam-vol perquè mix-blend-mode no té presentation
   attribute. */

export interface SpaceView3DPalette {
  /** Slab del pedestal i fallback de color de torre. */
  pedestal: string
  /** Tiles del terra, escaquejat A/B. */
  spaceFillA: string
  spaceFillB: string
  /** Parets del fons i cares de gruix del slab. */
  wallFill: string
  /** Ombres iso de les cares de torre (esquerra = més fosca). */
  shadeLeft: string
  shadeRight: string
  pedestalShadeLeft: string
  pedestalShadeRight: string
  /** Brillo del diamant superior de les bandes. */
  capSheen: string
  /** Anell discontinu del seient lliure. */
  vacantStroke: string
  /** Punt de saturació sobre l'avatar (idèntic en tots dos temes). */
  beacon: string
  beaconStroke: string
  /** Mampares divisòries (teal de marca, compartit). */
  dividerFill: string
  dividerStroke: string
  /** Tints/arestes/brillos de les parets del fons. */
  wall: {
    rightTint: string
    rightTintStroke: string
    rightTopStroke: string
    rightTopSheen: string
    leftTint: string
    leftTintStroke: string
    leftTopStroke: string
    leftTopSheen: string
  }
  /** Enfosquiment de les cares de gruix del slab. */
  slabRightShade: string
  slabLeftShade: string
  /** Junta entre tiles. */
  tileStroke: string
  /** Puntets de gra del paviment. */
  grainDotA: string
  grainDotB: string
  /** Gradients de llum ambient (stops superior/inferior). */
  tileSheen: { top: string; bottom: string }
  wallSheenRight: { top: string; bottom: string }
  wallSheenLeft: { top: string; bottom: string }
  /** Ombra de contacte del terra (sota el blur). */
  shadowFill: string
  /** Gradients dels feixos de llum diürna (inici, mig, fi). */
  beam: {
    floor: [string, string, string]
    cap: [string, string, string]
    side: [string, string, string]
  }
}

export const SPACE_VIEW_3D_PALETTE: SpaceView3DPalette = {
  pedestal: 'var(--fv3d-pedestal)',
  spaceFillA: 'var(--fv3d-space-fill-a)',
  spaceFillB: 'var(--fv3d-space-fill-b)',
  wallFill: 'var(--fv3d-wall-fill)',
  shadeLeft: 'var(--fv3d-shade-left)',
  shadeRight: 'var(--fv3d-shade-right)',
  pedestalShadeLeft: 'var(--fv3d-pedestal-shade-left)',
  pedestalShadeRight: 'var(--fv3d-pedestal-shade-right)',
  capSheen: 'var(--fv3d-cap-sheen)',
  vacantStroke: 'var(--fv3d-vacant-stroke)',
  beacon: 'var(--fv3d-beacon)',
  beaconStroke: 'var(--fv3d-beacon-stroke)',
  dividerFill: 'var(--fv3d-divider-fill)',
  dividerStroke: 'var(--fv3d-divider-stroke)',
  wall: {
    rightTint: 'var(--fv3d-wall-right-tint)',
    rightTintStroke: 'var(--fv3d-wall-right-tint-stroke)',
    rightTopStroke: 'var(--fv3d-wall-right-top-stroke)',
    rightTopSheen: 'var(--fv3d-wall-right-top-sheen)',
    leftTint: 'var(--fv3d-wall-left-tint)',
    leftTintStroke: 'var(--fv3d-wall-left-tint-stroke)',
    leftTopStroke: 'var(--fv3d-wall-left-top-stroke)',
    leftTopSheen: 'var(--fv3d-wall-left-top-sheen)',
  },
  slabRightShade: 'var(--fv3d-slab-right-shade)',
  slabLeftShade: 'var(--fv3d-slab-left-shade)',
  tileStroke: 'var(--fv3d-tile-stroke)',
  grainDotA: 'var(--fv3d-grain-dot-a)',
  grainDotB: 'var(--fv3d-grain-dot-b)',
  tileSheen: { top: 'var(--fv3d-tile-sheen-top)', bottom: 'var(--fv3d-tile-sheen-bottom)' },
  wallSheenRight: { top: 'var(--fv3d-wall-sheen-right-top)', bottom: 'var(--fv3d-wall-sheen-right-bottom)' },
  wallSheenLeft: { top: 'var(--fv3d-wall-sheen-left-top)', bottom: 'var(--fv3d-wall-sheen-left-bottom)' },
  shadowFill: 'var(--fv3d-shadow-fill)',
  beam: {
    floor: ['var(--fv3d-beam-floor-0)', 'var(--fv3d-beam-floor-1)', 'var(--fv3d-beam-floor-2)'],
    cap: ['var(--fv3d-beam-cap-0)', 'var(--fv3d-beam-cap-1)', 'var(--fv3d-beam-cap-2)'],
    side: ['var(--fv3d-beam-side-0)', 'var(--fv3d-beam-side-1)', 'var(--fv3d-beam-side-2)'],
  },
}
