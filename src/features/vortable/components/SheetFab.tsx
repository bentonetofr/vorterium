import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CampaignSheetPanel } from '../../sheets/components/CampaignSheetPanel'
import { useAuth } from '../../auth/AuthProvider'
import { useCurrentCampaign } from '../../campaigns/CurrentCampaignContext'
import './SheetFab.css'

/**
 * A ficha foi feita pra largura de uma página: numa janela mais estreita ela
 * vazaria pela direita. Mede o quanto ela precisa e, se passar do espaço,
 * encolhe (zoom) o suficiente pra caber. Reage a mudança de tamanho da janela
 * e de conteúdo (trocar de aba da ficha muda a largura).
 */
function useFitToWidth(open: boolean) {
  const body = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const outer = body.current
    const content = inner.current
    if (!open || !outer || !content) return
    let frame = 0
    const fit = () => {
      content.style.zoom = '1'
      const style = getComputedStyle(outer)
      const avail = outer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      // scrollWidth não vê o que está dentro de caixas com overflow cortado (as abas, o
      // cabeçalho): mede o canto direito de cada elemento visível
      const left = content.getBoundingClientRect().left
      let need = content.scrollWidth
      for (const el of content.querySelectorAll<HTMLElement>('*')) {
        if (!el.offsetParent) continue
        const r = el.getBoundingClientRect()
        if (r.width > 0) need = Math.max(need, r.right - left)
      }
      const zoom = need > avail + 1 ? Math.max(0.5, avail / need) : 1
      content.style.zoom = zoom < 1 ? String(zoom) : ''
    }
    let timer = 0
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit) }, 60) }
    fit()
    const resize = new ResizeObserver(schedule)
    resize.observe(outer)
    const mutate = new MutationObserver(schedule)
    mutate.observe(content, { childList: true, subtree: true })
    return () => { window.clearTimeout(timer); cancelAnimationFrame(frame); resize.disconnect(); mutate.disconnect() }
  }, [open])

  return { body, inner }
}

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
  const { body, inner } = useFitToWidth(open)

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
          <div ref={body} className="sheet-popup__body">
            <div ref={inner} className="sheet-popup__inner">
              <CampaignSheetPanel campaign={campaign} currentUserId={user.id} />
            </div>
          </div>
        </aside>,
        document.body,
      )}
    </>
  )
}
