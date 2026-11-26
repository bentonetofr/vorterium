import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { DhDomain } from '../model/types'
import { DOMAINS } from '../catalog/rules'

// ────────────────────────────────────────────────────────
// A faixa de cada domínio, igual à do livro (cor própria e o emblema branco). Fica no cabeçalho da classe, nos seletores de
// domínio e onde mais o domínio precisar de marca. São vetores (SVG) em public/dh/dominios, nítidos em qualquer tamanho: a faixa
// foi montada aqui e os emblemas vêm do repositório Foundryborne/daggerheart (assets/icons/domains), que os distribui sob a
// Darrington Press Community Gaming License (DPCGL). Daggerheart é marca da Critical Role / Darrington Press.
//
// Com o mouse parado em cima por 1 segundo (ou o foco do teclado), abre uma janelinha ao lado do cursor com a descrição do domínio.
// ────────────────────────────────────────────────────────

export function domainBanner(domain: DhDomain): string {
  return `${import.meta.env.BASE_URL}dh/dominios/${domain}.svg`
}

const DELAY_MS = 1000
const TIP_W = 300

interface Props {
  domain: DhDomain
  /** Largura da faixa em pixels (a altura segue a proporção do desenho). */
  size?: number
  /** Mantido por compatibilidade: a faixa do livro já tem cor própria. */
  colored?: boolean
  /** Desliga a janelinha de descrição. */
  title?: boolean
}

export function DomainIcon({ domain, size = 18, title = true }: Props) {
  const d = DOMAINS[domain]
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null)
  const timer = useRef<number | null>(null)
  const pos = useRef({ x: 0, y: 0 })

  const cancel = () => { if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null } }
  const arm = () => { cancel(); timer.current = window.setTimeout(() => { timer.current = null; setTip({ ...pos.current }) }, DELAY_MS) }
  const close = () => { cancel(); setTip(null) }
  useEffect(() => cancel, [])

  const img = (
    <img className="dh-domain-icon" src={domainBanner(domain)} width={size} height={Math.round(size * 1.4)} alt={d.name} draggable={false}
      {...(title ? {
        tabIndex: 0,
        onMouseEnter: (e: React.MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; arm() },
        onMouseMove: (e: React.MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; if (tip) setTip({ ...pos.current }); },
        onMouseLeave: close,
        onFocus: (e: React.FocusEvent<HTMLImageElement>) => { const r = e.currentTarget.getBoundingClientRect(); pos.current = { x: r.right, y: r.top + r.height / 2 }; arm() },
        onBlur: close,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Escape') close() },
      } : {})} />
  )
  if (!title) return img

  const w = typeof window === 'undefined' ? 1200 : window.innerWidth
  const h = typeof window === 'undefined' ? 800 : window.innerHeight
  return (
    <>
      {img}
      {tip && createPortal(
        <div className="dh-domtip" role="tooltip" style={{
          left: Math.max(8, Math.min(tip.x + 18, w - TIP_W - 12)), top: Math.max(8, Math.min(tip.y + 18, h - 150)), width: TIP_W, '--dh-domain': d.color,
        } as React.CSSProperties}>
          <b>{d.name}</b>
          <p>{d.text}</p>
        </div>,
        document.body,
      )}
    </>
  )
}

