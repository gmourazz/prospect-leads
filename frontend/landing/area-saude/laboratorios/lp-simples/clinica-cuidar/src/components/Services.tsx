import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarCheck,
  FlaskConical,
  HeartPulse,
  Home,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'
import { Reveal, revealItem } from './Reveal'
import { services } from '../data/content'

const EASE = [0.2, 0.7, 0.3, 1] as const

const ICONS: Record<string, LucideIcon> = {
  rotina: FlaskConical,
  checkup: HeartPulse,
  domiciliar: Home,
  convenios: ShieldCheck,
  ocupacionais: Stethoscope,
  telemedicina: CalendarCheck,
}

export function Services() {
  const [active, setActive] = useState(0)
  const preview = services[active]

  return (
    <section id="servicos" className="section section-white section-bordered">
      <div className="container services-grid">
        <Reveal className="services-intro">
          <div className="eyebrow eyebrow-accent-soft">
            <span className="eyebrow-line" />
            Serviços
          </div>
          <h2 className="section-title">Exames pensados para cada necessidade</h2>
          <p className="muted-paragraph">
            Seis frentes de atendimento, cada uma com protocolo próprio para agilidade e conforto.
          </p>

          <div className="services-preview">
            <AnimatePresence mode="wait">
              <motion.img
                key={preview.id}
                className="services-preview-img"
                src={preview.photo.src}
                alt={preview.photo.alt}
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </AnimatePresence>
            <div className="services-preview-label">
              <span>{String(active + 1).padStart(2, '0')}</span>
              {preview.title}
            </div>
          </div>
        </Reveal>

        <Reveal className="services-list" stagger>
          {services.map((service, index) => {
            const Icon = ICONS[service.id] ?? FlaskConical
            return (
              <motion.a
                key={service.id}
                href="#contato"
                className={`service-row ${index === active ? 'service-row-active' : ''}`}
                variants={revealItem}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              >
                <span className="service-icon">
                  <Icon size={19} />
                </span>
                <span>
                  <span className="service-title">{service.title}</span>
                  <span className="service-desc">{service.description}</span>
                </span>
                <ArrowRight className="service-arrow" size={17} />
              </motion.a>
            )
          })}
        </Reveal>
      </div>
    </section>
  )
}
