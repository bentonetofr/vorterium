import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { SITE_NAV, TOOL_NAV, type NavItem } from '../../../app/navigation'
import { useUnseenChangelog } from '../../../shared/constants/changelog'
import { NavIcon, hasNavIcon } from '../../../shared/components/NavIcon'
import { useInstallApp } from '../../../shared/lib/installApp'
import '../../../shared/theme/toolPage.css'
import './MorePage.css'

// ────────────────────────────────────────────────────────
// "Mais" — no celular, as seções do menu que não cabem na barra de baixo.
// ────────────────────────────────────────────────────────

export function MorePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const unseen = useUnseenChangelog()
  const { state: installState, install } = useInstallApp()

  function renderGroup(title: string, items: NavItem[]) {
    return (
      <section className="more-group">
        <h2 className="tool-label">{title}</h2>
        <ul className="more-list">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                // O feedback leva junto de onde a pessoa veio.
                state={item.to === '/feedback' ? { from: (location.state as { from?: string } | null)?.from } : undefined}
                className="more-link"
              >
                <span className="more-link__icon" aria-hidden="true">{hasNavIcon(item.to) ? <NavIcon to={item.to} /> : item.icon}</span>
                <span className="more-link__text">
                  <span className="more-link__label">
                    {item.label}
                    {item.to === '/novidades' && unseen && <span className="more-link__dot" aria-label="novidade" />}
                  </span>
                  {item.hint && <span className="more-link__hint">{item.hint}</span>}
                </span>
                <span className="more-link__chevron" aria-hidden="true">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="tool-page more-page">
      <div className="tool-page__header">
        <div className="tool-page__titles">
          <h1 className="tool-page__title">Mais</h1>
        </div>
      </div>
      {renderGroup('Ferramentas', TOOL_NAV)}
      {renderGroup('Vorterium', SITE_NAV)}

      {/* Instalar como aplicativo: só aparece onde dá pra instalar e ainda não está instalado */}
      {(installState === 'available' || installState === 'ios') && (
        <section className="more-install">
          <span className="more-install__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 7.5v7M9 11.8l3 3 3-3" />
            </svg>
          </span>
          <div className="more-install__text">
            <strong>Instalar o Vorterium</strong>
            {installState === 'available'
              ? <span>Vira um aplicativo na tela inicial, em tela cheia e sem a barra do navegador.</span>
              : <span>No iPhone: toque em Compartilhar (o quadrado com a seta) e depois em "Adicionar à Tela de Início".</span>}
          </div>
          {installState === 'available' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { void install() }}>Instalar</button>
          )}
        </section>
      )}
      <button
        type="button"
        className="btn btn-ghost more-signout"
        onClick={async () => { try { await signOut() } finally { navigate('/login', { replace: true }) } }}
      >
        <span aria-hidden="true">↩</span> Sair da conta
      </button>
      <nav className="more-legal" aria-label="Links institucionais">
        <Link to="/sobre">Sobre</Link>
        <Link to="/termos">Termos</Link>
        <Link to="/privacidade">Privacidade</Link>
      </nav>
    </div>
  )
}
