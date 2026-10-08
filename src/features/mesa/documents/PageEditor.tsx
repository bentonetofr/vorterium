import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { fontStack, loadBoardFont } from '../../../shared/lib/googleFonts'
import { CARET_MARK, isBlankHtml, loadDocFonts, sanitizeDocHtml } from './docHtml'
import { PaperFrame, textCss } from './DocViews'
import { joinPages, selectionOffsets, setSelectionOffsets } from './pageFlow'
import type { DocStyle } from './paperStyles'

// ────────────────────────────────────────────────────────
// A página editável, direto no papel (como no Word): o texto é um bloco
// editável (contentEditable) com a letra e a tinta da página. A barra
// (DocToolbar) comanda a formatação pelo handle; Tab pula até a próxima
// parada de tabulação (ou, numa lista, desce um nível); Ctrl+Z/Ctrl+Y
// desfazem/refazem pelo histórico do editor (o texto que corre entre as
// páginas reescreve a folha, e o desfazer do navegador se perderia).
//
// "Não controlado": o React não reescreve o HTML a cada tecla — só quando
// `version` muda (abriu a página, o texto correu pra outra, desfez…).
// ────────────────────────────────────────────────────────

export type DocCommand =
  | 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull'
  | 'insertUnorderedList' | 'insertOrderedList' | 'removeFormat'
  | 'foreColor' | 'fontName' | 'fontSize' | 'grow' | 'shrink'
  | 'indent' | 'outdent' | 'lineHeight'

/** Tamanhos da lista (mesma escala do tamanho da página: px numa folha de 600). */
export const FONT_SIZES = [12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 56, 64, 72, 80]
/** Um "Tab" de recuo (o mesmo da parada de tabulação). */
const INDENT_STEP = 6.4
const MAX_INDENT = 57.6

export interface PageEditorHandle {
  format: (command: DocCommand, value?: string) => void
  element: () => HTMLDivElement | null
  /** O HTML da página com a marca do cursor (CARET_MARK) onde ele está. */
  marked: () => string | null
}

export type ChangeKind = 'type' | 'format'

interface Props {
  html:        string
  /** Muda quando o HTML de fora deve substituir o da folha. */
  version:     number
  /**
   * Quando `version` muda: HTML pra pôr na folha com a marca do cursor
   * (CARET_MARK) — o cursor vai pra ela. null: usa `html` e não mexe no foco.
   */
  marked:      string | null
  style:       DocStyle
  seed:        number
  book:        boolean
  placeholder: string
  /** O HTML (já limpo) com a marca do cursor (CARET_MARK) onde ele está. */
  onChange:    (marked: string, kind: ChangeKind) => void
  onUndo:      () => void
  onRedo:      () => void
  /** Todas as páginas do livro estão selecionadas (Ctrl+A). */
  all:         boolean
  onAll:       (on: boolean) => void
  /** Com tudo selecionado, a formatação vale pro livro todo. */
  onFormatAll: (command: DocCommand, value?: string) => void
  /** Com tudo selecionado, Delete/Backspace apagam o texto de todas as páginas. */
  onClearAll:  () => void
}

const isBlock = (n: Node) => n.nodeType === Node.ELEMENT_NODE && /^(DIV|P|UL|OL|LI)$/.test((n as Element).tagName)

/**
 * Põe cada linha solta (texto direto na folha, separado por <br>) num
 * parágrafo próprio, guardando a seleção. Feito aqui e não pelo navegador:
 * o Chrome, ao criar o parágrafo, copia a letra/tamanho pra dentro do texto.
 */
function ensureBlocks(root: HTMLElement) {
  const kids = [...root.childNodes]
  if (kids.every(isBlock)) return
  const sel = selectionOffsets(root)
  const out: Node[] = []
  let line: Node[] = []
  const flush = () => {
    if (!line.length) return
    const d = document.createElement('div')
    d.append(...line)
    out.push(d)
    line = []
  }
  for (const n of kids) {
    if (isBlock(n)) { flush(); out.push(n); continue }
    line.push(n)
    // O <br> fica no fim da linha (no fim de um parágrafo ele não aparece, e a contagem do cursor não muda).
    if ((n as Element).tagName === 'BR') flush()
  }
  flush()
  root.replaceChildren(...out)
  if (sel) setSelectionOffsets(root, sel.start, sel.end)
}

