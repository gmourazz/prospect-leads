import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, Loader2, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { Reveal } from './Reveal'
import { submitContact } from '../lib/api'
import { firmInfo } from '../data/content'

interface FormState {
  name: string
  phone: string
  subject: string
  message: string
}

const EMPTY_FORM: FormState = { name: '', phone: '', subject: '', message: '' }

type FieldErrors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}
  if (form.name.trim().length < 2) errors.name = 'Informe seu nome completo.'
  if (form.phone.replace(/\D/g, '').length < 10) errors.phone = 'Informe um telefone válido com DDD.'
  if (form.subject.trim().length < 2) errors.subject = 'Conte em poucas palavras a área ou o assunto.'
  if (form.message.trim().length < 10) errors.message = 'Descreva brevemente a sua situação.'
  return errors
}

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function Contact() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const setField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setStatus('submitting')
    const result = await submitContact(form)
    if (result.ok) {
      setStatus('success')
      setStatusMessage('Mensagem enviada. Retornaremos em até 24 horas úteis.')
      setForm(EMPTY_FORM)
    } else {
      setStatus('error')
      setStatusMessage(result.error ?? 'Não foi possível enviar sua mensagem.')
    }
  }

  return (
    <section id="contato" className="section section-white section-bordered">
      <div className="container contact-grid">
        <Reveal className="contact-section">
          <div className="eyebrow eyebrow-bronze">
            <span className="eyebrow-line" />
            Contato
          </div>
          <h2 className="section-title">Conte o seu caso em poucas linhas</h2>

          <div className="contact-info">
            <div className="contact-info-row">
              <span className="contact-info-label">
                <MessageCircle size={14} /> WhatsApp
              </span>
              <span className="contact-info-value">{firmInfo.whatsappDisplay}</span>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <Phone size={14} /> Telefone
              </span>
              <span className="contact-info-value">{firmInfo.phoneDisplay}</span>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <Mail size={14} /> E-mail
              </span>
              <span className="contact-info-value">{firmInfo.email}</span>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <Clock size={14} /> Atendimento
              </span>
              <span className="contact-info-value">{firmInfo.hours}</span>
            </div>
          </div>

          <div className="contact-highlight">
            <span className="contact-highlight-mark" aria-hidden="true" />
            <p>
              Primeira conversa sem compromisso. Respondemos pelo WhatsApp em até <strong>24 horas úteis</strong>.
            </p>
          </div>
        </Reveal>

        <Reveal>
          <form className="contact-form" onSubmit={handleSubmit} noValidate>
            <div className="contact-form-title">Envie uma mensagem</div>
            <div className="contact-form-fields">
              <label className={`field ${errors.name ? 'field-error' : ''}`}>
                <span>Nome</span>
                <input
                  type="text"
                  placeholder="Seu nome completo"
                  value={form.name}
                  onChange={setField('name')}
                  autoComplete="name"
                />
                {errors.name && <span className="field-error-msg">{errors.name}</span>}
              </label>

              <label className={`field ${errors.phone ? 'field-error' : ''}`}>
                <span>Telefone</span>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={form.phone}
                  onChange={setField('phone')}
                  autoComplete="tel"
                />
                {errors.phone && <span className="field-error-msg">{errors.phone}</span>}
              </label>

              <label className={`field ${errors.subject ? 'field-error' : ''}`}>
                <span>Assunto</span>
                <input
                  type="text"
                  placeholder="Área ou natureza do caso"
                  value={form.subject}
                  onChange={setField('subject')}
                />
                {errors.subject && <span className="field-error-msg">{errors.subject}</span>}
              </label>

              <label className={`field ${errors.message ? 'field-error' : ''}`}>
                <span>Mensagem</span>
                <textarea
                  rows={4}
                  placeholder="Descreva brevemente a sua situação"
                  value={form.message}
                  onChange={setField('message')}
                />
                {errors.message && <span className="field-error-msg">{errors.message}</span>}
              </label>

              <button type="submit" className="btn btn-dark" disabled={status === 'submitting'}>
                {status === 'submitting' ? (
                  <>
                    <Loader2 size={16} className="spin" /> Enviando…
                  </>
                ) : (
                  <>
                    Enviar mensagem <Send size={15} />
                  </>
                )}
              </button>

              <AnimatePresence mode="wait">
                {status === 'success' && (
                  <motion.p
                    key="success"
                    className="form-status form-status-success"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                  >
                    <CheckCircle2 size={16} /> {statusMessage}
                  </motion.p>
                )}
                {status === 'error' && (
                  <motion.p
                    key="error"
                    className="form-status form-status-error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AlertCircle size={16} /> {statusMessage}
                  </motion.p>
                )}
              </AnimatePresence>

              <p className="form-note">Seus dados são usados apenas para o retorno deste contato.</p>
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  )
}
