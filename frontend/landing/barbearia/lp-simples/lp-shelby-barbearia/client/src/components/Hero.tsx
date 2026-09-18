import { useRef } from 'react'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { Scissors } from 'lucide-react'
import { heroContent, heroStats, whatsappHref } from '../data/content'
import { CountUp } from './CountUp'

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
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.08])

  return (
    <section id="inicio" className="hero" ref={sectionRef}>
      <motion.div
        className="hero-glow"
        aria-hidden="true"
        animate={{ opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div initial="hidden" animate="visible" variants={container} className="hero-content">
        <motion.div className="pill pill-status hero-badge-status" variants={item}>
          <span className="status-dot" aria-hidden="true" />
          {heroContent.badge}
        </motion.div>

        <motion.h1 className="hero-title" variants={item}>
          {heroContent.titleLine1}
          <br />
          <span className="hero-title-highlight">{heroContent.titleHighlight}</span>
          <br />
          {heroContent.titleLine3}
        </motion.h1>

        <motion.p className="hero-subtitle" variants={item}>
          {heroContent.subtitle}
        </motion.p>

        <motion.div className="hero-actions" variants={item}>
          <motion.a
            href={whatsappHref()}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            whileHover={{ scale: 1.035, filter: 'brightness(1.06)' }}
            whileTap={{ scale: 0.97 }}
          >
            {heroContent.ctaPrimary}
          </motion.a>
          <motion.a
            href="#valores"
            className="btn btn-outline"
            whileHover={{ scale: 1.035 }}
            whileTap={{ scale: 0.97 }}
          >
            {heroContent.ctaSecondary}
          </motion.a>
        </motion.div>

        <motion.div className="hero-stats" variants={item}>
          {heroStats.map((stat) => (
            <div key={stat.label} className="hero-stat">
              <div className="hero-stat-value">
                {stat.countTo !== undefined ? (
                  <CountUp value={stat.countTo} prefix={stat.countPrefix} suffix={stat.countSuffix} />
                ) : (
                  stat.value
                )}
              </div>
              <div className="hero-stat-label">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        className="hero-media"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
      >
        <div className="hero-media-frame">
          <motion.img src={heroContent.image} alt={heroContent.imageAlt} style={{ scale: imageScale }} />
        </div>

        <motion.div
          className="hero-floating-card"
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.8, ease: EASE }}
        >
          <span className="hero-floating-card-icon">
            <Scissors size={18} />
          </span>
          <div>
            <div className="hero-floating-card-title">{heroContent.floatingCardTitle}</div>
            <div className="hero-floating-card-value">{heroContent.floatingCardValue}</div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
