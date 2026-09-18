export interface Photo {
  src: string
  alt: string
}

function unsplash(id: string, width: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`
}

export const photos = {
  hero: {
    src: unsplash('1550831107-1553da8c8464', 1600),
    alt: 'Corredor moderno de clínica com iluminação natural',
  },
  consultRoom: {
    src: unsplash('1576091160399-112ba8d25d1d', 1000),
    alt: 'Profissional de saúde revisando resultados de exames em tablet',
  },
  labWork: {
    src: unsplash('1579154204601-01588f351e67', 1000),
    alt: 'Analista de laboratório manuseando amostra com luvas',
  },
  band: {
    src: unsplash('1631815588090-d4bfec5b1ccb', 1800),
    alt: 'Tubos de coleta organizados em bancada de laboratório',
  },
} satisfies Record<string, Photo>

export interface Testimonial {
  quote: string
  name: string
  service: string
  avatar: string
  rating: number
}

function avatar(id: number): string {
  return `https://i.pravatar.cc/160?img=${id}`
}

export const testimonials: Testimonial[] = [
  {
    quote: 'Recebi o resultado do hemograma ainda no mesmo dia, direto pelo portal online.',
    name: 'Marcos Tavares',
    service: 'Exames de Rotina',
    avatar: avatar(60),
    rating: 5,
  },
  {
    quote: 'A coleta em casa para a minha mãe foi tranquila, sem fila e sem estresse.',
    name: 'Renata Siqueira',
    service: 'Coleta Domiciliar',
    avatar: avatar(41),
    rating: 5,
  },
  {
    quote: 'Acessar os laudos online facilitou muito levar tudo pronto pra consulta médica.',
    name: 'Eduardo Salles',
    service: 'Resultados Online',
    avatar: avatar(52),
    rating: 5,
  },
  {
    quote: 'Tenho medo de agulha e a equipe fez a coleta com toda a calma do mundo.',
    name: 'Juliana Prado',
    service: 'Coleta Domiciliar',
    avatar: avatar(25),
    rating: 5,
  },
  {
    quote: 'Fiz o check-up completo e me explicaram cada exame antes de começar.',
    name: 'Carlos Bittencourt',
    service: 'Check-up Completo',
    avatar: avatar(33),
    rating: 5,
  },
  {
    quote: 'O convênio da empresa foi aceito sem nenhuma burocracia.',
    name: 'Fernanda Ribeiro',
    service: 'Exames para Convênios',
    avatar: avatar(31),
    rating: 5,
  },
  {
    quote: 'Exame admissional rápido, recebi o atestado ainda na mesma semana.',
    name: 'Rodrigo Bastos',
    service: 'Exames Ocupacionais',
    avatar: avatar(8),
    rating: 4,
  },
  {
    quote: 'Nunca esperei mais de dez minutos para ser atendida.',
    name: 'Camila Andrade',
    service: 'Exames de Rotina',
    avatar: avatar(44),
    rating: 5,
  },
  {
    quote: 'A coleta domiciliar pro meu pai idoso mudou nossa rotina — não precisamos mais sair de casa.',
    name: 'Thiago Menezes',
    service: 'Coleta Domiciliar',
    avatar: avatar(51),
    rating: 5,
  },
  {
    quote: 'O resultado saiu em poucas horas e evitou uma viagem desnecessária ao pronto-socorro.',
    name: 'Sandra Vasconcelos',
    service: 'Exames de Rotina',
    avatar: avatar(26),
    rating: 5,
  },
  {
    quote: 'Marquei o check-up anual pelo WhatsApp e recebi todos os lembretes certinho.',
    name: 'José Almeida',
    service: 'Check-up Completo',
    avatar: avatar(55),
    rating: 5,
  },
  {
    quote: 'O portal de resultados é tão simples que minha avó conseguiu acessar sozinha.',
    name: 'Aline Barreto',
    service: 'Resultados Online',
    avatar: avatar(29),
    rating: 5,
  },
  {
    quote: 'Fui muito bem atendido, ambiente limpo e organizado do início ao fim.',
    name: 'Bruno Carvalho',
    service: 'Exames de Rotina',
    avatar: avatar(65),
    rating: 4,
  },
  {
    quote: 'Fizemos os exames ocupacionais de toda a equipe em uma tarde só.',
    name: 'Débora Nunes',
    service: 'Exames Ocupacionais',
    avatar: avatar(22),
    rating: 5,
  },
  {
    quote: 'Cheguei sem hora marcada e ainda assim fui atendido rapidinho.',
    name: 'Vinícius Rocha',
    service: 'Exames de Rotina',
    avatar: avatar(57),
    rating: 5,
  },
  {
    quote: 'Primeira vez fazendo check-up e me senti acolhida em cada etapa.',
    name: 'Helena Martins',
    service: 'Check-up Completo',
    avatar: avatar(9),
    rating: 5,
  },
  {
    quote: 'Meu convênio cobriu tudo e ainda me avisaram sobre a carência antes de agendar.',
    name: 'Henrique Moraes',
    service: 'Exames para Convênios',
    avatar: avatar(15),
    rating: 4,
  },
  {
    quote: 'A coleta domiciliar chegou no horário combinado, sem atraso nenhum.',
    name: 'Luciana Freitas',
    service: 'Coleta Domiciliar',
    avatar: avatar(38),
    rating: 5,
  },
  {
    quote: 'Recebi o laudo online antes mesmo de chegar em casa.',
    name: 'Antônio Vieira',
    service: 'Resultados Online',
    avatar: avatar(68),
    rating: 5,
  },
  {
    quote: 'Levei meu filho pequeno pra coletar sangue e a equipe foi incrivelmente paciente com ele.',
    name: 'Beatriz Camargo',
    service: 'Exames de Rotina',
    avatar: avatar(20),
    rating: 5,
  },
]

