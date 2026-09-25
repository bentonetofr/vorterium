import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useMesaStream } from '../MesaStreamProvider'
import {
  deleteMesaImage,
  listMesaImages,
  uploadMesaImage,
  validateMesaImage,
  type MesaGalleryImage,
} from '../services/mesaImagesService'

// ────────────────────────────────────────────────────────
// Galeria da Mesa (só o mestre): envia mapas, retratos e cartas uma vez
// e mostra pra mesa com um clique — sem transmitir a tela. A imagem vai
// em qualidade total e quase não gasta internet (cada um baixa uma vez).
// ────────────────────────────────────────────────────────

export function MesaGallery({ campaignId }: { campaignId: string }) {
  const mesa = useMesaStream()
  const [images, setImages]       = useState<MesaGalleryImage[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [uploading, setUploading] = useState(0)
  const [busyId, setBusyId]       = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shownId = mesa.stage.image?.id ?? null

  useEffect(() => {
    let active = true
    listMesaImages(campaignId)
      .then((list) => { if (active) setImages(list) })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar a galeria.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [campaignId])

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(null)
    const problem = files.map(validateMesaImage).find(Boolean)
    if (problem) { setError(problem); return }

    setUploading(files.length)
    for (const file of files) {
      try {
        const image = await uploadMesaImage(campaignId, file)
        setImages((list) => [image, ...list])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function handleShow(image: MesaGalleryImage) {
    setError(null)
    setBusyId(image.id)
    try {
      await mesa.showImage({ id: image.id, path: image.path, name: image.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mostrar a imagem.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(image: MesaGalleryImage) {
    setError(null)
    setBusyId(image.id)
    try {
      if (shownId === image.id) mesa.hideImage()
      await deleteMesaImage(image)
      setImages((list) => list.filter((i) => i.id !== image.id))
      setConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a imagem.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="mesa-gallery" aria-labelledby="mesa-gallery-title">
      <header className="mesa-gallery__head">
        <div>
          <h5 id="mesa-gallery-title" className="mesa-gallery__title">Imagens da mesa</h5>
          <p className="mesa-gallery__sub">Mapas, retratos e cartas para mostrar a todos, sem transmitir a tela. Só você vê esta galeria.</p>
        </div>
        <button type="button" className="btn btn-ghost mesa-gallery__add" onClick={() => inputRef.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? `Enviando${uploading > 1 ? ` (${uploading})` : ''}…` : '+ Adicionar imagens'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => void handleFiles(e)}
        />
      </header>

      {error && <p className="mesa-msg mesa-msg--error" role="alert">{error}</p>}

      {loading ? (
        <div className="mesa-gallery__state"><div className="spinner spinner--sm" /> Carregando galeria…</div>
      ) : images.length === 0 ? (
        <p className="mesa-gallery__empty">Nenhuma imagem ainda. JPG, PNG, WebP ou GIF de até 10 MB.</p>
      ) : (
        <ul className="mesa-gallery__grid anim-stagger">
          {images.map((image) => {
            const shown = shownId === image.id
            const busy = busyId === image.id
            return (
              <li key={image.id} className={`mesa-thumb${shown ? ' mesa-thumb--shown' : ''}`}>
                <button
                  type="button"
                  className="mesa-thumb__preview"
                  onClick={() => (shown ? mesa.hideImage() : void handleShow(image))}
                  disabled={busy}
                  aria-label={shown ? `Tirar ${image.name} da mesa` : `Mostrar ${image.name} para a mesa`}
                >
                  {image.url
                    ? <img src={image.url} alt="" loading="lazy" draggable={false} />
                    : <span className="mesa-thumb__missing">sem prévia</span>}
                  {shown && <span className="mesa-thumb__tag">Na mesa</span>}
                  <span className="mesa-thumb__hover">{busy ? 'Abrindo…' : shown ? 'Tirar da mesa' : 'Mostrar'}</span>
                </button>
                <div className="mesa-thumb__foot">
                  <span className="mesa-thumb__name" title={image.name}>{image.name}</span>
                  {confirmId === image.id ? (
                    <span className="mesa-thumb__confirm">
                      <button type="button" className="mesa-thumb__link mesa-thumb__link--danger" onClick={() => void handleDelete(image)} disabled={busy}>
                        Excluir
                      </button>
                      <button type="button" className="mesa-thumb__link" onClick={() => setConfirmId(null)} disabled={busy}>
                        Não
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="mesa-thumb__link" onClick={() => setConfirmId(image.id)} aria-label={`Excluir ${image.name}`}>
                      ✕
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
