import { Reveal } from './Reveal'
import { contactContent, clinicInfo } from '../data/content'

export function Contact() {
  return (
    <section id="contato" className="section-tint">
      <div className="container contact-grid">
        <Reveal className="contact-text">
          <div className="eyebrow eyebrow-blue">{contactContent.eyebrow}</div>
          <h2 className="section-title">{contactContent.title}</h2>
          <p>{contactContent.text}</p>

          <div className="contact-cards">
            {contactContent.cards.map((card) => {
              const Icon = card.icon
              const content = (
                <>
                  <span className="contact-info-card-icon">
                    <Icon size={18} />
                  </span>
                  <div>
                    <div className="contact-info-card-label">{card.label}</div>
                    <div className="contact-info-card-value">{card.value}</div>
                    {card.note && <div className="contact-info-card-note">{card.note}</div>}
                  </div>
                </>
              )
              return card.href ? (
                <a key={card.label} className="contact-info-card" href={card.href} target="_blank" rel="noreferrer">
                  {content}
                </a>
              ) : (
                <div key={card.label} className="contact-info-card">
                  {content}
                </div>
              )
            })}
          </div>

          <a href={`https://wa.me/${clinicInfo.whatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-whatsapp">
            {contactContent.ctaWhatsapp}
          </a>
        </Reveal>

        <Reveal className="contact-side">
          <div className="hours-card">
            <h3>Horário de funcionamento</h3>
            {contactContent.hours.map((hour) => (
              <div key={hour.day} className="hours-row">
                <span className="hours-day">{hour.day}</span>
                <span className={`hours-value ${hour.closed ? 'hours-value-closed' : ''}`}>{hour.value}</span>
              </div>
            ))}
          </div>

          <a className="maps-card" href={clinicInfo.mapsHref} target="_blank" rel="noreferrer">
            <img src={contactContent.mapsImage} alt="Rota até a Clínica da Família no Google Maps" loading="lazy" />
            <div className="maps-card-overlay">
              <span>{contactContent.mapsLinkText}</span>
            </div>
          </a>
        </Reveal>
      </div>
    </section>
  )
}
