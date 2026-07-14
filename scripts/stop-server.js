import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.PORT) || 3000

async function isMiradorServer(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/config`, {
      signal: AbortSignal.timeout(1000),
    })
    if (!response.ok) {
      return false
    }

    const config = await response.json()
    return (
      typeof config === 'object' &&
      config !== null &&
      ('sfClientId' in config || 'dataSource' in config)
    )
  } catch {
    return false
  }
}

function getListenerPids(port) {
  try {
    const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
    }).trim()
    if (!output) {
      return []
    }
    return [...new Set(output.split('\n').filter(Boolean).map((pid) => Number.parseInt(pid, 10)))]
  } catch {
    return []
  }
}

function getProjectVitePids() {
  try {
    const output = execSync(`pgrep -f "${ROOT}/node_modules/.bin/vite"`, {
      encoding: 'utf8',
    }).trim()
    if (!output) {
      return []
    }
    return [...new Set(output.split('\n').filter(Boolean).map((pid) => Number.parseInt(pid, 10)))]
  } catch {
    return []
  }
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGTERM')
    return true
  } catch {
    return false
  }
}

async function main() {
  const pids = new Set(getProjectVitePids())
  const listeners = getListenerPids(PORT)

  if (listeners.length > 0) {
    const miradorOnPort = await isMiradorServer(PORT)
    if (miradorOnPort) {
      listeners.forEach((pid) => pids.add(pid))
    } else if (pids.size === 0) {
      console.error(
        `mirador: port ${PORT} is in use by another app — not stopping it`,
      )
      process.exit(1)
    }
  }

  if (pids.size === 0) {
    console.log('mirador: no server running')
    return
  }

  let stopped = 0
  for (const pid of pids) {
    if (killPid(pid)) {
      stopped += 1
      console.log(`mirador: stopped process ${pid}`)
    }
  }

  if (stopped === 0) {
    console.log('mirador: no server running')
  }
}

void main()
