import { useEffect, useState } from 'react'
import { DEFAULT_SKIN } from '../../dice3d/skins'
import { getMyDiceSkin, onDiceSkinChange, setMyDiceSkin } from '../../dice3d/diceSkinService'
import { DndDiceVitrine } from '../../sheets/dnd/rolls/DndDiceVitrine'
import '../../sheets/dnd/rolls/DndDiceWindow.css'

// ────────────────────────────────────────────────────────
// Aba "Meus dados" do rolador de dados (campanhas de Altherium): a mesma
// vitrine do D&D, com todos os conjuntos de dados da conta. Escolher vale
// para todas as rolagens, em qualquer aparelho.
// ────────────────────────────────────────────────────────

export function MyDiceTab() {
  const [skin, setSkin] = useState(DEFAULT_SKIN)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void getMyDiceSkin().then((s) => { if (alive) setSkin(s) }).catch(() => { /* fica o padrão */ })
    const off = onDiceSkinChange((s) => { if (alive) setSkin(s) })
    return () => { alive = false; off() }
  }, [])

  async function pick(id: string) {
    if (id === skin) return
    const before = skin
    setSkin(id)
    setError(null)
    try { await setMyDiceSkin(id) } catch (err) { setSkin(before); setError(err instanceof Error ? err.message : 'Não foi possível salvar.') }
  }

  return (
    <div className="ddw dice-fab__skins" role="tabpanel">
      <DndDiceVitrine skin={skin} error={error} onPick={(id) => void pick(id)} />
    </div>
  )
}
