import { useMiradorStatus } from '../api/mirador-status-context'
import { useAuth } from '../auth/auth-context'
import panoramaLogo from '../assets/panorama/logo/panorama-logo.png'
import { useDevConsole } from '../dev/useDevConsole'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import { SfIcon } from './ds/SfIcon'
import { GlobalSearch } from './GlobalSearch'
import { HeaderClock } from './HeaderClock'
import { UserMenu } from './UserMenu'

export function AppHeader() {
  const { authError, isAuthenticated, isLoading, isMockMode, isSalesforceEnabled } = useAuth()
  const { isRefreshing, refresh } = useMiradorStatus()
  const { enabled: devMode } = useDeveloperMode()
  const { visible: consoleVisible, toggle: toggleConsole } = useDevConsole()

  return (
    <header className="app-header">
      <div className="app-header__left">
        <img className="app-header__logo" src={panoramaLogo} alt="Panorama" />
        {isMockMode ? (
          <span className="app-header__status" title="Dades simulades (mock)">
            Simulació
          </span>
        ) : null}
        {devMode ? (
          <span className="app-header__dev" title="Mode desenvolupador actiu">
            DEV
          </span>
        ) : null}
        {devMode ? (
          <button
            type="button"
            className={`app-header__button app-header__button--console${consoleVisible ? ' app-header__button--console-active' : ''}`}
            onClick={toggleConsole}
            title={consoleVisible ? 'Amaga la consola' : 'Mostra la consola'}
            aria-pressed={consoleVisible}
          >
            Console
          </button>
        ) : null}
      </div>

      <div className="app-header__center">
        <HeaderClock />
      </div>

      <div className="app-header__right">
        {!isMockMode && !isSalesforceEnabled ? (
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
          <SfIcon sprite="utility" symbol="refresh" size={12} />
        </button>

        <GlobalSearch />

        {isLoading ? (
          <span className="app-header__status">Carregant sessió…</span>
        ) : isAuthenticated ? (
          <UserMenu />
        ) : isSalesforceEnabled && !authError ? (
          <span className="app-header__status">Redirigint a Salesforce…</span>
        ) : null}
      </div>
    </header>
  )
}
