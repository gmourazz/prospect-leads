import { Reveal } from './Reveal'
import { WhatsappIcon } from './WhatsappIcon'
import { clinicInfo, whatsappMessage } from '../data/content'

export function CtaBanner() {
  return (
    <section className="cta-banner">
      <Reveal className="container">
        <div>
          <h2>Precisa agendar um exame hoje?</h2>
          <p>A primeira mensagem é sem compromisso — entenda os próximos passos em minutos.</p>
        </div>
        <a
          href={`https://wa.me/${clinicInfo.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
          target="_blank"
          rel="noreferrer"
          className="btn"
        >
          Falar pelo WhatsApp <WhatsappIcon size={17} />
        </a>
      </Reveal>
    </section>
  )
}
