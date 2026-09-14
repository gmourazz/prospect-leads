import { useState } from 'react'
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TEMPLATE_AUDIENCE_LABELS, TEMPLATE_CHANNEL_LABELS, TEMPLATE_PURPOSE_LABELS } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useDeleteTemplate, useTemplates } from '@/features/templates/hooks/useTemplates'
import { TemplateEditor } from '@/features/templates/components/TemplateEditor'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Template } from '@/types/domain'

type Filter = 'all' | 'no_website' | 'has_website' | 'with_image' | 'email' | 'whatsapp' | 'first_contact' | 'remarketing'

export function TemplatesPage() {
  const { data, isLoading, isError, error, refetch } = useTemplates()
  const deleteTemplate = useDeleteTemplate()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Template | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const templates = data?.data ?? []

  const filterOptions: { value: Filter; label: string; count: number }[] = [
    { value: 'all', label: 'Todos', count: templates.length },
    { value: 'no_website', label: 'Sem site', count: templates.filter((t) => t.audience === 'no_website').length },
    { value: 'has_website', label: 'Já tem site', count: templates.filter((t) => t.audience === 'has_website').length },
    { value: 'with_image', label: 'Com imagem', count: templates.filter((t) => (t.images ?? []).length > 0).length },
    { value: 'email', label: 'Email', count: templates.filter((t) => t.channel === 'email').length },
    { value: 'whatsapp', label: 'WhatsApp', count: templates.filter((t) => t.channel === 'whatsapp').length },
    { value: 'first_contact', label: 'Primeiro contato', count: templates.filter((t) => t.purpose === 'first_contact').length },
    { value: 'remarketing', label: 'Remarketing', count: templates.filter((t) => t.purpose === 'remarketing').length },
  ]

  const filtered = templates.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'with_image') return (t.images ?? []).length > 0
    if (filter === 'email' || filter === 'whatsapp') return t.channel === filter
    if (filter === 'first_contact' || filter === 'remarketing') return t.purpose === filter
    return t.audience === filter
  })

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Mensagens reutilizáveis com variáveis e imagem"
        actions={
          <Button size="sm" onClick={() => { setEditing(undefined); setEditorOpen(true) }}>
            <Plus /> Novo template
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nenhum template ainda"
          description="Crie uma mensagem com variáveis como {{nome_empresa}} e {{cidade}}."
          action={<Button size="sm" onClick={() => setEditorOpen(true)}>Novo template</Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors',
                  filter === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-muted text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label} {opt.count}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t: Template) => (
              <Card key={t.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.name}</p>
                      <Badge variant={t.audience === 'has_website' ? 'info' : t.audience === 'no_website' ? 'warning' : 'neutral'}>
                        {TEMPLATE_AUDIENCE_LABELS[t.audience] ?? t.audience}
                      </Badge>
                      <Badge variant={t.channel === 'whatsapp' ? 'success' : 'neutral'}>
                        {TEMPLATE_CHANNEL_LABELS[t.channel] ?? t.channel}
                      </Badge>
                      <Badge variant={t.purpose === 'remarketing' ? 'warning' : 'info'}>
                        {TEMPLATE_PURPOSE_LABELS[t.purpose] ?? t.purpose}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline" size="icon-sm"
                        aria-label="Editar template"
                        title="Editar template"
                        onClick={() => { setEditing(t); setEditorOpen(true) }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="outline" size="icon-sm"
                        aria-label="Remover template"
                        title="Remover template"
                        onClick={() => setDeletingId(t.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    v{t.version} · {t.segment_name ?? 'sem segmento'} · atualizado {formatDate(t.updated_at)}
                  </p>
                  {t.subject && (
                    <p className="mt-2 truncate text-[13px]">
                      <span className="font-semibold">Assunto: </span>{t.subject}
                    </p>
                  )}
                  <p className="mt-2.5 line-clamp-3 whitespace-pre-wrap rounded-xl bg-primary/5 p-3 text-[13px] leading-relaxed text-muted-foreground">
                    {t.body}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {t.variables.map((v: string) => (
                      <span
                        key={v}
                        className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 font-mono text-[11.5px] font-medium text-primary"
                      >
                        {`{{${v}}}`}
                      </span>
                    ))}
                  </div>
                  {(t.images ?? []).length > 0 && (
                    <div className="mt-2.5 flex gap-1.5">
                      {t.images.map((img) => (
                        <img
                          key={img.id}
                          src={img.url}
                          alt={img.filename}
                          className="size-10 rounded-md border border-border object-cover"
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* key forces a fresh instance per template — otherwise the dialog's
          internal state (name/body/images) is only initialized once and
          never updates when switching which template is being edited. */}
      <TemplateEditor
        key={editing?.id ?? 'new'}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        template={editing}
      />

      <ConfirmDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Remover este template?"
        description="Campanhas que já usaram este template mantêm o histórico exatamente como foi enviado."
        variant="danger"
        confirmLabel="Remover"
        loading={deleteTemplate.isPending}
        onConfirm={() => deletingId && deleteTemplate.mutate(deletingId, { onSuccess: () => setDeletingId(null) })}
      />
    </div>
  )
}
