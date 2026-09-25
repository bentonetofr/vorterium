// ────────────────────────────────────────────────────────
// Seções de navegação dentro de uma campanha — fonte única usada pelo
// submenu na barra lateral (PrivateLayout), pelo dropdown mobile, e
// pelas rotas-filhas em CampaignAreaLayout.
// ────────────────────────────────────────────────────────

export type TabId = 'visao-geral' | 'membros' | 'sessoes' | 'notas' | 'mesa-sessao' | 'configuracoes'

/** Sub-abas dentro de "Mesa da Sessão" — estado local (fora da URL), ver spec. */
export type SessionSubTabId = 'chat' | 'ficha' | 'atividade' | 'iniciativa' | 'bestiario' | 'livro'

export interface CampaignSection {
  id: TabId
  label: string
}

export const CAMPAIGN_SECTIONS: CampaignSection[] = [
  { id: 'visao-geral',   label: 'Visão geral' },
  { id: 'mesa-sessao',   label: 'Mesa da Sessão' },
  { id: 'membros',       label: 'Membros' },
  { id: 'sessoes',       label: 'Sessões' },
  { id: 'notas',         label: 'Notas' },
  { id: 'configuracoes', label: 'Configurações' },
]
