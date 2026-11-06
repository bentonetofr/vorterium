import type { ReactNode } from 'react'

// ────────────────────────────────────────────────────────
// Ícones de traço fino das Raízes e das Gêneses (caixas de escolha do
// cabeçalho da ficha). Herdam a cor do texto, no mesmo estilo dos ícones das
// ações (AltheriumPlayKit). Ids desconhecidos ou vazios ficam sem ícone.
// ────────────────────────────────────────────────────────

const GLYPHS: Record<string, ReactNode> = {
  // Raízes
  berserker:  <><path d="M5 20 15 8" /><path d="M13 5.500c2.5-2 5.5-2 7.5-.500-.500 3-2.5 5.5-5.5 6.500z" /></>,
  runaskin:   <path d="M8 4v16M8 4l8 5-8 5M8 14l8 6" />,
  pilar:      <path d="M12 3c3 4 7 6 7 10a3.5 3.5 0 0 1-6 2.400c.200 2 .800 3.1 2 4.600H9c1.2-1.5 1.8-2.6 2-4.600A3.5 3.5 0 0 1 5 13c0-4 4-6 7-10z" />,
  // Gêneses
  cacador:           <><path d="M6 4c8 2 8 14 0 16M6 4v16" /><path d="M6 12h14m-3-3 3 3-3 3" /></>,
  curandeiro:        <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />,
  determinado:       <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" />,
  devoto:            <><circle cx="12" cy="12" r="3.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.600l2.1 2.100M16.3 16.300l2.1 2.100M18.4 5.600l-2.1 2.100M7.7 16.300l-2.1 2.1" /></>,
  filho_de_mercante: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.5" /><path d="M12 3.500v6M12 14.500v6M3.5 12h6M14.5 12h6" /></>,
  guerreiro:         <><path d="M14.5 4.500h5v5L9 20l-4-4z" /><path d="m7 14 3 3M4 20l3-3" /></>,
  guia_espiritual:   <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  corredor:          <><path d="M4 8h9M2 12h13M5 16h8" /><path d="m16 6 5 6-5 6" /></>,
  peregrino:         <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  rastreador:        <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  robusto:           <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />,
  sem_passado:       <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.500a2.5 2.5 0 1 1 3.5 2.300c-.700.4-1 .900-1 1.700M12 17h.010" /></>,
}

export function AlthGlyph({ name }: { name: string }) {
  const glyph = GLYPHS[name]
  if (!glyph) return null
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyph}
    </svg>
  )
}
