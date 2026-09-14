import { Fragment } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatDate, formatRelative } from '@/lib/format'
import { initials, segmentColorHex, segmentTint } from '@/lib/segment-colors'
import { LEAD_STATUS_LABELS, type Lead } from '@/types/domain'
import { LEAD_STATUS_TONE } from '../model/lead-status'
import type { Density } from '../hooks/useLeadDensity'
import { WebsiteCell } from './WebsiteCell'
import { LeadRowActions } from './LeadRowActions'

export function LeadsTable({
  leads,
  isLoading,
  selected,
  onToggle,
  onToggleAll,
  density,
}: {
  leads: Lead[]
  isLoading: boolean
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  density: Density
}) {
  const rowPy = density === 'compact' ? '8px' : '14px'
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const someSelected = leads.some((l) => selected.has(l.id)) && !allSelected

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-border bg-surface"
      style={{ '--row-py': rowPy } as React.CSSProperties}
    >
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <Th className="w-10">
              <Checkbox
                checked={someSelected ? 'indeterminate' : allSelected}
                onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
                aria-label="Selecionar todos"
              />
            </Th>
            <Th>Empresa</Th>
            <Th>Segmento</Th>
            <Th>Cidade</Th>
            <Th>Contato</Th>
            <Th>Site</Th>
            <Th>Status</Th>
            <Th>Última interação</Th>
            <Th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            : leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="group border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <Td>
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => onToggle(lead.id)}
                      aria-label={`Selecionar ${lead.company.name}`}
                    />
                  </Td>
                  <Td className="max-w-[240px]">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold"
                        style={{
                          backgroundColor: segmentTint(lead.segment?.color),
                          color: segmentColorHex(lead.segment?.color),
                        }}
                      >
                        {initials(lead.company.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium text-foreground">{lead.company.name}</p>
                          {lead.company.is_open_now !== null && (
                            <span
                              className={`size-1.5 shrink-0 rounded-full ${
                                lead.company.is_open_now ? 'bg-success' : 'bg-muted-foreground/40'
                              }`}
                              title={lead.company.is_open_now ? 'Aberto agora' : 'Fechado agora'}
                            />
                          )}
                        </div>
                        {lead.company.city && (
                          <p className="truncate text-[12px] text-muted-foreground md:hidden">
                            {lead.company.city}
                          </p>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {lead.segment ? (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: segmentTint(lead.segment.color),
                          color: segmentColorHex(lead.segment.color),
                        }}
                      >
                        {lead.segment.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="hidden text-muted-foreground md:table-cell">
                    {lead.company.city ? `${lead.company.city}/${lead.company.state ?? ''}` : '—'}
                  </Td>
                  <Td>
                    {lead.contact.contact_point_id ? (
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-[12.5px] tabular text-foreground">
                          {lead.contact.phone_display}
                        </span>
                        <span
                          className={
                            lead.contact.email
                              ? 'truncate text-[11.5px] text-muted-foreground'
                              : 'text-[11.5px] text-warning'
                          }
                        >
                          {lead.contact.email ?? 'sem email'}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="neutral">Sem contato</Badge>
                    )}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    <WebsiteCell status={lead.company.website_status} />
                  </Td>
                  <Td>
                    <Badge variant={LEAD_STATUS_TONE[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </Td>
                  <Td
                    className="hidden xl:table-cell"
                    title={formatDate(lead.last_interaction_at)}
                  >
                    <p className="text-muted-foreground">
                      {formatRelative(lead.last_interaction_at ?? lead.collected_at)}
                    </p>
                    <p
                      className={cn(
                        'text-[11.5px] font-medium',
                        lead.is_available ? 'text-success' : 'text-muted-foreground/70',
                      )}
                    >
                      {lead.is_available ? 'disponível' : 'em espera'}
                    </p>
                  </Td>
                  <Td>
                    <LeadRowActions lead={lead} />
                  </Td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${className}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
  title,
}: {
  children?: React.ReactNode
  className?: string
  title?: string
}) {
  return (
    <td className={`px-4 py-[var(--row-py)] align-middle ${className}`} title={title}>
      {children}
    </td>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/70 last:border-0">
      {Array.from({ length: 9 }).map((_, i) => (
        <Fragment key={i}>
          <td className="px-4 py-3">
            <Skeleton className="h-4 w-full max-w-[120px]" />
          </td>
        </Fragment>
      ))}
    </tr>
  )
}
