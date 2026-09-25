import { SimpleSheetPanel }           from './SimpleSheetPanel'
import { DndComingSoon }             from '../dnd/DndComingSoon'
import { AltheriumSheetPanel }       from '../altherium/components/AltheriumSheetPanel'
import { TdSheetPanel }              from '../terraDevastada/components/TdSheetPanel'
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
      return <DndComingSoon />

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
