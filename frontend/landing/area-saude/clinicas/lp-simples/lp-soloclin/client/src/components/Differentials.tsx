import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { SectionEyebrow } from './SectionEyebrow'
import { PulseLine } from './PulseLine'
import { differentialsContent } from '../data/content'

export function Differentials() {
  return (
    <section className="section differentials">
      <div className="container">
        <div className="differentials-head">
          <div className="section-head section-head-left">
            <SectionEyebrow>{differentialsContent.eyebrow}</SectionEyebrow>
            <h2 className="section-title">{differentialsContent.title}</h2>
          </div>
          <PulseLine className="differentials-pulse" />
        </div>

        <Reveal className="differentials-list" stagger>
          {differentialsContent.items.map((item) => (
            <motion.div key={item.title} className="differential-row" variants={revealItem}>
              <span className="differential-index">{item.index}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
