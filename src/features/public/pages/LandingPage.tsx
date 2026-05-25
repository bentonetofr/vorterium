import { Link } from 'react-router-dom'
import './PublicPages.css'

export function LandingPage() {
  return (
    <div className="landing animate-fade-in">
      <div className="landing__hero">
        <span className="landing__icon" aria-hidden="true">⚔</span>
        <h1 className="landing__title">Campaign Lab</h1>
        <p className="landing__subtitle">
          Organize suas campanhas de RPG de mesa. Gerencie membros, fichas de
          personagem e rolagens em um só lugar.
        </p>
      </div>

      <div className="landing__actions">
        <Link to="/login" className="btn btn-primary" style={{ padding: 'var(--space-4) var(--space-8)' }}>
          Entrar
        </Link>
        <Link to="/cadastro" className="btn btn-ghost">
          Criar conta
        </Link>
      </div>

      <div className="landing__features" aria-label="Funcionalidades disponíveis">
        {[
          'Campanhas',
          'Membros',
          'Fichas simples',
          'Rolagem de dados',
          'Histórico',
        ].map((f) => (
          <div key={f} className="landing__feature">
            <div className="landing__feature-dot" aria-hidden="true" />
            {f}
          </div>
        ))}
      </div>

      <nav className="landing__links" aria-label="Links institucionais">
        <Link to="/sobre" className="landing__link">Sobre</Link>
        <Link to="/termos" className="landing__link">Termos de uso</Link>
        <Link to="/privacidade" className="landing__link">Privacidade</Link>
      </nav>
    </div>
  )
}
