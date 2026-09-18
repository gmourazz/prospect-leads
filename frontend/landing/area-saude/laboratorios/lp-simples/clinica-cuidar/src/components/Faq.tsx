import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { Reveal } from './Reveal'
import { faqItems } from '../data/content'

const EASE = [0.2, 0.7, 0.3, 1] as const

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section id="faq" className="section faq">
      <div className="container">
        <Reveal className="faq-head">
          <div className="eyebrow eyebrow-accent-soft">
            <span className="eyebrow-line" />
            Perguntas frequentes
          </div>
          <h2 className="section-title">Antes de agendar seu exame</h2>
          <p className="muted-paragraph">
            As dúvidas mais comuns antes da primeira coleta — respondidas sem termos técnicos difíceis.
          </p>
        </Reveal>

        <Reveal className="faq-list">
          {faqItems.map((item, index) => {
            const expanded = open === index
            return (
              <div className={`faq-item ${expanded ? 'faq-item-open' : ''}`} key={item.question}>
                <button
                  type="button"
                  className="faq-question"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  <span>{item.question}</span>
                  <motion.span
                    className="faq-icon"
                    animate={{ rotate: expanded ? 45 : 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                  >
                    <Plus size={18} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      className="faq-answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: EASE }}
                    >
                      <p>{item.answer}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
