import { useCallback, useEffect, useState } from 'react'
import { Presence } from '../../../shared/components/Presence'
import { useFloatingPanel } from '../../../shared/lib/floatingPanels'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import { MesaDocuments } from './MesaDocuments'
import './Documents.css'

/** Livro aberto (o botão dos documentos). */
export function BookIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 6.5C10.3 5.2 8 4.6 4.5 4.6v13c3.5 0 5.8.6 7.5 1.9 1.7-1.3 4-1.9 7.5-1.9v-13c-3.5 0-5.8.6-7.5 1.9Z" />
      <path d="M12 6.5v13" />
      <path d="M7 8.4c1.2.1 2.2.3 3 .7M7 11.4c1.2.1 2.2.3 3 .7M17 8.4c-1.2.1-2.2.3-3 .7M17 11.4c-1.2.1-2.2.3-3 .7" />
    </svg>
  )
}

/**
 * Botão do livro (só o mestre): abre o painel com todos os documentos da campanha, pra criar
 * cartas e livros, editar, liberar e pôr na mesa (no centro da tela de todos).
 */
export function DocumentsFab() {
  const { campaign } = useCurrentCampaign()
  const [isOpen, setIsOpen] = useState(false)
  const close = useCallback(() => setIsOpen(false), [])
  const { instant } = useFloatingPanel('docs', isOpen, close)
  const campaignId = campaign?.id ?? null
  useEffect(() => { setIsOpen(false) }, [campaignId])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // com o editor ou o leitor abertos por cima, o Esc é deles
      if (document.querySelector('.modal-overlay, .doc-reader')) return
      setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  if (!campaign || campaign.role !== 'master') return null

  return (
    <>
      {(isOpen || !instant) && (
        <Presence show={isOpen} exitMs={180}>
          {(state) => (
            <div className="docs-panel fab-panel anim-pop" data-state={state} data-fab-panel="docs" role="dialog" aria-label="Documentos">
              <button type="button" className="docs-panel__close" onClick={close} aria-label="Fechar os documentos">✕</button>
              <div className="docs-panel__body">
                <MesaDocuments campaignId={campaign.id} />
              </div>
            </div>
          )}
        </Presence>
      )}
      <button
        type="button"
        className={`docs-fab${isOpen ? ' docs-fab--open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Documentos"
        aria-expanded={isOpen}
        title="Documentos: livros e cartas"
      >
        <BookIcon />
      </button>
    </>
  )
}
