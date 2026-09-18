import { motion, type Variants } from 'framer-motion'
import { heroContent, clinicInfo, waLinks } from '../data/content'
import { WhatsappIcon } from './WhatsappIcon'
import { PulseLine } from './PulseLine'
import heroImage from '../assets/about-diagnostic.jpg'

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
      <motion.div className="hero-copy" initial="hidden" animate="visible" variants={container}>
        <motion.div className="eyebrow eyebrow-green hero-eyebrow" variants={item}>
          {heroContent.eyebrow}
        </motion.div>
        <motion.h1 className="hero-title" variants={item}>
          {heroContent.headline}
          <strong>{heroContent.headlineHighlight}</strong>
        </motion.h1>
        <motion.div variants={item}>
          <PulseLine className="hero-pulse" />
        </motion.div>
        <motion.p className="hero-subtitle" variants={item}>
          {heroContent.subtitle}
        </motion.p>
        <motion.div className="hero-actions" variants={item}>
          <a href={waLinks.geral} target="_blank" rel="noreferrer" className="btn btn-primary">
            {heroContent.ctaPrimary}
          </a>
          <a href="#solucoes" className="btn btn-outline">
            {heroContent.ctaSecondary}
          </a>
        </motion.div>
      </motion.div>

      <div className="hero-media">
        <div className="hero-media-accent" aria-hidden="true" />
        <div className="hero-media-outline" aria-hidden="true" />
        <span className="hero-media-tag">
          {heroContent.eyebrow} · {clinicInfo.region}
        </span>
        <div className="hero-media-frame">
          <img src={heroImage} alt="Atendimento e avaliação em ambiente clínico moderno — imagem ilustrativa" loading="eager" />
        </div>

        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
        >
          <span className="hero-badge-icon">
            <WhatsappIcon size={20} />
          </span>
          <div>
            <div className="hero-badge-label">{heroContent.badgeLabel}</div>
            <div className="hero-badge-value">{heroContent.badgeValue}</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
