import { ArrowUp, Instagram, MapPin } from 'lucide-react'
import { WhatsappIcon } from './WhatsappIcon'
import { navLinks, clinicInfo, whatsappMessage } from '../data/content'

const whatsappHref = `https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-brand-name">{clinicInfo.name}</div>
            <div className="footer-brand-tag">{clinicInfo.tagline}</div>
            <p className="footer-brand-note">{clinicInfo.registro}</p>
          </div>

          <div className="footer-reach">
            <a className="footer-reach-link" href={whatsappHref} target="_blank" rel="noreferrer">
              <WhatsappIcon size={16} />
              {clinicInfo.whatsappDisplay}
            </a>
            <span className="footer-reach-link">
              <MapPin size={16} />
              {clinicInfo.address}
            </span>
            <div className="footer-social">
              <a href={clinicInfo.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" title="Instagram">
                <Instagram size={16} />
              </a>
              <a href={whatsappHref} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp">
                <WhatsappIcon size={16} />
              </a>
            </div>
          </div>
        </div>

        <nav className="footer-nav">
          <a href="#inicio">Início</a>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
          <a href="#faq">FAQ</a>
        </nav>

        <div className="footer-wordmark" aria-hidden="true">
          {clinicInfo.name}
        </div>

        <div className="footer-bottom">
          <a className="footer-top-btn" href="#inicio" aria-label="Voltar ao topo" title="Voltar ao topo">
            <ArrowUp size={16} />
          </a>
          <span className="footer-copyright">© 2026 {clinicInfo.name} · Todos os direitos reservados</span>
          <div className="footer-legal">
            <a href="#contato">Política de privacidade</a>
            <a href="#contato">Termos de uso</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
