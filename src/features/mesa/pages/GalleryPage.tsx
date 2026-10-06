import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  copyMesaImageToCampaign,
  deleteMesaImage,
  getMesaImageViewUrl,
  listAllMyMesaImages,
  MESA_IMAGE_TYPES,
  uploadMesaImage,
  validateMesaImage,
  type GalleryImageWithCampaign,
} from '../services/mesaImagesService'
import { getMyCampaigns } from '../../campaigns/services/campaignService'
import { getSystemLabel } from '../../../shared/constants/systems'
import type { CampaignWithRole } from '../../../shared/types'
import '../../../shared/theme/toolPage.css'
import './GalleryPage.css'

// ────────────────────────────────────────────────────────
// Galeria — um mural com um card por campanha (pilha de polaroides que se
// abre em leque). Clicar abre o álbum de lembranças da campanha: fotos
// em polaroide presas com fita, agrupadas por dia, com legenda à mão.
// Clicar numa foto abre ela grande. Todos da campanha veem; guardar,
// excluir e levar pra outra campanha é com o mestre. As imagens continuam
// privadas da campanha (links temporários).
// ────────────────────────────────────────────────────────

type Image = GalleryImageWithCampaign

/** Inclinação fixa por foto (a mesma a cada visita), de -4° a 4°. */
function tiltOf(id: string, range = 4): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ((Math.abs(h) % 1000) / 1000) * range * 2 - range
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
}

/** Troca de tela com a transição nativa do navegador, quando existe. */
function withTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(update))
  else update()
}

export function GalleryPage() {
  const [images, setImages]       = useState<Image[]>([])
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [openId, setOpenId]       = useState<string | null>(null)

  const load = useCallback(async () => {
    const [list, camps] = await Promise.all([listAllMyMesaImages(), getMyCampaigns()])
    setImages(list)
    setCampaigns(camps)
  }, [])

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a galeria.'))
      .finally(() => setLoading(false))
  }, [load])

  const byCampaign = useMemo(() => {
    const map = new Map<string, Image[]>()
    for (const img of images) {
      const list = map.get(img.campaign_id) ?? []
      list.push(img)
      map.set(img.campaign_id, list)
    }
    return map
  }, [images])

  // Campanhas com mais lembranças (e mais recentes) primeiro.
  const ordered = useMemo(() => [...campaigns].sort((a, b) => {
    const la = byCampaign.get(a.id) ?? []
    const lb = byCampaign.get(b.id) ?? []
    if (!!lb.length !== !!la.length) return lb.length ? 1 : -1
    return (lb[0]?.created_at ?? b.created_at).localeCompare(la[0]?.created_at ?? a.created_at)
  }), [campaigns, byCampaign])

  const open = campaigns.find((c) => c.id === openId) ?? null

  return (
    <div className="tool-page gallery-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Galeria</h1>
          <p className="tool-page__sub">As lembranças das suas campanhas: tudo o que já passou pela Mesa e pelo Quadro.</p>
        </div>
      </div>

      {loading ? (
        <div className="tool-page__state"><div className="spinner spinner--sm" /> Abrindo os álbuns…</div>
      ) : error ? (
        <p className="tool-page__error" role="alert">{error}</p>
      ) : campaigns.length === 0 ? (
        <div className="tool-page__empty">
          <p className="tool-page__empty-icon">▣</p>
          <p className="tool-page__empty-title">Nenhum álbum ainda.</p>
          <p className="tool-page__empty-text">
            Quando você entrar numa campanha, as imagens da Mesa e as fotos do Quadro viram lembranças aqui.
            {' '}<Link to="/campanhas/nova">Criar uma campanha</Link>
          </p>
        </div>
      ) : (
        <div className="gallery-wall">
          {ordered.map((c, i) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              images={byCampaign.get(c.id) ?? []}
              index={i}
              hidden={openId === c.id}
              onOpen={() => withTransition(() => setOpenId(c.id))}
            />
          ))}
        </div>
      )}

      {open && (
        <Album
          campaign={open}
          images={byCampaign.get(open.id) ?? []}
          otherCampaigns={campaigns.filter((c) => c.id !== open.id && c.role === 'master')}
          onClose={() => withTransition(() => setOpenId(null))}
          onChanged={load}
        />
      )}
    </div>
  )
}

// ── Card da campanha (pilha de polaroides) ──────────────

interface CampaignCardProps {
  campaign: CampaignWithRole
  images:   Image[]
  index:    number
  hidden:   boolean
  onOpen:   () => void
}

