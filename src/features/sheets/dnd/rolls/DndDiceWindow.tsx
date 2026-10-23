import { useCallback, useEffect, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { parseDiceFormula, recordRoll, rollParsedFormula, type RollExtras, type RollResult } from '../../../dice/services/diceService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { getMyDiceSkin, setMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DndDiceVitrine } from './DndDiceVitrine'
import { DndFreeRollPanel } from './DndFreeRollPanel'
import { DndFreeRollTab } from './DndFreeRollTab'
import './DndDiceWindow.css'

// ────────────────────────────────────────────────────────
// A janela de dados das campanhas de D&D: abre no centro da tela ao clicar na
// bolinha de dados, com duas abas: a vitrine dos conjuntos (um d20 de cada
// girando devagar, com o nome embaixo; clicar escolhe o conjunto) e a rolagem
// livre (uma fórmula como 1d20+5, 2#d20+5 ou 2@d20+5, no estilo do rolador do site). A rolagem livre abre o mesmo
// painel dos testes e aparece para a mesa toda. As demais rolagens ficam nos
// botões da ficha.
// ────────────────────────────────────────────────────────

type Tab = 'free' | 'skins'

export function DndDiceWindow({ campaignId, onClose }: { campaignId: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('free')
  const [formula, setFormula] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [rolling, setRolling] = useState<string | null>(null)
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const [skinError, setSkinError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getMyDiceSkin().then((s) => { if (alive) setSkin(s) }).catch(() => { /* fica o padrão */ })
    return () => { alive = false }
  }, [])

  async function pickSkin(id: string) {
    if (id === skin) return
    const before = skin
    setSkin(id)
    setSkinError(null)
    try { await setMyDiceSkin(id) } catch (err) { setSkin(before); setSkinError(err instanceof Error ? err.message : 'Não foi possível salvar.') }
  }

  const perform = useCallback(async (formula: string, build: (rolled: RollResult) => RollExtras) => {
    if (!campaignId) throw new Error('Abra uma campanha para rolar.')
    const rolled = rollParsedFormula(parseDiceFormula(formula), { floor: false })
    return recordRoll(campaignId, rolled, isPrivate, build(rolled))
  }, [campaignId, isPrivate])

  if (rolling !== null) {
    return <DndFreeRollPanel formula={rolling} character="" skin={skin} perform={perform} onBack={() => setRolling(null)} onClose={onClose} />
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ddw" role="dialog" aria-modal="true" aria-labelledby="ddw-title">
        <header className="ddw__head">
          <h3 id="ddw-title" className="ddw__title"><span aria-hidden="true">⚄</span>Dados</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="ddw__tabs" role="tablist" aria-label="Seções da janela de dados">
          {([['free', 'Rolagem livre'], ['skins', 'Meus dados']] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ddw__tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="ddw__body" role="tabpanel">
          {tab === 'free'
            ? <DndFreeRollTab formula={formula} onFormula={setFormula} isPrivate={isPrivate} onPrivate={setIsPrivate} onRoll={setRolling} canRoll={!!campaignId} />
            : <DndDiceVitrine skin={skin} error={skinError} onPick={(id) => void pickSkin(id)} />}
        </div>
      </div>
    </ModalOverlay>
  )
}
