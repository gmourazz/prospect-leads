import { useRef } from 'react'
import { motion, useScroll, useTransform, type Variants } from 'framer-motion'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Photo } from './Photo'
import { photos, clinicInfo } from '../data/content'

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
    <section id="top" className="hero">
      <motion.div className="hero-content" initial="hidden" animate="visible" variants={container}>
        <motion.span
          className="hero-glow"
          aria-hidden="true"
          animate={{ y: [0, -22, 0], x: [0, 12, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div className="eyebrow eyebrow-mint" variants={item}>
          <span className="eyebrow-line" />
          {clinicInfo.region}
        </motion.div>
        <motion.h1 className="hero-title" variants={item}>
          Precisão clínica.
          <br />
          <em>Atenção pessoal.</em>
        </motion.h1>
        <motion.p className="hero-lead" variants={item}>
          Consultório {clinicInfo.name}: odontologia moderna e individualizada, conduzida pelo {clinicInfo.dentistName}{' '}
          no coração de {clinicInfo.region.split(' · ')[0]}.
        </motion.p>
        <motion.div className="hero-actions" variants={item}>
          <a
            href={`https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(clinicInfo.whatsappMessage)}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Agendar consulta <ArrowRight size={16} />
          </a>
          <a href="#sobre" className="btn btn-ghost">
            Conhecer o consultório
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
          <span className="hero-badge-icon">
            <ShieldCheck size={18} />
          </span>
          <div>
            <div className="hero-badge-title">{clinicInfo.dentistRole}</div>
            <div className="hero-badge-label">{clinicInfo.cro}</div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
