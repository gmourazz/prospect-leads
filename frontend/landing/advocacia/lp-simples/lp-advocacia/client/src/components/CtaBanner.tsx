import { Reveal } from './Reveal'
import { WhatsappIcon } from './WhatsappIcon'
import { firmInfo } from '../data/content'

export function CtaBanner() {
  return (
    <section className="cta-banner">
      <Reveal className="container">
        <div>
          <h2>Precisa de orientação jurídica hoje?</h2>
          <p>A primeira conversa é sem compromisso — entenda quais são os próximos passos do seu caso.</p>
        </div>
        <a href={`https://wa.me/${firmInfo.whatsappNumber}`} target="_blank" rel="noreferrer" className="btn">
          Falar pelo WhatsApp <WhatsappIcon size={17} />
        </a>
      </Reveal>
    </section>
  )
}
