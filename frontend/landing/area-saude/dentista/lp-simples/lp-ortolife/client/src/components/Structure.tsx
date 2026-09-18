import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { gallery } from '../data/content'

export function Structure() {
  return (
    <section id="estrutura" className="section section-tint">
      <div className="container">
        <Reveal className="section-head">
          <div>
            <div className="eyebrow eyebrow-mint">
              <span className="eyebrow-line" />
              Estrutura
            </div>
            <h2 className="section-title">Um ambiente à altura do cuidado que você recebe</h2>
            <p className="muted-paragraph gallery-note">
              Fotos ilustrativas. Imagens reais do consultório serão adicionadas em breve.
            </p>
          </div>
        </Reveal>

        <Reveal className="gallery-grid" stagger>
          {gallery.map((g) => (
            <motion.div
              key={g.label}
              className="gallery-item"
              style={{ flexBasis: g.basis }}
              variants={revealItem}
              whileHover="hover"
            >
              <motion.img
                src={g.photo.src}
                alt={g.photo.alt}
                variants={{ hover: { scale: 1.06 } }}
                transition={{ duration: 0.5, ease: [0.2, 0.7, 0.3, 1] }}
              />
              <span className="gallery-label">{g.label}</span>
            </motion.div>
          ))}
          <motion.div className="gallery-item gallery-item-placeholder" variants={revealItem}>
            <span className="gallery-label">Recepção</span>
            <span className="gallery-placeholder-note">
              Espaço reservado para a fotografia real da recepção do consultório.
            </span>
          </motion.div>
        </Reveal>
      </div>
    </section>
  )
}
