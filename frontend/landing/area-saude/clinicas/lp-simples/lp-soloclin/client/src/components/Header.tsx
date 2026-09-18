import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useScrollSolid } from '../hooks/useScrollSolid'
import { navLinks, waLinks } from '../data/content'
import { Brand } from './Brand'

export function Header() {
  const solid = useScrollSolid()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className={`header ${solid ? 'header-solid' : ''}`} data-nav>
      <div className="header-inner">
        <a href="#inicio" className="brand" onClick={close}>
          <Brand />
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
          <a href={waLinks.geral} target="_blank" rel="noreferrer" className="nav-cta" onClick={close}>
            Falar no WhatsApp
          </a>
        </div>
      </div>
      {open && <div className="nav-scrim" onClick={close} aria-hidden="true" />}
    </header>
  )
}
