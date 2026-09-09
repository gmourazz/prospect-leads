import { useMemo, useState } from 'react'
import { MailSearch, Send } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Pagination } from '@/components/common/Pagination'
import { useLeadFilters } from '@/features/leads/hooks/useLeadFilters'
import { useEnrichEmails, useEnrichProgress, useLeads } from '@/features/leads/hooks/useLeads'
import { LeadsToolbar } from '@/features/leads/components/LeadsToolbar'
import { LeadsTable } from '@/features/leads/components/LeadsTable'
import { EnrichProgressBar } from '@/features/leads/components/EnrichProgressBar'
import { LeadsEmptyState } from '@/features/leads/components/LeadsEmptyState'
import { SelectionBar } from '@/features/leads/components/SelectionBar'
import { NewLeadDialog } from '@/features/leads/components/NewLeadDialog'
import { CreateCampaignDialog } from '@/features/campaigns/components/CreateCampaignDialog'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'

export function LeadsPage() {
  const { filters, setFilter, reset, activeCount } = useLeadFilters()
  const { data, isLoading, isError, error, refetch } = useLeads(filters)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const enrichEmails = useEnrichEmails()
  const { data: enrichProgress } = useEnrichProgress()

  const leads = data?.data ?? []
  const counts = data?.meta.counts

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      leads.forEach((l) => (checked ? next.add(l.id) : next.delete(l.id)))
      return next
    })

  const applyFilters = (patch: Record<string, unknown>) => {
    Object.entries(patch).forEach(([key, value]) => setFilter(key, value ? String(value) : undefined))
  }

  const counters = useMemo(() => {
    if (!counts) return null
    return [
      { label: 'encontrados', value: counts.total },
      { label: 'disponíveis', value: counts.available, tone: 'success' as const },
      { label: 'já contatados', value: counts.contacted, tone: 'neutral' as const },
    ]
  }, [counts])

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <div>
      <PageHeader
        title="Leads"
        description={
          counters
            ? counters.map((c) => `${formatNumber(c.value)} ${c.label}`).join(' · ')
            : undefined
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => enrichEmails.mutate(undefined)}
              loading={enrichEmails.isPending}
              disabled={enrichProgress?.running}
            >
              <MailSearch />
              Buscar emails
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCampaignOpen(true)}
              disabled={!counts || counts.available === 0}
            >
              <Send />
              Criar campanha
            </Button>
          </>
        }
      />

      {enrichProgress && <EnrichProgressBar progress={enrichProgress} />}

      <div className="mb-4">
        <LeadsToolbar
          filters={filters}
          onSetFilter={setFilter}
          onApplyFilters={applyFilters}
          activeCount={activeCount}
          onNewLead={() => setNewLeadOpen(true)}
        />
      </div>

      {!isLoading && leads.length === 0 ? (
        <LeadsEmptyState filtered={activeCount > 0 || Boolean(filters.q)} onClear={reset} />
      ) : (
        <>
          <LeadsTable
            leads={leads}
            isLoading={isLoading}
            selected={selected}
            onToggle={toggle}
            onToggleAll={toggleAll}
          />
          {counts && (
            <Pagination
              page={filters.page ?? 1}
              limit={filters.limit ?? 50}
              total={counts.total}
              onPageChange={(p) => setFilter('page', String(p))}
              onLimitChange={(l) => setFilter('limit', String(l))}
            />
          )}
        </>
      )}

      <SelectionBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        onCreateCampaign={() => setCampaignOpen(true)}
      />

      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
      <CreateCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        filters={filters}
        matchingCount={counts?.available}
      />
    </div>
  )
}
