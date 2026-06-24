import type { ErrorPayload } from 'vite/types/hmrPayload.js'

const codeframeRE = /^(?:>?\s*\d+\s+\|.*|\s+\|\s*\^.*)\r?\n/gm

export interface FormattedViteError {
  headline: string
  body: string
}

export function formatViteError(err: ErrorPayload['err']): FormattedViteError {
  codeframeRE.lastIndex = 0
  const hasFrame = Boolean(err.frame && codeframeRE.test(err.frame))
  codeframeRE.lastIndex = 0

  const message = (hasFrame ? err.message.replace(codeframeRE, '') : err.message).trim()
  const headline = err.plugin ? `[${err.plugin}] ${message}` : message

  const parts: string[] = []
  const file = (err.loc?.file ?? err.id)?.split('?')[0]

  if (file && err.loc) {
    parts.push(`${file}:${err.loc.line}:${err.loc.column}`)
  } else if (file) {
    parts.push(file)
  }

  if (hasFrame && err.frame) {
    parts.push('', err.frame.trim())
  }

  if (err.stack) {
    parts.push('', err.stack)
  }

  return { headline, body: parts.join('\n').trim() }
}
