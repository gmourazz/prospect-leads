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
          Um escritório não se mede pelo tamanho do prédio, e sim pela <em>clareza</em> de quem conduz o seu caso.
        </p>
      </div>
    </div>
  )
}