function CampaignCard({ campaign, images, index, hidden, onOpen }: CampaignCardProps) {
  // As 3 lembranças mais novas; sem nenhuma, a capa da campanha.
  const photos = images.slice(0, 3).map((i) => i.url).filter((u): u is string => !!u)
  const stack = photos.length > 0 ? photos : campaign.cover_url ? [campaign.cover_url] : []
  const since = images.length ? monthYear(images[images.length - 1].created_at) : null

  return (
    <button
      type="button"
      className="album-card"
      onClick={onOpen}
      style={{ '--i': index, '--sway-delay': `${-(index * 1.3) % 6}s` } as CSSProperties}
      aria-label={`Abrir o álbum de ${campaign.name}`}
    >
      <span
        className="album-card__stack"
        style={{ viewTransitionName: hidden ? undefined : `album-${campaign.id}` } as CSSProperties}
      >
        {stack.length === 0 ? (
          <span className="album-card__polaroid album-card__polaroid--empty">
            <span className="album-card__glyph" aria-hidden="true">❦</span>
          </span>
        ) : (
          stack.map((src, n) => (
            <span key={src} className={`album-card__polaroid album-card__polaroid--${n}`}>
              <img src={src} alt="" loading="lazy" />
            </span>
          ))
        )}
      </span>
      <span className="album-card__info">
        <span className="album-card__name">{campaign.name}</span>
        <span className="album-card__meta">
          {images.length === 0
            ? 'Nenhuma lembrança ainda'
            : `${images.length} ${images.length === 1 ? 'lembrança' : 'lembranças'} · desde ${since}`}
        </span>
        <span className="album-card__system">{getSystemLabel(campaign.system)}</span>
      </span>
    </button>
  )
}

// ── Álbum de lembranças ─────────────────────────────────

interface AlbumProps {
  campaign:       CampaignWithRole
  images:         Image[]
  otherCampaigns: CampaignWithRole[]
  onClose:        () => void
  onChanged:      () => Promise<void>
}

