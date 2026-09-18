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
            <div className="eyebrow eyebrow-accent-soft">
              <span className="eyebrow-line" />O laboratório
            </div>
            <h2 className="section-title">Cuidado clínico com estrutura de laboratório moderno</h2>
          </div>
          <div>
            <p className="lead-paragraph">
              Somos um laboratório de bairro pensado para agilidade: equipamentos modernos, equipe treinada e
              comunicação clara sobre cada etapa do seu exame.
            </p>
            <p className="muted-paragraph">
              Atendemos com hora marcada para reduzir espera, e oferecemos coleta domiciliar para quem tem
              dificuldade de locomoção ou simplesmente prefere o conforto de casa.
            </p>
            <a href="#contato" className="link-underline">
              Agendar um horário <ArrowRight size={15} />
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
            <Photo photo={photos.consultRoom} />
          </motion.div>
          <motion.div
            className="about-image about-image-offset"
            variants={revealItem}
            style={{ rotate: 1.6 }}
            whileHover={{ rotate: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <Photo photo={photos.labWork} />
          </motion.div>
          <motion.div
            className="quote-card"
            variants={revealItem}
            style={{ rotate: -1 }}
            whileHover={{ rotate: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <p>&ldquo;Resultado rápido só tem valor quando vem com precisão.&rdquo;</p>
            <div>
              <div className="quote-name">Dra. Patrícia Lemos</div>
              <div className="quote-role">Responsável técnica</div>
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  )
}
