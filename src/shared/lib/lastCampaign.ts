// ────────────────────────────────────────────────────────
// "Onde eu parei": a última campanha (e a seção dela) que a pessoa abriu
// neste aparelho. A página Campanhas usa pra oferecer o atalho "Continuar".
// Fica só no navegador, por conta — nada vai pro banco.
// ────────────────────────────────────────────────────────

export interface LastCampaign {
  campaignId: string
  /** Seção em que estava (visao-geral, mesa-sessao, membros…). */
  section:    string
  /** Quando abriu (ms). */
  at:         number
}

const key = (userId: string) => `vorterium:ultima-campanha:${userId}`

export function rememberCampaign(userId: string, campaignId: string, section: string): void {
  try {
    const value: LastCampaign = { campaignId, section: section || 'visao-geral', at: Date.now() }
    localStorage.setItem(key(userId), JSON.stringify(value))
  } catch { /* sem armazenamento: só não lembra */ }
}

export function readLastCampaign(userId: string): LastCampaign | null {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<LastCampaign>
    if (typeof value.campaignId !== 'string' || typeof value.section !== 'string') return null
    return { campaignId: value.campaignId, section: value.section, at: Number(value.at) || 0 }
  } catch {
    return null
  }
}

export function forgetCampaign(userId: string, campaignId: string): void {
  try {
    if (readLastCampaign(userId)?.campaignId === campaignId) localStorage.removeItem(key(userId))
  } catch { /* sem armazenamento */ }
}
