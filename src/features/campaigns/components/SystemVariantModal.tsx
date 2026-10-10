import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import { getSystemEntry, getSystemVariants, type CampaignSystem } from '../../../shared/constants/systems'

// ────────────────────────────────────────────────────────
// Janelinha da criação de campanha pros sistemas que têm mais de uma
// versão (hoje: Terra Devastada → original ou adaptada). Cada opção
// escolhe o id do sistema que vai pra campanha.
// ────────────────────────────────────────────────────────

interface SystemVariantModalProps {
  /** Sistema de origem (o cartão em que a pessoa clicou). */
  system:   CampaignSystem
  /** Versão marcada agora (a pessoa pode estar voltando pra trocar). */
  current:  CampaignSystem
  onPick:   (system: CampaignSystem) => void
  onClose:  () => void
}

/** Rótulo curto de cada versão dentro da janelinha. */
const VERSION_NAME: Partial<Record<CampaignSystem, string>> = {
  terra_devastada:          'Versão original',
  terra_devastada_adaptada: 'Versão adaptada',
}

export function SystemVariantModal({ system, current, onPick, onClose }: SystemVariantModalProps) {
  const base = getSystemEntry(system)
  const options = [base, ...getSystemVariants(system)].filter((e): e is NonNullable<typeof e> => !!e)

  return (
    <ModalOverlay onClose={onClose}>
      <div className="variant-modal" role="dialog" aria-modal="true" aria-labelledby="variant-modal-title">
        <header className="variant-modal__header">
          <h4 id="variant-modal-title" className="variant-modal__title">{base?.label ?? 'Sistema'}</h4>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <p className="variant-modal__hint">Qual versão você quer usar na campanha?</p>
        <div className="variant-modal__options">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`variant-modal__option${current === opt.id ? ' variant-modal__option--current' : ''}`}
              onClick={() => onPick(opt.id)}
            >
              <span className="variant-modal__name">{VERSION_NAME[opt.id] ?? opt.label}</span>
              <span className="variant-modal__desc">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </ModalOverlay>
  )
}
