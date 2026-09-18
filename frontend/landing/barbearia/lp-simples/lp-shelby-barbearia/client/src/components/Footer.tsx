import { Instagram, MapPin, Phone } from 'lucide-react'
import { footerContent, whatsappHref } from '../data/content'
import { BrandMark } from './BrandMark'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <a href="#inicio" className="footer-brand">
          <BrandMark size="lg" />
          <div className="footer-brand-meta">
            <div className="footer-brand-since">{footerContent.since}</div>
          </div>
        </a>

        <div className="footer-links">
          <a href={footerContent.instagramUrl} target="_blank" rel="noreferrer" className="footer-link">
            <Instagram size={17} />
            {footerContent.instagramHandle}
          </a>
          <a href={whatsappHref()} target="_blank" rel="noreferrer" className="footer-link">
            <Phone size={17} />
            {footerContent.phoneDisplay}
          </a>
          <span className="footer-link footer-link-static">
            <MapPin size={17} />
            {footerContent.addressShort}
          </span>
        </div>
      </div>
    </footer>
  )
}
