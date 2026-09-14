import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  FileSpreadsheet,
  Clock,
  LayoutDashboard,
  MessageSquareText,
  Search,
  Send,
  Settings,
  ShieldBan,
  Tags,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSettings } from '@/features/settings/hooks/useSettings'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/buscar', label: 'Buscar leads', icon: Search },
  { to: '/campanhas', label: 'Campanhas', icon: Send },
  { to: '/aguardando', label: 'Aguardando resposta', icon: Clock },
  { to: '/templates', label: 'Templates', icon: MessageSquareText },
  { to: '/importar', label: 'Importar', icon: FileSpreadsheet },
]

const NAV_SECONDARY = [
  { to: '/segmentos', label: 'Segmentos', icon: Tags },
  { to: '/bloqueios', label: 'Não contatar', icon: ShieldBan },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const { data: settings } = useSettings()
  const connected = Boolean(settings?.sender_email)

  return (
    <aside className="hidden w-[250px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[11px] gradient-brand glow-primary">
          <BarChart3 className="size-[18px] text-white" />
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[15.5px] font-bold tracking-tight">Prospect</p>
          <p className="truncate text-[12px] text-muted-foreground">Prospecção comercial</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 scrollbar-thin">
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <p className="px-3 pb-1.5 pt-5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">
          Configuração
        </p>
        {NAV_SECONDARY.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className={cn('truncate text-[13px] font-semibold', connected ? 'text-foreground' : 'text-muted-foreground')}>
          {settings?.sender_email || 'Carregando…'}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          {connected
            ? 'Conectado — emails saem de verdade por este endereço.'
            : 'Não conectado — defina GMAIL_ADDRESS e GMAIL_APP_PASSWORD no backend.'}
        </p>
      </div>
    </aside>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string
  label: string
  icon: typeof Users
  end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-[11px] border px-3 py-2.5 text-[14px] font-medium transition-colors',
          isActive
            ? 'border-primary/30 bg-primary/[0.14] text-primary'
            : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )
      }
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </NavLink>
  )
}
