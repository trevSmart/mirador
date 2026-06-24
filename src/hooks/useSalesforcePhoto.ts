import { useEffect, useState } from 'react'
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

export function useSalesforcePhoto(photoUrl: string | null): string | null {
  const { session, isMockMode } = useAuth()
  const accessToken = session?.accessToken ?? null
  const isDirect =
    photoUrl !== null && (isMockMode || isDirectPhotoUrl(photoUrl))

  const [src, setSrc] = useState<string | null>(null)

  const inputKey = !isDirect && photoUrl && accessToken ? photoUrl : null
  const [loadedKey, setLoadedKey] = useState<string | null>(inputKey)
  if (loadedKey !== inputKey) {
    setLoadedKey(inputKey)
    setSrc(null)
  }

  useEffect(() => {
    if (isDirect || !photoUrl || !accessToken) {
      return
    }

    let cancelled = false
    let objectUrl: string | null = null

    void fetch(buildPhotoProxyUrlFromAbsoluteUrl(photoUrl), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Photo fetch failed')
        }
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) {
          return
        }
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [accessToken, isDirect, photoUrl])

  if (isDirect) {
    return photoUrl
  }

  return src
}
