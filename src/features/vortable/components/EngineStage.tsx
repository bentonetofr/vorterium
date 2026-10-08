import { useEffect, useRef, useState } from 'react'
import { loadEngine } from '../services/vortableService'
import './VortableMesa.css'

export type Engine = Awaited<ReturnType<typeof loadEngine>>

interface EngineStageProps {
  /**
   * Monta o motor no palco e devolve como desmontar. `isDead()` vira true se
   * o palco foi desmontado no meio do carregamento.
   */
  mount: (engine: Engine, host: HTMLElement, isDead: () => boolean) => Promise<() => void>
  /** Quando algo daqui muda, o palco é remontado. */
  deps: readonly unknown[]
  /** Palco com rolagem própria (o criador de personagem). */
  scroll?: boolean
}

/** Palco onde o motor do Vortable roda, com tela de carregando e de erro. */
export function EngineStage({ mount, deps, scroll }: EngineStageProps) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let dead = false
    let destroy: (() => void) | null = null
    setStatus('loading')
    setError(null)

    ;(async () => {
      const engine = await loadEngine()
      const stop = await mount(engine, el, () => dead)
      if (dead) { stop(); return }
      destroy = stop
      setStatus('ready')
    })().catch((err) => {
      if (dead) return
      console.error('[vortable]', err)
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o Vortable.')
      setStatus('error')
    })

    return () => {
      dead = true
      destroy?.()
      el.replaceChildren()
    }
    // `mount` muda a cada render; quem decide quando remontar é `deps`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  return (
    <div className={`vortable-stage${scroll ? ' vortable-stage--scroll' : ''}`}>
      <div ref={host} className="vortable-stage__host" />
      {status === 'loading' && (
        <div className="vortable-stage__cover">
          <div className="spinner" />
          <span>Carregando o mundo...</span>
        </div>
      )}
      {status === 'error' && (
        <div className="vortable-stage__cover" role="alert">
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</button>
        </div>
      )}
    </div>
  )
}
