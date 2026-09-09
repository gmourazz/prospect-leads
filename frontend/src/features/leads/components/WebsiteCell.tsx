import { Globe, GlobeLock, HelpCircle, ShieldQuestion, Instagram } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { WEBSITE_STATUS_LABELS, type WebPresence, type WebsiteStatus } from '@/types/domain'
import { WEBSITE_STATUS_TONE } from '../model/lead-status'

const ICONS: Record<WebsiteStatus, typeof Globe> = {
  has_website: Globe,
  no_website: GlobeLock,
  unknown: HelpCircle,
  review_required: ShieldQuestion,
}

export function WebsiteCell({
  status,
  presences,
}: {
  status: WebsiteStatus
  presences: WebPresence[]
}) {
  const Icon = ICONS[status]
  const instagram = presences.find((p) => p.kind === 'instagram')

  return (
    <div className="flex items-center gap-2">
      <Badge variant={WEBSITE_STATUS_TONE[status]}>
        <Icon />
        {WEBSITE_STATUS_LABELS[status]}
      </Badge>
      {instagram && (
        <a
          href={instagram.url}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
          title={instagram.url}
        >
          <Instagram className="size-3.5" />
        </a>
      )}
    </div>
  )
}
