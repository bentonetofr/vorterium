// ────────────────────────────────────────────────────────
// Modo leve dos dados 3D, pro celular. Nos telefones os dados apareciam pretos: o caminho completo (texturas enormes, verniz,
// mapas de rugosidade e de metal, sombra em tempo real) estoura a memória de desenho e a de textura de muitos aparelhos, ou
// cai em limitações da GPU, e o dado sai sem cor. O modo leve usa texturas menores, um material mais simples e sem sombra
// em tempo real.
//
// Liga sozinho em tela de toque e em aparelho com pouca memória. Pra testar no computador: `?dados=leve` no endereço (ou
// `?dados=completo` pra forçar o modo completo no celular).
// ────────────────────────────────────────────────────────

function detect(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get('dados')
    if (q === 'leve') return true
    if (q === 'completo') return false
    if (window.matchMedia?.('(pointer: coarse)').matches) return true
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    return typeof mem === 'number' && mem <= 4
  } catch {
    return false
  }
}

/** Este aparelho precisa do modo leve? (decidido uma vez, ao abrir a página) */
export const LITE_DICE = typeof window !== 'undefined' && detect()
