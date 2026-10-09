import { useMesaStream } from '../../mesa/MesaStreamProvider'
import './SceneBar.css'

/**
 * Cena dos jogadores: o jogo ao vivo ou a pausa; vale na hora pra todos.
 */
export function SceneBar({ campaignId: _campaignId }: { campaignId: string }) {
  const mesa = useMesaStream()
  const scene = mesa.stage.scene

  const sceneButton = (kind: 'game' | 'pause', label: string) => (
    <button
      type="button"
      className={`scene-btn${scene.kind === kind ? ' scene-btn--on' : ''}`}
      onClick={() => mesa.setScene({ kind })}
      aria-pressed={scene.kind === kind}
      title={`Jogadores veem: ${label}`}
    >
      {label}
    </button>
  )

  return (
    <div className="scene-bar" role="group" aria-label="Cena dos jogadores">
      <span className="scene-bar__label">
        <span className={`scene-bar__dot${mesa.live ? ' scene-bar__dot--live' : ''}`} aria-hidden="true" />
        Cena
      </span>
      {sceneButton('game', 'Ao vivo')}
      {sceneButton('pause', 'Pausa')}
    </div>
  )
}
