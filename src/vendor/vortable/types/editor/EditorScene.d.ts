import Phaser from 'phaser';
import { ZoneAudio } from '../audio/ZoneAudio';
import type { EditorState } from './EditorState';
export declare const ZOOM_MIN = 0.1;
export declare const ZOOM_MAX = 8;
export declare class EditorScene extends Phaser.Scene {
    private state;
    private ground;
    private fences;
    private sprites;
    private gridGfx;
    private collisionGfx;
    private cursorGfx;
    private selectGfx;
    private portalGfx;
    private portalLabels;
    private spawnMarker;
    private lighting;
    /** Som da zona (só toca com "ouvir no editor" ligado). */
    audio: ZoneAudio | null;
    private lightGfx;
    private lightTimer?;
    private movingLight;
    private ghost;
    private painting;
    /** A pincelada atual já guardou o passo de desfazer? (só guarda se mudar algo) */
    private strokeSaved;
    private lastPaint;
    /** Onde a última pincelada terminou (Shift + clique continua dali em linha reta). */
    private lastStrokeEnd;
    private panning;
    /** Arrastando objetos selecionados: posição inicial de cada um. */
    private dragging;
    /** Retângulo de seleção (mundo); `add` = soma à seleção que já existia. */
    private marquee;
    /** Carimbando objetos arrastando: onde saiu o último. */
    private stamping;
    /**
     * Arrasto da ferramenta Cômodo: retângulo de tiles (cômodo, porta, apagar)
     * e, pra parede, a linha de vértices (vx/vy).
     */
    private roomDrag;
    private drawingPortal;
    private movingPortal;
    private spaceKey;
    private keys;
    /**
     * Zoom pra onde a câmera está indo (anima até lá), o ponto de tela que fica
     * parado e o ponto do MUNDO que estava ali quando o zoom começou (guardado
     * uma vez: recalcular a cada quadro acumularia o arredondamento da câmera).
     */
    private zoomTarget;
    private zoomAnchor;
    constructor();
    init(data: {
        state: EditorState;
    }): void;
    create(): void;
    update(_time: number, delta: number): void;
    /** Antes de desenhar (a câmera já está no lugar): a iluminação da prévia. */
    private preRender;
    /** Luzes refeitas um pouco depois da última edição (recortar pelas paredes custa). */
    private scheduleLights;
    /** Teclas de câmera só valem fora de campos de texto e janelas. */
    private keyboardFree;
    /** Ponto de tela (px) + o ponto do mundo que está nele agora. */
    private anchorAt;
    /** Muda o zoom mantendo o ponto do mundo `anchor.wx/wy` no ponto de tela `anchor.x/y`. */
    private applyZoom;
    /** Move a tela (unidades do mundo). Um zoom em andamento passa a segurar o ponto novo. */
    private panBy;
    /** O que depende do zoom/posição da câmera (espessura das linhas, rótulos). */
    private afterView;
    /** Zoom relativo (×factor), animado; `anchor` em px de tela (padrão: centro). */
    zoomBy(factor: number, anchor?: {
        x: number;
        y: number;
    }): void;
    zoomTo(z: number, anchor?: {
        x: number;
        y: number;
    }): void;
    /** Enquadra a zona inteira na tela. */
    fitZone(): void;
    private updateCursorStyle;
    private reloadZone;
    private rebuildObjects;
    /** Reaplica cada objeto no seu sprite (espelho, variante, altura) sem refazer tudo. */
    private syncObjects;
    private makeSprite;
    private fitBounds;
    private makeSpawnMarker;
    private onUiChange;
    private refreshOverlays;
    /** Saídas: retângulo roxo com o destino escrito; a selecionada em dourado. */
    private drawPortals;
    /**
     * Luzes soltas: um ponto com a cor dela (sempre, pra saber que existe);
     * com a ferramenta Luz, também o alcance — a selecionada em dourado.
     */
    private drawLights;
    private lightAt;
    private portalRect;
    private portalAt;
    private applySelection;
    private drawSelection;
    private drawCursor;
    private onDown;
    private onMove;
    private onUp;
    private onWheel;
    private brushTiles;
    /** Pinta do último ponto até aqui (sem buracos quando o mouse anda rápido). */
    private paintAt;
    /** O terreno escolhido é uma cerca (camada de tiles)? */
    private get fenceLayer();
    /** Cercas: pinta TILES (não vértices) e refaz os pedaços ligados. */
    private stampFence;
    /** O terreno escolhido é da camada de cima (molduras, tapetes)? */
    private get overlayLayer();
    /** A grade de vértices da camada do terreno escolhido (cria a de cima, se preciso). */
    private layerGrid;
    /**
     * Pinta os vértices do quadrado do pincel, na camada do terreno escolhido.
     * O pincel grava o terreno explicitamente; a borracha grava '' (no chão =
     * o fundo da zona, que pode mudar; na camada de cima = nada).
     */
    private stamp;
    private fillAt;
    /** Põe um objeto (o passo de desfazer é guardado por quem chamou). `random` = variante e espelho sorteados. */
    private placeObject;
    private snapped;
    private inside;
    /** Objeto de cima sob o mouse (pixel a pixel), ou null. */
    private objectAt;
    /** Retângulo de tiles (ordenado e dentro da zona). */
    private tileRect;
    /**
     * Marca (ou apaga, value = '') os tiles do retângulo como cômodo. Encostado
     * num cômodo de OUTRO estilo, a borda fica de fora: nasce uma parede fina
     * entre os dois. Do mesmo estilo, os dois viram um cômodo só.
     */
    private paintRooms;
    /** Grava vértices de cômodo e refaz piso/parede/moldura onde mudou (um passo de desfazer). */
    private commitRooms;
    /** Linha reta (horizontal ou vertical, a que andou mais) de vértices da parede interna. */
    private wallLine;
    /** Parede interna: tira os vértices da linha do cômodo (a parede fina e a face aparecem sozinhas). */
    private drawWall;
    /** Porta: preenche o vão da parede com o estilo do cômodo vizinho. */
    private openDoor;
    /** Troca o estilo do cômodo sob o tile pelo estilo escolhido. */
    private restyleRoomAt;
    /**
     * Conta-gotas (Alt+clique): com ferramenta de objeto/seleção copia o
     * objeto sob o mouse; senão copia o terreno do vértice mais próximo.
     */
    private eyedropper;
    deleteSelected(): void;
    /** Seleciona todos os objetos da zona. */
    selectAll(): void;
    /** Copia os selecionados (posições relativas ao centro do grupo). Devolve quantos. */
    copySelected(): number;
    cutSelected(): number;
    /** Cola no mouse (ou no meio da tela); os colados ficam selecionados. */
    paste(at?: {
        x: number;
        y: number;
    }): number;
    /** Duplica os selecionados um pouco ao lado. */
    duplicate(): number;
    /** Empurra os selecionados (setas). Teclas seguidas viram um passo só de desfazer. */
    private lastNudge;
    nudge(dx: number, dy: number): boolean;
    /** Espelha os selecionados (ou o carimbo). */
    flipSelected(): void;
    /** Próxima/anterior variante (cor, estado) dos selecionados — ou do carimbo. */
    cycleVariant(dir: 1 | -1): void;
    /** Muda o tamanho do pincel (+1/−1). */
    brushBy(d: number): void;
    private rulerGfx;
    private rulerTexts;
    /** A régua do clique que está apertado (some ao soltar). */
    private rulerLive;
    /** Move a ponta solta da régua; Shift trava o ângulo em múltiplos de 45°. */
    private rulerMove;
    private rulerText;
    /** Desenha as réguas: linha, marcas a cada metro (ou 2, 5, 10... conforme o zoom), guias em L e o rótulo com medida e direção. */
    private drawRulers;
    private npcs;
    private npcGhost?;
    private npcGhostSig;
    /** O boneco-fantasma que acompanha o mouse enquanto o NPC espera lugar. */
    private refreshNpcGhost;
    /** Põe o NPC do gerador onde o mestre clicou (a ferramenta volta pra seleção). */
    private placeNpc;
    /** Leva a câmera até um ponto (a lista de NPCs usa pra "ver"). */
    focusAt(x: number, y: number): void;
    centerOnZone(): void;
}
