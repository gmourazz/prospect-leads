import { marqueeItems } from '../data/content'

export function Marquee() {
  // rendered twice so the track can loop seamlessly
  const track = [...marqueeItems, ...marqueeItems]

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {track.map((item, i) => (
          <span key={`${item}-${i}`} className="marquee-item">
            {item}
            <span className="marquee-sep">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}
