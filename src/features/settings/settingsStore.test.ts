import { describe, expect, it } from 'vitest'
import { channelGain, defaultSettings, parseSettings } from './settingsStore'

describe('configurações do site', () => {
  it('sem nada guardado, tudo no volume de sempre', () => {
    const s = defaultSettings()
    for (const c of ['dice', 'notify', 'chat', 'game'] as const) expect(channelGain(s, c)).toBe(1)
  })

  it('volume geral e de cada tipo se multiplicam', () => {
    const s = { ...defaultSettings(), master: 50, volume: { dice: 40, notify: 100, chat: 100, game: 100 } }
    expect(channelGain(s, 'dice')).toBeCloseTo(0.2)
    expect(channelGain(s, 'notify')).toBeCloseTo(0.5)
  })

  it('mudo de um tipo cala só ele; mudo geral cala tudo', () => {
    const s = defaultSettings()
    expect(channelGain({ ...s, mute: { ...s.mute, dice: true } }, 'dice')).toBe(0)
    expect(channelGain({ ...s, mute: { ...s.mute, dice: true } }, 'chat')).toBe(1)
    expect(channelGain({ ...s, muteAll: true }, 'game')).toBe(0)
  })

  it('lê o que foi guardado e ignora lixo', () => {
    const saved = parseSettings(JSON.stringify({ master: 30, volume: { dice: 10, chat: 999, game: 'x' }, mute: { notify: true }, textScale: 115, highContrast: true }))
    expect(saved.master).toBe(30)
    expect(saved.volume.dice).toBe(10)
    expect(saved.volume.chat).toBe(100)
    expect(saved.volume.game).toBe(100)
    expect(saved.mute.notify).toBe(true)
    expect(saved.textScale).toBe(115)
    expect(saved.highContrast).toBe(true)
    expect(parseSettings('{{{').master).toBe(100)
    expect(parseSettings(JSON.stringify({ textScale: 77 })).textScale).toBe(100)
    expect(parseSettings(null).muteAll).toBe(false)
  })
})
