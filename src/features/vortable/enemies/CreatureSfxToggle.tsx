import { useState } from 'react'
import { creatureSfxEnabled, setCreatureSfxEnabled } from './creatureSounds'
import './enemies.css'

/** Botão pequeno na tela do jogador: liga e desliga os sons de criaturas que o mestre toca. */
export function CreatureSfxToggle() {
  const [on, setOn] = useState(creatureSfxEnabled())
  return (
    <button
      type="button"
      className={`creature-sfx${on ? '' : ' creature-sfx--off'}`}
      onClick={() => { setOn(!on); setCreatureSfxEnabled(!on) }}
      title={on ? 'Sons de criaturas ligados (clique pra desligar)' : 'Sons de criaturas desligados (clique pra ligar)'}
      aria-label={on ? 'Desligar os sons de criaturas' : 'Ligar os sons de criaturas'}
      aria-pressed={on}
    >
      {on ? '🔊' : '🔇'}
    </button>
  )
}
