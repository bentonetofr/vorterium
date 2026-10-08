import { useEffect, useState } from 'react'
import type { MesaScene } from '../../mesa/mesaSession'

/**
 * Cena do mestre por cima do jogo (jogador): preto, pausa, imagem ou título,
 * com fade. O jogo continua por baixo; com a cena no ar, o teclado do boneco
 * fica travado (PlayerStage).
 */
export function SceneOverlay({ scene }: { scene: MesaScene }) {
  const active = scene.kind !== 'game'
  // guarda a última cena aberta pra ela sumir com fade em vez de cortar
  const [shown, setShown] = useState<MesaScene | null>(active ? scene : null)

  useEffect(() => {
    if (active) { setShown(scene); return }
    const timer = window.setTimeout(() => setShown(null), 600)
    return () => window.clearTimeout(timer)
  }, [active, scene])

  if (!shown) return null

  return (
    <div className={`scene-overlay${active ? '' : ' scene-overlay--off'}`} role="presentation">
      {shown.kind === 'pause' && (
        <div className="scene-card">
          <span className="scene-card__sigil" aria-hidden="true">ᛉ</span>
          <p className="scene-card__title">Mestre ajustando a cena…</p>
        </div>
      )}
      {shown.kind === 'title' && (
        <div className="scene-card">
          <p className="scene-card__title scene-card__title--big">{shown.title}</p>
          {shown.subtitle && <p className="scene-card__sub">{shown.subtitle}</p>}
        </div>
      )}
      {shown.kind === 'image' && (
        <figure className="scene-figure">
          <img src={shown.url} alt={shown.name} draggable={false} />
        </figure>
      )}
    </div>
  )
}
