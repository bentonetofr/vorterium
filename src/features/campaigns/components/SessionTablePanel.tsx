import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CampaignChatPanel } from '../../chat/components/CampaignChatPanel'
import { CampaignSheetPanel } from '../../sheets/components/CampaignSheetPanel'
import { CampaignActivityPanel } from '../../activity/components/CampaignActivityPanel'
import { InitiativeTrackerPanel } from '../../initiative/components/InitiativeTrackerPanel'
import type { CampaignWithRole } from '../../../shared/types'
import type { SessionSubTabId } from '../campaignSections'
import './SessionTablePanel.css'

interface SessionTablePanelProps {
  campaign:       CampaignWithRole
  currentUserId:  string
}

interface SubTab {
  id:    SessionSubTabId
  label: string
}

interface NavigationState {
  initialSessionSubTab?: SessionSubTabId
}

export function SessionTablePanel({ campaign, currentUserId }: SessionTablePanelProps) {
  // Sub-aba não vive na URL (ver spec) — só estado local. O atalho "Ver
  // fichas" da Visão Geral manda a sub-aba inicial desejada via state da
  // navegação (CampaignAreaLayout.handleNavigate), lido só na primeira
  // renderização.
  const location = useLocation()
  const initialSubTab = (location.state as NavigationState | null)?.initialSessionSubTab ?? 'ficha'
  const [activeSubTab, setActiveSubTab] = useState<SessionSubTabId>(initialSubTab)

  // Mestre vê a ficha de vários jogadores nessa aba — plural só faz
  // sentido na visão dele; jogador só tem a própria ficha.
  const subTabs: SubTab[] = [
    { id: 'ficha',      label: campaign.role === 'master' ? 'Fichas' : 'Ficha' },
    { id: 'chat',       label: 'Chat' },
    { id: 'atividade',  label: 'Atividade' },
    { id: 'iniciativa', label: 'Iniciativa' },
  ]

  return (
    <div className="session-table">
      <nav className="session-table__subtabs campaign-tabs" role="tablist" aria-label="Mesa da sessão">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeSubTab === tab.id}
            aria-controls={`session-subtabpanel-${tab.id}`}
            className={`campaign-tab ${activeSubTab === tab.id ? 'campaign-tab--active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
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
            campaignSystem={campaign.system}
          />
        )}
      </div>
    </div>
  )
}
