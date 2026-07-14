/* Settings — section bodies.
   Each section is a controlled view over the live preferences. `patch` applies
   a partial update that persists immediately (the modal wires it to save and
   keeps the open-time baseline for undo).
   The Connexió and Sobre sections are read-only info pulled from auth state. */

import { useAuth } from '../../auth/auth-context'
import { useDataStatus } from '../../api/data-hooks'
import { resolveTheme, systemDarkQuery } from '../../settings/theme'
import { clearLocalData } from '../../utils/clear-local-data'
import { Button } from '../ds/Button'
import {
  REFRESH_OPTIONS,
  type SpaceViewMode,
  type Lang,
  type Preferences,
  type ThemePreference,
} from '../../settings/preferences'
import {
  NumberField,
  SegmentedField,
  SelectField,
  SettingsBadge,
  SettingsGroup,
  SettingsRow,
  TintSwatchField,
  ToggleField,
} from './parts'

const APP_VERSION = '0.1.0-alpha'

interface SectionProps {
  prefs: Preferences
  patch: (partial: Partial<Preferences>) => void
}

function refreshLabel(seconds: number): string {
  if (seconds < 60) return `Cada ${seconds} s`
  if (seconds < 3600) return `Cada ${seconds / 60} min`
  return `Cada ${seconds / 3600} h`
}

export function ConnexioSection() {
  const { isMockMode, isSalesforceEnabled, session, userInfo, logout } = useAuth()
  // Real reachability, not just "is there a token": a saved OAuth session can
  // coexist with a failing data fetch (expired/revoked token, org down, API
  // error). The data feed is the source of truth for "are we actually connected".
  const { isLoading: isProbing, error: dataError } = useDataStatus()
  const instanceUrl = session?.instanceUrl ?? null
  const effectiveMock = isMockMode

  return (
    <>
      <SettingsGroup label="Font de dades">
        <SettingsRow
          title="Origen de dades actual"
          hint="D'on s'obtenen les dades del centre"
          control={
            effectiveMock ? (
              <SettingsBadge tone="watch">Simulació (mock)</SettingsBadge>
            ) : (
              <SettingsBadge tone="off">Salesforce</SettingsBadge>
            )
          }
        />
        <SettingsRow
          title="Estat de la connexió"
          hint={
            !effectiveMock && dataError ? (
              <span className="settings-error-text">{dataError}</span>
            ) : (
              'Comprovació en iniciar sessió'
            )
          }
          control={
            effectiveMock ? (
              <SettingsBadge tone="watch">Simulada</SettingsBadge>
            ) : !session ? (
              <SettingsBadge tone="off">Sense sessió</SettingsBadge>
            ) : isProbing ? (
              <SettingsBadge tone="watch">Comprovant…</SettingsBadge>
            ) : dataError ? (
              <SettingsBadge tone="off">Error de connexió</SettingsBadge>
            ) : (
              <SettingsBadge tone="ok">Connectat</SettingsBadge>
            )
          }
        />
      </SettingsGroup>

      {!effectiveMock ? (
        <SettingsGroup label="Salesforce">
          <SettingsRow
            title="Connected App"
            hint="Configurada al servidor"
            control={
              <SettingsBadge tone={isSalesforceEnabled ? 'ok' : 'off'}>
                {isSalesforceEnabled ? 'Configurada' : 'No configurada'}
              </SettingsBadge>
            }
          />
          <SettingsRow
            title="Instància"
            hint="URL de l'org connectada"
            control={
              instanceUrl ? (
                <span className="settings-text">{instanceUrl}</span>
              ) : (
                <SettingsBadge tone="off">—</SettingsBadge>
              )
            }
          />
          <SettingsRow
            title="Sessió activa"
            hint="Token d'accés OAuth"
            control={
              !session ? (
                <SettingsBadge tone="off">No autenticat</SettingsBadge>
              ) : dataError ? (
                <SettingsBadge tone="watch">Pot haver caducat</SettingsBadge>
              ) : (
                <SettingsBadge tone="ok">Activa</SettingsBadge>
              )
            }
          />
          <SettingsRow
            title="Usuari"
            hint="Compte autenticat"
            control={<span className="settings-text">{userInfo?.email ?? userInfo?.name ?? '—'}</span>}
          />
        </SettingsGroup>
      ) : null}

      {!effectiveMock ? (
        <SettingsGroup label="Zona perillosa">
          <SettingsRow
            title="Esborra el token d'autenticació"
            hint="Elimina el token OAuth desat en aquest navegador i tanca la sessió. Hauràs de tornar a autenticar-te a Salesforce."
            control={
              <Button variant="danger" onClick={handleClearAuthToken(logout)} disabled={!session}>
                Esborra el token
              </Button>
            }
          />
        </SettingsGroup>
      ) : null}
    </>
  )
}

