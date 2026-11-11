import type { ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Ícones do menu do site, desenhados em linha (SVG) — iguais em qualquer
// aparelho. Antes eram caracteres (◈ ◎ ☰ …), que mudavam de tamanho e de
// desenho conforme a fonte do celular. O traço segue a cor do texto.
// ────────────────────────────────────────────────────────

const PATHS: Record<string, ReactNode> = {
  // losango dentro de losango — a marca das campanhas
  '/campanhas': (
    <>
      <path d="M12 2.8 21.2 12 12 21.2 2.8 12Z" />
      <path d="M12 8.4 15.6 12 12 15.6 8.4 12Z" fill="currentColor" stroke="none" />
    </>
  ),
  // pergaminho enrolado nas pontas
  '/minhas-fichas': (
    <>
      <path d="M7 4h10.5A2.5 2.5 0 0 1 20 6.5V7h-3" />
      <path d="M17 4a2.5 2.5 0 0 0-2.5 2.5V18A2.5 2.5 0 0 1 12 20.5H5.5A2.5 2.5 0 0 1 3 18v-.5h9" />
      <path d="M7 4a2.5 2.5 0 0 0-2.5 2.5v11" />
      <path d="M8 9.5h4M8 13h4" />
    </>
  ),
  // ampulheta: o que aconteceu há pouco
  '/atividade': (
    <>
      <path d="M6.5 3.5h11M6.5 20.5h11" />
      <path d="M8 3.5v3.2c0 1.5.8 2.6 2 3.6l2 1.7 2-1.7c1.200-1 2-2.100 2-3.600V3.500" />
      <path d="M8 20.5v-3.2c0-1.500.8-2.600 2-3.600l2-1.700 2 1.700c1.200 1 2 2.100 2 3.600v3.200" />
      <path d="M10.4 17.800h3.200" />
    </>
  ),
  // busto: a pessoa
  '/perfil': (
    <>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.800 20.200c.7-3.700 3.600-6 7.200-6s6.500 2.300 7.200 6" />
    </>
  ),
  // quatro peças: o resto do site
  '/mais': (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <path d="M16.750 3.500 20.500 7.250 16.750 11 13 7.250Z" />
    </>
  ),
  // livro aberto
  '/biblioteca': (
    <>
      <path d="M12 6.300C10.300 4.900 7.900 4.300 4 4.500v13.500c3.900-.2 6.300.4 8 1.800" />
      <path d="M12 6.300c1.700-1.400 4.100-2 8-1.800v13.500c-3.900-.2-6.300.4-8 1.800" />
      <path d="M12 6.300v13.500" />
    </>
  ),
  // caveira
  '/meu-bestiario': (
    <>
      <path d="M12 3.500c-4.300 0-7.500 3-7.500 7 0 2.300 1 4.100 2.700 5.300V18.500a1 1 0 0 0 1 1h7.600a1 1 0 0 0 1-1v-2.700c1.700-1.200 2.700-3 2.700-5.300 0-4-3.200-7-7.500-7Z" />
      <circle cx="9.200" cy="11" r="1.500" fill="currentColor" stroke="none" />
      <circle cx="14.800" cy="11" r="1.500" fill="currentColor" stroke="none" />
      <path d="M10.500 19.500v-2.200M13.500 19.500v-2.200M11.200 14.600 12 13.400l.8 1.200" />
    </>
  ),
  // quadro com moldura
  '/galeria': (
    <>
      <rect x="3.500" y="4.500" width="17" height="15" rx="2" />
      <path d="m3.500 15.500 4.500-4.500 4 4 2.500-2.500 6 6" />
      <circle cx="15.800" cy="9" r="1.400" />
    </>
  ),
  // estrela de quatro pontas
  '/novidades': (
    <>
      <path d="M12 3.200c.5 4.800 2 6.300 6.800 6.800-4.800.5-6.300 2-6.800 6.800-.5-4.800-2-6.300-6.800-6.800 4.800-.5 6.300-2 6.800-6.800Z" />
      <path d="M18.500 15.800c.2 1.900.8 2.500 2.700 2.700-1.900.2-2.500.8-2.700 2.700-.2-1.900-.8-2.500-2.700-2.700 1.900-.2 2.500-.8 2.700-2.700Z" />
    </>
  ),
  '/ajuda': (
    <>
      <circle cx="12" cy="12" r="8.700" />
      <path d="M9.400 9.600c.2-1.500 1.200-2.400 2.700-2.400 1.600 0 2.700 1 2.700 2.400 0 2.100-2.700 2.200-2.700 4.200" />
      <circle cx="12.100" cy="16.700" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  // carta lacrada
  '/feedback': (
    <>
      <rect x="3.500" y="5.500" width="17" height="13" rx="2" />
      <path d="m4 7 8 6.200L20 7" />
    </>
  ),
}

interface NavIconProps {
  /** Rota do item do menu (ex.: "/campanhas"). */
  to:    string
  size?: number
}

/** Ícone do item de menu daquela rota; sem desenho pra rota, não mostra nada. */
export function NavIcon({ to, size = 20 }: NavIconProps) {
  const paths = PATHS[to]
  if (!paths) return null
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  )
}

/** Há desenho pra esta rota? (quem não tem continua com o caractere antigo). */
export function hasNavIcon(to: string): boolean {
  return to in PATHS
}