/** Os blocos (parágrafos/itens) que a seleção toca — os mais de dentro. */
function selectedBlocks(root: HTMLElement): HTMLElement[] {
  ensureBlocks(root)
  const sel = window.getSelection()
  if (!sel?.rangeCount) return []
  const r = sel.getRangeAt(0)
  return [...root.querySelectorAll<HTMLElement>('div, p, li')]
    .filter((b) => r.intersectsNode(b) && !b.querySelector('div, p, li'))
}

/** O cursor está numa lista? */
function inList(root: HTMLElement): boolean {
  const n = window.getSelection()?.anchorNode
  const el = n && (n.nodeType === Node.ELEMENT_NODE ? n as Element : n.parentElement)
  return !!el && root.contains(el) && !!el.closest('li')
}

/** Tamanho da letra onde o cursor está, na escala da barra (px numa folha de 600). */
export function sizeAtCaret(root: HTMLElement): number | null {
  const n = window.getSelection()?.anchorNode
  const el = n && (n.nodeType === Node.ELEMENT_NODE ? n as Element : n.parentElement)
  const paper = root.closest('.doc-paper') as HTMLElement | null
  if (!el || !root.contains(el) || !paper?.clientWidth) return null
  return Math.round(parseFloat(getComputedStyle(el).fontSize) * 600 / paper.clientWidth)
}

