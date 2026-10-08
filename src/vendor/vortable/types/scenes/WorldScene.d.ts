import Phaser from 'phaser';
import type { NetHub } from '../net/hub';
import { type Appearance, type Dir, type ZoneData } from '../types';
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
    /** O teclado do boneco está travado agora? (lido ao abrir a cena e a cada zona nova) */
    inputLocked?: () => boolean;
    /** Rede: os outros jogadores (sem isto, o jogo é solo). */
    hub?: NetHub;
    /** Aparece neste ponto (teletransporte do mestre), no lugar da saída ou do início. */
    at?: {
        x: number;
        y: number;
    };
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
