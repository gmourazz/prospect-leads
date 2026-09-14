import { useEffect, useState } from 'react'

const STORAGE_KEY = 'prospect_wa_pacing'

// Conservative on purpose: WhatsApp restricted a linked device after a single
// confirmed send plus a handful of "Abrir WhatsApp" clicks made while testing
// the queue — starting a chat with an unsaved number and templated text is
// enough to get flagged, well before any real "bulk" volume. These numbers
// are a starting point, not a proven-safe threshold; tighten them further if
// a restriction happens again.
const BATCH_SIZE = 5
const COOLDOWN_MS = 20 * 60 * 1000

interface PacingState {
  openedInBatch: number
  cooldownUntil: number | null
}

function load(): PacingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { openedInBatch: 0, cooldownUntil: null }
    return JSON.parse(raw) as PacingState
  } catch {
    return { openedInBatch: 0, cooldownUntil: null }
  }
}

function save(state: PacingState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // private browsing / storage disabled: the guard just won't persist
  }
}

/**
 * Rate-limits "Abrir WhatsApp" clicks across the whole app — not per dialog
 * session — because closing and reopening the bulk dialog must not be a way
 * around the pause. Every open counts against the same stored batch; after
 * BATCH_SIZE in a row, a cooldown blocks the next one for COOLDOWN_MS.
 */
export function useWhatsAppPacing() {
  const [state, setState] = useState<PacingState>(load)
  const [now, setNow] = useState(() => Date.now())

  const blocked = state.cooldownUntil !== null && state.cooldownUntil > now

  useEffect(() => {
    if (!blocked) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [blocked])

  useEffect(() => {
    if (state.cooldownUntil !== null && state.cooldownUntil <= now) {
      const next = { openedInBatch: 0, cooldownUntil: null }
      setState(next)
      save(next)
    }
  }, [now, state.cooldownUntil])

  function registerOpen() {
    const openedInBatch = state.openedInBatch + 1
    const next: PacingState =
      openedInBatch >= BATCH_SIZE
        ? { openedInBatch: 0, cooldownUntil: Date.now() + COOLDOWN_MS }
        : { openedInBatch, cooldownUntil: null }
    setState(next)
    save(next)
  }

  return {
    blocked,
    remainingMs: blocked ? state.cooldownUntil! - now : 0,
    sentInBatch: state.openedInBatch,
    batchSize: BATCH_SIZE,
    registerOpen,
  }
}
