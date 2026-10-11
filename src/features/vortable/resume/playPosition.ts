import type { VortableSnapshot } from '../../../vendor/vortable/vortable'

// ────────────────────────────────────────────────────────
// Onde o boneco do jogador está (zona e ponto), guardado no navegador pra sobreviver a recarregar a página,
// fechar a aba ou cair a conexão: ao voltar, ele continua na zona em que estava, não no começo do mundo.
// (O `resumeStore` guarda o mesmo só na memória, enquanto a página continua aberta.)
// ────────────────────────────────────────────────────────

interface Saved {
  worldId: string
  snap: VortableSnapshot
}

const key = (campaignId: string, userId: string) => `vortable:pos:${campaignId}:${userId}`

export function loadPlayPosition(campaignId: string, userId: string): Saved | null {
  try {
    const raw = localStorage.getItem(key(campaignId, userId))
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Saved>
    const snap = saved.snap
    if (typeof saved.worldId !== 'string' || !snap || snap.kind !== 'play' || typeof snap.zoneId !== 'string') return null
    return { worldId: saved.worldId, snap }
  } catch {
    return null
  }
}

export function savePlayPosition(campaignId: string, userId: string, saved: Saved) {
  try { localStorage.setItem(key(campaignId, userId), JSON.stringify(saved)) } catch { /* sem storage: só não lembra */ }
}