export const PageEditor = forwardRef<PageEditorHandle, Props>(function PageEditor(
  { html, version, marked, style, seed, book, placeholder, onChange, onUndo, onRedo, all, onAll, onFormatAll, onClearAll },
  handle,
) {
  const ref = useRef<HTMLDivElement>(null)
  const range = useRef<Range | null>(null)
  const [empty, setEmpty] = useState(isBlankHtml(html))
  const cb = useRef({ onChange, onUndo, onRedo, onAll, onFormatAll, onClearAll })
  cb.current = { onChange, onUndo, onRedo, onAll, onFormatAll, onClearAll }
  const allRef = useRef(all)
  allRef.current = all

  // Conteúdo de fora (abrir a página, texto que correu, desfazer).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const content = marked ?? html
    el.innerHTML = content
    setEmpty(isBlankHtml(content.replace(CARET_MARK, '')))
    void loadDocFonts(content)
    if (marked != null) placeAtMark(el)
    else if (allRef.current) selectAllIn(el)
  }, [version])  // eslint-disable-line react-hooks/exhaustive-deps

  // Parágrafo novo vira <div> em todos os navegadores (no Firefox seria <br>).
  useEffect(() => { try { document.execCommand('defaultParagraphSeparator', false, 'div') } catch { /* antigo */ } }, [])

  // Guarda a seleção (clicar na barra tira o foco; a formatação volta pra cá).
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection()
      const el = ref.current
      if (el && sel?.rangeCount && el.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange()
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  function emit(kind: ChangeKind) {
    const el = ref.current
    if (!el) return
    // Tamanho escolhido com o cursor parado: o navegador aplica ao digitar (como marcador).
    fixSizes(el)
    dropInherited(el, style.size)
    keepContOnFirst(el)
    const blank = !(el.textContent ?? '').trim() && !el.querySelector('li')
    setEmpty(blank)
    const value = blank ? CARET_MARK : sanitizeDocHtml(withCaret(el))
    void loadDocFonts(value)
    cb.current.onChange(value, kind)
  }

  function restore() {
    const el = ref.current
    if (!el) return
    const sel = window.getSelection()
    if (document.activeElement === el && sel?.rangeCount && el.contains(sel.anchorNode)) return
    el.focus({ preventScroll: true })
    if (range.current && sel) {
      sel.removeAllRanges()
      sel.addRange(range.current)
    }
  }

  function format(command: DocCommand, value?: string) {
    const el = ref.current
    if (!el) return
    // Todas as páginas selecionadas (Ctrl+A no livro): a mudança vale pro livro todo.
    if (allRef.current) { cb.current.onFormatAll(command, value); return }
    restore()
    document.execCommand('styleWithCSS', false, 'true')
    if (!applyFormat(el, command, value, style)) return
    emit('format')
  }

  useImperativeHandle(handle, () => ({
    format,
    element: () => ref.current,
    marked: () => (ref.current ? sanitizeDocHtml(withCaret(ref.current)) : null),
  }))

  return (
    <PaperFrame style={style} seed={seed} className={`doc-paper--edit${book ? ' doc-paper--page' : ''}`}>
      {/* A letra/tinta padrão ficam no bloco de fora: se ficassem no editável, o
          Chrome copiaria esses estilos pra dentro do texto ao alinhar/formatar. */}
      <div className="doc-paper__text" style={textCss(style)}>
        <div
          ref={ref}
          className={`doc-paper__edit${empty ? ' is-empty' : ''}`}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Texto da página"
          data-placeholder={placeholder}
          spellCheck
          onInput={(e) => {
          const ev = e.nativeEvent as InputEvent
          if (ev.isComposing) return
          // Enter começa um passo novo do desfazer (como no Word).
          emit(ev.inputType === 'insertParagraph' || ev.inputType === 'insertLineBreak' ? 'format' : 'type')
        }}
          onCompositionEnd={() => emit('type')}
          onBeforeInput={(e) => {
            // Desfazer/refazer pelo menu do navegador: usa o histórico do editor.
            const type = (e.nativeEvent as InputEvent).inputType
            if (type === 'historyUndo') { e.preventDefault(); cb.current.onUndo() }
            if (type === 'historyRedo') { e.preventDefault(); cb.current.onRedo() }
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            const mod = e.ctrlKey || e.metaKey
            const k = e.key.toLowerCase()
            if (allRef.current) {
              // Todas as páginas selecionadas: Delete apaga tudo; Esc, setas ou digitar saem da seleção.
              if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); cb.current.onClearAll(); return }
              if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); window.getSelection()?.collapseToEnd(); cb.current.onAll(false); return }
              if (/^(Arrow(Left|Right|Up|Down)|Home|End|Page(Up|Down))$/.test(e.key)) cb.current.onAll(false)
              else if (mod ? k === 'x' : !e.altKey && (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab')) {
                window.getSelection()?.collapseToEnd()
                cb.current.onAll(false)
              }
            }
            if (mod && !e.altKey) {
              // Ctrl+A num livro: seleciona todas as páginas (a formatação passa a valer pro livro todo).
              if (k === 'a' && !e.shiftKey && book) { e.preventDefault(); selectAllIn(ref.current!); cb.current.onAll(true); return }
              if (k === 'z' && !e.shiftKey) { e.preventDefault(); cb.current.onUndo(); return }
              if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); cb.current.onRedo(); return }
              // Atalhos do Word: Ctrl+E/L/R/J alinham; Ctrl+] / Ctrl+[ (ou Ctrl+Shift+> / <) mudam o tamanho.
              const align: Record<string, DocCommand> = { e: 'justifyCenter', l: 'justifyLeft', r: 'justifyRight', j: 'justifyFull' }
              if (align[k] && !e.shiftKey) { e.preventDefault(); format(align[k]); return }
              if (e.key === ']' || e.key === '>' || (e.shiftKey && e.key === '.')) { e.preventDefault(); format('grow'); return }
              if (e.key === '[' || e.key === '<' || (e.shiftKey && e.key === ',')) { e.preventDefault(); format('shrink'); return }
              if (k === 'b' || k === 'i' || k === 'u') {
                e.preventDefault()
                format(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline')
                return
              }
            }
            if (e.key !== 'Tab' || mod || e.altKey) return
            // Tab: numa lista desce/sobe um nível; fora, pula até a próxima parada (Shift+Tab apaga o Tab de antes).
            e.preventDefault()
            const el = ref.current!
            if (inList(el)) { format(e.shiftKey ? 'outdent' : 'indent'); return }
            const sel = window.getSelection()
            const at = sel?.anchorNode
            if (!e.shiftKey) document.execCommand('insertText', false, '\t')
            else if (sel?.isCollapsed && at?.nodeType === Node.TEXT_NODE && at.textContent?.[sel.anchorOffset - 1] === '\t') document.execCommand('delete')
            else { format('outdent'); return }
            emit('type')
          }}
          onMouseDown={() => { if (allRef.current) cb.current.onAll(false) }}
          onPaste={(e) => {
            if (allRef.current) { window.getSelection()?.collapseToEnd(); cb.current.onAll(false) }
            // Colar mantém a formatação básica (negrito, listas, alinhamento…), já limpa.
            e.preventDefault()
            const rich = e.clipboardData.getData('text/html')
            const clean = rich ? sanitizeDocHtml(rich.replace(/<!--[\s\S]*?-->/g, '')) : ''
            const plain = e.clipboardData.getData('text/plain')
            const payload = clean && !isBlankHtml(clean) ? clean : plainToHtml(plain)
            // Texto grande: o navegador demora minutos pra inserir (e trava a tela); aqui entra de uma vez
            // e o texto corre sozinho pelas páginas seguintes.
            if (payload.length > BIG_PASTE && fastInsert(ref.current!, payload)) { emit('format'); return }
            if (payload === clean) document.execCommand('insertHTML', false, clean)
            else document.execCommand('insertText', false, plain)
            emit('format')
          }}
          onDrop={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
        />
      </div>
    </PaperFrame>
  )
})

