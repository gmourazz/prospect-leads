import { motion } from 'framer-motion'
import { Reveal, revealItem } from './Reveal'
import { Photo } from './Photo'
import { photos, clinicInfo } from '../data/content'

export function About() {
  return (
    <section id="sobre" className="section">
      <div className="container about-grid">
        <Reveal>
          <motion.div
            className="about-image"
            style={{ rotate: -1.2 }}
            whileHover={{ rotate: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.3, 1] }}
          >
            <Photo photo={photos.atendimento} />
          </motion.div>
        </Reveal>

        <Reveal className="about-copy" stagger>
          <motion.div className="eyebrow eyebrow-mint" variants={revealItem}>
            <span className="eyebrow-line" />
            Sobre
          </motion.div>
          <motion.h2 className="section-title" variants={revealItem}>
            {clinicInfo.dentistName}
          </motion.h2>
          <motion.p className="about-role" variants={revealItem}>
            {clinicInfo.dentistRole} · {clinicInfo.cro}
          </motion.p>
          <motion.p className="lead-paragraph" variants={revealItem}>
            Cada atendimento começa com escuta. Antes de qualquer procedimento, o {clinicInfo.dentistName} dedica
            tempo a entender a rotina, as expectativas e o histórico de cada paciente, para propor um plano de
            tratamento claro, sem pressa e sem surpresas.
          </motion.p>
          <motion.p className="muted-paragraph" variants={revealItem}>
            O Consultório {clinicInfo.name} nasce para oferecer, em {clinicInfo.region.split(' · ')[0]}, uma
            experiência odontológica com o mesmo padrão de cuidado e estrutura encontrado nos grandes centros:
            próxima, acessível e atenta a cada detalhe.
          </motion.p>
          <motion.div className="note-card" variants={revealItem}>
            <span className="note-card-label">Formação e especializações</span>
            <p>Em atualização. Informações completas em breve.</p>
          </motion.div>
        </Reveal>
      </div>
    </section>
  )
}
