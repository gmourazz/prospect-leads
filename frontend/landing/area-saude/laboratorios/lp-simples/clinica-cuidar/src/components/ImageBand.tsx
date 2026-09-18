import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { photos } from '../data/content'

export function ImageBand() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], ['-12%', '12%'])

  return (
    <div className="image-band" ref={ref}>
      <motion.img className="image-band-img" src={photos.band.src} alt={photos.band.alt} style={{ y }} />
      <div className="image-band-veil" aria-hidden="true" />
      <div className="image-band-content">
        <p>
          Um exame não é só um número no papel — é uma resposta que alguém está esperando com <em>ansiedade</em>.
        </p>
      </div>
    </div>
  )
}
