import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { BoardItem } from '../services/boardService'
import { connectorEnds, inkColor, OUTLINE, type Point } from '../boardGeometry'

// ────────────────────────────────────────────────────────
// Desenho de cada item do Quadro (no "mundo": posição e tamanho em
// unidades do quadro; o zoom vem do transform do pai). Aqui só se desenha;
// arrastar, selecionar e editar ficam no BoardPanel. Todo item tem
// data-board-id, que é como o BoardPanel sabe onde a pessoa clicou.
// ────────────────────────────────────────────────────────

interface EditableTextProps {
  value:        string
  editing:      boolean
  className?:   string
  style?:       CSSProperties
  placeholder?: string
  onInput:      (text: string) => void
  onDone:       () => void
  /** Chamado a cada mudança de texto/tamanho (post-it ajusta a letra, texto solto a altura). */
  innerRef?:    React.RefObject<HTMLDivElement>
}

/** Texto que vira editável no próprio lugar (duplo clique). */
export function EditableText({ value, editing, className, style, placeholder, onInput, onDone, innerRef }: EditableTextProps) {
  const own = useRef<HTMLDivElement>(null)
  const ref = innerRef ?? own

  useLayoutEffect(() => {
    const el = ref.current
    if (!editing || !el) return
    el.textContent = value
    el.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  // Só quando começa a editar — depois o texto é do próprio elemento.
  }, [editing])  // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    return (
      <div
        ref={ref}
        className={`board-text-edit ${className ?? ''}`}
        style={style}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck
        data-placeholder={placeholder}
        onInput={(e) => onInput((e.currentTarget as HTMLDivElement).innerText.replace(/\n$/, ''))}
        onBlur={onDone}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); (e.currentTarget as HTMLDivElement).blur() }
        }}
      />
    )
  }
  return (
    <div ref={ref} className={`${className ?? ''}${value ? '' : ' board-text--empty'}`} style={style}>
      {value || placeholder}
    </div>
  )
}

export interface ItemViewProps {
  item:      BoardItem
  editing:   boolean
  imageUrl?: string | null
  onText:    (id: string, text: string) => void
  onDone:    (id: string) => void
  onMeasure: (id: string, h: number) => void
}

function box(item: BoardItem): CSSProperties {
  return { left: item.x, top: item.y, width: item.w, height: item.h, zIndex: undefined }
}

export const BoardItemView = memo(function BoardItemView(props: ItemViewProps) {
  switch (props.item.kind) {
    case 'note':     return <NoteView {...props} />
    case 'text':     return <TextView {...props} />
    case 'shape':    return <ShapeView {...props} />
    case 'frame':    return <FrameView {...props} />
    case 'image':    return <ImageView {...props} />
    case 'file':     return <FileView {...props} />
    case 'drawing':  return <DrawingView {...props} />
    case 'timeline': return <TimelineView {...props} />
    default:         return null
  }
})

/** Letra do tamanho que couber na caixa (como no Miro): começa grande e diminui. */
function useFitText(ref: React.RefObject<HTMLDivElement>, max: number) {
  useLayoutEffect(() => {
    const el = ref.current
    const body = el?.parentElement
    if (!el || !body) return
    let size = max
    el.style.fontSize = `${size}px`
    while (size > 8 && (el.scrollHeight > body.clientHeight || el.scrollWidth > body.clientWidth)) {
      size -= 1
      el.style.fontSize = `${size}px`
    }
  })
}

// ── Post-it ─────────────────────────────────────────────

function NoteView({ item, editing, onText, onDone }: ItemViewProps) {
  const textRef = useRef<HTMLDivElement>(null)
  const text = item.data.text ?? ''
  useFitText(textRef, Math.min(40, Math.max(12, Math.round(item.w / 7))))
  return (
    <div className={`board-item board-note${item.locked ? ' is-locked' : ''}`} data-board-id={item.id} style={{ ...box(item), '--note': item.data.color } as CSSProperties}>
      <div className="board-note__body">
        <EditableText
          innerRef={textRef}
          value={text}
          editing={editing}
          className="board-note__text"
          onInput={(t) => onText(item.id, t)}
          onDone={() => onDone(item.id)}
        />
      </div>
    </div>
  )
}

// ── Texto solto ─────────────────────────────────────────

function TextView({ item, editing, onText, onDone, onMeasure }: ItemViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  // A altura acompanha o texto (a largura é da pessoa).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const h = Math.ceil(el.offsetHeight)
    if (h > 0 && Math.abs(h - item.h) > 1) onMeasure(item.id, h)
  })
  return (
    <div
      className={`board-item board-textitem${item.locked ? ' is-locked' : ''}`}
      data-board-id={item.id}
      style={{ left: item.x, top: item.y, width: item.w, color: inkColor(item.data.color), fontSize: item.data.size ?? 24 }}
    >
      <EditableText
        innerRef={ref}
        value={item.data.text ?? ''}
        editing={editing}
        className="board-textitem__text"
        placeholder="Escreva algo"
        onInput={(t) => onText(item.id, t)}
        onDone={() => onDone(item.id)}
      />
    </div>
  )
}

