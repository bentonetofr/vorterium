import type { ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Peças visuais das fases: fichas de pessoas, ícones das alas, gotas de
// tinta, máscaras e o diagrama de cada dança no círculo de 8 assentos.
// Menos texto: o desenho diz, o texto completo fica no title/aria.
// ────────────────────────────────────────────────────────

// Cada elenco (suspeitos, convidados) ganha cores bem separadas, na ordem
// em que aparece; quem não está em elenco nenhum tira a cor do nome.
const castHues = new Map<string, number>()
export function registerCast(names: string[]) {
  for (const n of names) if (!castHues.has(n)) castHues.set(n, Math.round((castHues.size * 137.5 + 20) % 360))
}

function hue(name: string): number {
  const cast = castHues.get(name)
  if (cast !== undefined) return cast
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

/** Ficha redonda de uma pessoa (inicial gravada, cor fixa pelo nome). */
export function Token({ name, size = 32, showName = false, dim = false }: { name: string; size?: number; showName?: boolean; dim?: boolean }) {
  const h = hue(name)
  return (
    <span className={`en-token${dim ? ' is-dim' : ''}`} title={name}>
      <span
        className="en-token__disc"
        aria-hidden="true"
        style={{
          width: size, height: size, fontSize: size * 0.56,
          color: `hsl(${h} 70% 86%)`,
          background: `radial-gradient(circle at 35% 30%, hsl(${h} 40% 32%), hsl(${h} 45% 16%))`,
          borderColor: `hsl(${h} 55% 62%)`,
        }}
      >{name.charAt(0)}</span>
      {showName ? <span className="en-token__name">{name}</span> : <span className="en-sr">{name}</span>}
    </span>
  )
}

function Svg({ children, size = 24, className }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  )
}

const ALA_ICONS: Record<string, ReactNode> = {
  Mapas: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  Selos: <><circle cx="12" cy="10" r="6" /><circle cx="12" cy="10" r="2.5" /><path d="M8.5 15l-1.5 6 3-2 2 2 2-2 3 2-1.5-6" /></>,
  Salmos: <><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v13c-3-1-6-1-9 1-3-2-6-2-9-1z" /><path d="M12 6v13" /></>,
  Genealogias: <><circle cx="12" cy="5" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M12 7v4M6 16v-5h12v5" /></>,
  Proibida: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></>,
}

/** Ícone de uma ala (pelo nome curto); sem desenho, o número. */
export function AlaIcon({ name, i, size = 24 }: { name: string; i: number; size?: number }) {
  const icon = ALA_ICONS[name]
  return icon ? <Svg size={size}>{icon}</Svg> : <span className="en-ala-n" aria-hidden="true">{i}</span>
}

export function DoorIcon({ size = 24 }: { size?: number }) {
  return <Svg size={size}><path d="M5 21V10a7 7 0 0 1 14 0v11z" /><path d="M3 21h18" /><path d="M14.5 14.5h.01" /></Svg>
}

export function BookIcon({ size = 24 }: { size?: number }) {
  return <Svg size={size}><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></Svg>
}

export function QuillIcon({ size = 20 }: { size?: number }) {
  return <Svg size={size}><path d="M20 4C13 4 8 9 6.5 16L5 20l4-1.5C16 17 20 12 20 4z" /><path d="M5 20l8-8" /></Svg>
}

export function EyeIcon({ size = 18 }: { size?: number }) {
  return <Svg size={size}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>
}

/** Gota de tinta: fresca (brilha, molhada) ou antiga (sépia, seca). */
export function Drop({ kind, size = 18 }: { kind: 'fresca' | 'antiga'; size?: number }) {
  return (
    <span className={`en-drop en-drop--${kind}`} title={kind === 'fresca' ? 'Tinta fresca' : 'Tinta antiga'}>
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path d="M12 2.5c3.2 4.2 6.5 7.6 6.5 11.6a6.5 6.5 0 0 1-13 0c0-4 3.3-7.4 6.5-11.6z" />
        {kind === 'fresca' && <path d="M9.2 13.2a3 3 0 0 0 2 3.4" className="en-drop__shine" />}
      </svg>
      <span className="en-sr">{kind === 'fresca' ? 'Tinta fresca' : 'Tinta antiga'}</span>
    </span>
  )
}

const MASK_GLYPHS: Record<string, string> = {
  Lua: '🌙', Sol: '☀️', Estrela: '⭐', Corvo: '🐦', Névoa: '🌫️', Raposa: '🦊', Serpente: '🐍', Cervo: '🦌',
}

/** Uma máscara do baile (desenho; sem desenho, a inicial). */
export function Mask({ name, size = 22 }: { name: string; size?: number }) {
  const g = MASK_GLYPHS[name]
  return (
    <span className="en-mask" title={name} style={{ fontSize: size }}>
      <span aria-hidden="true">{g ?? name.charAt(0)}</span>
      <span className="en-sr">{name}</span>
    </span>
  )
}

// ── O círculo de 8 assentos ─────────────────────────────

/** Posição do assento i (0 em cima, na porta; sentido horário). */
export function seatXY(i: number, n: number, r: number): [number, number] {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2
  return [Math.cos(a) * r, Math.sin(a) * r]
}

const PAIRS: Record<string, [number, number][]> = {
  pares:      [[0, 1], [2, 3], [4, 5], [6, 7]],
  oposto:     [[0, 4], [1, 5], [2, 6], [3, 7]],
  espelhar:   [[0, 7], [1, 6], [2, 5], [3, 4]],
  inverter03: [[0, 3], [1, 2]],
}

/** Legenda curta de uma dança. */
export function opLabel(op: string, k?: number | null): string {
  switch (op) {
    case 'girar':      return k && k < 0 ? `gira ${-k} ↺` : `gira ${k ?? 0} ↻`
    case 'pares':      return 'trocam em pares'
    case 'oposto':     return 'vão ao oposto'
    case 'espelhar':   return 'se espelham'
    case 'inverter03': return '0–3 se invertem'
    default:           return op
  }
}

/** Desenho de uma dança: setas no círculo (girar) ou trocas entre assentos. */
export function OpDiagram({ op, k, n = 8, size = 116, tone = 'gold' }: { op: string; k?: number | null; n?: number; size?: number; tone?: 'gold' | 'blue' }) {
  const R = 38
  const pairs = PAIRS[op] ?? []
  const id = `en-arrow-${tone}`
  let arc: string | null = null
  if (op === 'girar' && k) {
    // Arco por fora do círculo, do assento 0 até o assento k.
    const r = 50
    const steps = Math.min(Math.abs(k), n - 1)
    const a0 = -Math.PI / 2
    const a1 = a0 + Math.sign(k) * (steps / n) * Math.PI * 2
    const [x0, y0] = [Math.cos(a0) * r, Math.sin(a0) * r]
    const [x1, y1] = [Math.cos(a1) * r, Math.sin(a1) * r]
    const large = steps / n > 0.5 ? 1 : 0
    arc = `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${k > 0 ? 1 : 0} ${x1} ${y1}`
  }
  return (
    <svg viewBox="-60 -60 120 120" width={size} height={size} className={`en-op en-op--${tone}`} aria-hidden="true">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" className="en-op__head" />
        </marker>
      </defs>
      <circle r={R} className="en-op__ring" />
      {arc && <path d={arc} className="en-op__line" markerEnd={`url(#${id})`} />}
      {pairs.map(([a, b]) => {
        const [x1, y1] = seatXY(a, n, R - 11)
        const [x2, y2] = seatXY(b, n, R - 11)
        return <line key={`${a}-${b}`} x1={x1} y1={y1} x2={x2} y2={y2} className="en-op__line" markerStart={`url(#${id})`} markerEnd={`url(#${id})`} />
      })}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = seatXY(i, n, R)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={8} className="en-op__seat" />
            <text x={x} y={y} className="en-op__n" textAnchor="middle" dominantBaseline="central">{i}</text>
          </g>
        )
      })}
      {op === 'girar' && k ? <text x={0} y={0} className="en-op__k" textAnchor="middle" dominantBaseline="central">{k > 0 ? `+${k}` : k}</text> : null}
    </svg>
  )
}
