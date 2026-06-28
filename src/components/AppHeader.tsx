import { useEffect, useRef, useState } from 'react'
import { useDataStatus } from '../api/data-hooks'
import { formatRelativeTime } from '../utils/relative-time'
import { useAuth } from '../auth/auth-context'
import miradorLogo from '../assets/mirador/logo/mirador-logo.png'
import { useDevConsole } from '../dev/useDevConsole'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import { SfIcon } from './ds/SfIcon'
import { GlobalSearch } from './GlobalSearch'
import { HeaderClock } from './HeaderClock'
import { UserMenu } from './UserMenu'

export function AppHeader() {
  const { isAuthenticated, isLoading, isMockMode, isSalesforceEnabled } = useAuth()
  const { isRefreshing, refresh, dataUpdatedAt } = useDataStatus()
  const { enabled: devMode } = useDeveloperMode()
  const { visible: consoleVisible, toggle: toggleConsole } = useDevConsole()

  // Keep the icon spinning in whole turns: start as soon as a refresh begins,
  // but only stop on a rotation boundary (animationiteration) so it never
  // freezes mid-turn even when the fetch resolves near-instantly.
  const [spinning, setSpinning] = useState(false)
  const stopRequestedRef = useRef(false)

  useEffect(() => {
    if (isRefreshing) {
      stopRequestedRef.current = false
      // Sincronitza l'estat del gir amb el prop extern isRefreshing (cas legítim
      // d'efecte: sincronitzar React amb un sistema extern, ací el context d'estat).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSpinning(true)
    } else {
      // Refresh finished — let the current rotation complete before stopping.
      stopRequestedRef.current = true
    }
  }, [isRefreshing])

  const handleSpinIteration = () => {
    if (stopRequestedRef.current) {
      stopRequestedRef.current = false
      setSpinning(false)
    }
  }

  // Re-render every 20 s so the relative "fa X" label stays current without
  // re-fetching data. `now` is read at render time below.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [dataUpdatedAt])

  const lastRefreshLabel =
    dataUpdatedAt > 0 ? `Actualitzat ${formatRelativeTime(dataUpdatedAt, now)}` : null
  const refreshTitle = lastRefreshLabel
    ? `Actualitza les dades d'Omni — ${lastRefreshLabel.toLowerCase()}`
    : "Actualitza les dades d'Omni"

  return (
    <header className="app-header">
      <div className="app-header__left">
        <img className="app-header__logo" src={miradorLogo} alt="Mirador" />
        {isMockMode ? (
          <span className="app-header__status" title="Dades simulades (mock)">
            Simulació
          </span>
        ) : null}
        {devMode ? (
          <button
            type="button"
            className={`app-header__dev${consoleVisible ? ' app-header__dev--active' : ''}`}
            onClick={toggleConsole}
            title={consoleVisible ? 'Amaga la consola' : 'Mostra la consola'}
            aria-pressed={consoleVisible}
          >
            DEV
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

        <button
          type="button"
          className={`app-header__button app-header__button--icon${lastRefreshLabel ? ' app-header__button--with-label' : ''}${spinning ? ' app-header__button--spinning' : ''}`}
          onClick={() => void refresh()}
          onAnimationIteration={handleSpinIteration}
          disabled={!isAuthenticated || isRefreshing}
          aria-label={refreshTitle}
        >
          <SfIcon sprite="utility" symbol="refresh" size={12} />
          {lastRefreshLabel ? (
            <span className="app-header__button-label">{lastRefreshLabel}</span>
          ) : null}
        </button>

        <GlobalSearch />

        {isLoading ? (
          <span className="app-header__status">Carregant sessió…</span>
        ) : isAuthenticated ? (
          <UserMenu />
        ) : null}
      </div>
    </header>
  )
}
