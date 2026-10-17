import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabase'
import type { RelayFactory, RelayPayload } from './VortableNet'

// ────────────────────────────────────────────────────────
// Conexão reserva do Vortable: quando a ligação direta (WebRTC) não abre na rede
// do jogador, o jogo dele passa por um canal privado do Supabase Realtime só dele
// e do mestre: `mesa:<campanha>:vt:<jogador>`. A policy da Mesa (migration
// 20240153) já libera os tópicos `mesa:<campanha>:...` pros membros da campanha.
// ────────────────────────────────────────────────────────

export function createRelayFactory(campaignId: string): RelayFactory {
  return (suffix, on) => {
    const topic = `mesa:${campaignId}:${suffix}`
    let channel: RealtimeChannel | null = null
    let joined = false
    let closed = false

    const ready = (async () => {
      await supabase.realtime.setAuth()
      // o supabase-js devolve o MESMO canal pra um tópico igual: o de uma reserva anterior (ainda fechando) sai antes
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`)
      if (stale) await supabase.removeChannel(stale)
      if (closed) return
      const ch = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } })
      channel = ch
      ch.on('broadcast', { event: 'vt' }, ({ payload }) => {
        if (!closed) on.message(payload as RelayPayload)
      })
      ch.subscribe((status, err) => {
        if (closed) return
        joined = status === 'SUBSCRIBED'
        on.status(joined, joined ? undefined : status === 'CLOSED' ? 'CLOSED' : `${status}${err ? `: ${err.message}` : ''}`)
      })
    })().catch((err: unknown) => {
      if (!closed) on.status(false, err instanceof Error ? err.message : String(err))
    })

    return {
      send(payload) {
        if (closed || !channel || !joined) return false
        void channel.send({ type: 'broadcast', event: 'vt', payload })
        return true
      },
      close() {
        closed = true
        joined = false
        void ready.then(() => { if (channel) void supabase.removeChannel(channel) })
      },
    }
  }
}