function handleClearAuthToken(logout: () => void) {
  return () => {
    const confirmed = window.confirm(
      "Això esborrarà el token d'autenticació desat i tancarà la sessió. " +
        "Hauràs de tornar a autenticar-te a Salesforce.\n\nVols continuar?",
    )
    if (!confirmed) return
    logout()
  }
}

export function DadesSection({ prefs, patch }: SectionProps) {
  const { isServerMockMode } = useAuth()

  return (
    <>
      <SettingsGroup label="Font de dades">
        <SettingsRow
          title="Mode de simulació (mock)"
          hint="Usa dades locals de demostració sense connexió a Salesforce"
          control={
            <ToggleField
              label="Mode de simulació"
              checked={prefs.mockOverride}
              onChange={(v) => patch({ mockOverride: v })}
              disabled={isServerMockMode}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Actualització">
        <SettingsRow
          title="Interval de refresc"
          hint="Cada quant s'actualitzen agents i cues"
          control={
            <SelectField
              label="Interval de refresc"
              value={prefs.refreshInterval}
              onChange={(v) => patch({ refreshInterval: v })}
              options={REFRESH_OPTIONS.map((s) => ({ value: s, label: refreshLabel(s) }))}
            />
          }
        />
        <SettingsRow
          title="Refresc automàtic"
          hint="Actualitzar en segon pla mentre la pestanya és activa"
          control={
            <ToggleField
              label="Refresc automàtic"
              checked={prefs.autoRefresh}
              onChange={(v) => patch({ autoRefresh: v })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Agents">
        <SettingsRow
          title="Mostra els agents desconnectats"
          hint="Inclou els agents sense connexió a Omni-Channel (Service Resources actius). Si es desactiva, només es mostren els agents connectats."
          control={
            <ToggleField
              label="Mostra els agents desconnectats"
              checked={prefs.showOfflineAgents}
              onChange={(v) => patch({ showOfflineAgents: v })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Umbrals d'alerta">
        <SettingsRow
          title="Temps màxim d'espera"
          hint="Llindar per marcar una cua en alerta"
          comingSoon
          control={
            <NumberField
              label="Temps màxim d'espera"
              value={prefs.maxWaitSeconds}
              onChange={(v) => patch({ maxWaitSeconds: v })}
              min={30}
              max={3600}
              suffix="s"
              disabled
            />
          }
        />
        <SettingsRow
          title="SLA objectiu"
          hint="Percentatge d'objectiu de nivell de servei"
          comingSoon
          control={
            <NumberField
              label="SLA objectiu"
              value={prefs.slaTarget}
              onChange={(v) => patch({ slaTarget: v })}
              min={50}
              max={100}
              suffix="%"
              disabled
            />
          }
        />
        <SettingsRow
          title="Agents en alerta"
          hint="Proporció d'agents en alerta per activar l'avís global"
          comingSoon
          control={
            <NumberField
              label="Agents en alerta"
              value={prefs.alertPct}
              onChange={(v) => patch({ alertPct: v })}
              min={5}
              max={100}
              suffix="%"
              disabled
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Zona perillosa">
        <SettingsRow
          title="Esborra totes les dades locals"
          hint="Elimina preferències, sessió, layout i la resta de dades desades en aquest navegador i reinicia l'app des de zero. El plànol de planta es manté. Aquesta acció no es pot desfer."
          control={
            <Button variant="danger" onClick={handleClearLocalData}>
              Esborra-ho tot
            </Button>
          }
        />
      </SettingsGroup>
    </>
  )
}

function handleClearLocalData() {
  const confirmed = window.confirm(
    'Això esborrarà les dades locals (preferències, sessió, layout…) i reiniciarà ' +
      "l'app des de zero. El plànol de planta es manté. Aquesta acció no es pot desfer." +
      '\n\nVols continuar?',
  )
  if (!confirmed) return
  clearLocalData()
  window.location.reload()
}

export function AparencaSection({ prefs, patch }: SectionProps) {
  return (
    <>
      <SettingsGroup label="Visualització">
        <SettingsRow
          title="Tema"
          hint="Clar, fosc o segons l'aparença del sistema"
          control={
            <SegmentedField<ThemePreference>
              label="Tema"
              value={prefs.theme}
              onChange={(v) => patch({ theme: v })}
              options={[
                { value: 'light', label: 'Clar', icon: 'sun' },
                { value: 'system', label: 'Sistema', icon: 'display' },
                { value: 'dark', label: 'Fosc', icon: 'moon' },
              ]}
            />
          }
        />
        <SettingsRow
          title="Tenyeix les icones dels registres"
          hint="Aplica el color del registre a la icona i al nom. Si es desactiva, la icona manté el color oficial de Salesforce i només el nom queda acolorit."
          control={
            <ToggleField
              label="Tenyeix les icones dels registres"
              checked={prefs.tintRecordIcons}
              onChange={(v) => patch({ tintRecordIcons: v })}
            />
          }
        />
        <SettingsRow
          title="Fons de les sales"
          hint="To del gradient darrere els renders de planta"
          control={
            <TintSwatchField
              value={prefs.spaceCanvasTint}
              onChange={(v) => patch({ spaceCanvasTint: v })}
              theme={resolveTheme(prefs.theme, systemDarkQuery()?.matches ?? false)}
            />
          }
        />
        <SettingsRow
          title="Vista de planta per defecte"
          hint="Mode amb què s'obre el panell Space"
          control={
            <SelectField<SpaceViewMode>
              label="Vista de planta per defecte"
              value={prefs.defaultSpaceView}
              onChange={(v) => patch({ defaultSpaceView: v })}
              options={[
                { value: '2d', label: '2D (planta)' },
                { value: '3d', label: '3D (isomètric)' },
              ]}
            />
          }
        />
        <SettingsRow
          title="Animacions 3D"
          hint="Torres animades i beacons a la vista 3D"
          control={
            <ToggleField
              label="Animacions 3D"
              checked={prefs.animations}
              onChange={(v) => patch({ animations: v })}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup label="Idioma i format">
        <SettingsRow
          title="Idioma de la interfície"
          comingSoon
          control={
            <SelectField<Lang>
              label="Idioma de la interfície"
              value={prefs.lang}
              onChange={(v) => patch({ lang: v })}
              options={[
                { value: 'ca', label: 'Català' },
                { value: 'es', label: 'Castellà' },
                { value: 'en', label: 'English' },
              ]}
              disabled
            />
          }
        />
      </SettingsGroup>
    </>
  )
}

export function NotificacionsSection({ prefs, patch }: SectionProps) {
  return (
    <SettingsGroup label="Alertes del sistema">
      <SettingsRow
        title="Notificacions del navegador"
        hint="Permetre notificacions push quan la pestanya no és visible"
        comingSoon
        control={
          <ToggleField
            label="Notificacions del navegador"
            checked={prefs.browserNotifs}
            onChange={(v) => patch({ browserNotifs: v })}
            disabled
          />
        }
      />
      <SettingsRow
        title="Alerta de cua crítica"
        hint="Notificar quan una cua supera el temps màxim d'espera"
        comingSoon
        control={
          <ToggleField
            label="Alerta de cua crítica"
            checked={prefs.queueAlert}
            onChange={(v) => patch({ queueAlert: v })}
            disabled
          />
        }
      />
      <SettingsRow
        title="Alerta d'agent desconnectat"
        hint="Notificar quan un agent passa a offline inesperat"
        comingSoon
        control={
          <ToggleField
            label="Alerta d'agent desconnectat"
            checked={prefs.agentOfflineAlert}
            onChange={(v) => patch({ agentOfflineAlert: v })}
            disabled
          />
        }
      />
      <SettingsRow
        title="So d'alerta"
        hint="Reproduir un so en una notificació crítica"
        comingSoon
        control={
          <ToggleField
            label="So d'alerta"
            checked={prefs.soundAlert}
            onChange={(v) => patch({ soundAlert: v })}
            disabled
          />
        }
      />
    </SettingsGroup>
  )
}

export function DeveloperSection() {
  return (
    <SettingsGroup label="Mode desenvolupador">
      <div className="settings-info">
        El mode desenvolupador està actiu. Es commuta des del menú d'usuari i mostra l'indicador{' '}
        <strong>DEV</strong> a la capçalera.
      </div>
    </SettingsGroup>
  )
}

export function SobreSection() {
  const { isMockMode, userInfo } = useAuth()

  return (
    <>
      <SettingsGroup label="Mirador">
        <div className="settings-info">
          <strong>Mirador — Supervisor d'operacions</strong>
          <br />
          Plataforma de supervisió en temps real per a centres d'atenció i operacions de servei.
          <br />
          <br />
          <strong>Versió:</strong> {APP_VERSION}
          <br />
          <strong>Entorn:</strong> {isMockMode ? 'Simulació (mock)' : 'Salesforce'}
        </div>
      </SettingsGroup>

      <SettingsGroup label="Sessió">
        <SettingsRow
          title="Usuari actiu"
          hint="Compte autenticat"
          control={<span className="settings-text">{userInfo?.name ?? '—'}</span>}
        />
      </SettingsGroup>
    </>
  )
}
