import { footerContent } from '../data/content'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          {footerContent.brandLine} · <span className="footer-brand-suffix">{footerContent.brandSuffix}</span>
        </div>
        <div className="footer-location">{footerContent.location}</div>
      </div>
    </footer>
  )
}
