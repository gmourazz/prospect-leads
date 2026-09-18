import { Reveal, revealItem } from './Reveal'
import { BeforeAfterCard } from './BeforeAfterCard'
import { beforeAfterContent } from '../data/content'
import { motion } from 'framer-motion'

export function BeforeAfter() {
  return (
    <section id="antes-depois" className="section section-alt">
      <div className="container">
        <div className="section-head-row">
          <Reveal>
            <div className="eyebrow">{beforeAfterContent.eyebrow}</div>
            <h2 className="section-title">{beforeAfterContent.title}</h2>
          </Reveal>
          <Reveal>
            <p className="section-head-note">{beforeAfterContent.note}</p>
          </Reveal>
        </div>

        <Reveal className="before-after-grid" stagger>
          {beforeAfterContent.items.map((item) => (
            <motion.div key={item.id} variants={revealItem}>
              <BeforeAfterCard
                beforeSrc={item.before}
                afterSrc={item.after}
                beforeLabel={item.beforeLabel}
                afterLabel={item.afterLabel}
                caption={item.caption}
              />
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
