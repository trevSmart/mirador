/* Settings — shared form building blocks.
   Each row is a label/description on the left and a control on the right.
   Controlled components throughout: the modal owns a draft object and passes
   value + onChange so the dirty-check and save are trivial. */

import { useId, type ReactNode } from 'react'

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
}: {
  title: string
  hint?: ReactNode
  control: ReactNode
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <strong>{title}</strong>
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
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
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
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  label: string
}) {
  return (
    <select
      className="settings-select"
      value={String(value)}
      onChange={(e) => {
        const raw = e.target.value
        const match = options.find((o) => String(o.value) === raw)
        if (match) onChange(match.value)
      }}
      aria-label={label}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  label,
  suffix,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  label: string
  suffix?: string
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
      />
      {suffix ? <span className="settings-number__suffix">{suffix}</span> : null}
    </span>
  )
}
