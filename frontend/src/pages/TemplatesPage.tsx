import { useState } from 'react'
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TEMPLATE_AUDIENCE_LABELS } from '@/types/domain'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useDeleteTemplate, useTemplates } from '@/features/templates/hooks/useTemplates'
import { TemplateEditor } from '@/features/templates/components/TemplateEditor'
import { formatDate } from '@/lib/format'
import type { Template } from '@/types/domain'

export function TemplatesPage() {
  const { data, isLoading, isError, error, refetch } = useTemplates()
  const deleteTemplate = useDeleteTemplate()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Template | undefined>()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const templates = data?.data ?? []

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nenhum template ainda"
          description="Crie uma mensagem com variáveis como {{nome_empresa}} e {{cidade}}."
          action={<Button size="sm" onClick={() => setEditorOpen(true)}>Novo template</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((t: Template) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{t.name}</p>
                      <Badge variant={t.audience === 'has_website' ? 'info' : 'neutral'}>
                        {TEMPLATE_AUDIENCE_LABELS[t.audience] ?? t.audience}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      v{t.version} · {t.segment_name ?? 'sem segmento'} · atualizado {formatDate(t.updated_at)}
                    </p>
                    {t.subject && (
                      <p className="mt-1 truncate text-[12.5px]">
                        <span className="text-muted-foreground">Assunto: </span>{t.subject}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon-sm"
                      aria-label="Editar template"
                      title="Editar template"
                      onClick={() => { setEditing(t); setEditorOpen(true) }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      aria-label="Remover template"
                      title="Remover template"
                      onClick={() => setDeletingId(t.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <p className="mt-2.5 line-clamp-3 whitespace-pre-wrap text-[13px] text-muted-foreground">
                  {t.body}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {t.variables.map((v: string) => (
                    <Badge key={v} variant="outline">{`{{${v}}}`}</Badge>
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
