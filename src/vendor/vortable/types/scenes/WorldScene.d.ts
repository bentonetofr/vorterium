import Phaser from 'phaser';
import { type NetNpcMove, type NpcForm } from '../net/hub';
import type { NetHub } from '../net/hub';
import { ZoneAudio } from '../audio/ZoneAudio';
import { type Appearance, type Dir, type NpcSteed, type WorldSky, type ZoneData, type ZoneNpc } from '../types';
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
    /** Câmera de conversa: os ids de quem está em cena agora (null = ninguém). Lido ao abrir a cena e a cada zona nova. */
    cinemaId?: () => string[] | null;
    /** Rede: os outros jogadores (sem isto, o jogo é solo). */
    hub?: NetHub;
    /** Aparece neste ponto (teletransporte do mestre), no lugar da saída ou do início. */
    at?: {
        x: number;
        y: number;
    };
    /** Pra onde o boneco olha ao aparecer em `at` (voltar de onde parou). */
    facing?: Dir;
    /** Aviso mostrado quando a cena abre (ex.: "o mestre atualizou o mapa"). */
    notice?: string;
    /** Câmera do mestre: sem boneco, câmera livre, só observa os jogadores. */
    watch?: boolean;
    /** Câmera de observador: quem ela está acompanhando (guardado nas trocas de zona). */
    follow?: string;
    /** Zoom da câmera enquanto acompanha alguém (padrão 2, o do jogo). */
    followZoom?: number;
    /** Observador que também ouve os sons da zona (espectador; o mestre no Controle). */
    listen?: boolean;
    /** Observador que ouve: o "Ouvir" está ligado? (lido a cada zona nova) */
    audioOn?: () => boolean;
    /** Câmera do mestre: id do NPC que atravessou uma saída e continua controlado na zona nova. */
    carryNpc?: string;
    /** O animal (id de um NPC da zona nova) que o cavaleiro leva consigo pela saída: ele monta nele de novo ao chegar. */
    carryMount?: string;
    /** Forma do NPC que atravessou a saída (continua rato se era rato). */
    carryForm?: NpcForm;
    /** O NPC controlado trocou de zona: avisa a sala e guarda a mudança (sai de uma zona, entra na outra). */
    onNpcTransfer?: (t: {
        npc: ZoneNpc;
        from: string;
        to: string;
        x: number;
        y: number;
        dir: Dir;
    }) => void;
    /** O cavaleiro (NPC do mestre) desceu de um animal que estava guardado nele: o animal volta a ser um NPC da zona (guarda). */
    onNpcRestore?: (zone: string, npc: ZoneNpc) => void;
    /** Câmera do mestre: um NPC mudou de lugar por obra de outra pessoa (um cavalo que o jogador largou, por exemplo): o mestre grava o ponto na zona. */
    onNpcMoved?: (m: NetNpcMove) => void;
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
    /** Os "calços" dos NPCs parados (somem enquanto o mestre controla o NPC; mudam de lugar quando ele o larga). */
    private npcSolids;
    private solids?;
    /** NPC que o mestre (câmera) controla agora, como se fosse um jogador. */
    private npcCtl;
    private hiddenNpcs;
    /** Montado num cavalo (o jogador local): o NPC-cavalo, a chave das texturas dele e o cavaleiro por cima. */
    private mount;
    private mounting;
    private mountBtn?;
    /** O aviso "Montar" em cima do cavalo (clicável), no mundo: aparece mesmo se o botão da tela ficar escondido. */
    private mountTip?;
    /** O NPC que o mestre controla, montado num cavalo. */
    private npcMount;
    /** Na garupa do cavalo de outro jogador: o cavalo (id e desenho), o cavaleiro parado e há quanto tempo o condutor sumiu. */
    private pillion;
    /** O NPC que o mestre controla, na garupa do cavalo de outro. */
    private npcPillion;
    /** Quanto andou desde o último passo, e onde estava no quadro anterior. */
    constructor();
    init(data: WorldSceneData): void;
    create(): Promise<void>;
    /** Um passo a cada vez que o quadro da animação é o de um pé tocando o chão. */
    private syncFootsteps;
    private inputLocked;
    /** Quem deve estar em cena (null = ninguém). Guardado à parte pra sobreviver a reiniciar a cena. */
    private wantCinema;
    private cin;
    /** O mestre mudou quem está em cena. null devolve a câmera normal. */
    cinema(ids: string[] | null): void;
    private cinemaTarget;
    /** A câmera de conversa está de olho em alguém agora (a câmera normal fica quieta). */
    private cinemaHolds;
    /**
     * O retrato de um personagem em cena: o desenho dele parado, de frente, ampliado e suavizado (256×256), pra
     * interface desenhar. null se ele não está nesta zona (ou é um boneco sem folha de "parado").
     */
    portrait(id: string): HTMLCanvasElement | null;
    private cinemaUpdate;
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
    /** Onde o jogador está agora (pra voltar exatamente aí depois). */
    snapshotPlay(): {
        zoneId: string;
        x: number;
        y: number;
        dir: Dir;
    } | null;
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
    /** Altura do boneco (Appearance.height): escala do sprite, e a sombra acompanha. */
    private applyHeight;
    /** Troca a aparência do jogador sem recarregar a cena. */
    setAppearance(appearance: Appearance): Promise<void>;
    /** Depois da física e antes de desenhar: câmera no jogador, sombra dos pés, luz. */
    private preRender;
    update(): void;
    /** Conta pra sala onde estou: ~10×/s, e só quando mudou (com um sinal de vida por segundo). */
    private publish;
    private npcNoScroll;
    /** Hora que a cena está mostrando agora (0–24), pro relógio do Controle. */
    watchClock(): number;
    /** O som da zona (pra o painel Sons do mestre: níveis, passos, trovão). */
    watchAudio(): ZoneAudio | null;
    /** Hora do mundo definida no editor (fixa ou ciclo). */
    watchSky(): {
        hour: number | null;
        dayMinutes: number;
    };
    /** NPCs parados desta zona (pra lista do mestre). */
    watchNpcs(): {
        id: string;
        name: string;
        role: string;
    }[];
    /** O NPC que o mestre controla agora (null = nenhum). */
    controllingNpc(): string | null;
    /**
     * Câmera do mestre: passa a andar com este NPC (teclado, colisão e animação como um jogador).
     * Os jogadores o veem andar. Não atravessa saídas: fica na zona.
     */
    controlNpc(id: string): Promise<boolean>;
    /**
     * Solta o NPC: ele fica onde está. Todos atualizam na hora; `persist` guarda o ponto na zona
     * (pra quem entrar depois) e roda em segundo plano.
     */
    releaseNpc(persist?: (r: {
        id: string;
        zone: string;
        x: number;
        y: number;
        dir: Dir;
        steed?: NpcSteed;
    }) => Promise<void>): Promise<void>;
    /** Forma do NPC controlado agora (null = ele mesmo). */
    controllingForm(): NpcForm | null;
    /** Transforma o NPC controlado em rato (ou volta ao normal com null). A sala vê na hora. */
    transformNpc(form: NpcForm | null): Promise<void>;
    /** O NPC parado passa pra este ponto (e o "calço" dele junto). */
    private applyNpcMove;
    /** O "calço" (colisão) de um NPC parado. */
    private addNpcBlock;
    /** O NPC saiu desta zona (foi controlado por uma saída): some daqui. */
    private removeNpc;
    /** O NPC controlado pisou numa saída: leva ele e a câmera pra zona de destino, e segue controlado lá. */
    private travelNpc;
    /** Quem está sendo controlado pelo mestre some do lugar parado (e o "calço" dele deixa de barrar). */
    private syncHiddenNpcs;
    /** Conta pra sala onde o NPC controlado está (como um jogador de id `npc:<id>`). */
    private publishNpc;
    private portalUnder;
    private travel;
    /** O que a sala vê de mim montado (nada, se estou a pé). */
    private mountInfo;
    /** Cavalos que alguém está montando agora (eu e os outros jogadores): somem do chão. */
    private mountedNpcIds;
    /** Cavalos que não dá pra montar agora: os já montados e os que o mestre está controlando. */
    private busyNpcIds;
    /** Monta no cavalo mais perto, ou desce se já está montado. */
    private toggleMount;
    private mountOn;
    /** Desce: o cavalo fica onde estou (todos veem) e o boneco dá uns passos à frente. */
    private dismount;
    /** Botão de montar (tela) e tecla E: valem pro jogador e, na câmera do mestre, pro NPC que ele controla. */
    private setupMountUi;
    /** O botão da tela e o aviso em cima do cavalo: mostra "Montar" / "Desmontar" quando faz sentido. */
    private showMountUi;
    /** Cada quadro: o cavaleiro acompanha o cavalo, e o botão de montar/desmontar aparece quando faz sentido. */
    private updateMount;
    /** Onde está o boneco local, se ele é quem conduz o cavalo `npcId` (pra Remotes pôr o da garupa atrás dele). */
    private localDriverInfo;
    /** Um cavalo que alguém conduz, perto de (x, y) e com a garupa livre. */
    private nearestRidden;
    private mountPillion;
    /** Desce da garupa: fica ao lado do cavalo. */
    private dismountPillion;
    /** Cada quadro, na garupa: segue o condutor; se ele desce ou some, desce junto. */
    private updatePillion;
    private toggleNpcMount;
    private mountNpcOn;
    /** O NPC desce: o cavalo fica onde ele está (todos veem) e o NPC dá uns passos à frente. */
    private dismountNpc;
    private updateNpcMount;
    /** O NPC do mestre vai na garupa do cavalo de outro: fica escondido, parado, e segue quem conduz. */
    private mountNpcPillion;
    /** O NPC desce da garupa: fica ao lado do cavalo. */
    private dismountNpcPillion;
    /** Cada quadro, na garupa: segue o condutor; se ele desce ou some, o NPC desce junto. */
    private updateNpcPillion;
    private toast;
}
