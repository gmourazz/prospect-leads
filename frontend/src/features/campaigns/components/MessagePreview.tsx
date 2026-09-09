import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'

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
  return (
    <Card>
      <CardContent className="p-4">
        {companyName && (
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Prévia para {companyName}
          </p>
        )}
        <div className="rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-[13.5px] font-medium">{subject || '(sem assunto)'}</p>
          </div>
          <div className="p-3">
            {images.length > 0 && (
              <div
                className={cn(
                  'mb-2 grid gap-1',
                  images.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
                )}
              >
                {images.map((url, i) => (
                  <img
                    key={url + i}
                    src={url}
                    alt=""
                    className="aspect-video w-full rounded-md object-cover"
                  />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{body}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
