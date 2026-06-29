/* Browser file-download helpers.
   Builds an in-memory Blob and triggers a download via a transient <a download>,
   revoking the object URL afterwards so it doesn't leak. */

export function downloadTextFile(
  filename: string,
  contents: string,
  mime = 'application/json',
): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** `YYYY-MM-DD` stamp for export filenames. */
export function dateStamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
