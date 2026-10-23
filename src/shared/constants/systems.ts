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
  /** Arte do cartão na escolha de sistema (public/sistemas, gerada por scripts/make-system-art.py). */
  art?:        string
  /** Cor de destaque do cartão, "r, g, b". */
  accent?:     string
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
    art:         '/sistemas/generico.webp',
    accent:      '224, 176, 64',
  },
  {
    id:          'dnd5e',
    label:       'D&D 5e',
    description: 'Regras de 2014 e conteúdo do SRD 5.1: ficha completa e automática, criador de personagem, livro de magias e itens, dados 3D e rolagens na mesa.',
    status:      'available',
    icon:        '⚔',
    art:         '/sistemas/dnd5e.webp',
    accent:      '232, 128, 58',
  },
  {
    id:          'altherium',
    label:       'Altherium',
    description: 'Sistema próprio do universo de Altherium: raízes, atributos, domínios e recursos do Livro de Regras 1.0.',
    status:      'available',
    icon:        '✦',
    art:         '/sistemas/altherium.webp',
    accent:      '110, 168, 255',
  },
  {
    id:          'terra_devastada',
    label:       'Terra Devastada',
    description: 'Horror de sobrevivência num apocalipse zumbi: características livres, testes de pares em d6, Horror e Convicção.',
    status:      'available',
    icon:        '☣',
    art:         '/sistemas/terra-devastada.webp',
    accent:      '126, 200, 90',
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
    art:         '/sistemas/vampiro.webp',
    accent:      '226, 56, 79',
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

/**
 * Ambientação do criador de personagem pro sistema: 'medieval' (fantasia, sem armas de fogo nem roupa de hoje),
 * 'modern' (atual/apocalipse, sem armadura nem magia) ou undefined (genérico: oferece tudo).
 */
export function characterSettingOf(system: string | null | undefined): 'medieval' | 'modern' | undefined {
  switch (system) {
    case 'dnd5e':
    case 'altherium':
      return 'medieval'
    case 'terra_devastada':
    case 'terra_devastada_adaptada':
    case 'vampiro':
      return 'modern'
    default:
      return undefined
  }
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
