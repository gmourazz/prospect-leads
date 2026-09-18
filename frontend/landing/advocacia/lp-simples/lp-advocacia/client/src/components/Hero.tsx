import { useRef } from 'react'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Photo } from './Photo'
import { CountUp } from './CountUp'
import { photos } from '../data/content'

const STATS = [
  { to: 10, prefix: '+', label: 'anos de atuação' },
  { to: 24, suffix: 'h', label: 'primeiro retorno' },
  { to: 6, pad: true, label: 'áreas de prática' },
]

const EASE = [0.2, 0.7, 0.3, 1] as const

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.11, delayChildren: 0.15 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
}

export function Hero() {
  const mediaRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: mediaRef, offset: ['start start', 'end start'] })
  const parallaxY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%'])

  return (
    <section id="inicio" className="hero">
      <motion.div className="hero-content" initial="hidden" animate="visible" variants={container}>
        <motion.span
          className="hero-glow"
          aria-hidden="true"
          animate={{ y: [0, -22, 0], x: [0, 12, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="hero-rule" aria-hidden="true" />
        <motion.div className="eyebrow eyebrow-gold" variants={item}>
          <span className="eyebrow-line" />
          São Paulo · desde 2014
        </motion.div>
        <motion.h1 className="hero-title" variants={item}>
          Defesa técnica, leitura <em>humana</em> do seu caso.
        </motion.h1>
        <motion.p className="hero-lead" variants={item}>
          Advocacia para pessoas e empresas que precisam de estratégia clara, prazos respeitados e alguém que atenda
          o telefone.
        </motion.p>
        <motion.div className="hero-actions" variants={item}>
          <a href="#contato" className="btn btn-primary">
            Falar com um advogado <ArrowRight size={16} />
          </a>
          <a href="#areas" className="btn btn-ghost">
            Conheça as áreas
          </a>
        </motion.div>
      </motion.div>

      <div ref={mediaRef} className="hero-media">
        <div className="hero-media-frame">
          <motion.div style={{ y: parallaxY }} className="hero-media-parallax">
            <Photo photo={photos.hero} priority />
          </motion.div>
        </div>

        <motion.div
          className="hero-badge"
          initial={{ opacity: 0, y: 16, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.9, ease: EASE }}
        >
          {STATS.map((stat, i) => (
            <div key={stat.label} className="hero-badge-item">
              <span className="hero-badge-value">
                <CountUp
                  to={stat.to}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  pad={stat.pad}
                  delayMs={1100 + i * 140}
                />
              </span>
              <span className="hero-badge-label">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
