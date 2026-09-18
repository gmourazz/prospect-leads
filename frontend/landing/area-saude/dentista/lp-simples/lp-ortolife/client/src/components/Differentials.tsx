import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { differentials } from '../data/content'

export function Differentials() {
  return (
    <section id="diferenciais" className="section">
      <div className="container">
        <Reveal className="section-head">
          <div>
            <div className="eyebrow eyebrow-mint">
              <span className="eyebrow-line" />
              Experiência OrtoLife
            </div>
            <h2 className="section-title">O que guia cada atendimento</h2>
          </div>
        </Reveal>

        <Reveal className="differentials-grid" stagger>
          {differentials.map((item, index) => (
            <motion.div
              key={item.title}
              className="differential-card"
              variants={revealItem}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <div className="differential-number">{String(index + 1).padStart(2, '0')}</div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
