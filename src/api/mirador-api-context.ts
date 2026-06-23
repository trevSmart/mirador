/* Mirador API client — context + hook (no components, for Fast Refresh).
   The <MiradorApiProvider> in MiradorApiProvider.tsx supplies the client. */

import { createContext, useContext } from 'react'
import type { MiradorClient } from './mirador-client'

export const MiradorApiContext = createContext<MiradorClient | null>(null)

export function useMiradorApi(): MiradorClient | null {
  return useContext(MiradorApiContext)
}
