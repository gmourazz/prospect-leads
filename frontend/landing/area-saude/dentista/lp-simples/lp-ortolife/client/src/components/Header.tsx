import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useScrollSolid } from '../hooks/useScrollSolid'
import { navLinks, clinicInfo } from '../data/content'
import logo from '../assets/logo.png'

export function Header() {
  const solid = useScrollSolid()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className={`header ${solid ? 'header-solid' : ''}`} data-nav>
      <div className="header-inner">
        <a href="#top" className="brand" onClick={close}>
          <img src={logo} alt={clinicInfo.name} />
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className={`header-actions ${open ? 'header-actions-open' : ''}`}>
          <nav className="nav">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={close}>
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href={`https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(clinicInfo.whatsappMessage)}`}
            target="_blank"
            rel="noreferrer"
            className="nav-cta"
            onClick={close}
          >
            Agendar consulta
          </a>
        </div>
      </div>
      {open && <div className="nav-scrim" onClick={close} aria-hidden="true" />}
    </header>
  )
}
