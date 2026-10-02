import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { boardFont } from '../../../shared/lib/googleFonts'
import { LINE_HEIGHTS } from './docHtml'
import { FontPicker } from './FontPicker'
import { FONT_SIZES, sizeAtCaret, type DocCommand, type PageEditorHandle } from './PageEditor'
import { INKS, inkOf, type DocStyle } from './paperStyles'

// ────────────────────────────────────────────────────────
// Barra de formatação das páginas (no jeito da "Página Inicial" do Word):
// desfazer/refazer · letra e tamanho (com A+ e A−) · negrito, itálico,
// sublinhado e tachado · tinta · alinhamento · listas · recuo ·
// espaçamento entre linhas · limpar formatação. Os botões não tiram o
// foco do texto, e acendem conforme o que está onde o cursor está.
// ────────────────────────────────────────────────────────

interface Active {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean
  align: 'left' | 'center' | 'right' | 'justify'
  ul: boolean; ol: boolean
  font: string | null; size: number | null; color: string; line: string
}
const NONE: Active = { bold: false, italic: false, underline: false, strike: false, align: 'left', ul: false, ol: false, font: null, size: null, color: '', line: 'default' }

function query(cmd: string): boolean {
  try { return document.queryCommandState(cmd) } catch { return false }
}
function normColor(c: string): string {
  const probe = document.createElement('span')
  probe.style.color = c
  return probe.style.color.replace(/\s/g, '')
}

const LINE_LABEL: Record<string, string> = { default: 'Padrão', 1: '1,0', '1.15': '1,15', '1.5': '1,5', 2: '2,0' }

interface Props {
  editor:  RefObject<PageEditorHandle>
  /** Estilo padrão da página (o que vale onde não tem formatação própria). */
  base:    DocStyle
  canUndo: boolean
  canRedo: boolean
  onUndo:  () => void
  onRedo:  () => void
}