// ── Forma ───────────────────────────────────────────────

function shapePath(shape: string | undefined, w: number, h: number): string {
  const s = 1.5
  switch (shape) {
    case 'ellipse':  return `M ${w / 2} ${s} A ${w / 2 - s} ${h / 2 - s} 0 1 1 ${w / 2 - 0.01} ${s} Z`
    case 'diamond':  return `M ${w / 2} ${s} L ${w - s} ${h / 2} L ${w / 2} ${h - s} L ${s} ${h / 2} Z`
    case 'triangle': return `M ${w / 2} ${s} L ${w - s} ${h - s} L ${s} ${h - s} Z`
    default:         return `M ${s + 8} ${s} H ${w - s - 8} Q ${w - s} ${s} ${w - s} ${s + 8} V ${h - s - 8} Q ${w - s} ${h - s} ${w - s - 8} ${h - s} H ${s + 8} Q ${s} ${h - s} ${s} ${h - s - 8} V ${s + 8} Q ${s} ${s} ${s + 8} ${s} Z`
  }
}

function ShapeView({ item, editing, onText, onDone }: ItemViewProps) {
  const textRef = useRef<HTMLDivElement>(null)
  useFitText(textRef, Math.min(32, Math.max(12, Math.round(Math.min(item.w, item.h * 1.6) / 7))))
  const outline = item.data.color === OUTLINE
  const inset = item.data.shape === 'triangle' ? { top: '42%', left: '22%', right: '22%', bottom: '6%' }
    : item.data.shape === 'diamond' ? { top: '22%', left: '22%', right: '22%', bottom: '22%' }
    : { top: '8%', left: '8%', right: '8%', bottom: '8%' }
  return (
    <div className={`board-item board-shape${outline ? ' board-shape--outline' : ''}${item.locked ? ' is-locked' : ''}`} data-board-id={item.id} style={box(item)}>
      <svg className="board-shape__svg" width={item.w} height={item.h} viewBox={`0 0 ${Math.max(item.w, 1)} ${Math.max(item.h, 1)}`} aria-hidden="true">
        <path d={shapePath(item.data.shape, Math.max(item.w, 4), Math.max(item.h, 4))} fill={outline ? 'transparent' : item.data.color} />
      </svg>
      <div className="board-shape__inner" style={inset}>
        <EditableText
          innerRef={textRef}
          value={item.data.text ?? ''}
          editing={editing}
          className="board-shape__text"
          onInput={(t) => onText(item.id, t)}
          onDone={() => onDone(item.id)}
        />
      </div>
    </div>
  )
}

// ── Moldura ─────────────────────────────────────────────

function FrameView({ item, editing, onText, onDone }: ItemViewProps) {
  return (
    <div className={`board-frame${item.locked ? ' is-locked' : ''}`} style={{ ...box(item), '--c': item.data.color ?? '#ffc174' } as CSSProperties}>
      <div className="board-frame__title" data-board-id={item.id}>
        <EditableText
          value={item.data.title ?? ''}
          editing={editing}
          className="board-frame__title-text"
          placeholder="Moldura"
          onInput={(t) => onText(item.id, t)}
          onDone={() => onDone(item.id)}
        />
      </div>
    </div>
  )
}

// ── Imagem e arquivo (da Biblioteca) ────────────────────

function ImageView({ item, imageUrl }: ItemViewProps) {
  return (
    <div className={`board-item board-image${item.locked ? ' is-locked' : ''}`} data-board-id={item.id} style={box(item)}>
      {imageUrl
        ? <img src={imageUrl} alt={item.data.name ?? ''} draggable={false} />
        : <span className="board-image__missing">{imageUrl === null ? 'Imagem indisponível' : 'Carregando…'}</span>}
    </div>
  )
}

function FileView({ item }: ItemViewProps) {
  const ext = item.data.mime === 'application/pdf' ? 'PDF' : item.data.mime === 'text/markdown' ? 'MD' : 'TXT'
  return (
    <div className={`board-item board-file${item.locked ? ' is-locked' : ''}`} data-board-id={item.id} style={box(item)}>
      <span className="board-file__icon" aria-hidden="true">{ext}</span>
      <span className="board-file__info">
        <span className="board-file__name">{item.data.name ?? 'Arquivo'}</span>
        <span className="board-file__meta">Biblioteca · clique duas vezes pra abrir</span>
      </span>
    </div>
  )
}

// ── Desenho à mão ───────────────────────────────────────

