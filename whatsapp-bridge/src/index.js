import { api, flushReport, pendingReport, report } from './api.js'
import { sleep } from './human.js'
import { classifyError, createSession } from './whatsapp.js'

// The loop. It asks the backend for one message, sends it, reports back, and
// asks again — and the backend is free to answer "not yet" for hours.
//
// Deliberately absent: any notion of a batch, a list, or a schedule. This
// process cannot decide to go faster, because it never learns how much work
// is waiting. Closing this terminal stops every automated send.

const MAX_SLEEP = 60_000
let running = true

async function main() {
  const session = createSession({
    onState: (connection, error = '') => {
      api.connection(connection, error).catch((err) =>
        console.warn(`[api] nao consegui reportar estado: ${String(err)}`),
      )
    },
  })

  process.on('SIGINT', () => {
    console.log('\n[bridge] encerrando…')
    running = false
    api.connection('offline').finally(() => process.exit(0))
  })

  // A report left over from a previous run goes out before anything new is
  // claimed: until the backend knows that message was delivered, it counts as
  // in-flight and would eventually be requeued to the same business.
  const leftover = pendingReport()
  if (leftover) {
    console.log('[bridge] reenviando confirmacao pendente da execucao anterior…')
    await flushReport(leftover)
  }

  await session.connect()

  while (running) {
    if (session.isStopped()) {
      console.error('[bridge] sessao encerrada pelo WhatsApp — parando aqui.')
      return
    }
    if (!session.isReady()) {
      await sleep(5000)
      continue
    }

    let outcome
    try {
      outcome = await api.claim()
    } catch (error) {
      console.warn(`[api] falha ao pedir trabalho: ${String(error)}`)
      await sleep(15000)
      continue
    }

    if (!outcome.job) {
      const waitMs = Math.min(outcome.wait_ms ?? 30000, MAX_SLEEP)
      console.log(`[fila] ${outcome.reason} — checando de novo em ${Math.round(waitMs / 1000)}s`)
      await sleep(waitMs)
      continue
    }

    const { dispatch_id: dispatchId, phone_e164: phone, company_name: company, rendered_body: body } = outcome.job
    console.log(`[envio] ${company} (${phone})`)

    try {
      const providerMessageId = await session.send(phone, body)
      await report({
        dispatch_id: dispatchId,
        delivered: true,
        rendered_body: body,
        provider_message_id: providerMessageId,
      })
      console.log(`[envio] ok — ${company}`)
    } catch (error) {
      const code = classifyError(error)
      console.error(`[envio] falhou (${code}) — ${company}: ${String(error)}`)
      await report({
        dispatch_id: dispatchId,
        delivered: false,
        error_code: code,
        error_message: String(error?.message ?? error).slice(0, 300),
      })
      // The backend pauses the whole queue on these; stopping here too means
      // the next loop does not spend an hour polling a dead session.
      if (code === 'logged_out' || code === 'blocked') return
    }
  }
}

main().catch((error) => {
  console.error('[bridge] erro fatal:', error)
  process.exit(1)
})
