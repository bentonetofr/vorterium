import { useEffect, useRef, useState, type ReactNode } from 'react'
import { loadEngine } from '../services/vortableService'
import './VortableMesa.css'
import './EngineMobile.css'
import { Loader } from '../../../shared/components/Loader'
import { captureEngineErrors } from '../errors/engineErrors'
import { errorText, isChunkError, VortableError } from '../errors/vtCodes'
import { vtError, vtResolve } from '../errors/vtErrors'

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
  /** Por cima do palco (controles na tela, avisos). */
  children?: ReactNode
}

let stageSeq = 0

/** Palco onde o motor do Vortable roda, com tela de carregando e de erro (com o código do erro). */
export function EngineStage({ mount, deps, scroll, children }: EngineStageProps) {
  const host = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // erros do motor (console, erros soltos) viram códigos enquanto o palco existe
  useEffect(() => captureEngineErrors(), [])

  useEffect(() => {
    const el = host.current
    if (!el) return
    let dead = false
    let destroy: (() => void) | null = null
    setStatus('loading')
    setError(null)
    setReload(false)

    // a placa de vídeo reiniciou: a tela do jogo apaga até o navegador devolver o contexto
    const gpuKey = `webgl:${++stageSeq}`
    const onLost = () => vtError('VT-MOTOR-006', { key: gpuKey })
    const onRestored = () => vtResolve(gpuKey)
    el.addEventListener('webglcontextlost', onLost, true)
    el.addEventListener('webglcontextrestored', onRestored, true)

    ;(async () => {
      let engine: Engine
      try {
        engine = await loadEngine()
      } catch (err) {
        // em geral o site foi atualizado e o arquivo antigo do motor não existe mais
        throw isChunkError(err) ? new VortableError('VT-MOTOR-001', 'Os arquivos do Vortable não carregaram (o site pode ter sido atualizado). Recarregue a página.') : err
      }
      const stop = await mount(engine, el, () => dead)
      if (dead) { stop(); return }
      destroy = stop
      setStatus('ready')
    })().catch((err: unknown) => {
      if (dead) return
      let shown = err
      if (err instanceof VortableError) {
        // os do banco já foram registrados lá; o do motor que não carregou, aqui
        if (err.code === 'VT-MOTOR-001') vtError('VT-MOTOR-001', { detail: err.message })
      } else if (isChunkError(err)) {
        vtError('VT-MOTOR-001', { detail: errorText(err, '') })
        shown = new VortableError('VT-MOTOR-001', 'Os arquivos do Vortable não carregaram (o site pode ter sido atualizado). Recarregue a página.')
      } else {
        const msg = errorText(err, 'erro desconhecido')
        vtError('VT-MOTOR-002', { vars: { detalhe: msg.slice(0, 120) }, detail: msg })
        shown = new VortableError('VT-MOTOR-002', `Não foi possível abrir o Vortable (${msg}).`)
      }
      setError(errorText(shown, 'Não foi possível abrir o Vortable.'))
      setReload(shown instanceof VortableError && shown.code === 'VT-MOTOR-001')
      setStatus('error')
    })

    return () => {
      dead = true
      el.removeEventListener('webglcontextlost', onLost, true)
      el.removeEventListener('webglcontextrestored', onRestored, true)
      vtResolve(gpuKey)
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
          <Loader />
        </div>
      )}
      {status === 'error' && (
        <div className="vortable-stage__cover" role="alert">
          <span>{error}</span>
          {reload
            ? <button className="btn btn-primary" onClick={() => window.location.reload()}>Recarregar a página</button>
            : <button className="btn btn-ghost" onClick={() => setAttempt((n) => n + 1)}>Tentar de novo</button>}
        </div>
      )}
      {children}
    </div>
  )
}
