import { useMemo, useState } from 'react'
import { useSkills } from '../api/data-hooks'
import { FadeValue } from '../components/ds'
import { SkillRow } from '../components/SkillRow'
import { groupSkillsByType, totalSkillBacklog } from '../utils/agent-stats'
import { colorFromRecordId, colorFromString, EXCLUDED_HUE_RANGE, oklchForHue } from '../utils/color-from-string'

/* ──────────────────────────────────────────────────────────────────────────
   Color Playground — eina de dev per inspeccionar colorFromString(). Té dues
   cards: (1) mostres sintètiques de noms aleatoris/realistes amb controls, i
   (2) els skills REALS del snapshot, amb els mateixos elements que el panell de
   Skills (SkillRow, agrupació per tipus) i el mateix histograma de distribució.
   Així es compara la teoria amb les dades de debò.
   ────────────────────────────────────────────────────────────────────────── */

/** PRNG determinista (mulberry32) → mostres reproduïbles per un mateix seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SYLLABLES = [
  'ka', 'ri', 'mo', 'ten', 'sa', 'lo', 'vi', 'nu', 'fe', 'qua', 'bel', 'dor',
  'tri', 'glan', 'pri', 'ro', 'me', 'di', 'um', 'con', 'tra', 'sup', 'tec', 'nic',
  'an', 'gl', 'es', 'cas', 'cat', 'fr', 'al', 'pre', 'gdpr', 'ven', 'out', 'bound',
]

/** Genera un nom llegible de 2–4 síl·labes amb el PRNG donat. */
function randomName(rand: () => number): string {
  const parts = 2 + Math.floor(rand() * 3)
  let out = ''
  for (let i = 0; i < parts; i++) out += SYLLABLES[Math.floor(rand() * SYLLABLES.length)]
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/* Prefixos i sufixos realistes: imiten noms de skills/cues reals, que sovint
   comparteixen arrel ("Suport tècnic L1/L2/…"). És el cas dur per al hash —
   permet veure si l'algoritme separa prou els noms amb prefix comú. */
const REAL_PREFIXES = [
  'Suport tècnic', 'Atenció', 'Vendes', 'Retenció', 'Mediació', 'Compliment',
  'Idioma', 'Certificació', 'Backoffice', 'Onboarding', 'Facturació', 'Logística',
]
const REAL_SUFFIXES = [
  'L1', 'L2', 'L3', 'L4', 'Premium', 'Client', 'Bàsic', 'Pro', 'VIP', 'Avançat',
  'outbound', 'inbound', 'cross', 'up', 'A', 'B', 'C', 'Nivell 1', 'Nivell 2', 'Sènior',
]

/** Nom realista "Prefix Sufix" amb arrels compartides entre mostres. */
function realisticName(rand: () => number): string {
  const p = REAL_PREFIXES[Math.floor(rand() * REAL_PREFIXES.length)]
  const s = REAL_SUFFIXES[Math.floor(rand() * REAL_SUFFIXES.length)]
  return `${p} ${s}`
}

interface Sample {
  name: string
  color: string
  hue: number
}

/** Extreu el hue numèric d'un color "oklch(L C H)". */
function parseHue(color: string): number {
  const m = color.match(/oklch\([\d.]+\s+[\d.]+\s+([\d.]+)/)
  return m ? parseFloat(m[1]) : 0
}

const HUE_BINS = 36 // bins de 10° cadascun
const BIN_DEG = 360 / HUE_BINS

/** True si el bin i se solapa amb la franja de hue exclosa. */
function isExcludedBin(i: number): boolean {
  const [gapStart, gapEnd] = EXCLUDED_HUE_RANGE
  return (i + 1) * BIN_DEG > gapStart && i * BIN_DEG < gapEnd
}

/* ── Histograma del cercle cromàtic ─────────────────────────────────────────
   Component reutilitzable: rep una llista de hues i en dibuixa la distribució.
   Cada barra és un sector de 10° pintat amb el seu color real; els sectors sense
   cap mostra queden gairebé transparents → els buits salten a la vista. Els bins
   de la franja exclosa es marquen a part (no són un buit de cobertura). */
function HueHistogram({ hues }: { hues: number[] }) {
  const bins = useMemo<number[]>(() => {
    const arr: number[] = new Array<number>(HUE_BINS).fill(0)
    for (const h of hues) {
      const idx = Math.min(HUE_BINS - 1, Math.floor((h / 360) * HUE_BINS))
      arr[idx]++
    }
    return arr
  }, [hues])

  const maxBin = Math.max(1, ...bins)

  return (
    <div className="color-playground__wheel" aria-label="Distribució de hue">
      {bins.map((n, i) => {
        const hue = (i + 0.5) * BIN_DEG
        const lo = Math.round(i * BIN_DEG)
        const excluded = isExcludedBin(i)
        // Etiqueta de l'eix X cada 60° (a l'inici del bin corresponent).
        const tick = lo % 60 === 0 ? lo : null
        return (
          <div
            key={i}
            className={`color-playground__bar${excluded ? ' color-playground__bar--excluded' : ''}`}
            title={
              excluded
                ? `${lo}–${Math.round((i + 1) * BIN_DEG)}° · franja exclosa`
                : `${lo}–${Math.round((i + 1) * BIN_DEG)}° · ${n} mostres`
            }
          >
            <div className="color-playground__bar-track">
              <div
                className="color-playground__bar-fill"
                style={{
                  height: excluded ? '100%' : `${(n / maxBin) * 100}%`,
                  background: excluded ? undefined : oklchForHue(hue),
                  opacity: !excluded && n === 0 ? 0.12 : 1,
                }}
              />
            </div>
            {tick !== null && <span className="color-playground__bar-tick">{tick}°</span>}
          </div>
        )
      })}
    </div>
  )
}

/** % de sectors del cercle amb almenys una mostra, ignorant la franja exclosa. */
function coverageOf(hues: number[]): { coverage: number; emptyBins: number } {
  const filled = new Set<number>()
  for (const h of hues) filled.add(Math.min(HUE_BINS - 1, Math.floor((h / 360) * HUE_BINS)))
  let usableBins = 0
  let emptyBins = 0
  for (let i = 0; i < HUE_BINS; i++) {
    if (isExcludedBin(i)) continue
    usableBins++
    if (!filled.has(i)) emptyBins++
  }
  return { coverage: Math.round(((usableBins - emptyBins) / usableBins) * 100), emptyBins }
}

type NameMode = 'random' | 'realistic'

/* ── Card 1: mostres sintètiques ────────────────────────────────────────── */
function SyntheticCard() {
  const [count, setCount] = useState(100)
  const [seed, setSeed] = useState(1)
  const [mode, setMode] = useState<NameMode>('realistic')

  const samples = useMemo<Sample[]>(() => {
    const rand = mulberry32(seed)
    const gen = mode === 'realistic' ? realisticName : randomName
    const out: Sample[] = []
    const seen = new Set<string>()
    // generem noms únics per evitar swatches duplicats que enmascarin la cobertura
    let guard = 0
    while (out.length < count && guard < count * 40) {
      guard++
      const name = gen(rand)
      if (seen.has(name)) continue
      seen.add(name)
      const color = colorFromString(name)
      out.push({ name, color, hue: parseHue(color) })
    }
    return out
  }, [count, seed, mode])

  const hues = useMemo(() => samples.map((s) => s.hue), [samples])
  const { coverage, emptyBins } = coverageOf(hues)

  return (
    <section className="color-playground__card">
      <header className="color-playground__toolbar">
        <div className="color-playground__title">
          <h2>Mostres sintètiques</h2>
          <p>
            {samples.length} mostres · cobertura del cercle cromàtic{' '}
            <strong>{coverage}%</strong> · {emptyBins} de {HUE_BINS} sectors buits
          </p>
        </div>
        <div className="color-playground__controls">
          <div className="color-playground__modes" role="group" aria-label="Tipus de noms">
            <button
              type="button"
              className={mode === 'realistic' ? 'is-active' : ''}
              onClick={() => setMode('realistic')}
              title="Noms amb prefixos compartits, com els skills reals"
            >
              Realistes
            </button>
            <button
              type="button"
              className={mode === 'random' ? 'is-active' : ''}
              onClick={() => setMode('random')}
              title="Síl·labes aleatòries sense arrels repetides"
            >
              Aleatoris
            </button>
          </div>
          <label>
            Mostres
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <span>{count}</span>
          </label>
          <button type="button" onClick={() => setSeed((s) => s + 1)}>
            Regenera
          </button>
        </div>
      </header>

      <HueHistogram hues={hues} />

      <div className="color-playground__grid" aria-label="Mostres de color">
        {[...samples]
          .sort((a, b) => a.hue - b.hue)
          .map((s) => (
            <div key={s.name} className="color-playground__swatch" title={`${s.name} · ${s.color}`}>
              <span className="color-playground__chip" style={{ background: s.color }} />
              <span className="color-playground__label">{s.name}</span>
            </div>
          ))}
      </div>
    </section>
  )
}

/* ── Card 2: skills reals del snapshot ──────────────────────────────────────
   Mateixos elements que el panell de Skills (SkillRow, agrupació per tipus) més
   l'histograma calculat sobre els hues reals. És la comprovació definitiva: cap
   mostra sintètica, només les dades de producció. */
function RealSkillsCard() {
  const skills = useSkills()
  const groups = groupSkillsByType(skills)
  const hues = skills.map((s) => parseHue(colorFromRecordId(s.id)))
  const { coverage, emptyBins } = coverageOf(hues)

  return (
    <section className="color-playground__card">
      <header className="color-playground__toolbar">
        <div className="color-playground__title">
          <h2>Skills reals</h2>
          <p>
            <FadeValue value={skills.length} /> skills · <FadeValue value={totalSkillBacklog(skills)} />{' '}
            treballs en cua · cobertura <strong>{coverage}%</strong> · {emptyBins} de {HUE_BINS} sectors buits
          </p>
        </div>
      </header>

      <HueHistogram hues={hues} />

      {skills.length === 0 ? (
        <p className="color-playground__empty">No hi ha skills carregades al snapshot.</p>
      ) : (
        groups.map((group) => (
          <div key={group.typeId ?? group.type} className="color-playground__skill-group">
            <h3 className="color-playground__skill-group-title">
              {group.type} · {group.skills.length} skills
            </h3>
            <div className="entity-list entity-list--grid">
              {group.skills.map((skill) => (
                <SkillRow key={skill.id} skill={skill} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  )
}

export function ColorPlaygroundPanel() {
  return (
    <div className="color-playground">
      <SyntheticCard />
      <RealSkillsCard />
    </div>
  )
}
