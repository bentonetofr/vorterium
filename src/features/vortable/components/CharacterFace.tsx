import { useEffect, useRef } from 'react'
import type { Appearance } from '../../../vendor/vortable/vortable'
import { loadEngine, VORTABLE_ASSETS } from '../services/vortableService'

/** Miniatura do boneco (de frente), montada com as camadas da aparência. */
export function CharacterFace({ appearance, size = 56 }: { appearance: Appearance; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let dead = false
    loadEngine()
      .then((engine) => engine.characterFrame(VORTABLE_ASSETS, appearance))
      .then((frame) => {
        const el = canvas.current
        if (dead || !el) return
        const ctx = el.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.clearRect(0, 0, el.width, el.height)
        ctx.drawImage(frame, 0, 0, el.width, el.height)
      })
      .catch(() => { /* sem miniatura: fica o quadro vazio */ })
    return () => { dead = true }
  }, [appearance])

  return <canvas ref={canvas} className="vortable-face" width={64} height={64} style={{ width: size, height: size }} aria-hidden="true" />
}
