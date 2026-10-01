import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { FormatCommand, NoteEditorHandle } from './NoteEditor'
import {
  BOARD_FONTS, FONT_CATEGORIES, boardFont, fontStack, loadFontPreview, type FontCategory,
} from '../../../shared/lib/googleFonts'

// ────────────────────────────────────────────────────────
// Barra de formatação do caderno: fonte (a galeria do Google Fonts do
// site), negrito, itálico, sublinhado, tachado, cor da letra e marca-texto,
// tamanho, listas e limpar formatação. Os
// botões não roubam o foco da folha (mousedown sem efeito), então a
// formatação cai no trecho selecionado ou no que for digitado a seguir.
// Os botões acendem conforme o que está onde o cursor está.
// ────────────────────────────────────────────────────────

/** "default" = volta pra cor normal do texto / tira o marca-texto. */
export const TEXT_COLORS = ['default', '#ffc174', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#f472b6', '#94a3b8']
export const HIGHLIGHTS = ['default', 'rgba(250, 204, 21, 0.35)', 'rgba(74, 222, 128, 0.3)', 'rgba(96, 165, 250, 0.3)', 'rgba(244, 114, 182, 0.3)', 'rgba(251, 146, 60, 0.35)']
/** Tamanhos do execCommand (1–7) → nome. */
const SIZES: { value: string; label: string }[] = [
  { value: '2', label: 'Pequeno' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Grande' },
  { value: '6', label: 'Enorme' },
]

interface Active { bold: boolean; italic: boolean; underline: boolean; strike: boolean; ul: boolean; ol: boolean; size: string; font: string; color: string; hilite: string }
const NONE: Active = { bold: false, italic: false, underline: false, strike: false, ul: false, ol: false, size: '3', font: '', color: '', hilite: '' }

/** Cor no formato do navegador ("rgb(…)"), pra comparar com a do cursor. */
function normColor(c: string): string {
  const probe = document.createElement('span')
  probe.style.color = c
  return probe.style.color.replace(/\s/g, '')
}
function commandValue(cmd: string): string {
  try { return String(document.queryCommandValue(cmd) || '') } catch { return '' }
}

interface BtnProps { cmd: FormatCommand; on?: boolean; label: string; children: ReactNode; className?: string; run: (cmd: FormatCommand) => void }

/** Botão simples da barra (não tira o foco da folha). */
function Btn({ cmd, on, label, children, className, run }: BtnProps) {
  return (
    <button
      type="button"
      className={`note-fmt__btn${on ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => run(cmd)}
      aria-label={label}
      aria-pressed={on}
      title={label}
    >
      {children}
    </button>
  )
}

function query(cmd: string): boolean {
  try { return document.queryCommandState(cmd) } catch { return false }
}

export function NoteFormatBar({ editor }: { editor: RefObject<NoteEditorHandle> }) {
  const [active, setActive] = useState<Active>(NONE)
  const [menu, setMenu] = useState<'font' | 'color' | 'size' | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // O que está ativo onde o cursor está (e logo depois de cada clique na barra).
  const refresh = useRef<() => void>(() => {})
  useEffect(() => {
    const update = () => {
      const el = editor.current?.element()
      const sel = window.getSelection()
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return
      let size = '3', font = ''
      try { size = document.queryCommandValue('fontSize') || '3' } catch { /* padrão */ }
      try {
        const name = (document.queryCommandValue('fontName') || '').split(',')[0].trim().replace(/^["']|["']$/g, '')
        font = boardFont(name) ? name : ''
      } catch { /* padrão */ }
      setActive({
        bold: query('bold'), italic: query('italic'), underline: query('underline'), strike: query('strikeThrough'),
        ul: query('insertUnorderedList'), ol: query('insertOrderedList'), size, font,
        color: normColor(commandValue('foreColor')),
        hilite: normColor(commandValue('hiliteColor') || commandValue('backColor')),
      })
    }
    refresh.current = update
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [editor])

  // Menu aberto fecha com clique fora ou Esc (sem fechar o caderno).
  useEffect(() => {
    if (!menu) return
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(null) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMenu(null) } }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', esc, true)
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', esc, true) }
  }, [menu])

  const run = (cmd: FormatCommand, value?: string) => {
    editor.current?.format(cmd, value)
    setMenu(null)
    refresh.current()
  }
  /** Clicar de novo na opção que já está ativa desliga (volta ao normal). */
  const toggle = (cmd: FormatCommand, value: string, on: boolean, off = 'default') => run(cmd, on ? off : value)

  return (
    <div className="note-fmt" ref={box} role="toolbar" aria-label="Formatação">
      <div className="note-fmt__menu">
        <button
          type="button"
          className={`note-fmt__btn note-fmt__btn--wide${menu === 'font' ? ' is-on' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMenu((m) => (m === 'font' ? null : 'font'))}
          aria-label="Fonte"
          aria-expanded={menu === 'font'}
          title={active.font ? `Fonte: ${active.font}` : 'Fonte'}
        >
          <span className="note-fmt__font-aa" style={{ fontFamily: fontStack(active.font) }}>Aa</span> ▾
        </button>
        {menu === 'font' && (
          <NoteFontMenu current={active.font} onPick={(family) => run('fontName', !family || family === active.font ? 'default' : family)} />
        )}
      </div>
      <span className="note-fmt__sep" />

      <Btn run={run} cmd="bold" on={active.bold} label="Negrito (Ctrl+B)"><b>B</b></Btn>
      <Btn run={run} cmd="italic" on={active.italic} label="Itálico (Ctrl+I)"><i>I</i></Btn>
      <Btn run={run} cmd="underline" on={active.underline} label="Sublinhado (Ctrl+U)"><u>U</u></Btn>
      <Btn run={run} cmd="strikeThrough" on={active.strike} label="Tachado"><s>S</s></Btn>
      <span className="note-fmt__sep" />

      <div className="note-fmt__menu">
        <button
          type="button"
          className={`note-fmt__btn${menu === 'color' ? ' is-on' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMenu((m) => (m === 'color' ? null : 'color'))}
          aria-label="Cor da letra e marca-texto"
          aria-expanded={menu === 'color'}
          title="Cor da letra e marca-texto"
        >
          <span className="note-fmt__color-a">A</span>
        </button>
        {menu === 'color' && (
          <div className="note-fmt__pop" onMouseDown={(e) => e.preventDefault()}>
            <span className="note-fmt__pop-label">Cor da letra</span>
            <div className="note-fmt__swatches">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`note-fmt__swatch${c === 'default' ? ' note-fmt__swatch--default' : ''}${c !== 'default' && normColor(c) === active.color ? ' is-on' : ''}`}
                  style={c === 'default' ? undefined : { background: c }}
                  onClick={() => toggle('foreColor', c, c !== 'default' && normColor(c) === active.color)}
                  aria-label={c === 'default' ? 'Cor normal' : `Cor ${c}`}
                  title={c === 'default' ? 'Cor normal' : undefined}
                />
              ))}
            </div>
            <span className="note-fmt__pop-label">Marca-texto</span>
            <div className="note-fmt__swatches">
              {HIGHLIGHTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`note-fmt__swatch${c === 'default' ? ' note-fmt__swatch--default' : ''}${c !== 'default' && normColor(c) === active.hilite ? ' is-on' : ''}`}
                  style={c === 'default' ? undefined : { background: c }}
                  onClick={() => toggle('hiliteColor', c, c !== 'default' && normColor(c) === active.hilite)}
                  aria-label={c === 'default' ? 'Sem marca-texto' : 'Marca-texto'}
                  title={c === 'default' ? 'Sem marca-texto' : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="note-fmt__menu">
        <button
          type="button"
          className={`note-fmt__btn note-fmt__btn--wide${menu === 'size' ? ' is-on' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMenu((m) => (m === 'size' ? null : 'size'))}
          aria-label="Tamanho da letra"
          aria-expanded={menu === 'size'}
          title="Tamanho da letra"
        >
          <span className="note-fmt__tt">T<small>T</small></span> ▾
        </button>
        {menu === 'size' && (
          <div className="note-fmt__pop note-fmt__pop--list" onMouseDown={(e) => e.preventDefault()}>
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`note-fmt__size note-fmt__size--${s.value}${active.size === s.value ? ' is-on' : ''}`}
                onClick={() => toggle('fontSize', s.value, s.value !== '3' && active.size === s.value, '3')}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="note-fmt__sep" />

      <Btn run={run} cmd="insertUnorderedList" on={active.ul} label="Lista com marcadores">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
      </Btn>
      <Btn run={run} cmd="insertOrderedList" on={active.ol} label="Lista numerada">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 5l1.5-1V9M3.5 14.5a1.5 1.5 0 0 1 2.6 1L3.5 19h3" strokeWidth="1.6" /></svg>
      </Btn>
      <Btn run={run} cmd="removeFormat" label="Limpar formatação" className="note-fmt__btn--clear">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 5h12M12 5l-4 14M4 20l16-16" /></svg>
      </Btn>
    </div>
  )
}

// ── Fonte: a mesma galeria do Quadro, em lista ──────────

const CAT_SHORT: Record<FontCategory, string> = {
  'fantasia':   'Fantasia',
  'terror':     'Terror',
  'manuscrita': 'Caligrafia',
  'mao':        'À mão',
  'serifada':   'Clássicas',
  'sem-serifa': 'Modernas',
  'decorativa': 'Títulos',
  'maquina':    'Máquina e pixel',
}
const norm = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

function NoteFontMenu({ current, onPick }: { current: string; onPick: (family: string | null) => void }) {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<FontCategory | 'all'>('all')
  const listRef = useRef<HTMLDivElement>(null)
  const q = norm(query.trim())
  const list = useMemo(
    () => BOARD_FONTS.filter((f) => (cat === 'all' || f.cat === cat) && (!q || norm(f.family).includes(q))),
    [cat, q],
  )
  const grouped = cat === 'all' && !q
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }) }, [cat, q])

  return (
    // Clicar na lista não tira o cursor da folha; só a busca recebe o foco.
    <div className="note-fmt__pop note-fmt__pop--fonts" onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault() }}>
      <input
        className="input note-fmt__font-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Procurar entre ${BOARD_FONTS.length} fontes…`}
        aria-label="Procurar fonte"
      />
      <div className="note-fmt__font-cats" role="tablist" aria-label="Categorias">
        {[{ id: 'all' as const, label: 'Todas' }, ...FONT_CATEGORIES.map((c) => ({ id: c.id, label: CAT_SHORT[c.id] }))].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={cat === c.id}
            className={`note-fmt__font-cat${cat === c.id ? ' is-on' : ''}`}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="note-fmt__font-list" ref={listRef}>
        {grouped && (
          <button type="button" className={`note-fmt__font note-fmt__font--default${!current ? ' is-on' : ''}`} onClick={() => onPick(null)}>
            Padrão
          </button>
        )}
        {list.map((f, i) => (
          <div key={f.family}>
            {grouped && (i === 0 || list[i - 1].cat !== f.cat) && (
              <p className="note-fmt__font-head">{FONT_CATEGORIES.find((c) => c.id === f.cat)?.label}</p>
            )}
            <NoteFontItem family={f.family} on={current === f.family} root={listRef} onPick={onPick} />
          </div>
        ))}
        {list.length === 0 && <p className="note-fmt__font-empty">Nenhuma fonte com “{query.trim()}”.</p>}
      </div>
    </div>
  )
}

function NoteFontItem({ family, on, root, onPick }: { family: string; on: boolean; root: RefObject<HTMLDivElement>; onPick: (family: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  // Baixa só as letras do nome quando o item chega perto da área visível.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { loadFontPreview(family); return }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { loadFontPreview(family); io.disconnect() }
    }, { root: root.current, rootMargin: '120px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [family, root])
  return (
    <button
      ref={ref}
      type="button"
      className={`note-fmt__font${on ? ' is-on' : ''}`}
      style={{ fontFamily: fontStack(family) }}
      onClick={() => onPick(family)}
      title={family}
    >
      {family}
    </button>
  )
}