export function DocToolbar({ editor, base, canUndo, canRedo, onUndo, onRedo }: Props) {
  const [active, setActive] = useState<Active>(NONE)
  const [menu, setMenu] = useState<'size' | 'ink' | 'line' | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // O que está ativo onde o cursor está.
  const refresh = useRef<() => void>(() => {})
  useEffect(() => {
    const update = () => {
      const el = editor.current?.element()
      const sel = window.getSelection()
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return
      const at = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode as Element : sel.anchorNode.parentElement!
      const cs = getComputedStyle(at)
      const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')
      const block = at.closest('div, p, li') as HTMLElement | null
      const align = query('justifyCenter') ? 'center' : query('justifyRight') ? 'right' : query('justifyFull') ? 'justify' : 'left'
      setActive({
        bold: query('bold'), italic: query('italic'), underline: query('underline'), strike: query('strikeThrough'),
        align, ul: query('insertUnorderedList'), ol: query('insertOrderedList'),
        font: boardFont(fam) ? fam : null,
        size: sizeAtCaret(el),
        color: cs.color.replace(/\s/g, ''),
        line: block && block !== el && block.style.lineHeight ? block.style.lineHeight : 'default',
      })
    }
    refresh.current = update
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [editor])

  // Menu aberto fecha com clique fora ou Esc (sem fechar o editor).
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(null) } }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true) }
  }, [menu])

  const run = (cmd: DocCommand, value?: string) => {
    editor.current?.format(cmd, value)
    setMenu(null)
    window.setTimeout(() => refresh.current(), 0)
  }

  const btn = (cmd: DocCommand, label: string, children: ReactNode, on = false, value?: string) => (
    <button
      type="button"
      className={`doc-tb__btn${on ? ' is-on' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(cmd, value)}
      aria-label={label}
      aria-pressed={on}
      title={label}
    >
      {children}
    </button>
  )
  const opener = (id: 'size' | 'ink' | 'line', label: string, children: ReactNode, wide = false) => (
    <button
      type="button"
      className={`doc-tb__btn${wide ? ' doc-tb__btn--wide' : ''}${menu === id ? ' is-on' : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => setMenu((m) => (m === id ? null : id))}
      aria-label={label}
      aria-expanded={menu === id}
      title={label}
    >
      {children}
    </button>
  )
  const size = active.size ?? base.size
  const inkNow = INKS.find((i) => normColor(i.color) === active.color)

  return (
    <div className="doc-tb" ref={box} role="toolbar" aria-label="Formatação do texto">
      <div className="doc-tb__group">
        <button type="button" className="doc-tb__btn" onMouseDown={(e) => e.preventDefault()} onClick={onUndo} disabled={!canUndo} aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)">
          <Svg><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>
        </button>
        <button type="button" className="doc-tb__btn" onMouseDown={(e) => e.preventDefault()} onClick={onRedo} disabled={!canRedo} aria-label="Refazer (Ctrl+Y)" title="Refazer (Ctrl+Y)">
          <Svg><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>
        </button>
      </div>

      <div className="doc-tb__group">
        <FontPicker
          compact
          label="Letra"
          current={active.font ?? base.font}
          defaultLabel={`Padrão da página (${base.font})`}
          onPick={(f) => run('fontName', f)}
        />
        <div className="doc-tb__menu">
          {opener('size', 'Tamanho da letra', <span className="doc-tb__size">{size}<Caret /></span>, true)}
          {menu === 'size' && (
            <div className="doc-tb__pop doc-tb__pop--list" role="listbox" aria-label="Tamanho da letra">
              {FONT_SIZES.map((n) => (
                <button key={n} type="button" role="option" aria-selected={n === size} className={`doc-tb__opt${n === size ? ' is-on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => run('fontSize', String(n))}>{n}</button>
              ))}
            </div>
          )}
        </div>
        {btn('grow', 'Aumentar a letra (Ctrl+])', <span className="doc-tb__aa">A<sup>+</sup></span>)}
        {btn('shrink', 'Diminuir a letra (Ctrl+[)', <span className="doc-tb__aa doc-tb__aa--small">A<sup>−</sup></span>)}
      </div>

      <div className="doc-tb__group">
        {btn('bold', 'Negrito (Ctrl+B)', <b>N</b>, active.bold)}
        {btn('italic', 'Itálico (Ctrl+I)', <i style={{ fontFamily: 'Georgia, serif' }}>I</i>, active.italic)}
        {btn('underline', 'Sublinhado (Ctrl+U)', <u>S</u>, active.underline)}
        {btn('strikeThrough', 'Tachado', <s>abc</s>, active.strike)}
        <div className="doc-tb__menu">
          {opener('ink', 'Cor da tinta', <span className="doc-tb__ink"><span className="doc-tb__ink-a">A</span><span className="doc-tb__ink-bar" style={{ background: inkNow?.color ?? inkOf(base.ink) }} /></span>)}
          {menu === 'ink' && (
            <div className="doc-tb__pop doc-tb__pop--inks" role="listbox" aria-label="Cor da tinta">
              <button type="button" className="doc-tb__opt doc-tb__opt--wide" onMouseDown={(e) => e.preventDefault()} onClick={() => run('foreColor', 'default')}>Tinta padrão da página</button>
              {INKS.map((ink) => (
                <button
                  key={ink.id}
                  type="button"
                  className={`doc-tb__swatch${inkNow?.id === ink.id ? ' is-on' : ''}`}
                  style={{ background: ink.color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => run('foreColor', ink.color)}
                  aria-label={`Tinta ${ink.label}`}
                  title={ink.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="doc-tb__group">
        {btn('justifyLeft', 'Alinhar à esquerda (Ctrl+L)', <Svg><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></Svg>, active.align === 'left')}
        {btn('justifyCenter', 'Centralizar (Ctrl+E)', <Svg><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></Svg>, active.align === 'center')}
        {btn('justifyRight', 'Alinhar à direita (Ctrl+R)', <Svg><path d="M4 6h16M10 10h10M4 14h16M10 18h10" /></Svg>, active.align === 'right')}
        {btn('justifyFull', 'Justificar (Ctrl+J)', <Svg><path d="M4 6h16M4 10h16M4 14h16M4 18h16" /></Svg>, active.align === 'justify')}
      </div>

      <div className="doc-tb__group">
        {btn('insertUnorderedList', 'Marcadores', <Svg><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></Svg>, active.ul)}
        {btn('insertOrderedList', 'Numeração', <Svg><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5l1.5-1V9M3.5 14.5a1.5 1.5 0 0 1 2.6 1L3.5 19h3" strokeWidth="1.6" /></Svg>, active.ol)}
        {btn('outdent', 'Diminuir recuo (Shift+Tab)', <Svg><path d="M11 6h9M11 12h9M11 18h9" /><path d="M7 9l-3 3 3 3" /></Svg>)}
        {btn('indent', 'Aumentar recuo (Tab)', <Svg><path d="M11 6h9M11 12h9M11 18h9" /><path d="M4 9l3 3-3 3" /></Svg>)}
        <div className="doc-tb__menu">
          {opener('line', 'Espaçamento entre linhas', <Svg><path d="M11 6h9M11 12h9M11 18h9" /><path d="M5 4v16M3 6l2-2 2 2M3 18l2 2 2-2" /></Svg>)}
          {menu === 'line' && (
            <div className="doc-tb__pop doc-tb__pop--list" role="listbox" aria-label="Espaçamento entre linhas">
              {['default', ...LINE_HEIGHTS].map((v) => (
                <button key={v} type="button" role="option" aria-selected={active.line === v} className={`doc-tb__opt${active.line === v ? ' is-on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => run('lineHeight', v)}>
                  {LINE_LABEL[v]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="doc-tb__group">
        {btn('removeFormat', 'Limpar formatação', <Svg><path d="M6 5h12M12 5l-4 14M4 20l16-16" /></Svg>)}
      </div>
    </div>
  )
}

function Svg({ children }: { children: ReactNode }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}
function Caret() {
  return <span className="doc-tb__caret" aria-hidden="true">▾</span>
}
