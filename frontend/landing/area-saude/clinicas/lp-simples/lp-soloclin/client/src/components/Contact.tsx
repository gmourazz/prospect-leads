import { Reveal } from './Reveal'
import { SectionEyebrow } from './SectionEyebrow'
import { contactContent, clinicInfo, waLinks } from '../data/content'
import { WhatsappIcon } from './WhatsappIcon'

export function Contact() {
  return (
    <section id="contato" className="section-tint">
      <div className="container">
        <Reveal className="contact-panel">
          <div className="contact-panel-text">
            <SectionEyebrow>{contactContent.eyebrow}</SectionEyebrow>
            <h2 className="section-title">{contactContent.title}</h2>
            <p>{contactContent.text}</p>
          </div>

          <a href={waLinks.geral} target="_blank" rel="noreferrer" className="contact-whatsapp-card">
            <span className="contact-whatsapp-icon">
              <WhatsappIcon size={22} />
            </span>
            <div>
              <div className="contact-whatsapp-label">WhatsApp</div>
              <div className="contact-whatsapp-value">{clinicInfo.whatsappDisplay}</div>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  )
}
