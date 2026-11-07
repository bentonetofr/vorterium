import { FOLLOW_KINDS, type FollowInfo, type FollowKind } from './follow'

type Peer = { id: string; name: string; zone: string | null }

interface Props {
  /** Jogadores conectados (sem os NPCs que o mestre controla). */
  players: Peer[]
  /** A zona que o mestre está vendo (os NPCs que seguem são os dela). */
  zoneId: string | null
  zoneName: (id: string | null) => string
  /** Quantos NPCs de cada tipo há na zona. */
  counts: Record<FollowKind, number>
  kinds: Record<FollowKind, boolean>
  onKinds: (next: Record<FollowKind, boolean>) => void
  info: FollowInfo | null
  busy: boolean
  onFollow: (peer: Peer) => void
  onStop: () => void
}

const STATE_TEXT: Record<FollowInfo['state'], string> = {
  following: 'seguindo',
  away: 'está em outra zona: os NPCs esperam',
  gone: 'saiu da sessão: os NPCs esperam',
}

/** Botão Seguir do controle: todos os NPCs da zona andam atrás do jogador escolhido. */
export function FollowPane({ players, zoneId, zoneName, counts, kinds, onKinds, info, busy, onFollow, onStop }: Props) {
  const total = FOLLOW_KINDS.reduce((n, k) => n + (kinds[k.id] ? counts[k.id] : 0), 0)
  const following = info != null

  return (
    <section className="live__block">
      <h4>Seguir jogador</h4>
      <p className="live__empty">
        Os NPCs desta zona andam atrás do jogador que você escolher (e correm se ele se afastar). Funciona enquanto este controle estiver aberto
        e eles não desviam de paredes nem de objetos. Ao parar, cada NPC fica onde está.
      </p>

      <div className="live__chips" role="group" aria-label="Quem segue">
        {FOLLOW_KINDS.map((k) => (
          <button
            key={k.id} type="button" disabled={following || counts[k.id] === 0}
            className={`live__chip${kinds[k.id] && counts[k.id] > 0 ? ' live__chip--on' : ''}`}
            aria-pressed={kinds[k.id]}
            onClick={() => onKinds({ ...kinds, [k.id]: !kinds[k.id] })}
          >
            {k.label}<span className="live__count">{counts[k.id]}</span>
          </button>
        ))}
      </div>

      {players.length === 0 && <p className="live__empty">Ninguém conectado.</p>}
      <ul className="live__players">
        {players.map((p) => {
          const mine = info?.targetId === p.id
          const elsewhere = p.zone !== zoneId
          return (
            <li key={p.id}>
              <button
                type="button" className={`live__player${mine ? ' live__player--on' : ''}`}
                disabled={busy || (!following && (elsewhere || total === 0))}
                title={elsewhere ? `Está em ${zoneName(p.zone)}: os NPCs seguidos são os da zona que você vê` : undefined}
                onClick={() => onFollow(p)}
              >
                <span>{p.name}</span>
                <small>{mine ? `${STATE_TEXT[info.state]} (${info.count})` : elsewhere ? zoneName(p.zone) : 'seguir'}</small>
              </button>
            </li>
          )
        })}
      </ul>

      {total === 0 && !following && <p className="live__empty">Nenhum NPC dos tipos marcados nesta zona.</p>}
      {following && (
        <button type="button" className="btn btn-primary" onClick={onStop}>Parar de seguir</button>
      )}
    </section>
  )
}
