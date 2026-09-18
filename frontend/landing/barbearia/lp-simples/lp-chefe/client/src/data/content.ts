import { Clock, MapPin, MessageCircle, Scissors, Sparkles, Tag, type LucideIcon } from 'lucide-react'
import heroPhoto from '../assets/hero.jpg'
import barbaPhoto from '../assets/barba.jpg'
import corPhoto from '../assets/cor.jpg'
import desenhoPhoto from '../assets/desenho.jpg'
import lojaPhoto from '../assets/loja.jpg'

export const barbeariaInfo = {
  name: 'Chefe Antleen Barber Shop',
  whatsappNumber: '5592981292939',
  whatsappMessage: 'Olá! Vim pelo Google e quero agendar um horário na Chefe Antleen Barber Shop.',
  instagramHandle: '@chefe_antleen_barber_k93',
  instagramUrl: 'https://instagram.com/chefe_antleen_barber_k93',
  address: 'R. Mathias Ferreira Lima, 1573',
  addressDetail: 'Bairro Cidade Nova, Autazes, AM, 69240-000',
  phoneDisplay: '(92) 98129-2939',
  hours: 'Segunda a sábado, 8h às 22h',
  hoursNote: 'Domingo, 7h às 14h',
}

export function whatsappHref(message = barbeariaInfo.whatsappMessage): string {
  return `https://wa.me/${barbeariaInfo.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export const navLinks = [
  { href: '#cortes', label: 'Serviços' },
  { href: '#local', label: 'Onde estamos' },
  { href: '#valores', label: 'Valores' },
]

export const heroContent = {
  badge: 'Aberto hoje até 21h30 · Autazes, AM',
  titleLine1: 'O melhor lugar para',
  titleHighlight: 'mudar seu visual',
  titleLine3: 'em Autazes',
  subtitle:
    'Venha nos conhecer e fazer os melhores cortes da cidade. Degradê, barba e desenho com acabamento na régua — e está na promoção.',
  ctaPrimary: 'Agendar no WhatsApp',
  ctaSecondary: 'Ver tabela de valores',
  image: heroPhoto,
  imageAlt: 'Degradê navalhado finalizado na Chefe Antleen Barber Shop',
  floatingCardTitle: 'Promoção de setembro',
  floatingCardValue: 'qualquer corte R$ 20 até 30/09',
}

export interface HeroStat {
  value: string
  label: string
  /** Quando definido, o valor numérico é animado (count-up) em vez de renderizado estático. */
  countTo?: number
  countPrefix?: string
  countSuffix?: string
}

export const heroStats: HeroStat[] = [
  { value: '8h–22h', label: 'Seg a sáb' },
  { value: '294+', label: 'Seguidores no Instagram', countTo: 294, countSuffix: '+' },
  { value: 'R$ 20', label: 'Promoção de setembro', countTo: 20, countPrefix: 'R$ ' },
]

export interface DifferentialItem {
  icon: LucideIcon
  title: string
  text: string
}

export const differentialsContent = {
  eyebrow: 'Por que vir aqui',
  title: 'Feito pra você sair satisfeito',
  items: [
    {
      icon: Scissors,
      title: 'Navalha e desenho',
      text: 'Acabamento fino em cada detalhe, do degradê ao risco.',
    },
    {
      icon: Clock,
      title: 'Sem enrolação',
      text: 'Horário respeitado, sem espera longa na cadeira.',
    },
    {
      icon: Tag,
      title: 'Preço justo',
      text: 'Promoção nova todo mês, sem pegadinha.',
    },
    {
      icon: Sparkles,
      title: 'Clima gente boa',
      text: 'Ambiente descontraído pra sair renovado.',
    },
  ] satisfies DifferentialItem[],
}

export interface ServiceItem {
  title: string
  detail: string
  image: string
}

export const servicesContent = {
  eyebrow: 'O que fazemos',
  title: 'Especialidade em acabamento',
  subtitle: 'Cada serviço com máquina, navalha e finalização feitos à mão.',
  items: [
    { title: 'Degradê', detail: 'Máquina e navalha', image: heroPhoto },
    { title: 'Barba', detail: 'Desenho e acabamento na navalha', image: barbaPhoto },
    { title: 'Mudança de cores', detail: 'Coloração e tonalização', image: corPhoto },
    { title: 'Desenho', detail: 'Risco e disfarce personalizado', image: desenhoPhoto },
  ] satisfies ServiceItem[],
}

export interface PriceItem {
  name: string
  value: string
}

export const pricingContent = {
  eyebrow: 'Tabela de valores',
  title: 'Preço justo, sem surpresa',
  text: 'Promoção do mês: qualquer corte por R$ 20, válida até dia 30/09.',
  cta: 'Quero agendar',
  items: [
    { name: 'Qualquer corte (promoção de setembro, até 30/09)', value: 'R$ 20' },
    { name: 'Barba', value: 'R$ 25' },
    { name: 'Combo cabelo + barba', value: 'R$ 40' },
  ] satisfies PriceItem[],
}

export interface LocationCard {
  icon: LucideIcon
  label: string
  value: string
  detail: string
}

export const locationContent = {
  eyebrow: 'Onde estamos',
  title: 'Sua cadeira está esperando',
  image: lojaPhoto,
  imageAlt: 'Ambiente da Chefe Antleen Barber Shop',
  cta: 'Chamar no WhatsApp',
  cards: [
    {
      icon: MapPin,
      label: 'Endereço',
      value: barbeariaInfo.address,
      detail: barbeariaInfo.addressDetail,
    },
    {
      icon: Clock,
      label: 'Horários',
      value: barbeariaInfo.hours,
      detail: barbeariaInfo.hoursNote,
    },
    {
      icon: MessageCircle,
      label: 'Agendamento',
      value: barbeariaInfo.phoneDisplay,
      detail: 'Resposta rápida no WhatsApp',
    },
  ] satisfies LocationCard[],
}

export const footerContent = {
  brandLine: barbeariaInfo.name,
  since: `Autazes, AM`,
  instagramHandle: barbeariaInfo.instagramHandle,
  instagramUrl: barbeariaInfo.instagramUrl,
  phoneDisplay: barbeariaInfo.phoneDisplay,
  addressShort: `R. Mathias Ferreira Lima, 1573`,
}
