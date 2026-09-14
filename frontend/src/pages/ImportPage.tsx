import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FileDropzone } from '@/features/imports/components/FileDropzone'
import { ImportSummary } from '@/features/imports/components/ImportSummary'
import { ImportPreviewTable } from '@/features/imports/components/ImportPreviewTable'
import { useAnalyzeImport, useCommitImport } from '@/features/imports/hooks/useImports'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import { cn } from '@/lib/cn'
import type { ImportPreview } from '@/types/domain'

const DETECTED_COLUMNS = ['nome', 'telefone', 'cidade', 'site', 'segmento']

const IMPORT_RULES = [
  'Telefone repetido é mesclado, nunca duplicado',
  'Contatos em "Não contatar" ficam de fora dos envios automaticamente',
  'Segmento em branco entra como "sem segmento"',
]

const STEPS = [
  { number: 1, label: 'Enviar CSV' },
  { number: 2, label: 'Revisar' },
  { number: 3, label: 'Confirmar' },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              step.number === current
                ? 'border-primary bg-primary/10 text-primary'
                : step.number < current
                  ? 'border-transparent bg-success-subtle text-success'
                  : 'border-transparent bg-muted text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                step.number === current
                  ? 'bg-primary text-primary-foreground'
                  : step.number < current
                    ? 'bg-success text-success-foreground'
                    : 'bg-border text-muted-foreground',
              )}
            >
              {step.number}
            </span>
            {step.label}
          </div>
          {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  )
}

export function ImportPage() {
  const analyze = useAnalyzeImport()
  const commit = useCommitImport()
  const { acquire, release } = useIdempotencyKey()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [committed, setCommitted] = useState<ImportPreview | null>(null)

  function handleFile(file: File) {
    setCommitted(null)
    analyze.mutate({ file }, { onSuccess: setPreview })
  }

  function handleCommit() {
    if (!preview) return
    const key = acquire()
    commit.mutate(
      { jobId: preview.job_id, idempotencyKey: key },
      { onSuccess: setCommitted, onSettled: release },
    )
  }

  const step = !preview ? 1 : !committed ? 2 : 3

  return (
    <div>
      <PageHeader
        title="Importar leads"
        description="Três passos: enviar o arquivo, revisar o que vai acontecer, confirmar"
      />

      <StepIndicator current={step} />

      {!preview && (
        <>
          <FileDropzone onFile={handleFile} />
          {analyze.isPending && (
            <p className="mt-3 text-center text-[13px] text-muted-foreground">Analisando arquivo…</p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <p className="font-semibold">Colunas detectadas automaticamente</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DETECTED_COLUMNS.map((col) => (
                    <span
                      key={col}
                      className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 font-mono text-[11.5px] font-medium text-primary"
                    >
                      {col}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-[12.5px] text-muted-foreground">
                  O que não for reconhecido pode ser mapeado à mão no passo 2.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="font-semibold">Regras aplicadas na importação</p>
                <ul className="mt-3 space-y-2">
                  {IMPORT_RULES.map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-[13px] text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {preview && !committed && (
        <div className="space-y-4">
          <ImportSummary preview={preview} />
          <ImportPreviewTable rows={preview.rows} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
            <Button onClick={handleCommit} loading={commit.isPending}>
              Confirmar importação de {preview.total_rows} linhas
            </Button>
          </div>
        </div>
      )}

      {committed && (
        <div className="space-y-4">
          <div className="rounded-md bg-success-subtle px-4 py-3 text-[13px] text-success">
            Importação concluída: {committed.will_create} criadas, {committed.will_merge} atualizadas,{' '}
            {committed.already_contacted} já contatadas preservadas.
          </div>
          <ImportPreviewTable rows={committed.rows} />
          <Button variant="secondary" onClick={() => { setPreview(null); setCommitted(null) }}>
            Nova importação
          </Button>
        </div>
      )}
    </div>
  )
}
