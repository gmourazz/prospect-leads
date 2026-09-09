import { Router } from 'express'
import { saveSubmission } from '../lib/store.js'

export const contactRouter = Router()

interface ContactBody {
  name?: unknown
  phone?: unknown
  subject?: unknown
  message?: unknown
}

function isNonEmptyString(value: unknown, minLength: number): value is string {
  return typeof value === 'string' && value.trim().length >= minLength
}

contactRouter.post('/', async (req, res) => {
  const body = req.body as ContactBody

  if (!isNonEmptyString(body.name, 2)) {
    return res.status(400).json({ error: 'Informe um nome válido.' })
  }
  if (!isNonEmptyString(body.phone, 8)) {
    return res.status(400).json({ error: 'Informe um telefone válido.' })
  }
  if (!isNonEmptyString(body.subject, 2)) {
    return res.status(400).json({ error: 'Informe o assunto do contato.' })
  }
  if (!isNonEmptyString(body.message, 10)) {
    return res.status(400).json({ error: 'Descreva brevemente a sua situação.' })
  }

  await saveSubmission({
    name: body.name.trim(),
    phone: body.phone.trim(),
    subject: body.subject.trim(),
    message: body.message.trim(),
    receivedAt: new Date().toISOString(),
  })

  res.status(201).json({ ok: true })
})
