import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import { Select } from '../../../shared/components/Select'
import type { CampaignWithRole } from '../../../shared/types'
import '../../../shared/theme/toolPage.css'
import './GalleryPage.css'

// ────────────────────────────────────────────────────────
// Galeria — as imagens da Mesa de todas as campanhas em que a pessoa é
// mestre, num lugar só: filtrar por campanha, abrir em tamanho real,
// copiar pra outra campanha, enviar nova ou excluir. As imagens continuam
// privadas: só o mestre da campanha vê.
// ────────────────────────────────────────────────────────

export function GalleryPage() {
  const [images, setImages]       = useState<GalleryImageWithCampaign[]>([])
  const [campaigns, setCampaigns] = useState<CampaignWithRole[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [notice, setNotice]       = useState<string | null>(null)
  const [filter, setFilter]       = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploadTarget, setUploadTarget] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const [list, camps] = await Promise.all([listAllMyMesaImages(), getMyCampaigns()])
    setImages(list)
    setCampaigns(camps.filter((c) => c.role === 'master'))
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar a galeria.'))
      .finally(() => setLoading(false))
  }, [])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice((cur) => (cur === message ? null : cur)), 3500)
  }

  const visible = useMemo(() => (filter ? images.filter((i) => i.campaign_id === filter) : images), [images, filter])
  const selected = images.find((i) => i.id === selectedId) ?? null
  const campaignOptions = campaigns.map((c) => ({ value: c.id, label: c.name }))

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    const target = uploadTarget || filter
    if (!target || files.length === 0) return
    const problem = files.map(validateMesaImage).find(Boolean)
    if (problem) { flash(problem); return }
    setUploading(true)
    try {
      for (const file of files) await uploadMesaImage(target, file)
      await load()
      flash(files.length === 1 ? 'Imagem enviada.' : `${files.length} imagens enviadas.`)
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="tool-page gallery-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Galeria</h1>
          <p className="tool-page__sub">As imagens e mapas da Mesa de todas as campanhas em que você é mestre.</p>
        </div>
      </div>

      {notice && <p className="tool-page__notice" role="status">{notice}</p>}

      {loading ? (
        <div className="tool-page__state"><div className="spinner spinner--sm" /> Carregando imagens…</div>
      ) : error ? (
        <p className="tool-page__error" role="alert">{error}</p>
      ) : campaigns.length === 0 ? (
        <div className="tool-page__empty">
          <p className="tool-page__empty-icon">▣</p>
          <p className="tool-page__empty-title">A galeria é do mestre.</p>
          <p className="tool-page__empty-text">Quando você for mestre de uma campanha, as imagens que mostrar na Mesa aparecem aqui.</p>
        </div>
      ) : (
        <>
          <div className="gallery-toolbar">
            <Select
              className="gallery-toolbar__filter" value={filter} onChange={setFilter} aria-label="Filtrar por campanha"
              options={[{ value: '', label: `Todas as campanhas (${images.length})` }, ...campaigns.map((c) => ({
                value: c.id, label: `${c.name} (${images.filter((i) => i.campaign_id === c.id).length})`,
              }))]}
            />
            <div className="gallery-toolbar__upload">
              {!filter && (
                <Select
                  value={uploadTarget} onChange={setUploadTarget} aria-label="Enviar pra campanha"
                  options={[{ value: '', label: 'Enviar pra…' }, ...campaignOptions]}
                />
              )}
              <button
                type="button" className="btn btn-primary btn-sm"
                disabled={uploading || !(uploadTarget || filter)}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? 'Enviando…' : '+ Enviar imagens'}
              </button>
              <input ref={fileRef} type="file" hidden multiple accept={MESA_IMAGE_TYPES.join(',')} onChange={(e) => void handleUpload(e)} />
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="tool-page__empty">
              <p className="tool-page__empty-icon">▣</p>
              <p className="tool-page__empty-title">Nenhuma imagem {filter ? 'nessa campanha' : 'ainda'}.</p>
              <p className="tool-page__empty-text">Envie por aqui ou pela seção "Imagens da mesa" na aba Mesa da campanha.</p>
            </div>
          ) : (
            <div className="gallery-grid anim-stagger">
              {visible.map((img) => (
                <button
                  key={img.id} type="button"
                  className={`gallery-thumb${selectedId === img.id ? ' gallery-thumb--selected' : ''}`}
                  onClick={() => setSelectedId((cur) => (cur === img.id ? null : img.id))}
                  aria-pressed={selectedId === img.id}
                >
                  {img.url ? <img src={img.url} alt="" loading="lazy" /> : <span className="gallery-thumb__missing">sem prévia</span>}
                  <span className="gallery-thumb__caption">
                    <span className="gallery-thumb__name">{img.name}</span>
                    {!filter && <span className="gallery-thumb__campaign">{img.campaign_name}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <ImageActions
              key={selected.id}
              image={selected}
              campaigns={campaigns.filter((c) => c.id !== selected.campaign_id)}
              onClose={() => setSelectedId(null)}
              onCopied={(name) => { void load(); flash(`Imagem copiada pra ${name}.`) }}
              onDeleted={() => { setImages((list) => list.filter((i) => i.id !== selected.id)); setSelectedId(null); flash('Imagem excluída.') }}
              onError={flash}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Ações da imagem escolhida ───────────────────────────

interface ImageActionsProps {
  image:     GalleryImageWithCampaign
  campaigns: CampaignWithRole[]
  onClose:   () => void
  onCopied:  (campaignName: string) => void
  onDeleted: () => void
  onError:   (message: string) => void
}

function ImageActions({ image, campaigns, onClose, onCopied, onDeleted, onError }: ImageActionsProps) {
  const [target, setTarget] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function open() {
    // A aba abre antes do await pra o navegador não bloquear como pop-up.
    const tab = window.open('', '_blank')
    try {
      const url = await getMesaImageViewUrl(image.path)
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
    } catch (err) {
      tab?.close()
      onError(err instanceof Error ? err.message : 'Não foi possível abrir a imagem.')
    }
  }

  async function copy() {
    const campaign = campaigns.find((c) => c.id === target)
    if (!campaign) return
    setBusy(true)
    try {
      await copyMesaImageToCampaign(image, campaign.id)
      setTarget('')
      onCopied(campaign.name)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível copiar a imagem.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await deleteMesaImage(image)
      onDeleted()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Não foi possível excluir a imagem.')
      setBusy(false)
    }
  }

  return (
    <section className="tool-card gallery-actions" aria-label={`Imagem ${image.name}`}>
      <div className="gallery-actions__head">
        <div>
          <h2 className="tool-card__title">{image.name}</h2>
          <span className="tool-card__meta">
            {image.campaign_name} · enviada em {new Date(image.created_at).toLocaleDateString('pt-BR')}
          </span>
        </div>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
      </div>

      <div className="gallery-actions__row">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void open()}>Abrir em tamanho real</button>
      </div>

      <div className="gallery-actions__row">
        {campaigns.length === 0 ? (
          <p className="tool-hint">Você não é mestre de outra campanha pra copiar essa imagem.</p>
        ) : (
          <>
            <Select
              value={target} onChange={setTarget} aria-label="Copiar pra campanha"
              options={[{ value: '', label: 'Copiar pra outra campanha…' }, ...campaigns.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void copy()} disabled={!target || busy}>
              {busy && target ? 'Copiando…' : 'Copiar'}
            </button>
          </>
        )}
      </div>

      <div className="gallery-actions__row">
        {confirmDelete ? (
          <>
            <span className="tool-hint">Excluir da galeria de {image.campaign_name}? Não dá pra desfazer.</span>
            <button type="button" className="btn btn-ghost btn-sm gallery-actions__danger" onClick={() => void remove()} disabled={busy}>
              {busy ? 'Excluindo…' : 'Excluir'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancelar</button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm gallery-actions__danger" onClick={() => setConfirmDelete(true)}>Excluir</button>
        )}
      </div>
    </section>
  )
}
