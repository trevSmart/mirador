import 'dockview/dist/styles/dockview.css'
import { AuthProvider } from './auth/AuthProvider'
import { MiradorApiProvider } from './api/MiradorApiProvider'
import { MiradorDataProvider } from './api/MiradorDataProvider'
import { AppHeader } from './components/AppHeader'
import { DockviewShell } from './components/DockviewShell'

function AppContent() {
  return (
    <div className="app">
      <div className="app-chrome">
        <AppHeader />
        <main className="dockview-container">
          <DockviewShell />
        </main>
      </div>
    </div>
  )
}

function App({ initialAuthError = null }: { initialAuthError?: string | null }) {
  return (
    <AuthProvider initialAuthError={initialAuthError}>
      <MiradorApiProvider>
        <MiradorDataProvider>
          <AppContent />
        </MiradorDataProvider>
      </MiradorApiProvider>
    </AuthProvider>
  )
}

export default App
