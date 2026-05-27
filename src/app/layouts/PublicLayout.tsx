import { Link, Outlet, useLocation } from 'react-router-dom'
import { MagicParticles } from '../../shared/components/MagicParticles'
import { ThemeToggle }    from '../../shared/components/ThemeToggle'
import './PublicLayout.css'

export function PublicLayout() {
  const { pathname } = useLocation()
  const isLanding = pathname === '/'

  return (
    <div className="public-layout">
      <div className="public-layout__bg"    aria-hidden="true" />
      <div className="public-layout__grain" aria-hidden="true" />
      <MagicParticles />

      <div className="public-layout__theme-toggle">
        <ThemeToggle />
      </div>

      <main className={`public-layout__main${isLanding ? ' public-layout__main--landing' : ''}`}>
        <Outlet />
      </main>

      <footer className="public-layout__footer">
        <nav className="public-layout__footer-links" aria-label="Links institucionais">
          <Link to="/sobre"       className="public-layout__footer-link">Sobre</Link>
          <Link to="/termos"      className="public-layout__footer-link">Termos de uso</Link>
          <Link to="/privacidade" className="public-layout__footer-link">Privacidade</Link>
          <Link to="/login"       className="public-layout__footer-link">Login</Link>
          <Link to="/cadastro"    className="public-layout__footer-link">Cadastro</Link>
        </nav>
        <span className="public-layout__footer-copy">© Vorterium</span>
      </footer>
    </div>
  )
}
