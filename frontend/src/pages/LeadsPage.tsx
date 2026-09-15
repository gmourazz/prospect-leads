import { useMemo, useState } from 'react'
import { MailSearch, RefreshCw, Send, Sheet } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Pagination } from '@/components/common/Pagination'
import { useLeadFilters } from '@/features/leads/hooks/useLeadFilters'
import { useLeadDensity } from '@/features/leads/hooks/useLeadDensity'
import { useEnrichEmails, useEnrichProgress, useLeads } from '@/features/leads/hooks/useLeads'
import { leadsApi } from '@/features/leads/api/leads.api'
import { LeadsToolbar } from '@/features/leads/components/LeadsToolbar'
import { LeadsTable } from '@/features/leads/components/LeadsTable'
import { EnrichProgressBar } from '@/features/leads/components/EnrichProgressBar'
import { LeadsEmptyState } from '@/features/leads/components/LeadsEmptyState'
import { SelectionBar } from '@/features/leads/components/SelectionBar'
import { BulkWhatsAppDialog } from '@/features/leads/components/BulkWhatsAppDialog'
import { EnqueueWhatsAppDialog } from '@/features/whatsapp/components/EnqueueWhatsAppDialog'
import { NewLeadDialog } from '@/features/leads/components/NewLeadDialog'
import { CreateCampaignDialog } from '@/features/campaigns/components/CreateCampaignDialog'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { downloadCsv, toCsv } from '@/lib/csv'
import { contactBadge } from '@/features/leads/model/contact-badge'
import { WEBSITE_STATUS_LABELS, type Lead } from '@/types/domain'

export function LeadsPage() {
  const { filters, setFilter, reset, activeCount } = useLeadFilters()
  const { data, isLoading, isError, error, refetch, isFetching } = useLeads(filters)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [whatsappQueue, setWhatsappQueue] = useState<Lead[]>([])
  const [whatsappSkipped, setWhatsappSkipped] = useState(0)
  const [enqueueOpen, setEnqueueOpen] = useState(false)
  const [enqueueLeads, setEnqueueLeads] = useState<Lead[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [density, setDensity] = useLeadDensity()
  const [exporting, setExporting] = useState(false)
  const enrichEmails = useEnrichEmails()
  const { data: enrichProgress } = useEnrichProgress()

  const leads = data?.data ?? []
  const counts = data?.meta.counts

  async function handleExport() {
    if (!counts || counts.total === 0) return
    setExporting(true)
    try {
      const all = await leadsApi.list({ ...filters, page: undefined, limit: counts.total })
      const rows: (string | number)[][] = [
        ['Empresa', 'Segmento', 'Cidade', 'Estado', 'Telefone', 'Email', 'Site', 'Status', 'Última interação'],
        ...all.data.map((lead) => [
          lead.company.name,
          lead.segment?.name ?? '',
          lead.company.city ?? '',
          lead.company.state ?? '',
          lead.contact.phone_display,
          lead.contact.email ?? '',
          WEBSITE_STATUS_LABELS[lead.company.website_status],
          contactBadge(lead.contact).label,
          lead.last_interaction_at ?? '',
        ]),
      ]
      downloadCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
    } catch {
      toast.error('Não foi possível exportar os leads.')
    } finally {
      setExporting(false)
    }
  }

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

  const selectedForWhatsApp = leads.filter(
    (l) => selected.has(l.id) && l.contact.contact_point_id && !l.contact.is_suppressed,
  )

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
              onClick={() => refetch()}
              loading={isFetching}
            >
              <RefreshCw />
              Atualizar
            </Button>
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
              variant="ghost"
              size="sm"
              onClick={handleExport}
              loading={exporting}
              disabled={!counts || counts.total === 0}
            >
              <Sheet />
              Exportar
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
          counts={counts}
          onSetFilter={setFilter}
          onApplyFilters={applyFilters}
          activeCount={activeCount}
          onNewLead={() => setNewLeadOpen(true)}
          density={density}
          onDensityChange={setDensity}
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
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
            density={density}
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
        onQueueWhatsApp={
          selectedForWhatsApp.length > 0
            ? () => {
                setEnqueueLeads(selectedForWhatsApp)
                setEnqueueOpen(true)
              }
            : undefined
        }
        onSendWhatsApp={
          selectedForWhatsApp.length > 0
            ? () => {
                // Snapshot at open time: confirming a send invalidates the
                // leads query, which can reorder/refetch the current page
                // and silently shrink a queue that stayed wired to live data.
                setWhatsappQueue(selectedForWhatsApp)
                setWhatsappSkipped(selected.size - selectedForWhatsApp.length)
                setWhatsappOpen(true)
              }
            : undefined
        }
      />

      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />
      <CreateCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        filters={filters}
        matchingCount={counts?.available}
      />
      <BulkWhatsAppDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        leads={whatsappQueue}
        skipped={whatsappSkipped}
      />
      <EnqueueWhatsAppDialog
        open={enqueueOpen}
        onOpenChange={setEnqueueOpen}
        leads={enqueueLeads}
      />
    </div>
  )
}
