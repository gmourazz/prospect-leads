import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FileDropzone } from '@/features/imports/components/FileDropzone'
import { ImportSummary } from '@/features/imports/components/ImportSummary'
import { ImportPreviewTable } from '@/features/imports/components/ImportPreviewTable'
import { useAnalyzeImport, useCommitImport } from '@/features/imports/hooks/useImports'
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey'
import type { ImportPreview } from '@/types/domain'

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

  return (
    <div>
      <PageHeader
        title="Importar leads"
        description="Análise em três passos: enviar, revisar o que vai acontecer, confirmar"
      />

      {!preview && (
        <Card>
          <CardContent className="p-6">
            <FileDropzone onFile={handleFile} />
            {analyze.isPending && (
              <p className="mt-3 text-center text-[13px] text-muted-foreground">Analisando arquivo…</p>
            )}
          </CardContent>
        </Card>
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
