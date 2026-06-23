import { useMiradorData } from '../api/MiradorDataProvider'
import { useAuth } from '../auth/AuthProvider'
import panoramaLogo from '../assets/panorama/logo/panorama-logo.png'
import { SfIcon } from './ds/SfIcon'
import { GlobalSearch } from './GlobalSearch'
import { HeaderClock } from './HeaderClock'

export function AppHeader() {
  const {
    authError,
    isAuthenticated,
    isLoading,
    isMockMode,
    isSalesforceEnabled,
    logout,
    userInfo,
  } = useAuth()
  const { isRefreshing, refresh } = useMiradorData()

  return (
    <header className="app-header">
      <div className="app-header__left">
        <img className="app-header__logo" src={panoramaLogo} alt="Panorama" />
      </div>

      <div className="app-header__center">
        <HeaderClock />
      </div>

      <div className="app-header__right">
        {isMockMode ? (
          <span className="app-header__status">Simulació (mock)</span>
        ) : !isSalesforceEnabled ? (
          <span className="app-header__warning">
            Configura SF_CLIENT_ID per connectar a Salesforce
          </span>
        ) : null}

        {authError ? (
          <span className="app-header__error" title={authError}>
            {authError}
          </span>
        ) : null}

        <button
          type="button"
          className={`app-header__button app-header__button--icon${isRefreshing ? ' app-header__button--spinning' : ''}`}
          onClick={() => void refresh({ silent: true })}
          disabled={!isAuthenticated || isRefreshing}
          title="Actualitza les dades d'Omni"
          aria-label="Actualitza les dades d'Omni"
        >
          <SfIcon sprite="utility" symbol="refresh" size={18} />
        </button>

        <GlobalSearch />

        {isLoading ? (
          <span className="app-header__status">Carregant sessió…</span>
        ) : isAuthenticated ? (
          <div className="app-header__user">
            <span>{userInfo?.name ?? (isMockMode ? 'Supervisor mock' : 'Usuari Salesforce')}</span>
            {!isMockMode ? (
              <button type="button" className="app-header__button" onClick={logout}>
                Logout
              </button>
            ) : null}
          </div>
        ) : isSalesforceEnabled && !authError ? (
          <span className="app-header__status">Redirigint a Salesforce…</span>
        ) : null}
      </div>
    </header>
  )
}
