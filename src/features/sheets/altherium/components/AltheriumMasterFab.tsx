import { useCallback, useEffect, useState } from 'react'
import { Presence } from '../../../../shared/components/Presence'
import { useFloatingPanel } from '../../../../shared/lib/floatingPanels'
import { useCurrentCampaign } from '../../../campaigns/CurrentCampaignContext'
import { AltheriumMasterPanel } from './AltheriumMasterPanel'
import './AltheriumMaster.css'

// ────────────────────────────────────────────────────────
// Botão fixo do canto, só para o mestre de uma campanha de Altherium: abre
// o painel do mestre (pedir testes, dar Achados, Descanso do grupo, ajustes
// e a cena), por cima da página, sem sair do que estiver fazendo.
// ────────────────────────────────────────────────────────

function CrownIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
      <path d="M5.5 19h13" />
    </svg>
  )
}

export function AltheriumMasterFab() {
  const { campaign } = useCurrentCampaign()
  const [isOpen, setIsOpen] = useState(false)
  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('altherium', isOpen, close)
  const campaignId = campaign?.id ?? null
  useEffect(() => { setIsOpen(false) }, [campaignId])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      if (document.querySelector('.modal-overlay')) return
      setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  if (!campaign || campaign.role !== 'master' || campaign.system !== 'altherium') return null

  return (
    <>
      {(isOpen || !instant) && (
        <Presence show={isOpen} exitMs={180}>
          {(state) => (
            <div className="alth-master-panel fab-panel anim-pop" data-state={state} data-fab-panel="altherium" role="dialog" aria-label="Painel do mestre de Altherium">
              <header className="alth-master-panel__head">
                <CrownIcon />
                <div className="alth-master-panel__titles">
                  <span className="alth-master-panel__title">Painel do mestre</span>
                  <span className="alth-master-panel__sub">Altherium · escolha quem recebe e aplique</span>
                </div>
                <button type="button" className="alth-master-panel__close" onClick={close} aria-label="Fechar o painel do mestre">×</button>
              </header>
              <div className="alth-master-panel__body">
                <AltheriumMasterPanel campaignId={campaign.id} />
              </div>
            </div>
          )}
        </Presence>
      )}
      <button
        type="button"
        className={`alth-master-fab${isOpen ? ' alth-master-fab--open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Painel do mestre"
        aria-expanded={isOpen}
        title="Painel do mestre: testes, achados, descanso e cena"
      >
        <CrownIcon />
      </button>
    </>
  )
}
