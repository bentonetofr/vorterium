import { useEffect, useRef } from 'react'
import type { PanelId } from './livroNet'
import { spriteCastical, spriteEstante, spriteMesa, spritePedestal, spriteRetrato } from './game/art'

// ────────────────────────────────────────────────────────
// A janela de um objeto: aparece no centro da tela, o fundo desfoca e o
// boneco fica parado. Marco 1: a ilustração ampliada e uma descrição — os
// enigmas entram no marco 2. Fecha com Esc, ✕ ou clicando fora.
// Quem assiste vê a mesma janela de quem está jogando, só olhando.
// ────────────────────────────────────────────────────────

const INFO: Record<PanelId, { title: string; text: string; sprite: () => HTMLCanvasElement }> = {
  castical:   { title: 'O Castiçal',   text: 'Sete velas de alturas diferentes. Atrás delas, sete ganchos com runas gravadas na pedra.', sprite: spriteCastical },
  retrato:    { title: 'O Retrato',    text: 'Um bibliotecário de Caatedrum. A tinta escureceu e rachou — quase não se vê o rosto.', sprite: spriteRetrato },
  astrolabio: { title: 'O Astrolábio', text: 'Bronze frio. Quatro encaixes vazios, um ponteiro solto e oito marcas sem número na borda.', sprite: spriteMesa },
  estante:    { title: 'A Estante',    text: 'Doze livros de cores e alturas diferentes. Parecem arrumados — mas não estão.', sprite: spriteEstante },
  pedestal:   { title: 'O Livro Bloqueado', text: 'Um livro grande preso por quatro correntes e quatro fechaduras. Na capa, um diagrama em círculo, ainda incompleto.', sprite: spritePedestal },
}

export function PuzzlePanel({ id, onClose, watching }: { id: PanelId; onClose: () => void; watching?: string | null }) {
  const art = useRef<HTMLCanvasElement>(null)
  const info = INFO[id]

  useEffect(() => {
    const c = art.current
    if (!c) return
    const s = info.sprite()
    const k = Math.max(2, Math.floor(Math.min(220 / s.width, 200 / s.height)))
    c.width = s.width * k
    c.height = s.height * k
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(s, 0, 0, c.width, c.height)
  }, [info])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="lb-panel-wrap" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="lb-panel lb-frame" role="dialog" aria-label={info.title}>
        <button type="button" className="lb-x" onClick={onClose} aria-label="Fechar">✕</button>
        {watching && <p className="lb-panel__watch">Assistindo {watching}</p>}
        <h2 className="lb-panel__title">{info.title}</h2>
        <canvas ref={art} className="lb-panel__art" aria-hidden="true" />
        <p className="lb-panel__text">{info.text}</p>
        <p className="lb-panel__soon">O mistério deste objeto desperta no próximo marco.</p>
      </section>
    </div>
  )
}
