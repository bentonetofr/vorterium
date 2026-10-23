import { useEffect, useState } from 'react'
import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { DEFAULT_SKIN } from '../../../dice3d/skins'
import { getMyDiceSkin, setMyDiceSkin } from '../../../dice3d/diceSkinService'
import { DndDiceVitrine } from './DndDiceVitrine'
import './DndDiceWindow.css'

// ────────────────────────────────────────────────────────
// A janela de dados das campanhas de D&D: abre no centro da tela ao clicar na
// bolinha de dados e mostra a vitrine dos conjuntos (um d20 de cada girando
// devagar, com o nome embaixo). Clicar escolhe o conjunto. As rolagens em si
// ficam nos botões da ficha.
// ────────────────────────────────────────────────────────

export function DndDiceWindow({ onClose }: { onClose: () => void }) {
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

  return (
    <ModalOverlay onClose={onClose}>
      <div className="ddw" role="dialog" aria-modal="true" aria-labelledby="ddw-title">
        <header className="ddw__head">
          <h3 id="ddw-title" className="ddw__title"><span aria-hidden="true">⚄</span>Meus dados</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <div className="ddw__body">
          <DndDiceVitrine skin={skin} error={skinError} onPick={(id) => void pickSkin(id)} />
        </div>
      </div>
    </ModalOverlay>
  )
}
