import 'dockview-react/dist/styles/dockview.css'
import { AuthProvider } from './auth/AuthProvider'
import { MiradorApiProvider } from './api/MiradorApiProvider'
import { MiradorDataProvider } from './api/MiradorDataProvider'
import { AppHeader } from './components/AppHeader'
import { DetailDrawer } from './components/detail/DetailDrawer'
import { SettingsModal } from './components/settings/SettingsModal'
import { DockviewShell } from './components/DockviewShell'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { ErrorFallback } from './components/error/ErrorFallback'
import { DetailDrawerProvider } from './detail/DetailDrawerContext'
import { PreferencesProvider } from './settings/PreferencesProvider'
import { SettingsModalProvider } from './settings/SettingsModalProvider'

function AppContent() {
  return (
    <div className="app">
      <div className="app-chrome">
        <AppHeader />
        <main className="dockview-container">
          <DockviewShell />
        </main>
      </div>
      <DetailDrawer />
      <SettingsModal />
    </div>
  )
}

function App({ initialAuthError = null }: { initialAuthError?: string | null }) {
  return (
    <PreferencesProvider>
      <AuthProvider initialAuthError={initialAuthError}>
        <MiradorApiProvider>
          <MiradorDataProvider>
            <DetailDrawerProvider>
              <SettingsModalProvider>
                <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
                  <AppContent />
                </ErrorBoundary>
              </SettingsModalProvider>
            </DetailDrawerProvider>
          </MiradorDataProvider>
        </MiradorApiProvider>
      </AuthProvider>
    </PreferencesProvider>
  )
}

export default App
