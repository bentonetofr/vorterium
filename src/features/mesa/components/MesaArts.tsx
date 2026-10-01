import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { addGalleryImageToBoard, imageSize } from '../../board/services/boardService'
import { useAuth } from '../../auth/AuthProvider'
import { useMesaStream } from '../MesaStreamProvider'
import {
  deleteMesaImage,
  listMesaArts,
  subscribeMesaArts,
  uploadMesaArt,
  type MesaArt,
} from '../services/mesaImagesService'

// ────────────────────────────────────────────────────────
// Artes e referências (aba Mesa): mestre e jogadores enviam imagens pra
// mostrar como referência — um retrato do personagem, um mapa, uma arte
// que inspirou a cena. Todos veem. Nada entra na transmissão sozinho: só o
// mestre põe uma imagem na mesa (clicando nela), inclusive as que os
// jogadores enviaram. Cada um exclui o que enviou; o mestre, qualquer uma.
// Todos podem pôr uma arte no Quadro da campanha (e elas aparecem na Galeria).
// ────────────────────────────────────────────────────────

export function MesaArts({ campaignId }: { campaignId: string }) {
  const mesa = useMesaStream()
  const { user } = useAuth()
  const isMaster = mesa.isMaster
  const [arts, setArts]           = useState<MesaArt[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [uploading, setUploading] = useState(0)
  const [busyId, setBusyId]       = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [viewing, setViewing]     = useState<MesaArt | null>(null)
  /** Aviso de que a arte foi pro Quadro (com o link pra ir até lá). */
  const [placed, setPlaced]       = useState<string | null>(null)
  /** Chegaram agora (de outra pessoa): ganham um destaque. */
  const [fresh, setFresh]         = useState<Set<string>>(new Set())
  const known = useRef<Set<string> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shownId = mesa.stage.image?.id ?? null

  const load = useCallback(async () => {
    const list = await listMesaArts(campaignId)
    if (known.current) {
      const added = list.filter((a) => !known.current!.has(a.id) && a.uploaded_by !== user?.id).map((a) => a.id)
      if (added.length) setFresh((prev) => new Set([...prev, ...added]))
    }
    known.current = new Set(list.map((a) => a.id))
    setArts(list)
  }, [campaignId, user?.id])

  useEffect(() => {
    let active = true
    load()
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Não foi possível carregar as artes e referências.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  // Quem enviou de outro aparelho aparece na hora (o mestre vê o que o jogador mandou).
  useEffect(() => subscribeMesaArts(campaignId, () => { void load().catch(() => {}) }), [campaignId, load])

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError(null)
    setUploading(files.length)
    for (const file of files) {
      try {
        const art = await uploadMesaArt(campaignId, file)
        known.current?.add(art.id)
        setArts((list) => (list.some((a) => a.id === art.id) ? list : [art, ...list]))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function handleShow(art: MesaArt) {
    setError(null)
    setBusyId(art.id)
    try {
      await mesa.showImage({ id: art.id, path: art.path, name: art.name })
      setFresh((prev) => { const next = new Set(prev); next.delete(art.id); return next })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mostrar a imagem.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(art: MesaArt) {
    setError(null)
    setBusyId(art.id)
    try {
      if (shownId === art.id) mesa.hideImage()
      await deleteMesaImage(art)
      setArts((list) => list.filter((a) => a.id !== art.id))
      setConfirmId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a imagem.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleToBoard(art: MesaArt) {
    setError(null)
    setBusyId(art.id)
    try {
      await addGalleryImageToBoard(campaignId, art, await imageSize(art.url))
      setPlaced(art.name)
      window.setTimeout(() => setPlaced((cur) => (cur === art.name ? null : cur)), 6000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível pôr a imagem no Quadro.')
    } finally {
      setBusyId(null)
    }
  }

  const canDelete = (art: MesaArt) => isMaster || (!!user && art.uploaded_by === user.id)

  return (
    <section className="mesa-gallery" aria-labelledby="mesa-arts-title">
      <header className="mesa-gallery__head">
        <div>
          <h5 id="mesa-arts-title" className="mesa-gallery__title">Artes e referências</h5>
          <p className="mesa-gallery__sub">
            {isMaster
              ? 'Imagens que você e os jogadores enviam pra mostrar como referência. Nada vai pra transmissão sozinho: clique numa imagem pra pôr na mesa.'
              : 'Mande retratos, mapas e artes pra mostrar como referência. Todos da campanha veem; o mestre escolhe o que vai pra transmissão.'}
          </p>
        </div>
        <button type="button" className="btn btn-ghost mesa-gallery__add" onClick={() => inputRef.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? `Enviando${uploading > 1 ? ` (${uploading})` : ''}…` : '+ Enviar imagens'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void handleFiles(e)}
        />
      </header>

      {error && <p className="mesa-msg mesa-msg--error" role="alert">{error}</p>}
      {placed && (
        <p className="mesa-msg" role="status">
          “{placed}” foi pro Quadro (à direita do que já tem lá). <Link to={`/campanhas/${campaignId}/quadro`}>Ir pro Quadro</Link>
        </p>
      )}

      {loading ? (
        <div className="mesa-gallery__state"><div className="spinner spinner--sm" /> Carregando…</div>
      ) : arts.length === 0 ? (
        <p className="mesa-gallery__empty">Nenhuma arte ou referência ainda. Envie imagens (JPG, PNG, WebP, GIF…); as grandes são reduzidas sozinhas.</p>
      ) : (
        <ul className="mesa-gallery__grid anim-stagger">
          {arts.map((art) => {
            const shown = shownId === art.id
            const busy = busyId === art.id
            const mine = !!user && art.uploaded_by === user.id
            return (
              <li key={art.id} className={`mesa-thumb${shown ? ' mesa-thumb--shown' : ''}${fresh.has(art.id) ? ' mesa-thumb--fresh' : ''}`}>
                <button
                  type="button"
                  className="mesa-thumb__preview"
                  // Mestre: clicar põe/tira da mesa. Jogador: abre grande.
                  onClick={() => (isMaster ? (shown ? mesa.hideImage() : void handleShow(art)) : setViewing(art))}
                  disabled={busy}
                  aria-label={isMaster ? (shown ? `Tirar ${art.name} da mesa` : `Mostrar ${art.name} para a mesa`) : `Ver ${art.name}`}
                >
                  {art.url
                    ? <img src={art.url} alt="" loading="lazy" draggable={false} />
                    : <span className="mesa-thumb__missing">sem prévia</span>}
                  {shown && <span className="mesa-thumb__tag">Na mesa</span>}
                  {!shown && fresh.has(art.id) && <span className="mesa-thumb__tag mesa-thumb__tag--new">Nova</span>}
                  <span className="mesa-thumb__hover">
                    {busy ? 'Abrindo…' : isMaster ? (shown ? 'Tirar da mesa' : 'Pôr na mesa') : 'Ver'}
                  </span>
                </button>
                <div className="mesa-thumb__foot">
                  <span className="mesa-thumb__name" title={art.name}>
                    {art.name}
                    <span className="mesa-thumb__by">{mine ? 'por você' : art.uploader_name ? `por ${art.uploader_name}` : 'do mestre'}</span>
                  </span>
                  <button type="button" className="mesa-thumb__link" onClick={() => void handleToBoard(art)} disabled={busy} aria-label={`Pôr ${art.name} no Quadro`} title="Pôr no Quadro">▦</button>
                  {isMaster && (
                    <button type="button" className="mesa-thumb__link" onClick={() => setViewing(art)} aria-label={`Ver ${art.name} grande`} title="Ver grande">⤢</button>
                  )}
                  {canDelete(art) && (confirmId === art.id ? (
                    <span className="mesa-thumb__confirm">
                      <button type="button" className="mesa-thumb__link mesa-thumb__link--danger" onClick={() => void handleDelete(art)} disabled={busy}>
                        Excluir
                      </button>
                      <button type="button" className="mesa-thumb__link" onClick={() => setConfirmId(null)} disabled={busy}>
                        Não
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="mesa-thumb__link" onClick={() => setConfirmId(art.id)} aria-label={`Excluir ${art.name}`}>
                      ✕
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {viewing && <ArtViewer art={viewing} onClose={() => setViewing(null)} />}
    </section>
  )
}

/** A imagem grande, por cima de tudo (Esc ou clique fora fecha). */
function ArtViewer({ art, onClose }: { art: MesaArt; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="mesa-art-view" role="dialog" aria-modal="true" aria-label={art.name} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <button type="button" className="mesa-art-view__close" onClick={onClose} aria-label="Fechar">×</button>
      <figure className="mesa-art-view__figure">
        {art.url ? <img src={art.url} alt={art.name} /> : <span className="mesa-thumb__missing">sem prévia</span>}
        <figcaption>{art.name}{art.uploader_name ? ` · por ${art.uploader_name}` : ''}</figcaption>
      </figure>
    </div>,
    document.body,
  )
}
