import { useEffect } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { markSeen, playAscension, useMestreState, wasSeen } from './mestreService'
import './Mestre.css'

// ────────────────────────────────────────────────────────
// O tema de quem virou Mestre, no site todo: o azul vira o preto Pantone
// Black 6 C, o dourado fica mais dourado e brilha, e partículas douradas
// sobem pelo fundo. Liga só no fim da animação da ascensão. Quem não
// estava online quando a campanha ascendeu vê a animação ao voltar.
// ────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left:     ((i / 26) * 100 + (((i * 37 + 13) % 15) - 7) + 100) % 100,
  size:     2 + ((i * 7) % 5),
  duration: 12 + ((i * 3) % 14),
  delay:    -((i * 8.3) % 24),
  glow:     i % 4 === 0,
}))

export function MestreTheme() {
  const { user } = useAuth()
  const { mestre, ascending } = useMestreState()
  const on = mestre === true && !ascending

  // Tema no <html> (por cima do claro/escuro escolhido; volta ao sair).
  useEffect(() => {
    if (!on) return
    const root = document.documentElement
    const prevTheme = root.getAttribute('data-theme')
    root.setAttribute('data-mestre', '')
    root.setAttribute('data-theme', 'dark')
    return () => {
      root.removeAttribute('data-mestre')
      if (prevTheme) root.setAttribute('data-theme', prevTheme)
    }
  }, [on])

  // Virou Mestre sem ver a animação (não estava na campanha na hora): mostra agora.
  useEffect(() => {
    if (!user?.id || mestre !== true || wasSeen(user.id)) return
    markSeen(user.id)
    playAscension()
  }, [user?.id, mestre])

  if (!on) return null
  return (
    <div className="mestre-particles" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={`mestre-particle${p.glow ? ' mestre-particle--glow' : ''}`}
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  )
}
