import { ArrowUp, Instagram, Linkedin, Mail, Phone } from 'lucide-react'
import { WhatsappIcon } from './WhatsappIcon'
import { navLinks, firmInfo } from '../data/content'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="footer-brand-name">{firmInfo.name}</div>
            <div className="footer-brand-tag">{firmInfo.tagline}</div>
            <p className="footer-brand-note">{firmInfo.oab}</p>
          </div>

          <div className="footer-reach">
            <a className="footer-reach-link" href={`https://wa.me/${firmInfo.whatsappNumber}`} target="_blank" rel="noreferrer">
              <WhatsappIcon size={16} />
              {firmInfo.whatsappDisplay}
            </a>
            <a className="footer-reach-link" href={`tel:+551133332200`}>
              <Phone size={16} />
              {firmInfo.phoneDisplay}
            </a>
            <a className="footer-reach-link" href={`mailto:${firmInfo.email}`}>
              <Mail size={16} />
              {firmInfo.email}
            </a>
            <div className="footer-social">
              <a href="#contato" aria-label="LinkedIn" title="LinkedIn">
                <Linkedin size={16} />
              </a>
              <a href="#contato" aria-label="Instagram" title="Instagram">
                <Instagram size={16} />
              </a>
              <a
                href={`https://wa.me/${firmInfo.whatsappNumber}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
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
          {firmInfo.name}
        </div>

        <div className="footer-bottom">
          <a className="footer-top-btn" href="#inicio" aria-label="Voltar ao topo" title="Voltar ao topo">
            <ArrowUp size={16} />
          </a>
          <span className="footer-copyright">© 2026 {firmInfo.name} Advocacia · Todos os direitos reservados</span>
          <div className="footer-legal">
            <a href="#contato">Política de privacidade</a>
            <a href="#contato">Termos de uso</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
