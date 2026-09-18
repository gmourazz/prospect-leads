import { motion, type Variants } from 'framer-motion'
import { Check, Star } from 'lucide-react'
import { heroContent, clinicInfo } from '../data/content'
import heroImage from '../assets/hero.jpg'

const EASE = [0.2, 0.7, 0.3, 1] as const

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.1 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
}

export function Hero() {
  return (
    <section id="inicio" className="hero">
      <motion.div initial="hidden" animate="visible" variants={container}>
        <motion.div className="eyebrow eyebrow-blue hero-eyebrow" variants={item}>
          {heroContent.eyebrow}
        </motion.div>
        <motion.h1 className="hero-title" variants={item}>
          {heroContent.headline}
          <strong>{heroContent.headlineHighlight}</strong>
        </motion.h1>
        <motion.p className="hero-subtitle" variants={item}>
          {heroContent.subtitle}
        </motion.p>
        <motion.ul className="hero-bullets" variants={item}>
          {heroContent.bullets.map((bullet) => (
            <li key={bullet} className="hero-bullet">
              <span className="hero-bullet-icon">
                <Check size={15} strokeWidth={3} />
              </span>
              {bullet}
            </li>
          ))}
        </motion.ul>
        <motion.div className="hero-actions" variants={item}>
          <a href={`https://wa.me/${clinicInfo.whatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-primary">
            {heroContent.ctaPrimary}
          </a>
          <a href="#servicos" className="btn btn-outline">
            {heroContent.ctaSecondary}
          </a>
        </motion.div>
      </motion.div>

      <div className="hero-media">
        <div className="hero-media-frame">
          <img src={heroImage} alt="Médico atendendo paciente na Clínica da Família" />
        </div>

        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
        >
          <div>
            <div className="hero-badge-value">{heroContent.ratingValue}</div>
            <div className="hero-badge-stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} fill="currentColor" strokeWidth={0} />
              ))}
            </div>
            <div className="hero-badge-label">{heroContent.ratingLabel}</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
