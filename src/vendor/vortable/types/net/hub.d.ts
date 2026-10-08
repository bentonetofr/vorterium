import type { Appearance, Dir } from '../types';
export type NetAnim = 'idle' | 'walk' | 'run';
export interface NetHello {
    t: 'hello';
    id: string;
    name: string;
    appearance: Appearance;
}
export interface NetState {
    t: 'state';
    id: string;
    zone: string;
    x: number;
    y: number;
    dir: Dir;
    anim: NetAnim;
}
export interface NetEnv {
    t: 'env';
    zone: string;
    hour: number | null;
    weather: string | null;
    wind: number | null;
}
export type NetMsg = NetEnv | NetHello | {
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
    private teleports;
    private hello;
    private asked;
    constructor(link: NetLink);
    /** Diz pra sala quem eu sou (e, na primeira vez, pede que todos digam quem são). */
    announce(appearance: Appearance): void;
    /** Observador (a câmera do mestre): só pergunta quem está na sala, sem aparecer. */
    observe(): void;
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
    onTeleport(fn: (m: {
        zone: string;
        x: number;
        y: number;
    }) => void): () => void;
}
