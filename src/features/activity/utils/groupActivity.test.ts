import { describe, expect, it } from 'vitest'
import { groupActivity, groupTitle, type GroupableActivity } from './groupActivity'

let n = 0
function roll(minutesAgo: number, over: Partial<GroupableActivity> = {}): GroupableActivity {
  n += 1
  return {
    id: `a${n}`,
    campaign_id: 'c1',
    actor_id: 'u1',
    type: 'dice_rolled',
    created_at: new Date(Date.UTC(2026, 10, 11, 12, 0) - minutesAgo * 60_000).toISOString(),
    ...over,
  }
}

describe('groupActivity', () => {
  it('junta três ou mais rolagens seguidas da mesma pessoa na mesma campanha', () => {
    const items = [roll(0), roll(1), roll(2), roll(3)]
    const out = groupActivity(items)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ kind: 'group' })
    expect(out[0].kind === 'group' && out[0].items).toEqual(items)
  })

  it('duas rolagens seguidas continuam soltas', () => {
    const out = groupActivity([roll(0), roll(1)])
    expect(out.map((e) => e.kind)).toEqual(['single', 'single'])
  })

  it('outro tipo de atividade no meio quebra a sequência e aparece sozinho', () => {
    const out = groupActivity([roll(0), roll(1), roll(2), roll(3, { type: 'note_created' }), roll(4), roll(5), roll(6)])
    expect(out.map((e) => e.kind)).toEqual(['group', 'single', 'group'])
  })

  it('pessoa diferente, campanha diferente ou intervalo longo começam outro bloco', () => {
    expect(groupActivity([roll(0), roll(1), roll(2), roll(3, { actor_id: 'u2' }), roll(4, { actor_id: 'u2' }), roll(5, { actor_id: 'u2' })]).map((e) => e.kind))
      .toEqual(['group', 'group'])
    expect(groupActivity([roll(0), roll(1), roll(2, { campaign_id: 'c2' })]).map((e) => e.kind))
      .toEqual(['single', 'single', 'single'])
    expect(groupActivity([roll(0), roll(1), roll(60), roll(61), roll(62)]).map((e) => e.kind))
      .toEqual(['single', 'single', 'group'])
  })

  it('mantém a ordem e não perde nem repete nada', () => {
    const items = [roll(0, { type: 'member_joined' }), roll(1), roll(2), roll(3), roll(4, { type: 'session_created' }), roll(5)]
    const flat = groupActivity(items).flatMap((e) => (e.kind === 'group' ? e.items : [e.item]))
    expect(flat).toEqual(items)
  })

  it('triunfos e fichas atualizadas também se juntam, mas não misturados com rolagens', () => {
    const out = groupActivity([
      roll(0, { type: 'triumph_used' }), roll(1, { type: 'triumph_used' }), roll(2, { type: 'triumph_used' }),
      roll(3), roll(4),
      roll(5, { type: 'sheet_updated' }), roll(6, { type: 'sheet_updated' }), roll(7, { type: 'sheet_updated' }),
    ])
    expect(out.map((e) => e.kind)).toEqual(['group', 'single', 'single', 'group'])
    expect(groupTitle('triumph_used', 3)).toBe('3 triunfos usados em sequência')
    expect(groupTitle('sheet_updated', 3)).toBe('Ficha atualizada 3 vezes')
    expect(groupTitle('dice_rolled', 4)).toBe('4 rolagens seguidas')
  })

  it('lista vazia', () => {
    expect(groupActivity([])).toEqual([])
  })
})
