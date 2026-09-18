import { Reveal } from './Reveal'
import { finalCtaContent, clinicInfo, waLinks } from '../data/content'
import { WhatsappIcon } from './WhatsappIcon'
import { PulseLine } from './PulseLine'

export function FinalCta() {
  return (
    <section className="final-cta">
      <div className="container final-cta-inner">
        <Reveal>
          <PulseLine className="final-cta-pulse" />
          <h2 className="final-cta-title">{finalCtaContent.title}</h2>
          <p>{finalCtaContent.text}</p>
          <div className="final-cta-actions">
            <a href={waLinks.geral} target="_blank" rel="noreferrer" className="btn btn-white">
              <WhatsappIcon size={18} />
              {finalCtaContent.cta}
            </a>
            <span className="final-cta-phone">{clinicInfo.whatsappDisplay}</span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
