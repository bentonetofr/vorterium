import { useEffect, useRef, useState } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { noteImageUrls, type NoteImage } from '../services/notebookService'

// ────────────────────────────────────────────────────────
// Imagens de uma anotação (miniaturas; clique amplia) e o seletor de
// emojis do caderno. As imagens moram num bucket privado: os links são
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

const EMOJIS = [
  '😀', '😂', '😅', '😊', '😍', '🥰', '😎', '🤔', '🤨', '😏', '😬', '😱',
  '😡', '😭', '😴', '🤫', '🙄', '😈', '👍', '👎', '👏', '🙏', '💪', '🤝',
  '❤️', '💔', '🔥', '✨', '⭐', '💀', '👻', '🐉', '🐺', '🦅', '🐍', '🕷️',
  '🌙', '☀️', '⚡', '❄️', '🌊', '🌲', '🏰', '⚔️', '🗡️', '🛡️', '🏹', '🪄',
  '🧪', '📜', '🗝️', '💰', '💎', '🎲', '🗺️', '📍', '❓', '❗', '✅', '❌',
]

/** Botão 😊 que abre uma grade de emojis; escolher chama onPick. */
export function EmojiButton({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true) }
  }, [open])

  return (
    <div className="note-emoji" ref={ref}>
      <button
        type="button"
        className="note-tool"
        // Não tira o foco da folha: o emoji entra onde está o cursor.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Emojis"
        title="Emojis (no Windows também dá com Win + .)"
      >
        😊
      </button>
      {open && (
        <div className="note-emoji__grid" role="listbox" aria-label="Emojis">
          {EMOJIS.map((e) => (
            <button key={e} type="button" className="note-emoji__item" onMouseDown={(ev) => ev.preventDefault()} onClick={() => onPick(e)}>{e}</button>
          ))}
        </div>
      )}
    </div>
  )
}
