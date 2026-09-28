import { Link, useLocation } from 'react-router-dom'
import { SITE_NAV, TOOL_NAV, type NavItem } from '../../../app/navigation'
import { useUnseenChangelog } from '../../../shared/constants/changelog'
import '../../../shared/theme/toolPage.css'
import './MorePage.css'

// ────────────────────────────────────────────────────────
// "Mais" — no celular, as seções do menu que não cabem na barra de baixo.
// ────────────────────────────────────────────────────────

export function MorePage() {
  const location = useLocation()
  const unseen = useUnseenChangelog()

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
                <span className="more-link__icon" aria-hidden="true">{item.icon}</span>
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
      <nav className="more-legal" aria-label="Links institucionais">
        <Link to="/sobre">Sobre</Link>
        <Link to="/termos">Termos</Link>
        <Link to="/privacidade">Privacidade</Link>
      </nav>
    </div>
  )
}
