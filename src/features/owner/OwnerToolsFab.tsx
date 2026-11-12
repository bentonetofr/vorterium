import { useCallback, useEffect, useState } from 'react'
import { Presence } from '../../shared/components/Presence'
import { useFloatingPanel } from '../../shared/lib/floatingPanels'
import { useIsSiteOwner } from '../control/siteFeatures'
import { OwnerPlayersTab } from './OwnerPlayersTab'
import {
  OWNER_HIDE_SHORTCUT, diceForced, isHideShortcut, setOwnerHidden, setOwnerTools, toggleOwnerHidden, useOwnerHidden, useOwnerTools,
  type DieForce,
} from './ownerTools'
import './OwnerToolsFab.css'

// ────────────────────────────────────────────────────────
// Botão privado do dono, em cima do sino: ferramentas só pra conta do dono, em qualquer campanha (como mestre ou jogador).
// Duas abas: Dados (forçar o resultado dos próprios dados) e Jogadores (os dados de todo mundo da campanha aberta).
// Alt+Shift+T esconde e mostra o botão. Não é recurso do site: sem Novidades, sem painel de controle.
// ────────────────────────────────────────────────────────

const MODES: { id: DieForce; label: string; hint: string }[] = [
  { id: 'off',   label: 'Normal',  hint: 'Sorteio de verdade.' },
  { id: 'max',   label: 'Máximo',  hint: 'Todo dado cai no maior número: crítico no d20 e dano máximo.' },
  { id: 'min',   label: 'Mínimo',  hint: 'Todo dado cai em 1: falha crítica.' },
  { id: 'fixed', label: 'Número',  hint: 'Todo dado cai neste número (o mais perto que ele tem).' },
]

type Tab = 'dados' | 'jogadores'
const TABS: { id: Tab; label: string }[] = [{ id: 'dados', label: 'Dados' }, { id: 'jogadores', label: 'Jogadores' }]

/** Tem teclado de verdade? No celular o atalho não existe, então o botão não oferece esconder (senão não voltaria). */
const hasKeyboard = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

export function OwnerToolsFab() {
  // o dono do site, conferido no banco (tabela app_owners): o e-mail não fica no código
  const isOwner = useIsSiteOwner()
  const tools = useOwnerTools()
  const hidden = useOwnerHidden()
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('dados')
  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('owner', isOpen, close)

  // arma só com a conta do dono (em qualquer campanha, como mestre ou como jogador) e desarma ao sair
  const armed = isOwner
  useEffect(() => {
    setOwnerTools({ armed })
    return () => setOwnerTools({ armed: false })
  }, [armed])

  // Alt+Shift+T esconde e mostra o botão (escuta a janela toda, mesmo com o foco num campo)
  useEffect(() => {
    if (!isOwner) return
    const onKey = (e: KeyboardEvent) => {
      if (!isHideShortcut(e)) return
      e.preventDefault()
      setIsOpen(false)
      toggleOwnerHidden()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isOwner])

  if (!isOwner) return null
  const on = diceForced(tools)
  const mode = MODES.find((m) => m.id === tools.dice)

  return (
    <>
      {!hidden && (isOpen || !instant) && (
        <Presence show={isOpen} exitMs={180}>
          {(state) => (
            <div className="owner-panel fab-panel fab-panel--fit anim-pop" data-state={state} data-fab-panel="owner" role="dialog" aria-label="Ferramentas do dono">
              <div className="owner-panel__head">
                <SparkIcon />
                <div className="owner-panel__titles">
                  <span className="owner-panel__title">Trapaças</span>
                  <span className="owner-panel__sub">Só você vê, em qualquer campanha</span>
                </div>
                <button type="button" className="owner-panel__close" onClick={close} aria-label="Fechar">✕</button>
              </div>

              <div className="owner-panel__tabs" role="tablist" aria-label="Seções">
                {TABS.map((t) => (
                  <button
                    key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                    className={`owner-panel__tab${tab === t.id ? ' owner-panel__tab--on' : ''}`} onClick={() => setTab(t.id)}
                  >{t.label}{t.id === 'dados' && on && <i className="owner-panel__dot" aria-label="ligado" />}</button>
                ))}
              </div>

              <div className="owner-panel__body" role="tabpanel">
                {tab === 'dados' ? (
                  <section className="owner-panel__section" aria-label="Dados">
                    <h3 className="owner-panel__h">O que acontece nos seus dados</h3>
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
                    <p className="owner-panel__hint">{mode?.hint}</p>
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
                    <p className="owner-panel__note">Vale pra tudo o que você rolar: dados do site, fichas, iniciativa e dado de vida. Os outros veem a rolagem como qualquer outra, e ela não conta pras conquistas.</p>
                  </section>
                ) : (
                  <section className="owner-panel__section" aria-label="Jogadores"><OwnerPlayersTab /></section>
                )}
              </div>

              <div className="owner-panel__foot">
                <span><kbd>{OWNER_HIDE_SHORTCUT}</kbd> esconde e mostra este botão</span>
                {hasKeyboard() && (
                  <button type="button" className="owner-panel__ghost" onClick={() => { setIsOpen(false); setOwnerHidden(true) }}>Esconder agora</button>
                )}
              </div>
            </div>
          )}
        </Presence>
      )}
      {!hidden && (
        <button
          type="button"
          className={`owner-fab${isOpen ? ' owner-fab--open' : ''}${on ? ' owner-fab--on' : ''}`}
          onClick={() => setIsOpen((o) => !o)}
          aria-label="Ferramentas do dono"
          aria-expanded={isOpen}
          title={`Trapaças (${OWNER_HIDE_SHORTCUT} esconde)`}
        >
          <SparkIcon />
        </button>
      )}
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
