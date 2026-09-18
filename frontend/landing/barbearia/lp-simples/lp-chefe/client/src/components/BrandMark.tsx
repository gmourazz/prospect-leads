interface BrandMarkProps {
  /** `lg` para destaques maiores (ex.: rodapé), `sm` para o header compacto. */
  size?: 'sm' | 'lg'
}

export function BrandMark({ size = 'sm' }: BrandMarkProps) {
  return (
    <span className={`brandmark brandmark-${size}`}>
      <span className="brandmark-monogram" aria-hidden="true">
        <span className="brandmark-letter">C</span>
      </span>
      <span className="brandmark-text">
        <span className="brandmark-name">Chefe Antleen</span>
        <span className="brandmark-rule" aria-hidden="true">
          <span className="brandmark-rule-dot" />
        </span>
        <span className="brandmark-tag">Barber Shop</span>
      </span>
    </span>
  )
}
