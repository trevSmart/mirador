function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function generateCodeVerifier(): string {
  return toBase64Url(randomBytes(64))
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
}

export function generateOAuthState(): string {
  return toBase64Url(randomBytes(32))
}

export async function hashOAuthState(state: string): Promise<string> {
  const data = new TextEncoder().encode(state)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toBase64Url(new Uint8Array(digest))
}

export const PKCE_VERIFIER_KEY = 'mirador_oauth_pkce_verifier'
export const PKCE_STATE_KEY = 'mirador_oauth_state'
