import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CampaignSheetPanel } from '../../sheets/components/CampaignSheetPanel'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import './SheetFab.css'

function SheetIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <circle cx="12" cy="11.5" r="2" />
      <path d="M8.5 18c.4-2 1.8-3 3.5-3s3.1 1 3.5 3" />
    </svg>
  )
}

/**
 * Botão da ficha (do tamanho e no estilo do botão de dados). Abre uma janela
 * que cobre o lado esquerdo da tela com a ficha da pessoa. Só pro jogador:
 * o mestre vê as fichas de todos pela Sessão.
 */
export function SheetFab() {
  const { user } = useAuth()
  const { campaign } = useCurrentCampaign()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Esc dentro de um campo só sai do campo
      if (e.key === 'Escape' && !(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable="true"]')) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!user || !campaign || campaign.role !== 'player') return null

  return (
    <>
      <button
        type="button"
        className={`dice-fab sheet-fab${open ? ' sheet-fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar a ficha' : 'Abrir a ficha'}
        aria-expanded={open}
        title="Ficha"
      >
        <SheetIcon />
      </button>
      {open && createPortal(
        <aside className="sheet-popup anim-pop" role="dialog" aria-label="Ficha do personagem">
          <header className="sheet-popup__head">
            <span className="sheet-popup__title">Ficha</span>
            <button type="button" className="sheet-popup__close" onClick={() => setOpen(false)} aria-label="Fechar a ficha">×</button>
          </header>
          <div className="sheet-popup__body">
            <CampaignSheetPanel campaign={campaign} currentUserId={user.id} />
          </div>
        </aside>,
        document.body,
      )}
    </>
  )
}
