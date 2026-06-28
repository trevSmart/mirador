import type { IncomingMessage, ServerResponse } from 'node:http'

const ALLOWED_HOST_PATTERN =
  /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(salesforce|force)\.com$/i
const USERINFO_PATH = '/services/oauth2/userinfo'

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOST_PATTERN.test(host)
}

export async function handleOAuthUserinfoProxy(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  const url = new URL(req.url ?? '', 'http://localhost')
  const host = url.searchParams.get('host')
  const authHeader = req.headers.authorization

  if (!host || !authHeader) {
    res.statusCode = 400
    res.end('Missing host or Authorization header')
    return
  }

  if (!isAllowedHost(host)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  try {
    const sfResponse = await fetch(`https://${host}${USERINFO_PATH}`, {
      headers: { Authorization: authHeader },
    })

    res.statusCode = sfResponse.status
    res.setHeader('Content-Type', 'application/json')
    res.end(await sfResponse.text())
  } catch (error) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Userinfo proxy error',
      }),
    )
  }
}
