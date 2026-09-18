import { Reveal, revealItem } from './Reveal'
import { motion } from 'framer-motion'
import { statsItems } from '../data/content'

export function StatsBar() {
  return (
    <section className="section-tint">
      <div className="container">
        <Reveal className="stats-grid" stagger>
          {statsItems.map((stat) => {
            const Icon = stat.icon
            return (
              <motion.div key={stat.label} className="stat-item" variants={revealItem}>
                <span className="stat-icon">
                  <Icon size={20} />
                </span>
                <div>
                  <div className="stat-value">{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              </motion.div>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
