import './MagicParticles.css'

// ────────────────────────────────────────────────────────
// Dados estáticos das partículas
// Calculados uma vez fora do componente — sem re-render custo.
// Pseudo-aleatório deterministico via índice.
// ────────────────────────────────────────────────────────

interface ParticleData {
  id: number
  left: number    // posição horizontal em %
  size: number    // tamanho em px
  duration: number // duração da animação em s
  delay: number    // delay negativo = começa no meio da animação
  glow: boolean    // partícula maior com brilho extra
}

function buildParticles(count: number): ParticleData[] {
  return Array.from({ length: count }, (_, i) => {
    // Distribui uniformemente com leve variação para não parecer grade
    const base = (i / count) * 100
    const jitter = ((i * 37 + 13) % 15) - 7   // -7 a +7

    return {
      id: i,
      left:     Math.min(98, Math.max(1, base + jitter)),
      size:     1.8 + ((i * 7)  % 5.5),        // 1.8 – 7.3px
      duration: 11  + ((i * 3)  % 15),         // 11 – 26s
      delay:   -((i * 8.3) % 24),              // negativo = início imediato
      glow:    i % 5 === 0,                    // cada 5a partícula tem glow extra
    }
  })
}

const PARTICLES = buildParticles(28)

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function MagicParticles() {
  return (
    <div className="magic-particles" aria-hidden="true">
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className={`magic-particle ${p.glow ? 'magic-particle--glow' : ''}`}
          style={{
            left:             `${p.left}%`,
            width:            `${p.size}px`,
            height:           `${p.size}px`,
            animationDuration:`${p.duration}s`,
            animationDelay:   `${p.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
