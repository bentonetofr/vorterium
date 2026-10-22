import { ABILITIES, SKILLS } from '../rules/abilities'
import type { AbilityKey, Derived, SkillKey } from '../rules/types'
import type { DndCheckRequest } from '../services/dndCheckService'
import { abilityCheck, deathCheck, initiativeCheck, saveCheck, skillCheck, type CheckSpec } from './checkModel'

// ────────────────────────────────────────────────────────
// Pedido de teste do mestre → teste no painel do jogador, montado a partir
// da ficha dele. E um pequeno "quadro de avisos" entre o aviso global (fora
// da ficha) e a ficha aberta: quem está ouvindo, o pedido que o jogador
// escolheu rolar e os que ele dispensou nesta sessão do navegador.
// ────────────────────────────────────────────────────────

const isSkill = (k: string | null): k is SkillKey => !!k && SKILLS.some((s) => s.key === k)
const isAbility = (k: string | null): k is AbilityKey => !!k && ABILITIES.some((a) => a.key === k)

/** O teste que o pedido descreve, com os bônus desta ficha. */
export function specFromRequest(req: DndCheckRequest, derived: Derived): CheckSpec {
  let spec: CheckSpec
  if (req.kind === 'skill' && isSkill(req.check_key)) spec = skillCheck(derived, req.check_key)
  else if (req.kind === 'save' && isAbility(req.check_key)) spec = saveCheck(derived, req.check_key)
  else if (req.kind === 'ability' && isAbility(req.check_key)) spec = abilityCheck(derived, req.check_key)
  else if (req.kind === 'initiative') spec = initiativeCheck(derived)
  else if (req.kind === 'death') spec = deathCheck()
  else spec = { kind: 'ability', key: req.check_key ?? 'custom', label: req.label, tiles: [], dc: null, dcHidden: false, advantage: 'normal' }
  return {
    ...spec,
    label: req.label || spec.label,
    dc: req.dc_hidden ? null : req.dc ?? spec.dc,
    dcHidden: req.dc_hidden,
    advantage: req.advantage,
    requestId: req.id,
  }
}

/** O que o mestre escolhe na lista: rótulo pronto para cada teste. */
export interface CheckChoice { value: string; kind: DndCheckRequest['kind']; key: string | null; label: string; group: string }

export const CHECK_CHOICES: readonly CheckChoice[] = [
  ...SKILLS.map((s): CheckChoice => ({ value: `skill:${s.key}`, kind: 'skill', key: s.key, label: s.label, group: 'Perícia' })),
  ...ABILITIES.map((a): CheckChoice => ({ value: `save:${a.key}`, kind: 'save', key: a.key, label: `Salvaguarda de ${a.label}`, group: 'Salvaguarda' })),
  ...ABILITIES.map((a): CheckChoice => ({ value: `ability:${a.key}`, kind: 'ability', key: a.key, label: `Teste de ${a.label}`, group: 'Atributo' })),
  { value: 'initiative', kind: 'initiative', key: null, label: 'Iniciativa', group: 'Outros' },
  { value: 'death', kind: 'death', key: null, label: 'Salvaguarda contra a morte', group: 'Outros' },
]

// ── Quadro de avisos (memória do navegador) ─────────────

let listening = 0
let pending: string | null = null
const pendingListeners = new Set<(id: string) => void>()
const DISMISSED_KEY = 'vorterium.dnd.dismissedChecks'

/** A ficha aberta avisa que está ouvindo os pedidos (o aviso global se cala). */
export function sheetListening(): () => void {
  listening++
  return () => { listening = Math.max(0, listening - 1) }
}
export const isSheetListening = () => listening > 0

/** O jogador clicou "Rolar" no aviso: a ficha abre o painel deste pedido assim que montar. */
export function requestOpen(id: string): void {
  pending = id
  pendingListeners.forEach((fn) => fn(id))
}
export function takePending(): string | null { const p = pending; pending = null; return p }
export function onPendingOpen(fn: (id: string) => void): () => void { pendingListeners.add(fn); return () => { pendingListeners.delete(fn) } }

function readDismissed(): Set<string> {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]) } catch { return new Set() }
}
export function isDismissed(id: string): boolean { return readDismissed().has(id) }
export function dismiss(id: string): void {
  try { const s = readDismissed(); s.add(id); sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...s].slice(-50))) } catch { /* sem armazenamento */ }
}
