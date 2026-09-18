import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { servicesContent } from '../data/content'

export function Services() {
  return (
    <section id="cortes" className="section">
      <div className="container">
        <Reveal className="section-head">
          <div className="eyebrow">{servicesContent.eyebrow}</div>
          <h2 className="section-title">{servicesContent.title}</h2>
          <p className="section-head-text">{servicesContent.subtitle}</p>
        </Reveal>

        <Reveal className="services-grid" stagger>
          {servicesContent.items.map((service) => (
            <motion.div
              key={service.title}
              className="service-card"
              variants={revealItem}
              whileHover={{ scale: 1.03, y: -6 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <img src={service.image} alt={service.title} className="service-card-img" />
              <div className="service-card-overlay">
                <div className="service-card-title">{service.title}</div>
                <div className="service-card-detail">{service.detail}</div>
              </div>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
