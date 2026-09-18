import { ArrowUp } from 'lucide-react'
import { navLinks, clinicInfo } from '../data/content'
import logo from '../assets/logo.png'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <img src={logo} alt={clinicInfo.name} className="footer-logo" />
          <nav className="footer-nav">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            © 2026 Consultório {clinicInfo.name} · {clinicInfo.dentistName}, {clinicInfo.cro}
          </p>
          <p className="footer-address">
            {clinicInfo.address} · {clinicInfo.phoneDisplay}
          </p>
          <a className="footer-top-btn" href="#top" aria-label="Voltar ao topo" title="Voltar ao topo">
            <ArrowUp size={16} />
          </a>
        </div>
      </div>
    </footer>
  )
}