/**
 * Tira o que o navegador copia pra dentro do texto sem ninguém pedir: o
 * tamanho igual ao padrão da página (senão ele ficaria "congelado" se o
 * padrão mudar depois) e a cor do cursor.
 */
function dropInherited(root: HTMLElement, baseSize: number) {
  const base = baseSize / 6
  for (const x of root.querySelectorAll<HTMLElement>('[style]')) {
    x.style.removeProperty('caret-color')
    const fs = x.style.fontSize
    if (fs.endsWith('cqw') && Math.abs(parseFloat(fs) - base) < 0.005) x.style.removeProperty('font-size')
    if (!x.getAttribute('style')?.trim()) {
      x.removeAttribute('style')
      if (x.tagName === 'SPAN') x.replaceWith(...x.childNodes)
    }
  }
}

/** O HTML de `root` com a marca do cursor onde ele está (numa cópia: a folha não muda). */
function withCaret(root: HTMLElement): string {
  const sel = window.getSelection()
  const focus = sel?.focusNode
  if (!sel?.rangeCount || !focus || !root.contains(focus)) return root.innerHTML
  const path: number[] = []
  for (let n: Node = focus; n !== root; n = n.parentNode!) path.unshift([...n.parentNode!.childNodes].indexOf(n as ChildNode))
  const copy = root.cloneNode(true) as HTMLElement
  let at: Node = copy
  for (const i of path) at = at.childNodes[i]
  if (at.nodeType === Node.TEXT_NODE) (at as Text).insertData(sel.focusOffset, CARET_MARK)
  else at.insertBefore(document.createTextNode(CARET_MARK), at.childNodes[sel.focusOffset] ?? null)
  return copy.innerHTML
}

/** A partir de quantas letras uma colagem é "grande" (insere direto no texto, sem o navegador). */
const BIG_PASTE = 1500

const escapeText = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Texto puro → um parágrafo (div) por linha; linha vazia vira um parágrafo em branco. */
function plainToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  return lines.map((l) => (l ? `<div>${escapeText(l)}</div>` : '<div><br></div>')).join('')
}

/**
 * Cola `html` (já limpo) no cursor sem o execCommand do navegador, que fica quadrático com
 * muitas linhas. Parte a folha no cursor, emenda a primeira linha colada no parágrafo de antes
 * e a última no de depois (como no Word) e deixa o cursor no fim do colado. false = não deu
 * (sem cursor na folha, ou dentro de lista): quem chamou usa o jeito normal.
 */
