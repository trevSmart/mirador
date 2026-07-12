/* Paleta per tema del render 3D (SpaceView3D).
   Els atributs de presentació SVG no resolen var(), així que els colors que
   depenen del tema viuen aquí com a parells LIGHT/DARK amb la mateixa
   intenció de disseny: les ombres de profunditat continuen enfosquint, les
   línies d'aresta passen de tinta a tinta clara, i els brillos de llum
   s'atenuen. Els MATERIALS (vidre de finestra, fusta de porta, feixos de
   llum) són translúcids i es componen sobre la paret — es comparteixen entre
   temes dins els subcomponents; els feixos de llum canvien de color i mode de
   fusió (multiply enfosqueix, sobre fosc cal screen amb tons càlids d'oficina). */

import type { ResolvedTheme } from '../../settings/theme'

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
  /** Fusió dels feixos de llum: multiply sobre clar, screen sobre fosc. */
  beamBlend: 'multiply' | 'screen'
  /** Gradients dels feixos de llum diürna (inici, mig, fi). */
  beam: {
    floor: [string, string, string]
    cap: [string, string, string]
    side: [string, string, string]
  }
}

const LIGHT: SpaceView3DPalette = {
  pedestal: '#E2DFDA',
  spaceFillA: '#FDFCFB',
  spaceFillB: '#FBFAF8',
  wallFill: 'rgb(252,251,249)',
  shadeLeft: 'rgba(12,10,22,0.12)',
  shadeRight: 'rgba(12,10,22,0.04)',
  pedestalShadeLeft: 'rgba(12,10,22,0.05)',
  pedestalShadeRight: 'rgba(12,10,22,0.015)',
  capSheen: 'rgba(255,255,255,0.12)',
  vacantStroke: 'rgba(27,25,36,.22)',
  beacon: '#E05641',
  beaconStroke: '#fff',
  dividerFill: 'rgba(47,158,143,.30)',
  dividerStroke: 'rgba(47,158,143,.75)',
  wall: {
    rightTint: 'rgba(27,25,36,.032)',
    rightTintStroke: 'rgba(27,25,36,.05)',
    rightTopStroke: 'rgba(27,25,36,.06)',
    rightTopSheen: 'rgba(255,255,255,.4)',
    leftTint: 'rgba(27,25,36,.05)',
    leftTintStroke: 'rgba(27,25,36,.06)',
    leftTopStroke: 'rgba(27,25,36,.07)',
    leftTopSheen: 'rgba(255,255,255,.28)',
  },
  slabRightShade: 'rgba(27,25,36,.12)',
  slabLeftShade: 'rgba(27,25,36,.102)',
  tileStroke: 'rgba(27,25,36,.065)',
  grainDotA: 'rgba(27,25,36,0.02)',
  grainDotB: 'rgba(27,25,36,0.016)',
  tileSheen: { top: 'rgba(255,255,255,0.07)', bottom: 'rgba(27,25,36,0.03)' },
  wallSheenRight: { top: 'rgba(255,255,255,0.05)', bottom: 'rgba(27,25,36,0.03)' },
  wallSheenLeft: { top: 'rgba(255,255,255,0.03)', bottom: 'rgba(27,25,36,0.05)' },
  shadowFill: 'rgba(27,25,36,.17)',
  beamBlend: 'multiply',
  beam: {
    floor: ['rgba(150,178,214,0.07)', 'rgba(178,200,228,0.022)', 'rgba(220,232,245,0)'],
    cap: ['rgba(160,186,220,0.095)', 'rgba(196,214,234,0.03)', 'rgba(232,240,248,0)'],
    side: ['rgba(154,182,218,0.08)', 'rgba(188,208,232,0.028)', 'rgba(226,236,246,0)'],
  },
}

const DARK: SpaceView3DPalette = {
  pedestal: '#363440',
  spaceFillA: '#34323C',
  spaceFillB: '#302E38',
  wallFill: 'rgb(56,54,64)',
  shadeLeft: 'rgba(0,0,0,0.22)',
  shadeRight: 'rgba(0,0,0,0.09)',
  pedestalShadeLeft: 'rgba(0,0,0,0.10)',
  pedestalShadeRight: 'rgba(0,0,0,0.04)',
  capSheen: 'rgba(255,255,255,0.10)',
  vacantStroke: 'rgba(237,236,242,.25)',
  beacon: '#E05641',
  beaconStroke: '#fff',
  dividerFill: 'rgba(47,158,143,.30)',
  dividerStroke: 'rgba(47,158,143,.75)',
  wall: {
    rightTint: 'rgba(0,0,0,.09)',
    rightTintStroke: 'rgba(237,236,242,.07)',
    rightTopStroke: 'rgba(237,236,242,.08)',
    rightTopSheen: 'rgba(255,255,255,.14)',
    leftTint: 'rgba(0,0,0,.12)',
    leftTintStroke: 'rgba(237,236,242,.08)',
    leftTopStroke: 'rgba(237,236,242,.09)',
    leftTopSheen: 'rgba(255,255,255,.10)',
  },
  slabRightShade: 'rgba(0,0,0,.22)',
  slabLeftShade: 'rgba(0,0,0,.18)',
  tileStroke: 'rgba(237,236,242,.09)',
  grainDotA: 'rgba(237,236,242,0.03)',
  grainDotB: 'rgba(237,236,242,0.024)',
  tileSheen: { top: 'rgba(255,255,255,0.06)', bottom: 'rgba(0,0,0,0.06)' },
  wallSheenRight: { top: 'rgba(255,255,255,0.055)', bottom: 'rgba(0,0,0,0.07)' },
  wallSheenLeft: { top: 'rgba(255,255,255,0.04)', bottom: 'rgba(0,0,0,0.09)' },
  shadowFill: 'rgba(0,0,0,.30)',
  beamBlend: 'screen',
  beam: {
    floor: ['rgba(232,224,210,0.065)', 'rgba(238,232,218,0.022)', 'rgba(245,240,232,0)'],
    cap: ['rgba(236,228,214,0.085)', 'rgba(242,236,222,0.028)', 'rgba(248,244,236,0)'],
    side: ['rgba(228,218,202,0.072)', 'rgba(234,226,212,0.025)', 'rgba(242,236,228,0)'],
  },
}

export const SPACE_VIEW_3D_PALETTES: Record<ResolvedTheme, SpaceView3DPalette> = {
  light: LIGHT,
  dark: DARK,
}
