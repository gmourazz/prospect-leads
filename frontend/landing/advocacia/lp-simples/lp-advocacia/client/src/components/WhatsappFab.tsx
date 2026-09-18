import { motion } from 'framer-motion'
import { WhatsappIcon } from './WhatsappIcon'
import { firmInfo } from '../data/content'

export function WhatsappFab() {
  return (
    <motion.a
      href={`https://wa.me/${firmInfo.whatsappNumber}`}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-fab"
      aria-label="Falar pelo WhatsApp"
      title="Falar pelo WhatsApp"
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
