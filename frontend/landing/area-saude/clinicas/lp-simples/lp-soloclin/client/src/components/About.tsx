import { Reveal, revealItem } from './Reveal'
import { motion } from 'framer-motion'
import { PulseLine } from './PulseLine'
import { aboutContent } from '../data/content'
import aboutImage from '../assets/hero.jpg'

export function About() {
  return (
    <section id="sobre" className="section about">
      <span className="about-watermark" aria-hidden="true">
        Sólon
      </span>
      <div className="container about-grid">
        <Reveal>
          <div className="about-image">
            <img src={aboutImage} alt="Atendimento em ambiente de saúde — imagem ilustrativa e conceitual" loading="lazy" />
            <span className="about-image-frame" aria-hidden="true" />
          </div>
        </Reveal>

        <div className="about-copy">
          <Reveal>
            <div className="eyebrow eyebrow-green">{aboutContent.eyebrow}</div>
            <h2 className="section-title about-title">{aboutContent.title}</h2>
            {aboutContent.paragraphs.map((paragraph) => (
              <p key={paragraph} className="lead-paragraph">
                {paragraph}
              </p>
            ))}
          </Reveal>

          <PulseLine className="about-pulse" />
          <Reveal className="about-keywords" stagger>
            {aboutContent.keywords.map((keyword) => {
              const Icon = keyword.icon
              return (
                <motion.span key={keyword.label} className="about-keyword" variants={revealItem}>
                  <Icon className="about-keyword-icon" size={18} strokeWidth={2} />
                  {keyword.label}
                </motion.span>
              )
            })}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
