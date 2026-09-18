import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { SectionEyebrow } from './SectionEyebrow'
import { solutionsContent } from '../data/content'
import solutionsImage from '../assets/solutions-lab.jpg'

export function Solutions() {
  const [featured, ...rest] = solutionsContent.items

  return (
    <section id="solucoes" className="section-tint">
      <div className="container">
        <div className="section-head section-head-left">
          <SectionEyebrow>{solutionsContent.eyebrow}</SectionEyebrow>
          <h2 className="section-title">{solutionsContent.title}</h2>
          <p>{solutionsContent.subtitle}</p>
        </div>

        <div className="solutions-grid">
          <Reveal className="solution-card solution-card-featured">
            <img src={solutionsImage} alt="Ambiente de laboratório e diagnóstico — imagem ilustrativa" loading="lazy" />
            <div className="solution-card-overlay">
              <span className="solution-index">{featured.index}</span>
              <h3>{featured.title}</h3>
              <p>{featured.description}</p>
            </div>
          </Reveal>

          <Reveal className="solutions-list" stagger>
            {rest.map((item) => (
              <motion.div key={item.title} className="solution-card" variants={revealItem}>
                <span className="solution-card-num" aria-hidden="true">
                  {item.index}
                </span>
                <span className="solution-index">{item.index}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </motion.div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
