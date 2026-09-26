import { ATTRIBUTES, BODY_PARTS, DOMAINS, GENESIS, RAIZES } from '../constants/altherium'
import { findArmor, findItem, findWeapon } from '../constants/altheriumItems'
import { RUNASKIN_TRAILS, RUNASKIN_TRIUMPHS, TRIUMPH_ACTION_LABELS, findBerserkerTriumph, type TriumphAction } from '../constants/altheriumTriumphs'

// ────────────────────────────────────────────────────────
// Tradução das mudanças de ficha registradas pelo banco (atividade
// "sheet_changed", ver migration 20240158) em linhas pra aba Atividade.
// O banco guarda campo cru + valor de antes e depois; os nomes (raiz,
// domínio, item do catálogo, triunfo) moram aqui no código.
// ────────────────────────────────────────────────────────

/** Uma mudança como o banco guarda. */
export interface RawSheetChange {
  k:     string
  f:     string
  from:  unknown
  to:    unknown
  meta?: Record<string, unknown> | null
}

export type ChangeTone = 'up' | 'down' | 'neutral' | 'added' | 'removed'

/** Uma linha pronta pra mostrar. */
export interface SheetChangeLine {
  key:    string
  label:  string
  /** "antes → depois" (quando faz sentido). */
  from?:  string | null
  to?:    string | null
  /** Texto no lugar de antes/depois (ex.: "adicionado ×2"). */
  note?:  string
  /** Diferença numérica (+3, −4). */
  delta?: number
  tone:   ChangeTone
  /** Texto longo (anotações, descrição) — a tela mostra antes/depois recolhido. */
  long?:  { from: string; to: string }
  /** Sub-mudanças (item personalizado, runa editada). */
  details?: string[]
}

const ATTR_LABELS = Object.fromEntries(ATTRIBUTES.map((a) => [`attr_${a.id}`, a.label]))
const ZONE_LABELS = Object.fromEntries(BODY_PARTS.map((b) => [b.id, b.label])) as Record<string, string>

const NUMBER_LABELS: Record<string, string> = {
  level:               'Nível',
  vitality_current:    'PV',
  vitality_max:        'PV máximo',
  equilibrio_current:  'PE',
  equilibrio_max:      'PE máximo',
  fv_current:          'FV',
  fv_max:              'FV máximo',
  pr_current:          'PR',
  pr_max:              'PR máximo',
  cards_current:       'Cartas',
  hacksilvers:         'Hacksilvers',
  runaskin_scene_uses: 'Usos de runa na cena',
  vitality_roll:       'd10 de Vitalidade',
  equilibrio_roll:     'd10 de Equilíbrio',
  fv_roll:             'd10 de FV',
  pr_roll:             'd10 de PR',
  ...ATTR_LABELS,
  ...Object.fromEntries(BODY_PARTS.map((b) => [b.id, `DB ${b.label}`])),
  ...Object.fromEntries(BODY_PARTS.map((b) => [`dano_${b.id.slice(3)}`, `Dano ${b.label}`])),
}

function str(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}

function num(v: unknown): number | null {
  return typeof v === 'number' ? v : v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null
}

function itemName(meta: Record<string, unknown> | null | undefined): string {
  const custom = str(meta?.custom_name)
  if (custom) return custom
  const id = str(meta?.item_id) ?? ''
  return findWeapon(id)?.name ?? findArmor(id)?.name ?? findItem(id)?.name ?? id
}

function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: unknown): string | null {
  const s = str(id)
  if (!s) return null
  return list.find((x) => x.id === s)?.label ?? s
}

function numberLine(key: string, label: string, from: unknown, to: unknown, fmt = (n: number) => String(n)): SheetChangeLine {
  const a = num(from)
  const b = num(to)
  const delta = a != null && b != null ? b - a : undefined
  return {
    key, label,
    from: a == null ? '—' : fmt(a),
    to:   b == null ? '—' : fmt(b),
    delta,
    tone: delta == null || delta === 0 ? 'neutral' : delta > 0 ? 'up' : 'down',
  }
}

