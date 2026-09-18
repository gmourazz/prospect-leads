import type { Photo as PhotoData } from '../data/content'

interface PhotoProps {
  photo: PhotoData
  priority?: boolean
}

/** Cropped, full-bleed photo frame used across hero/about/services media slots. */
export function Photo({ photo, priority = false }: PhotoProps) {
  return (
    <div className="media-photo">
      <img
        src={photo.src}
        alt={photo.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
      />
    </div>
  )
}
