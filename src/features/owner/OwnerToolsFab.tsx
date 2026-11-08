import { useCallback, useEffect, useState } from 'react'
import { Presence } from '../../shared/components/Presence'
import { useFloatingPanel } from '../../shared/lib/floatingPanels'
import { useIsSiteOwner } from '../control/siteFeatures'
import { diceForced, setOwnerTools, useOwnerTools, type DieForce } from './ownerTools'
import './OwnerToolsFab.css'

// ────────────────────────────────────────────────────────
// Botão privado do dono, em cima do sino: ferramentas só pra conta do dono, e só nas campanhas em que ele é mestre.
// Não é recurso do site: sem Novidades, sem painel de controle.
// ────────────────────────────────────────────────────────

const MODES: { id: DieForce; label: string; hint: string }[] = [
  { id: 'off',   label: 'Normal',  hint: 'Sorteio de verdade.' },
  { id: 'max',   label: 'Máximo',  hint: 'Todo dado cai no maior número: crítico no d20 e dano máximo.' },
  { id: 'min',   label: 'Mínimo',  hint: 'Todo dado cai em 1: falha crítica.' },
  { id: 'fixed', label: 'Número',  hint: 'Todo dado cai neste número (o mais perto que ele tem).' },
]

export function OwnerToolsFab() {
  // o dono do site, conferido no banco (tabela app_owners): o e-mail não fica no código
  const isOwner = useIsSiteOwner()
  const tools = useOwnerTools()
  const [isOpen, setIsOpen] = useState(false)
  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('owner', isOpen, close)

  // arma só com a conta do dono (em qualquer campanha, como mestre ou como jogador) e desarma ao sair
  const armed = isOwner
  useEffect(() => {
    setOwnerTools({ armed })
    return () => setOwnerTools({ armed: false })
  }, [armed])

  if (!isOwner) return null
  const on = diceForced(tools)

  return (
    <>
      {(isOpen || !instant) && (
        <Presence show={isOpen} exitMs={180}>
          {(state) => (
            <div className="owner-panel fab-panel fab-panel--fit anim-pop" data-state={state} data-fab-panel="owner" role="dialog" aria-label="Ferramentas do dono">
              <div className="owner-panel__head">
                <SparkIcon />
                <div className="owner-panel__titles">
                  <span className="owner-panel__title">Trapaças</span>
                  <span className="owner-panel__sub">Só você vê, em qualquer campanha (como mestre ou jogador)</span>
                </div>
                <button type="button" className="owner-panel__close" onClick={close} aria-label="Fechar">✕</button>
              </div>

              <section className="owner-panel__section" aria-label="Dados">
                <h3 className="owner-panel__h">Seus dados</h3>
                <div className="owner-panel__modes" role="radiogroup" aria-label="O que fazer com os dados">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={tools.dice === m.id}
                      className={`owner-panel__mode${tools.dice === m.id ? ' owner-panel__mode--on' : ''}`}
                      onClick={() => setOwnerTools({ dice: m.id })}
                      title={m.hint}
                    >{m.label}</button>
                  ))}
                </div>
                <p className="owner-panel__hint">{MODES.find((m) => m.id === tools.dice)?.hint}</p>
                {tools.dice === 'fixed' && (
                  <label className="owner-panel__row">
                    <span>Cai o número</span>
                    <input
                      type="number" min={1} max={1000} className="input owner-panel__num"
                      value={tools.fixed}
                      onChange={(e) => setOwnerTools({ fixed: Math.max(1, Math.min(1000, Math.round(Number(e.target.value) || 1))) })}
                    />
                  </label>
                )}
                <label className="owner-panel__check">
                  <input type="checkbox" checked={tools.d20Only} onChange={(e) => setOwnerTools({ d20Only: e.target.checked })} />
                  <span>Só nos d20 (o dano e os outros dados saem no sorteio)</span>
                </label>
              </section>

              <p className="owner-panel__foot">Vale pra tudo o que você rolar: dados do site, fichas, iniciativa e dado de vida. Os outros veem a rolagem como qualquer outra.</p>
            </div>
          )}
        </Presence>
      )}
      <button
        type="button"
        className={`owner-fab${isOpen ? ' owner-fab--open' : ''}${on ? ' owner-fab--on' : ''}`}
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Ferramentas do dono"
        aria-expanded={isOpen}
        title="Trapaças"
      >
        <SparkIcon />
      </button>
    </>
  )
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
    </svg>
  )
}
