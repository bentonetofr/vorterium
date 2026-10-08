// ────────────────────────────────────────────────────────
// Seções de navegação dentro de uma campanha — fonte única usada pelo
// submenu na barra lateral (PrivateLayout), pelo dropdown mobile, e
// pelas rotas-filhas em CampaignAreaLayout.
// ────────────────────────────────────────────────────────

export type TabId = 'visao-geral' | 'membros' | 'sessoes' | 'notas' | 'quadro' | 'anotacoes' | 'mesa-sessao' | 'vortable' | 'configuracoes'

/** Sub-abas dentro de "Sessão" (id mesa-sessao) — estado local (fora da URL), ver spec. */
export type SessionSubTabId = 'mesa' | 'ficha' | 'atividade' | 'iniciativa' | 'bestiario' | 'livro'

export interface CampaignSection {
  id: TabId
  label: string
}

export const CAMPAIGN_SECTIONS: CampaignSection[] = [
  { id: 'visao-geral',   label: 'Visão geral' },
  { id: 'mesa-sessao',   label: 'Sessão' },
  { id: 'vortable',      label: 'Vortable' },
  { id: 'membros',       label: 'Membros' },
  { id: 'sessoes',       label: 'Episódios' },
  { id: 'notas',         label: 'Notas' },
  { id: 'quadro',        label: 'Quadro' },
  { id: 'configuracoes', label: 'Configurações' },
]
