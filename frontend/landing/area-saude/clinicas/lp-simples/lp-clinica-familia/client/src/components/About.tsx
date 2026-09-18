import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { aboutContent } from '../data/content'

export function About() {
  return (
    <section id="sobre" className="section">
      <div className="container about-grid">
        <Reveal>
          <div className="about-image">
            <img src={aboutContent.image} alt="Equipe da Clínica da Família em atendimento" loading="lazy" />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <div className="eyebrow eyebrow-blue">{aboutContent.eyebrow}</div>
            <h2 className="section-title">{aboutContent.title}</h2>
            {aboutContent.paragraphs.map((paragraph) => (
              <p key={paragraph} className="lead-paragraph">
                {paragraph}
              </p>
            ))}
          </Reveal>

          <Reveal className="about-mini-grid" stagger>
            {aboutContent.miniCards.map((card) => {
              const Icon = card.icon
              return (
                <motion.div key={card.title} className="mini-card" variants={revealItem}>
                  <span className="mini-card-icon">
                    <Icon size={18} />
                  </span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </motion.div>
              )
            })}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
