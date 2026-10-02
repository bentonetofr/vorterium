import { MAX_PAGES, type DocPage } from './documentsService'
import { handStack, inkOf, pageStyle, type DocStyle } from './paperStyles'

// ────────────────────────────────────────────────────────
// Texto que corre de uma página pra outra no livro: o que não cabe numa
// página desce pra seguinte (marcada `cont`, "continua a anterior"), e ao
// apagar o texto volta a subir. Funciona com o texto formatado (HTML): o
// corte cai depois de um espaço, e o parágrafo (ou item de lista) cortado
// no meio fica marcado (`join`) pra se juntar de novo quando subir.
// Mede numa folha escondida com a mesma letra e tamanho da página — como
// tudo é em cqw, cabe igual em qualquer largura (com uma folguinha na
// margem direita pra garantir).
// ────────────────────────────────────────────────────────

let probe: { box: HTMLDivElement; text: HTMLDivElement } | null = null

function getProbe() {
  if (probe?.box.isConnected) return probe
  const box = document.createElement('div')
  box.className = 'doc-paper'
  box.setAttribute('aria-hidden', 'true')
  Object.assign(box.style, { position: 'fixed', left: '-10000px', top: '0', width: '480px', visibility: 'hidden', pointerEvents: 'none' })
  const text = document.createElement('div')
  text.className = 'doc-paper__text'
  text.style.right = '10.5cqw'
  box.appendChild(text)
  document.body.appendChild(box)
  probe = { box, text }
  return probe
}

function setupProbe(style: DocStyle, book: boolean) {
  const p = getProbe()
  p.box.classList.toggle('doc-paper--page', book)
  p.text.style.fontFamily = handStack(style.font)
  p.text.style.fontSize = `${style.size / 6}cqw`
  p.text.style.color = inkOf(style.ink)
  return p.text
}

const overflowing = (el: HTMLElement) => el.scrollHeight > el.clientHeight + 1

/** O texto da página passa do tamanho dela? */
export function overflows(html: string, style: DocStyle, book = true): boolean {
  const el = setupProbe(style, book)
  el.innerHTML = html
  return overflowing(el)
}

// ── Contagem de "letras" (pra guardar a seleção): texto + cada quebra de linha <br> ──

function walk(root: Node, fn: (n: Node) => void) {
  for (let n = root.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE || (n as Element).tagName === 'BR') fn(n)
    else walk(n, fn)
  }
}

function count(root: Node): number {
  let n = 0
  walk(root, (x) => { n += x.nodeType === Node.TEXT_NODE ? (x.textContent ?? '').length : 1 })
  return n
}

/** Letras de `root` até o ponto (node, offset). */
function offsetOf(root: HTMLElement, node: Node, offset: number): number {
  const r = document.createRange()
  r.setStart(root, 0)
  r.setEnd(node, offset)
  return count(r.cloneContents())
}

const blockOf = (n: Node) => (n.nodeType === Node.ELEMENT_NODE ? n as Element : n.parentElement)?.closest('div, p, li, ul, ol')

/**
 * O ponto (nó, offset) da letra `offset` dentro de `root`. No fim de um
 * trecho de texto, fica nele (o que se digita herda a formatação de antes,
 * como no Word) — a não ser que logo depois venha um parágrafo novo, ainda
 * vazio (ex.: o item de lista que o Enter acabou de criar): aí vai pra ele.
 */
function pointAt(root: HTMLElement, offset: number): { node: Node; at: number } | null {
  const leaves: Node[] = []
  walk(root, (x) => { leaves.push(x) })
  let left = offset
  for (let i = 0; i < leaves.length; i++) {
    const x = leaves[i]
    if (x.nodeType === Node.TEXT_NODE) {
      const len = (x.textContent ?? '').length
      const next = leaves[i + 1]
      // Ambíguo só no fim do texto: se o que vem é um parágrafo novo e vazio (só a quebra), vai pra ele.
      const emptyNext = !!next && next.nodeType !== Node.TEXT_NODE && blockOf(next) !== blockOf(x)
      if (left < len || (left === len && !emptyNext)) return { node: x, at: left }
      left -= len
    } else {
      if (left === 0) return { node: x.parentNode!, at: [...x.parentNode!.childNodes].indexOf(x as ChildNode) }
      left -= 1
    }
  }
  return null
}

/** A seleção dentro de `root`, em letras (pra refazer depois de mexer no HTML). */
export function selectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null
  return { start: offsetOf(root, r.startContainer, r.startOffset), end: offsetOf(root, r.endContainer, r.endOffset) }
}

