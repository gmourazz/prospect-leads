export interface Photo {
  src: string
  alt: string
}

function unsplash(id: string, width: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`
}

export const photos = {
  hero: {
    src: unsplash('1505664194779-8beaceb93744', 1600),
    alt: 'Biblioteca jurídica clássica com volumes encadernados em couro',
  },
  meetingRoom: {
    src: unsplash('1479142506502-19b3a3b7ff33', 1000),
    alt: 'Estante envidraçada com obras jurídicas antigas sob luz quente',
  },
  architecture: {
    src: unsplash('1436450412740-6b988f486c6b', 1000),
    alt: 'Colunata de um fórum, vista de baixo',
  },
  band: {
    src: unsplash('1568667256549-094345857637', 1800),
    alt: 'Biblioteca curva com estantes de madeira repletas de volumes',
  },
} satisfies Record<string, Photo>

export interface Testimonial {
  quote: string
  name: string
  area: string
  avatar: string
  rating: number
}

function avatar(id: number): string {
  return `https://i.pravatar.cc/160?img=${id}`
}

export const testimonials: Testimonial[] = [
  {
    quote: 'Explicaram cada etapa em português claro. Nunca fiquei sem saber o que vinha depois.',
    name: 'Mariana Duarte',
    area: 'Direito de Família',
    avatar: avatar(47),
    rating: 5,
  },
  {
    quote: 'Prazos realistas e retorno rápido a cada dúvida. Sem enrolação.',
    name: 'Rafael Nogueira',
    area: 'Direito Trabalhista',
    avatar: avatar(12),
    rating: 5,
  },
  {
    quote: 'Revisaram nosso contrato social em poucos dias e evitaram um problema sério.',
    name: 'Carlos Bittencourt',
    area: 'Direito Empresarial',
    avatar: avatar(33),
    rating: 5,
  },
  {
    quote: 'Fui orientada sobre os riscos reais, sem promessas exageradas.',
    name: 'Juliana Prado',
    area: 'Direito Civil',
    avatar: avatar(25),
    rating: 5,
  },
  {
    quote: 'Benefício negado virou um caminho claro em poucas semanas.',
    name: 'Antônio Vieira',
    area: 'Direito Previdenciário',
    avatar: avatar(68),
    rating: 4,
  },
  {
    quote: 'Cada cláusula explicada antes de assinar. Cuidado que eu não esperava.',
    name: 'Patrícia Lemos',
    area: 'Contratos',
    avatar: avatar(45),
    rating: 5,
  },
  {
    quote: 'Falei direto com a advogada do caso em todas as etapas.',
    name: 'Eduardo Salles',
    area: 'Direito Civil',
    avatar: avatar(52),
    rating: 5,
  },
  {
    quote: 'Resolveram a rescisão sem virar processo. Economia de tempo e desgaste.',
    name: 'Fernanda Ribeiro',
    area: 'Direito Trabalhista',
    avatar: avatar(31),
    rating: 5,
  },
  {
    quote: 'Inventário parado há dois anos finalmente saiu do lugar.',
    name: 'Marcos Tavares',
    area: 'Direito de Família',
    avatar: avatar(60),
    rating: 5,
  },
  {
    quote: 'Recebi um parecer honesto de que não valia litigar. Raro.',
    name: 'Beatriz Camargo',
    area: 'Direito Empresarial',
    avatar: avatar(20),
    rating: 5,
  },
  {
    quote: 'Retorno no mesmo dia, sempre. Metade da ansiedade resolvida.',
    name: 'Henrique Moraes',
    area: 'Direito Previdenciário',
    avatar: avatar(15),
    rating: 4,
  },
  {
    quote: 'Time pequeno, atenção grande. Meu caso não virou número.',
    name: 'Luciana Freitas',
    area: 'Direito Civil',
    avatar: avatar(38),
    rating: 5,
  },
  {
    quote: 'Acordo fechado antes da audiência, exatamente como planejaram.',
    name: 'Rodrigo Bastos',
    area: 'Direito Trabalhista',
    avatar: avatar(8),
    rating: 5,
  },
  {
    quote: 'Me mostraram o custo real do processo na primeira conversa.',
    name: 'Camila Andrade',
    area: 'Direito Civil',
    avatar: avatar(44),
    rating: 5,
  },
  {
    quote: 'Guarda compartilhada resolvida sem transformar tudo em briga.',
    name: 'Thiago Menezes',
    area: 'Direito de Família',
    avatar: avatar(51),
    rating: 5,
  },
  {
    quote: 'Recuperamos crédito que a empresa já tinha dado como perdido.',
    name: 'Sandra Vasconcelos',
    area: 'Direito Empresarial',
    avatar: avatar(26),
    rating: 5,
  },
  {
    quote: 'Revisão da aposentadoria saiu com valor bem acima do previsto.',
    name: 'José Almeida',
    area: 'Direito Previdenciário',
    avatar: avatar(55),
    rating: 5,
  },
  {
    quote: 'Contrato de prestação de serviços redondo, sem letra miúda.',
    name: 'Aline Barreto',
    area: 'Contratos',
    avatar: avatar(29),
    rating: 5,
  },
  {
    quote: 'Indenização paga sem recurso da outra parte. Estratégia certa.',
    name: 'Bruno Carvalho',
    area: 'Direito Civil',
    avatar: avatar(65),
    rating: 5,
  },
  {
    quote: 'Atenderam meu pai com uma paciência que fez diferença.',
    name: 'Renata Siqueira',
    area: 'Direito Previdenciário',
    avatar: avatar(41),
    rating: 5,
  },
  {
    quote: 'Planejamento sucessório explicado de forma que a família toda entendeu.',
    name: 'Gustavo Peixoto',
    area: 'Direito de Família',
    avatar: avatar(13),
    rating: 5,
  },
  {
    quote: 'Auditoria dos nossos contratos apontou riscos que ninguém tinha visto.',
    name: 'Débora Nunes',
    area: 'Direito Empresarial',
    avatar: avatar(22),
    rating: 4,
  },
  {
    quote: 'Processo trabalhista encerrado em menos tempo do que eu imaginava.',
    name: 'Vinícius Rocha',
    area: 'Direito Trabalhista',
    avatar: avatar(57),
    rating: 5,
  },
  {
    quote: 'Primeira conversa sem compromisso e já saí sabendo o que fazer.',
    name: 'Helena Martins',
    area: 'Direito Civil',
    avatar: avatar(9),
    rating: 5,
  },
]

