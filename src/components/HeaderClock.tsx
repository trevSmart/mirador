import { useEffect, useMemo, useState } from 'react'
import { usePreferences } from '../settings/preferences-context'

const LOCALE = 'ca'

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function HeaderClock() {
  const { prefs } = usePreferences()
  const [now, setNow] = useState(() => new Date())

  // Time format follows the user's preference (Settings → Aparença).
  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(LOCALE, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: prefs.timeFormat === '12h',
      }),
    [prefs.timeFormat],
  )

  useEffect(() => {
    const tick = () => setNow(new Date())
    tick()

    let timeoutId = 0
    const scheduleNext = () => {
      const msUntilNextMinute = 60_000 - (Date.now() % 60_000)
      timeoutId = window.setTimeout(() => {
        tick()
        scheduleNext()
      }, msUntilNextMinute)
    }
    scheduleNext()

    return () => window.clearTimeout(timeoutId)
  }, [])

  const datePart = capitalizeFirst(dateFormatter.format(now))
  const timePart = timeFormatter.format(now)

  return (
    <time className="app-header__clock" dateTime={now.toISOString()}>
      {`${datePart} · ${timePart}`}
    </time>
  )
}
