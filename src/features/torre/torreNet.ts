import { connectRoomNet, type LivroNet, type NetPeer, type PosMsg } from '../livro/livroNet'

// ────────────────────────────────────────────────────────
// O ao vivo da Torre do Observatório: o mesmo do Livro Bloqueado
// (livroNet: broadcast "pos" ~12 por segundo + presence), no canal
// "torre:<sala>" — nome fixo, todos precisam do MESMO, então nada de
// uniqueChannel. Os dois andares falam no mesmo canal: cada tela decide
// o que mostrar (no outro andar, só a sombra pela grade).
// ────────────────────────────────────────────────────────

export type { Dir } from '../livro/livroNet'

/** Os objetos da torre. O pêndulo e o Astrário existem nos dois andares. */
export type TorrePanel = 'telescopio' | 'mapa' | 'espelhos' | 'manivela' | 'pendulo' | 'astrario'

export type Floor = 'cima' | 'baixo'

/** O 1º jogador (slot 0) fica em cima; o 2º (slot 1), embaixo. */
export function floorOf(slot: number | null | undefined): Floor | null {
  return slot === 0 ? 'cima' : slot === 1 ? 'baixo' : null
}

/** Pelo slot: quem é e onde fica. */
export const ROLE_NAMES = ['o Observador', 'o Mecânico']
export const ROLE_TITLES = ['Observador', 'Mecânico']
export const FLOOR_NAMES = ['andar de cima', 'andar de baixo']

export type TorrePeer = NetPeer<TorrePanel>
export type TorrePos = PosMsg<TorrePanel>
export type TorreNet = LivroNet<TorrePanel>

export function connectTorre(roomId: string, me: TorrePeer): TorreNet {
  return connectRoomNet<TorrePanel>(`torre:${roomId}`, me)
}
