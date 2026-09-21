import { CampaignChatPanel } from '../../chat/components/CampaignChatPanel'
import { CampaignSheetPanel } from '../../sheets/components/CampaignSheetPanel'
import { CampaignActivityPanel } from '../../activity/components/CampaignActivityPanel'
import { InitiativeTrackerPanel } from '../../initiative/components/InitiativeTrackerPanel'
import type { CampaignWithRole } from '../../../shared/types'
import type { SessionSubTabId } from '../pages/CampaignAreaPage'
import './SessionTablePanel.css'

interface SessionTablePanelProps {
  campaign:       CampaignWithRole
  currentUserId:  string
  activeSubTab:   SessionSubTabId
  onSubTabChange: (tab: SessionSubTabId) => void
}

interface SubTab {
  id:    SessionSubTabId
  label: string
}

const SUB_TABS: SubTab[] = [
  { id: 'chat',       label: 'Chat' },
  { id: 'ficha',      label: 'Ficha' },
  { id: 'atividade',  label: 'Atividade' },
  { id: 'iniciativa', label: 'Iniciativa' },
]

export function SessionTablePanel({ campaign, currentUserId, activeSubTab, onSubTabChange }: SessionTablePanelProps) {
  return (
    <div className="session-table">
      <nav className="session-table__subtabs campaign-tabs" role="tablist" aria-label="Mesa da sessão">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeSubTab === tab.id}
            aria-controls={`session-subtabpanel-${tab.id}`}
            className={`campaign-tab ${activeSubTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => onSubTabChange(tab.id)}
          >
            <span className="campaign-tab__label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div
        id="session-subtabpanel-chat"
        role="tabpanel"
        hidden={activeSubTab !== 'chat'}
        className="animate-fade-up"
      >
        {activeSubTab === 'chat' && (
          <CampaignChatPanel
            campaignId={campaign.id}
            currentUserId={currentUserId}
            userRole={campaign.role}
          />
        )}
      </div>

      <div
        id="session-subtabpanel-ficha"
        role="tabpanel"
        hidden={activeSubTab !== 'ficha'}
        className="animate-fade-up"
      >
        {activeSubTab === 'ficha' && (
          <CampaignSheetPanel
            campaign={campaign}
            currentUserId={currentUserId}
          />
        )}
      </div>

      <div
        id="session-subtabpanel-atividade"
        role="tabpanel"
        hidden={activeSubTab !== 'atividade'}
        className="animate-fade-up"
      >
        {activeSubTab === 'atividade' && (
          <CampaignActivityPanel
            campaignId={campaign.id}
            userRole={campaign.role}
          />
        )}
      </div>

      <div
        id="session-subtabpanel-iniciativa"
        role="tabpanel"
        hidden={activeSubTab !== 'iniciativa'}
        className="animate-fade-up"
      >
        {activeSubTab === 'iniciativa' && (
          <InitiativeTrackerPanel
            campaignId={campaign.id}
            currentUserId={currentUserId}
            userRole={campaign.role}
          />
        )}
      </div>
    </div>
  )
}
