import './AppLogo.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

export interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const SIZE_PX: Record<NonNullable<AppLogoProps['size']>, { width: number; height: number }> = {
  sm: { width: 40, height: 52 },
  md: { width: 80, height: 80 },
  lg: { width: 128, height: 128 },
}

// A arte original tem muita margem transparente — no tamanho pequeno
// (barra lateral e topo do celular) o cavaleiro sumia. Ali usamos uma
// versão recortada rente ao desenho.
const SRC: Record<NonNullable<AppLogoProps['size']>, string> = {
  sm: '/assets/logo-campaign-lab-mark.png',
  md: '/assets/logo-campaign-lab.png',
  lg: '/assets/logo-campaign-lab.png',
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function AppLogo({
  size = 'md',
  showText = false,
  className = '',
}: AppLogoProps) {
  const { width, height } = SIZE_PX[size]

  return (
    <div className={`app-logo app-logo--${size} ${className}`}>
      <img
        src={SRC[size]}
        alt="Logo do Vorterium"
        className="app-logo__img"
        width={width}
        height={height}
        draggable={false}
      />

      {showText && (
        <span className="app-logo__text">Vorterium</span>
      )}
    </div>
  )
}
