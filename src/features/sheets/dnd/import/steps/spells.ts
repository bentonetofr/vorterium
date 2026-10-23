import type { DndCharacterSpellInput } from '../../../../../shared/types'
import type { SpellEntry } from '../../catalog'
import { SPELL_SCHOOL_LABEL } from '../../catalog/spellUtils'
import type { Ctx } from '../ctx'
import { matchSpell } from '../match'
import type { ReadSpell } from '../readTypes'
import { clip, fold, parseInt0 } from '../text'

// ────────────────────────────────────────────────────────
// Etapa 7: as magias (da lista por nível e das cartas) e os espaços de magia
// gastos. Magia com o nome do catálogo entra direto; com outro nome (a
// tradução oficial muitas vezes difere) a carta do PDF ajuda a achar a do
// catálogo e a pessoa confirma; as que não existem no catálogo viram magias
// próprias com os dados da carta.
// ────────────────────────────────────────────────────────

const SMALL = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'com', 'para'])

/** "SUSSURROS DISSONANTES" → "Sussurros Dissonantes" (só mexe em nome todo em maiúsculas). */
export function titleCase(name: string): string {
  const t = name.trim()
  if (t !== t.toUpperCase() || t === t.toLowerCase()) return t
  return t.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}

function bookRow(e: SpellEntry, prepared: boolean): DndCharacterSpellInput {
  return {
    name: e.name, spell_level: e.level, school: SPELL_SCHOOL_LABEL[e.school], casting_time: e.castingTime, spell_range: e.range, duration: e.duration,
    concentration: !!e.concentration, ritual: !!e.ritual, prepared, description: '', catalog_key: e.key, sort_order: 0,
  }
}

function ownRow(s: ReadSpell): DndCharacterSpellInput {
  const card = s.card
  const text = [card?.components ? `Componentes: ${card.components}` : '', card?.save ? `Salvaguarda: ${card.save}` : '', card?.effect ?? ''].filter(Boolean).join('\n\n')
  return {
    name: titleCase(s.name).slice(0, 120), spell_level: Math.max(0, Math.min(9, s.level)), school: (card?.school ?? '').slice(0, 60),
    casting_time: (card?.castingTime ?? '').slice(0, 80), spell_range: (card?.range ?? '').slice(0, 80), duration: (card?.duration ?? '').slice(0, 80),
    concentration: !!card?.concentration, ritual: !!card?.ritual, prepared: s.prepared, description: text.slice(0, 6000), catalog_key: null, sort_order: 0,
  }
}

function spells(c: Ctx): void {
  const out: DndCharacterSpellInput[] = []
  const seen = new Set<string>()
  for (const s of c.read.spellcasting.spells) {
    const found = matchSpell(s, c.spells)
    // só entram na pergunta as magias que se parecem de verdade
    const m = { exact: found.exact, candidates: found.candidates.filter((x) => x.score >= 0.55) }
    let row: DndCharacterSpellInput | null
    if (m.exact) row = bookRow(m.exact, s.prepared)
    else {
      const levelLabel = s.level === 0 ? 'truque' : `${s.level}º nível`
      const card = s.card
      const body = [
        `No PDF: ${levelLabel}${card?.range ? ` · alcance ${card.range}` : ''}${card?.castingTime ? ` · ${card.castingTime}` : ''}${card?.duration ? ` · ${card.duration}` : ''}${card?.components ? ` · ${card.components}` : ''}.`,
        m.candidates.length ? 'O nome não é igual ao de nenhuma magia do catálogo. Estas se parecem (comparei nível, alcance, tempo, duração e componentes):' : 'Esta magia não está no catálogo (que tem as magias do documento livre SRD). Ela pode entrar como magia própria, com os dados da carta do PDF.',
      ].join('\n')
      const pick = c.askChoice({
        id: `spell:${fold(s.name).replace(/ /g, '_')}`, section: 'Magias', kind: 'choice',
        title: `A magia "${titleCase(s.name)}" é qual?`, body,
        options: [
          ...m.candidates.map((x) => ({ value: x.entry.key, label: `${x.entry.name} (${x.entry.original})`, hint: x.reasons.length ? `bate em: ${x.reasons.join(', ')}` : clip(x.entry.text[0] ?? '', 90) })),
          { value: 'custom', label: `Magia própria "${titleCase(s.name)}"`, hint: card ? 'Guarda os dados da carta do PDF.' : 'Guarda só o nome e o nível.' },
          { value: 'skip', label: 'Não importar esta magia' },
        ],
        recommended: m.candidates[0] && m.candidates[0].score >= 0.7 ? m.candidates[0].entry.key : undefined,
      })
      if (pick === 'skip') row = null
      else if (pick === 'custom') row = ownRow(s)
      else { const e = c.spells.find((x) => x.key === pick); row = e ? bookRow(e, s.prepared) : ownRow(s) }
    }
    if (!row) continue
    const key = row.catalog_key ?? `own:${fold(row.name)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  out.sort((a, b) => a.spell_level - b.spell_level)
  out.forEach((r, i) => { r.sort_order = i })
  c.draft.spells = out
  if (out.length) c.note(`Magias: ${out.length} (${out.filter((r) => r.catalog_key).length} do catálogo, ${out.filter((r) => !r.catalog_key).length} próprias)`)
}

/** Espaços de magia gastos: pelo "restantes" escrito ou, nos círculos marcados, depois de perguntar o que a marca quer dizer. */
function slots(c: Ctx): void {
  const maxes = c.derive().derived.spellcasting?.slots ?? []
  const rows = c.read.spellcasting.slots.filter((s) => s.total !== '' || s.remaining !== '' || s.marked > 0)
  if (rows.length === 0) return
  let marksMeaning: 'used' | 'free' | null = null
  for (const s of rows) {
    const max = maxes[s.level - 1] ?? 0
    const total = parseInt0(s.total)
    const left = parseInt0(s.remaining)
    if (total != null && total !== max) c.note(`Espaços de ${s.level}º nível: o PDF diz ${total} e o sistema calcula ${max} pela classe e nível (vale o do sistema).`)
    if (max === 0) continue
    if (left != null && left >= 0) { c.draft.slotsUsed[s.level] = Math.max(0, Math.min(max, max - left)); continue }
    if (s.marked > 0) {
      if (marksMeaning == null) {
        marksMeaning = c.askChoice({
          id: 'slots-marks', section: 'Magias', kind: 'choice',
          title: 'Os círculos marcados dos espaços de magia são gastos ou disponíveis?',
          body: `No PDF há círculos marcados nos espaços de magia (por exemplo, ${s.marked} marcados no ${s.level}º nível, que tem ${total ?? max} espaços).`,
          options: [
            { value: 'used', label: 'Marcado = espaço gasto', hint: 'Os que não estão marcados ainda podem ser usados.' },
            { value: 'free', label: 'Marcado = espaço disponível', hint: 'Os que não estão marcados já foram gastos.' },
          ],
        }) as 'used' | 'free'
      }
      const cap = total ?? max
      const used = marksMeaning === 'used' ? s.marked : Math.max(0, cap - s.marked)
      c.draft.slotsUsed[s.level] = Math.max(0, Math.min(max, used))
    }
  }
  const used = Object.entries(c.draft.slotsUsed).filter(([, n]) => n > 0)
  if (used.length) c.note(`Espaços de magia gastos: ${used.map(([l, n]) => `${l}º nível: ${n}`).join(', ')}`)
}

export const SPELL_STEPS = [spells, slots]
