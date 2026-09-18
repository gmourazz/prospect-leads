import { Reveal } from './Reveal'
import { visualBreakContent } from '../data/content'
import breakImage from '../assets/hero-workers.jpg'

export function VisualBreak() {
  return (
    <section className="visual-break">
      <img
        src={breakImage}
        alt="Ambiente de trabalho com equipe usando equipamentos de proteção — imagem ilustrativa"
        loading="lazy"
      />
      <div className="visual-break-scrim" aria-hidden="true" />
      <Reveal className="visual-break-content">
        <span className="visual-break-mark" aria-hidden="true">
          &ldquo;
        </span>
        <p>{visualBreakContent.quote}</p>
      </Reveal>
    </section>
  )
}
