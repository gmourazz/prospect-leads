import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { Reveal } from './Reveal'
import { testimonials } from '../data/content'

const AUTOPLAY_MS = 5000
const PER_PAGE = 4
const EASE = [0.2, 0.7, 0.3, 1] as const

const pages = Array.from({ length: Math.ceil(testimonials.length / PER_PAGE) }, (_, i) =>
  testimonials.slice(i * PER_PAGE, i * PER_PAGE + PER_PAGE),
)

export function Testimonial() {
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback((next: number) => {
    setPage((next + pages.length) % pages.length)
  }, [])

  useEffect(() => {
    if (paused) return
    timerRef.current = setInterval(() => {
      setPage((current) => (current + 1) % pages.length)
    }, AUTOPLAY_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [paused])

  return (
    <section id="depoimentos" className="section testimonials">
      <div className="container">
        <Reveal className="testimonials-head">
          <div>
            <div className="eyebrow eyebrow-bronze">
              <span className="eyebrow-line" />
              Quem já foi atendido
            </div>
            <h2 className="section-title">O que dizem os nossos clientes</h2>
          </div>

          <div className="testimonial-controls">
            <button
              type="button"
              className="testimonial-arrow"
              aria-label="Avaliações anteriores"
              onClick={() => go(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="testimonial-dots">
              {pages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`testimonial-dot-btn ${i === page ? 'testimonial-dot-btn-active' : ''}`}
                  aria-label={`Ir para o grupo ${i + 1} de ${pages.length}`}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="testimonial-arrow"
              aria-label="Próximas avaliações"
              onClick={() => go(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </Reveal>

        <div
          className="reviews-viewport"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <motion.div
            className="reviews-track"
            /* track spans all pages, so one step is 100%/pages of its own width */
            style={{ width: `${pages.length * 100}%` }}
            animate={{ x: `-${(page * 100) / pages.length}%` }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {pages.map((group, groupIndex) => (
              <div className="reviews-page" style={{ flexBasis: `${100 / pages.length}%` }} key={groupIndex}>
                {group.map((t) => (
                  <article className="review-card" key={t.name}>
                    <div className="review-stars" aria-label={`Nota ${t.rating} de 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          strokeWidth={0}
                          fill="currentColor"
                          className={i < t.rating ? 'review-star-on' : 'review-star-off'}
                        />
                      ))}
                    </div>
                    <p className="review-quote">{t.quote}</p>
                    <footer className="review-author">
                      <img className="review-avatar" src={t.avatar} alt="" aria-hidden="true" loading="lazy" />
                      <div>
                        <div className="review-name">{t.name}</div>
                        <div className="review-area">{t.area}</div>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            ))}
          </motion.div>
        </div>

        <p className="testimonial-disclaimer">Depoimentos fictícios — substituir por relatos reais autorizados</p>
      </div>
    </section>
  )
}
