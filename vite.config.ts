import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createApiMiddleware } from './src/server/api-middleware'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (env.SF_CLIENT_ID) {
    process.env.SF_CLIENT_ID = env.SF_CLIENT_ID
  }
  if (env.SF_LOGIN_URL) {
    process.env.SF_LOGIN_URL = env.SF_LOGIN_URL
  }
  if (env.SF_REDIRECT_URI) {
    process.env.SF_REDIRECT_URI = env.SF_REDIRECT_URI
  }
  if (env.MIRADOR_DATA_SOURCE) {
    process.env.MIRADOR_DATA_SOURCE = env.MIRADOR_DATA_SOURCE
  }

  return {
    plugins: [
      react(),
      {
        name: 'mirador-api',
        configureServer(server) {
          server.middlewares.use(createApiMiddleware())
        },
      },
    ],
    server: {
      port: 3000,
    },
    preview: {
      port: 3000,
    },
  }
})
