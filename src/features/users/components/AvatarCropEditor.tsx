import { useEffect, useRef, useState } from 'react'
import './AvatarCropEditor.css'

const PREVIEW_SIZE = 240
const OUTPUT_SIZE = 512

interface AvatarCropEditorProps {
  file: File
  saving: boolean
  onCancel: () => void
  onSave: (file: File) => Promise<void>
  title?: string
  description?: string
  confirmLabel?: string
}

export function AvatarCropEditor({
  file, saving, onCancel, onSave,
  title = 'Ajustar avatar',
  description = 'Escolha o enquadramento que será exibido no seu perfil.',
  confirmLabel = 'Usar este avatar',
}: AvatarCropEditorProps) {
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
    resetCrop()
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
      PREVIEW_SIZE / image.naturalWidth,
      PREVIEW_SIZE / image.naturalHeight,
    ) * zoom
    const width = image.naturalWidth * scale
    const height = image.naturalHeight * scale

    context.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      (PREVIEW_SIZE - width) / 2 + offsetX,
      (PREVIEW_SIZE - height) / 2 + offsetY,
      width,
      height,
    )
  }, [image, zoom, offsetX, offsetY])

  function resetCrop() {
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
  }

  function exportCrop(): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!image) {
        reject(new Error('A imagem ainda está carregando.'))
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const context = canvas.getContext('2d')
      if (!context) {
        reject(new Error('Não foi possível preparar o recorte.'))
        return
      }

      const scale = Math.max(
        OUTPUT_SIZE / image.naturalWidth,
        OUTPUT_SIZE / image.naturalHeight,
      ) * zoom
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const factor = OUTPUT_SIZE / PREVIEW_SIZE

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        image,
        (OUTPUT_SIZE - width) / 2 + offsetX * factor,
        (OUTPUT_SIZE - height) / 2 + offsetY * factor,
        width,
        height,
      )

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar o avatar.'))
          return
        }
        resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.9)
    })
  }

  async function handleSave() {
    await onSave(await exportCrop())
  }

  return (
    <div className="avatar-crop-editor" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
      <div className="avatar-crop-editor__header">
        <div>
          <h3 id="avatar-crop-title">{title}</h3>
          <p>{description}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Fechar
        </button>
      </div>

      <div className="avatar-crop-editor__preview-wrap">
        {loading && <span className="spinner" />}
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className="avatar-crop-editor__canvas"
          aria-label="Prévia do avatar"
        />
        {imageError && <span className="avatar-crop-editor__preview-error">Não foi possível ler esta imagem.</span>}
      </div>

      <div className="avatar-crop-editor__controls">
        <label>
          <span>Zoom</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            disabled={loading || saving}
          />
        </label>
        <label>
          <span>Horizontal</span>
          <input
            type="range"
            min="-120"
            max="120"
            step="1"
            value={offsetX}
            onChange={(event) => setOffsetX(Number(event.target.value))}
            disabled={loading || saving}
          />
        </label>
        <label>
          <span>Vertical</span>
          <input
            type="range"
            min="-120"
            max="120"
            step="1"
            value={offsetY}
            onChange={(event) => setOffsetY(Number(event.target.value))}
            disabled={loading || saving}
          />
        </label>
      </div>

      <div className="avatar-crop-editor__actions">
        <button type="button" className="btn btn-ghost" onClick={resetCrop} disabled={loading || saving}>
          Resetar ajuste
        </button>
        <div>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()} disabled={!image || loading || saving}>
            {saving ? <><span className="spinner spinner--sm" /> Salvando...</> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
