import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, isDeathTest, isStrong, isWeak, satisfied, type History, type RollLite } from './achievements'
import { COLLECTION_SKINS } from '../dice3d/skins'
import { PACK_SURFACES } from '../dice3d/dieSurfacesPack'

// ── Fábrica de rolagens ──────────────────────────────────

let n = 0
/** Uma rolagem de `qty` dados de `sides` lados com estes resultados. */
function roll(sides: number, results: number[], over: Partial<RollLite> = {}): RollLite {
  n += 1
  return {
    id: `r${n}`, campaign_id: 'c1', die_type: `d${sides}`, result: results.reduce((a, b) => a + b, 0), individual_results: results,
    roll_breakdown: [{ type: 'sum', notation: `${results.length}d${sides}`, quantity: results.length, sides, results, subtotal: results.reduce((a, b) => a + b, 0) }],
    roll_context: null, roll_label: null, created_at: '2026-11-01T12:00:00.000Z', ...over,
  }
}
const d20 = (v: number, over: Partial<RollLite> = {}) => roll(20, [v], over)
const hist = (rolls: RollLite[], extra: Partial<History> = {}): History => ({ rolls, total: rolls.length, campaigns: new Set(rolls.map((r) => r.campaign_id)).size, ...extra })
const has = (h: History, id: string) => satisfied(h).some((a) => a.id === id)
const filler = (count: number) => Array.from({ length: count }, (_, i) => d20(2 + (i % 17)))

