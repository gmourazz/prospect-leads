import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
import { Reveal, revealItem } from './Reveal'
import { testimonialsContent } from '../data/content'

export function Testimonials() {
  return (
    <section className="section-tint">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow eyebrow-blue">{testimonialsContent.eyebrow}</div>
          <h2 className="section-title">{testimonialsContent.title}</h2>
        </div>

        <Reveal className="testimonials-grid" stagger>
          {testimonialsContent.items.map((testimonial) => (
            <motion.div key={testimonial.name} className="testimonial-card" variants={revealItem}>
              <div className="testimonial-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
                ))}
              </div>
              <p className="testimonial-quote">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="testimonial-author">
                <span className="testimonial-name">{testimonial.name}</span>
                <span className="testimonial-source">{testimonial.source}</span>
              </div>
            </motion.div>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
