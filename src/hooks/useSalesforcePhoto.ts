import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { buildPhotoProxyUrlFromAbsoluteUrl } from '../auth/salesforce-oauth'

export function useSalesforcePhoto(photoUrl: string | null): string | null {
  const { session } = useAuth()
  const accessToken = session?.accessToken ?? null
  const [src, setSrc] = useState<string | null>(null)

  // Reset the resolved blob when the inputs change. Done during render
  // (convergent) instead of in the effect, so the effect only setStates async.
  const inputKey = photoUrl && accessToken ? photoUrl : null
  const [loadedKey, setLoadedKey] = useState<string | null>(inputKey)
  if (loadedKey !== inputKey) {
    setLoadedKey(inputKey)
    setSrc(null)
  }

  useEffect(() => {
    if (!photoUrl || !accessToken) {
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
  }, [photoUrl, accessToken])

  return src
}
