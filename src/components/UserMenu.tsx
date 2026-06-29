import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { useDeveloperMode } from '../hooks/useDeveloperMode'
import { useSettingsModal } from '../settings/settings-modal-context'
import { syncDropdownPanel } from '../utils/sync-dropdown-panel'
import { AgentAvatar } from './AgentRow'
import { SfIcon } from './ds/SfIcon'

export function UserMenu() {
  const { userInfo, session, logout } = useAuth()
  const dev = useDeveloperMode()
  const settings = useSettingsModal()
  const [open, setOpen] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const name = userInfo?.name ?? 'Usuari Salesforce'
  const secondary = userInfo?.email ?? 'Salesforce'
  const photo = userInfo?.picture ?? null
  const instanceUrl = session?.instanceUrl ?? null

  // Animate the dropdown open/close (shared helper used by GlobalSearch too).
  useEffect(() => {
    closeTimeoutRef.current = syncDropdownPanel(dropRef.current, open, {
      closeTimeoutId: closeTimeoutRef.current,
    })
  }, [open])

  // Close on outside click or Escape.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const openExternal = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }, [])

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú d'usuari: ${name}`}
        onClick={() => setOpen((value) => !value)}
      >
        <AgentAvatar id={userInfo?.user_id ?? 'mirador-user'} name={name} photo={photo} />
      </button>

      <div ref={dropRef} className="user-menu__dropdown dropdown-panel" role="menu" hidden>
        <div className="user-menu__header">
          <div className="user-menu__id">
            <span className="user-menu__name">{name}</span>
            <span className="user-menu__email">{secondary}</span>
          </div>
        </div>

        <div className="user-menu__sep" />
        <button
          type="button"
          role="menuitem"
          className="user-menu__item"
          onClick={() => {
            setOpen(false)
            settings.open()
          }}
        >
          <SfIcon sprite="utility" symbol="settings" size={16} />
          Configuració
        </button>

        {instanceUrl ? (
          <>
            <div className="user-menu__sep" />
            <button
              type="button"
              role="menuitem"
              className="user-menu__item"
              onClick={() => openExternal(instanceUrl)}
            >
              <SfIcon sprite="utility" symbol="salesforce1" size={16} />
              Obre Salesforce
            </button>
            <button
              type="button"
              role="menuitem"
              className="user-menu__item"
              onClick={() => openExternal(`${instanceUrl}/lightning/setup/SetupOneHome/home`)}
            >
              <SfIcon sprite="utility" symbol="setup" size={16} />
              Obre Salesforce Setup
            </button>
          </>
        ) : null}

        <div className="user-menu__sep" />
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={dev.enabled}
          className="user-menu__item"
          onClick={() => dev.toggle()}
        >
          <SfIcon sprite="utility" symbol="apex" size={16} />
          Mode desenvolupador
          <span
            className={`user-menu__switch${dev.enabled ? ' user-menu__switch--on' : ''}`}
            aria-hidden="true"
          />
        </button>

        <div className="user-menu__sep" />
        <button
          type="button"
          role="menuitem"
          className="user-menu__item user-menu__item--danger"
          onClick={() => {
            setOpen(false)
            logout()
          }}
        >
          <SfIcon sprite="utility" symbol="logout" size={16} />
          Logout
        </button>
      </div>
    </div>
  )
}
