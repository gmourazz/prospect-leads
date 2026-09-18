import { motion } from 'framer-motion'
import { Clock, Percent, Tag } from 'lucide-react'
import { Reveal } from './Reveal'
import { barbeariaInfo, pricingContent, whatsappHref } from '../data/content'

const highlights = [
  { icon: Tag, text: 'A partir de R$ 30' },
  { icon: Percent, text: pricingContent.text },
  { icon: Clock, text: barbeariaInfo.hours },
]

export function Pricing() {
  return (
    <section id="valores" className="section section-glow">
      <motion.div
        className="hero-glow"
        aria-hidden="true"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <div className="container pricing-grid">
        <Reveal>
          <div className="eyebrow">{pricingContent.eyebrow}</div>
          <h2 className="section-title">{pricingContent.title}</h2>

          <div className="pricing-highlights">
            {highlights.map(({ icon: Icon, text }) => (
              <div key={text} className="pricing-highlight-item">
                <span className="pricing-highlight-icon">
                  <Icon size={16} strokeWidth={2.25} />
                </span>
                <span>{text}</span>
              </div>
            ))}
          </div>

          <motion.a
            href={whatsappHref()}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
            whileHover={{ scale: 1.035, filter: 'brightness(1.06)' }}
            whileTap={{ scale: 0.97 }}
          >
            {pricingContent.cta}
          </motion.a>
        </Reveal>

        <Reveal className="pricing-card">
          {pricingContent.items.map((price) => (
            <div key={price.name} className="pricing-row">
              <span className="pricing-name">{price.name}</span>
              <span className="pricing-value">{price.value}</span>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
