import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ModalOverlay } from '../../../shared/components/ModalOverlay'
import {
  documentKind, getThumbUrls, listCampaignDocuments, DOCUMENT_ACCEPT, type CampaignDocument,
} from '../../library/services/campaignDocumentsService'
import { listMesaArts, type MesaArt } from '../../mesa/services/mesaImagesService'
import type { BoardItem, ShapeType, TimelineEvent } from '../services/boardService'
import {
  INK_COLORS, NOTE_COLORS, OUTLINE, SHAPE_COLORS, SHAPE_LABEL, curvePoints, inkColor, newId,
} from '../boardGeometry'
import { ALIGN_KINDS, FONT_KINDS, alignOf, fontStack, type TextAlign } from '../boardFonts'

// ────────────────────────────────────────────────────────
// Peças em volta do Quadro: barra de ferramentas, zoom, barra da seleção,
// editor da linha do tempo, escolha da Biblioteca, imagem ampliada e ajuda.
// ────────────────────────────────────────────────────────

export type Tool = 'select' | 'hand' | 'note' | 'text' | 'shape' | 'connector' | 'pen' | 'frame' | 'timeline'

export interface PenSettings { color: string; width: number }

// ── Ícones ──────────────────────────────────────────────

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const Icons = {
  select:    <Icon><path d="M5 3l14 8-6.5 1.5L9 19z" /></Icon>,
  hand:      <Icon><path d="M8 13V5.5a1.5 1.5 0 013 0V12" /><path d="M11 11.5V4a1.5 1.5 0 013 0v7.5" /><path d="M14 11.5V6a1.5 1.5 0 013 0v8a6 6 0 01-6 6h-.5a6 6 0 01-4.9-2.6L3.8 14a1.6 1.6 0 012.6-1.8L8 14" /></Icon>,
  note:      <Icon><path d="M4 4h16v11l-5 5H4z" /><path d="M15 20v-5h5" /></Icon>,
  text:      <Icon><path d="M5 6V4h14v2" /><path d="M12 4v16" /><path d="M9 20h6" /></Icon>,
  shape:     <Icon><rect x="3" y="11" width="9" height="9" rx="1.5" /><circle cx="16.5" cy="7.5" r="4.5" /></Icon>,
  connector: <Icon><path d="M5 19L19 5" /><path d="M11 5h8v8" /></Icon>,
  pen:       <Icon><path d="M4 20c3-1 4-5 7-6s4 3 7 1" /><path d="M16 4l4 4-8 8-5 1 1-5z" /></Icon>,
  frame:     <Icon><path d="M7 3v18M17 3v18M3 7h18M3 17h18" /></Icon>,
  timeline:  <Icon><path d="M3 12h18" /><circle cx="6" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="18" cy="12" r="2" /><path d="M6 10V6M12 14v4M18 10V6" /></Icon>,
  upload:    <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></Icon>,
  library:   <Icon><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="M16 5l3.5-1 2.5 15.5-3.5 1z" /></Icon>,
  undo:      <Icon><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 010 10h-3" /></Icon>,
  redo:      <Icon><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 000 10h3" /></Icon>,
  front:     <Icon size={18}><rect x="8" y="8" width="12" height="12" rx="1.5" fill="currentColor" fillOpacity=".35" /><path d="M4 16V5a1 1 0 011-1h11" /></Icon>,
  back:      <Icon size={18}><rect x="4" y="4" width="12" height="12" rx="1.5" /><path d="M20 8v11a1 1 0 01-1 1H8" /></Icon>,
  copy:      <Icon size={18}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" /></Icon>,
  lock:      <Icon size={18}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Icon>,
  unlock:    <Icon size={18}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 017.5-2" /></Icon>,
  trash:     <Icon size={18}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Icon>,
  expand:    <Icon size={18}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>,
  shrink:    <Icon size={18}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Icon>,
  fit:       <Icon size={18}><rect x="6" y="6" width="12" height="12" rx="1" /><path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" /></Icon>,
  open:      <Icon size={18}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></Icon>,
  zoomImg:   <Icon size={18}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M11 8v6M8 11h6" /></Icon>,
  edit:      <Icon size={18}><path d="M4 20h4L19 9l-4-4L4 16z" /></Icon>,
  align_left:   <Icon size={18}><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></Icon>,
  align_center: <Icon size={18}><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></Icon>,
  align_right:  <Icon size={18}><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></Icon>,
  arts:      <Icon><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M3 14l5-5 4 4 3-3 6 6" /><circle cx="16" cy="8.5" r="1.5" /><path d="M8 21h8" /></Icon>,
  elbow:     <Icon size={18}><path d="M6 4v6h12v10" /><circle cx="6" cy="4" r="1.5" fill="currentColor" /><circle cx="18" cy="20" r="1.5" fill="currentColor" /></Icon>,
  sharp:     <Icon size={18}><path d="M4 18l6-10 5 7 5-9" /></Icon>,
  round:     <Icon size={18}><path d="M4 18c2-6 4-10 6-10s3 7 5 7 3-6 5-9" /></Icon>,
  curve:     <Icon size={18}><path d="M4 18C6 8 14 4 20 6" /><path d="M16 3.5l4 2.5-2.5 4" /></Icon>,
  help:      <Icon size={18}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5" /><path d="M12 17h.01" /></Icon>,
}

