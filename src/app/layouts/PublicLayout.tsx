import { Link, Outlet } from 'react-router-dom'
import { MagicParticles } from '../../shared/components/MagicParticles'
import { ThemeToggle }    from '../../shared/components/ThemeToggle'
import './PublicLayout.css'

export function PublicLayout() {
  return (
    <div className="public-layout">
      <div className="public-layout__bg"    aria-hidden="true" />
      <div className="public-layout__grain" aria-hidden="true" />
      <MagicParticles />

      <div className="public-layout__theme-toggle">
        <ThemeToggle />
      </div>

      <main className="public-layout__main">
        <Outlet />
      </main>

      <footer className="public-layout__footer">
        <nav className="public-layout__footer-links" aria-label="Links institucionais">
          <Link to="/sobre"       className="public-layout__footer-link">Sobre</Link>
          <Link to="/termos"      className="public-layout__footer-link">Termos de uso</Link>
          <Link to="/privacidade" className="public-layout__footer-link">Privacidade</Link>
        </nav>
        <span className="public-layout__footer-copy">© Campaign Lab</span>
      </footer>
    </div>
  )
}
