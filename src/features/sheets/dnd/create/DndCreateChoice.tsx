import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import '../import/DndImport.css'
import './DndCreate.css'

// ────────────────────────────────────────────────────────
// A janela que aparece quando a ficha de D&D ainda está em branco: fazer tudo na própria ficha (para quem já conhece o
// sistema), responder o formulário rápido (uma pergunta por vez) ou contar a história do personagem e deixar o site montar
// a ficha. Nos três casos dá para mudar qualquer coisa na ficha depois.
// ────────────────────────────────────────────────────────

interface Props {
  onManual: () => void
  onQuick: () => void
  onNarrative: () => void
  busy?: boolean
  error?: string | null
}

export function DndCreateChoice({ onManual, onQuick, onNarrative, busy = false, error }: Props) {
  return (
    <ModalOverlay onClose={() => {}} closeDisabled>
      <div className="dsh-sheet dimp dcr" role="dialog" aria-modal="true" aria-labelledby="dcr-title">
        <header className="dimp__head">
          <div>
            <span className="dimp__kicker">Nova ficha</span>
            <h2 id="dcr-title" className="dimp__heading">Montar a ficha de D&amp;D</h2>
          </div>
        </header>
        <p className="dimp__body">Escolha como quer começar. Nos três casos dá para mudar qualquer coisa na ficha depois.</p>
        {error && <p className="dimp__error" role="alert">{error}</p>}
        <div className="dcr__options">
          <button type="button" className="dcr__opt" onClick={onManual} disabled={busy}>
            <b>Fazer manualmente</b>
            <span>A ficha abre em branco e você preenche tudo nas abas. Para quem já conhece o sistema: raça, classe, atributos, perícias, equipamento e magias, do seu jeito.</span>
          </button>
          <button type="button" className="dcr__opt dcr__opt--quick" onClick={onQuick} disabled={busy}>
            <b>Criar ficha rápida</b>
            <span>Um formulário com uma pergunta por vez, só o essencial: nome, nível, raça, antecedente, classe, atributos, perícias, equipamento e magias. A ficha sai pronta, com tudo calculado.</span>
          </button>
          <button type="button" className="dcr__opt dcr__opt--story" onClick={onNarrative} disabled={busy}>
            <b>Criar ficha por narrativa</b>
            <span>Para quem tem pouca ideia do personagem, ou não sabe qual raça e classe combinam. Você responde perguntas fáceis (até com cenas de aventura, e pode dizer “não sei”), e o site monta a melhor ficha e explica cada escolha.</span>
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
