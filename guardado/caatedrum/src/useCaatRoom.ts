import { useCallback, useEffect, useRef, useState } from 'react'
import { getOpenRoom, getView, subscribeRooms, type CaatRoomRow, type CaatView } from './caatService'

// ────────────────────────────────────────────────────────
// A mesa aberta da campanha + a MINHA visão dela, sempre em dia: escuta a
// linha da mesa (cada jogada sobe a versão) e pede a visão de novo. Quem
// cai e volta pega tudo de onde estava (o estado mora no banco).
// `clockOffset`: diferença entre o relógio do servidor e o daqui.
// ────────────────────────────────────────────────────────

export function useCaatRoom(campaignId: string) {
  const [room, setRoom] = useState<CaatRoomRow | null | undefined>(undefined)
  const [view, setView] = useState<CaatView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const roomId = room?.id ?? null
  const inFlight = useRef(false)
  const again = useRef(false)

  const refresh = useCallback(async () => {
    if (!roomId) { setView(null); return }
    // Uma pergunta por vez; se mudou no meio, pergunta de novo no fim.
    if (inFlight.current) { again.current = true; return }
    inFlight.current = true
    try {
      do {
        again.current = false
        const t0 = Date.now()
        const v = await getView(roomId)
        setClockOffset(v.now - (t0 + Date.now()) / 2)
        setView(v)
        setError(null)
      } while (again.current)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a mesa.')
    } finally {
      inFlight.current = false
    }
  }, [roomId])

  const reloadRoom = useCallback(async () => { setRoom(await getOpenRoom(campaignId)) }, [campaignId])

  useEffect(() => {
    void reloadRoom()
    return subscribeRooms(campaignId, (row) => {
      if (!row || row.status === 'fim') { void reloadRoom(); return }
      setRoom((prev) => (prev && prev.id === row.id && prev.version >= row.version ? prev : row))
    })
  }, [campaignId, reloadRoom])

  // Versão nova da mesa: a minha visão muda.
  useEffect(() => { void refresh() }, [room?.id, room?.version, refresh])

  // Voltou pra aba (celular dormiu, rede caiu): confere de novo.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') { void reloadRoom(); void refresh() } }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => { document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onVisible) }
  }, [reloadRoom, refresh])

  return { room, view, error, clockOffset, refresh, reloadRoom }
}

/** "agora" no relógio do servidor, atualizado a cada segundo. */
export function useServerNow(offset: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now() + offset)
  useEffect(() => {
    setNow(Date.now() + offset)
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now() + offset), 1000)
    return () => window.clearInterval(t)
  }, [offset, active])
  return now
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
