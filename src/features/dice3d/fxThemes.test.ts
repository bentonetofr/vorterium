import { describe, expect, it } from 'vitest'
import { CRIT_THEMES, FUMBLE_THEMES, THEME_COLORS, THEME_NAMES, pickTheme, themeKind } from './fxThemes'

describe('animações de tela do 20 e do 1 naturais', () => {
  it('cada tema tem nome e três cores; críticos e falhas não se misturam', () => {
    for (const t of [...CRIT_THEMES, ...FUMBLE_THEMES]) {
      expect(THEME_NAMES[t]).toBeTruthy()
      expect(THEME_COLORS[t]).toHaveLength(3)
    }
    expect(CRIT_THEMES.every((t) => themeKind(t) === 'crit')).toBe(true)
    expect(FUMBLE_THEMES.every((t) => themeKind(t) === 'fumble')).toBe(true)
    expect(CRIT_THEMES.length).toBeGreaterThanOrEqual(8)
    expect(FUMBLE_THEMES.length).toBeGreaterThanOrEqual(8)
  })

  it('o sorteio devolve um tema do tipo certo e nunca repete o anterior', () => {
    for (const kind of ['crit', 'fumble'] as const) {
      const all = kind === 'crit' ? CRIT_THEMES : FUMBLE_THEMES
      for (const prev of all) {
        for (const r of [0, 0.25, 0.5, 0.99, 1]) {
          const t = pickTheme(kind, prev, () => r)
          expect(themeKind(t)).toBe(kind)
          expect(t).not.toBe(prev)
        }
      }
    }
  })

  it('sorteando de verdade, aparecem todos os temas', () => {
    const seen = new Set<string>()
    let prev = null as ReturnType<typeof pickTheme> | null
    for (let i = 0; i < 400; i++) { prev = pickTheme('crit', prev); seen.add(prev) }
    expect(seen.size).toBe(CRIT_THEMES.length)
  })
})
