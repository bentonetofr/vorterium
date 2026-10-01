import { MAX_PAGES, type DocPage } from './documentsService'
import { handStack, pageStyle, type DocStyle } from './paperStyles'

// ────────────────────────────────────────────────────────
// Texto que corre de uma página pra outra no livro: o que não cabe numa
// página desce pra seguinte (marcada `cont`, "continua a anterior"), e ao
// apagar o texto volta a subir. Mede numa folha escondida com a mesma
// letra e tamanho da página — como a letra é medida em cqw, cabe igual em
// qualquer largura (com uma folguinha na margem direita pra garantir).
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

/**
 * Quantos caracteres do começo de `text` cabem numa página com esse estilo
 * (`book`: página de livro, que deixa espaço embaixo pro número).
 */
export function fitLength(text: string, style: DocStyle, book = true): number {
  const { box, text: el } = getProbe()
  box.classList.toggle('doc-paper--page', book)
  el.style.fontFamily = handStack(style.font)
  el.style.fontSize = `${style.size / 6}cqw`
  const fits = (n: number) => { el.textContent = text.slice(0, n); return el.scrollHeight <= el.clientHeight + 1 }
  if (fits(text.length)) return text.length
  let lo = 0
  let hi = text.length
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (fits(mid)) lo = mid
    else hi = mid
  }
  // Quebra depois de um espaço/linha (não corta a palavra no meio), a não
  // ser que a palavra sozinha seja maior que a página.
  const ws = Math.max(text.lastIndexOf(' ', lo - 1), text.lastIndexOf('\n', lo - 1), text.lastIndexOf('\t', lo - 1))
  return ws > 0 ? ws + 1 : Math.max(1, lo)
}

/** O texto da página passa do tamanho dela? */
export function overflows(text: string, style: DocStyle, book = true): boolean {
  return fitLength(text, style, book) < text.length
}

/**
 * Refaz a corrente que começa na página `from` (ela + as seguintes marcadas
 * `cont`): junta o texto e distribui de novo, criando ou tirando páginas de
 * continuação. Devolve as páginas novas, onde ficou o cursor e se o livro
 * encheu (no limite de páginas, o que sobra fica na última, sem se perder).
 */
export function reflow(pages: DocPage[], from: number, docStyle: DocStyle, caret = 0): { pages: DocPage[]; page: number; caret: number; full: boolean } {
  let end = from
  while (end + 1 < pages.length && pages[end + 1].cont) end++
  const chain = pages.slice(from, end + 1)
  let rest = chain.map((p) => p.text).join('')
  const out: DocPage[] = []
  let caretPage = from
  let caretAt = caret
  let offset = 0
  let placed = false
  let full = false
  // Página em branco logo depois (sem estilo próprio) é aproveitada antes de criar outra.
  const blankAt = (i: number) => !!pages[i] && !pages[i].text && !pages[i].style
  let after = end + 1
  for (let k = 0; ; k++) {
    let base = chain[k]
    if (!base) {
      if (blankAt(after)) { base = pages[after]; after++ }
      else base = { text: '', style: chain[chain.length - 1].style ? { ...chain[chain.length - 1].style } : undefined }
    }
    let n = fitLength(rest, pageStyle(docStyle, base.style))
    // Precisa de mais uma página e o livro já está no limite? (usar uma da corrente
    // ou a em branco seguinte não aumenta o livro; só criar uma nova.)
    const grows = n < rest.length && k + 1 >= chain.length && !blankAt(after)
    if (grows && from + out.length + 2 + (pages.length - after) > MAX_PAGES) { n = rest.length; full = true }
    const text = rest.slice(0, n)
    rest = rest.slice(n)
    out.push({ ...base, text, cont: k === 0 ? chain[0].cont : true })
    if (!placed && (caret < offset + n || (caret === offset + n && (!rest || caret > offset)))) {
      caretPage = from + k
      caretAt = caret - offset
      placed = true
    }
    offset += n
    if (!rest) break
  }
  if (!placed) { caretPage = from + out.length - 1; caretAt = out[out.length - 1].text.length }
  const next = [...pages.slice(0, from), ...out, ...pages.slice(after)]
  return { pages: next, page: caretPage, caret: caretAt, full }
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
