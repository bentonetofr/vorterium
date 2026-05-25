import { Outlet } from 'react-router-dom'
import { MagicParticles } from '../../shared/components/MagicParticles'
import { ThemeToggle } from '../../shared/components/ThemeToggle'
import './PublicLayout.css'

export function PublicLayout() {
  return (
    <div className="public-layout">
      <div className="public-layout__bg"   aria-hidden="true" />
      <div className="public-layout__grain" aria-hidden="true" />

      {/* Partículas mágicas subindo — efeito atmosférico */}
      <MagicParticles />

      {/* Botão de tema — fixo no canto superior direito */}
      <div className="public-layout__theme-toggle">
        <ThemeToggle />
      </div>

      <main className="public-layout__main">
        <Outlet />
      </main>

      <footer className="public-layout__footer">
        © Campaign Lab
      </footer>
    </div>
  )
}
