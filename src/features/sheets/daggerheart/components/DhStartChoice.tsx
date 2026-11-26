import { ModalOverlay } from '../../../../shared/components/ModalOverlay'

// ────────────────────────────────────────────────────────
// A janela que aparece quando a ficha ainda está em branco: fazer tudo na ficha mesmo (para quem já conhece o sistema)
// ou responder o formulário rápido, uma pergunta por vez.
// ────────────────────────────────────────────────────────

interface Props {
  onManual: () => void
  onQuick: () => void
}

export function DhStartChoice({ onManual, onQuick }: Props) {
  return (
    <ModalOverlay onClose={() => {}} closeDisabled>
      <div className="dh-dialog dh-start" role="dialog" aria-modal="true" aria-label="Como montar a ficha">
        <header className="dh-dialog__head"><h3>Montar a ficha de DaggerHeart</h3></header>
        <p className="dh-hint">Escolha como quer começar. Nos dois casos dá para mudar tudo na ficha depois.</p>
        <div className="dh-start__options">
          <button type="button" className="dh-start__opt" onClick={onManual}>
            <b>Fazer manualmente</b>
            <span>A ficha abre em branco e você preenche tudo na própria ficha. Para quem já conhece o sistema: o site calcula o que as regras mandam e cada número pode ser trocado por um valor seu.</span>
          </button>
          <button type="button" className="dh-start__opt dh-start__opt--quick" onClick={onQuick}>
            <b>Criar ficha rápida</b>
            <span>Um formulário com uma pergunta por vez, só o essencial: nome, classe, herança, atributos, equipamento, Experiências e cartas. No fim a ficha sai pronta.</span>
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
