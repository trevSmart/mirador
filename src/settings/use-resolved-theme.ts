import { useSyncExternalStore } from 'react'
import { getAppliedTheme, subscribeAppliedTheme, type ResolvedTheme } from './theme'

/** The theme currently applied to <html> (light|dark), reactive to changes.
    For code that can't use CSS vars — e.g. SVG presentation attributes. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeAppliedTheme, getAppliedTheme, () => 'light' as const)
}
