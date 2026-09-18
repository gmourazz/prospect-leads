import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { locationContent, whatsappHref } from '../data/content'

export function Location() {
  return (
    <section id="local" className="section section-alt">
      <div className="container location-grid">
        <Reveal>
          <div className="eyebrow">{locationContent.eyebrow}</div>
          <h2 className="section-title">{locationContent.title}</h2>

          <div className="location-cards">
            {locationContent.cards.map((card) => (
              <motion.div key={card.label} className="location-card" variants={revealItem}>
                <span className="location-card-icon">
                  <card.icon size={20} />
                </span>
                <div>
                  <div className="location-card-label">{card.label}</div>
                  <div className="location-card-value">{card.value}</div>
                  <div className="location-card-detail">{card.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </Reveal>

        <Reveal className="location-media">
          <img src={locationContent.image} alt={locationContent.imageAlt} />
          <motion.a
            href={whatsappHref()}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary location-media-cta"
            whileHover={{ scale: 1.035, filter: 'brightness(1.06)' }}
            whileTap={{ scale: 0.97 }}
          >
            {locationContent.cta}
          </motion.a>
        </Reveal>
      </div>
    </section>
  )
}
