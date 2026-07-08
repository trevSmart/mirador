import type { ReactNode } from 'react'
import { useAuth } from '../../auth/auth-context'
import { StatusScreen } from './StatusScreen'

export function AppGate({ children }: { children: ReactNode }) {
  const { authError, isAuthenticated, isSalesforceEnabled, login, logout } = useAuth()

  if (authError) {
    return (
      <StatusScreen
        tone="error"
        title="No s'ha pogut connectar a Salesforce"
        message="Hi ha hagut un problema en autenticar amb Salesforce."
        detail={authError}
        detailLabel="Detalls"
        actions={[
          { label: 'Reintenta', onClick: () => void login(), variant: 'primary' },
          {
            label: 'Inicia sessió amb un altre compte',
            onClick: () => void login({ forceAccountSelection: true }),
          },
          { label: 'Tanca la sessió de Salesforce', onClick: () => logout() },
          { label: 'Recarrega la pàgina', onClick: () => window.location.reload() },
        ]}
      />
    )
  }

  if (isSalesforceEnabled && !isAuthenticated) {
    return <StatusScreen tone="info" busy title="Connectant amb Salesforce…" />
  }

  return <>{children}</>
}
