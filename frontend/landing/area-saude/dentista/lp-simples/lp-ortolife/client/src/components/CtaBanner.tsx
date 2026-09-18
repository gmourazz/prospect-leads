import { Reveal } from './Reveal'
import { clinicInfo } from '../data/content'

export function CtaBanner() {
  return (
    <section className="cta-banner">
      <div className="cta-banner-stripes" aria-hidden="true" />
      <Reveal className="container cta-banner-content">
        <h2>Marque um horário e conheça um atendimento pensado para você</h2>
        <div className="cta-banner-actions">
          <a
            href={`https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(clinicInfo.whatsappMessage)}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            Agendar pelo WhatsApp
          </a>
          <a href={`tel:+${clinicInfo.whatsappNumber}`} className="cta-banner-phone">
            {clinicInfo.phoneDisplay}
          </a>
        </div>
      </Reveal>
    </section>
  )
}
