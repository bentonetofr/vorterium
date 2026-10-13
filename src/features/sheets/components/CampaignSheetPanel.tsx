import { SimpleSheetPanel }           from './SimpleSheetPanel'
import { DndComingSoon }             from '../dnd/DndComingSoon'
import { DndCharacterSheetPanel }    from '../dnd/DndCharacterSheetPanel'
import { DND_FEATURE }               from '../dnd/constants/dnd'
import { useFeature }                from '../../control/siteFeatures'
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

// D&D 5e: guardado no Painel de controle. Quem pode ver (o dono do site,
// testando) abre a ficha; pra todos os outros segue o aviso. Provisório: a
// ficha nova (Marco 3 do plano) substitui esta.
function DndSheetGate({ campaignId, currentUserId }: { campaignId: string; currentUserId: string }) {
  const feature = useFeature(DND_FEATURE)
  return feature.visible
    ? <DndCharacterSheetPanel campaignId={campaignId} currentUserId={currentUserId} />
    : <DndComingSoon />
}

export function CampaignSheetPanel({ campaign, currentUserId }: CampaignSheetPanelProps) {
  switch (campaign.system) {
    case 'dnd5e':
      return <DndSheetGate campaignId={campaign.id} currentUserId={currentUserId} />

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
