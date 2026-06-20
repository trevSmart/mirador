import { useAuth } from '../auth/AuthProvider'

export function AppHeader() {
  const {
    authError,
    isAuthenticated,
    isLoading,
    isSalesforceEnabled,
    login,
    logout,
    userInfo,
  } = useAuth()

  return (
    <header className="app-header">
      <div className="app-header__left">
        <h1>Mirador</h1>
        <span>Omni Supervisor</span>
      </div>

      <div className="app-header__right">
        {!isSalesforceEnabled ? (
          <span className="app-header__warning">
            Configura SF_CLIENT_ID per connectar a Salesforce
          </span>
        ) : null}

        {authError ? (
          <span className="app-header__error" title={authError}>
            {authError}
          </span>
        ) : null}

        {isLoading ? (
          <span className="app-header__status">Carregant sessió…</span>
        ) : isAuthenticated ? (
          <div className="app-header__user">
            <span>{userInfo?.name ?? 'Usuari Salesforce'}</span>
            <button type="button" className="app-header__button" onClick={logout}>
              Logout
            </button>
          </div>
        ) : isSalesforceEnabled ? (
          <button type="button" className="app-header__button" onClick={() => void login()}>
            Login
          </button>
        ) : null}
      </div>
    </header>
  )
}
