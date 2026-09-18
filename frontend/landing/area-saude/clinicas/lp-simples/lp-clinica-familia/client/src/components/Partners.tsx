import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { partnersContent } from '../data/content'

export function Partners() {
  return (
    <section id="parceiros" className="section">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow eyebrow-blue">{partnersContent.eyebrow}</div>
          <h2 className="section-title">{partnersContent.title}</h2>
          <p>{partnersContent.text}</p>
        </div>

        <Reveal stagger>
          <ul className="partners-wall">
            {partnersContent.names.map((name) => (
              <motion.li key={name} className="partner-chip" variants={revealItem}>
                {name}
              </motion.li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