/** Diferença entre dois objetos pequenos (campo: antes → depois). */
function objectDiff(from: unknown, to: unknown, labels: Record<string, string>): string[] {
  const a = (from ?? {}) as Record<string, unknown>
  const b = (to ?? {}) as Record<string, unknown>
  const out: string[] = []
  for (const key of Object.keys(labels)) {
    const va = a[key]
    const vb = b[key]
    if (JSON.stringify(va ?? null) === JSON.stringify(vb ?? null)) continue
    const fmt = (v: unknown) => {
      if (v == null || v === '') return '—'
      if (typeof v === 'boolean') return v ? 'sim' : 'não'
      if (key === 'acao' && typeof v === 'string') return TRIUMPH_ACTION_LABELS[v as TriumphAction] ?? v
      const s = String(v)
      return s.length > 60 ? `${s.slice(0, 59)}…` : s
    }
    if (key === 'imagem') { out.push(`${labels[key]}: ${!va ? 'colocada' : !vb ? 'removida' : 'trocada'}`); continue }
    out.push(`${labels[key]}: ${fmt(va)} → ${fmt(vb)}`)
  }
  return out
}

const RUNE_FIELDS = { nome: 'Nome', custo: 'Custo (PR)', teste: 'Teste', acao: 'Ação', alcance: 'Alcance', descricao: 'Descrição', imagem: 'Foto' }
const ITEM_FIELDS = { nome: 'Nome', detalhe: 'Detalhe', db: 'DB', dano: 'Dano', tipo: 'Tipo de dano', atributo: 'Atributo', alcance: 'Alcance' }

// Ordem de leitura: quem é → atributos → recursos → defesa → dinheiro →
// domínios → triunfos/runas → inventário → anotações.
const RANK_PREFIXES: [RegExp, number][] = [
  [/^(character_name|raiz|genesis|level|portrait_url)$/, 0],
  [/^attr_/, 1],
  [/^(vitality|equilibrio|fv|pr|cards)_/, 2],
  [/^(db|dano)_/, 3],
  [/^hacksilvers$/, 4],
  [/^domain$/, 5],
  [/^(berserker_triumphs|runaskin_|pilar_card_mode|rune)/, 6],
  [/^(item|equip|itemedit)$/, 7],
  [/^notes$/, 9],
]

/** Posição da mudança na lista (menor vem antes). */
export function changeRank(c: RawSheetChange): number {
  const hit = RANK_PREFIXES.find(([re]) => re.test(c.f))
  return hit ? hit[1] : 8
}

