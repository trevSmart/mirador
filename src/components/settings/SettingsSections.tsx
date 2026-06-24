/* Settings — section bodies.
   Each section is a controlled view over the draft preferences. `patch` applies
   a partial update to the draft (the modal holds the draft + dirty state).
   The Connexió and Sobre sections are read-only info pulled from auth state. */

import { useAuth } from '../../auth/auth-context'
import { clearLocalData } from '../../utils/clear-local-data'
import { Button } from '../ds/Button'
import {
  REFRESH_OPTIONS,
  type FloorViewMode,
  type Lang,
  type Preferences,
  type TimeFormat,
} from '../../settings/preferences'
import {
  NumberField,
  SelectField,
  SettingsBadge,
  SettingsGroup,
  SettingsRow,
  TintSwatchField,
  ToggleField,
} from './parts'

const APP_VERSION = '0.1.0-alpha'

interface SectionProps {
  draft: Preferences
  patch: (partial: Partial<Preferences>) => void
}

function refreshLabel(seconds: number): string {
  if (seconds < 60) return `Cada ${seconds} s`
  if (seconds < 3600) return `Cada ${seconds / 60} min`
  return `Cada ${seconds / 3600} h`
}

export function ConnexioSection({ draft, patch }: SectionProps) {
  const { isMockMode, isServerMockMode, isSalesforceEnabled, session, userInfo } = useAuth()
  const instanceUrl = session?.instanceUrl ?? null
  const effectiveMock = isMockMode

  return (
    <>
      <SettingsGroup label="Font de dades">
        <SettingsRow
          title="Mode de simulació (mock)"
          hint="Usa dades locals de demostració sense connexió a Salesforce"
          control={
            <ToggleField
              label="Mode de simulació"
              checked={draft.mockOverride}
              onChange={(v) => patch({ mockOverride: v })}
              disabled={isServerMockMode}
            />
          }
        />
        <SettingsRow
          title="Font activa"
          hint="D'on s'obtenen les dades del centre"
          control={
            effectiveMock ? (
              <SettingsBadge tone="watch">Simulació (mock)</SettingsBadge>
            ) : (
              <SettingsBadge tone="ok">Salesforce</SettingsBadge>
            )
          }
        />
        <SettingsRow
          title="Estat de la connexió"
          hint="Comprovació en iniciar sessió"
          control={
            effectiveMock ? (
              <SettingsBadge tone="watch">Simulada</SettingsBadge>
            ) : session ? (
              <SettingsBadge tone="ok">Connectat</SettingsBadge>
            ) : (
              <SettingsBadge tone="off">Sense sessió</SettingsBadge>
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
            control={<SettingsBadge tone={instanceUrl ? 'ok' : 'off'}>{instanceUrl ?? '—'}</SettingsBadge>}
          />
          <SettingsRow
            title="Sessió activa"
            hint="Token d'accés OAuth"
            control={
              <SettingsBadge tone={session ? 'ok' : 'off'}>{session ? 'Activa' : 'No autenticat'}</SettingsBadge>
            }
          />
          <SettingsRow
            title="Usuari"
            hint="Compte autenticat"
            control={<span className="settings-text">{userInfo?.email ?? userInfo?.name ?? '—'}</span>}
          />
        </SettingsGroup>
      ) : null}
    </>
  )
}

export function DadesSection({ draft, patch }: SectionProps) {
  return (
    <>
      <SettingsGroup label="Actualització">
        <SettingsRow
          title="Interval de refresc"
          hint="Cada quant s'actualitzen agents i cues"
          control={
            <SelectField
              label="Interval de refresc"
              value={draft.refreshInterval}
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
              checked={draft.autoRefresh}
              onChange={(v) => patch({ autoRefresh: v })}
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
              value={draft.maxWaitSeconds}
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
              value={draft.slaTarget}
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
              value={draft.alertPct}
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

export function AparencaSection({ draft, patch }: SectionProps) {
  return (
    <>
      <SettingsGroup label="Visualització">
        <SettingsRow
          title="Fons de les sales"
          hint="To del gradient darrere els renders de planta"
          control={
            <TintSwatchField
              value={draft.floorCanvasTint}
              onChange={(v) => patch({ floorCanvasTint: v })}
            />
          }
        />
        <SettingsRow
          title="Vista de planta per defecte"
          hint="Mode amb què s'obre el panell Floor"
          control={
            <SelectField<FloorViewMode>
              label="Vista de planta per defecte"
              value={draft.defaultFloorView}
              onChange={(v) => patch({ defaultFloorView: v })}
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
              checked={draft.animations}
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
              value={draft.lang}
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
        <SettingsRow
          title="Format horari"
          control={
            <SelectField<TimeFormat>
              label="Format horari"
              value={draft.timeFormat}
              onChange={(v) => patch({ timeFormat: v })}
              options={[
                { value: '24h', label: '24 h' },
                { value: '12h', label: '12 h (AM/PM)' },
              ]}
            />
          }
        />
      </SettingsGroup>
    </>
  )
}

export function NotificacionsSection({ draft, patch }: SectionProps) {
  return (
    <SettingsGroup label="Alertes del sistema">
      <SettingsRow
        title="Notificacions del navegador"
        hint="Permetre notificacions push quan la pestanya no és visible"
        comingSoon
        control={
          <ToggleField
            label="Notificacions del navegador"
            checked={draft.browserNotifs}
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
            checked={draft.queueAlert}
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
            checked={draft.agentOfflineAlert}
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
            checked={draft.soundAlert}
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
