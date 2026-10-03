import type { Dir, PosMsg } from '../livroNet'

// ────────────────────────────────────────────────────────
// Guarda no banco onde o MEU boneco está (e a janela aberta), pra voltar
// ao mesmo lugar depois de uma troca de jogo ou de recarregar a página.
// Não é o ao vivo (esse continua pelo canal, 12 por segundo): aqui é só
// de vez em quando —
//   • a cada 3 s, se mudou;
//   • na hora, quando abre ou fecha uma janela;
//   • ao sair (troca de jogo, voltar ao site), com a última posição.
// Serve pros dois jogos (cada um passa a sua função de salvar).
// ────────────────────────────────────────────────────────

export interface SavedPos { x: number; y: number; d: Dir; p: string | null }

const EVERY = 3000

export function createPosSaver(save: (pos: SavedPos) => Promise<void>) {
  let last: SavedPos | null = null
  let sent = ''
  let timer: number | undefined

  const key = (p: SavedPos) => `${p.x},${p.y},${p.d},${p.p}`
  const flush = () => {
    window.clearTimeout(timer)
    timer = undefined
    if (!last || key(last) === sent) return
    sent = key(last)
    void save(last).catch(() => { sent = '' })
  }

  return {
    /** Cada posição que o motor manda pra rede passa por aqui. */
    push(msg: PosMsg<string>) {
      const next: SavedPos = { x: Math.round(msg.x * 10) / 10, y: Math.round(msg.y * 10) / 10, d: msg.d, p: msg.p }
      const panelChanged = !!last && last.p !== next.p
      last = next
      if (panelChanged) { flush(); return }
      if (timer === undefined) timer = window.setTimeout(flush, EVERY)
    },
    /** Salva agora a última posição (ao sair). */
    flush,
  }
}
