/* Settings — shared form building blocks.
   Each row is a label/description on the left and a control on the right.
   Controlled components throughout: the modal owns a draft object and passes
   value + onChange so the dirty-check and save are trivial. */

import { useId, type ReactNode } from 'react'
import { Select } from '../ds/Select'

export function SettingsGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <div className="settings-group__label">{label}</div>
      {children}
    </div>
  )
}

export function SettingsRow({
  title,
  hint,
  control,
  comingSoon = false,
}: {
  title: string
  hint?: ReactNode
  control: ReactNode
  /** Mark the row as not-yet-functional: dimmed + a "Pròximament" tag. */
  comingSoon?: boolean
}) {
  return (
    <div className={`settings-row${comingSoon ? ' settings-row--soon' : ''}`}>
      <div className="settings-row__label">
        <strong>
          {title}
          {comingSoon ? <span className="settings-soon-tag">Pròximament</span> : null}
        </strong>
        {hint ? <span>{hint}</span> : null}
      </div>
      <div className="settings-row__control">{control}</div>
    </div>
  )
}

type BadgeTone = 'ok' | 'watch' | 'off'

export function SettingsBadge({ tone = 'off', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`settings-badge settings-badge--${tone}`}>{children}</span>
}

export function ToggleField({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <label className="settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        disabled={disabled}
      />
      <span className="settings-toggle__track" />
    </label>
  )
}

export function SelectField<T extends string | number>({
  value,
  onChange,
  options,
  label,
  disabled = false,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  label: string
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={label}
      disabled={disabled}
      className="settings-select"
      minWidth={150}
    />
  )
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  label,
  suffix,
  disabled = false,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  label: string
  suffix?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <span className="settings-number">
      <input
        id={id}
        type="number"
        className="settings-input"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        aria-label={label}
        disabled={disabled}
      />
      {suffix ? <span className="settings-number__suffix">{suffix}</span> : null}
    </span>
  )
}
