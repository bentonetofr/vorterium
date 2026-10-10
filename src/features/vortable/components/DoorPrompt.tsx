import { useEffect, useRef } from 'react'
import type { DoorRequest } from '../net/VortableNet'
import './DoorPrompt.css'

/** Um toque curto avisando o mestre (o navegador pode não deixar tocar antes do primeiro clique; aí fica só o aviso na tela). */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)
    gain.connect(ctx.destination)
    for (const [i, f] of [660, 880].entries()) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = f
      osc.connect(gain)
      osc.start(ctx.currentTime + i * 0.14)
      osc.stop(ctx.currentTime + i * 0.14 + 0.2)
    }
    window.setTimeout(() => { void ctx.close() }, 900)
  } catch { /* sem som, só o aviso */ }
}

/**
 * Mestre: um jogador pisou numa saída da zona e espera a sua licença. Fica empilhado no canto até ele responder.
 * Sim: o boneco atravessa. Não: ele fica onde está.
 */
export function DoorPrompt({ requests, onAnswer }: { requests: DoorRequest[]; onAnswer: (req: DoorRequest, ok: boolean) => void }) {
  const count = useRef(0)
  useEffect(() => {
    if (requests.length > count.current) chime()
    count.current = requests.length
  }, [requests.length])
  if (!requests.length) return null
  return (
    <div className="doorprompt" role="region" aria-label="Pedidos para sair da zona" aria-live="assertive">
      {requests.map((r) => (
        <div className="doorprompt__card" key={`${r.peerId}:${r.id}`} role="alertdialog" aria-label={`${r.name} quer sair da zona`}>
          <p className="doorprompt__title"><strong>{r.name}</strong> quer sair da zona</p>
          <p className="doorprompt__route">
            <span>{r.fromName || r.from}</span>
            <i aria-hidden="true">→</i>
            <span>{r.toName || r.to}</span>
          </p>
          {r.via && <small>Saída: {r.via}</small>}
          <p className="doorprompt__ask">Você permite?</p>
          <div className="doorprompt__btns">
            <button type="button" className="btn btn-primary" onClick={() => onAnswer(r, true)}>Sim</button>
            <button type="button" className="btn btn-ghost doorprompt__no" onClick={() => onAnswer(r, false)}>Não</button>
          </div>
        </div>
      ))}
    </div>
  )
}
