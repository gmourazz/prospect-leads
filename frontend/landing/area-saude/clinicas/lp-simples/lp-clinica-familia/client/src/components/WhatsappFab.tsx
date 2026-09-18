import { motion } from 'framer-motion'
import { WhatsappIcon } from './WhatsappIcon'
import { clinicInfo } from '../data/content'

export function WhatsappFab() {
  return (
    <motion.a
      href={`https://wa.me/${clinicInfo.whatsappNumber}`}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-fab"
      aria-label="Agendar no WhatsApp"
      title="Agendar no WhatsApp"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 1, ease: [0.2, 0.7, 0.3, 1] }}
      whileHover={{ y: -3 }}
    >
      <span className="whatsapp-fab-ping" aria-hidden="true" />
      <WhatsappIcon size={27} />
    </motion.a>
  )
}
