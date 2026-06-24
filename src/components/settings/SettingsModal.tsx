/* Settings modal — shell.
   Holds a draft copy of the live preferences while open, a section nav, and a
   dirty-aware close (confirm-on-discard). Save persists the draft via
   usePreferences().save and closes. The Developer nav item only appears when
   developer mode is on. Like the detail drawer, derived-from-prop state is
   adjusted during render rather than in an effect. */

import { useEffect, useState, type ReactNode } from 'react'
import { useDeveloperMode } from '../../hooks/useDeveloperMode'
import { usePreferences } from '../../settings/preferences-context'
import type { Preferences } from '../../settings/preferences'
import { useSettingsModal, type SettingsSectionId } from '../../settings/settings-modal-context'
import { Button } from '../ds/Button'
import { SfIcon } from '../ds/SfIcon'
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
  symbol: string
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
  const keys = Object.keys(a) as Array<keyof Preferences>
  return keys.every((k) => a[k] === b[k])
}

export function SettingsModal() {
  const { isOpen, initialSection, close } = useSettingsModal()
  const { prefs, save } = usePreferences()
  const { enabled: devMode } = useDeveloperMode()

  // Draft + active section reset each time the modal transitions to open.
  const [draft, setDraft] = useState<Preferences>(prefs)
  const [section, setSection] = useState<SettingsSectionId>(initialSection)
  const [wasOpen, setWasOpen] = useState(false)
  if (isOpen && !wasOpen) {
    setWasOpen(true)
    setDraft(prefs)
    setSection(initialSection)
  } else if (!isOpen && wasOpen) {
    setWasOpen(false)
  }

  const dirty = !prefsEqual(draft, prefs)

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

  // If dev mode turns off while sitting on the Developer section, bounce away.
  const activeSection: SettingsSectionId =
    section === 'developer' && !devMode ? 'connexio' : section

  const items = NAV.filter((item) => !item.devOnly || devMode)

  let body: ReactNode = null
  switch (activeSection) {
    case 'connexio':
      body = <ConnexioSection draft={draft} patch={patch} />
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
            <SfIcon sprite="utility" symbol="close" size={15} />
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
                <SfIcon sprite="utility" symbol={item.symbol} size={15} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="settings-content">{body}</div>
        </div>

        <footer className="settings-modal__foot">
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