function fastInsert(el: HTMLElement, html: string): boolean {
  const first = window.getSelection()
  if (!first?.rangeCount || !el.contains(first.anchorNode) || !el.contains(first.focusNode) || inList(el)) return false
  ensureBlocks(el)
  const sel = window.getSelection()
  if (!sel?.rangeCount) return false
  const r = sel.getRangeAt(0)
  r.deleteContents()
  const part = (from: Range) => { const d = document.createElement('div'); d.appendChild(from.cloneContents()); return d.innerHTML }
  const before = document.createRange()
  before.setStart(el, 0)
  before.setEnd(r.startContainer, r.startOffset)
  const after = document.createRange()
  after.setStart(r.startContainer, r.startOffset)
  after.setEnd(el, el.childNodes.length)
  const paste = document.createElement('template')
  paste.innerHTML = html
  // a marca do cursor no fim do colado: o cursor volta pra ela
  ;(paste.content.lastElementChild ?? paste.content).append(document.createTextNode(CARET_MARK))
  const pasted = document.createElement('div')
  pasted.appendChild(paste.content)
  el.innerHTML = joinPages([
    { html: part(before) },
    { html: pasted.innerHTML, join: 1 },
    { html: part(after), join: 1 },
  ])
  placeAtMark(el)
  return true
}

/** Seleciona todo o texto da folha (com o foco nela). */
function selectAllIn(el: HTMLElement) {
  el.focus({ preventScroll: true })
  const sel = window.getSelection()
  if (!sel) return
  const r = document.createRange()
  r.selectNodeContents(el)
  sel.removeAllRanges()
  sel.addRange(r)
}

/** Tira a marca da folha e põe o cursor onde ela estava. */
function placeAtMark(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  root.focus({ preventScroll: true })
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    const i = t.data.indexOf(CARET_MARK)
    if (i < 0) continue
    t.deleteData(i, CARET_MARK.length)
    const r = document.createRange()
    r.setStart(t, i)
    r.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    // A folha rola até o cursor (página comprida na tela pequena).
    ;(t.parentElement ?? root).scrollIntoView?.({ block: 'nearest' })
    return
  }
}

/**
 * "Continua da página anterior" (sem marcador) só vale pro primeiro item
 * da página — Enter num item assim faria o navegador copiar a marca pro novo.
 */
function keepContOnFirst(root: HTMLElement) {
  for (const li of root.querySelectorAll('li[data-cont]')) {
    let first = true
    for (let n: Element | null = li; n && n !== root; n = n.parentElement) {
      if (n.parentElement && n.parentElement.firstElementChild !== n) { first = false; break }
    }
    if (!first) li.removeAttribute('data-cont')
  }
}

const SIZE_MARK = 'vorterium-tamanho-'

/**
 * Tamanho: o fontSize do navegador só conhece 7 tamanhos (e no Chrome sai
 * vazio), então aplica uma "letra-marcador" com o número e troca pelo
 * tamanho em cqw. Com o cursor parado, o marcador vale pro que for digitado.
 */
function applySize(el: HTMLElement, n: number) {
  document.execCommand('fontName', false, `${SIZE_MARK}${n}`)
  fixSizes(el)
}

/**
 * Aplica um comando de formatação ao que está selecionado dentro de `el` (a folha
 * da tela, ou a folha escondida de formatAll). false = nada a fazer.
 */
