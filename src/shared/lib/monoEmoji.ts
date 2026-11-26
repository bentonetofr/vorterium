// ────────────────────────────────────────────────────────
// Emojis vazados e de uma cor só, no site inteiro. O CSS (index.css) já escolhe a fonte monocromática; falta só um detalhe:
// quem digita ou escolhe um emoji no seletor manda o caractere com o seletor de variação 16 (FE0F), que obriga o navegador a
// desenhar colorido. Aqui trocamos esse FE0F pelo FE0E (versão em texto) em todo texto que aparece na página.
// ────────────────────────────────────────────────────────

const COLOR = '️'
const TEXT = '︎'

function fix(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node as Text
    if (t.data.includes(COLOR)) t.data = t.data.split(COLOR).join(TEXT)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEXTAREA') return
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n as Text
    if (t.data.includes(COLOR)) t.data = t.data.split(COLOR).join(TEXT)
  }
}

export function installMonoEmoji() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  fix(document.body)
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') fix(r.target)
      else r.addedNodes.forEach(fix)
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}
