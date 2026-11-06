import { useEffect, useRef } from 'react'
import type { MesaScene } from '../../mesa/mesaSession'

type Talk = Extract<MesaScene, { kind: 'talk' }>

/** A parte do desenho que vira o retrato (cabeça e peito) dentro do quadro de 256×256 do boneco. */
const CROP = { x: 36, y: 38, w: 184, h: 156 }

/**
 * Câmera de conversa, vista de quem joga: os dois personagens lado a lado, de frente, na altura do rosto, com o
 * cenário vivo (desfocado pelo CSS) atrás. Quem fala fica em destaque; o outro escurece de leve. Sem texto.
 */
export function TalkScene({ scene, portrait }: { scene: Talk; portrait: (id: string) => HTMLCanvasElement | null }) {
  return (
    <div className="talk" aria-hidden="true">
      <i className="talk__vignette" />
      <Bust id={scene.left} side="left" speaking={scene.speaker === 'left'} portrait={portrait} />
      {scene.right && <Bust id={scene.right} side="right" speaking={scene.speaker === 'right'} portrait={portrait} />}
    </div>
  )
}

function Bust({ id, side, speaking, portrait }: { id: string; side: 'left' | 'right'; speaking: boolean; portrait: (id: string) => HTMLCanvasElement | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  // o motor monta o retrato quando o boneco está à vista: tenta de novo até aparecer
  useEffect(() => {
    let dead = false
    let tries = 0
    const draw = () => {
      const el = canvas.current
      const src = portrait(id)
      if (!el || !src) return false
      const ctx = el.getContext('2d')!
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(src, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, el.width, el.height)
      el.dataset.ready = '1'
      return true
    }
    if (canvas.current) delete canvas.current.dataset.ready
    if (draw()) return
    const timer = window.setInterval(() => { if (dead || draw() || ++tries > 40) window.clearInterval(timer) }, 400)
    return () => { dead = true; window.clearInterval(timer) }
  }, [id, portrait])

  return (
    <div className={`talk__bust talk__bust--${side} ${speaking ? 'talk__bust--on' : 'talk__bust--off'}`}>
      <canvas ref={canvas} className="talk__canvas" width={CROP.w * 2} height={CROP.h * 2} />
    </div>
  )
}
