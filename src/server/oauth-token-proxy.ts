import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServerEnv } from './load-env'

interface TokenRequestBody {
  grant_type: 'authorization_code' | 'refresh_token'
  code?: string
  code_verifier?: string
  redirect_uri?: string
  refresh_token?: string
}

async function readJsonBody(req: IncomingMessage): Promise<TokenRequestBody> {
  const chunks: Buffer[] = []
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(Buffer.from(chunk))
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text) {
    throw new Error('Empty request body')
  }
  return JSON.parse(text) as TokenRequestBody
}

function formEncode(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
}

export async function handleOAuthTokenProxy(
  req: IncomingMessage,
  res: ServerResponse,
  env: ServerEnv,
): Promise<void> {
  if (req.method !== 'POST') {
    res.statusCode = 405
    res.end('Method Not Allowed')
    return
  }

  try {
    const body = await readJsonBody(req)
    const params: Record<string, string> = {
      grant_type: body.grant_type,
      client_id: env.sfClientId,
    }

    if (body.grant_type === 'authorization_code') {
      if (!body.code || !body.code_verifier || !body.redirect_uri) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing authorization_code fields' }))
        return
      }
      params.code = body.code
      params.code_verifier = body.code_verifier
      params.redirect_uri = body.redirect_uri
    } else if (body.grant_type === 'refresh_token') {
      if (!body.refresh_token) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Missing refresh_token' }))
        return
      }
      params.refresh_token = body.refresh_token
    } else {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Unsupported grant_type' }))
      return
    }

    const tokenUrl = `${env.sfTokenUrl.replace(/\/$/, '')}/services/oauth2/token`
    const sfResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formEncode(params),
    })

    const payload = await sfResponse.text()
    res.statusCode = sfResponse.status
    res.setHeader('Content-Type', 'application/json')
    res.end(payload)
  } catch (error) {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Token proxy error',
      }),
    )
  }
}
