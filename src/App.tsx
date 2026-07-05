import 'dockview-react/dist/styles/dockview.css'
import { AuthProvider } from './auth/AuthProvider'
import { MiradorApiProvider } from './api/MiradorApiProvider'
import { DataServiceProvider } from './api/data-service'
import { AppHeader } from './components/AppHeader'
import { DetailDrawer } from './components/detail/DetailDrawer'
import { SettingsModal } from './components/settings/SettingsModal'
import { DockviewShell } from './components/DockviewShell'
import { DevErrorOverlay } from './components/error/DevErrorOverlay'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { StatusScreen } from './components/status/StatusScreen'
import { AppGate } from './components/status/AppGate'
import { DetailDrawerProvider } from './detail/DetailDrawerContext'
import { DockviewHostProvider } from './dockview/DockviewHostProvider'
import { PreferencesProvider } from './settings/PreferencesProvider'
import { SettingsModalProvider } from './settings/SettingsModalProvider'
import { DevConsoleProvider } from './dev/DevConsoleContext'
import { DevConsole } from './dev/DevConsole'
import { ModalRegistryProvider } from './modals/ModalRegistryProvider'
import { GlobalShortcutsProvider } from './shortcuts/GlobalShortcutsProvider'
import { ToastProvider } from './components/ds/Toast/ToastProvider'

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
            <DataServiceProvider>
              <DockviewHostProvider>
                <ModalRegistryProvider>
                  <DetailDrawerProvider>
                    <SettingsModalProvider>
                      <DevConsoleProvider>
                        <GlobalShortcutsProvider>
                          <ToastProvider>
                            <ErrorBoundary
                              fallback={(error, reset) => (
                                <StatusScreen
                                  tone="error"
                                  title="Alguna cosa ha fallat"
                                  message="S'ha produït un error inesperat i no s'ha pogut mostrar aquesta vista."
                                  detail={error.message}
                                  detailLabel="Detalls de l'error"
                                  actions={[
                                    { label: 'Torna-ho a provar', onClick: reset, variant: 'primary' },
                                    { label: 'Recarrega la pàgina', onClick: () => window.location.reload() },
                                  ]}
                                />
                              )}
                            >
                              <AppGate>
                                <AppContent />
                              </AppGate>
                            </ErrorBoundary>
                          </ToastProvider>
                        </GlobalShortcutsProvider>
                      </DevConsoleProvider>
                    </SettingsModalProvider>
                  </DetailDrawerProvider>
                </ModalRegistryProvider>
              </DockviewHostProvider>
            </DataServiceProvider>
          </MiradorApiProvider>
        </AuthProvider>
      </PreferencesProvider>
    </>
  )
}

export default App
