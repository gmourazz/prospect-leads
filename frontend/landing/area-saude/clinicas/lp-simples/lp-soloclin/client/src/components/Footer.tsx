import { footerContent } from '../data/content'
import { PulseLine } from './PulseLine'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <PulseLine className="footer-pulse" />
        <div className="footer-brand">
          {footerContent.brandLine} · <span className="footer-brand-suffix">{footerContent.brandSuffix}</span>
        </div>
        <div className="footer-location">{footerContent.location}</div>
      </div>
    </footer>
  )
}
