import './AppLogo.css'

// ────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────

export interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const SIZE_PX: Record<NonNullable<AppLogoProps['size']>, number> = {
  sm: 36,
  md: 80,
  lg: 128,
}

// ────────────────────────────────────────────────────────
// Componente
// ────────────────────────────────────────────────────────

export function AppLogo({
  size = 'md',
  showText = false,
  className = '',
}: AppLogoProps) {
  const px = SIZE_PX[size]

  return (
    <div className={`app-logo app-logo--${size} ${className}`}>
      <img
        src="/assets/logo-campaign-lab.png"
        alt="Logo do Campaign Lab"
        className="app-logo__img"
        width={px}
        height={px}
        draggable={false}
      />

      {showText && (
        <span className="app-logo__text">Campaign Lab</span>
      )}
    </div>
  )
}
