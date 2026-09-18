import { HardHat } from 'lucide-react'
import { Reveal } from './Reveal'
import { workHealthContent, clinicInfo } from '../data/content'

export function WorkHealth() {
  return (
    <section id="trabalho" className="section work-health">
      <div className="container work-health-grid">
        <Reveal className="work-health-text">
          <div className="eyebrow eyebrow-white">
            <HardHat size={14} />
            {workHealthContent.eyebrow}
          </div>
          <h2 className="section-title">{workHealthContent.title}</h2>
          <p>{workHealthContent.text}</p>

          <ul className="chip-list">
            {workHealthContent.chips.map((chip) => (
              <li key={chip} className="chip chip-outline">
                {chip}
              </li>
            ))}
          </ul>

          <a href={`https://wa.me/${clinicInfo.whatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-white">
            {workHealthContent.cta}
          </a>
        </Reveal>

        <Reveal>
          <div className="work-health-image">
            <img src={workHealthContent.image} alt="Equipe de saúde ocupacional em campo" loading="lazy" />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
