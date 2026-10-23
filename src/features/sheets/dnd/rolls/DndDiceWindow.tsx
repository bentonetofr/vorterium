import { useCallback, useEffect, useState } from 'react'
import { DiceRollerPanel } from '../../../dice/components/DiceRollerPanel'
import { parseDiceFormula, recordRoll, rollParsedFormula, type RollExtras, type RollResult } from '../../../dice/services/diceService'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { getMyDiceSkin, setMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DndDiceVitrine } from './DndDiceVitrine'
import { DndFreeRollPanel } from './DndFreeRollPanel'
import './DndDiceWindow.css'

// ────────────────────────────────────────────────────────
// O conteúdo do painel de dados das campanhas de D&D (a janela do canto, no
// mesmo lugar e do mesmo tamanho do rolador dos outros sistemas), com duas
// abas: a rolagem livre, que é o próprio rolador do site (rolagem rápida,
// fórmulas como 1d20+5, 2#d20+5 e 2@d20+5, rolagem privada e os recentes), e a
// vitrine dos conjuntos de dados (um d20 de cada girando devagar; clicar
// escolhe o conjunto). Rolar abre o mesmo painel dos testes da ficha, e a mesa
// vê. As demais rolagens ficam nos botões da ficha.
// ────────────────────────────────────────────────────────

type Tab = 'free' | 'skins'

interface Props {
  campaignId:    string
  currentUserId: string
}

export function DndDiceWindow({ campaignId, currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('free')
  const [rolling, setRolling] = useState<{ formula: string; isPrivate: boolean } | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
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

  const isPrivate = rolling?.isPrivate ?? false
  const perform = useCallback(async (formula: string, build: (rolled: RollResult) => RollExtras) => {
    const rolled = rollParsedFormula(parseDiceFormula(formula), { floor: false })
    const saved = await recordRoll(campaignId, rolled, isPrivate, build(rolled))
    setRefreshKey((k) => k + 1)
    return saved
  }, [campaignId, isPrivate])

  return (
    <div className="ddw">
      <div className="ddw__tabs" role="tablist" aria-label="Seções do painel de dados">
        {([['free', 'Rolagem livre'], ['skins', 'Meus dados']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ddw__tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'free'
        ? <DiceRollerPanel campaignId={campaignId} currentUserId={currentUserId} onRoll={() => {}} onRequestRoll={(formula, priv) => setRolling({ formula, isPrivate: priv })} refreshKey={refreshKey} />
        : <div className="ddw__body" role="tabpanel"><DndDiceVitrine skin={skin} error={skinError} onPick={(id) => void pickSkin(id)} /></div>}
      {rolling && (
        <DndFreeRollPanel formula={rolling.formula} character="" skin={skin} perform={perform} onBack={() => setRolling(null)} onClose={() => setRolling(null)} />
      )}
    </div>
  )
}
