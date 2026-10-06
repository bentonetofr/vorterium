import { useCallback, useEffect, useRef, useState } from 'react'
import { getView, type TorreView } from './torreService'

// ────────────────────────────────────────────────────────
// A MINHA visão da sala, sempre em dia: cada mudança sobe a versão da
// sala (quem acompanha a linha é o TorreHost) e aqui a visão é pedida de
// novo. Quem cai e volta pega tudo de onde estava.
// Também guarda a diferença entre o relógio do banco e o deste aparelho
// (o pêndulo balança pela hora do banco).
// ────────────────────────────────────────────────────────

export function useTorreView(roomId: string, version: number) {
  const [view, setView] = useState<TorreView | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** hora do banco ≈ Date.now() + offset */
  const [offset, setOffset] = useState(0)
  const inFlight = useRef(false)
  const again = useRef(false)

  const refresh = useCallback(async () => {
    // Uma pergunta por vez; se mudou no meio, pergunta de novo no fim.
    if (inFlight.current) { again.current = true; return }
    inFlight.current = true
    try {
      do {
        again.current = false
        const v = await getView(roomId)
        setOffset(v.now - Date.now())
        setView(v)
        setError(null)
      } while (again.current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir o Torre do Observatório.')
    } finally {
      inFlight.current = false
    }
  }, [roomId])

  useEffect(() => { void refresh() }, [refresh, version])

  return { view, error, refresh, offset }
}
