import { Icon } from './AltheriumPlayKit'

// ────────────────────────────────────────────────────────
// Botões de ação do jogo, no cabeçalho da ficha (como os da Terra Devastada):
// cada um abre a sua janela, com a conta pronta e os dados 3D. A legenda
// de cada botão mostra o que ele vai usar (a arma, as Fichas, o estado dos
// inimigos...), pra não precisar abrir pra saber.
// ────────────────────────────────────────────────────────

export type PlayAction =
  | 'attack' | 'defend' | 'damage' | 'stealth' | 'explore' | 'rest' | 'mind' | 'test' | 'initiative' | 'dying'

export interface ActionDef {
  id:       PlayAction
  label:    string
  caption:  string
  icon:     string
  tone?:    'danger' | 'primary' | 'calm'
  disabled?: boolean
  title?:   string
}

export function AltheriumActionBar({ actions, onAction }: { actions: ActionDef[]; onAction: (id: PlayAction) => void }) {
  return (
    <nav className="alth-acts" aria-label="Ações">
      {actions.map((a) => (
        <button
          key={a.id} type="button" disabled={a.disabled} title={a.title}
          className={`alth-act${a.tone ? ` alth-act--${a.tone}` : ''}`}
          onClick={() => onAction(a.id)}
        >
          <Icon name={a.icon} />
          <span className="alth-act__label">{a.label}</span>
          <small className="alth-act__caption">{a.caption}</small>
        </button>
      ))}
    </nav>
  )
}
