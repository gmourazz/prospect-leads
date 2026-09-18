export interface ContactPayload {
  name: string
  phone: string
  subject: string
  message: string
}

export interface ContactResult {
  ok: boolean
  error?: string
}

export async function submitContact(payload: ContactPayload): Promise<ContactResult> {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Não foi possível enviar sua mensagem. Tente novamente.' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Falha de conexão com o servidor. Tente novamente em instantes.' }
  }
}
