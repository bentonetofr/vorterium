import { describe, expect, it } from 'vitest'
import { summarizePlayers, type PlayerRef, type StatRoll } from './playerStats'

let n = 0
function d20(user: string, v: number, over: Partial<StatRoll> = {}): StatRoll {
  n += 1
  return {
    id: `r${n}`, campaign_id: 'c', user_id: user, die_type: 'd20', result: v, individual_results: [v],
    roll_breakdown: [{ type: 'sum', notation: '1d20', quantity: 1, sides: 20, results: [v], subtotal: v }],
    roll_context: null, created_at: new Date(Date.UTC(2026, 10, 8, 12, 0, n)).toISOString(), ...over,
  }
}
const members: PlayerRef[] = [
  { userId: 'a', name: 'Ana', role: 'player' },
  { userId: 'b', name: 'Beto', role: 'player' },
  { userId: 'm', name: 'Mestre', role: 'master' },
]

describe('painel do dono: jogadores', () => {
  it('um resumo por membro, mesmo quem nunca rolou', () => {
    const out = summarizePlayers([d20('a', 15)], members)
    expect(out.map((p) => p.name)).toEqual(['Ana', 'Beto', 'Mestre'])
    expect(out[1]).toMatchObject({ rolls: 0, d20: 0, d20Avg: null, d20Max: null, lastAt: null, recent: [] })
  })

  it('conta d20, média, maior e menor, críticos e falhas', () => {
    const rolls = [d20('a', 20), d20('a', 1), d20('a', 9), d20('b', 12)]
    const [ana, beto] = summarizePlayers(rolls, members)
    expect(ana).toMatchObject({ rolls: 3, d20: 3, d20Max: 20, d20Min: 1, strong: 1, weak: 1 })
    expect(ana.d20Avg).toBeCloseTo(10)
    expect(beto).toMatchObject({ rolls: 1, d20Avg: 12, strong: 0, weak: 0 })
  })

  it('outros dados não entram na conta do d20, mas contam como rolagem', () => {
    const d6: StatRoll = { ...d20('a', 8), die_type: 'd6', roll_breakdown: [{ type: 'sum', notation: '2d6', quantity: 2, sides: 6, results: [3, 5], subtotal: 8 }] }
    const [ana] = summarizePlayers([d6, d20('a', 14)], members)
    expect(ana).toMatchObject({ rolls: 2, d20: 1, d20Avg: 14 })
  })

  it('sucessos e falhas vêm do que a ficha classificou', () => {
    const rolls = [
      d20('a', 15, { roll_context: { outcome: 'success' } }), d20('a', 14, { roll_context: { outcome: 'success' } }),
      d20('a', 4, { roll_context: { outcome: 'failure' } }), d20('a', 10),
    ]
    expect(summarizePlayers(rolls, members)[0]).toMatchObject({ successes: 2, failures: 1 })
  })

  it('as mais recentes primeiro, limitadas, e a última data', () => {
    const rolls = Array.from({ length: 12 }, (_, i) => d20('a', 2 + i))
    const [ana] = summarizePlayers(rolls, members, 5)
    expect(ana.recent).toHaveLength(5)
    expect(ana.recent[0].result).toBe(13)
    expect(ana.lastAt).toBe(rolls[11].created_at)
  })

  it('quem rolou e saiu da campanha aparece no fim, com o nome do perfil', () => {
    const out = summarizePlayers([d20('x', 7, { profile: { display_name: 'Cris' } }), d20('y', 7)], members)
    expect(out.slice(3).map((p) => [p.name, p.rolls])).toEqual([['Cris', 1], ['Ex-membro', 1]])
  })
})
