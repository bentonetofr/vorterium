import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { FormatCommand, NoteEditorHandle } from './NoteEditor'

// ────────────────────────────────────────────────────────
// Barra de formatação do caderno: negrito, itálico, sublinhado, tachado,
// cor da letra e marca-texto, tamanho, listas e limpar formatação. Os
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

interface Active { bold: boolean; italic: boolean; underline: boolean; strike: boolean; ul: boolean; ol: boolean; size: string }
const NONE: Active = { bold: false, italic: false, underline: false, strike: false, ul: false, ol: false, size: '3' }

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
  const [menu, setMenu] = useState<'color' | 'size' | null>(null)
  const box = useRef<HTMLDivElement>(null)

  // O que está ativo onde o cursor está.
  useEffect(() => {
    const update = () => {
      const el = editor.current?.element()
      const sel = window.getSelection()
      if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return
      let size = '3'
      try { size = document.queryCommandValue('fontSize') || '3' } catch { /* padrão */ }
      setActive({
        bold: query('bold'), italic: query('italic'), underline: query('underline'), strike: query('strikeThrough'),
        ul: query('insertUnorderedList'), ol: query('insertOrderedList'), size,
      })
    }
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
  }

  return (
    <div className="note-fmt" ref={box} role="toolbar" aria-label="Formatação">
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
                  className={`note-fmt__swatch${c === 'default' ? ' note-fmt__swatch--default' : ''}`}
                  style={c === 'default' ? undefined : { background: c }}
                  onClick={() => run('foreColor', c)}
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
                  className={`note-fmt__swatch${c === 'default' ? ' note-fmt__swatch--default' : ''}`}
                  style={c === 'default' ? undefined : { background: c }}
                  onClick={() => run('hiliteColor', c)}
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
                onClick={() => run('fontSize', s.value)}
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
