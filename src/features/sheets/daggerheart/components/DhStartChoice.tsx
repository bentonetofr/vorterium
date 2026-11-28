import { ModalOverlay } from '../../../../shared/components/ModalOverlay'

// ────────────────────────────────────────────────────────
// A janela que aparece quando a ficha ainda está em branco: fazer tudo na ficha mesmo (para quem já conhece o sistema)
// responder o formulário rápido (uma pergunta por vez) ou contar a história do personagem e deixar o site montar a ficha.
// ────────────────────────────────────────────────────────

interface Props {
  onManual: () => void
  onQuick: () => void
  onNarrative: () => void
  onClose: () => void
}

export function DhStartChoice({ onManual, onQuick, onNarrative, onClose }: Props) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="dh-dialog dh-start" role="dialog" aria-modal="true" aria-label="Como montar a ficha">
        <header className="dh-dialog__head">
          <h3>Montar a ficha de DaggerHeart</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <p className="dh-hint">Escolha como quer começar. Nos três casos dá para mudar tudo na ficha depois.</p>
        <div className="dh-start__options">
          <button type="button" className="dh-start__opt" onClick={onManual}>
            <b>Fazer manualmente</b>
            <span>A ficha abre em branco e você preenche tudo na própria ficha. Para quem já conhece o sistema: o site calcula o que as regras mandam e cada número pode ser trocado por um valor seu.</span>
          </button>
          <button type="button" className="dh-start__opt dh-start__opt--quick" onClick={onQuick}>
            <b>Criar ficha rápida</b>
            <span>Um formulário com uma pergunta por vez, só o essencial: nome, classe, herança, atributos, equipamento, Experiências e cartas. No fim a ficha sai pronta.</span>
          </button>
          <button type="button" className="dh-start__opt dh-start__opt--story" onClick={onNarrative}>
            <b>Criar ficha por narrativa</b>
            <span>Para quem tem pouca ideia do personagem, ou não sabe qual classe e herança combinam. Você responde perguntas fáceis (até com cenas de aventura, e pode dizer “não sei”), e o site monta a melhor ficha, sugere ideias de história e explica cada escolha.</span>
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
