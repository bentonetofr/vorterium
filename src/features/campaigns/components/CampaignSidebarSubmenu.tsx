import { NavLink } from 'react-router-dom'
import { CAMPAIGN_SECTIONS } from '../campaignSections'

interface CampaignSidebarSubmenuProps {
  campaignId: string
  chatUnread: number
  privateUnread: number
  /** Chamado ao clicar num item — o dropdown mobile usa isso pra se fechar sozinho. */
  onNavigate?: () => void
}

/** Lista de seções da campanha — reaproveitada no acordeão da barra lateral (desktop) e no menu suspenso da barra de topo (mobile). */
export function CampaignSidebarSubmenu({ campaignId, chatUnread, privateUnread, onNavigate }: CampaignSidebarSubmenuProps) {
  return (
    <div className="campaign-submenu">
      {CAMPAIGN_SECTIONS.map((section) => (
        <NavLink
          key={section.id}
          to={`/campanhas/${campaignId}/${section.id}`}
          className={({ isActive }) =>
            `campaign-submenu__item${isActive ? ' campaign-submenu__item--active' : ''}${section.id === 'mesa-sessao' ? ' campaign-submenu__item--highlight' : ''}`
          }
          onClick={onNavigate}
        >
          <span className="campaign-submenu__label">{section.label}</span>
          {section.id === 'mesa-sessao' && chatUnread > 0 && (
            <span className="campaign-submenu__badge">{chatUnread > 99 ? '99+' : chatUnread}</span>
          )}
          {section.id === 'mesa-sessao' && privateUnread > 0 && (
            <span className="campaign-submenu__badge campaign-submenu__badge--private" title="Mensagem privada não lida">
              {privateUnread > 99 ? '99+' : privateUnread}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  )
}
