/**
 * Zoom da câmera do jogador. O motor abre cada zona em 2x (um bloco de 32 px = 64 px na tela), o que
 * numa tela de celular mostra só uns 6 blocos de largura. Aqui o zoom padrão acompanha o tamanho da
 * tela, a pessoa ajusta pelos botões + e − (fica guardado) e o motor lê `window.__vtPlayZoom`
 * (remenda 10 do scripts/patch-vortable-camera.mjs) a cada zona.
 */
const KEY = 'vortable:zoom'
export const ZOOM_MIN = 0.75
export const ZOOM_MAX = 3

const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 4) / 4))

/** Zoom que enche a tela com um tanto de mundo parecido em qualquer aparelho. */
export function defaultPlayZoom() {
  const { innerWidth: w, innerHeight: h } = window
  // celular deitado: sobra pouca altura, então o zoom acompanha a menor medida
  if (w < 520 || h < 460) return 1.25
  if (w < 900) return 1.5
  return 2
}

export function getPlayZoom() {
  try {
    const stored = Number(localStorage.getItem(KEY))
    if (stored > 0) return clamp(stored)
  } catch { /* sem armazenamento: usa o padrão */ }
  return defaultPlayZoom()
}

export function savePlayZoom(zoom: number) {
  const z = clamp(zoom)
  try { localStorage.setItem(KEY, String(z)) } catch { /* só não lembra */ }
  return z
}

/** Chamar antes de montar o jogo: a cena nasce já no zoom certo. */
export function primePlayZoom() {
  const z = getPlayZoom()
  ;(window as unknown as { __vtPlayZoom?: number }).__vtPlayZoom = z
  return z
}
