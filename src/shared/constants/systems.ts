// ────────────────────────────────────────────────────────
// Catálogo de sistemas disponíveis no Vorterium
//
// Sistemas são internos e versionados pelo app.
// Usuários NÃO criam sistemas personalizados.
// ────────────────────────────────────────────────────────

export type CampaignSystem = 'generic' | 'dnd5e' | 'altherium' | 'terra_devastada' | 'terra_devastada_adaptada' | 'vampiro'

export type SystemStatus = 'available' | 'preview' | 'coming-soon'

export interface SystemEntry {
  id:          CampaignSystem
  label:       string
  description: string
  status:      SystemStatus
  /** Ícone decorativo (emoji ou símbolo) */
  icon:        string
  /**
   * Versão alternativa de outro sistema: não ganha um cartão próprio na
   * criação de campanha — o cartão do sistema de origem abre a escolha entre
   * a versão original e esta.
   */
  variantOf?:  CampaignSystem
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
  {
    id:          'terra_devastada',
    label:       'Terra Devastada',
    description: 'Horror de sobrevivência num apocalipse zumbi: características livres, testes de pares em d6, Horror e Convicção.',
    status:      'available',
    icon:        '☣',
  },
  {
    id:          'terra_devastada_adaptada',
    label:       'Terra Devastada Adaptada',
    description: 'Versão adaptada do Terra Devastada, inspirada em The Last of Us: mesma base de pares em d6, Horror e Convicção, com ficha e visual próprios.',
    status:      'available',
    icon:        '☣',
    variantOf:   'terra_devastada',
  },
  {
    // Guardado no Painel de controle (recurso 'vampiro'): só aparece na
    // criação de campanha pra quem pode ver (NewCampaignPage).
    id:          'vampiro',
    label:       'Vampiro: A Máscara',
    description: 'Horror pessoal entre os vampiros (5ª edição): clãs, atributos e perícias, Fome, Humanidade e Potência de Sangue.',
    status:      'available',
    icon:        '☥',
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

/** Terra Devastada, na versão original ou na adaptada (mesmas regras de dados). */
export function isTerraDevastadaFamily(system: string | null | undefined): boolean {
  return system === 'terra_devastada' || system === 'terra_devastada_adaptada'
}

/** Versões alternativas de um sistema (vazio se ele não tem). */
export function getSystemVariants(system: CampaignSystem): SystemEntry[] {
  return SYSTEMS_CATALOG.filter((s) => s.variantOf === system)
}

export function isSupportedSystem(system: string): system is CampaignSystem {
  return system in _byId
}

export const STATUS_LABELS: Record<SystemStatus, string> = {
  'available':   '',
  'preview':     'Prévia',
  'coming-soon': 'Em breve',
}