export function applyFormat(el: HTMLElement, command: DocCommand, value: string | undefined, style: DocStyle): boolean {
  switch (command) {
    case 'fontSize': {
      const n = Number(value)
      if (n > 0) applySize(el, n)
      break
    }
    case 'grow':
    case 'shrink': {
      const now = sizeAtCaret(el) ?? style.size
      const next = command === 'grow' ? FONT_SIZES.find((s) => s > now) : [...FONT_SIZES].reverse().find((s) => s < now)
      if (next) applySize(el, next)
      break
    }
    case 'fontName':
    case 'foreColor': {
      if (value === 'default') {
        // "Padrão da página": aplica um valor-marcador e tira ele dos trechos.
        const MARK = command === 'fontName' ? 'vorterium-marcador' : 'rgb(1, 2, 3)'
        document.execCommand(command, false, MARK)
        const prop = command === 'foreColor' ? 'color' : 'font-family'
        const isMark = (v: string) => (command === 'fontName' ? v.includes('vorterium-marcador') : v.replace(/\s/g, '') === 'rgb(1,2,3)')
        for (const node of [...el.querySelectorAll<HTMLElement>('[style], font')]) {
          if (node.tagName === 'FONT') {
            if (isMark(node.getAttribute('face') ?? '')) node.removeAttribute('face')
            if (isMark(node.getAttribute('color') ?? '')) node.removeAttribute('color')
          }
          if (isMark(node.style.getPropertyValue(prop))) node.style.removeProperty(prop)
          const bare = !node.getAttribute('style')?.trim() && !node.getAttribute('face') && !node.getAttribute('color') && !node.getAttribute('size')
          if (bare && (node.tagName === 'SPAN' || node.tagName === 'FONT')) node.replaceWith(...node.childNodes)
        }
      } else if (command === 'fontName') {
        if (!value || !fontStack(value)) return false
        void loadBoardFont(value)
        document.execCommand('fontName', false, fontStack(value))
      } else {
        document.execCommand('foreColor', false, value)
      }
      break
    }
    case 'indent':
    case 'outdent':
      if (inList(el)) {
        // Lista: o nível vira uma lista dentro da outra.
        document.execCommand('styleWithCSS', false, 'false')
        document.execCommand(command)
        document.execCommand('styleWithCSS', false, 'true')
      } else {
        for (const b of selectedBlocks(el)) {
          const now = parseFloat(b.style.marginLeft) || 0
          const next = Math.max(0, Math.min(MAX_INDENT, now + (command === 'indent' ? INDENT_STEP : -INDENT_STEP)))
          if (next) b.style.marginLeft = `${next}cqw`
          else b.style.removeProperty('margin-left')
        }
      }
      break
    case 'justifyLeft':
    case 'justifyCenter':
    case 'justifyRight':
    case 'justifyFull': {
      const align = { justifyLeft: '', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' }[command]
      for (const b of selectedBlocks(el)) {
        if (align) b.style.textAlign = align
        else b.style.removeProperty('text-align')
      }
      break
    }
    case 'lineHeight':
      for (const b of selectedBlocks(el)) {
        if (value && value !== 'default') b.style.lineHeight = value
        else b.style.removeProperty('line-height')
      }
      break
    default:
      document.execCommand(command, false)
  }
  return true
}

/** O que se limpa depois de formatar (o mesmo de cada mudança na folha da tela). */
export function tidyEdit(el: HTMLElement, baseSize: number) {
  fixSizes(el)
  dropInherited(el, baseSize)
  keepContOnFirst(el)
}

/** Troca a letra-marcador de tamanho pelo tamanho em cqw (e tira tamanhos de dentro dela). */
function fixSizes(root: HTMLElement) {
  for (const x of [...root.querySelectorAll<HTMLElement>(`[style*="${SIZE_MARK}"], font[face*="${SIZE_MARK}"]`)]) {
    const fam = x.tagName === 'FONT' ? x.getAttribute('face') ?? '' : x.style.fontFamily
    const n = Number(/vorterium-tamanho-(\d+)/.exec(fam)?.[1])
    let el = x
    if (x.tagName === 'FONT') {
      const span = document.createElement('span')
      const color = x.getAttribute('color')
      if (color) span.style.color = color
      span.style.cssText += x.style.cssText
      span.append(...x.childNodes)
      x.replaceWith(span)
      el = span
    }
    el.style.removeProperty('font-family')
    if (n > 0) {
      for (const inner of el.querySelectorAll<HTMLElement>('[style]')) inner.style.removeProperty('font-size')
      el.style.fontSize = `${+(n / 6).toFixed(3)}cqw`
    }
  }
}
