import { useState } from 'react'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useScrollSolid } from '../hooks/useScrollSolid'
import { navLinks, whatsappHref } from '../data/content'
import { BrandMark } from './BrandMark'

const EASE = [0.2, 0.7, 0.3, 1] as const

export function Header() {
  const solid = useScrollSolid()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <motion.header
      className={`header ${solid ? 'header-solid' : ''}`}
      data-nav
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <div className="header-inner">
        <a href="#inicio" className="brand" onClick={close}>
          <BrandMark size="sm" />
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
          <motion.a
            href={whatsappHref()}
            target="_blank"
            rel="noreferrer"
            className="nav-cta"
            onClick={close}
            whileHover={{ scale: 1.035, filter: 'brightness(1.06)' }}
            whileTap={{ scale: 0.97 }}
          >
            Agendar horário
          </motion.a>
        </div>
      </div>
      {open && <div className="nav-scrim" onClick={close} aria-hidden="true" />}
    </motion.header>
  )
}
