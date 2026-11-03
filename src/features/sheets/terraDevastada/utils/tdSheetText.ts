import type { TdaSheet, TdSheet } from '../../../../shared/types'
import { buildSheetText, bullet, kv, prose } from '../../export/sheetText'

const DURATION = { curta: 'curta', media: 'média', longa: 'longa', indeterminada: 'indeterminada' } as const
const ITEM_KIND = { item: 'Item', arma: 'Arma', protecao: 'Proteção' } as const
const WEAPON_TYPE = { corpo: 'corpo a corpo', fogo: 'arma de fogo', consumivel: 'arremesso' } as const
const SUPPLIES: [string, string][] = [
  ['trapos', 'Trapos'], ['alcool', 'Álcool'], ['sucata', 'Sucata'], ['laminas', 'Lâminas'],
  ['explosivos', 'Explosivos'], ['pecas', 'Peças'], ['suplementos', 'Suplementos'], ['kits', 'Kits'],
]

/** Terra Devastada e Terra Devastada Adaptada (a adaptada tem mais campos: Vida, Mochila, materiais). */
export function tdSheetText(s: TdSheet | TdaSheet, adapted: boolean): string {
  const a = s as Partial<TdaSheet>
  const traits = (s.traits ?? []).map((t) => {
    const kind = adapted ? ((t as { kind?: string }).kind === 'defeito' ? 'Defeito' : 'Qualidade') : 'Característica'
    const tag = t.tag === 'motiva' ? ' (motiva)' : t.tag === 'desmotiva' ? ' (desmotiva)' : ''
    return bullet(`${kind}: ${t.name}${tag}`)
  })
  const conditions = (s.conditions ?? []).map((c) => bullet(`${c.name} (duração ${DURATION[c.duration] ?? c.duration})`))
  const trunfos = (s.trunfos ?? []).map((t) => bullet(`${t.name}${t.description ? `\n${t.description}` : ''}`))
  const inventory = (s.inventory ?? []).map((i) => {
    const extra: string[] = []
    if (i.kind === 'arma') extra.push(`${adapted ? 'Dano' : 'Letalidade'} ${i.level}`)
    if (i.kind === 'protecao') extra.push(`Proteção ${i.level}`)
    const w = i as { wtype?: keyof typeof WEAPON_TYPE; ammo?: number; dur?: number; up?: number }
    if (w.wtype) extra.push(WEAPON_TYPE[w.wtype] ?? w.wtype)
    if (w.ammo !== undefined) extra.push(`${w.ammo} balas`)
    if (w.dur !== undefined) extra.push(`${w.dur} usos`)
    if (w.up) extra.push(`melhoria ${w.up}`)
    return bullet(`${i.name} x${i.qty} [${ITEM_KIND[i.kind] ?? i.kind}${extra.length ? `; ${extra.join('; ')}` : ''}]`)
  })
  const supplies = adapted
    ? SUPPLIES.map(([key, label]) => kv(label, (a.supplies as Record<string, number> | null | undefined)?.[key] || null))
    : []

  return buildSheetText(`${s.character_name || 'Personagem'} - Terra Devastada${adapted ? ' Adaptada' : ''}`, [
    { title: 'Identidade', lines: [kv('Nome', s.character_name), kv('Conceito', s.concept), kv('Descrição', s.description)] },
    { title: 'Estado', lines: [
      adapted ? kv('Vida', `${a.health ?? 0}/6`) : null,
      kv('Horror', s.horror), kv('Convicção', s.conviction),
      adapted ? kv('Mochila (nível)', a.backpack) : null,
    ] },
    { title: adapted ? 'Qualidades e defeitos' : 'Características', lines: traits },
    { title: 'Condições', lines: conditions },
    { title: 'Trunfos', lines: trunfos },
    { title: 'Inventário', lines: inventory },
    { title: 'Materiais e kits', lines: supplies },
    { title: 'Passado', lines: [prose(s.background)] },
    { title: 'Anotações', lines: [prose(s.notes)] },
  ])
}
