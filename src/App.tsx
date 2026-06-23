import 'dockview/dist/styles/dockview.css'
import { AuthProvider } from './auth/AuthProvider'
import { MiradorApiProvider } from './api/MiradorApiProvider'
import { MiradorDataProvider } from './api/MiradorDataProvider'
import { AppHeader } from './components/AppHeader'
import { DetailDrawer } from './components/detail/DetailDrawer'
import { SettingsModal } from './components/settings/SettingsModal'
import { DockviewShell } from './components/DockviewShell'
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
    <AuthProvider initialAuthError={initialAuthError}>
      <PreferencesProvider>
        <MiradorApiProvider>
          <MiradorDataProvider>
            <DetailDrawerProvider>
              <SettingsModalProvider>
                <AppContent />
              </SettingsModalProvider>
            </DetailDrawerProvider>
          </MiradorDataProvider>
        </MiradorApiProvider>
      </PreferencesProvider>
    </AuthProvider>
  )
}

export default App
