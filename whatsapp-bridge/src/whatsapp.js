import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { config } from './config.js'
import { randomBetween, readingPause, sleep, typingDuration } from './human.js'

// The WhatsApp side of the bridge: one ordinary WhatsApp Web session, paired
// once by QR code and kept alive. Credentials live in ./auth so that
// restarting reuses the same registered device — repairing from scratch over
// and over is itself suspicious.

const logger = pino({ level: 'silent' })

// Disconnects that mean "stop", not "try again". Reconnecting through any of
// these is how a temporary problem becomes a permanent one: 401/403 are
// WhatsApp saying no, and 440 means another WhatsApp Web session took over
// (fighting it would just flap the connection).
const FATAL = {
  [DisconnectReason.loggedOut]: 'logged_out',
  [DisconnectReason.forbidden]: 'blocked',
  [DisconnectReason.connectionReplaced]: 'logged_out',
  [DisconnectReason.multideviceMismatch]: 'logged_out',
  [DisconnectReason.badSession]: 'logged_out',
}

export function createSession({ onState }) {
  let sock = null
  let ready = false
  let stopped = false
  let reconnectDelay = 2000

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir)
    const { version } = await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      auth: state,
      logger,
      // Presence is announced explicitly per message instead of broadcasting
      // "online" for the whole session, so the account does not look like it
      // is sitting in WhatsApp Web all day.
      markOnlineOnConnect: false,
      syncFullHistory: false,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        ready = false
        console.log('\n[whatsapp] escaneie o QR code abaixo no celular:')
        console.log('           WhatsApp > Aparelhos conectados > Conectar aparelho\n')
        qrcode.generate(qr, { small: true })
        onState('qr_required')
        return
      }

      if (connection === 'connecting') {
        onState('connecting')
        return
      }

      if (connection === 'open') {
        ready = true
        reconnectDelay = 2000
        console.log('[whatsapp] conectado')
        onState('connected')
        return
      }

      if (connection === 'close') {
        ready = false
        const status = lastDisconnect?.error?.output?.statusCode
        const fatal = FATAL[status]

        if (fatal) {
          console.error(
            `[whatsapp] sessao encerrada pelo WhatsApp (${status}). O bridge nao vai reconectar sozinho.`,
          )
          if (fatal === 'logged_out') {
            console.error('           apague a pasta auth/ e pareie de novo se isso foi voce desconectando.')
          }
          onState(fatal, `statusCode ${status}`)
          stopped = true
          return
        }

        if (stopped) return
        console.warn(`[whatsapp] conexao caiu (${status ?? 'sem status'}), reconectando…`)
        onState('connecting', `statusCode ${status ?? ''}`)
        setTimeout(connect, reconnectDelay)
        reconnectDelay = Math.min(reconnectDelay * 2, 60000)
      }
    })
  }

  return {
    connect,
    isReady: () => ready && !stopped,
    isStopped: () => stopped,

    /**
     * Sends one message, with the announce-then-type choreography a real
     * client produces. Resolves to the provider message id; throws a tagged
     * error the caller maps onto a failure code.
     */
    async send(phoneE164, text) {
      const digits = phoneE164.replace(/\D/g, '')

      // Asking WhatsApp whether a number exists is also the only reliable way
      // to get its canonical JID. Brazilian mobiles are registered with or
      // without the extra 9 depending on when the line was created, so a JID
      // built by string concatenation reaches the wrong person or nobody.
      const [contact] = await sock.onWhatsApp(digits)
      if (!contact?.exists) {
        const error = new Error('numero nao tem WhatsApp')
        error.code = 'not_on_whatsapp'
        throw error
      }
      const jid = contact.jid

      await sock.presenceSubscribe(jid)
      await sleep(readingPause())

      await sock.sendPresenceUpdate('composing', jid)
      await sleep(typingDuration(text))
      await sock.sendPresenceUpdate('paused', jid)
      await sleep(randomBetween(200, 700))

      const sent = await sock.sendMessage(jid, { text })
      return sent?.key?.id ?? ''
    },
  }
}

// Maps whatever went wrong onto the small vocabulary the backend understands.
// Only the three codes it treats as fatal stop the queue, so anything
// ambiguous stays a plain per-message failure.
export function classifyError(error) {
  if (error?.code === 'not_on_whatsapp') return 'not_on_whatsapp'
  const status = error?.output?.statusCode ?? error?.status
  if (status === 401) return 'logged_out'
  if (status === 403) return 'blocked'
  if (status === 429) return 'rate_limited'
  return 'provider_unavailable'
}
