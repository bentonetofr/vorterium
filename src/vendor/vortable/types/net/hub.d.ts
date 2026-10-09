import type { Appearance, Dir } from '../types';
export type NetAnim = 'idle' | 'walk' | 'run';
/**
 * `npc`: NPC que o mestre está controlando (id `npc:<id do NPC>`). Aparece como um jogador, mas o NPC
 * parado da zona some enquanto isso, e o nome só aparece se `showName`.
 */
export interface NetHello {
    t: 'hello';
    id: string;
    name: string;
    appearance: Appearance;
    npc?: boolean;
    showName?: boolean;
}
/**
 * `from`: o NPC mudou de zona (saiu dela); `npc`: os dados dele pra quem ainda não o tem na zona de destino.
 */
export interface NetNpcMove {
    t: 'npcmove';
    zone: string;
    id: string;
    x: number;
    y: number;
    dir: Dir;
    from?: string;
    npc?: {
        name: string;
        role: string;
        appearance: Appearance;
        showName: boolean;
    };
}
/** Prefixo do id de um NPC controlado pelo mestre na rede. */
export declare const NPC_PEER = "npc:";
export interface NetState {
    t: 'state';
    id: string;
    zone: string;
    x: number;
    y: number;
    dir: Dir;
    anim: NetAnim;
}
/** Sons ao vivo do mestre: `auto` = as camadas seguem o mundo; `layers` = camadas postas à mão (volume 0–1). */
export interface LiveSound {
    auto: boolean;
    layers: Record<string, number>;
}
export interface NetEnv {
    t: 'env';
    zone: string;
    hour: number | null;
    weather: string | null;
    wind: number | null;
    sound?: LiveSound | null;
    dayMinutes?: number | null;
    timeShift?: number | null;
}
/** Reações que o espectador pode mandar. */
export declare const REACTIONS: readonly ['👏', '😮', '😂', '❤️', '🔥', '🎉', '😱', '🤔'];
export interface NetReact {
    t: 'react';
    id: string;
    name: string;
    emoji: string;
    zone: string;
    x: number;
    y: number;
}
export type NetMsg = NetEnv | NetNpcMove | NetReact | {
    t: 'zone';
    id: string;
} | NetHello | {
    t: 'who';
} | NetState | {
    t: 'bye';
    id: string;
} | {
    t: 'teleport';
    zone: string;
    x: number;
    y: number;
};
export interface NetLink {
    /** Id deste jogador na rede (único na sala). */
    selfId: string;
    /** Pode ser um getter: o nome é lido a cada anúncio. */
    name: string;
    /** Manda uma mensagem pra sala; a ponte decide quem recebe. */
    send(msg: NetMsg): void;
}
export interface NetPeer {
    hello: NetHello;
    state: NetState | null;
}
/** Confere o que chegou da rede: devolve a mensagem limpa ou null. */
export declare function parseNet(raw: unknown): NetMsg | null;
export declare class NetHub {
    readonly link: NetLink;
    readonly peers: Map<string, NetPeer>;
    /** Hora/tempo/vento do mestre, por zona ('*' = todas). */
    readonly envs: Map<string, NetEnv>;
    /** Mudou quem está na sala (entrou, saiu, trocou de boneco). */
    private roster;
    private zoneChanges;
    private teleports;
    private reactions;
    private npcMoves;
    /** NPCs que ESTE mestre está controlando agora (vistos pela sala como jogadores). */
    private hosted;
    private hello;
    private asked;
    constructor(link: NetLink);
    /** Diz pra sala quem eu sou (e, na primeira vez, pede que todos digam quem são). */
    announce(appearance: Appearance): void;
    /** Observador (a câmera do mestre): só pergunta quem está na sala, sem aparecer. */
    observe(): void;
    /** Mestre: começa a controlar um NPC (a sala o vê como um jogador de id `npc:<id>`). */
    hostNpc(npc: {
        id: string;
        name: string;
        appearance: Appearance;
        showName: boolean;
    }): void;
    /** Mestre: largou o NPC (some da sala como jogador). */
    unhostNpc(peerId: string): void;
    /** Mestre: o NPC largado fica neste ponto (todos atualizam o NPC parado da zona). */
    moveNpc(m: Omit<NetNpcMove, 't'>): void;
    /** Mestre: muda hora/tempo/vento ao vivo (vale pra mim e pra sala). */
    setEnv(env: Omit<NetEnv, 't'>): void;
    /** O que vale numa zona: o ajuste dela, senão o de todas. */
    envFor(zoneId: string): NetEnv | null;
    /** O nome mudou (o NetLink.name é lido de novo): reanuncia o mesmo boneco com o nome novo. */
    rename(): void;
    /** A rede acabou de abrir (ou reabriu): conta quem sou e pergunta quem está aí. */
    resync(): void;
    /** Saindo: avisa e esquece todo mundo. */
    leave(): void;
    /** Chegou uma mensagem da rede. */
    receive(raw: unknown): void;
    onRoster(fn: () => void): () => void;
    /** O mestre salvou uma zona (o jogo recarrega se for a que está aberta). */
    onZoneChanged(fn: (id: string) => void): () => void;
    /** O mestre largou um NPC num ponto novo. */
    onNpcMove(fn: (m: NetNpcMove) => void): () => void;
    /** Chegou uma reação (de um espectador) pra mostrar no mapa. */
    onReact(fn: (m: NetReact) => void): () => void;
    /** Manda uma reação (de espectador) no ponto dado; também aparece pra quem mandou. */
    react(emoji: string, zone: string, x: number, y: number): void;
    onTeleport(fn: (m: {
        zone: string;
        x: number;
        y: number;
    }) => void): () => void;
}
