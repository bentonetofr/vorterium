import { useEffect, useRef, useState } from 'react'
import './CampaignCoverCropEditor.css'
import { Loader } from '../../../shared/components/Loader'

const PREVIEW_WIDTH = 720
const PREVIEW_HEIGHT = 240
const OUTPUT_WIDTH = 1500
const OUTPUT_HEIGHT = 500

interface CampaignCoverCropEditorProps {
  file: File
  saving: boolean
  onCancel: () => void
  onSave: (file: File) => Promise<void>
}

export function CampaignCoverCropEditor({ file, saving, onCancel, onSave }: CampaignCoverCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const nextImage = new Image()
    setImage(null)
    setImageError(false)
    setLoading(true)
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)

    nextImage.onload = () => {
      setImage(nextImage)
      setLoading(false)
    }
    nextImage.onerror = () => {
      setImageError(true)
      setLoading(false)
    }
    nextImage.src = url

    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return

    const context = canvas.getContext('2d')
    if (!context) return

    const scale = Math.max(
      PREVIEW_WIDTH / image.naturalWidth,
      PREVIEW_HEIGHT / image.naturalHeight,
    ) * zoom
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale

    context.clearRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      (PREVIEW_WIDTH - width) / 2 + offsetX,
      (PREVIEW_HEIGHT - height) / 2 + offsetY,
      width,
      height,
    )
  }, [image, zoom, offsetX, offsetY])

  function exportCrop(): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!image) {
        reject(new Error('A imagem ainda está carregando.'))
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_WIDTH
      canvas.height = OUTPUT_HEIGHT
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Não foi possível preparar o recorte.'))
        return
      }

      const scale = Math.max(
        OUTPUT_WIDTH / image.naturalWidth,
        OUTPUT_HEIGHT / image.naturalHeight,
      ) * zoom
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const factor = OUTPUT_WIDTH / PREVIEW_WIDTH

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        image,
        (OUTPUT_WIDTH - width) / 2 + offsetX * factor,
        (OUTPUT_HEIGHT - height) / 2 + offsetY * factor,
        width,
        height,
      )

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a capa.'))
          return
        }
        resolve(new File([blob], 'campaign-cover.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.9)
    })
  }

  async function handleSave() {
    await onSave(await exportCrop())
  }

  return (
    <div className="campaign-cover-crop-editor" role="dialog" aria-modal="true" aria-labelledby="campaign-cover-crop-title">
      <div className="campaign-cover-crop-editor__header">
        <div>
          <h3 id="campaign-cover-crop-title">Ajustar capa</h3>
          <p>Escolha o enquadramento que será exibido no cabeçalho da campanha.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Fechar
        </button>
      </div>

      <div className="campaign-cover-crop-editor__preview-wrap">
        {loading && <Loader />}
        <canvas
          ref={canvasRef}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          className="campaign-cover-crop-editor__canvas"
          aria-label="Prévia da capa da campanha"
        />
        {imageError && <span className="campaign-cover-crop-editor__preview-error">Não foi possível ler esta imagem.</span>}
      </div>

      <div className="campaign-cover-crop-editor__controls">
        <label>
          <span>Zoom</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={loading || saving} />
        </label>
        <label>
          <span>Horizontal</span>
          <input type="range" min="-240" max="240" step="1" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} disabled={loading || saving} />
        </label>
        <label>
          <span>Vertical</span>
          <input type="range" min="-120" max="120" step="1" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} disabled={loading || saving} />
        </label>
      </div>

      <div className="campaign-cover-crop-editor__actions">
        <button type="button" className="btn btn-ghost" onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0) }} disabled={loading || saving}>
          Resetar ajuste
        </button>
        <div>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={!image || loading || saving}>
            {saving ? <><span className="spinner spinner--sm" /> Salvando...</> : 'Usar esta capa'}
          </button>
        </div>
      </div>
    </div>
  )
}
