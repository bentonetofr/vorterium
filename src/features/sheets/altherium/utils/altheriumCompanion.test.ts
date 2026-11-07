import { describe, expect, it } from 'vitest'
import {
  attackText, command, die, griefLoss, heal, learnedCount, longRest, newWolf, readCompanion, recall, stabilize, woundsMax, wound, NO_COMPANION,
} from './altheriumCompanion'

describe('companheiro de Altherium', () => {
  it('o lobo do livro: 2 feridas, Defesa 12, ataque 2d10+2, 2 habilidades escolhidas', () => {
    const w = newWolf()
    expect(woundsMax(w)).toBe(2)
    expect(attackText(w)).toBe('2d10+2')
    expect(w.defense).toBe(12)
    expect(w.abilities).toHaveLength(5)
    expect(learnedCount(w)).toBe(2)
  })

  it('tudo é editável: o limite de feridas e os dados valem no lugar do padrão', () => {
    const w = { ...newWolf(), wounds_max: 5, attack_dice: 3, attack_bonus: -1 }
    expect(woundsMax(w)).toBe(5)
    expect(attackText(w)).toBe('3d10-1')
  })

  it('comandar deixa Exposto; recolher volta a Protegido', () => {
    const w = command(newWolf())
    expect(w.state).toBe('exposto')
    expect(recall(w).state).toBe('protegido')
  })

  it('ferir até o limite derruba; curar levanta; crítico causa 2 feridas', () => {
    let w = wound(newWolf())
    expect(w.wounds).toBe(1)
    expect(w.state).toBe('protegido')
    w = wound(w)
    expect(w.state).toBe('caido')
    expect(heal(w).state).toBe('protegido')
    expect(wound({ ...newWolf(), wounds_max: 3 }, 2).wounds).toBe(2)
  })

  it('estabilizar só vale pra quem está caído', () => {
    expect(stabilize(newWolf()).stable).toBe(false)
    expect(stabilize(wound(newWolf(), 2)).stable).toBe(true)
  })

  it('a morte deixa o luto; o Descanso Longo cura só se comeu a Ração', () => {
    const dead = die(newWolf())
    expect(dead.state).toBe('morto')
    expect(dead.grief).toBe(true)
    expect(longRest(dead).grief).toBe(false)

    const hurt = wound({ ...newWolf(), wounds_max: 3 })
    expect(longRest(hurt).wounds).toBe(1)
    expect(longRest({ ...hurt, fed: true }).wounds).toBe(0)
  })

  it('a perda de Equilíbrio é 2d6', () => {
    expect(griefLoss(() => 3)).toBe(6)
    const v = griefLoss()
    expect(v).toBeGreaterThanOrEqual(2)
    expect(v).toBeLessThanOrEqual(12)
  })

  it('lê o banco com segurança (vazio = sem companheiro; lixo vira padrão)', () => {
    expect(readCompanion(undefined).has).toBe(false)
    expect(readCompanion({}).has).toBe(false)
    const c = readCompanion({ has: true, name: 'Presa', wounds: 99, state: 'voando', bond_override: 3, abilities: [{ name: 'Uivo', learned: true }] })
    expect(c.wounds).toBe(20)
    expect(c.state).toBe('protegido')
    expect('bond_override' in c).toBe(false)
    expect(c.abilities[0].learned).toBe(true)
    expect(c.abilities[0].id).toBeTruthy()
    expect(readCompanion(NO_COMPANION).has).toBe(false)
  })
})
