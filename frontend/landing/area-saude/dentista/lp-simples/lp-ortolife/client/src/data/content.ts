export interface Photo {
  src: string
  alt: string
}

function unsplash(id: string, width: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`
}

export const photos = {
  hero: {
    src: unsplash('1588776814546-1ffcf47267a5', 1600),
    alt: 'Consultório odontológico moderno e iluminado',
  },
  atendimento: {
    src: unsplash('1666887360742-d9280ba23bd7', 1000),
    alt: 'Dentista em atendimento a um paciente',
  },
  instrumentos: {
    src: unsplash('1643660527090-bea721ad71f8', 1000),
    alt: 'Instrumentos odontológicos organizados',
  },
  band: {
    src: unsplash('1606811841689-23dfddce3e95', 1800),
    alt: 'Cadeira odontológica em consultório clean',
  },
  consultorio: {
    src: unsplash('1704455306251-b4634215d98f', 1200),
    alt: 'Sala de atendimento do consultório',
  },
  equipamentos: {
    src: unsplash('1629909613654-28e377c37b09', 1000),
    alt: 'Equipamentos odontológicos modernos',
  },
} satisfies Record<string, Photo>

export interface Treatment {
  id: string
  num: string
  name: string
  desc: string
  details: string[]
}

export const treatments: Treatment[] = [
  {
    id: 'geral',
    num: '01',
    name: 'Odontologia Geral e Preventiva',
    desc: 'Consultas de avaliação, limpeza e acompanhamento periódico para manter a saúde bucal em dia e evitar tratamentos mais complexos no futuro.',
    details: ['Avaliação clínica completa', 'Profilaxia e limpeza', 'Restaurações', 'Orientação de higiene'],
  },
  {
    id: 'ortodontia',
    num: '02',
    name: 'Ortodontia',
    desc: 'Correção do posicionamento dos dentes e da mordida, com o tipo de aparelho definido caso a caso e acompanhamento ao longo de todo o tratamento.',
    details: ['Aparelho fixo', 'Alinhadores', 'Manutenções periódicas', 'Documentação ortodôntica'],
  },
  {
    id: 'estetica',
    num: '03',
    name: 'Estética Dental',
    desc: 'Procedimentos voltados à aparência do sorriso, sempre partindo da saúde e da função antes do resultado estético.',
    details: ['Clareamento', 'Facetas e lentes', 'Restaurações estéticas'],
  },
  {
    id: 'reabilitacao',
    num: '04',
    name: 'Reabilitação Oral',
    desc: 'Recuperação da função e da estética em casos de perdas dentárias ou desgastes, com planejamento dividido em etapas claras.',
    details: ['Próteses fixas e removíveis', 'Implantes', 'Coroas'],
  },
  {
    id: 'cirurgia',
    num: '05',
    name: 'Cirurgia Odontológica',
    desc: 'Extrações e pequenos procedimentos cirúrgicos conduzidos com protocolo de segurança e acompanhamento no pós-operatório.',
    details: ['Extração de sisos', 'Cirurgias menores', 'Acompanhamento pós-operatório'],
  },
  {
    id: 'odontopediatria',
    num: '06',
    name: 'Odontopediatria',
    desc: 'Atendimento voltado a crianças, com foco em construir uma relação tranquila com o dentista desde as primeiras consultas.',
    details: ['Primeira consulta', 'Prevenção', 'Acompanhamento do crescimento'],
  },
]

export interface Differential {
  title: string
  description: string
}

export const differentials: Differential[] = [
  {
    title: 'Atendimento individualizado',
    description: 'Cada plano é construído para a rotina e as necessidades de quem está sendo atendido.',
  },
  {
    title: 'Planejamento cuidadoso',
    description: 'Nenhuma etapa é iniciada sem clareza sobre o caminho até o resultado esperado.',
  },
  {
    title: 'Ambiente pensado para o conforto',
    description: 'Um consultório desenhado para reduzir a ansiedade, do início ao fim da consulta.',
  },
  {
    title: 'Tecnologia aplicada ao cuidado',
    description: 'Recursos modernos utilizados a favor de um atendimento mais preciso e ágil.',
  },
]

export interface GalleryItem {
  label: string
  photo: Photo
  basis: string
}

export const gallery: GalleryItem[] = [
  { label: 'Consultório', photo: photos.consultorio, basis: '58%' },
  { label: 'Equipamentos', photo: photos.equipamentos, basis: '38%' },
]

export interface FaqItem {
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    question: 'Como funciona a primeira consulta?',
    answer:
      'A primeira consulta é dedicada a entender sua rotina, suas expectativas e seu histórico antes de qualquer procedimento, para propor um plano de tratamento claro.',
  },
  {
    question: 'O consultório atende crianças?',
    answer:
      'Sim. A Odontopediatria é uma das especialidades do consultório, com atendimento pensado para construir uma relação tranquila com o dentista desde cedo.',
  },
  {
    question: 'Como faço para agendar um horário?',
    answer: 'O agendamento é feito diretamente pelo WhatsApp, com retorno rápido para confirmar o melhor dia e horário.',
  },
  {
    question: 'Qual o horário de funcionamento?',
    answer: 'O consultório atende de segunda a sábado, das 8h às 19h.',
  },
  {
    question: 'Quanto tempo dura o tratamento ortodôntico?',
    answer:
      'Varia conforme o caso e o tipo de aparelho escolhido. Isso é definido na avaliação inicial, com acompanhamento em consultas periódicas até a conclusão.',
  },
]

export const marqueeItems = [
  'Odontologia Geral',
  'Ortodontia',
  'Estética Dental',
  'Reabilitação Oral',
  'Cirurgia Odontológica',
  'Odontopediatria',
  'Agendamento pelo WhatsApp',
]

export const navLinks = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#tratamentos', label: 'Tratamentos' },
  { href: '#estrutura', label: 'Estrutura' },
  { href: '#contato', label: 'Contato' },
]

export const clinicInfo = {
  name: 'OrtoLife',
  tagline: 'Consultório Odontológico',
  dentistName: 'Dr. Walber Batista',
  dentistRole: 'Cirurgião-Dentista',
  cro: 'CRO-AP 1234',
  whatsappNumber: '5596999090979',
  whatsappMessage: 'Olá! Gostaria de agendar uma consulta na OrtoLife.',
  whatsappDisplay: '(96) 99909-0979',
  phoneDisplay: '(96) 99909-0979',
  email: 'walberbatista@hotmail.com',
  address: 'Av. Coaraci Nunes, 664, Oiapoque/AP',
  hours: 'Segunda a sábado, 8h às 19h',
  region: 'Oiapoque · Amapá',
  mapEmbedSrc: 'https://maps.google.com/maps?q=Av.+Coaraci+Nunes,+664,+Oiapoque,+AP&output=embed',
}