const SHAPE_ICON: Record<ShapeType, ReactNode> = {
  rect:     <Icon size={18}><rect x="4" y="6" width="16" height="12" rx="2" /></Icon>,
  ellipse:  <Icon size={18}><ellipse cx="12" cy="12" rx="8" ry="6" /></Icon>,
  diamond:  <Icon size={18}><path d="M12 3l9 9-9 9-9-9z" /></Icon>,
  triangle: <Icon size={18}><path d="M12 4l9 16H3z" /></Icon>,
}

// ── Barra de ferramentas ────────────────────────────────

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select',    label: 'Selecionar',    key: 'V' },
  { id: 'hand',      label: 'Mover o quadro', key: 'H' },
  { id: 'note',      label: 'Post-it',       key: 'N' },
  { id: 'text',      label: 'Texto',         key: 'T' },
  { id: 'shape',     label: 'Forma',         key: 'S' },
  { id: 'connector', label: 'Seta',          key: 'L' },
  { id: 'pen',       label: 'Caneta',        key: 'P' },
  { id: 'frame',     label: 'Moldura',       key: 'F' },
  { id: 'timeline',  label: 'Linha do tempo', key: 'Y' },
]

interface ToolbarProps {
  tool:      Tool
  onTool:    (t: Tool) => void
  shape:     ShapeType
  onShape:   (s: ShapeType) => void
  noteColor: string
  onNoteColor: (c: string) => void
  pen:       PenSettings
  onPen:     (p: PenSettings) => void
  onUpload:  () => void
  onLibrary: () => void
  /** Abre as artes e referências da campanha (aba Mesa). */
  onArts:    () => void
  canUndo:   boolean
  canRedo:   boolean
  onUndo:    () => void
  onRedo:    () => void
}

