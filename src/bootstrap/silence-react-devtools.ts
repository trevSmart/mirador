// Silences the "Download the React DevTools" console message in dev.
// Must be imported before react-dom so the hook is in place when React boots.
if (import.meta.env.DEV) {
  const w = window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: { isDisabled?: boolean } }
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true }
}
