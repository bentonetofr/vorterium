// d6 na notificação usa as faces de dado reais do Unicode (⚀-⚅); aqui, e para
// os outros tipos (que não têm face própria no Unicode), desenha o contorno
// minimalista do sólido.
export function DieShapeIcon({ sides, size = 16 }: { sides: number; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
  switch (sides) {
    case 2:  return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="5.5" /></svg>
    case 3:  return <svg {...common}><rect x="5" y="5" width="14" height="14" rx="4" /><path d="M9 10.5 L11 9.5 V15 M13.5 11 Q15 9.5 16 11 Q16 12.5 13.5 14.5 H16.2" strokeWidth="1.2" /></svg>
    case 4:  return <svg {...common}><polygon points="12,3 21,19 3,19" /></svg>
    case 6:  return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
    case 8:  return <svg {...common}><polygon points="12,3 21,12 12,21 3,12" /></svg>
    case 10: return <svg {...common}><polygon points="12,2 20,9 17,20 7,20 4,9" /></svg>
    case 12: return <svg {...common}><polygon points="12,2 20,7 20,17 12,22 4,17 4,7" /></svg>
    default: return (
      // d20 e demais (d100...): hexágono facetado — "arredondado" de longe, mas
      // um dado nunca é redondo de verdade, então marca as facetas com raios internos.
      <svg {...common}>
        <polygon points="12,2 20,7 20,17 12,22 4,17 4,7" />
        <path d="M12,2 L12,12 M20,7 L12,12 M20,17 L12,12 M12,22 L12,12 M4,17 L12,12 M4,7 L12,12" />
      </svg>
    )
  }
}
