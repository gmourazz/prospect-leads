import type { Photo as PhotoData } from '../data/content'

interface PhotoProps {
  photo: PhotoData
  priority?: boolean
}

export function Photo({ photo, priority }: PhotoProps) {
  return (
    <div className="media-photo">
      <img src={photo.src} alt={photo.alt} loading={priority ? 'eager' : 'lazy'} />
    </div>
  )
}
