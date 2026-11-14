import { describe, expect, it } from 'vitest'
import { ACHIEVEMENTS, PRISM_NEEDS, didOf, isDeathTest, isStrong, isWeak, satisfied, type History, type RollLite } from './achievements'
import { COLLECTION_SKINS, TIER_ORDER } from '../dice3d/skins'
import { PACK_SURFACES } from '../dice3d/dieSurfacesPack'
import { PACK2_SURFACES } from '../dice3d/dieSurfacesPack2'
import waveSql from '../../../supabase/migrations/20240232000000_dice_collection_wave2.sql?raw'

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

describe('coleção: as 34 conquistas', () => {
  it('são 34, cada uma com um conjunto diferente e que existe (e todo conjunto tem a sua)', () => {
    expect(ACHIEVEMENTS).toHaveLength(34)
    expect(COLLECTION_SKINS).toHaveLength(34)
    expect(new Set(ACHIEVEMENTS.map((a) => a.skin)).size).toBe(34)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(34)
    for (const a of ACHIEVEMENTS) expect(COLLECTION_SKINS.some((s) => s.id === a.skin && s.tier === a.tier), a.id).toBe(true)
    // o banco corta o id da conquista em 40 letras; e toda conquista diz, depois de ganha, o que a pessoa fez
    for (const a of ACHIEVEMENTS) { expect(a.id.length, a.id).toBeLessThanOrEqual(40); expect(didOf(a.id), a.id).toBeTruthy() }
  })

  it('todo conjunto da coleção tem um pintor de superfície', () => {
    const painters = { ...PACK_SURFACES, ...PACK2_SURFACES }
    for (const s of COLLECTION_SKINS) expect(painters[s.surface ?? ''], s.id).toBeDefined()
  })

  it('o banco conhece todo conjunto da coleção (a lista da última migration da coleção)', () => {
    const sql: string = waveSql
    for (const s of COLLECTION_SKINS) expect(sql.includes(`'${s.id}'`), s.id).toBe(true)
  })

  it('quanto mais rara, mais difícil: as conquistas e os conjuntos seguem a ordem das raridades', () => {
    const tiers = ACHIEVEMENTS.map((a) => TIER_ORDER.indexOf(a.tier))
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
    const skins = COLLECTION_SKINS.map((s) => TIER_ORDER.indexOf(s.tier!))
    expect([...skins].sort((a, b) => a - b)).toEqual(skins)
    expect(ACHIEVEMENTS.filter((a) => a.tier === 'mitica')).toHaveLength(2)
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

describe('coleção: a segunda leva', () => {
  /** Uma rolagem num horário do relógio de quem roda o teste (as conquistas de hora usam o relógio da pessoa). */
  const at = (h: number, m = 0, day = 5) => new Date(2026, 10, day, h, m).toISOString()

  it('rolha: 5 ou mais dados de uma vez', () => {
    expect(has(hist([roll(6, [1, 2, 3, 4])]), 'rolha-estourada')).toBe(false)
    expect(has(hist([roll(6, [1, 2, 3, 4, 5])]), 'rolha-estourada')).toBe(true)
  })

  it('vela: 3 horas de rolagens no mesmo dia (dias diferentes não somam)', () => {
    expect(has(hist([d20(5, { created_at: at(19) }), d20(5, { created_at: at(21, 59) })]), 'ate-o-toco-da-vela')).toBe(false)
    expect(has(hist([d20(5, { created_at: at(19) }), d20(5, { created_at: at(22) })]), 'ate-o-toco-da-vela')).toBe(true)
    expect(has(hist([d20(5, { created_at: at(21, 0, 5) }), d20(5, { created_at: at(1, 0, 6) })]), 'ate-o-toco-da-vela')).toBe(false)
  })

  it('vitral: 3 falhas críticas · olho: 13 (só com dado de teste)', () => {
    expect(has(hist([d20(1), d20(1)]), 'cacos-coloridos')).toBe(false)
    expect(has(hist([d20(1), d20(1), d20(7), d20(1)]), 'cacos-coloridos')).toBe(true)
    expect(has(hist(Array.from({ length: 12 }, () => d20(1))), 'o-abismo-olhou-de-volta')).toBe(false)
    expect(has(hist(Array.from({ length: 13 }, () => d20(1))), 'o-abismo-olhou-de-volta')).toBe(true)
    expect(has(hist(Array.from({ length: 13 }, () => roll(4, [1]))), 'o-abismo-olhou-de-volta')).toBe(false)
  })

  it('pergaminho: todos os números do d20', () => {
    const all = Array.from({ length: 20 }, (_, i) => d20(i + 1))
    expect(has(hist(all.slice(1)), 'letra-por-letra')).toBe(false)
    expect(has(hist(all), 'letra-por-letra')).toBe(true)
    // os dois d20 de uma rolagem com vantagem contam
    expect(has(hist([...all.slice(2), roll(20, [1, 2])]), 'letra-por-letra')).toBe(true)
  })

  it('sino: resultado forte na primeira hora do dia', () => {
    expect(has(hist([d20(20, { created_at: at(23, 59) }), d20(20, { created_at: at(1, 0) }), d20(19, { created_at: at(0, 30) })]), 'badalada-da-meia-noite')).toBe(false)
    expect(has(hist([d20(20, { created_at: at(0, 30) })]), 'badalada-da-meia-noite')).toBe(true)
    expect(has(hist([roll(4, [4], { created_at: at(0, 30) })]), 'badalada-da-meia-noite')).toBe(false)
  })

  it('relógio: três resultados em escada, seguidos', () => {
    expect(has(hist([d20(7), d20(8), d20(10)]), 'engrenagens-no-lugar')).toBe(false)
    expect(has(hist([d20(9), d20(8), d20(7)]), 'engrenagens-no-lugar')).toBe(false)
    expect(has(hist([d20(3), d20(7), d20(8), d20(9)]), 'engrenagens-no-lugar')).toBe(true)
    expect(has(hist([roll(4, [1]), roll(4, [2]), roll(4, [3])]), 'engrenagens-no-lugar')).toBe(false)
  })

  it('pérola: falha crítica e, logo depois, resultado forte', () => {
    expect(has(hist([d20(20), d20(1)]), 'perola-na-lama')).toBe(false)
    expect(has(hist([d20(1), d20(5), d20(20)]), 'perola-na-lama')).toBe(false)
    expect(has(hist([d20(5), d20(1), d20(20)]), 'perola-na-lama')).toBe(true)
    // teste do Altherium: o 1 e o 10 naturais do d10
    const alth = (natural: number) => roll(10, [natural, 4], { roll_context: { system: 'altherium', kind: 'skill', natural } })
    expect(has(hist([alth(1), alth(10)]), 'perola-na-lama')).toBe(true)
  })

  it('tempestade: dois d20 em 20 na mesma rolagem', () => {
    expect(has(hist([d20(20), d20(20)]), 'o-raio-caiu-duas-vezes')).toBe(false)
    expect(has(hist([roll(20, [20, 19])]), 'o-raio-caiu-duas-vezes')).toBe(false)
    expect(has(hist([roll(20, [20, 20])]), 'o-raio-caiu-duas-vezes')).toBe(true)
  })

  it('galáxia: o mesmo número em todos os dados de uma rolagem de 4 ou mais (d6 pra cima)', () => {
    expect(has(hist([roll(6, [3, 3, 3])]), 'alinhamento-dos-astros')).toBe(false)
    expect(has(hist([roll(6, [3, 3, 3, 4])]), 'alinhamento-dos-astros')).toBe(false)
    expect(has(hist([roll(4, [2, 2, 2, 2])]), 'alinhamento-dos-astros')).toBe(false)
    expect(has(hist([roll(6, [3, 3, 3, 3])]), 'alinhamento-dos-astros')).toBe(true)
  })

  it('dragão: 2.000 rolagens (conta o total)', () => {
    expect(has(hist(filler(5), { total: 1999 }), 'tesouro-do-dragao')).toBe(false)
    expect(has(hist(filler(5), { total: 2000 }), 'tesouro-do-dragao')).toBe(true)
  })

  it('espelho: as últimas 7 rolagens espelhadas, com pelo menos 4 números diferentes', () => {
    const seq = (v: number[]) => hist(v.map((x) => d20(x)))
    expect(has(seq([3, 9, 14, 20, 14, 9, 4]), 'sete-anos-de-azar')).toBe(false)
    expect(has(seq([5, 5, 5, 5, 5, 5, 5]), 'sete-anos-de-azar')).toBe(false)
    expect(has(seq([3, 9, 3, 20, 3, 9, 3]), 'sete-anos-de-azar')).toBe(false)
    expect(has(seq([11, 3, 9, 14, 20, 14, 9, 3]), 'sete-anos-de-azar')).toBe(true)
  })

  it('vazio: 4 falhas críticas seguidas (3 não bastam; com d4 não vale)', () => {
    expect(has(hist([d20(5), d20(1), d20(1), d20(1)]), 'o-nada-respondeu')).toBe(false)
    expect(has(hist([d20(1), d20(1), d20(1), d20(1)]), 'o-nada-respondeu')).toBe(true)
    expect(has(hist([roll(4, [1]), roll(4, [1]), roll(4, [1]), roll(4, [1])]), 'o-nada-respondeu')).toBe(false)
  })

  it('prisma: quem já reuniu quase toda a coleção', () => {
    expect(has(hist([d20(5)]), 'todas-as-cores')).toBe(false)
    expect(has(hist([d20(5)], { owned: PRISM_NEEDS - 1 }), 'todas-as-cores')).toBe(false)
    expect(has(hist([d20(5)], { owned: PRISM_NEEDS }), 'todas-as-cores')).toBe(true)
    // dá para chegar lá sem o próprio prisma
    expect(PRISM_NEEDS).toBeLessThan(ACHIEVEMENTS.length)
  })
})
