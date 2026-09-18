import { useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Clock, MapPin, MessageCircle, Send } from 'lucide-react'
import { Reveal } from './Reveal'
import { clinicInfo } from '../data/content'

interface FormState {
  name: string
  phone: string
  exam: string
  message: string
}

const EMPTY_FORM: FormState = { name: '', phone: '', exam: '', message: '' }

type FieldErrors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}
  if (form.name.trim().length < 2) errors.name = 'Informe seu nome completo.'
  if (form.phone.replace(/\D/g, '').length < 10) errors.phone = 'Informe um telefone válido com DDD.'
  if (form.exam.trim().length < 2) errors.exam = 'Conte em poucas palavras qual exame você precisa.'
  if (form.message.trim().length < 10) errors.message = 'Descreva brevemente o que você precisa agendar.'
  return errors
}

function buildWhatsappMessage(form: FormState): string {
  return [
    'Olá! Gostaria de agendar um exame na Clínica Cuidar.',
    `Nome: ${form.name}`,
    `Telefone: ${form.phone}`,
    `Exame de interesse: ${form.exam}`,
    `Mensagem: ${form.message}`,
  ].join('\n')
}

type Status = 'idle' | 'success' | 'error'

export function Contact() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const setField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const nextErrors = validate(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setStatus('error')
      setStatusMessage('Revise os campos destacados antes de enviar.')
      return
    }

    const text = encodeURIComponent(buildWhatsappMessage(form))
    window.open(`https://wa.me/${clinicInfo.whatsappNumber}?text=${text}`, '_blank', 'noopener,noreferrer')
    setStatus('success')
    setStatusMessage('Abrimos o WhatsApp com sua mensagem pronta — é só confirmar o envio por lá.')
    setForm(EMPTY_FORM)
  }

  return (
    <section id="contato" className="section section-white section-bordered">
      <div className="container contact-grid">
        <Reveal className="contact-section">
          <div className="eyebrow eyebrow-accent-soft">
            <span className="eyebrow-line" />
            Contato
          </div>
          <h2 className="section-title">Agende seu exame em poucos minutos</h2>

          <div className="contact-info">
            <div className="contact-info-row">
              <span className="contact-info-label">
                <MessageCircle size={14} /> WhatsApp
              </span>
              <span className="contact-info-value">{clinicInfo.whatsappDisplay}</span>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <MapPin size={14} /> Endereço
              </span>
              <span className="contact-info-value">{clinicInfo.address}</span>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <Clock size={14} /> Atendimento
              </span>
              <span className="contact-info-value">{clinicInfo.hours}</span>
            </div>
          </div>

          <div className="contact-highlight">
            <span className="contact-highlight-mark" aria-hidden="true" />
            <p>
              Agendamento sem complicação. Respondemos pelo WhatsApp em até <strong>2 horas úteis</strong>.
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

              <label className={`field ${errors.exam ? 'field-error' : ''}`}>
                <span>Exame de interesse</span>
                <input
                  type="text"
                  placeholder="Ex.: check-up completo, hemograma..."
                  value={form.exam}
                  onChange={setField('exam')}
                />
                {errors.exam && <span className="field-error-msg">{errors.exam}</span>}
              </label>

              <label className={`field ${errors.message ? 'field-error' : ''}`}>
                <span>Mensagem</span>
                <textarea
                  rows={4}
                  placeholder="Conte quando você prefere ser atendido"
                  value={form.message}
                  onChange={setField('message')}
                />
                {errors.message && <span className="field-error-msg">{errors.message}</span>}
              </label>

              <button type="submit" className="btn btn-dark">
                Agendar pelo WhatsApp <Send size={15} />
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
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  )
}
