import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Agent, Queue } from '../../api/types'
import type { Space } from '../../space/types'

const SpaceView3D = lazy(() =>
  import('./SpaceView3D').then((m) => ({ default: m.SpaceView3D })),
)

const noop = () => {}

interface SpacePlanThumbProps {
  space: Space
  agentsById: Map<string, Agent>
  queuesById: Map<string, Queue>
}

/* A static, non-interactive miniature of a space's 3D render, used as the
   per-plant node visual in SpacePlanTree. The heavy SpaceView3D is mounted only
   once the node scrolls into view, so a long list never pays for off-screen
   renders. Agents show as ground-level avatars (towers={false}). */
export function SpacePlanThumb({ space, agentsById, queuesById }: SpacePlanThumbProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <div className="fe-plan-tree__thumb" ref={ref} aria-hidden="true">
      {visible ? (
        <Suspense fallback={null}>
          <SpaceView3D
            space={space}
            agentsById={agentsById}
            queuesById={queuesById}
            showAvatars
            animations={false}
            towers={false}
            interactive={false}
            onSelectAgent={noop}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