export function strokePath(points: number[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) return `M ${points[0]} ${points[1]} l 0.01 0`
  let d = `M ${points[0]} ${points[1]}`
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (points[i] + points[i + 2]) / 2
    const my = (points[i + 1] + points[i + 3]) / 2
    d += ` Q ${points[i]} ${points[i + 1]} ${mx} ${my}`
  }
  d += ` L ${points[points.length - 2]} ${points[points.length - 1]}`
  return d
}

function DrawingView({ item }: ItemViewProps) {
  const bw = Math.max(item.data.bw ?? item.w, 1)
  const bh = Math.max(item.data.bh ?? item.h, 1)
  const sx = item.w / bw, sy = item.h / bh
  return (
    <div className={`board-item board-drawing${item.locked ? ' is-locked' : ''}`} data-board-id={item.id} style={box(item)}>
      <svg width={item.w} height={item.h} viewBox={`0 0 ${item.w || 1} ${item.h || 1}`} aria-hidden="true">
        <path
          d={strokePath((item.data.points ?? []).map((v, i) => (i % 2 === 0 ? v * sx : v * sy)))}
          fill="none"
          stroke={inkColor(item.data.color)}
          strokeWidth={item.data.width ?? 4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

// ── Linha do tempo ──────────────────────────────────────

function TimelineView({ item }: ItemViewProps) {
  const events = item.data.events ?? []
  const pad = 60
  const step = events.length > 1 ? (item.w - pad * 2) / (events.length - 1) : 0
  const labelW = Math.max(90, Math.min(240, events.length > 1 ? step * 0.92 : item.w - pad))
  return (
    <div className={`board-item board-timeline${item.locked ? ' is-locked' : ''}`} data-board-id={item.id} style={{ ...box(item), '--c': inkColor(item.data.color) } as CSSProperties}>
      <div className="board-timeline__line" />
      {events.length === 0 && <span className="board-timeline__empty">Clique duas vezes pra adicionar eventos</span>}
      {events.map((ev, i) => (
        <div
          key={ev.id}
          className={`board-timeline__event board-timeline__event--${i % 2 === 0 ? 'up' : 'down'}`}
          style={{ left: events.length > 1 ? pad + step * i : item.w / 2, width: labelW }}
        >
          <span className="board-timeline__dot" />
          <span className="board-timeline__label">
            {ev.when && <span className="board-timeline__when">{ev.when}</span>}
            <span className="board-timeline__title">{ev.title || '—'}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Setas (todas numa camada SVG) ───────────────────────

function arrowHead(tip: Point, from: Point, size: number): string {
  const ang = Math.atan2(tip.y - from.y, tip.x - from.x)
  const a1 = ang + Math.PI - 0.45, a2 = ang + Math.PI + 0.45
  return `${tip.x},${tip.y} ${tip.x + size * Math.cos(a1)},${tip.y + size * Math.sin(a1)} ${tip.x + size * Math.cos(a2)},${tip.y + size * Math.sin(a2)}`
}

interface ConnectorsProps {
  connectors: BoardItem[]
  items:      Record<string, BoardItem>
  selected:   Set<string>
}

export const ConnectorLayer = memo(function ConnectorLayer({ connectors, items, selected }: ConnectorsProps) {
  return (
    <svg className="board-connectors" aria-hidden="true">
      {connectors.map((c) => {
        const { a, b } = connectorEnds(c, items)
        const color = inkColor(c.data.color)
        const arrow = c.data.arrow ?? 'end'
        const size = 14
        return (
          <g key={c.id} className={`board-connector${selected.has(c.id) ? ' is-selected' : ''}${c.locked ? ' is-locked' : ''}`}>
            <line className="board-connector__glow" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={color}
              strokeWidth={2.5}
              strokeDasharray={c.data.dashed ? '10 8' : undefined}
              strokeLinecap="round"
            />
            {(arrow === 'end' || arrow === 'both') && <polygon points={arrowHead(b, a, size)} fill={color} />}
            {arrow === 'both' && <polygon points={arrowHead(a, b, size)} fill={color} />}
            <line className="board-connector__hit" data-board-id={c.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          </g>
        )
      })}
    </svg>
  )
})

/** Legenda no meio da seta (editável com duplo clique). */
export function ConnectorLabel({ item, items, editing, onText, onDone }: ItemViewProps & { items: Record<string, BoardItem> }) {
  const text = item.data.text ?? ''
  if (!text && !editing) return null
  const { a, b } = connectorEnds(item, items)
  return (
    <div
      className="board-connector-label"
      data-board-id={item.id}
      style={{ left: (a.x + b.x) / 2, top: (a.y + b.y) / 2, color: inkColor(item.data.color) }}
    >
      <EditableText value={text} editing={editing} onInput={(t) => onText(item.id, t)} onDone={() => onDone(item.id)} />
    </div>
  )
}