/** Traduz uma mudança em uma ou mais linhas (listas viram uma linha por item). */
export function describeChange(c: RawSheetChange): SheetChangeLine[] {
  const key = c.k

  switch (c.f) {
    case 'domain': {
      const label = `Domínio ${labelOf(DOMAINS, c.meta?.domain) ?? ''}`.trim()
      return [numberLine(key, label, c.from, c.to)]
    }

    case 'item': {
      const name = itemName(c.meta)
      const a = num(c.from)
      const b = num(c.to)
      if (a == null) return [{ key, label: name, note: `adicionado${b && b > 1 ? ` ×${b}` : ''}`, tone: 'added' }]
      if (b == null) return [{ key, label: name, note: `removido${a > 1 ? ` (tinha ${a})` : ''}`, tone: 'removed' }]
      return [numberLine(key, `Quantidade de ${name}`, a, b)]
    }

    case 'equip': {
      const name = itemName(c.meta)
      const zone = (v: unknown) => (str(v) === 'sim' ? 'equipado' : ZONE_LABELS[str(v) ?? ''] ?? str(v))
      if (c.from == null) return [{ key, label: name, note: `equipado${ZONE_LABELS[str(c.to) ?? ''] ? ` em ${ZONE_LABELS[str(c.to)!]}` : ''}`, tone: 'added' }]
      if (c.to == null) return [{ key, label: name, note: 'desequipado', tone: 'removed' }]
      return [{ key, label: name, from: zone(c.from), to: zone(c.to), tone: 'neutral' }]
    }

    case 'itemedit':
      return [{ key, label: `Item personalizado ${itemName(c.meta)}`, note: 'editado', tone: 'neutral', details: objectDiff(c.from, c.to, ITEM_FIELDS) }]

    case 'rune': {
      const before = (c.from ?? null) as Record<string, unknown> | null
      const after = (c.to ?? null) as Record<string, unknown> | null
      if (!before && after) {
        return [{ key, label: str(after.nome) ?? 'Runa', note: `runa criada (${num(after.custo) ?? 0} PR)`, tone: 'added' }]
      }
      if (before && !after) return [{ key, label: str(before.nome) ?? 'Runa', note: 'runa apagada', tone: 'removed' }]
      return [{ key, label: str(after?.nome) ?? str(c.meta?.name) ?? 'Runa', note: 'runa editada', tone: 'neutral', details: objectDiff(before, after, RUNE_FIELDS) }]
    }
  }

  // ── Campos da própria ficha ──
  const field = c.f
  if (field in NUMBER_LABELS) {
    const fmt = field === 'hacksilvers' ? (n: number) => `¤${n.toLocaleString('pt-BR')}` : undefined
    return [numberLine(key, NUMBER_LABELS[field], c.from, c.to, fmt)]
  }

  switch (field) {
    case 'character_name':
      return [{ key, label: 'Nome', from: str(c.from) ?? '—', to: str(c.to) ?? '—', tone: 'neutral' }]
    case 'raiz':
      return [{ key, label: 'Raiz', from: labelOf(RAIZES, c.from) ?? '—', to: labelOf(RAIZES, c.to) ?? '—', tone: 'neutral' }]
    case 'genesis':
      return [{ key, label: 'Gênesis', from: labelOf(GENESIS, c.from) ?? '—', to: labelOf(GENESIS, c.to) ?? '—', tone: 'neutral' }]
    case 'runaskin_trail':
      return [{ key, label: 'Trilha', from: labelOf(RUNASKIN_TRAILS, c.from) ?? '—', to: labelOf(RUNASKIN_TRAILS, c.to) ?? '—', tone: 'neutral' }]
    case 'pilar_card_mode': {
      const mode = (v: unknown) => (v === 'fisico' ? 'Cartas físicas' : v === 'virtual' ? 'Baralho virtual' : str(v) ?? '—')
      return [{ key, label: 'Modo das cartas', from: mode(c.from), to: mode(c.to), tone: 'neutral' }]
    }
    case 'portrait_url':
      return [{ key, label: 'Retrato', note: c.to ? (c.from ? 'trocado' : 'colocado') : 'removido', tone: c.to ? 'added' : 'removed' }]
    case 'notes': {
      const from = str(c.from) ?? ''
      const to = str(c.to) ?? ''
      return [{ key, label: 'Anotações', note: !from ? 'escritas' : !to ? 'apagadas' : 'editadas', tone: 'neutral', long: { from, to } }]
    }
    case 'berserker_triumphs': {
      const a = new Set((c.from as string[] | null) ?? [])
      const b = new Set((c.to as string[] | null) ?? [])
      const name = (id: string) => findBerserkerTriumph(id)?.name ?? id
      const lines: SheetChangeLine[] = []
      for (const id of b) if (!a.has(id)) lines.push({ key: `${key}:${id}`, label: `Triunfo ${name(id)}`, note: 'aprendido', tone: 'added' })
      for (const id of a) if (!b.has(id)) lines.push({ key: `${key}:${id}`, label: `Triunfo ${name(id)}`, note: 'removido', tone: 'removed' })
      return lines
    }
    case 'runaskin_trail_overrides': {
      const a = (c.from ?? {}) as Record<string, Record<string, unknown>>
      const b = (c.to ?? {}) as Record<string, Record<string, unknown>>
      const book = (id: string) => RUNASKIN_TRIUMPHS.find((t) => t.id === id)?.name ?? id
      const lines: SheetChangeLine[] = []
      for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (JSON.stringify(a[id] ?? null) === JSON.stringify(b[id] ?? null)) continue
        if (!b[id]) {
          lines.push({ key: `${key}:${id}`, label: `Triunfo da trilha ${book(id)}`, note: 'restaurado ao livro', tone: 'neutral' })
          continue
        }
        const toFields = (o: Record<string, unknown> | undefined) => o && ({
          nome: o.name, custo: o.cost, teste: o.test, acao: o.action, alcance: o.range, descricao: o.description,
          imagem: o.image_url ?? false,
        })
        const base = RUNASKIN_TRIUMPHS.find((t) => t.id === id)
        const before = a[id] ? toFields(a[id]) : base && toFields({ ...base } as unknown as Record<string, unknown>)
        lines.push({
          key: `${key}:${id}`, label: `Triunfo da trilha ${book(id)}`, note: 'editado', tone: 'neutral',
          details: objectDiff(before, toFields(b[id]), RUNE_FIELDS),
        })
      }
      return lines
    }
  }

  // Campo que a tela ainda não conhece: mostra cru.
  return [{ key, label: field, from: JSON.stringify(c.from), to: JSON.stringify(c.to), tone: 'neutral' }]
}
