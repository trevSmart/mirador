import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrapAuth, preloadPublicConfig } from './auth/bootstrap-auth'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found')
}
const root = rootElement

async function startApp() {
  const [{ authError }] = await Promise.all([bootstrapAuth(), preloadPublicConfig()])

  createRoot(root).render(
    <StrictMode>
      <App initialAuthError={authError} />
    </StrictMode>,
  )
}

void startApp()
