import { useRef } from 'react'
import 'dockview/dist/styles/dockview.css'
import { AuthProvider } from './auth/AuthProvider'
import { MiradorApiProvider } from './api/MiradorApiProvider'
import { AppHeader } from './components/AppHeader'
import { DockviewShell, type DockviewShellHandle } from './components/DockviewShell'

function AppContent() {
  const dockviewRef = useRef<DockviewShellHandle>(null)

  return (
    <div className="app">
      <AppHeader dockviewRef={dockviewRef} />
      <main className="dockview-container">
        <DockviewShell ref={dockviewRef} />
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <MiradorApiProvider>
        <AppContent />
      </MiradorApiProvider>
    </AuthProvider>
  )
}

export default App
