// ────────────────────────────────────────────────────────
// Leitura de texto de ficha escrito à mão: números com sinal, velocidade em
// metros ou pés, dano com tipo, listas com marcadores e blocos de
// características. Tudo puro (sem catálogo, sem tela).
// ────────────────────────────────────────────────────────

/** Sem acento, minúsculo, só letras e números separados por um espaço. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Semelhança entre dois textos de 0 a 1 (pelos pares de letras). 1 = iguais (sem acento e maiúscula). */
export function similarity(a: string, b: string): number {
  const x = fold(a), y = fold(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1) } return m }
  const gx = grams(x), gy = grams(y)
  let hit = 0
  for (const [g, n] of gx) hit += Math.min(n, gy.get(g) ?? 0)
  const dice = (2 * hit) / Math.max(1, x.length - 1 + y.length - 1)
  // um nome dentro do outro ("couro" em "armadura de couro") conta como bem parecido
  const inside = x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))
  return inside ? Math.max(dice, 0.85) : dice
}

/** Inteiro de um campo ("+3", "−2", " 14 "); null se não for só um número inteiro. */
export function parseInt0(s: string): number | null {
  const t = s.trim().replace(/[−–—]/g, '-').replace(/^\+/, '')
  return /^-?\d{1,6}$/.test(t) ? Number(t) : null
}

export interface ParsedSpeed { feet: number; unit: 'm' | 'ft' | 'guess-m' | 'guess-ft' }

/** Deslocamento: "9m", "9 metros", "30 ft", "30 pés" ou só o número (metros se for pequeno, pés se for 15 ou mais). Devolve em pés. */
export function parseSpeed(s: string): ParsedSpeed | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-zçé.]*)\s*$/i.exec(s.replace(/,/g, '.').replace(/\.(?=\D|$)/g, ''))
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  const unit = m[2].toLowerCase().replace(/\.$/, '')
  if (!Number.isFinite(n) || n < 0 || n > 400) return null
  if (['m', 'mt', 'mts', 'metro', 'metros'].includes(unit)) return { feet: Math.round((n * 10) / 3), unit: 'm' }
  if (['ft', 'pe', 'pes', 'pé', 'pés', 'feet', "'"].includes(unit)) return { feet: Math.round(n), unit: 'ft' }
  if (unit !== '') return null
  return n >= 15 ? { feet: Math.round(n), unit: 'guess-ft' } : { feet: Math.round((n * 10) / 3), unit: 'guess-m' }
}

const DAMAGE_LETTERS: Record<string, string> = { p: 'perfurante', c: 'cortante', s: 'cortante', b: 'concussão', co: 'concussão' }
const DAMAGE_WORDS: [RegExp, string][] = [
  [/perfur|pierc/, 'perfurante'], [/cort|slash/, 'cortante'], [/contund|concuss|bludg/, 'concussão'],
  [/[aá]cido|acid/, 'ácido'], [/fogo|fire/, 'fogo'], [/frio|cold/, 'frio'], [/el[eé]tric|lightning|raio/, 'elétrico'], [/trov|thunder/, 'trovejante'],
  [/ven|poison/, 'veneno'], [/ps[ií]qu|psychic/, 'psíquico'], [/radi[aâ]n|radiant/, 'radiante'], [/necr/, 'necrótico'], [/forc|for[cç]a|force/, 'energia'],
]

/** "1d8(P)", "1d6+2 cortante", "2d6 B" → dado e tipo. Sem dado reconhecível, null. */
export function parseDamage(s: string): { dice: string; type: string } | null {
  const m = /(\d*d\d+(?:\s*[+-]\s*\d+)?|\d+)/i.exec(s)
  if (!m) return null
  const dice = m[1].replace(/\s+/g, '')
  const rest = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).trim()
  const paren = /\(([^)]*)\)/.exec(rest)
  const word = fold(paren ? paren[1] : rest)
  let type = ''
  if (/^[a-z]{1,2}$/.test(word) && DAMAGE_LETTERS[word]) type = DAMAGE_LETTERS[word]
  else for (const [re, t] of DAMAGE_WORDS) if (re.test(word)) { type = t; break }
  return { dice, type }
}

/**
 * Itens de uma lista escrita em texto: cada linha que começa com "-", "•" ou
 * "*" abre um item; as linhas seguintes sem marcador continuam o item (o PDF
 * quebra a linha onde acaba o campo). Sem nenhum marcador, cada linha é um item.
 */
export function splitBullets(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim())
  const marked = lines.some((l) => /^[-•*–]\s+\S/.test(l))
  const out: string[] = []
  for (const line of lines) {
    if (!line) continue
    const m = /^[-•*–]\s+(.*)$/.exec(line)
    if (m) out.push(m[1].trim())
    else if (marked && out.length) out[out.length - 1] += ' ' + line
    else out.push(line)
  }
  return out.filter(Boolean)
}

export interface FeatureBlock { title: string; body: string }

const INLINE_STOP = new Set(['pre requisito', 'prerequisito', 'pre requisitos', 'nota', 'obs', 'observacao', 'alcance', 'dano', 'duracao', 'exemplo', 'efeito'])

function isShout(line: string): boolean {
  const letters = line.replace(/[^A-Za-zÀ-ÿ]/g, '')
  // sem número nem parênteses: "(+2 HISTÓRIA)" é anotação, não título
  return letters.length >= 3 && line.length <= 70 && letters === letters.toUpperCase() && !/[.!?()\d+]/.test(line)
}

/**
 * Divide um texto de características em blocos (título + texto). O título é
 * uma linha só em MAIÚSCULAS, uma linha que termina em ":" ou um começo de
 * parágrafo no estilo "Título: texto". Texto antes do primeiro título vira um
 * bloco sem título.
 */
export function splitFeatureBlocks(text: string): FeatureBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''))
  const blocks: FeatureBlock[] = []
  let cur: { title: string; body: string[] } | null = null
  const flush = () => { if (cur && (cur.title || cur.body.some((b) => b.trim()))) blocks.push({ title: cur.title, body: cur.body.join('\n').trim() }); cur = null }
  let prev = ''
  for (const raw of lines) {
    const line = raw.trim()
    let title: string | null = null
    let rest = ''
    if (line && isShout(line)) title = line
    else if (/^[^:\n]{2,50}:$/.test(line) && line.split(/\s+/).length <= 7 && !INLINE_STOP.has(fold(line.slice(0, -1)))) title = line.slice(0, -1).trim()
    else {
      const inline = /^([A-ZÀ-Ý][^:\n.]{1,40}):\s+(\S.*)$/.exec(line)
      const startsFresh = prev === '' || /[.!?)]$/.test(prev)
      if (inline && startsFresh && inline[1].split(/\s+/).length <= 5 && !INLINE_STOP.has(fold(inline[1]))) { title = inline[1].trim(); rest = inline[2] }
    }
    if (title !== null) { flush(); cur = { title, body: rest ? [rest] : [] } } else {
      if (!cur) cur = { title: '', body: [] }
      cur.body.push(line)
    }
    if (line) prev = line
  }
  flush()
  return blocks.filter((b) => b.title || b.body)
}

/** Texto curto de uma linha para mostrar numa pergunta. */
export function clip(s: string, n = 80): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
