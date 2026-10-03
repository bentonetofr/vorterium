import type { SeatColor, SeatEmblem } from './caatService'

// ────────────────────────────────────────────────────────
// Heráldica dos assentos: cada lugar da mesa tem um estandarte com cor E
// emblema próprios (torre, chave, folha, sino) — dá pra distinguir os
// jogadores pela forma, não só pela cor. E o retrato em moldura.
// ────────────────────────────────────────────────────────

export const SEAT_HEX: Record<SeatColor, string> = {
  azul:     '#3d5fa8',
  vermelho: '#a8323a',
  verde:    '#3f7d4a',
  roxo:     '#6c4a9e',
}

const EMBLEM_PATHS: Record<SeatEmblem, string> = {
  torre: 'M7 21V10h10v11M5.5 10V5.5h2.5v2h2.5v-2h3v2h2.5v-2h2.5V10M10.5 21v-4a1.5 1.5 0 0 1 3 0v4',
  chave: 'M8 5.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M11.5 9H20M17 9v3M20 9v4',
  folha: 'M5 19C5 10.5 10.5 5 19.5 4.5C19 13.5 13.5 19 5 19zM5 19l8.5-8.5',
  sino:  'M6 16.5h12l-1.8-2.6V10a4.2 4.2 0 0 0-8.4 0v3.9zM10 19.5h4M12 3.5v2.3',
}

export function EmblemIcon({ emblem, size = 20 }: { emblem: SeatEmblem; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={EMBLEM_PATHS[emblem]} />
    </svg>
  )
}

/** Estandarte pendurado (como na mesa): pano da cor do assento, emblema em ouro. */
export function Banner({ color, emblem, size = 44 }: { color: SeatColor; emblem: SeatEmblem; size?: number }) {
  const h = Math.round(size * 1.3)
  return (
    <svg viewBox="0 0 40 52" width={size} height={h} className="cd-banner" aria-hidden="true">
      <rect x="1" y="1" width="38" height="3" rx="1.5" fill="#8a6d33" />
      <path d="M4 4h32v40l-16-7-16 7z" fill={SEAT_HEX[color]} stroke="#c9a24a" strokeWidth="1.2" />
      <path d="M4 4h32v40l-16-7-16 7z" fill="url(#cd-cloth)" opacity="0.35" />
      <defs>
        <linearGradient id="cd-cloth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.25" /><stop offset="1" stopColor="#000" />
        </linearGradient>
      </defs>
      <g transform="translate(9 9) scale(0.92)" color="#f0dca0">
        <path d={EMBLEM_PATHS[emblem]} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

/** Retrato em moldura (a inicial gravada até ter imagem). */
export function Portrait({ name, color, size = 52 }: { name: string; color?: SeatColor; size?: number }) {
  return (
    <span className="cd-portrait" style={{ width: size, height: size, fontSize: size * 0.48, borderColor: color ? SEAT_HEX[color] : undefined }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
