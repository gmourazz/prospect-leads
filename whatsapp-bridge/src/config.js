import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// A three-line .env reader instead of a dependency: this process has exactly
// four settings and runs on one machine.
function loadDotenv() {
  let raw
  try {
    raw = readFileSync(resolve(ROOT, '.env'), 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const value = match[2].replace(/^["']|["']$/g, '')
    if (!process.env[match[1]]) process.env[match[1]] = value
  }
}

loadDotenv()

function required(key) {
  const value = process.env[key]
  if (!value) {
    console.error(`[config] falta ${key} no whatsapp-bridge/.env`)
    process.exit(1)
  }
  return value
}

export const config = {
  apiUrl: (process.env.API_URL ?? 'http://localhost:8080/api/v1').replace(/\/$/, ''),
  email: required('API_EMAIL'),
  password: required('API_PASSWORD'),
  authDir: resolve(ROOT, process.env.AUTH_DIR ?? 'auth'),
  outboxFile: resolve(ROOT, 'pending-report.json'),
}
