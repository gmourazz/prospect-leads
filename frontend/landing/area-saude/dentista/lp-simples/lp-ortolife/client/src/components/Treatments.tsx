import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { treatments, photos } from '../data/content'

const EASE = [0.2, 0.7, 0.3, 1] as const
const PREVIEW_PHOTOS = [photos.instrumentos, photos.atendimento, photos.consultorio, photos.equipamentos]

export function Treatments() {
  const [active, setActive] = useState(0)
  const preview = PREVIEW_PHOTOS[active % PREVIEW_PHOTOS.length]

  return (
    <section id="tratamentos" className="section section-tint">
      <div className="container">
        <Reveal className="section-head">
          <div>
            <div className="eyebrow eyebrow-mint">
              <span className="eyebrow-line" />
              Tratamentos
            </div>
            <h2 className="section-title">Cuidado odontológico em cada etapa</h2>
          </div>
        </Reveal>

        <div className="treatments-grid">
          <Reveal className="treatments-preview">
            <div className="treatments-preview-frame">
              <AnimatePresence mode="wait">
                <motion.img
                  key={preview.src}
                  src={preview.src}
                  alt={preview.alt}
                  initial={{ opacity: 0, scale: 1.06 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE }}
                />
              </AnimatePresence>
            </div>
          </Reveal>

          <Reveal className="treatments-list" stagger>
            {treatments.map((t, index) => (
              <motion.div
                key={t.id}
                className={`treatment-row ${index === active ? 'treatment-row-active' : ''}`}
                variants={revealItem}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                tabIndex={0}
              >
                <span className="treatment-num">{t.num}</span>
                <div className="treatment-body">
                  <h3>{t.name}</h3>
                  <p>{t.desc}</p>
                  <div className="treatment-chips">
                    {t.details.map((d) => (
                      <span key={d} className="chip">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
