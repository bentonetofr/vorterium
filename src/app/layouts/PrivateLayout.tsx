import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthProvider'
import { ThemeToggle } from '../../shared/components/ThemeToggle'
import { AppLogo }     from '../../shared/components/AppLogo'
import './PrivateLayout.css'

export function PrivateLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email ??
    '—'

  const initial = displayName.trim().charAt(0).toUpperCase()

  async function handleSignOut() {
    try { await signOut() } finally { navigate('/login', { replace: true }) }
  }

  return (
    <div className="private-layout">
      {/* ── Sidebar (desktop) ── */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <AppLogo size="sm" showText />
        </div>

        {user && (
          <div className="sidebar__user">
            <div className="sidebar__avatar" aria-hidden="true">{initial}</div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">{displayName}</span>
              {user.user_metadata?.display_name && (
                <span className="sidebar__user-email">{user.email}</span>
              )}
            </div>
          </div>
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
      </header>

      <main className="private-layout__main">
        <Outlet />
      </main>
    </div>
  )
}