/** Seleciona da letra `start` até a `end` dentro de `root`. */
export function setSelectionOffsets(root: HTMLElement, start: number, end = start) {
  const r = document.createRange()
  const a = pointAt(root, start)
  const b = end === start ? a : pointAt(root, end)
  if (a) r.setStart(a.node, a.at)
  else { r.selectNodeContents(root); r.collapse(false) }
  if (b) r.setEnd(b.node, b.at)
  else r.collapse(true)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}

// ── Cortar e juntar ──────────────────────────────────────

/** Sobe o ponto de corte enquanto ele está no começo/fim de um elemento (não deixa casca vazia). */
function normalizeCut(root: Node, node: Node, offset: number): { node: Node; offset: number } {
  while (node !== root && node.parentNode) {
    const len = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').length : node.childNodes.length
    const idx = [...node.parentNode.childNodes].indexOf(node as ChildNode)
    if (offset === 0) { offset = idx; node = node.parentNode }
    else if (offset >= len) { offset = idx + 1; node = node.parentNode }
    else break
  }
  return { node, offset }
}

/**
 * Corta o HTML no ponto em que a página enche: devolve o que cabe, o resto
 * e quantos níveis de elemento ficaram cortados no meio (`join`). null se
 * cabe inteiro (ou se não dá pra cortar).
 */
export function splitPage(html: string, style: DocStyle, book = true): { fit: string; rest: string; join: number } | null {
  const el = setupProbe(style, book)
  el.innerHTML = html
  if (!overflowing(el)) return null
  const limit = el.getBoundingClientRect().top + el.clientHeight + 0.5

  // Todas as letras em ordem; acha a primeira que passa do fim da página.
  const texts: Text[] = []
  walk(el, (x) => { if (x.nodeType === Node.TEXT_NODE && x.textContent) texts.push(x as Text) })
  const starts: number[] = []
  let total = 0
  for (const t of texts) { starts.push(total); total += t.data.length }
  const locate = (i: number) => {
    let k = starts.length - 1
    while (k > 0 && starts[k] > i) k--
    return { node: texts[k], at: i - starts[k] }
  }
  const range = document.createRange()
  // Fim da LINHA da letra i (a caixa da letra é mais baixa que a linha: a
  // última linha pode "caber" pela letra e ainda assim passar do papel).
  const bottom = (i: number) => {
    const { node, at } = locate(i)
    range.setStart(node, at)
    range.setEnd(node, at + 1)
    const rects = range.getClientRects()
    if (!rects.length) return -Infinity
    const r = rects[rects.length - 1]
    const line = parseFloat(getComputedStyle(node.parentElement!).lineHeight)
    return r.bottom + (line > r.height ? (line - r.height) / 2 : 0)
  }
  let lo = 0
  let hi = total
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (bottom(mid) > limit) hi = mid
    else lo = mid + 1
  }
  const all = texts.map((t) => t.data).join('')
  let cut: { node: Node; offset: number } | null = null
  if (lo < total) {
    // Volta até depois de um espaço (não corta palavra), a não ser que a palavra sozinha não caiba.
    let s = lo
    const ws = Math.max(all.lastIndexOf(' ', lo - 1), all.lastIndexOf('\t', lo - 1), all.lastIndexOf('\n', lo - 1))
    if (ws >= 0 && ws + 1 <= lo) s = ws + 1
    if (s > 0) { const p = locate(s); cut = { node: p.node, offset: p.at } }
  }
  if (!cut) {
    // Todas as letras cabem (o que passa é linha vazia, item novo…): desce até
    // o primeiro elemento que passa do fim e corta antes dele, no nível mais fundo.
    const below = (n: Node) => {
      const r = document.createRange()
      r.selectNode(n)
      return r.getBoundingClientRect().bottom > limit
    }
    for (let parent: Node = el; ;) {
      const kids = [...parent.childNodes]
      const i = kids.findIndex(below)
      if (i < 0) break
      cut = { node: parent, offset: i }
      const k = kids[i]
      if (k.nodeType !== Node.ELEMENT_NODE || !k.childNodes.length) break
      parent = k
    }
    if (!cut) return null
  }
  cut = normalizeCut(el, cut.node, cut.offset)
  if (cut.node === el && cut.offset === 0) return null
  // Quantos elementos (abaixo da página) o corte atravessa.
  let join = 0
  for (let n: Node | null = cut.node.nodeType === Node.TEXT_NODE ? cut.node.parentNode : cut.node; n && n !== el; n = n.parentNode) join++
  range.setStart(cut.node, cut.offset)
  range.setEnd(el, el.childNodes.length)
  const holder = document.createElement('div')
  holder.appendChild(range.extractContents())
  // Listas cortadas: a numeração segue na página seguinte, e o item cortado no meio não repete o marcador.
  let f: Element = el
  let r: Element = holder
  for (let d = 1; d <= join; d++) {
    const fc = f.lastElementChild
    const rc = r.firstElementChild
    if (!fc || !rc || fc.tagName !== rc.tagName) break
    if (rc.tagName === 'OL') {
      const items = [...fc.children].filter((c) => c.tagName === 'LI').length
      const first = parseInt(fc.getAttribute('start') ?? '1', 10) || 1
      rc.setAttribute('start', String(first + items - (join > d ? 1 : 0)))
    }
    if (rc.tagName === 'LI') rc.setAttribute('data-cont', '')
    f = fc
    r = rc
  }
  const rest = holder.innerHTML
  if (!rest) return null
  return { fit: el.innerHTML, rest, join }
}

