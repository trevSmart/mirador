// Chrome's back/forward cache freezes the whole JS heap and DOM at the moment
// of navigation. Hitting "back" after a Salesforce logout redirect restores
// that frozen snapshot instead of re-running our auth bootstrap, so the user
// sees the pre-logout error screen and it looks like the escape hatch failed.
// Forcing a real reload on restore makes "back" re-evaluate auth state fresh.
export function handleBfcacheRestore(event: PageTransitionEvent, reload: () => void) {
  if (event.persisted) {
    reload()
  }
}

export function installBfcacheReload() {
  window.addEventListener('pageshow', (event) => {
    handleBfcacheRestore(event, () => window.location.reload())
  })
}
