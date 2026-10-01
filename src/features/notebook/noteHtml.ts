import { boardFont, fontStack, loadBoardFont } from '../../shared/lib/googleFonts'

// ────────────────────────────────────────────────────────
// Texto das anotações com formatação (negrito, itálico, cor, tamanho,
// listas…). Fica guardado como HTML, mas SEMPRE passa por sanitizeNoteHtml
// antes de ir pra tela: só sobram as tags e estilos de formatação da lista
// abaixo — nada de script, link, imagem, evento ou estilo solto. Anotações
// antigas (texto puro, de antes da formatação) viram HTML na hora de abrir.
// ────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'FONT', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI'])
/** Somem junto com o que tem dentro. */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK'])

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i
const SIZE = /^(xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger|\d{1,3}(\.\d+)?(px|em|rem|%))$/i

const STYLE_RULES: Record<string, RegExp> = {
  'color':                 COLOR,
  'background-color':      COLOR,
  'font-size':             SIZE,
  'font-weight':           /^(bold|bolder|normal|[1-9]00)$/i,
  'font-style':            /^(italic|normal)$/i,
  'text-decoration':       /^(underline|line-through|none|underline line-through|line-through underline)$/i,
  'text-decoration-line':  /^(underline|line-through|none|underline line-through|line-through underline)$/i,
}

/** Primeiro nome de uma lista de fontes, sem aspas ("Pirata One", serif → Pirata One). */
function firstFamily(value: string): string {
  return (value.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').trim()
}

function cleanStyle(style: string): string {
  const out: string[] = []
  for (const part of style.split(';')) {
    const i = part.indexOf(':')
    if (i < 0) continue
    const prop = part.slice(0, i).trim().toLowerCase()
    const value = part.slice(i + 1).trim()
    // Fonte: só as da galeria do site (e sempre escrita do mesmo jeito).
    if (prop === 'font-family') {
      const stack = fontStack(firstFamily(value))
      if (stack) out.push(`font-family: ${stack}`)
      continue
    }
    const rule = STYLE_RULES[prop]
    if (rule && rule.test(value)) out.push(`${prop}: ${value}`)
  }
  return out.join('; ')
}

function cleanNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? '')]
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  const tag = el.tagName.toUpperCase()
  if (DROP_TAGS.has(tag)) return []
  const children = [...el.childNodes].flatMap((c) => cleanNode(c, doc))
  // Tag desconhecida: fica só o conteúdo.
  if (!ALLOWED_TAGS.has(tag)) return children
  const clean = doc.createElement(tag.toLowerCase())
  const style = el.getAttribute('style')
  // <font face="…"> (alguns navegadores) vira estilo, se a fonte é da galeria.
  const face = tag === 'FONT' ? fontStack(firstFamily(el.getAttribute('face') ?? '')) : undefined
  const css = [style && tag !== 'BR' ? cleanStyle(style) : '', face ? `font-family: ${face}` : ''].filter(Boolean).join('; ')
  if (css) clean.setAttribute('style', css)
  if (tag === 'FONT') {
    const color = el.getAttribute('color')
    const size = el.getAttribute('size')
    if (color && COLOR.test(color)) clean.setAttribute('color', color)
    if (size && /^[1-7]$/.test(size)) clean.setAttribute('size', size)
  }
  clean.append(...children)
  return [clean]
}

/** HTML de anotação só com formatação permitida (seguro pra innerHTML). */
export function sanitizeNoteHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const box = doc.createElement('div')
  box.append(...[...doc.body.childNodes].flatMap((n) => cleanNode(n, doc)))
  return box.innerHTML
}

const LOOKS_HTML = /<\/?(b|strong|i|em|u|s|strike|del|span|font|br|div|p|ul|ol|li)\b[^>]*>/i

/** >, <, & e espaço duro viram &gt;, &lt;, &amp; e &nbsp; no HTML guardado. */
const HAS_ENTITY = /&(gt|lt|amp|quot|nbsp|#\d{1,6});/i
/** "&amp;gt;", "&amp;amp;gt;"…: um > escapado de novo a cada vez que a nota abria. */
const REESCAPED = /&(?:amp;)+(?=(?:gt|lt|amp|quot|nbsp|#\d{1,6});)/gi

/**
 * HTML ou texto puro? Nota de uma linha só (ou escrita no Firefox, que guarda
 * as quebras de linha como texto) não tem tag nenhuma — mas um >, < ou & no
 * meio já vem como &gt;, &lt;, &amp;, e isso também é HTML.
 */
export function isHtmlNote(content: string): boolean {
  return LOOKS_HTML.test(content) || HAS_ENTITY.test(content)
}

/** Conserta notas que ficaram com "&gt;" aparecendo no lugar do ">". */
function unreescape(html: string): string {
  return html.replace(REESCAPED, '&')
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const FAMILY_IN_HTML = /font-family:\s*(?:&quot;|")([^"&;]+)/g

/** Baixa as fontes que aparecem no HTML da anotação (cada uma uma vez só). */
export function loadNoteFonts(html: string): void {
  for (const m of html.matchAll(FAMILY_IN_HTML)) if (boardFont(m[1])) void loadBoardFont(m[1])
}

/** O que vai pra tela: HTML limpo (anotação antiga em texto puro vira HTML). */
export function noteToHtml(content: string): string {
  if (!content) return ''
  if (isHtmlNote(content)) {
    const html = sanitizeNoteHtml(unreescape(content))
    loadNoteFonts(html)
    return html
  }
  return escapeHtml(content).replace(/\n/g, '<br>')
}

/** Só o texto (pra título da aba, "está vazia?", contagem). */
export function notePlainText(content: string): string {
  if (!content) return ''
  if (!isHtmlNote(content)) return content
  const marked = unreescape(content)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
  const doc = new DOMParser().parseFromString(`<body>${marked}</body>`, 'text/html')
  return (doc.body.textContent ?? '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
