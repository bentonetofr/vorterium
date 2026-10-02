import { boardFont, fontStack, loadBoardFont } from '../../../shared/lib/googleFonts'

// ────────────────────────────────────────────────────────
// Texto formatado das páginas dos Documentos (negrito, itálico, letra,
// tamanho, tinta, alinhamento, listas, recuo, espaçamento). Fica guardado
// como HTML e SEMPRE passa por sanitizeDocHtml antes de ir pra tela: só
// sobram as tags e estilos de formatação abaixo — nada de script, link,
// imagem, evento ou estilo solto. Tamanhos são em cqw (proporcionais à
// largura da folha), então a página fica igual em qualquer tamanho.
// Páginas antigas (texto puro) viram HTML na hora de abrir.
// ────────────────────────────────────────────────────────

/**
 * Marca invisível (WORD JOINER, largura zero) posta no HTML onde está o
 * cursor: ela acompanha o texto quando ele corre pra outra página, e diz
 * exatamente onde o cursor volta — inclusive num item de lista novo, vazio.
 * Nunca vai pro banco (stripCaret).
 */
export const CARET_MARK = '\u2060'
export const stripCaret = (html: string): string => (html.includes(CARET_MARK) ? html.split(CARET_MARK).join('') : html)

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI'])
/** Viram parágrafo comum (ex.: títulos colados de outro lugar). */
const AS_DIV = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER'])
/** Somem junto com o que tem dentro. */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'])
const BLOCKS = new Set(['DIV', 'P', 'LI', 'UL', 'OL'])

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i
/** Tamanho da letra: só em cqw (o que a barra aplica), até 15cqw (90 na escala da barra). */
const SIZE = /^(\d{1,2}(\.\d{1,3})?)cqw$/i
/** Recuo à esquerda, em cqw, até 60. */
const INDENT = /^(\d{1,2}(\.\d{1,3})?)cqw$/i

export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2'] as const

const INLINE_RULES: Record<string, (v: string) => boolean> = {
  'color':                (v) => COLOR.test(v),
  'font-size':            (v) => SIZE.test(v) && parseFloat(v) <= 15,
  'font-weight':          (v) => /^(bold|bolder|normal|[1-9]00)$/i.test(v),
  'font-style':           (v) => /^(italic|normal)$/i.test(v),
  'text-decoration':      (v) => /^(underline|line-through|none|underline line-through|line-through underline)$/i.test(v),
  'text-decoration-line': (v) => /^(underline|line-through|none|underline line-through|line-through underline)$/i.test(v),
}
const BLOCK_RULES: Record<string, (v: string) => boolean> = {
  'text-align':  (v) => /^(left|center|right|justify|start|end)$/i.test(v),
  'line-height': (v) => (LINE_HEIGHTS as readonly string[]).includes(v),
  'margin-left': (v) => INDENT.test(v) && parseFloat(v) <= 60,
}

/** Primeiro nome de uma lista de fontes, sem aspas ("Pirata One", serif → Pirata One). */
function firstFamily(value: string): string {
  return (value.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').trim()
}

function cleanStyle(style: string, block: boolean): string[] {
  const out: string[] = []
  for (const part of style.split(';')) {
    const i = part.indexOf(':')
    if (i < 0) continue
    const prop = part.slice(0, i).trim().toLowerCase()
    const value = part.slice(i + 1).trim()
    // Letra: só as da galeria do site (e sempre escrita do mesmo jeito).
    if (prop === 'font-family') {
      const stack = fontStack(firstFamily(value))
      if (stack) out.push(`font-family: ${stack}`)
      continue
    }
    const rule = INLINE_RULES[prop] ?? (block ? BLOCK_RULES[prop] : undefined)
    if (rule && rule(value)) out.push(`${prop}: ${value}`)
  }
  return out
}

/** <font size="1–7"> (alguns navegadores) → tamanho em cqw. */
const FONT_SIZE_CQW: Record<string, string> = { 1: '2cqw', 2: '2.667cqw', 4: '4cqw', 5: '5.333cqw', 6: '6.667cqw', 7: '9.333cqw' }

function cleanNode(node: Node, doc: Document): Node[] {
  if (node.nodeType === Node.TEXT_NODE) return [doc.createTextNode(node.textContent ?? '')]
  if (node.nodeType !== Node.ELEMENT_NODE) return []
  const el = node as Element
  let tag = el.tagName.toUpperCase()
  if (DROP_TAGS.has(tag)) return []
  const children = [...el.childNodes].flatMap((c) => cleanNode(c, doc))
  if (AS_DIV.has(tag)) tag = 'DIV'
  const isFont = tag === 'FONT'
  if (isFont) tag = 'SPAN'
  // Tag desconhecida: fica só o conteúdo.
  if (!ALLOWED_TAGS.has(tag)) return children
  const clean = doc.createElement(tag.toLowerCase())
  const css = el.getAttribute('style') && tag !== 'BR' ? cleanStyle(el.getAttribute('style')!, BLOCKS.has(tag)) : []
  if (isFont) {
    // <font face/color/size> vira estilo.
    const face = fontStack(firstFamily(el.getAttribute('face') ?? ''))
    const color = el.getAttribute('color')
    const size = FONT_SIZE_CQW[el.getAttribute('size') ?? '']
    if (face) css.push(`font-family: ${face}`)
    if (color && COLOR.test(color)) css.push(`color: ${color}`)
    if (size) css.push(`font-size: ${size}`)
  }
  // align="center" (Firefox, colado) vira text-align.
  const align = el.getAttribute('align')
  if (align && BLOCKS.has(tag) && /^(left|center|right|justify)$/i.test(align)) css.push(`text-align: ${align.toLowerCase()}`)
  if (css.length) clean.setAttribute('style', css.join('; '))
  // Lista numerada que continua de outra página começa no número certo;
  // item que continua da página anterior não repete o marcador.
  if (tag === 'OL' && /^\d{1,4}$/.test(el.getAttribute('start') ?? '')) clean.setAttribute('start', el.getAttribute('start')!)
  if (tag === 'LI' && el.hasAttribute('data-cont')) clean.setAttribute('data-cont', '')
  clean.append(...children)
  return [clean]
}

/** HTML de página só com formatação permitida (seguro pra innerHTML). */
export function sanitizeDocHtml(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const box = doc.createElement('div')
  box.append(...[...doc.body.childNodes].flatMap((n) => cleanNode(n, doc)))
  return box.innerHTML
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Texto puro (páginas antigas) → HTML. */
export function textToHtml(text: string): string {
  return text ? escapeHtml(text).replace(/\n/g, '<br>') : ''
}

/** A página não tem nada escrito (só estrutura vazia)? */
export function isBlankHtml(html: string): boolean {
  return !html || !/[^\s]/.test(html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '))
}

const FAMILY_IN_HTML = /font-family:\s*(?:&quot;|")([^"&;]+)/g

/** Baixa as letras que aparecem no HTML (cada uma uma vez só). */
export function loadDocFonts(html: string): Promise<void> {
  const loads: Promise<void>[] = []
  for (const m of html.matchAll(FAMILY_IN_HTML)) if (boardFont(m[1])) loads.push(loadBoardFont(m[1]))
  return Promise.all(loads).then(() => undefined)
}
