import { CAMPAIGN_SECTIONS } from '../features/campaigns/campaignSections'

// ────────────────────────────────────────────────────────
// Seções do menu do site. A barra lateral (computador) mostra todas em
// grupos; no celular, a barra de baixo mostra as principais e o resto fica
// na página "Mais".
// ────────────────────────────────────────────────────────

export interface NavItem {
  to:    string
  icon:  string
  label: string
  /** Texto curto pra lista da página "Mais". */
  hint?: string
}

export const TOOL_NAV: NavItem[] = [
  { to: '/biblioteca',    icon: '❧', label: 'Biblioteca',    hint: 'Livros e documentos de cada campanha' },
  { to: '/meu-bestiario', icon: '☠', label: 'Meu bestiário', hint: 'Suas criaturas pra qualquer campanha' },
  { to: '/galeria',       icon: '▣', label: 'Galeria',       hint: 'Imagens da Mesa e fotos do Quadro das suas campanhas' },
]

export const SITE_NAV: NavItem[] = [
  { to: '/novidades', icon: '✧', label: 'Novidades',       hint: 'O que mudou no site' },
  { to: '/ajuda',     icon: '?', label: 'Ajuda',           hint: 'Como usar cada parte' },
  { to: '/feedback',  icon: '✉', label: 'Enviar feedback', hint: 'Relatar um problema ou sugerir algo' },
]

const MAIN_LABELS: Record<string, string> = {
  '/campanhas':      'Campanhas',
  '/campanhas/nova': 'Nova campanha',
  '/minhas-fichas':  'Minhas fichas',
  '/atividade':      'Atividade',
  '/perfil':         'Perfil',
  '/mais':           'Mais',
  ...Object.fromEntries([...TOOL_NAV, ...SITE_NAV].map((i) => [i.to, i.label])),
}

/**
 * Nome legível da página (vai no "Onde foi?" do feedback):
 * "Minhas fichas", ou Campanha "Serra do Navio" › Sessão.
 */
export function pageLabel(pathname: string, campaignName?: string | null): string {
  if (MAIN_LABELS[pathname]) return MAIN_LABELS[pathname]
  const m = pathname.match(/^\/campanhas\/[^/]+(?:\/([^/]+))?/)
  if (m) {
    const section = m[1] === 'anotacoes' ? 'Anotações dos jogadores' : CAMPAIGN_SECTIONS.find((s) => s.id === (m[1] ?? 'visao-geral'))?.label
    const campaign = campaignName ? `Campanha "${campaignName}"` : 'Campanha'
    return section ? `${campaign} › ${section}` : campaign
  }
  return pathname
}
