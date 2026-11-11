// ────────────────────────────────────────────────────────
// Prévia da câmera de conversa, vista de quem joga (só no `npm run dev`): /testes/conversa.html
// Um cenário qualquer atrás (que o CSS desfoca) e, por cima, os dois personagens lado a lado. Os retratos aqui são
// o quadro de frente do boneco ampliado na marra (no jogo, o motor entrega o desenho suavizado de 256×256).
// ────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/theme/motion.css'
import '../src/shared/theme/refine.css'
import '../src/features/vortable/components/SceneBar.css'
import '../src/features/vortable/components/VortableMesa.css'
import { SceneOverlay } from '../src/features/vortable/components/SceneOverlay'
import { loadEngine, VORTABLE_ASSETS } from '../src/features/vortable/services/vortableService'
import type { MesaScene } from '../src/features/mesa/mesaSession'

function Preview() {
  const [scene, setScene] = useState<MesaScene>({ kind: 'talk', left: 'a', right: 'b', speaker: 'left' })
  const sprites = useRef<Record<string, HTMLCanvasElement>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      const engine = await loadEngine()
      const data = await engine.loadCharacterData(VORTABLE_ASSETS)
      const a = engine.normalizeAppearance(data, engine.defaultAppearance())
      const b = engine.randomAppearance(data)
      for (const [id, ap] of [['a', a], ['b', b]] as const) {
        const frame = await engine.characterFrame(VORTABLE_ASSETS, ap)
        const big = document.createElement('canvas')
        big.width = big.height = 256
        const ctx = big.getContext('2d')!
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(frame, 0, 0, 256, 256)
        sprites.current[id] = big
      }
      setReady(true)
    })()
  }, [])

  const portrait = useCallback((id: string) => sprites.current[id] ?? null, [ready])
  const talking = scene.kind === 'talk'
  return (
    <div className={`vortable-player-wrap${talking ? ' vt-talking' : ''}`} style={{ position: 'relative', height: '82vh', borderRadius: 12, overflow: 'hidden' }}>
      <div className="vortable-stage"><div className="vortable-stage__host" style={{ background: 'linear-gradient(180deg, #6fb4e8, #cfe6f5 45%, #5c8f4a 46%, #3d6e36)' }} /></div>
      {ready && <SceneOverlay scene={scene} portrait={portrait} />}
      <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 20, display: 'flex', gap: 8 }}>
        <button className="btn btn-ghost" onClick={() => setScene({ kind: 'talk', left: 'a', right: 'b', speaker: 'left' })}>Fala o da esquerda</button>
        <button className="btn btn-ghost" onClick={() => setScene({ kind: 'talk', left: 'a', right: 'b', speaker: 'right' })}>Fala o da direita</button>
        <button className="btn btn-primary" onClick={() => setScene({ kind: 'game' })}>Encerrar</button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<div style={{ padding: 16 }}><Preview /></div>)
