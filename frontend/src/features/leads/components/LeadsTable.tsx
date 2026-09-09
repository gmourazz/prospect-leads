import { Fragment } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatRelative } from '@/lib/format'
import { LEAD_STATUS_LABELS, type Lead } from '@/types/domain'
import { LEAD_STATUS_TONE } from '../model/lead-status'
import { ContactStatusBadge } from './ContactStatusBadge'
import { WebsiteCell } from './WebsiteCell'
import { LeadRowActions } from './LeadRowActions'

export function LeadsTable({
  leads,
  isLoading,
  selected,
  onToggle,
  onToggleAll,
}: {
  leads: Lead[]
  isLoading: boolean
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
}) {
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id))
  const someSelected = leads.some((l) => selected.has(l.id)) && !allSelected

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border">
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
                  className="group h-11 border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <Td>
                    <Checkbox
                      checked={selected.has(lead.id)}
                      onCheckedChange={() => onToggle(lead.id)}
                      aria-label={`Selecionar ${lead.company.name}`}
                    />
                  </Td>
                  <Td className="max-w-[220px]">
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
                  </Td>
                  <Td>
                    {lead.segment ? (
                      <Badge variant="outline">{lead.segment.name}</Badge>
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
                        <ContactStatusBadge contact={lead.contact} />
                      </div>
                    ) : (
                      <Badge variant="neutral">Sem contato</Badge>
                    )}
                  </Td>
                  <Td className="hidden lg:table-cell">
                    <WebsiteCell status={lead.company.website_status} presences={lead.web_presences} />
                  </Td>
                  <Td>
                    <Badge variant={LEAD_STATUS_TONE[lead.status]}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </Badge>
                  </Td>
                  <Td
                    className="hidden text-muted-foreground xl:table-cell"
                    title={formatDate(lead.last_interaction_at)}
                  >
                    {formatRelative(lead.last_interaction_at ?? lead.collected_at)}
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
      className={`px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${className}`}
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
    <td className={`px-4 py-2 align-middle ${className}`} title={title}>
      {children}
    </td>
  )
}

function SkeletonRow() {
  return (
    <tr className="h-11 border-b border-border/70 last:border-0">
      {Array.from({ length: 9 }).map((_, i) => (
        <Fragment key={i}>
          <td className="px-4 py-2">
            <Skeleton className="h-4 w-full max-w-[120px]" />
          </td>
        </Fragment>
      ))}
    </tr>
  )
}
