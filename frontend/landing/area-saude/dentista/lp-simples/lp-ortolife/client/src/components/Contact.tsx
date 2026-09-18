import { Clock, Mail, MapPin, Phone } from 'lucide-react'
import { Reveal } from './Reveal'
import { WhatsappIcon } from './WhatsappIcon'
import { clinicInfo } from '../data/content'

export function Contact() {
  return (
    <section id="contato" className="section">
      <div className="container contact-grid">
        <Reveal className="contact-section">
          <div className="eyebrow eyebrow-mint">
            <span className="eyebrow-line" />
            Contato
          </div>
          <h2 className="section-title">Consultório {clinicInfo.name}</h2>

          <div className="contact-info">
            <div className="contact-info-row">
              <span className="contact-info-label">
                <MapPin size={14} /> Endereço
              </span>
              <span className="contact-info-value">{clinicInfo.address}</span>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <WhatsappIcon size={14} /> WhatsApp
              </span>
              <a
                className="contact-info-value contact-info-link"
                href={`https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(clinicInfo.whatsappMessage)}`}
                target="_blank"
                rel="noreferrer"
              >
                {clinicInfo.whatsappDisplay}
              </a>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <Mail size={14} /> E-mail
              </span>
              <a className="contact-info-value contact-info-link" href={`mailto:${clinicInfo.email}`}>
                {clinicInfo.email}
              </a>
            </div>
            <div className="contact-info-row">
              <span className="contact-info-label">
                <Clock size={14} /> Horário
              </span>
              <span className="contact-info-value">{clinicInfo.hours}</span>
            </div>
          </div>

          <a
            href={`https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(clinicInfo.whatsappMessage)}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-dark contact-cta"
          >
            <Phone size={16} /> Agendar consulta
          </a>
        </Reveal>

        <Reveal className="contact-map">
          <iframe
            title="Localização OrtoLife"
            src={clinicInfo.mapEmbedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </Reveal>
      </div>
    </section>
  )
}
