/* Settings modal — shell.
   Settings apply live: every edit persists immediately via usePreferences().save,
   so the app reflects changes as they are made. A snapshot of the preferences
   taken when the modal opens backs the "Desfés els canvis" button, which
   restores the state that was in force at open time. The Developer nav item
   only appears when developer mode is on. Like the detail drawer,
   derived-from-prop state is adjusted during render rather than in an effect. */

import { useEffect, useState, type ReactNode } from 'react'
import { useDeveloperMode } from '../../hooks/useDeveloperMode'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { usePreferences } from '../../settings/preferences-context'
import { PREFERENCES_DEFAULTS, type Preferences } from '../../settings/preferences'
import { useSettingsModal, type SettingsSectionId } from '../../settings/settings-modal-context'
import { Button } from '../ds/Button'
import { AppIcon } from '../ds/AppIcon'
import type { AppIconName } from '../ds/app-icon-names.generated'
import {
  AparencaSection,
  ConnexioSection,
  DadesSection,
  DeveloperSection,
  NotificacionsSection,
  SobreSection,
} from './SettingsSections'

interface NavItem {
  id: SettingsSectionId
  label: string
  symbol: AppIconName
  devOnly?: boolean
}

const NAV: NavItem[] = [
  { id: 'aparenca', label: 'Aparença', symbol: 'brush' },
  { id: 'dades', label: 'Dades', symbol: 'database' },
  { id: 'notificacions', label: 'Notificacions', symbol: 'notification' },
  { id: 'connexio', label: 'Connexió', symbol: 'link' },
  { id: 'developer', label: 'Developer', symbol: 'builder', devOnly: true },
  { id: 'sobre', label: 'Sobre', symbol: 'info' },
]

function prefsEqual(a: Preferences, b: Preferences): boolean {
  // Iterate the canonical key set so a key missing from either object can't
  // make two differing objects compare equal.
  const keys = Object.keys(PREFERENCES_DEFAULTS) as Array<keyof Preferences>
  return keys.every((k) => a[k] === b[k])
}

export function SettingsModal() {
  const { isOpen, initialSection, close } = useSettingsModal()
  const { prefs, save } = usePreferences()
  const { enabled: devMode } = useDeveloperMode()
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen)

  // Baseline + active section reset each time the modal transitions to open.
  // The baseline is snapshotted at open time so "Desfés els canvis" restores
  // what was in force when the user started editing.
  const [baseline, setBaseline] = useState<Preferences>(prefs)
  const [section, setSection] = useState<SettingsSectionId>(initialSection)
  const [wasOpen, setWasOpen] = useState(false)
  if (isOpen && !wasOpen) {
    setWasOpen(true)
    setBaseline(prefs)
    setSection(initialSection)
  } else if (!isOpen && wasOpen) {
    setWasOpen(false)
  }

  const canUndo = !prefsEqual(prefs, baseline)

  // Escape closes.
  useEffect(() => {
    if (!isOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  function patch(partial: Partial<Preferences>) {
    save({ ...prefs, ...partial })
  }

  function handleUndo() {
    save(baseline)
  }

  function handleReset() {
    save({ ...PREFERENCES_DEFAULTS })
  }

  // If dev mode turns off while sitting on the Developer section, bounce away.
  const activeSection: SettingsSectionId =
    section === 'developer' && !devMode ? 'connexio' : section

  const items = NAV.filter((item) => !item.devOnly || devMode)

  let body: ReactNode = null
  switch (activeSection) {
    case 'connexio':
      body = <ConnexioSection />
      break
    case 'dades':
      body = <DadesSection prefs={prefs} patch={patch} />
      break
    case 'aparenca':
      body = <AparencaSection prefs={prefs} patch={patch} />
      break
    case 'notificacions':
      body = <NotificacionsSection prefs={prefs} patch={patch} />
      break
    case 'developer':
      body = <DeveloperSection />
      break
    case 'sobre':
      body = <SobreSection />
      break
  }

  return (
    <div
      className={`settings-backdrop${isOpen ? ' is-open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      aria-hidden={!isOpen}
    >
      <div
        ref={trapRef}
        className={`settings-modal${isOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Configuració"
      >
        <header className="settings-modal__head">
          <span className="settings-modal__title">Configuració</span>
          <button
            type="button"
            className="settings-modal__close"
            onClick={close}
            aria-label="Tanca la configuració"
          >
            <AppIcon name="close" size={15} />
          </button>
        </header>

        <div className="settings-modal__body">
          <nav className="settings-nav" aria-label="Seccions">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`settings-nav__item${activeSection === item.id ? ' is-active' : ''}`}
                onClick={() => setSection(item.id)}
              >
                <AppIcon name={item.symbol} size={15} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">{body}</div>
        </div>

        <footer className="settings-modal__foot">
          <Button
            variant="ghost"
            className="settings-modal__reset"
            onClick={handleReset}
          >
            Valors per defecte
          </Button>
          <Button variant="ghost" onClick={handleUndo} disabled={!canUndo}>
            Desfés els canvis
          </Button>
          <Button variant="primary" onClick={close}>
            Fet
          </Button>
        </footer>
      </div>
    </div>
  )
}