/** Junta `b` no fim de `a`, emendando `depth` níveis (o parágrafo cortado volta a ser um só). */
function mergeInto(a: Node, b: Node, depth: number) {
  if (depth > 0) {
    const al = a.lastChild
    const bf = b.firstChild
    if (al && bf && al.nodeType === Node.ELEMENT_NODE && bf.nodeType === Node.ELEMENT_NODE && (al as Element).tagName === (bf as Element).tagName) {
      mergeInto(al, bf, depth - 1)
      bf.remove()
    }
  }
  while (b.firstChild) a.appendChild(b.firstChild)
}

/** O HTML de várias páginas seguidas como um texto só. */
export function joinPages(parts: { html: string; join?: number }[]): string {
  if (parts.length === 1) return parts[0].html
  const root = document.createElement('template')
  root.innerHTML = parts[0].html
  for (const p of parts.slice(1)) {
    const t = document.createElement('template')
    t.innerHTML = p.html
    mergeInto(root.content, t.content, p.join ?? 0)
  }
  const holder = document.createElement('div')
  holder.appendChild(root.content)
  return holder.innerHTML
}

// ── Redistribuir ─────────────────────────────────────────

const isBlank = (p: DocPage | undefined) => !!p && !p.style && !/[^\s]/.test(p.html.replace(/<[^>]*>/g, ''))

/**
 * Refaz a corrente que começa na página `from` (ela + as seguintes marcadas
 * `cont`): junta o texto e distribui de novo, criando ou tirando páginas de
 * continuação. A marca do cursor (CARET_MARK), se estiver no texto, vai
 * junto pra página onde cair. Devolve as páginas novas e se o livro encheu
 * (no limite de páginas, o que sobra fica na última, sem se perder).
 */
export function reflow(pages: DocPage[], from: number, docStyle: DocStyle): { pages: DocPage[]; full: boolean } {
  let end = from
  while (end + 1 < pages.length && pages[end + 1].cont) end++
  const chain = pages.slice(from, end + 1)
  let rest = joinPages(chain.map((p, i) => ({ html: p.html, join: i === 0 ? 0 : p.join })))
  const out: DocPage[] = []
  let full = false
  let join = 0
  // Página em branco logo depois (sem estilo próprio) é aproveitada antes de criar outra.
  let after = end + 1
  for (let k = 0; ; k++) {
    let base = chain[k]
    if (!base) {
      if (isBlank(pages[after])) { base = pages[after]; after++ }
      else base = { html: '', style: chain[chain.length - 1].style ? { ...chain[chain.length - 1].style } : undefined }
    }
    let split = splitPage(rest, pageStyle(docStyle, base.style))
    // Precisa de mais uma página e o livro já está no limite? (usar uma da corrente
    // ou a em branco seguinte não aumenta o livro; só criar uma nova.)
    const grows = !!split && k + 1 >= chain.length && !isBlank(pages[after])
    if (grows && from + out.length + 2 + (pages.length - after) > MAX_PAGES) { split = null; full = true }
    const html = split ? split.fit : rest
    const page: DocPage = { ...base, html }
    delete page.cont
    delete page.join
    if (k === 0) {
      if (chain[0].cont) page.cont = true
      if (chain[0].join) page.join = chain[0].join
    } else {
      page.cont = true
      if (join) page.join = join
    }
    out.push(page)
    if (!split) break
    rest = split.rest
    join = split.join
  }
  const next = [...pages.slice(0, from), ...out, ...pages.slice(after)]
  return { pages: next, full }
}

/** Refaz o livro todo (ex.: mudou a letra ou o tamanho). */
export function reflowAll(pages: DocPage[], docStyle: DocStyle): { pages: DocPage[]; full: boolean } {
  let out = pages
  let full = false
  for (let i = 0; i < out.length; i++) {
    if (i > 0 && out[i].cont) continue
    const r = reflow(out, i, docStyle)
    out = r.pages
    full ||= r.full
  }
  return { pages: out, full }
}
