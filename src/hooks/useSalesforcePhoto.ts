import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { buildPhotoProxyUrlFromAbsoluteUrl } from '../auth/salesforce-oauth'

/** Bundled or same-origin URLs never need the Salesforce photo proxy. */
function isDirectPhotoUrl(url: string): boolean {
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) {
    return true
  }
  try {
    return new URL(url).origin === window.location.origin
  } catch {
    return false
  }
}

/**
 * Module-level cache of fetched photo blobs, shared across every
 * `useSalesforcePhoto` consumer. Keyed by the stable `instanceUrl + '\0' + photoUrl`
 * tuple so the same agent rendered in several places (e.g. a seat and its hover
 * overlay) reuses one object URL instead of each instance re-fetching from
 * scratch — which is what caused the avatar to flicker back to initials on hover.
 *
 * Entries are reference-counted: the object URL is only revoked once the last
 * consumer unmounts, so an in-use blob is never pulled out from under a still
 * mounted avatar.
 */
interface PhotoCacheEntry {
  /** Resolved object URL, or null once it has been revoked. */
  objectUrl: string | null
  /** In-flight fetch, present until it settles. */
  promise: Promise<string | null> | null
  /** Number of mounted hooks currently relying on this entry. */
  refs: number
}

const photoCache = new Map<string, PhotoCacheEntry>()

function acquirePhoto(key: string, photoUrl: string, accessToken: string): PhotoCacheEntry {
  let entry = photoCache.get(key)
  if (!entry) {
    entry = { objectUrl: null, promise: null, refs: 0 }
    photoCache.set(key, entry)
    entry.promise = fetch(buildPhotoProxyUrlFromAbsoluteUrl(photoUrl), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Photo fetch failed')
        }
        return response.blob()
      })
      .then((blob) => {
        const current = photoCache.get(key)
        // The entry may have been evicted (all refs gone) while fetching.
        if (!current || current !== entry) {
          return null
        }
        current.objectUrl = URL.createObjectURL(blob)
        return current.objectUrl
      })
      .catch(() => null)
      .finally(() => {
        const current = photoCache.get(key)
        if (current && current === entry) {
          current.promise = null
        }
      })
  }
  entry.refs += 1
  return entry
}

function releasePhoto(key: string): void {
  const entry = photoCache.get(key)
  if (!entry) {
    return
  }
  entry.refs -= 1
  if (entry.refs <= 0) {
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl)
    }
    photoCache.delete(key)
  }
}

export function useSalesforcePhoto(photoUrl: string | null): string | null {
  const { session, isMockMode } = useAuth()
  const accessToken = session?.accessToken ?? null
  const accessTokenRef = useRef(accessToken)
  const instanceUrl = session?.instanceUrl?.replace(/\/$/, '') ?? null
  const isDirect =
    photoUrl !== null && (isMockMode || isDirectPhotoUrl(photoUrl))

  const cacheKey =
    !isDirect && photoUrl && accessToken && instanceUrl
      ? `${instanceUrl}\0${photoUrl}`
      : null

  // Seed synchronously from the cache so an already-loaded photo shows on the
  // very first render — no flash of initials when a second consumer mounts.
  const [src, setSrc] = useState<string | null>(() =>
    cacheKey ? (photoCache.get(cacheKey)?.objectUrl ?? null) : null,
  )

  // Adjust state during render when the key changes (React's recommended
  // pattern over a sync-in-Effect — re-renders immediately, before paint, so
  // there is no flash of a stale value). The `loadedKey !== cacheKey` guard
  // keeps this from looping.
  const [loadedKey, setLoadedKey] = useState<string | null>(cacheKey)
  if (loadedKey !== cacheKey) {
    setLoadedKey(cacheKey)
    setSrc(cacheKey ? (photoCache.get(cacheKey)?.objectUrl ?? null) : null)
  }

  useEffect(() => {
    accessTokenRef.current = accessToken
  }, [accessToken])

  useEffect(() => {
    const currentAccessToken = accessTokenRef.current
    if (!cacheKey || isDirect || !photoUrl || !currentAccessToken) {
      return
    }

    let cancelled = false
    const entry = acquirePhoto(cacheKey, photoUrl, currentAccessToken)

    // Resolve asynchronously in every case (even when the blob is already
    // cached) so we never call setState synchronously inside the effect; the
    // synchronous useState seed already covers the already-loaded path.
    void Promise.resolve(entry.objectUrl ?? entry.promise).then((url) => {
      if (!cancelled && url) {
        setSrc(url)
      }
    })

    return () => {
      cancelled = true
      releasePhoto(cacheKey)
    }
  }, [cacheKey, isDirect, photoUrl])

  if (isDirect) {
    return photoUrl
  }

  return src
}
