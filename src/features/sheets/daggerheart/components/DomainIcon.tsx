import type { DhDomain } from '../model/types'
import { DOMAINS } from '../catalog/rules'

// ────────────────────────────────────────────────────────
// Um símbolo para cada domínio (desenhos próprios do site, em traço, na cor do domínio). Servem de marca nas cartas,
// no cabeçalho da classe e nos seletores.
// ────────────────────────────────────────────────────────

const PATHS: Record<DhDomain, JSX.Element> = {
  // Arcano: o olho que enxerga a magia
  arcano: <><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></>,
  // Lâmina: uma espada
  lamina: <><path d="M20.5 3.5l-3 .6L8 13.6l2.4 2.4 9.5-9.5z" /><path d="M6 12l6 6" /><path d="M7.4 16.6L4 20" /></>,
  // Falange: um osso
  falange: <><path d="M8.5 15.5l7-7" /><circle cx="6.4" cy="15" r="1.9" /><circle cx="9" cy="17.6" r="1.9" /><circle cx="15" cy="6.4" r="1.9" /><circle cx="17.6" cy="9" r="1.9" /></>,
  // Códice: um livro aberto
  codice: <><path d="M12 6.5C10.5 5.3 8 4.8 4 5v13c4-.2 6.5.3 8 1.5" /><path d="M12 6.5c1.5-1.2 4-1.7 8-1.5v13c-4-.2-6.5.3-8 1.5z" /><path d="M12 6.5v13" /></>,
  // Graça: um coração
  graca: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  // Meia-noite: a lua crescente
  meia_noite: <><path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z" /><path d="M17 4v3M15.5 5.5h3" /></>,
  // Sabedoria: uma folha
  sabedoria: <><path d="M5 19c-.5-9 5-14.5 15-14.5 0 9.5-5 15-12 15" /><path d="M5 19l8.5-8.5" /></>,
  // Esplendor: o sol
  esplendor: <><circle cx="12" cy="12" r="3.8" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></>,
  // Valor: um escudo
  valor: <path d="M12 3l7.5 2.8v6.1c0 4.7-3.2 7.9-7.5 9.1-4.3-1.2-7.5-4.4-7.5-9.1V5.8z" />,
}

interface Props {
  domain: DhDomain
  size?: number
  /** Usa a cor do domínio (padrão); false herda a cor do texto. */
  colored?: boolean
  title?: boolean
}

export function DomainIcon({ domain, size = 18, colored = true, title = true }: Props) {
  const d = DOMAINS[domain]
  return (
    <svg className="dh-domain-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={colored ? d.color : 'currentColor'}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={d.name}>
      {title && <title>{d.name}</title>}
      {PATHS[domain]}
    </svg>
  )
}
