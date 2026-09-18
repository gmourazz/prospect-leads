import {
  Building2,
  Clock,
  FlaskConical,
  HardHat,
  HeartHandshake,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Syringe,
  TestTube,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export const clinicInfo = {
  name: 'Clínica & Laboratório da Família',
  fullName: 'Clínica & Laboratório da Família — Alpha Med Health Clinic',
  brandSuffix: 'Alpha Med Health Clinic',
  whatsappNumber: '5596981339304',
  whatsappDisplay: '(96) 98133-9304',
  phoneDisplay: '(96) 98133-9304',
  email: 'clinicadafamiliaoiapoque@gmail.com',
  address: 'R. Lélio Silva, 160 — Paraíso · Oiapoque, AP · 68980-000',
  addressNote: 'Ao lado da Polícia Federal',
  city: 'Oiapoque — Amapá',
  mapsHref:
    'https://www.google.com/maps/search/?api=1&query=Cl%C3%ADnica%20e%20Laborat%C3%B3rio%20da%20Fam%C3%ADlia%20R.%20L%C3%A9lio%20Silva%2C%20160%20Oiapoque%20AP',
}

export const navLinks = [
  { href: '#sobre', label: 'A Clínica' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#exames', label: 'Exames' },
  { href: '#trabalho', label: 'Empresas' },
  { href: '#contato', label: 'Contato' },
]

export const heroContent = {
  eyebrow: 'Clínica, laboratório e saúde do trabalho',
  headline: 'A sua saúde é o seu ',
  headlineHighlight: 'melhor bem.',
  subtitle:
    'Consulta médica, exames de rotina e especializados, diagnóstico e saúde ocupacional em uma única estrutura, no centro de Oiapoque — com acolhimento e resultados em que você pode confiar.',
  bullets: [
    'Consulta e exame no mesmo lugar, no mesmo dia',
    'ASO, laudos técnicos e e-Social para empresas',
    'Atendimento de segunda a sábado, sem sair do município',
  ],
  ctaPrimary: 'Marcar atendimento',
  ctaSecondary: 'Ver serviços',
  ratingValue: '5,0',
  ratingLabel: 'Avaliação no Google',
}

export interface StatItem {
  icon: LucideIcon
  value: string
  label: string
}

export const statsItems: StatItem[] = [
  { icon: Clock, value: 'Seg a Sex · 08h–18h', label: 'Sábado das 08h às 12h' },
  { icon: MapPin, value: 'Bairro Paraíso', label: 'R. Lélio Silva, 160 — ao lado da Polícia Federal' },
  { icon: Building2, value: 'Clínica + Laboratório', label: 'Coleta e laudos na própria unidade' },
  { icon: Users, value: '+20 empresas', label: 'Atendidas em saúde ocupacional' },
]

export interface MiniCard {
  icon: LucideIcon
  title: string
  description: string
}

export const aboutContent = {
  image: 'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=1200&q=80',
  eyebrow: 'A Clínica',
  title: 'Cuidado completo para toda a família',
  paragraphs: [
    'A Clínica & Laboratório da Família — Alpha Med Health Clinic reúne consultório médico, laboratório de análises clínicas e um departamento dedicado à Saúde e Engenharia do Trabalho na mesma unidade, em Oiapoque.',
    'Resolvemos em uma única visita o que antes exigia deslocamento: da consulta ao exame, do laudo ao acompanhamento. Um atendimento próximo, ágil e tecnicamente rigoroso para famílias, trabalhadores e empresas da região de fronteira.',
  ],
  miniCards: [
    { icon: Zap, title: 'Agilidade', description: 'Consulta, coleta e resultado sem sair da cidade.' },
    { icon: ShieldCheck, title: 'Credibilidade', description: 'Equipe qualificada e processos auditáveis.' },
    { icon: HeartHandshake, title: 'Acolhimento', description: 'Atendimento humano da entrada à saída.' },
  ] satisfies MiniCard[],
}

export interface ServiceItem {
  icon: LucideIcon
  title: string
  description: string
}

export const servicesContent = {
  eyebrow: 'Serviços',
  title: 'O que oferecemos',
  subtitle:
    'Atendimento clínico, diagnóstico e prevenção sob o mesmo teto — para cada fase da vida e para cada exigência da sua empresa.',
  items: [
    {
      icon: Stethoscope,
      title: 'Consulta médica',
      description: 'Avaliação clínica para adultos e crianças, com acompanhamento e encaminhamentos quando necessário.',
    },
    {
      icon: HeartPulse,
      title: 'Consulta de enfermagem',
      description: 'Orientação, curativos, aferições e procedimentos de enfermagem com equipe própria.',
    },
    {
      icon: FlaskConical,
      title: 'Exames de rotina e especializados',
      description: 'Laboratório de análises clínicas para check-up, diagnóstico e acompanhamento de tratamentos.',
    },
    {
      icon: Syringe,
      title: 'Ambulatório',
      description: 'Estrutura para procedimentos, medicação e observação com suporte da equipe assistencial.',
    },
    {
      icon: HardHat,
      title: 'Saúde e Engenharia do Trabalho',
      description: 'ASO, exames ocupacionais, laudos técnicos e e-Social para empresas de todos os portes.',
    },
    {
      icon: TestTube,
      title: 'Exame toxicológico',
      description: 'Coleta para toxicológico de larga janela, exigido para motoristas das categorias C, D e E.',
    },
  ] satisfies ServiceItem[],
}

export const examsContent = {
  eyebrow: 'Exames e diagnóstico',
  title: 'Precisão que orienta a decisão certa',
  text: 'Do exame de rotina ao especializado, com coleta no local e laudos organizados para o seu médico ou para a sua empresa.',
  chips: [
    'Exames de rotina',
    'Eletrocardiograma',
    'Eletroencefalograma',
    'MAPA',
    'Holter',
    'Espirometria',
    'Audiometria',
    'Acuidade visual',
    'Avaliação psicossocial',
    'Toxicológico',
  ],
  cta: 'Consultar preparo e valores',
  image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=1400&q=80',
}

export const workHealthContent = {
  eyebrow: 'Para empresas',
  title: 'Saúde e Engenharia do Trabalho',
  text: 'Conformidade com as NRs sem dor de cabeça: exames ocupacionais, ASO, laudos técnicos e envio de informações ao e-Social, com acompanhamento de quem conhece a realidade operacional da região.',
  chips: ['PGR', 'PCMSO', 'LTCAT', 'ASO', 'AET', 'PPP', 'Insalubridade', 'Periculosidade', 'e-Social'],
  cta: 'Solicitar proposta',
  image: 'https://images.unsplash.com/photo-1631815589968-fdb09a223b1e?w=1200&q=80',
}

export interface Testimonial {
  quote: string
  name: string
  source: string
}

export const testimonialsContent = {
  eyebrow: 'Depoimentos',
  title: 'Quem já foi atendido',
  items: [
    {
      quote: 'Excelente atendimento, profissionais super qualificados, fiquei muito satisfeito!',
      name: 'Arthur B.',
      source: 'Google',
    },
    {
      quote: 'Ótimo atendimento da entrada até a saída. Equipe super preparada.',
      name: 'Keliany C.',
      source: 'Google',
    },
    {
      quote: 'Excelente atendimento.',
      name: 'Livia S.',
      source: 'Google',
    },
  ] satisfies Testimonial[],
}

export const partnersContent = {
  eyebrow: 'Parceiros',
  title: 'Empresas que confiam na Clínica da Família',
  text: 'Instituições públicas e privadas que contam com a nossa estrutura para a saúde de suas equipes.',
  names: [
    'Banco do Brasil',
    'Caixa',
    'Governo do Amapá',
    'Equatorial Energia',
    'Voltalia',
    'Ambipar Response',
    'Omni Táxi Aéreo',
    'TIM',
    'Oi Amapá',
    'Fraga Engenharia',
    'Mineral Engenharia',
    'Focus Engenharia',
    'Concreta Engenharia',
    'Antonelly Engenharia',
    'Trans Amazon',
    'Central Fish',
    'Servmar',
    'SNEF',
    'Kimcall',
    'Compesc',
  ],
}

export interface ContactInfoCard {
  icon: LucideIcon
  label: string
  value: string
  note?: string
  href?: string
}

export const contactContent = {
  eyebrow: 'Contato',
  title: 'Vamos cuidar de você',
  text: 'Agende pelo WhatsApp e receba orientação sobre preparo de exames, documentos e convênios antes de vir.',
  cards: [
    {
      icon: MapPin,
      label: 'Endereço',
      value: clinicInfo.address,
      note: clinicInfo.addressNote,
    },
    {
      icon: Phone,
      label: 'Telefone e WhatsApp',
      value: clinicInfo.whatsappDisplay,
      href: `https://wa.me/${clinicInfo.whatsappNumber}`,
    },
    {
      icon: Mail,
      label: 'E-mail',
      value: clinicInfo.email,
      href: `mailto:${clinicInfo.email}`,
    },
  ] satisfies ContactInfoCard[],
  ctaWhatsapp: 'Falar no WhatsApp',
  hours: [
    { day: 'Segunda a sexta', value: '08:00—18:00' },
    { day: 'Sábado', value: '08:00—12:00' },
    { day: 'Domingo', value: 'Fechado', closed: true },
  ],
  mapsImage: 'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?w=1000&q=80',
  mapsLinkText: 'Ver rota no Google Maps →',
}

export const footerContent = {
  brandLine: clinicInfo.name,
  brandSuffix: clinicInfo.brandSuffix,
  location: `${clinicInfo.city} · ${clinicInfo.phoneDisplay}`,
}
