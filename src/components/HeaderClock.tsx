import { useEffect, useState } from 'react'

const LOCALE = 'ca'

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatLocalDateTime(date: Date): string {
  const datePart = capitalizeFirst(dateFormatter.format(date))
  const timePart = timeFormatter.format(date)
  return `${datePart} · ${timePart}`
}

export function HeaderClock() {
  const [now, setNow] = useState(() => new Date())

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

  return (
    <time className="app-header__clock" dateTime={now.toISOString()}>
      {formatLocalDateTime(now)}
    </time>
  )
}
