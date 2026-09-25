import { useEffect, useState } from 'react'
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { ThemeToggle } from '../../shared/components/ThemeToggle'
import { AppLogo }     from '../../shared/components/AppLogo'
import { DiceRollerProvider } from '../../features/dice/DiceRollerProvider'
import { DiceFab }            from '../../features/dice/components/DiceFab'
import { NotificationBell }   from '../../features/activity/components/NotificationBell'
import { NotificationPopup }  from '../../features/activity/components/NotificationPopup'
import { ActiveChatProvider }  from '../../features/chat/ActiveChatContext'
import { CurrentCampaignProvider, useCurrentCampaign } from '../../features/campaigns/CurrentCampaignContext'
import { CampaignSidebarSubmenu } from '../../features/campaigns/components/CampaignSidebarSubmenu'
import { RulebookHostProvider } from '../../features/rulebook/RulebookHost'
import { MesaStreamProvider } from '../../features/mesa/MesaStreamProvider'
import { MesaLiveNotice } from '../../features/mesa/components/MesaLiveNotice'
import { Presence } from '../../shared/components/Presence'
import { Collapse } from '../../shared/components/Collapse'
import './PrivateLayout.css'

export function PrivateLayout() {
  return (
    <ActiveChatProvider>
    <DiceRollerProvider>
    <CurrentCampaignProvider>
    <MesaStreamProvider>
    <RulebookHostProvider>
      <PrivateLayoutContent />
    </RulebookHostProvider>
    </MesaStreamProvider>
    </CurrentCampaignProvider>
    </DiceRollerProvider>
    </ActiveChatProvider>
  )
}

const BOTTOM_NAV_ITEMS = [
  { to: '/campanhas',     icon: '◈', label: 'Campanhas' },
  { to: '/minhas-fichas', icon: '◎', label: 'Fichas' },
  { to: '/atividade',     icon: '◉', label: 'Atividade' },
  { to: '/perfil',        icon: '○', label: 'Perfil' },
] as const

// Precisa ser um componente separado de PrivateLayout: a barra lateral e
// a barra de topo mobile leem a campanha atual do contexto, e um
// componente não consegue consumir o Provider que ele mesmo cria no
// próprio retorno — só os descendentes dele conseguem.
function PrivateLayoutContent() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { campaign, chatUnread, privateUnread } = useCurrentCampaign()
  const [mobileCampaignMenuOpen, setMobileCampaignMenuOpen] = useState(false)
  const location = useLocation()
  // Chave da animação de troca de página: só as duas primeiras partes do
  // caminho — dentro de uma campanha (/campanhas/:id/...) quem anima a
  // troca de seção é o próprio CampaignAreaLayout.
  const pageKey = location.pathname.split('/').slice(0, 3).join('/')

  // Menu da campanha (mobile) fecha sozinho ao sair da campanha.
  useEffect(() => { if (!campaign) setMobileCampaignMenuOpen(false) }, [campaign])

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email ??
    '—'
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  const initial = displayName.trim().charAt(0).toUpperCase()

  async function handleSignOut() {
    try { await signOut() } finally { navigate('/login', { replace: true }) }
  }

  return (
    <>
    <div className="private-layout">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <AppLogo size="sm" showText />
        </div>

        {user && (
          <Link to="/perfil" className="sidebar__user sidebar__user--link">
            <div className="sidebar__avatar" aria-hidden={avatarUrl ? undefined : true}>
              {avatarUrl ? <img key={avatarUrl} src={avatarUrl} alt="" className="anim-img-swap" /> : initial}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{displayName}</span>
              {user.user_metadata?.display_name && (
                <span className="sidebar__user-email">{user.email}</span>
              )}
            </div>
          </Link>
        )}

        <nav className="sidebar__nav">
          <NavLink
            to="/campanhas"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <span className="sidebar__link-icon">◈</span>
            Campanhas
          </NavLink>
          <Collapse open={!!campaign}>
            {() => campaign && (
              <div className="sidebar__campaign-submenu">
                <CampaignSidebarSubmenu
                  campaignId={campaign.id}
                  chatUnread={chatUnread}
                  privateUnread={privateUnread}
                />
              </div>
            )}
          </Collapse>
          <NavLink
            to="/minhas-fichas"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <span className="sidebar__link-icon">◎</span>
            Minhas fichas
          </NavLink>
          <NavLink
            to="/atividade"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <span className="sidebar__link-icon">◉</span>
            Atividade
          </NavLink>
          <NavLink
            to="/perfil"
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <span className="sidebar__link-icon">○</span>
            Perfil
          </NavLink>
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__footer-actions">
            <ThemeToggle />
            <button className="btn btn-ghost sidebar__signout" onClick={handleSignOut}>
              Sair
            </button>
          </div>

          {/* Links institucionais discretos */}
          <nav className="sidebar__legal" aria-label="Links institucionais">
            <Link to="/sobre"       className="sidebar__legal-link">Sobre</Link>
            <Link to="/termos"      className="sidebar__legal-link">Termos</Link>
            <Link to="/privacidade" className="sidebar__legal-link">Privacidade</Link>
          </nav>
        </div>
      </aside>

      {/* ── Topbar (mobile) ── */}
      <header className="topbar">
        <div className="topbar__row">
          <AppLogo size="sm" showText />
          <div className="topbar__actions">
            <ThemeToggle />
            <button
              className="topbar__btn"
              onClick={handleSignOut}
              aria-label="Sair"
              title="Sair"
            >
              ↩
            </button>
          </div>
        </div>

        {campaign && (
          <div className="topbar__campaign-row">
            <button
              type="button"
              className="topbar__campaign-toggle"
              onClick={() => setMobileCampaignMenuOpen((v) => !v)}
              aria-expanded={mobileCampaignMenuOpen}
            >
              <span className="topbar__campaign-name">{campaign.name}</span>
              <span className="topbar__campaign-chevron" aria-hidden="true">▼</span>
            </button>
            <Presence show={mobileCampaignMenuOpen} exitMs={180}>
              {(state) => (
                <div className="topbar__campaign-menu anim-drop" data-state={state}>
                  <CampaignSidebarSubmenu
                    campaignId={campaign.id}
                    chatUnread={chatUnread}
                    privateUnread={privateUnread}
                    onNavigate={() => setMobileCampaignMenuOpen(false)}
                  />
                </div>
              )}
            </Presence>
          </div>
        )}
      </header>

      <main className="private-layout__main">
        <div key={pageKey} className="private-layout__page anim-page">
          <Outlet />
        </div>
      </main>

      {/* ── Barra de navegação inferior (mobile) — mesmas seções da barra
          lateral, fixas no rodapé ao alcance do polegar. ── */}
      <nav className="bottom-nav" aria-label="Navegação principal">
        {BOTTOM_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `bottom-nav__link${isActive ? ' bottom-nav__link--active' : ''}`}
          >
            <span className="bottom-nav__icon" aria-hidden="true">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
    <div className="dice-fab-wrapper">
      <MesaLiveNotice />
      <NotificationPopup />
      <NotificationBell />
      <DiceFab />
    </div>
    </>
  )
}