describe('coleção: as 20 conquistas', () => {
  it('são 20, cada uma com um conjunto diferente e que existe', () => {
    expect(ACHIEVEMENTS).toHaveLength(20)
    expect(new Set(ACHIEVEMENTS.map((a) => a.skin)).size).toBe(20)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(20)
    for (const a of ACHIEVEMENTS) expect(COLLECTION_SKINS.some((s) => s.id === a.skin && s.tier === a.tier), a.id).toBe(true)
  })

  it('todo conjunto da coleção tem um pintor de superfície', () => {
    for (const s of COLLECTION_SKINS) expect(PACK_SURFACES[s.surface ?? ''], s.id).toBeDefined()
  })

  it('quanto mais rara, mais difícil: a lendária é a menos provável e as comuns saem logo', () => {
    const order = ['comum', 'incomum', 'rara', 'epica', 'lendaria']
    const tiers = ACHIEVEMENTS.map((a) => order.indexOf(a.tier))
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
  })

  it('um histórico vazio não dá nada', () => {
    expect(satisfied(hist([]))).toEqual([])
  })

  it('resultado forte e falha: lê o que a ficha marcou ou todos os dados no máximo/em 1', () => {
    expect(isStrong(d20(20))).toBe(true)
    expect(isStrong(d20(19))).toBe(false)
    expect(isWeak(d20(1))).toBe(true)
    expect(isStrong(d20(12, { roll_context: { crit: 'crit' } }))).toBe(true)
    // teste do Altherium: o 10 natural é o crítico, mesmo com outros dados
    expect(isStrong(roll(10, [10, 4], { roll_context: { system: 'altherium', kind: 'skill', natural: 10 } }))).toBe(true)
    expect(isStrong(roll(10, [10, 10], { roll_context: { system: 'altherium', kind: 'skill', natural: 7 } }))).toBe(false)
  })

  it('osso: 10 rolagens · marfim: 100 · fungo: 500 (conta o total, não só as lidas)', () => {
    expect(has(hist(filler(9)), 'osso-do-oficio')).toBe(false)
    expect(has(hist(filler(10)), 'osso-do-oficio')).toBe(true)
    expect(has(hist(filler(5), { total: 100 }), 'memoria-de-marfim')).toBe(true)
    expect(has(hist(filler(5), { total: 99 }), 'memoria-de-marfim')).toBe(false)
    expect(has(hist(filler(5), { total: 500 }), 'raizes-no-escuro')).toBe(true)
  })

  it('ferro: a primeira falha crítica · argila: o primeiro resultado forte', () => {
    expect(has(hist([d20(5)]), 'ferro-e-fogo')).toBe(false)
    expect(has(hist([d20(1)]), 'ferro-e-fogo')).toBe(true)
    expect(has(hist([d20(19)]), 'barro-moldado')).toBe(false)
    expect(has(hist([d20(20)]), 'barro-moldado')).toBe(true)
  })

  it('giz: já rolou todos os tipos de dado · âmbar: o máximo em todos os tipos', () => {
    const sides = [4, 6, 8, 10, 12, 20, 100]
    expect(has(hist(sides.slice(0, 6).map((s) => roll(s, [2]))), 'rabiscos-de-taverna')).toBe(false)
    expect(has(hist(sides.map((s) => roll(s, [2]))), 'rabiscos-de-taverna')).toBe(true)
    expect(has(hist(sides.map((s) => roll(s, [s]))), 'preso-no-tempo')).toBe(true)
    expect(has(hist(sides.slice(1).map((s) => roll(s, [s]))), 'preso-no-tempo')).toBe(false)
  })

  it('cobre: 3 campanhas · jade: 7 dias diferentes', () => {
    expect(has(hist([d20(5, { campaign_id: 'a' }), d20(5, { campaign_id: 'b' })]), 'moedas-de-cobre')).toBe(false)
    expect(has(hist([d20(5, { campaign_id: 'a' }), d20(5, { campaign_id: 'b' }), d20(5, { campaign_id: 'c' })]), 'moedas-de-cobre')).toBe(true)
    const days = Array.from({ length: 7 }, (_, i) => d20(5, { created_at: `2026-11-0${i + 1}T15:00:00.000Z` }))
    expect(has(hist(days.slice(0, 6)), 'calma-do-jade')).toBe(false)
    expect(has(hist(days), 'calma-do-jade')).toBe(true)
  })

  it('ônix: 3 resultados fortes no total', () => {
    expect(has(hist([d20(20), d20(5), d20(20)]), 'sombra-polida')).toBe(false)
    expect(has(hist([d20(20), d20(5), d20(20), d20(20)]), 'sombra-polida')).toBe(true)
  })

  it('ametista: 5 rolagens com dois dados iguais', () => {
    const pair = () => roll(6, [3, 3])
    expect(has(hist([pair(), pair(), pair(), pair(), roll(6, [1, 2])]), 'geodo-escondido')).toBe(false)
    expect(has(hist([pair(), pair(), pair(), pair(), pair()]), 'geodo-escondido')).toBe(true)
  })

  it('granada: 5 sucessos seguidos em testes (rolagens sem teste não quebram a sequência)', () => {
    const ok = () => d20(12, { roll_context: { outcome: 'success' } })
    const bad = () => d20(3, { roll_context: { outcome: 'failure' } })
    expect(has(hist([ok(), ok(), ok(), ok(), bad(), ok()]), 'sangue-de-uva')).toBe(false)
    expect(has(hist([bad(), ok(), d20(7), ok(), ok(), ok(), d20(9), ok()]), 'sangue-de-uva')).toBe(true)
  })

  it('fumê: o máximo em 3 tipos de dado diferentes (moeda e d3 não contam)', () => {
    expect(has(hist([roll(4, [4]), roll(6, [6]), roll(3, [3]), roll(2, [2])]), 'fumaca-no-salao')).toBe(false)
    expect(has(hist([roll(4, [4]), roll(6, [6]), roll(8, [8])]), 'fumaca-no-salao')).toBe(true)
  })

  it('gelo: 2 resultados fortes seguidos · vórtice: 3 seguidos', () => {
    expect(has(hist([d20(20), d20(7)]), 'inverno-subito')).toBe(false)
    expect(has(hist([d20(7), d20(20), d20(20)]), 'inverno-subito')).toBe(true)
    expect(has(hist([d20(20), d20(20), d20(5), d20(20)]), 'o-vortice-chamou')).toBe(false)
    expect(has(hist([d20(5), d20(20), d20(20), d20(20)]), 'o-vortice-chamou')).toBe(true)
  })

  it('magma: todos os dados no máximo numa rolagem de 3 ou mais', () => {
    expect(has(hist([roll(6, [6, 6])]), 'coracao-de-vulcao')).toBe(false)
    expect(has(hist([roll(6, [6, 6, 5])]), 'coracao-de-vulcao')).toBe(false)
    expect(has(hist([roll(6, [6, 6, 6])]), 'coracao-de-vulcao')).toBe(true)
  })

  it('meteorito: o mesmo resultado 4 vezes seguidas', () => {
    expect(has(hist([d20(9), d20(9), d20(9), d20(10)]), 'estrela-caida')).toBe(false)
    expect(has(hist([d20(3), d20(9), d20(9), d20(9), d20(9)]), 'estrela-caida')).toBe(true)
  })

  it('dado da morte: 3 testes de morte com resultado forte (do D&D ou do Altherium)', () => {
    const deathDnd = () => d20(20, { roll_context: { kind: 'death', crit: 'crit' } })
    const deathAlth = () => roll(10, [10, 2], { roll_label: 'Teste de Morte (turno 2 de 3)', roll_context: { system: 'altherium', kind: 'skill', natural: 10, crit: 'crit' } })
    expect(isDeathTest(deathDnd())).toBe(true)
    expect(isDeathTest(deathAlth())).toBe(true)
    expect(isDeathTest(d20(20))).toBe(false)
    // um 20 qualquer não é teste de morte
    expect(has(hist([deathDnd(), deathAlth(), d20(20), d20(20)]), 'apertou-a-mao-da-morte')).toBe(false)
    expect(has(hist([deathDnd(), deathAlth(), deathDnd()]), 'apertou-a-mao-da-morte')).toBe(true)
  })

  it('vaga-lumes: 3 resultados fortes no mesmo dia', () => {
    const day = (d: string) => d20(20, { created_at: `${d}T10:00:00.000Z` })
    expect(has(hist([day('2026-11-01'), day('2026-11-02'), day('2026-11-03')]), 'noite-de-vaga-lumes')).toBe(false)
    expect(has(hist([day('2026-11-01'), day('2026-11-02'), day('2026-11-02'), day('2026-11-02')]), 'noite-de-vaga-lumes')).toBe(true)
  })

  it('ouro rúnico: o 100 e o 1 no d100', () => {
    expect(has(hist([roll(100, [100])]), 'runas-acesas')).toBe(false)
    expect(has(hist([roll(100, [100]), roll(100, [1])]), 'runas-acesas')).toBe(true)
  })
})
