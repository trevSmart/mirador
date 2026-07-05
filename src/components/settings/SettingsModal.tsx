/* Settings modal — shell.
   Holds a draft copy of the live preferences while open, a section nav, and a
   dirty-aware close (confirm-on-discard). Save persists the draft via
   usePreferences().save and closes. The Developer nav item only appears when
   developer mode is on. Like the detail drawer, derived-from-prop state is
   adjusted during render rather than in an effect. */

import { useEffect, useState, type ReactNode } from 'react'
import { useDeveloperMode } from '../../hooks/useDeveloperMode'
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

  // Draft + active section reset each time the modal transitions to open.
  // The baseline is snapshotted at open time so dirtiness reflects the user's
  // own edits, not external prefs changes (e.g. a cross-tab storage sync).
  const [draft, setDraft] = useState<Preferences>(prefs)
  const [baseline, setBaseline] = useState<Preferences>(prefs)
  const [section, setSection] = useState<SettingsSectionId>(initialSection)
  const [wasOpen, setWasOpen] = useState(false)
  if (isOpen && !wasOpen) {
    setWasOpen(true)
    setDraft(prefs)
    setBaseline(prefs)
    setSection(initialSection)
  } else if (!isOpen && wasOpen) {
    setWasOpen(false)
  }

  const dirty = !prefsEqual(draft, baseline)

  function requestClose() {
    if (dirty && !window.confirm('Tens canvis sense desar. Tancar igualment?')) return
    close()
  }

  // Escape closes (respecting the dirty guard).
  useEffect(() => {
    if (!isOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, dirty])

  function patch(partial: Partial<Preferences>) {
    setDraft((prev) => ({ ...prev, ...partial }))
  }

  function handleSave() {
    save(draft)
    close()
  }

  function handleReset() {
    setDraft({ ...PREFERENCES_DEFAULTS })
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
      body = <DadesSection draft={draft} patch={patch} />
      break
    case 'aparenca':
      body = <AparencaSection draft={draft} patch={patch} />
      break
    case 'notificacions':
      body = <NotificacionsSection draft={draft} patch={patch} />
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
        if (e.target === e.currentTarget) requestClose()
      }}
      aria-hidden={!isOpen}
    >
      <div
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
            onClick={requestClose}
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
            Restaura els valors per defecte
          </Button>
          <Button variant="ghost" onClick={requestClose}>
            Cancel·la
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!dirty}>
            Desa els canvis
          </Button>
        </footer>
      </div>
    </div>
  )
}
