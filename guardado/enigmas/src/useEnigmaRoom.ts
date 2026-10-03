import { useCallback, useEffect, useRef, useState } from 'react'
import { getOpenRoom, getView, subscribeRooms, type EnigmaRoomRow, type EnigmaView } from './enigmaService'

// ────────────────────────────────────────────────────────
// A sala aberta da campanha + a MINHA visão dela, sempre em dia: escuta a
// linha da sala (cada jogada sobe a versão) e pede a visão de novo.
// `clockOffset`: diferença entre o relógio do servidor e o daqui (os
// relógios do jogo usam a hora do servidor).
// ────────────────────────────────────────────────────────

export function useEnigmaRoom(campaignId: string) {
  const [room, setRoom] = useState<EnigmaRoomRow | null | undefined>(undefined)
  const [view, setView] = useState<EnigmaView | null>(null)
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
      setError(e instanceof Error ? e.message : 'Não foi possível abrir a câmara.')
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

  // Versão nova da sala: a minha visão muda.
  useEffect(() => { void refresh() }, [room?.id, room?.version, refresh])

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
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  return `${neg ? '−' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
