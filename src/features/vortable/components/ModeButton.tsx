import './ModeButton.css'

/** Olho: dá pra olhar a cena como os jogadores a veem. */
function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Martelo e chave de fenda cruzados: as ferramentas de edição. */
function ToolsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* martelo: cabo e cabeça */}
      <path d="M9.4 9.4 19.2 19.2" />
      <path d="M9.4 3.8 3.8 9.4 6.6 12.2 12.2 6.6z" />
      {/* chave de fenda: ponta, haste e cabo */}
      <path d="M19.8 4.2 17 5.4 18.6 7z" />
      <path d="M17.8 6.2 10 14" />
      <path d="M9.4 14.6 4.8 19.2" strokeWidth="4" />
    </svg>
  )
}

/**
 * Botão redondo do mestre no Vortable: mostra o que vem a seguir.
 *  • olho (estando nas ferramentas): ver a cena ao vivo, como os jogadores, e controlar tudo na hora;
 *  • martelo e chave de fenda (estando no controle): voltar às ferramentas de edição.
 */
export function ModeButton({ mode, onClick }: { mode: 'editar' | 'controle'; onClick: () => void }) {
  const toLive = mode === 'editar'
  return (
    <button
      type="button"
      className={`mode-btn${toLive ? '' : ' mode-btn--tools'}`}
      onClick={onClick}
      aria-label={toLive ? 'Ver a cena ao vivo (controle)' : 'Voltar às ferramentas de edição'}
      title={toLive ? 'Ver a cena ao vivo (controle)' : 'Voltar às ferramentas de edição'}
    >
      <span className="mode-btn__icon mode-btn__icon--eye"><EyeIcon /></span>
      <span className="mode-btn__icon mode-btn__icon--tools"><ToolsIcon /></span>
    </button>
  )
}
