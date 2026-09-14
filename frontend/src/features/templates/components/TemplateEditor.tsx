import { useRef, useState } from 'react'
import { ImagePlus, Loader2, MapPin, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSegments } from '@/features/segments/hooks/useSegments'
import { useCreateTemplate, useNewTemplateVersion } from '../hooks/useTemplates'
import { templatesApi } from '../api/templates.api'
import { VariablePicker } from './VariablePicker'
import { MessagePreview } from '@/features/campaigns/components/MessagePreview'
import { ApiError } from '@/lib/api-error'
import { cn } from '@/lib/cn'
import type { Template, TemplateImage } from '@/types/domain'

const NONE = '__none__'
const MAX_IMAGES = 5

/** Mirrors outreach.Greeting on the backend — same 3-bucket rule, same
 * timezone — so the editor's preview shows what will actually go out. */
function greetingNow() {
  const raw = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }).format(
      new Date(),
    ),
  )
  const hour = raw === 24 ? 0 : raw
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function TemplateEditor({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: Template
}) {
  const { data: segments } = useSegments()
  const create = useCreateTemplate()
  const newVersion = useNewTemplateVersion()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(template?.name ?? '')
  const [segmentId, setSegmentId] = useState(template?.segment_id ?? '')
  const [audience, setAudience] = useState<string>(template?.audience ?? 'no_website')
  const [channel, setChannel] = useState<string>(template?.channel ?? 'email')
  const [purpose, setPurpose] = useState<string>(template?.purpose ?? 'first_contact')
  const [subject, setSubject] = useState(template?.subject ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [images, setImages] = useState<TemplateImage[]>(template?.images ?? [])
  const [uploading, setUploading] = useState(false)

  function insertVariable(variable: string) {
    const el = textareaRef.current
    if (!el) return setBody((b) => b + `{{${variable}}}`)
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + `{{${variable}}}` + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => el.focus())
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      toast.warning(`Máximo de ${MAX_IMAGES} imagens por template`)
      return
    }
    const toUpload = Array.from(files).slice(0, remaining)
    setUploading(true)
    try {
      for (const file of toUpload) {
        const uploaded = await templatesApi.uploadAttachment(file)
        setImages((prev) => [...prev, uploaded])
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.userMessage : 'Falha ao enviar imagem')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  function handleSave() {
    const payload = {
      name,
      audience,
      channel,
      purpose,
      subject: channel === 'whatsapp' ? '' : subject,
      body,
      segment_id: segmentId || undefined,
      attachment_ids: images.map((img) => img.id),
    }
    if (template) {
      newVersion.mutate({ id: template.id, ...payload }, { onSuccess: () => onOpenChange(false) })
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          onOpenChange(false)
          setName('')
          setSubject('')
          setBody('')
          setSegmentId('')
          setChannel('email')
          setPurpose('first_contact')
          setImages([])
        },
      })
    }
  }

  const previewBody = body
    .replace(/\{\{nome_empresa\}\}/g, 'Barbearia Imperial')
    .replace(/\{\{nome_curto\}\}/g, 'Imperial')
    .replace(/\{\{segmento\}\}/g, 'barbearia')
    .replace(/\{\{cidade\}\}/g, 'Uberlândia')
    .replace(/\{\{estado\}\}/g, 'MG')
    .replace(/\{\{saudacao\}\}/g, greetingNow())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar template (nova versão)' : 'Novo template'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 px-6 pb-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Barbearia 01" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Segmento</Label>
            <Select value={segmentId || NONE} onValueChange={(v) => setSegmentId(v === NONE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Todos os segmentos</SelectItem>
                {segments?.data.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Para quem é</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_website">Sem site (posso fazer um)</SelectItem>
                <SelectItem value="has_website">Já tem site (posso melhorar)</SelectItem>
                <SelectItem value="any">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Canal</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Momento</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first_contact">Primeiro contato</SelectItem>
                <SelectItem value="remarketing">Remarketing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {channel === 'email' && (
            <div className="col-span-2 space-y-1.5">
              <Label>Assunto</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Portfólio e preços para {{nome_empresa}}"
              />
            </div>
          )}
          <div className="col-span-2 space-y-1.5">
            <Label>Variáveis</Label>
            <VariablePicker onInsert={insertVariable} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Oi, {{nome_empresa}}! Tudo bem?"
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Imagens ({images.length}/{MAX_IMAGES})</Label>
              {images.length < MAX_IMAGES && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  loading={uploading}
                >
                  <ImagePlus /> Adicionar
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            {images.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {images.map((img, i) => {
                  const token = `imagem_${i + 1}`
                  const placed = body.includes(`{{${token}}}`)
                  return (
                    <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                      <img src={img.url} alt={img.filename} className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(img.id)}
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-foreground/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Remover ${img.filename}`}
                      >
                        <X className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertVariable(token)}
                        title={placed ? 'Já está na mensagem' : 'Inserir esta imagem na mensagem'}
                        className={cn(
                          'absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-0.5 text-[10px] font-medium text-white transition-opacity',
                          placed ? 'bg-primary/80 opacity-100' : 'bg-foreground/70 opacity-0 group-hover:opacity-100',
                        )}
                      >
                        <MapPin className="size-3" />
                        {placed ? 'Na mensagem' : 'Inserir aqui'}
                      </button>
                    </div>
                  )
                })}
                {uploading && (
                  <div className="flex aspect-square items-center justify-center rounded-md border border-dashed border-border">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </div>

          {body && (
            <div className="col-span-2">
              <Label className="mb-1.5 block">Prévia</Label>
              <MessagePreview
                subject={channel === 'whatsapp' ? '' : subject}
                body={previewBody}
                images={images.map((i) => i.url)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            loading={create.isPending || newVersion.isPending}
            disabled={!name || (channel === 'email' && !subject) || !body || uploading}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
