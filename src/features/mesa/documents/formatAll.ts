import { loadBoardFont } from '../../../shared/lib/googleFonts'
import { isBlankHtml, loadDocFonts, sanitizeDocHtml } from './docHtml'
import type { DocPage } from './documentsService'
import { applyFormat, tidyEdit, type DocCommand } from './PageEditor'
import { handStack, inkOf, pageStyle, type DocStyle } from './paperStyles'

// ────────────────────────────────────────────────────────
// Formatar o livro todo (Ctrl+A): cada página é posta, uma de cada vez, numa folha
// escondida e editável (a mesma largura, letra e tinta da página), selecionada por
// inteiro, e recebe o mesmo comando da barra. Assim a formatação sai igual à da
// folha da tela, inclusive tamanho em cqw, listas e alinhamento.
// ────────────────────────────────────────────────────────

const TOGGLES = new Set<DocCommand>(['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'])

/** Devolve as páginas com o comando aplicado ao texto todo de cada uma. */
export async function formatAllPages(pages: DocPage[], docStyle: DocStyle, command: DocCommand, value?: string): Promise<DocPage[]> {
  if (command === 'fontName' && value && value !== 'default') await loadBoardFont(value)

  const box = document.createElement('div')
  box.className = 'doc-paper doc-paper--page'
  box.setAttribute('aria-hidden', 'true')
  // opacity (e não visibility): elemento invisível não recebe foco, e sem foco o execCommand não age
  Object.assign(box.style, { position: 'fixed', left: '-10000px', top: '0', width: '480px', opacity: '0', pointerEvents: 'none' })
  const text = document.createElement('div')
  text.className = 'doc-paper__text'
  const edit = document.createElement('div')
  edit.className = 'doc-paper__edit'
  edit.contentEditable = 'true'
  text.appendChild(edit)
  box.appendChild(text)
  document.body.appendChild(box)

  /** Põe a página na folha escondida, toda selecionada. */
  const load = async (p: DocPage) => {
    const style = pageStyle(docStyle, p.style)
    text.style.fontFamily = handStack(style.font)
    text.style.fontSize = `${style.size / 6}cqw`
    text.style.color = inkOf(style.ink)
    edit.innerHTML = p.html
    await loadDocFonts(p.html)
    edit.focus({ preventScroll: true })
    const sel = window.getSelection()
    const r = document.createRange()
    r.selectNodeContents(edit)
    sel?.removeAllRanges()
    sel?.addRange(r)
    return style
  }
  const state = () => { try { return document.queryCommandState(command) } catch { return false } }

  const out: DocPage[] = []
  try {
    document.execCommand('styleWithCSS', false, 'true')
    // Liga/desliga (negrito, lista...): se todas as páginas já estão assim, desliga em todas; senão liga em todas.
    let target: boolean | null = null
    if (TOGGLES.has(command)) {
      const states: boolean[] = []
      for (const p of pages) {
        if (isBlankHtml(p.html)) continue
        await load(p)
        states.push(state())
      }
      target = !states.every(Boolean)
    }
    for (const p of pages) {
      if (isBlankHtml(p.html)) { out.push(p); continue }
      const style = await load(p)
      if (target === null || state() !== target) applyFormat(edit, command, value, style)
      tidyEdit(edit, style.size)
      out.push({ ...p, html: sanitizeDocHtml(edit.innerHTML) })
    }
  } finally {
    window.getSelection()?.removeAllRanges()
    box.remove()
  }
  return out
}
