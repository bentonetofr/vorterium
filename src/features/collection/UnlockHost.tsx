import { useCallback, useEffect, useRef, useState } from 'react'
import { Presence } from '../../shared/components/Presence'
import { useAuth } from '../auth/AuthProvider'
import { whenRollIdle } from '../sheets/dnd/rolls/rollActivity'
import { loadCollection, onUnlock, type UnlockEvent } from './collectionService'
import { UnlockCard } from './UnlockCard'

// ────────────────────────────────────────────────────────
// Fica montado na área logada: carrega a coleção da conta e mostra o cartão de cada conquista nova, uma de cada vez, só
// depois que os dados da própria pessoa param de rolar (o cartão não pode tapar a rolagem).
// ────────────────────────────────────────────────────────

/** Respiro depois que os dados param, antes do cartão cair. */
const AFTER_DICE_MS = 900
/** Respiro entre um cartão e o seguinte. */
const BETWEEN_MS = 600

export function UnlockHost() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [current, setCurrent] = useState<UnlockEvent | null>(null)
  const queue = useRef<UnlockEvent[]>([])
  const showing = useRef(false)
  const timers = useRef<number[]>([])
  const cancels = useRef<(() => void)[]>([])

  const next = useCallback(() => {
    if (showing.current || queue.current.length === 0) return
    showing.current = true
    const cancel = whenRollIdle(() => {
      const t = window.setTimeout(() => setCurrent(queue.current.shift() ?? null), AFTER_DICE_MS)
      timers.current.push(t)
    })
    cancels.current.push(cancel)
  }, [])

  useEffect(() => {
    if (!userId) return
    void loadCollection()
    const off = onUnlock((e) => { queue.current.push(e); next() })
    return () => { off(); timers.current.forEach(window.clearTimeout); cancels.current.forEach((c) => c()); queue.current = []; showing.current = false }
  }, [userId, next])

  const close = useCallback(() => {
    setCurrent(null)
    showing.current = false
    const t = window.setTimeout(next, BETWEEN_MS)
    timers.current.push(t)
  }, [next])

  if (!userId) return null
  return (
    <div className="uc-wrap">
      <Presence show={!!current} exitMs={260}>
        {() => (current ? <UnlockCard key={current.skin} event={current} onClose={close} /> : null)}
      </Presence>
    </div>
  )
}
