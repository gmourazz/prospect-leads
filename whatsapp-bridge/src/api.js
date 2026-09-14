import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { config } from './config.js'
import { sleep } from './human.js'

// Thin client for the Prospect API. It logs in with the owner's own
// credentials — this runs on her machine, so there is no second party to
// authenticate and no extra secret worth inventing.

let token = null

async function login() {
  const response = await fetch(`${config.apiUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: config.email, password: config.password }),
  })
  if (!response.ok) {
    throw new Error(`login falhou (${response.status}) — confira API_EMAIL/API_PASSWORD`)
  }
  token = (await response.json()).token
  if (!token) throw new Error('login respondeu sem token')
}

async function call(path, body, { retryOnAuth = true } = {}) {
  if (!token) await login()

  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
  })

  // The session outlives most runs but not all of them; one silent re-login
  // beats making the operator restart the process.
  if (response.status === 401 && retryOnAuth) {
    token = null
    return call(path, body, { retryOnAuth: false })
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${path} respondeu ${response.status}: ${text.slice(0, 200)}`)
  }
  return response.json()
}

export const api = {
  claim: () => call('/whatsapp/agent/claim'),
  connection: (connection, error = '') => call('/whatsapp/agent/connection', { connection, error }),
}

// ------------------------------------------------------------------ outbox
//
// The one place where losing a message matters more than anything else here.
//
// If a message leaves WhatsApp and the "it was sent" report never reaches the
// API, the dispatch stays in 'sending' and the backend requeues it after ten
// minutes — a second, identical cold message to a real business. So a report
// is never dropped: it is written to disk before the loop moves on, retried
// with backoff, and replayed on the next startup if this process died holding
// it. Nothing new is claimed while one is pending.

export function pendingReport() {
  try {
    return JSON.parse(readFileSync(config.outboxFile, 'utf8'))
  } catch {
    return null
  }
}

function clearPending() {
  try {
    unlinkSync(config.outboxFile)
  } catch {
    /* already gone */
  }
}

// report persists first, then delivers. The caller is free to crash at any
// point between the two.
export async function report(result) {
  writeFileSync(config.outboxFile, JSON.stringify(result), 'utf8')
  await flushReport(result)
}

export async function flushReport(result) {
  const backoff = [1000, 3000, 8000, 20000, 45000]
  for (let attempt = 0; ; attempt++) {
    try {
      await call('/whatsapp/agent/result', result)
      clearPending()
      return
    } catch (error) {
      if (attempt >= backoff.length) {
        console.error(
          '[api] nao consegui confirmar o envio depois de varias tentativas.',
          'O registro ficou salvo em pending-report.json e sera reenviado quando o bridge subir de novo.',
          String(error),
        )
        throw error
      }
      console.warn(`[api] falha ao confirmar envio, tentando de novo: ${String(error)}`)
      await sleep(backoff[attempt])
    }
  }
}
