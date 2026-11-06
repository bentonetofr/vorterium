import { describe, expect, it } from 'vitest'
import type { DiceRoll } from '../../../../shared/types'
import { requestAnswered, requestDomainKey, type AltheriumRequest } from './altheriumRequestService'

const req = (over: Partial<AltheriumRequest> = {}): AltheriumRequest => ({
  id: 'p1', campaign_id: 'c', master_id: 'm', targets: ['u1'], kind: 'domain', domain: 'tatica', label: 'Teste de Tática',
  dt: 7, amount: null, status: 'open', created_at: '2026-11-06T10:00:00Z', closed_at: null, ...over,
})
const roll = (key: string, at: string, over: Record<string, unknown> = {}) =>
  ({ id: `r-${key}-${at}`, user_id: 'u1', created_at: at, roll_context: { system: 'altherium', kind: 'skill', key, ...over } }) as unknown as DiceRoll

describe('pedido do mestre respondido', () => {
  it('o domínio de cada tipo de pedido', () => {
    expect(requestDomainKey(req())).toBe('tatica')
    expect(requestDomainKey(req({ kind: 'stealth', domain: null }))).toBe('furtividade')
    expect(requestDomainKey(req({ kind: 'equilibrium', domain: null }))).toBe('vontade')
  })

  it('a rolagem ligada ao pedido responde', () => {
    expect(requestAnswered(req(), [], new Set(['p1']))).toBe(true)
  })

  it('rolar o domínio pedido na ficha, depois do pedido, também responde', () => {
    expect(requestAnswered(req(), [roll('tatica', '2026-11-06T10:05:00Z')], new Set())).toBe(true)
    expect(requestAnswered(req({ kind: 'stealth', domain: null }), [roll('furtividade', '2026-11-06T10:01:00Z')], new Set())).toBe(true)
  })

  it('rolagem de antes do pedido, de outro domínio ou de outro sistema não responde', () => {
    expect(requestAnswered(req(), [roll('tatica', '2026-11-06T09:59:00Z')], new Set())).toBe(false)
    expect(requestAnswered(req(), [roll('luta', '2026-11-06T10:05:00Z')], new Set())).toBe(false)
    expect(requestAnswered(req(), [roll('tatica', '2026-11-06T10:05:00Z', { system: 'dnd5e' })], new Set())).toBe(false)
    expect(requestAnswered(req(), [], new Set())).toBe(false)
  })
})
