import type { OAuthSession } from './types'

const SESSION_KEY = 'mirador_oauth_session'
const AES_KEY_STORAGE_KEY = 'mirador_oauth_aes_key'

let cachedSession: OAuthSession | null = null
let aesKeyPromise: Promise<CryptoKey> | null = null

function isPlainSession(value: unknown): value is OAuthSession {
  if (!value || typeof value !== 'object') {
    return false
  }
  const session = value as OAuthSession
  return (
    typeof session.accessToken === 'string' &&
    typeof session.refreshToken === 'string' &&
    typeof session.instanceUrl === 'string' &&
    typeof session.expiresAt === 'number'
  )
}

async function getOrCreateAesKey(): Promise<CryptoKey> {
  if (!aesKeyPromise) {
    aesKeyPromise = (async () => {
      const stored = sessionStorage.getItem(AES_KEY_STORAGE_KEY)
      if (stored) {
        const raw = Uint8Array.from(atob(stored), (char) => char.charCodeAt(0))
        return crypto.subtle.importKey(
          'raw',
          raw,
          { name: 'AES-GCM' },
          false,
          ['encrypt', 'decrypt'],
        )
      }

      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      )
      const exported = new Uint8Array(await crypto.subtle.exportKey('raw', key))
      sessionStorage.setItem(
        AES_KEY_STORAGE_KEY,
        btoa(String.fromCharCode(...exported)),
      )
      return key
    })()
  }
  return aesKeyPromise
}

async function encryptSession(session: OAuthSession): Promise<string> {
  const key = await getOrCreateAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(session))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const payload = new Uint8Array(iv.length + cipher.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...payload))
}

async function decryptSession(payload: string): Promise<OAuthSession | null> {
  try {
    const key = await getOrCreateAesKey()
    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const cipher = bytes.slice(12)
    const decoded = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipher,
    )
    const session = JSON.parse(new TextDecoder().decode(decoded)) as OAuthSession
    return isPlainSession(session) ? session : null
  } catch {
    return null
  }
}

export async function initOAuthSessionStorage(): Promise<OAuthSession | null> {
  const stored = localStorage.getItem(SESSION_KEY)
  if (!stored) {
    cachedSession = null
    return null
  }

  if (stored.startsWith('{')) {
    try {
      const legacy = JSON.parse(stored) as OAuthSession
      if (isPlainSession(legacy)) {
        await saveOAuthSession(legacy)
        return legacy
      }
    } catch {
      localStorage.removeItem(SESSION_KEY)
    }
    cachedSession = null
    return null
  }

  const session = await decryptSession(stored)
  cachedSession = session
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
  }
  return session
}

export async function saveOAuthSession(session: OAuthSession): Promise<void> {
  cachedSession = session
  const encrypted = await encryptSession(session)
  localStorage.setItem(SESSION_KEY, encrypted)
}

export function getCachedOAuthSession(): OAuthSession | null {
  return cachedSession
}

export function clearOAuthSession(): void {
  cachedSession = null
  localStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem(AES_KEY_STORAGE_KEY)
  aesKeyPromise = null
}

export function isSessionValid(session: OAuthSession | null): session is OAuthSession {
  if (!session?.accessToken || !session.instanceUrl) {
    return false
  }
  return session.expiresAt > Date.now() + 60_000
}
