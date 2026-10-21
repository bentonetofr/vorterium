import { SimpleSheetPanel }           from './SimpleSheetPanel'
import { DndSheetPanel }             from '../dnd/components/DndSheetPanel'
import { AltheriumSheetPanel }       from '../altherium/components/AltheriumSheetPanel'
import { TdSheetPanel }              from '../terraDevastada/components/TdSheetPanel'
import { TdaSheetPanel }             from '../terraDevastadaAdaptada/components/TdaSheetPanel'
import { VampiroSheetPanel }         from '../vampiro/components/VampiroSheetPanel'
import type { CampaignWithRole }     from '../../../shared/types'

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
        <DndSheetPanel
          campaignId={campaign.id}
          userRole={campaign.role}
        />
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