function Album({ campaign, images, otherCampaigns, onClose, onChanged }: AlbumProps) {
  // Todos veem; guardar, excluir e copiar é com o mestre.
  const isMaster = campaign.role === 'master'
  const [viewing, setViewing] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mais antigas primeiro: o álbum conta a história da campanha.
  const chronological = useMemo(() => [...images].reverse(), [images])
  const days = useMemo(() => {
    const groups: { day: string; items: { img: Image; index: number }[] }[] = []
    chronological.forEach((img, index) => {
      const day = dayKey(img.created_at)
      const last = groups[groups.length - 1]
      if (last && last.day === day) last.items.push({ img, index })
      else groups.push({ day, items: [{ img, index }] })
    })
    return groups
  }, [chronological])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && viewing == null) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, viewing])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice((cur) => (cur === message ? null : cur)), 3500)
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return
    const problem = files.map(validateMesaImage).find(Boolean)
    if (problem) { flash(problem); return }
    setUploading(true)
    try {
      for (const f of files) await uploadMesaImage(campaign.id, f)
      await onChanged()
      flash(files.length === 1 ? 'Lembrança guardada.' : `${files.length} lembranças guardadas.`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Não foi possível guardar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  const backdrop = campaign.cover_url ?? chronological[chronological.length - 1]?.url ?? null

  return createPortal(
    <div className="album" role="dialog" aria-modal="true" aria-label={`Álbum de ${campaign.name}`}>
      <div className="album__backdrop" aria-hidden="true">
        {backdrop && <img src={backdrop} alt="" />}
      </div>
      <div className="album__grain" aria-hidden="true" />

      <div className="album__scroll">
        <header className="album__header">
          <button type="button" className="album__close" onClick={onClose} aria-label="Fechar álbum">×</button>
          <span
            className="album__cover"
            style={{ viewTransitionName: `album-${campaign.id}` } as CSSProperties}
            aria-hidden="true"
          >
            {backdrop ? <img src={backdrop} alt="" /> : <span className="album-card__glyph">❦</span>}
          </span>
          <p className="album__kicker">lembranças de mesa</p>
          <h2 className="album__title">{campaign.name}</h2>
          <p className="album__count">
            {images.length === 0
              ? 'Ainda não há lembranças por aqui.'
              : `${images.length} ${images.length === 1 ? 'lembrança' : 'lembranças'} desde ${dayKey(chronological[0].created_at)}`}
          </p>
          {isMaster && (
            <>
              <button type="button" className="album__add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Guardando…' : '+ Adicionar lembranças'}
              </button>
              <input
                ref={fileRef} type="file" hidden multiple accept={MESA_IMAGE_TYPES.join(',')}
                onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void handleFiles(files) }}
              />
            </>
          )}
          {notice && <p className="album__notice" role="status">{notice}</p>}
        </header>

        {images.length === 0 ? (
          <p className="album__empty">
            {isMaster
              ? 'Mostre mapas, retratos e cenas na aba Mesa da campanha (ou adicione aqui) e eles ficam guardados neste álbum.'
              : 'Quando o mestre mostrar imagens na Mesa, ou alguém puser fotos no Quadro, elas aparecem aqui.'}
          </p>
        ) : (
          days.map((group) => (
            <section key={group.day} className="album__day">
              <h3 className="album__day-title"><span>{group.day}</span></h3>
              <div className="album__photos">
                {group.items.map(({ img, index }, n) => (
                  <button
                    key={img.id}
                    type="button"
                    className="polaroid"
                    style={{ '--tilt': `${tiltOf(img.id)}deg`, '--tape': `${tiltOf(img.id + 't', 8)}deg`, '--n': n } as CSSProperties}
                    onClick={() => setViewing(index)}
                    aria-label={`Ver ${img.name}`}
                  >
                    <span className="polaroid__tape" aria-hidden="true" />
                    <span className="polaroid__photo">
                      {img.url ? <img src={img.url} alt="" loading="lazy" /> : <span className="polaroid__missing">sem prévia</span>}
                    </span>
                    <span className="polaroid__caption">{img.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}

        <p className="album__footer">❦</p>
      </div>

      {viewing != null && chronological[viewing] && (
        <Lightbox
          images={chronological}
          index={viewing}
          otherCampaigns={otherCampaigns}
          canEdit={isMaster}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onChanged={onChanged}
          onNotice={flash}
        />
      )}
    </div>,
    document.body,
  )
}

// ── Foto grande ─────────────────────────────────────────

interface LightboxProps {
  images:         Image[]
  index:          number
  otherCampaigns: CampaignWithRole[]
  /** Mestre da campanha: pode excluir e levar pra outra campanha. */
  canEdit:        boolean
  onIndex:        (i: number) => void
  onClose:        () => void
  onChanged:      () => Promise<void>
  onNotice:       (message: string) => void
}

function Lightbox({ images, index, otherCampaigns, canEdit, onIndex, onClose, onChanged, onNotice }: LightboxProps) {
  const img = images[index]
  const [copyOpen, setCopyOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const prev = index > 0 ? () => onIndex(index - 1) : null
  const next = index < images.length - 1 ? () => onIndex(index + 1) : null

  useEffect(() => { setCopyOpen(false); setConfirmDelete(false) }, [index])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prev) prev()
      else if (e.key === 'ArrowRight' && next) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  async function openOriginal() {
    const tab = window.open('', '_blank')
    try {
      const url = await getMesaImageViewUrl(img.path)
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
    } catch (err) {
      tab?.close()
      onNotice(err instanceof Error ? err.message : 'Não foi possível abrir a imagem.')
    }
  }

  async function copyTo(campaign: CampaignWithRole) {
    setBusy(true)
    try {
      await copyMesaImageToCampaign(img, campaign.id)
      await onChanged()
      setCopyOpen(false)
      onNotice(`Copiada pro álbum de ${campaign.name}.`)
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Não foi possível copiar a imagem.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteMesaImage(img)
      onClose()
      await onChanged()
      onNotice('Lembrança excluída.')
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Não foi possível excluir.')
      setBusy(false)
    }
  }

  return (
    <div className="lightbox" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Fechar">×</button>
      {prev && <button type="button" className="lightbox__nav lightbox__nav--prev" onClick={prev} aria-label="Anterior">‹</button>}
      {next && <button type="button" className="lightbox__nav lightbox__nav--next" onClick={next} aria-label="Próxima">›</button>}

      <figure key={img.id} className="lightbox__figure">
        {img.url ? <img src={img.url} alt={img.name} /> : <span className="polaroid__missing">sem prévia</span>}
        <figcaption className="lightbox__caption">
          <span className="lightbox__name">{img.name}</span>
          <span className="lightbox__date">{dayKey(img.created_at)} · {index + 1} de {images.length}</span>
        </figcaption>
      </figure>

      <div className="lightbox__actions">
        <button type="button" className="lightbox__btn" onClick={() => void openOriginal()}>Abrir original</button>
        {canEdit && otherCampaigns.length > 0 && (
          <button type="button" className="lightbox__btn" onClick={() => setCopyOpen((v) => !v)} aria-expanded={copyOpen}>
            Levar pra outra campanha
          </button>
        )}
        {!canEdit ? null : confirmDelete ? (
          <>
            <span className="lightbox__ask">Excluir esta lembrança?</span>
            <button type="button" className="lightbox__btn lightbox__btn--danger" onClick={() => void remove()} disabled={busy}>
              {busy ? 'Excluindo…' : 'Excluir'}
            </button>
            <button type="button" className="lightbox__btn" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</button>
          </>
        ) : (
          <button type="button" className="lightbox__btn lightbox__btn--danger" onClick={() => setConfirmDelete(true)}>Excluir</button>
        )}
      </div>

      {copyOpen && (
        <div className="lightbox__copy" role="group" aria-label="Levar pra qual campanha">
          {otherCampaigns.map((c) => (
            <button key={c.id} type="button" className="lightbox__chip" onClick={() => void copyTo(c)} disabled={busy}>
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
