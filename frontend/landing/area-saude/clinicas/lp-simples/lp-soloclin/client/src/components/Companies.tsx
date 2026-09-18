import { Reveal } from './Reveal'
import { SectionEyebrow } from './SectionEyebrow'
import { companiesContent, waLinks } from '../data/content'
import companiesImage from '../assets/companies-handshake.jpg'

export function Companies() {
  return (
    <section id="empresas" className="section companies">
      <span className="companies-watermark" aria-hidden="true">
        02
      </span>
      <div className="container companies-grid">
        <Reveal className="companies-text">
          <SectionEyebrow tone="white">{companiesContent.eyebrow}</SectionEyebrow>
          <h2 className="section-title">{companiesContent.title}</h2>
          <p>{companiesContent.text}</p>
          <a href={waLinks.empresas} target="_blank" rel="noreferrer" className="btn btn-accent">
            {companiesContent.cta}
          </a>
        </Reveal>

        <Reveal>
          <div className="companies-image">
            <img src={companiesImage} alt="Parceria entre empresa e prestador de saúde — imagem ilustrativa" loading="lazy" />
            <span className="companies-image-tag">Suporte às empresas</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
