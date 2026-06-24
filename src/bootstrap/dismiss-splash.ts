const SPLASH_EXIT_MS = 520

export function dismissAppSplash() {
  const splash = document.getElementById('app-splash')
  if (!splash) return

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
