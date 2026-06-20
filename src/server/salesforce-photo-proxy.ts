import type { IncomingMessage, ServerResponse } from 'node:http'

const ALLOWED_HOST_PATTERN =
  /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(salesforce|force)\.com$/i
const ALLOWED_PATH_PATTERN = /^\/profilephoto\//i

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOST_PATTERN.test(host)
}

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATH_PATTERN.test(path)
}

export async function handleSalesforcePhotoProxy(
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
  const path = url.searchParams.get('path')
  const authHeader = req.headers.authorization

  if (!host || !path || !authHeader) {
    res.statusCode = 400
    res.end('Missing host, path, or Authorization header')
    return
  }

  if (!isAllowedHost(host) || !isAllowedPath(path)) {
    res.statusCode = 403
    res.end('Forbidden')
    return
  }

  try {
    const photoUrl = `https://${host}${path}`
    const sfResponse = await fetch(photoUrl, {
      headers: { Authorization: authHeader },
    })

    res.statusCode = sfResponse.status
    const contentType = sfResponse.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    const buffer = Buffer.from(await sfResponse.arrayBuffer())
    res.end(buffer)
  } catch (error) {
    res.statusCode = 502
    res.end(error instanceof Error ? error.message : 'Photo proxy error')
  }
}
