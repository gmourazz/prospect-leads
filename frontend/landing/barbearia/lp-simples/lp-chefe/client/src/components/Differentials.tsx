import { Reveal, revealItem } from './Reveal'
import { differentialsContent } from '../data/content'
import { motion } from 'framer-motion'

export function Differentials() {
  return (
    <section id="diferenciais" className="section differentials">
      <div className="container">
        <Reveal className="section-head">
          <div className="eyebrow">{differentialsContent.eyebrow}</div>
          <h2 className="section-title">{differentialsContent.title}</h2>
        </Reveal>

        <Reveal className="differentials-row" stagger>
          {differentialsContent.items.map((item) => (
            <motion.div key={item.title} className="differential-item" variants={revealItem}>
              <span className="differential-icon">
                <item.icon size={22} strokeWidth={1.8} />
              </span>
              <div className="differential-title">{item.title}</div>
              <p className="differential-text">{item.text}</p>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