export interface PracticeArea {
  id: string
  title: string
  description: string
  photo: Photo
}

export const practiceAreas: PracticeArea[] = [
  {
    id: 'civil',
    title: 'Direito Civil',
    description: 'Responsabilidade civil, indenizações e conflitos patrimoniais.',
    photo: {
      src: unsplash('1521587760476-6c12a4b040da', 900),
      alt: 'Estante com volumes jurídicos antigos',
    },
  },
  {
    id: 'trabalhista',
    title: 'Direito Trabalhista',
    description: 'Rescisões, verbas devidas e defesa de empregados e empresas.',
    photo: {
      src: unsplash('1497366811353-6870744d04b2', 900),
      alt: 'Sala de reuniões com mesa de madeira e estrutura de concreto aparente',
    },
  },
  {
    id: 'empresarial',
    title: 'Direito Empresarial',
    description: 'Societário, contratos comerciais e recuperação de crédito.',
    photo: {
      src: unsplash('1497366754035-f200968a6e72', 900),
      alt: 'Corredor de escritório com divisórias de vidro',
    },
  },
  {
    id: 'familia',
    title: 'Direito de Família',
    description: 'Divórcio, guarda, inventário e planejamento sucessório.',
    photo: {
      src: unsplash('1568992687947-868a62a9f521', 900),
      alt: 'Ambiente de escritório com estante de madeira visto através do vidro',
    },
  },
  {
    id: 'previdenciario',
    title: 'Direito Previdenciário',
    description: 'Aposentadorias, benefícios negados e revisões.',
    photo: {
      src: unsplash('1568667256549-094345857637', 900),
      alt: 'Biblioteca curva com estantes de madeira',
    },
  },
  {
    id: 'contratos',
    title: 'Contratos',
    description: 'Elaboração, revisão e negociação de contratos.',
    photo: {
      src: unsplash('1450101499163-c8848c66ca85', 900),
      alt: 'Assinatura de um documento sobre a mesa',
    },
  },
]

export interface Differential {
  title: string
  description: string
}

export const differentials: Differential[] = [
  {
    title: 'Atendimento próximo',
    description: 'Contato direto com o advogado do caso, sem intermediários.',
  },
  {
    title: 'Estratégia jurídica',
    description: 'Soluções desenhadas conforme risco, prazo e objetivo real.',
  },
  {
    title: 'Transparência',
    description: 'Prazos, custos e cenários explicados antes de cada decisão.',
  },
  {
    title: 'Agilidade',
    description: 'Retorno em até 24 horas úteis e andamento sempre atualizado.',
  },
]

export interface FaqItem {
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    question: 'A primeira conversa é cobrada?',
    answer:
      'Não. A conversa inicial serve para entender o seu caso e dizer com honestidade se há caminho jurídico — e qual seria. Só depois disso falamos de honorários.',
  },
  {
    question: 'Como funcionam os honorários?',
    answer:
      'Apresentamos a proposta por escrito antes de qualquer trabalho, com valor, forma de pagamento e o que está incluído. Nada é iniciado sem a sua aprovação.',
  },
  {
    question: 'Em quanto tempo recebo um retorno?',
    answer:
      'Todo primeiro contato é respondido em até 24 horas úteis. Durante o processo, você fala direto com o advogado responsável pelo seu caso.',
  },
  {
    question: 'Vocês atendem fora de São Paulo?',
    answer:
      'Sim. Boa parte do atendimento é feita por videochamada e WhatsApp, e atuamos em processos de outras comarcas com apoio de correspondentes quando necessário.',
  },
  {
    question: 'Quanto tempo dura um processo?',
    answer:
      'Depende da área e da comarca. Na primeira análise informamos uma faixa realista de prazo e quais cenários podem encurtar ou alongar esse tempo.',
  },
  {
    question: 'Quais documentos preciso levar?',
    answer:
      'Para a conversa inicial, basta o que você já tiver em mãos: contratos, notificações, mensagens ou decisões recebidas. A lista completa vem depois da análise.',
  },
]

export const marqueeItems = [
  'Direito Civil',
  'Trabalhista',
  'Empresarial',
  'Família',
  'Previdenciário',
  'Contratos',
  'Retorno em 24h',
  'Atendimento direto com o advogado',
]

export const navLinks = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#areas', label: 'Áreas' },
  { href: '#diferenciais', label: 'Diferenciais' },
  { href: '#contato', label: 'Contato' },
]

export const firmInfo = {
  name: 'Almeida & Costa',
  tagline: 'Sociedade de Advogados',
  whatsappNumber: '5511988880000',
  whatsappDisplay: '(11) 98888-0000',
  phoneDisplay: '(11) 3333-2200',
  email: 'contato@almeidacosta.adv.br',
  hours: 'Seg a sex, 9h às 18h · Sábado sob agendamento',
  oab: 'OAB/SP nº 00.000 — dado fictício, substituir pelo registro real do escritório.',
}
