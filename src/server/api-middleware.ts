import type { Connect } from 'vite'
import { getPublicConfig, loadServerEnv } from './load-env'
import { handleOAuthTokenProxy } from './oauth-token-proxy'
import { handleSalesforcePhotoProxy } from './salesforce-photo-proxy'

export function createApiMiddleware(): Connect.NextHandleFunction {
  const env = loadServerEnv()

  return (req, res, next) => {
    const url = req.url ?? ''

    if (url === '/api/config' && req.method === 'GET') {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(getPublicConfig(env)))
      return
    }

    if (url === '/api/oauth/token') {
      void handleOAuthTokenProxy(req, res, env)
      return
    }

    if (url.startsWith('/api/salesforce/photo')) {
      void handleSalesforcePhotoProxy(req, res)
      return
    }

    next()
  }
}
