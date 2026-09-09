import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Reveal, revealItem } from './Reveal'
import { Photo } from './Photo'
import { photos } from '../data/content'

export function About() {
  return (
    <section id="sobre" className="section">
      <div className="container">
        <Reveal className="about-head">
          <div>
            <div className="eyebrow eyebrow-bronze">
              <span className="eyebrow-line" />O escritório
            </div>
            <h2 className="section-title">Advocacia com estratégia e proximidade</h2>
          </div>
          <div>
            <p className="lead-paragraph">
              Somos um escritório enxuto por escolha. Cada advogado conduz um número limitado de casos, o que nos
              permite conhecer o processo de ponta a ponta — e explicá-lo em português claro.
            </p>
            <p className="muted-paragraph">
              Atuamos preventivamente na revisão de contratos e estruturas, e de forma contenciosa quando o acordo
              deixa de ser o melhor caminho.
            </p>
            <a href="#contato" className="link-underline">
              Conversar com o escritório <ArrowRight size={15} />
            </a>
          </div>
        </Reveal>

        <Reveal className="about-grid" stagger>
          <motion.div
            className="about-image"
            variants={revealItem}
            style={{ rotate: -1.4 }}
            whileHover={{ rotate: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <Photo photo={photos.meetingRoom} />
          </motion.div>
          <motion.div
            className="about-image about-image-offset"
            variants={revealItem}
            style={{ rotate: 1.6 }}
            whileHover={{ rotate: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <Photo photo={photos.architecture} />
          </motion.div>
          <motion.div
            className="quote-card"
            variants={revealItem}
            style={{ rotate: -1 }}
            whileHover={{ rotate: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <p>&ldquo;Um bom caso se constrói antes da primeira audiência.&rdquo;</p>
            <div>
              <div className="quote-name">Dra. Helena Almeida</div>
              <div className="quote-role">Sócia fundadora · OAB/SP 000.000</div>
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  )
}
