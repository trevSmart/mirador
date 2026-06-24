export const DROPDOWN_TRANSITION_MS = 180

interface SyncDropdownState {
  closeTimeoutId?: ReturnType<typeof setTimeout> | null
}

/** Open/close animation shared by header dropdowns (search, tab catalog, user menu). */
export function syncDropdownPanel(
  el: HTMLElement | null | undefined,
  open: boolean,
  state: SyncDropdownState = {},
): ReturnType<typeof setTimeout> | null {
  if (!el) return state.closeTimeoutId ?? null

  if (open) {
    clearTimeout(state.closeTimeoutId ?? undefined)
    el.hidden = false
    el.classList.remove('is-open')
    requestAnimationFrame(() => {
      el.classList.add('is-open')
    })
    return null
  }

  el.classList.remove('is-open')
  clearTimeout(state.closeTimeoutId ?? undefined)
  return setTimeout(() => {
    el.hidden = true
  }, DROPDOWN_TRANSITION_MS)
}

export function isDropdownPanelOpen(el: HTMLElement | null | undefined): boolean {
  return Boolean(el && !el.hidden && el.classList.contains('is-open'))
}
