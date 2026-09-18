import { Reveal } from './Reveal'
import { examsContent, clinicInfo } from '../data/content'

export function Exams() {
  return (
    <section id="exames" className="section">
      <div className="container exams-grid">
        <Reveal className="exams-text">
          <div className="eyebrow eyebrow-blue">{examsContent.eyebrow}</div>
          <h2 className="section-title">{examsContent.title}</h2>
          <p className="lead-paragraph">{examsContent.text}</p>

          <ul className="chip-list">
            {examsContent.chips.map((chip) => (
              <li key={chip} className="chip">
                {chip}
              </li>
            ))}
          </ul>

          <a href={`https://wa.me/${clinicInfo.whatsappNumber}`} target="_blank" rel="noreferrer" className="btn btn-primary">
            {examsContent.cta}
          </a>
        </Reveal>

        <Reveal>
          <div className="exams-image">
            <img src={examsContent.image} alt="Coleta de exames laboratoriais" loading="lazy" />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
