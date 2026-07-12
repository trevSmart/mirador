import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useDetailDrawer, type DetailTarget } from '../../detail/detail-drawer-context'
import { useDetailEntity, type DetailEntity } from '../../detail/use-detail-entity'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { resetScrollTop, useSmoothScroll } from '../../hooks/useSmoothScroll'
import { AppIcon } from '../ds'
import { AgentDetail } from './AgentDetail'
import { QueueDetail } from './QueueDetail'
import { SkillDetail } from './SkillDetail'
import { WorkItemDetail } from './WorkItemDetail'

export function DetailDrawer() {
  const { detail, close, openAsTab, back, canGoBack, forward, canGoForward, navDirection } =
    useDetailDrawer()

  const open = detail !== null
  const trapRef = useFocusTrap<HTMLElement>(open)
  // Retain the last target while closing so content doesn't blank out mid-animation.
  // Adjust derived state during render (React's recommended pattern) rather than
  // in an effect, so closing keeps the previous content until the slide-out ends.
  const [shown, setShown] = useState<DetailTarget | null>(detail)
  const [prevDetail, setPrevDetail] = useState<DetailTarget | null>(detail)
  // When navigating between records with the drawer already open, keep the
  // outgoing record mounted underneath while the incoming one slides in over
  // it, so the panel never shows an empty gap mid-transition. `leaving` holds
  // the previous target during that overlap; it's cleared when the slide ends.
  const [leaving, setLeaving] = useState<DetailTarget | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Same Lenis smooth scroll as the panels — without it the drawer is the one
  // surface in the app with raw native wheel scrolling, which reads as jerky
  // next to everything else. Merged with scrollRef because both need the node.
  const attachSmoothScroll = useSmoothScroll<HTMLDivElement>()
  const setScrollEl = useCallback(
    (element: HTMLDivElement | null) => {
      scrollRef.current = element
      attachSmoothScroll(element)
    },
    [attachSmoothScroll],
  )
  if (detail !== prevDetail) {
    const isNav = detail != null && prevDetail != null && shown != null
    setLeaving(isNav ? shown : null)
    setPrevDetail(detail)
    if (detail) setShown(detail)
  }

  // Els dos registres vius de la transició: l'entrant i el sortint, que conviuen
  // mentre dura el cross-slide. Es resolen aquí (dues crides fixes) perquè
  // renderContent és una funció plana i no hi pot cridar hooks.
  const shownEntity = useDetailEntity(shown).entity
  const leavingEntity = useDetailEntity(leaving).entity

  // Reset scroll to the top whenever the drawer opens or navigates to a
  // different record, so stale scroll position from the previous view never
  // carries over.
  useEffect(() => {
    if (detail) resetScrollTop(scrollRef.current)
  }, [detail])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // A closed drawer answers to nothing: close() rebuilds the history arrays,
      // so reacting to Escape here would rerender every consumer on any stray
      // Escape in the app (dismissing another modal, say).
      if (!open) return
      if (event.key === 'Escape') {
        close()
        return
      }
      // Arrow keys walk the drilldown history, but never while typing in a field.
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return
      }
      if (event.key === 'ArrowLeft' && canGoBack) {
        event.preventDefault()
        back()
      } else if (event.key === 'ArrowRight' && canGoForward) {
        event.preventDefault()
        forward()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, open, back, canGoBack, forward, canGoForward])

  function renderContent(entity: DetailEntity | null): ReactNode {
    switch (entity?.kind) {
      case 'agent':
        return <AgentDetail agent={entity.data} />
      case 'queue':
        return <QueueDetail queue={entity.data} />
      case 'skill':
        return <SkillDetail skill={entity.data} />
      case 'work':
        return <WorkItemDetail item={entity.data} />
      default:
        return <p className="dd-empty">No s'ha trobat l'element.</p>
    }
  }

  return (
    <>
      <div
        className={`detail-backdrop${open ? ' is-open' : ''}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        ref={trapRef}
        className={`detail-drawer${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        // When closed the drawer stays mounted (it slides off-screen), so use
        // `inert` rather than `aria-hidden`: inert also pulls focus out, which
        // avoids leaving the focused close button inside an aria-hidden subtree.
        inert={!open}
      >
        <div className="detail-drawer__toolbar">
          {canGoBack && (
            <button
              type="button"
              className="detail-drawer__icon-btn"
              onClick={back}
              aria-label="Torna al detall anterior"
              title="Torna al detall anterior"
            >
              <AppIcon name="arrow-left" size={16} />
            </button>
          )}
          <button
            type="button"
            className="detail-drawer__icon-btn"
            onClick={() => shown && openAsTab(shown)}
            disabled={!shown}
            aria-label="Obre com a pestanya"
            title="Obre com a pestanya"
          >
            <AppIcon name="expand_alt" size={16} />
          </button>
          <button type="button" className="detail-drawer__icon-btn" onClick={close} aria-label="Tanca el detall">
            <AppIcon name="close" size={16} />
          </button>
        </div>
        <div className="detail-drawer__scroll" ref={setScrollEl}>
          {leaving && (
            <div
              key={`${leaving.kind}:${leaving.id}`}
              className={`detail-drawer__content--leaving${navDirection === 'back' ? ' is-back' : ''}`}
              aria-hidden="true"
            >
              {renderContent(leavingEntity)}
            </div>
          )}
          <div
            key={shown ? `${shown.kind}:${shown.id}` : 'empty'}
            className={
              leaving
                ? `detail-drawer__content--nav${navDirection === 'back' ? ' is-back' : ''}`
                : undefined
            }
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setLeaving(null)
            }}
          >
            {renderContent(shownEntity)}
          </div>
        </div>
      </aside>
    </>
  )
}
