import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'

const IMAGE_TOKEN = /\{\{\s*imagem_(\d+)\s*\}\}/g

/**
 * Splits the body around {{imagem_N}} tokens so a referenced image renders
 * exactly where it was placed in the text — mirroring the real inline email
 * the backend builds (see gmailsmtp buildMessage). Any image the body never
 * references falls back to the old behavior: listed after the text.
 */
function splitBody(body: string, images: string[]) {
  const segments: { text?: string; imageUrl?: string }[] = []
  const referenced = new Set<number>()
  let lastIndex = 0
  IMAGE_TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = IMAGE_TOKEN.exec(body))) {
    if (match.index > lastIndex) segments.push({ text: body.slice(lastIndex, match.index) })
    const i = Number(match[1]) - 1
    const url = images[i]
    if (url) {
      segments.push({ imageUrl: url })
      referenced.add(i)
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) segments.push({ text: body.slice(lastIndex) })

  return { segments, unreferenced: images.filter((_, i) => !referenced.has(i)) }
}

export function MessagePreview({
  subject,
  body,
  images = [],
  companyName,
}: {
  subject: string
  body: string
  images?: string[]
  companyName?: string
}) {
  const { segments, unreferenced } = splitBody(body, images)

  return (
    <Card>
      <CardContent className="p-4">
        {companyName && (
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Prévia para {companyName}
          </p>
        )}
        <div className="rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-[13.5px] font-medium">{subject || '(sem assunto)'}</p>
          </div>
          <div className="p-3">
            {segments.map((seg, i) =>
              seg.imageUrl ? (
                <img
                  key={i}
                  src={seg.imageUrl}
                  alt=""
                  className="my-2 aspect-video w-full rounded-md object-cover"
                />
              ) : (
                <p key={i} className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {seg.text}
                </p>
              ),
            )}
            {unreferenced.length > 0 && (
              <div
                className={cn(
                  'mt-2 grid gap-1',
                  unreferenced.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                )}
              >
                {unreferenced.map((url, i) => (
                  <img
                    key={url + i}
                    src={url}
                    alt=""
                    className="aspect-video w-full rounded-md object-cover"
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
