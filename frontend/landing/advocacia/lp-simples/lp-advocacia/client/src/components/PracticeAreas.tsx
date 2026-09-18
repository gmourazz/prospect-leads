import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Reveal, revealItem } from './Reveal'
import { practiceAreas } from '../data/content'

const EASE = [0.2, 0.7, 0.3, 1] as const

export function PracticeAreas() {
  const [active, setActive] = useState(0)
  const preview = practiceAreas[active]

  return (
    <section id="areas" className="section section-white section-bordered">
      <div className="container areas-grid">
        <Reveal className="areas-intro">
          <div className="eyebrow eyebrow-bronze">
            <span className="eyebrow-line" />
            Áreas de atuação
          </div>
          <h2 className="section-title">Onde atuamos ao seu lado</h2>
          <p className="muted-paragraph">
            Seis frentes de prática, cada uma com um advogado de referência e um protocolo próprio de atendimento.
          </p>

          <div className="areas-preview">
            <AnimatePresence mode="wait">
              <motion.img
                key={preview.id}
                className="areas-preview-img"
                src={preview.photo.src}
                alt={preview.photo.alt}
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </AnimatePresence>
            <div className="areas-preview-label">
              <span>{String(active + 1).padStart(2, '0')}</span>
              {preview.title}
            </div>
          </div>
        </Reveal>

        <Reveal className="areas-list" stagger>
          {practiceAreas.map((area, index) => (
            <motion.a
              key={area.id}
              href="#contato"
              className={`area-row ${index === active ? 'area-row-active' : ''}`}
              variants={revealItem}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
            >
              <span className="area-index">{String(index + 1).padStart(2, '0')}</span>
              <span>
                <span className="area-title">{area.title}</span>
                <span className="area-desc">{area.description}</span>
              </span>
              <ArrowRight className="area-arrow" size={17} />
            </motion.a>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
