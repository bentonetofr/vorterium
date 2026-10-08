import Phaser from 'phaser';
import type { NetHub } from '../net/hub';
import { type Appearance, type Dir, type WorldSky, type ZoneData } from '../types';
export interface WorldSceneData {
    zone: ZoneData;
    appearance: Appearance;
    assetBase: string;
    /** Busca outra zona do mundo (pra atravessar saídas). */
    loadZone: (id: string) => Promise<ZoneData | null>;
    /** Chegando por uma saída: aparece nela, virado pra mesma direção. */
    arrival?: {
        portal: string;
        dir: Dir;
    };
    /** Avisado a cada troca de zona (a interface mostra o nome). */
    onZone?: (zone: ZoneData) => void;
    /** Avisado de tempos em tempos com a hora da zona (0–24), pro relógio da interface. */
    onClock?: (hour: number) => void;
    /** Deslocamento do relógio do mundo em ms (o teste do editor começa na hora da prévia). */
    timeOffset?: number;
    /** Hora e tempo do mundo, iguais em todas as zonas (acompanha a cena nas trocas de zona). */
    sky?: WorldSky;
    /** O teclado do boneco está travado agora? (lido ao abrir a cena e a cada zona nova) */
    inputLocked?: () => boolean;
    /** Rede: os outros jogadores (sem isto, o jogo é solo). */
    hub?: NetHub;
    /** Aparece neste ponto (teletransporte do mestre), no lugar da saída ou do início. */
    at?: {
        x: number;
        y: number;
    };
    /** Aviso mostrado quando a cena abre (ex.: "o mestre atualizou o mapa"). */
    notice?: string;
    /** Câmera do mestre: sem boneco, câmera livre, só observa os jogadores. */
    watch?: boolean;
    /** Câmera de observador: quem ela está acompanhando (guardado nas trocas de zona). */
    follow?: string;
    /** Zoom da câmera enquanto acompanha alguém (padrão 2, o do jogo). */
    followZoom?: number;
    /** Observador que também ouve os sons da zona (espectador; o mestre não precisa). */
    listen?: boolean;
}
export declare class WorldScene extends Phaser.Scene {
    private player?;
    private cfg;
    /**
     * As saídas só disparam depois que o jogador sai de todas elas: quem
     * chega numa porta não volta na hora pela mesma porta.
     */
    private armed;
    private travelling;
    private occluders;
    private lighting?;
    private blob?;
    private ground?;
    private clockAt;
    private audio;
    private remotes?;
    private npcs?;
    private netAt;
    private netSent;
    /** Quanto andou desde o último passo, e onde estava no quadro anterior. */
    constructor();
    init(data: WorldSceneData): void;
    create(): Promise<void>;
    /** Um passo a cada vez que o quadro da animação é o de um pé tocando o chão. */
    private syncFootsteps;
    private inputLocked;
    /** Trava/destrava o teclado do boneco (cena do mestre por cima da tela). */
    setInputLocked(locked: boolean): void;
    private following;
    private switching;
    private followZoom;
    private reactions;
    private startWatch;
    /** Troca a zona que o observador está vendo. */
    watchZone(id: string): Promise<void>;
    /** Enquadra a zona inteira na tela. */
    watchFit(): void;
    watchZoom(factor: number): void;
    watchFocus(x: number, y: number): void;
    /** A câmera acompanha um jogador (null solta). */
    watchFollow(id: string | null, zoom?: number): void;
    /** Quem a câmera acompanha agora. */
    watchFollowing(): string | null;
    /** Espectador reage: o emoji aparece no jogador acompanhado (ou no centro da câmera) pra todos. */
    watchReact(emoji: string): void;
    /** Um emoji sobe e some (com o nome de quem reagiu embaixo). */
    private showReaction;
    /** Quem está na sala e onde (pra lista do mestre). */
    watchPeers(): {
        id: string;
        name: string;
        zone: string | null;
        x: number;
        y: number;
    }[];
    private reloading;
    /** Relê a zona atual (o mestre salvou) e reabre a cena no mesmo ponto. */
    private reloadZone;
    /** O mestre levou este jogador pra (x, y) de uma zona. */
    private teleportTo;
    /** Troca a aparência do jogador sem recarregar a cena. */
    setAppearance(appearance: Appearance): Promise<void>;
    /** Depois da física e antes de desenhar: câmera no jogador, sombra dos pés, luz. */
    private preRender;
    update(): void;
    /** Conta pra sala onde estou: ~10×/s, e só quando mudou (com um sinal de vida por segundo). */
    private publish;
    private portalUnder;
    private travel;
    private toast;
}
