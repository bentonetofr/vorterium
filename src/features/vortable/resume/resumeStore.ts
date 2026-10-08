import type { VortableSnapshot } from '../../../vendor/vortable/vortable'

// ────────────────────────────────────────────────────────
// "Voltar exatamente onde estava": o que a pessoa deixou no Vortable ao sair
// (pelo botão, pela telinha ou pelo navegador) fica guardado aqui, por campanha,
// enquanto a aba do site continua aberta (recarregar a página zera).
//   jogador: onde o boneco parou (zona e ponto) e se estava só assistindo
//   mestre: a aba em que estava e o editor (zona aberta, mesmo sem salvar, e câmera)
// ────────────────────────────────────────────────────────

export interface Resume {
  masterTab?: string
  /** Editor do mestre; só vale pro mesmo mundo. */
  editor?: { worldId: string; snap: VortableSnapshot }
  /** Jogo do jogador; só vale pro mesmo mundo. */
  play?: { worldId: string; snap: VortableSnapshot }
  /** Estava só assistindo (modo espectador). */
  watching?: boolean
}

const store = new Map<string, Resume>()

export const getResume = (campaignId: string): Resume | undefined => store.get(campaignId)

export function patchResume(campaignId: string, patch: Partial<Resume>) {
  store.set(campaignId, { ...store.get(campaignId), ...patch })
}

export function clearResume(campaignId: string) {
  store.delete(campaignId)
}
