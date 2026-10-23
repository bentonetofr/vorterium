import { lazy, Suspense }             from 'react'
import { SimpleSheetPanel }           from './SimpleSheetPanel'
import { Loader }                     from '../../../shared/components/Loader'
import { AltheriumSheetPanel }       from '../altherium/components/AltheriumSheetPanel'
import { TdSheetPanel }              from '../terraDevastada/components/TdSheetPanel'
import { TdaSheetPanel }             from '../terraDevastadaAdaptada/components/TdaSheetPanel'
import { VampiroSheetPanel }         from '../vampiro/components/VampiroSheetPanel'
import type { CampaignWithRole }     from '../../../shared/types'

// A ficha de D&D (catálogo de classes, raças e itens, as sete abas e os
// estilos) só é baixada quando uma campanha de D&D abre a ficha. Se o site foi
// atualizado com a página aberta, o arquivo antigo some do servidor: recarrega
// a página uma vez para pegar o novo. Se ainda falhar (sem internet), mostra o
// aviso com o botão de recarregar, sem derrubar o resto da página.
const DND_RELOAD_KEY = 'vorterium:dnd-sheet-reload'
type DndPanelProps = { campaignId: string; userRole: 'master' | 'player' }
const DndSheetPanel = lazy(() => import('../dnd/components/DndSheetPanel').then(
  (m) => { try { sessionStorage.removeItem(DND_RELOAD_KEY) } catch { /* sem armazenamento */ } return { default: m.DndSheetPanel } },
  () => {
    let retried = true
    try { retried = sessionStorage.getItem(DND_RELOAD_KEY) === '1'; sessionStorage.setItem(DND_RELOAD_KEY, '1') } catch { /* sem armazenamento: não recarrega sozinho */ }
    if (!retried) window.location.reload()
    return { default: DndSheetLoadError }
  },
))

function DndSheetLoadError(_props: DndPanelProps) {
  return (
    <div className="sheet-feedback sheet-feedback--error" role="alert">
      Não foi possível abrir a ficha de D&amp;D. Confira a internet e recarregue a página.{' '}
      <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>Recarregar</button>
    </div>
  )
}

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

interface CampaignSheetPanelProps {
  campaign:      CampaignWithRole
  currentUserId: string
}

// ────────────────────────────────────────────────────────
// Roteador de fichas por sistema
// ────────────────────────────────────────────────────────

export function CampaignSheetPanel({ campaign }: CampaignSheetPanelProps) {
  switch (campaign.system) {
    case 'dnd5e':
      // Guardado no Painel de controle (recurso dnd5e): o painel mostra o aviso pra quem não pode ver.
      return (
        <Suspense fallback={<div className="sheet-loading"><Loader small /></div>}>
          <DndSheetPanel
            campaignId={campaign.id}
            userRole={campaign.role}
          />
        </Suspense>
      )

    case 'altherium':
      return (
        <AltheriumSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
      )

    case 'terra_devastada':
      return (
        <TdSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
      )

    case 'terra_devastada_adaptada':
      return (
        <TdaSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
      )

    case 'vampiro':
      return (
        <VampiroSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
      )

    case 'generic':
    default:
      return (
        <SimpleSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
      )
  }
}
