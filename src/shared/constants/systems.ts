// ────────────────────────────────────────────────────────
// Catálogo de sistemas disponíveis no Vorterium
//
// Sistemas são internos e versionados pelo app.
// Usuários NÃO criam sistemas personalizados.
// ────────────────────────────────────────────────────────

export type CampaignSystem = 'generic' | 'dnd5e' | 'altherium'

export type SystemStatus = 'available' | 'preview' | 'coming-soon'

export interface SystemEntry {
  id:          CampaignSystem
  label:       string
  description: string
  status:      SystemStatus
  /** Ícone decorativo (emoji ou símbolo) */
  icon:        string
}

export const SYSTEMS_CATALOG: SystemEntry[] = [
  {
    id:          'generic',
    label:       'Genérico',
    description: 'Ficha simples para campanhas sem sistema específico. Ideal para testes, one-shots ou sistemas caseiros.',
    status:      'available',
    icon:        '◎',
  },
  {
    id:          'dnd5e',
    label:       'D&D 5e',
    description: 'Sistema de fantasia em desenvolvimento. A ficha completa será disponibilizada futuramente.',
    status:      'coming-soon',
    icon:        '⚔',
  },
  {
    id:          'altherium',
    label:       'Altherium',
    description: 'Sistema próprio do universo de Altherium: raízes, atributos, domínios e recursos do Livro de Regras 1.0.',
    status:      'available',
    icon:        '✦',
  },
]

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

const _byId = Object.fromEntries(SYSTEMS_CATALOG.map((s) => [s.id, s])) as Record<CampaignSystem, SystemEntry>

export function getSystemEntry(system: string): SystemEntry | undefined {
  return _byId[system as CampaignSystem]
}

export function getSystemLabel(system: string): string {
  return _byId[system as CampaignSystem]?.label ?? 'Genérico'
}

export function getSystemDescription(system: string): string {
  return _byId[system as CampaignSystem]?.description ?? ''
}

export function getSystemStatus(system: string): SystemStatus {
  return _byId[system as CampaignSystem]?.status ?? 'available'
}

export function isSupportedSystem(system: string): system is CampaignSystem {
  return system in _byId
}

export const STATUS_LABELS: Record<SystemStatus, string> = {
  'available':   '',
  'preview':     'Prévia',
  'coming-soon': 'Em breve',
}
