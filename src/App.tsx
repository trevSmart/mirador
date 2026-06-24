import 'dockview-react/dist/styles/dockview.css'
import { AuthProvider } from './auth/AuthProvider'
import { MiradorApiProvider } from './api/MiradorApiProvider'
import { MiradorDataProvider } from './api/MiradorDataProvider'
import { AppHeader } from './components/AppHeader'
import { DetailDrawer } from './components/detail/DetailDrawer'
import { SettingsModal } from './components/settings/SettingsModal'
import { DockviewShell } from './components/DockviewShell'
import { DevErrorOverlay } from './components/error/DevErrorOverlay'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { ErrorFallback } from './components/error/ErrorFallback'
import { DetailDrawerProvider } from './detail/DetailDrawerContext'
import { DockviewHostProvider } from './dockview/DockviewHostProvider'
import { PreferencesProvider } from './settings/PreferencesProvider'
import { SettingsModalProvider } from './settings/SettingsModalProvider'
import { DevConsoleProvider } from './dev/DevConsoleContext'
import { DevConsole } from './dev/DevConsole'

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
      <DevConsole />
    </div>
  )
}

function App({ initialAuthError = null }: { initialAuthError?: string | null }) {
  return (
    <>
      {import.meta.env.DEV ? <DevErrorOverlay /> : null}
      <PreferencesProvider>
        <AuthProvider initialAuthError={initialAuthError}>
          <MiradorApiProvider>
            <MiradorDataProvider>
              <DockviewHostProvider>
                <DetailDrawerProvider>
                  <SettingsModalProvider>
                    <DevConsoleProvider>
                      <ErrorBoundary fallback={(error, reset) => <ErrorFallback error={error} reset={reset} />}>
                        <AppContent />
                      </ErrorBoundary>
                    </DevConsoleProvider>
                  </SettingsModalProvider>
                </DetailDrawerProvider>
              </DockviewHostProvider>
            </MiradorDataProvider>
          </MiradorApiProvider>
        </AuthProvider>
      </PreferencesProvider>
    </>
  )
}

export default App
