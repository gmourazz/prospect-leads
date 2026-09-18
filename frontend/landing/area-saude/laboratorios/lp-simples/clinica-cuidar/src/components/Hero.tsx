import { useRef } from 'react'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { CalendarCheck } from 'lucide-react'
import { Photo } from './Photo'
import { CountUp } from './CountUp'
import { photos } from '../data/content'

const STATS = [
  { to: 10, prefix: '+', label: 'anos de experiência' },
  { to: 24, suffix: 'h', label: 'para resultados' },
  { to: 6, pad: true, label: 'tipos de exame' },
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
        <motion.div className="eyebrow eyebrow-accent" variants={item}>
          <span className="eyebrow-line" />
          São Paulo · desde 2012
        </motion.div>
        <motion.h1 className="hero-title" variants={item}>
          Exames com <em>agilidade</em> e cuidado de verdade.
        </motion.h1>
        <motion.p className="hero-lead" variants={item}>
          Laboratório de análises clínicas para quem busca resultados rápidos, coleta confortável e um atendimento
          que trata você como pessoa, não como número.
        </motion.p>
        <motion.div className="hero-actions" variants={item}>
          <a href="#contato" className="btn btn-primary">
            Agendar exame <CalendarCheck size={16} />
          </a>
          <a href="#servicos" className="btn btn-ghost">
            Conheça os serviços
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
