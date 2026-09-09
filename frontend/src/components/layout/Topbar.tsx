import { useEffect, useState } from 'react'
import { LogOut, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/useAuth'

export function Topbar() {
  const { user, logout } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('prospect-theme') as 'light' | 'dark') ?? 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('prospect-theme', theme)
  }, [theme])

  const initials = (user?.name ?? user?.email ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface/80 px-6 backdrop-blur">
      <div className="md:hidden">
        <p className="text-sm font-semibold">Prospect</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          aria-label="Alternar tema"
        >
          {theme === 'light' ? <Moon /> : <Sun />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex size-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground transition-opacity hover:opacity-80"
              aria-label="Menu do usuário"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
            <p className="px-2 pb-1.5 -mt-1 truncate text-[11px] text-muted-foreground">{user?.email}</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={logout}>
              <LogOut />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
