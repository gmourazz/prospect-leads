import { Clock, MapPin, MessageCircle, type LucideIcon } from 'lucide-react'
import heroPhoto from '../assets/hero.jpg'

function unsplash(id: string, width: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`
}
import acabamento3 from '../assets/gallery-1.jpg'
import acabamento4 from '../assets/gallery-2.jpg'
import acabamento5 from '../assets/gallery-3.jpg'
import before1 from '../assets/before-1.jpg'
import after1 from '../assets/after-1.jpg'
import before2 from '../assets/before-2.jpg'
import after2 from '../assets/after-2.jpg'
import before3 from '../assets/before-3.jpg'
import after3 from '../assets/after-3.jpg'

export const barbeariaInfo = {
  name: 'Shelby Barbearia',
  whatsappNumber: '5596999097525',
  whatsappMessage: 'Olá! Quero agendar um horário na Shelby Barbearia.',
  instagramHandle: '@shelb_barber',
  instagramUrl: 'https://instagram.com/shelb_barber',
  address: 'Avenida Karipunas, 60',
  addressDetail: 'Oiapoque, AP, 68980-000',
  phoneDisplay: '(96) 99909-7525',
  hours: 'Segunda a sábado, 9h às 21h',
  hoursNote: 'Domingo fechado',
  since: '2017',
}

export function whatsappHref(message = barbeariaInfo.whatsappMessage): string {
  return `https://wa.me/${barbeariaInfo.whatsappNumber}?text=${encodeURIComponent(message)}`
}

export const navLinks = [
  { href: '#antes-depois', label: 'Resultados' },
  { href: '#cortes', label: 'Serviços' },
  { href: '#valores', label: 'Valores' },
  { href: '#local', label: 'Onde estamos' },
]

export const heroContent = {
  badge: 'Aberto hoje até 21h · Oiapoque, AP',
  titleLine1: 'O degradê que',
  titleHighlight: 'virou referência',
  titleLine3: 'em Oiapoque',
  subtitle:
    'Corte, barba e sobrancelha com acabamento de precisão. Cadeira reservada, sem espera e do jeito que você gosta.',
  ctaPrimary: 'Agendar no WhatsApp',
  ctaSecondary: 'Ver tabela de valores',
  image: unsplash('1503951914875-452162b0f3f1', 1000),
  imageAlt: 'Barbeiro finalizando um corte de cabelo',
  floatingCardTitle: 'Corte + barba',
  floatingCardValue: 'a partir de R$ 60',
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
  { value: '9h–21h', label: 'Seg a sáb' },
  { value: 'Desde 2017', label: 'Na régua', countTo: 2017, countPrefix: 'Desde ' },
  { value: 'R$ 30', label: 'A partir de', countTo: 30, countPrefix: 'R$ ' },
]

export interface BeforeAfterItem {
  id: string
  title: string
  before: string
  after: string
  beforeLabel: string
  afterLabel: string
  caption: string
}

export const beforeAfterContent = {
  eyebrow: 'Transformações',
  title: 'Antes & depois na cadeira',
  note: 'Arraste o controle de cada card para comparar o resultado.',
  items: [
    {
      id: 'degrade-navalhado',
      title: 'Degradê navalhado',
      before: before1,
      after: after1,
      beforeLabel: 'Antes',
      afterLabel: 'Depois',
      caption: 'Degradê navalhado',
    },
    {
      id: 'barba-desenhada',
      title: 'Barba desenhada',
      before: before2,
      after: after2,
      beforeLabel: 'Antes',
      afterLabel: 'Depois',
      caption: 'Barba desenhada',
    },
    {
      id: 'corte-sobrancelha',
      title: 'Corte + sobrancelha',
      before: before3,
      after: after3,
      beforeLabel: 'Antes',
      afterLabel: 'Depois',
      caption: 'Corte + sobrancelha',
    },
  ] satisfies BeforeAfterItem[],
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
    { title: 'Barba', detail: 'Toalha quente e desenho', image: acabamento3 },
    { title: 'Mudança de cores', detail: 'Coloração e tonalização', image: acabamento5 },
    { title: 'Pigmentação', detail: 'Preenchimento e disfarce', image: acabamento4 },
  ] satisfies ServiceItem[],
}

export interface PriceItem {
  name: string
  value: string
}

export const pricingContent = {
  eyebrow: 'Tabela de valores',
  title: 'Preço justo, sem surpresa',
  text: 'Promoção toda terça e quarta: corte simples + barba por R$ 50.',
  cta: 'Quero agendar',
  items: [
    { name: 'Cabelo', value: 'R$ 30' },
    { name: 'Barba', value: 'R$ 30' },
    { name: 'Barba + cabelo', value: 'R$ 60' },
    { name: 'Pigmentação', value: 'R$ 30' },
    { name: 'Degradê', value: 'R$ 50' },
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
  image: unsplash('1599351431202-1e0f0137899a', 900),
  imageAlt: 'Ambiente de barbearia',
  cta: 'Chamar no WhatsApp',
  cards: [
    {
      icon: MapPin,
      label: 'Endereço',
      value: barbeariaInfo.address,
      detail: `Oiapoque — AP, 68980-000`,
    },
    {
      icon: Clock,
      label: 'Horários',
      value: 'Segunda a sábado · 9h às 21h',
      detail: 'Domingo fechado',
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
  since: `Desde ${barbeariaInfo.since} · Oiapoque, AP`,
  instagramHandle: barbeariaInfo.instagramHandle,
  instagramUrl: barbeariaInfo.instagramUrl,
  phoneDisplay: barbeariaInfo.phoneDisplay,
  addressShort: `Av. Karipunas, 60`,
}
