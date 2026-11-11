import { describe, expect, it } from 'vitest'
import { buildRecap, sessionWindow, type RecapRoll } from './sessionRecap'

const roll = (user: string, total: number | null, hour: number, formula: string | null = 'd20'): RecapRoll => ({
  user_id: user,
  name: user === 'u1' ? 'Kareena' : user === 'u2' ? 'Leona' : 'Gutris',
  total,
  formula,
  created_at: new Date(2026, 10, 7, hour, 30).toISOString(),
})

describe('resumo do episódio', () => {
  it('a janela vai do começo do dia até as 6h da manhã seguinte', () => {
    const { start, end } = sessionWindow('2026-11-07')
    expect([start.getFullYear(), start.getMonth(), start.getDate(), start.getHours()]).toEqual([2026, 10, 7, 0])
    expect([end.getMonth(), end.getDate(), end.getHours()]).toEqual([10, 8, 6])
  })

  it('a janela atravessa a virada do mês', () => {
    const { end } = sessionWindow('2026-11-30')
    expect([end.getMonth(), end.getDate()]).toEqual([11, 1])
  })

  it('sem rolagens: resumo vazio', () => {
    expect(buildRecap([])).toEqual({ totalRolls: 0, players: [], best: null, from: null, to: null })
  })

  it('conta por pessoa, do que mais rolou pro que menos', () => {
    const recap = buildRecap([roll('u1', 12, 20), roll('u2', 8, 20), roll('u1', 3, 21), roll('u3', 15, 21), roll('u1', 19, 22)])
    expect(recap.totalRolls).toBe(5)
    expect(recap.players).toEqual([
      { name: 'Kareena', rolls: 3 },
      { name: 'Gutris', rolls: 1 },
      { name: 'Leona', rolls: 1 },
    ])
  })

  it('acha a maior rolagem e ignora as sem total', () => {
    const recap = buildRecap([roll('u1', 12, 20), roll('u2', 31, 21, '4d10+8'), roll('u3', null, 22)])
    expect(recap.best).toEqual({ name: 'Leona', total: 31, formula: '4d10+8' })
  })

  it('guarda o horário da primeira e da última, em qualquer ordem de chegada', () => {
    const recap = buildRecap([roll('u1', 5, 22), roll('u2', 6, 19), roll('u3', 7, 21)])
    expect(recap.from).toMatch(/^19:30/)
    expect(recap.to).toMatch(/^22:30/)
  })
})
