import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { forgetDeveloperCheck } from './services/devService'
import './dev.css'

// ────────────────────────────────────────────────────────
// Casca do painel do desenvolvedor — separada do site dos jogadores (sem
// dado, chat, sino nem avisos, que receberiam tudo de todas as campanhas).
// Tudo aqui é leitura; a única ação é o status do feedback.
// ────────────────────────────────────────────────────────

const NAV = [
  { to: '/dev',           label: 'Visão geral', end: true },
  { to: '/dev/feedback',  label: 'Feedback' },
  { to: '/dev/usuarios',  label: 'Usuários' },
  { to: '/dev/campanhas', label: 'Campanhas' },
]

export function DevLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function leave() {
    await signOut()
    forgetDeveloperCheck()
    navigate('/dev/entrar', { replace: true })
  }

  return (
    <div className="dev">
      <header className="dev__bar">
        <span className="dev__brand">
          <span className="dev__brand-mark">DEV</span>
          Vorterium
        </span>
        <nav className="dev__nav" aria-label="Painel do desenvolvedor">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `dev__link${isActive ? ' dev__link--active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <span className="dev__who" title={user?.email ?? ''}>{user?.email}</span>
        <button type="button" className="dev__leave" onClick={() => void leave()}>Sair</button>
      </header>
      <p className="dev__readonly">Modo leitura: nada aqui altera os dados dos jogadores (exceto o status do feedback).</p>
      <main className="dev__main">
        <Outlet />
      </main>
    </div>
  )
}