export function BoardToolbar(p: ToolbarProps) {
  return (
    <div className="board-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <div className="board-toolbar__group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`board-tool${p.tool === t.id ? ' is-on' : ''}`}
            onClick={() => p.onTool(t.id)}
            title={`${t.label} (${t.key})`}
            aria-label={t.label}
            aria-pressed={p.tool === t.id}
          >
            {Icons[t.id]}
          </button>
        ))}
        <span className="board-toolbar__sep" />
        <button type="button" className="board-tool" onClick={p.onUpload} title="Foto ou arquivo do computador (fotos vão pra Galeria; PDFs e textos, pra Biblioteca)" aria-label="Enviar imagem ou arquivo">
          {Icons.upload}
        </button>
        <button type="button" className="board-tool" onClick={p.onLibrary} title="Da Biblioteca da campanha (B)" aria-label="Da Biblioteca">
          {Icons.library}
        </button>
        <button type="button" className="board-tool" onClick={p.onArts} title="Artes e referências (G)" aria-label="Artes e referências">
          {Icons.arts}
        </button>
      </div>
      <div className="board-toolbar__group">
        <button type="button" className="board-tool" onClick={p.onUndo} disabled={!p.canUndo} title="Desfazer (Ctrl+Z)" aria-label="Desfazer">{Icons.undo}</button>
        <button type="button" className="board-tool" onClick={p.onRedo} disabled={!p.canRedo} title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer">{Icons.redo}</button>
      </div>

      {p.tool === 'shape' && (
        <div className="board-flyout" style={{ top: 4 + 38 * 4 }}>
          {(Object.keys(SHAPE_LABEL) as ShapeType[]).map((s) => (
            <button key={s} type="button" className={`board-tool board-tool--sm${p.shape === s ? ' is-on' : ''}`} onClick={() => p.onShape(s)} title={SHAPE_LABEL[s]} aria-label={SHAPE_LABEL[s]}>
              {SHAPE_ICON[s]}
            </button>
          ))}
        </div>
      )}
      {p.tool === 'note' && (
        <div className="board-flyout board-flyout--swatches" style={{ top: 4 + 38 * 2 }}>
          {NOTE_COLORS.map((c) => (
            <button key={c} type="button" className={`board-swatch${p.noteColor === c ? ' is-on' : ''}`} style={{ background: c }} onClick={() => p.onNoteColor(c)} aria-label="Cor do post-it" />
          ))}
        </div>
      )}
      {p.tool === 'pen' && (
        <div className="board-flyout board-flyout--swatches" style={{ top: 4 + 38 * 6 }}>
          {INK_COLORS.map((c) => (
            <button key={c} type="button" className={`board-swatch${p.pen.color === c ? ' is-on' : ''}`} style={{ background: inkColor(c) }} onClick={() => p.onPen({ ...p.pen, color: c })} aria-label="Cor da caneta" />
          ))}
          <span className="board-flyout__sep" />
          {[2, 4, 8, 16].map((w) => (
            <button key={w} type="button" className={`board-tool board-tool--sm${p.pen.width === w ? ' is-on' : ''}`} onClick={() => p.onPen({ ...p.pen, width: w })} title={`Espessura ${w}`} aria-label={`Espessura ${w}`}>
              <span className="board-pen-dot" style={{ width: Math.min(w + 2, 16), height: Math.min(w + 2, 16) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Zoom ────────────────────────────────────────────────

interface ZoomBarProps {
  zoom:     number
  frames:   BoardItem[]
  onZoom:   (factor: number) => void
  onReset:  () => void
  onFit:    () => void
  onFrame:  (id: string) => void
}

export function BoardZoomBar({ zoom, frames, onZoom, onReset, onFit, onFrame }: ZoomBarProps) {
  const [framesOpen, setFramesOpen] = useState(false)
  return (
    <div className="board-zoombar" onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className="board-tool board-tool--sm" onClick={() => onZoom(1 / 1.25)} aria-label="Diminuir zoom" title="Diminuir (−)">−</button>
      <button type="button" className="board-zoombar__pct" onClick={onReset} title="Voltar a 100%">{Math.round(zoom * 100)}%</button>
      <button type="button" className="board-tool board-tool--sm" onClick={() => onZoom(1.25)} aria-label="Aumentar zoom" title="Aumentar (+)">+</button>
      <button type="button" className="board-tool board-tool--sm" onClick={onFit} aria-label="Ver tudo" title="Ver tudo (Shift+1)">{Icons.fit}</button>
      {frames.length > 0 && (
        <div className="board-zoombar__frames">
          <button type="button" className="board-zoombar__pct" onClick={() => setFramesOpen((v) => !v)} aria-expanded={framesOpen}>
            Molduras ▾
          </button>
          {framesOpen && (
            <div className="board-menu" role="menu">
              {frames.map((f) => (
                <button key={f.id} type="button" role="menuitem" className="board-menu__item" onClick={() => { onFrame(f.id); setFramesOpen(false) }}>
                  <span className="board-menu__dot" style={{ background: f.data.color }} />
                  {f.data.title || 'Moldura'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Barra da seleção ────────────────────────────────────

const ALIGN_LABEL: Record<TextAlign, string> = { left: 'Alinhar à esquerda', center: 'Centralizar', right: 'Alinhar à direita' }

export interface ContextActions {
  onColor:      (color: string) => void
  onShape:      (shape: ShapeType) => void
  onTextSize:   (dir: 1 | -1) => void
  /** Alinha o texto: esquerda, centro ou direita. */
  onAlign:      (align: TextAlign) => void
  /** Abre/fecha a galeria de fontes. */
  onFonts:      () => void
  onArrow:      () => void
  onDashed:     () => void
  /** Seta reta ⇄ curva. */
  onCurve:      () => void
  /** Linha com pontos: cantos retos ⇄ arredondados. */
  onSharp:      () => void
  /** Linha em degrau (árvore genealógica) liga/desliga. */
  onElbow:      () => void
  onFront:      () => void
  onBack:       () => void
  onDuplicate:  () => void
  onLock:       () => void
  onDelete:     () => void
  onTimeline:   () => void
  onOpenLibrary: () => void
  onZoomImage:  () => void
}

interface ContextBarProps extends ContextActions {
  items:    BoardItem[]
  /** Texto do botão que abre o original ("Abrir na Galeria"/"…na Biblioteca"); null = sem botão. */
  openLabel: string | null
  left:     number
  top:      number
  isMaster: boolean
  /** A galeria de fontes está aberta. */
  fontsOpen: boolean
}

export function BoardContextBar({ items, left, top, isMaster, openLabel, fontsOpen, ...a }: ContextBarProps) {
  const [palette, setPalette] = useState(false)
  if (items.length === 0) return null
  const first = items[0]
  const kinds = new Set(items.map((i) => i.kind))
  const only = kinds.size === 1 ? first.kind : null
  const allLocked = items.every((i) => i.locked)
  const anyLocked = items.some((i) => i.locked)

  if (allLocked) {
    return (
      <div className="board-context" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
        <span className="board-context__note">{Icons.lock} Trancado pelo mestre</span>
        {isMaster && <button type="button" className="board-context__btn" onClick={a.onLock} title="Destrancar">{Icons.unlock}</button>}
      </div>
    )
  }

  const colors = only === 'note' ? NOTE_COLORS
    : only === 'shape' ? SHAPE_COLORS
    : only && ['text', 'connector', 'drawing', 'timeline', 'frame'].includes(only) ? INK_COLORS
    : null
  const current = first.data.color
  const fontable = items.every((i) => FONT_KINDS.has(i.kind))
  const alignable = items.every((i) => ALIGN_KINDS.has(i.kind))
  const align = alignOf(first.kind, first.data.align)

  return (
    <div className="board-context" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
      {colors && (
        <div className="board-context__palette">
          <button
            type="button"
            className="board-context__btn"
            onClick={() => setPalette((v) => !v)}
            title="Cor"
            aria-label="Cor"
            aria-expanded={palette}
          >
            <span className={`board-swatch board-swatch--sm${current === OUTLINE ? ' board-swatch--outline' : ''}`} style={{ background: current === OUTLINE ? 'transparent' : inkColor(current) }} />
          </button>
          {palette && (
            <div className="board-context__swatches">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`board-swatch${current === c ? ' is-on' : ''}${c === OUTLINE ? ' board-swatch--outline' : ''}`}
                  style={{ background: c === OUTLINE ? 'transparent' : inkColor(c) }}
                  onClick={() => { a.onColor(c); setPalette(false) }}
                  aria-label={c === OUTLINE ? 'Só contorno' : 'Cor'}
                  title={c === OUTLINE ? 'Só contorno' : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {fontable && (
        <button
          type="button"
          className={`board-context__btn board-context__font${fontsOpen ? ' is-on' : ''}`}
          onClick={() => { setPalette(false); a.onFonts() }}
          title={first.data.font ? `Fonte: ${first.data.font}` : 'Fonte'}
          aria-label="Fonte"
          aria-expanded={fontsOpen}
        >
          <span style={{ fontFamily: fontStack(first.data.font) }}>Aa</span>
        </button>
      )}

      {only === 'shape' && (Object.keys(SHAPE_LABEL) as ShapeType[]).map((s) => (
        <button key={s} type="button" className={`board-context__btn${first.data.shape === s ? ' is-on' : ''}`} onClick={() => a.onShape(s)} title={SHAPE_LABEL[s]} aria-label={SHAPE_LABEL[s]}>
          {SHAPE_ICON[s]}
        </button>
      ))}

      {alignable && (
        <span className="board-context__group" role="group" aria-label="Alinhamento do texto">
          {(['left', 'center', 'right'] as const).map((al) => (
            <button
              key={al}
              type="button"
              className={`board-context__btn${align === al ? ' is-on' : ''}`}
              onClick={() => a.onAlign(al)}
              title={ALIGN_LABEL[al]}
              aria-label={ALIGN_LABEL[al]}
              aria-pressed={align === al}
            >
              {Icons[`align_${al}`]}
            </button>
          ))}
        </span>
      )}

      {only === 'text' && (
        <>
          <button type="button" className="board-context__btn" onClick={() => a.onTextSize(-1)} title="Letra menor" aria-label="Letra menor">A−</button>
          <span className="board-context__value">{first.data.size ?? 24}</span>
          <button type="button" className="board-context__btn" onClick={() => a.onTextSize(1)} title="Letra maior" aria-label="Letra maior">A+</button>
        </>
      )}

      {only === 'connector' && (
        <>
          <button type="button" className="board-context__btn" onClick={a.onArrow} title="Pontas da seta" aria-label="Pontas da seta">
            {first.data.arrow === 'both' ? '↔' : first.data.arrow === 'none' ? '—' : '→'}
          </button>
          <button type="button" className={`board-context__btn${first.data.dashed ? ' is-on' : ''}`} onClick={a.onDashed} title="Tracejada" aria-label="Tracejada">┄</button>
          <button
            type="button"
            className={`board-context__btn${items.some((i) => curvePoints(i).length > 0) ? ' is-on' : ''}`}
            onClick={a.onCurve}
            title={items.some((i) => curvePoints(i).length > 0) ? 'Deixar reta' : 'Curvar (ou arraste as bolinhas da seta)'}
            aria-label="Curvar a seta"
          >
            {Icons.curve}
          </button>
          <button
            type="button"
            className={`board-context__btn${items.some((i) => i.data.elbow && curvePoints(i).length === 0) ? ' is-on' : ''}`}
            onClick={a.onElbow}
            title={items.some((i) => i.data.elbow && curvePoints(i).length === 0) ? 'Deixar reta' : 'Em degrau (árvore genealógica)'}
            aria-label="Linha em degrau"
          >
            {Icons.elbow}
          </button>
          {items.some((i) => curvePoints(i).length > 0) && (
            <button
              type="button"
              className={`board-context__btn${items.some((i) => i.data.sharp) ? ' is-on' : ''}`}
              onClick={a.onSharp}
              title={items.some((i) => i.data.sharp) ? 'Arredondar os cantos' : 'Cantos retos'}
              aria-label={items.some((i) => i.data.sharp) ? 'Arredondar os cantos' : 'Cantos retos'}
            >
              {items.some((i) => i.data.sharp) ? Icons.round : Icons.sharp}
            </button>
          )}
        </>
      )}

      {only === 'timeline' && items.length === 1 && (
        <button type="button" className="board-context__btn board-context__btn--text" onClick={a.onTimeline}>{Icons.edit} Eventos</button>
      )}

      {only === 'image' && items.length === 1 && (
        <button type="button" className="board-context__btn" onClick={a.onZoomImage} title="Ampliar" aria-label="Ampliar">{Icons.zoomImg}</button>
      )}
      {(only === 'image' || only === 'file') && items.length === 1 && openLabel && (
        <button type="button" className="board-context__btn" onClick={a.onOpenLibrary} title={openLabel} aria-label={openLabel}>{Icons.open}</button>
      )}

      <span className="board-context__sep" />
      <button type="button" className="board-context__btn" onClick={a.onFront} title="Trazer pra frente" aria-label="Trazer pra frente">{Icons.front}</button>
      <button type="button" className="board-context__btn" onClick={a.onBack} title="Mandar pra trás" aria-label="Mandar pra trás">{Icons.back}</button>
      <button type="button" className="board-context__btn" onClick={a.onDuplicate} title="Duplicar (Ctrl+D)" aria-label="Duplicar">{Icons.copy}</button>
      {isMaster && (
        <button type="button" className={`board-context__btn${anyLocked ? ' is-on' : ''}`} onClick={a.onLock} title="Trancar (só o mestre mexe)" aria-label="Trancar">{Icons.lock}</button>
      )}
      <button type="button" className="board-context__btn board-context__btn--danger" onClick={a.onDelete} title="Apagar (Delete)" aria-label="Apagar">{Icons.trash}</button>
    </div>
  )
}

// ── Linha do tempo: editor de eventos ───────────────────

export function TimelineEditor({ events, onSave, onClose }: { events: TimelineEvent[]; onSave: (e: TimelineEvent[]) => void; onClose: () => void }) {
  const [list, setList] = useState<TimelineEvent[]>(() => events.map((e) => ({ ...e })))
  const lastInput = useRef<HTMLInputElement>(null)
  const [focusNew, setFocusNew] = useState(false)
  useEffect(() => { if (focusNew) { lastInput.current?.focus(); setFocusNew(false) } }, [focusNew])

  const set = (i: number, patch: Partial<TimelineEvent>) => setList((l) => l.map((e, j) => (j === i ? { ...e, ...patch } : e)))
  const move = (i: number, d: -1 | 1) => setList((l) => {
    const j = i + d
    if (j < 0 || j >= l.length) return l
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n
  })

  return (
    <ModalOverlay onClose={onClose}>
      <div className="board-modal" role="dialog" aria-modal="true" aria-labelledby="board-tl-title">
        <header className="board-modal__head">
          <h3 id="board-tl-title" className="board-modal__title">Linha do tempo</h3>
          <button type="button" className="board-modal__close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="board-modal__body">
          <p className="board-modal__hint">Da esquerda pra direita. "Quando" é livre: um ano, uma sessão, "antes da guerra"…</p>
          <ol className="board-tl-list">
            {list.map((ev, i) => (
              <li key={ev.id} className="board-tl-row">
                <span className="board-tl-row__n">{i + 1}</span>
                <input className="input board-tl-row__when" value={ev.when} maxLength={40} placeholder="Quando" onChange={(e) => set(i, { when: e.target.value })} />
                <input
                  ref={i === list.length - 1 ? lastInput : undefined}
                  className="input board-tl-row__title" value={ev.title} maxLength={120} placeholder="O que aconteceu"
                  onChange={(e) => set(i, { title: e.target.value })}
                />
                <button type="button" className="board-context__btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mover pra esquerda">←</button>
                <button type="button" className="board-context__btn" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Mover pra direita">→</button>
                <button type="button" className="board-context__btn board-context__btn--danger" onClick={() => setList((l) => l.filter((_, j) => j !== i))} aria-label="Remover">✕</button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => { setList((l) => [...l, { id: newId(), when: '', title: '' }]); setFocusNew(true) }}
            disabled={list.length >= 40}
          >
            + Evento
          </button>
        </div>
        <footer className="board-modal__foot">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(list)}>Salvar</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}

// ── Escolher da Biblioteca ──────────────────────────────

interface LibraryPickerProps {
  campaignId: string
  onPick:     (doc: CampaignDocument) => void
  onUpload:   () => void
  onClose:    () => void
}

export function LibraryPicker({ campaignId, onPick, onUpload, onClose }: LibraryPickerProps) {
  const [docs, setDocs] = useState<CampaignDocument[] | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listCampaignDocuments(campaignId)
      .then(async (list) => {
        if (!alive) return
        setDocs(list)
        const t = await getThumbUrls(list).catch(() => new Map<string, string>())
        if (alive) setThumbs(t)
      })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Não foi possível carregar a biblioteca.') })
    return () => { alive = false }
  }, [campaignId])

  return (
    <ModalOverlay onClose={onClose}>
      <div className="board-modal board-modal--wide" role="dialog" aria-modal="true" aria-labelledby="board-lib-title">
        <header className="board-modal__head">
          <h3 id="board-lib-title" className="board-modal__title">Da Biblioteca</h3>
          <button type="button" className="board-modal__close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="board-modal__body">
          {error && <p className="board-modal__error" role="alert">{error}</p>}
          {!docs && !error && <div className="board-modal__loading"><div className="spinner spinner--sm" /></div>}
          {docs && docs.length === 0 && <p className="board-modal__hint">A estante desta campanha ainda está vazia.</p>}
          {docs && docs.length > 0 && (
            <div className="board-lib-grid">
              {docs.map((d) => {
                const kind = documentKind(d)
                return (
                  <button key={d.id} type="button" className="board-lib-card" onClick={() => onPick(d)} title={d.name}>
                    <span className="board-lib-card__thumb">
                      {kind === 'image' && thumbs.get(d.path)
                        ? <img src={thumbs.get(d.path)} alt="" loading="lazy" />
                        : <span className="board-file__icon">{kind === 'pdf' ? 'PDF' : kind === 'image' ? 'IMG' : 'TXT'}</span>}
                    </span>
                    <span className="board-lib-card__name">{d.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <footer className="board-modal__foot">
          <span className="board-modal__hint">Clique pra colocar no quadro.</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onUpload}>Enviar do computador</button>
        </footer>
      </div>
    </ModalOverlay>
  )
}

// ── Escolher das Artes e referências ────────────────────

interface ArtsPickerProps {
  campaignId: string
  onPick:     (art: MesaArt) => void
  onClose:    () => void
}

/** As artes e referências da aba Mesa (de todos da campanha): clicar põe no quadro. */
export function ArtsPicker({ campaignId, onPick, onClose }: ArtsPickerProps) {
  const [arts, setArts] = useState<MesaArt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listMesaArts(campaignId)
      .then((list) => { if (alive) setArts(list) })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Não foi possível carregar as artes e referências.') })
    return () => { alive = false }
  }, [campaignId])

  return (
    <ModalOverlay onClose={onClose}>
      <div className="board-modal board-modal--wide" role="dialog" aria-modal="true" aria-labelledby="board-arts-title">
        <header className="board-modal__head">
          <h3 id="board-arts-title" className="board-modal__title">Artes e referências</h3>
          <button type="button" className="board-modal__close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="board-modal__body">
          {error && <p className="board-modal__error" role="alert">{error}</p>}
          {!arts && !error && <div className="board-modal__loading"><div className="spinner spinner--sm" /></div>}
          {arts && arts.length === 0 && (
            <p className="board-modal__hint">Ainda não há artes nem referências. Envie imagens na aba Mesa da Sessão.</p>
          )}
          {arts && arts.length > 0 && (
            <div className="board-lib-grid">
              {arts.map((a) => (
                <button key={a.id} type="button" className="board-lib-card" onClick={() => onPick(a)} title={a.name}>
                  <span className="board-lib-card__thumb">
                    {a.url ? <img src={a.url} alt="" loading="lazy" /> : <span className="board-file__icon">IMG</span>}
                  </span>
                  <span className="board-lib-card__name">{a.name}</span>
                  {a.uploader_name && <span className="board-lib-card__by">por {a.uploader_name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <footer className="board-modal__foot">
          <span className="board-modal__hint">Clique pra colocar no quadro. As artes são enviadas na aba Mesa da Sessão.</span>
        </footer>
      </div>
    </ModalOverlay>
  )
}

// ── Imagem ampliada ─────────────────────────────────────

export function ImageLightbox({ url, name, openLabel, onOpenLibrary, onClose }: { url: string; name: string; openLabel: string | null; onOpenLibrary: () => void; onClose: () => void }) {
  return (
    <ModalOverlay onClose={onClose}>
      <figure className="board-lightbox" role="dialog" aria-modal="true" aria-label={name}>
        <img src={url} alt={name} />
        <figcaption className="board-lightbox__bar">
          <span>{name}</span>
          {openLabel && <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenLibrary}>{openLabel}</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Fechar</button>
        </figcaption>
      </figure>
    </ModalOverlay>
  )
}

// ── Atalhos ─────────────────────────────────────────────

const SHORTCUTS: [string, string][] = [
  ['Arrastar o quadro', 'Espaço + arrastar, botão do meio, ferramenta Mão ou dois dedos'],
  ['Zoom', 'Roda do mouse ou pinça; Ctrl + roda no trackpad'],
  ['Selecionar vários', 'Shift + clique, ou arrastar uma área'],
  ['Editar texto', 'Duplo clique (Esc termina)'],
  ['Ferramentas', 'V selecionar · H mão · N post-it · T texto · S forma · L seta · P caneta · F moldura · Y linha do tempo · B biblioteca · G artes e referências'],
  ['Desfazer / refazer', 'Ctrl+Z · Ctrl+Shift+Z'],
  ['Copiar, colar, duplicar', 'Ctrl+C · Ctrl+V · Ctrl+D'],
  ['Apagar', 'Delete ou Backspace'],
  ['Trocar a fonte', 'Selecione post-it, texto, forma ou moldura e clique em Aa'],
  ['Linha com quinas', 'Ferramenta Seta (L): clique, clique de novo pra cada quina, e termine com duplo clique, Enter ou clicando num item'],
  ['Encaixar na grade', 'Segure Shift enquanto arrasta um item'],
  ['Ligar dois itens', 'Selecione o item e arraste uma bolinha azul até o outro — ou clique na bolinha e depois no outro item. A linha nasce em degrau (bom pra árvore genealógica)'],
  ['Curvar a seta', 'Selecione a seta e arraste as bolinhas vazias (cada uma vira um ponto novo); duplo clique num ponto tira ele'],
  ['Ajustar', 'Setas movem (Shift = 10×) · Shift+1 vê tudo · Shift+0 volta a 100%'],
  ['Fotos e arquivos', 'Arraste do computador ou cole (Ctrl+V). Fotos vão pra Galeria; PDFs e textos, pra Biblioteca'],
]

export function BoardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="board-help" role="dialog" aria-label="Atalhos do quadro" onPointerDown={(e) => e.stopPropagation()}>
      <div className="board-help__head">
        <strong>Atalhos</strong>
        <button type="button" className="board-modal__close" onClick={onClose} aria-label="Fechar">✕</button>
      </div>
      <dl>
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className="board-help__row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  )
}

/** Accept do <input type="file"> do quadro — o mesmo da Biblioteca. */
export const BOARD_ACCEPT = DOCUMENT_ACCEPT
