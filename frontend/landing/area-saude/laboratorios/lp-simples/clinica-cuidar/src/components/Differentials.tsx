import { motion } from 'framer-motion'
import { Clock, Home, Microscope, ShieldCheck, type LucideIcon } from 'lucide-react'
import { Reveal, revealItem } from './Reveal'
import { differentials } from '../data/content'

const ICONS: LucideIcon[] = [Clock, Home, ShieldCheck, Microscope]

export function Differentials() {
  return (
    <section id="diferenciais" className="differentials">
      <div className="container">
        <Reveal className="differentials-head">
          <div>
            <div className="eyebrow eyebrow-accent">
              <span className="eyebrow-line" />
              Por que a Clínica Cuidar
            </div>
            <h2 className="section-title">Compromissos que orientam cada atendimento</h2>
          </div>
          <p>Não prometemos diagnóstico. Prometemos agilidade, cuidado e clareza.</p>
        </Reveal>

        <Reveal className="differentials-grid" stagger>
          {differentials.map((item, index) => {
            const Icon = ICONS[index] ?? Clock
            return (
              <motion.div
                key={item.title}
                className="differential-card"
                variants={revealItem}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.35, ease: [0.2, 0.7, 0.3, 1] }}
              >
                <div className="differential-number">
                  {String(index + 1).padStart(2, '0')}
                  <span className="differential-icon">
                    <Icon size={18} />
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </motion.div>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
