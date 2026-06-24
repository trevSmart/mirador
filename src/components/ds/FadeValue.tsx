import { useEffect, useRef, useState, type CSSProperties, type ElementType } from 'react'

/** Matches `--dur-value` (450ms). */
const CROSSFADE_MS = 450

type AnimPhase = 'start' | 'run'

interface FadeValueProps {
  value: string | number
  className?: string
  style?: CSSProperties
  as?: ElementType
  'data-tone'?: string
}

/**
 * FadeValue — simultaneous crossfade when `value` changes. Outgoing and
 * incoming layers overlap at partial opacity mid-transition. Mount shows
 * instantly. Relies on global `prefers-reduced-motion` to disable motion.
 */
export function FadeValue({
  value,
  className,
  style,
  as: Tag = 'span',
  'data-tone': dataTone,
}: FadeValueProps) {
  const text = String(value)
  const [current, setCurrent] = useState(text)
  const [outgoing, setOutgoing] = useState<string | null>(null)
  const [phase, setPhase] = useState<AnimPhase | null>(null)
  const currentRef = useRef(text)
  const rafOuterRef = useRef(0)
  const rafInnerRef = useRef(0)
  const timeoutRef = useRef(0)

  useEffect(() => {
    if (text === currentRef.current) return

    setOutgoing(currentRef.current)
    currentRef.current = text
    setCurrent(text)
    setPhase('start')

    cancelAnimationFrame(rafOuterRef.current)
    cancelAnimationFrame(rafInnerRef.current)
    window.clearTimeout(timeoutRef.current)

    // Double rAF commits the start frame (out=1, in=0) before transitioning.
    rafOuterRef.current = requestAnimationFrame(() => {
      rafInnerRef.current = requestAnimationFrame(() => {
        setPhase('run')
      })
    })

    timeoutRef.current = window.setTimeout(() => {
      setOutgoing(null)
      setPhase(null)
    }, CROSSFADE_MS)

    return () => {
      cancelAnimationFrame(rafOuterRef.current)
      cancelAnimationFrame(rafInnerRef.current)
      window.clearTimeout(timeoutRef.current)
    }
  }, [text])

  return (
    <Tag
      className={['fade-value', className].filter(Boolean).join(' ')}
      style={style}
      data-tone={dataTone}
    >
      {outgoing !== null ? (
        <span className="fade-value__layer" data-role="out" data-phase={phase ?? undefined}>
          {outgoing}
        </span>
      ) : null}
      <span
        className="fade-value__layer"
        data-role="in"
        data-phase={outgoing !== null ? (phase ?? undefined) : undefined}
      >
        {current}
      </span>
    </Tag>
  )
}
