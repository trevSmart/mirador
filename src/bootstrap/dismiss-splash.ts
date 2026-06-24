const MIN_SPLASH_MS = 600
const SPLASH_EXIT_MS = 520

function splashElapsedMs() {
  const start = Number(document.getElementById('app-splash')?.dataset.shownAt)
  if (!Number.isFinite(start)) return 0
  return performance.now() - start
}

function beginSplashExit(splash: HTMLElement) {
  const remove = () => {
    splash.remove()
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      splash.classList.add('app-splash--exiting')
      splash.setAttribute('aria-hidden', 'true')
      splash.addEventListener('transitionend', remove, { once: true })
      window.setTimeout(remove, SPLASH_EXIT_MS)
    })
  })
}

export function dismissAppSplash() {
  const splash = document.getElementById('app-splash')
  if (!splash) return

  const waitMs = Math.max(0, MIN_SPLASH_MS - splashElapsedMs())
  window.setTimeout(() => beginSplashExit(splash), waitMs)
}
