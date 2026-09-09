import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  FileSpreadsheet,
  Clock,
  LayoutDashboard,
  Mail,
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
    <aside className="hidden w-[236px] shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-7 items-center justify-center rounded-md gradient-brand glow-primary">
          <BarChart3 className="size-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-tight">Prospect</p>
          <p className="text-[11px] text-muted-foreground">Prospecção comercial</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
        <div className="flex flex-col gap-0.5">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Configuração
          </p>
          {NAV_SECONDARY.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-md bg-muted/60 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
            <Mail className={cn('size-3.5', connected ? 'text-success' : 'text-muted-foreground')} />
            {settings?.sender_email || 'Carregando…'}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {connected
              ? 'Conectado — emails saem de verdade por este endereço.'
              : 'Não conectado — defina GMAIL_ADDRESS e GMAIL_APP_PASSWORD no backend.'}
          </p>
        </div>
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
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </NavLink>
  )
}
