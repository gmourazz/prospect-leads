import { Activity, HeartHandshake, LayoutGrid, ShieldCheck, type LucideIcon } from 'lucide-react'

export const clinicInfo = {
  name: 'Sólonclin',
  fullName: 'Sólonclin — Medicina Ocupacional',
  brandSuffix: 'Medicina Ocupacional',
  whatsappNumber: '5592993818071',
  whatsappDisplay: '(92) 99381-8071',
  region: 'Amazonas',
}

const waBase = `https://wa.me/${clinicInfo.whatsappNumber}`

export const waLinks = {
  geral: `${waBase}?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre os atendimentos da Sólonclin.')}`,
  empresas: `${waBase}?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre atendimento em Medicina Ocupacional para minha empresa.')}`,
  solucoes: `${waBase}?text=${encodeURIComponent('Olá! Gostaria de saber mais sobre as soluções em saúde ocupacional da Sólonclin.')}`,
}

export const navLinks = [
  { href: '#inicio', label: 'Início' },
  { href: '#sobre', label: 'Sobre' },
  { href: '#solucoes', label: 'Soluções' },
  { href: '#empresas', label: 'Empresas' },
  { href: '#contato', label: 'Contato' },
]

export const heroContent = {
  eyebrow: 'Medicina Ocupacional',
  headline: 'Saúde ocupacional no ritmo de quem faz sua empresa ',
  headlineHighlight: 'acontecer.',
  subtitle:
    'A Sólonclin organiza o cuidado com a saúde do trabalhador em um único fluxo — do atendimento à documentação — para que empresas e colaboradores tenham um processo mais simples de acompanhar.',
  ctaPrimary: 'Falar com nossa equipe',
  ctaSecondary: 'Conhecer nossas soluções',
  badgeLabel: 'Atendimento via',
  badgeValue: 'WhatsApp',
}

export interface AboutKeyword {
  icon: LucideIcon
  label: string
}

export const aboutContent = {
  eyebrow: 'Sobre a Sólonclin',
  title: 'A saúde ocupacional conecta cuidado, prevenção e a rotina das empresas.',
  paragraphs: [
    'Medicina ocupacional é, na prática, o ponto de encontro entre a saúde do trabalhador e a organização de uma empresa. A Sólonclin existe para tornar esse encontro mais simples: um atendimento claro para quem precisa passar por ele, e um processo organizado para quem precisa gerir isso do outro lado.',
    'Trabalhamos para que empresas e trabalhadores do Amazonas tenham acesso a um atendimento estruturado em saúde ocupacional — com organização, comunicação clara e acompanhamento.',
  ],
  keywords: [
    { icon: ShieldCheck, label: 'Prevenção' },
    { icon: LayoutGrid, label: 'Organização' },
    { icon: Activity, label: 'Acompanhamento' },
    { icon: HeartHandshake, label: 'Acolhimento' },
  ] satisfies AboutKeyword[],
}

export interface SolutionItem {
  index: string
  title: string
  description: string
  featured?: boolean
}

export const solutionsContent = {
  eyebrow: 'Soluções',
  title: 'Áreas de atuação',
  subtitle: 'Quatro frentes que organizam a saúde ocupacional entre empresa e trabalhador.',
  items: [
    {
      index: '01',
      title: 'Saúde Ocupacional',
      description: 'Acompanhamento da saúde do trabalhador dentro da rotina da empresa, com organização e continuidade.',
      featured: true,
    },
    {
      index: '02',
      title: 'Atendimento ao Trabalhador',
      description: 'Uma experiência de atendimento clara, organizada e acolhedora, do início ao fim.',
    },
    {
      index: '03',
      title: 'Exames e Avaliações',
      description: 'Avaliações conduzidas de forma organizada, com orientação sobre cada etapa do processo.',
    },
    {
      index: '04',
      title: 'Suporte às Empresas',
      description: 'Contato facilitado para empresas organizarem suas demandas em saúde ocupacional.',
    },
  ] satisfies SolutionItem[],
}

export const companiesContent = {
  eyebrow: 'Para empresas',
  title: 'Cuidar da saúde de quem faz sua empresa acontecer também faz parte de uma boa gestão.',
  text: 'A Sólonclin apoia empresas do Amazonas a organizar a saúde ocupacional de suas equipes com um processo de atendimento mais simples de acompanhar.',
  cta: 'Solicitar atendimento',
}

export interface DifferentialItem {
  index: string
  title: string
  description: string
}

export const differentialsContent = {
  eyebrow: 'Experiência',
  title: 'O que buscamos oferecer em cada atendimento',
  items: [
    { index: '01', title: 'Atendimento próximo', description: 'Contato direto, sem burocracia desnecessária entre a empresa, o trabalhador e a clínica.' },
    { index: '02', title: 'Comunicação clara', description: 'Orientações objetivas sobre cada etapa do processo, sem termos técnicos desnecessários.' },
    { index: '03', title: 'Organização', description: 'Fluxo estruturado para que nada se perca entre o agendamento e o acompanhamento.' },
    { index: '04', title: 'Suporte às empresas', description: 'Um canal de contato direto para que a gestão organize suas demandas em saúde ocupacional.' },
  ] satisfies DifferentialItem[],
}

export const visualBreakContent = {
  quote: 'Saúde e trabalho caminham melhor quando o cuidado faz parte da rotina.',
}

export const finalCtaContent = {
  title: 'Precisa de atendimento em Medicina Ocupacional?',
  text: 'Fale com a nossa equipe pelo WhatsApp e tire suas dúvidas sobre o atendimento.',
  cta: 'Falar pelo WhatsApp',
}

export const contactContent = {
  eyebrow: 'Contato',
  title: 'Fale com a Sólonclin',
  text: 'Atendimento em Medicina Ocupacional para empresas e trabalhadores do Amazonas.',
  ctaWhatsapp: 'Falar no WhatsApp',
}

export const footerContent = {
  brandLine: clinicInfo.name,
  brandSuffix: clinicInfo.brandSuffix,
  location: `${clinicInfo.region} · ${clinicInfo.whatsappDisplay}`,
}
