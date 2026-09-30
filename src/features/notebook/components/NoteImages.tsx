import { useEffect, useState } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { noteImageUrls, type NoteImage } from '../services/notebookService'

// ────────────────────────────────────────────────────────
// Imagens de uma anotação (miniaturas; clique amplia). As imagens moram num bucket privado: os links são
// temporários e só abrem pra autora e pros mestres da campanha.
// ────────────────────────────────────────────────────────

interface NoteImagesProps {
  images:    NoteImage[]
  /** Sem isso não aparece o ✕ (o mestre só olha). */
  onRemove?: (img: NoteImage) => void
  uploading?: number
  size?:     'sm' | 'lg'
}

export function NoteImages({ images, onRemove, uploading = 0, size = 'sm' }: NoteImagesProps) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [open, setOpen] = useState<NoteImage | null>(null)
  const key = images.map((i) => i.path).join('|')

  useEffect(() => {
    if (!key) return
    let alive = true
    void noteImageUrls(key.split('|')).then((m) => { if (alive) setUrls(m) }).catch(() => {})
    return () => { alive = false }
  }, [key])

  if (images.length === 0 && uploading === 0) return null
  return (
    <>
      <div className={`note-images note-images--${size}`}>
        {images.map((img) => (
          <figure key={img.path} className="note-images__item">
            <button type="button" className="note-images__open" onClick={() => setOpen(img)} aria-label="Ampliar imagem">
              {urls.get(img.path) ? <img src={urls.get(img.path)} alt="" loading="lazy" /> : <span className="spinner spinner--sm" />}
            </button>
            {onRemove && (
              <button type="button" className="note-images__remove" onClick={() => onRemove(img)} aria-label="Tirar imagem" title="Tirar imagem">✕</button>
            )}
          </figure>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <span key={`up-${i}`} className="note-images__item note-images__item--loading"><span className="spinner spinner--sm" /></span>
        ))}
      </div>
      {open && urls.get(open.path) && (
        <ModalOverlay onClose={() => setOpen(null)}>
          <figure className="note-lightbox" role="dialog" aria-modal="true" aria-label="Imagem da anotação">
            <img src={urls.get(open.path)} alt="" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Fechar</button>
          </figure>
        </ModalOverlay>
      )}
    </>
  )
}
