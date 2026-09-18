import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { servicesContent } from '../data/content'

export function Services() {
  return (
    <section id="servicos" className="section-tint">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow eyebrow-blue">{servicesContent.eyebrow}</div>
          <h2 className="section-title">{servicesContent.title}</h2>
          <p>{servicesContent.subtitle}</p>
        </div>

        <Reveal className="services-grid" stagger>
          {servicesContent.items.map((service) => {
            const Icon = service.icon
            return (
              <motion.div key={service.title} className="service-card" variants={revealItem}>
                <span className="service-icon">
                  <Icon size={24} />
                </span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </motion.div>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