export interface Service {
  id: string
  title: string
  description: string
  photo: Photo
}

export const services: Service[] = [
  {
    id: 'rotina',
    title: 'Exames de Rotina',
    description: 'Hemograma, glicemia, colesterol e os exames do dia a dia, com coleta rápida.',
    photo: {
      src: unsplash('1584515933487-779824d29309', 900),
      alt: 'Estetoscópio sobre mesa de consultório',
    },
  },
  {
    id: 'checkup',
    title: 'Check-up Completo',
    description: 'Pacotes completos com múltiplos exames e orientação sobre os resultados.',
    photo: {
      src: unsplash('1576091160399-112ba8d25d1d', 900),
      alt: 'Profissional de saúde revisando resultados de check-up',
    },
  },
  {
    id: 'domiciliar',
    title: 'Coleta Domiciliar',
    description: 'Nossa equipe vai até você — ideal para idosos e mobilidade reduzida.',
    photo: {
      src: unsplash('1584982751601-97dcc096659c', 900),
      alt: 'Preparação de material para coleta de sangue',
    },
  },
  {
    id: 'convenios',
    title: 'Exames para Convênios',
    description: 'Atendimento aos principais convênios da região, sem burocracia.',
    photo: {
      src: unsplash('1550831107-1553da8c8464', 900),
      alt: 'Recepção e corredor de clínica moderna',
    },
  },
  {
    id: 'ocupacionais',
    title: 'Exames Ocupacionais',
    description: 'Admissional, periódico e demissional para empresas de todos os portes.',
    photo: {
      src: unsplash('1579154204601-01588f351e67', 900),
      alt: 'Analista de laboratório manuseando amostra com luvas',
    },
  },
  {
    id: 'telemedicina',
    title: 'Telemedicina e Resultados Online',
    description: 'Acesso seguro aos laudos pelo portal, a qualquer hora do dia.',
    photo: {
      src: unsplash('1631815588090-d4bfec5b1ccb', 900),
      alt: 'Tubos de coleta organizados em bancada de laboratório',
    },
  },
]

export interface Differential {
  title: string
  description: string
}

export const differentials: Differential[] = [
  {
    title: 'Agilidade nos resultados',
    description: 'Laudos prontos rapidamente, com prazos claros informados desde o agendamento.',
  },
  {
    title: 'Coleta domiciliar',
    description: 'Nossa equipe vai até você, com todo o cuidado e o conforto de casa.',
  },
  {
    title: 'Convênios aceitos',
    description: 'Parceria com os principais planos de saúde da região, sem burocracia.',
  },
  {
    title: 'Equipe qualificada',
    description: 'Profissionais treinados para um atendimento humano, mesmo nos exames mais delicados.',
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    question: 'Preciso estar em jejum para os exames?',
    answer:
      'Depende do exame solicitado. Hemograma geralmente não exige jejum, mas glicemia e perfil lipídico costumam pedir de 8 a 12 horas. Ao confirmar o agendamento, enviamos as orientações específicas para o seu pedido.',
  },
  {
    question: 'Como acesso meus resultados online?',
    answer:
      'Assim que o laudo fica pronto, você recebe um link de acesso por e-mail e WhatsApp. O portal funciona no celular ou no computador, sem precisar instalar nada.',
  },
  {
    question: 'Vocês atendem o meu convênio?',
    answer:
      'Atendemos os principais convênios da região. Ao agendar, confirmamos a cobertura e a necessidade de guia antes da coleta, para evitar surpresas.',
  },
  {
    question: 'A coleta domiciliar tem custo adicional?',
    answer:
      'Sim, há uma taxa de deslocamento que varia conforme a região. Informamos o valor exato no momento do agendamento, antes de qualquer confirmação.',
  },
  {
    question: 'Quanto tempo demora para sair o resultado?',
    answer:
      'Exames de rotina costumam ficar prontos em até 24 horas úteis. Exames mais específicos podem levar alguns dias — o prazo estimado aparece já na confirmação do agendamento.',
  },
  {
    question: 'Preciso agendar com antecedência?',
    answer:
      'Para coleta domiciliar, sim — recomendamos pelo menos um dia de antecedência. Para atendimento na unidade, muitos exames aceitam encaixe no mesmo dia, sujeito à disponibilidade.',
  },
]

export const marqueeItems = [
  'Exames de Rotina',
  'Check-up Completo',
  'Coleta Domiciliar',
  'Convênios Aceitos',
  'Exames Ocupacionais',
  'Resultados Online',
  'Agilidade nos Resultados',
  'Equipe Qualificada',
]

export const navLinks = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#diferenciais', label: 'Diferenciais' },
  { href: '#contato', label: 'Contato' },
]

export const clinicInfo = {
  name: 'Clínica Cuidar',
  tagline: 'Laboratório de Análises Clínicas',
  whatsappNumber: '559791409653',
  whatsappDisplay: '(97) 9140-9653',
  instagram: 'https://www.instagram.com/clin_cuidar_anori/',
  instagramDisplay: '@clin_cuidar_anori',
  address: 'R. Manoel Pinto Brandão — Anori/AM, 69440-000',
  hours: 'Consulte disponibilidade e horários pelo WhatsApp',
  registro:
    'Responsável técnico: dado a confirmar — substituir pelo registro real do laboratório.',
}

export const whatsappMessage = 'Olá! Gostaria de agendar um exame na Clínica Cuidar.'
