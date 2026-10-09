import type { EditorState } from './EditorState';
import { type EditorScene } from './EditorScene';
import { type CurateOverride } from './curate';
import { type WorldStorage } from '../storage';
import { type SpecialNpc } from '../types';
export interface EditorHooks {
    /** Pasta de assets (pros créditos). */
    assetBase: string;
    /** Imagem de uma textura carregada no Phaser (pra desenhar miniaturas). */
    textureImage(key: string): CanvasImageSource;
    startTest(): void;
    stopTest(): void;
    deleteSelected(): void;
    centerOnZone(): void;
    /** A cena do editor, quando está ativa (câmera, seleção, área de transferência). */
    scene(): EditorScene | null;
    /** Abrir o criador de personagem (se quem montou o editor oferecer). */
    editCharacter?: () => void;
    /** Os NPCs especiais (com ficha) que o mestre criou, pra pôr nas zonas. */
    npcLibrary?: () => Promise<SpecialNpc[]>;
    /** As ações do topo (nome, Nova, Abrir, Salvar, Testar…) ficam numa barra de fora (`controls()`), não na gaveta. */
    externalBar?: boolean;
    /** O volume mudou (o motor de som relê as preferências). */
    applySound?: () => void;
    /** Curadoria (só no desenvolvimento): grava o ajuste de uma peça no pacote e recarrega o catálogo. */
    curate?: (pack: string, id: string, override: CurateOverride) => Promise<void>;
}
/** O que a barra de fora mostra do editor. */
export interface EditorBarState {
    name: string;
    canUndo: boolean;
    canRedo: boolean;
    dirty: boolean;
    testing: boolean;
    panel: boolean;
    character: boolean;
}
/** Ações do editor pra uma barra de fora (o Vorterium põe na faixa de cima). */
export interface EditorControls {
    state(): EditorBarState;
    /** Avisa a cada mudança (nome, desfazer, salvo, teste, painel). Devolve quem cancela. */
    subscribe(fn: () => void): () => void;
    setName(name: string): void;
    newZone(): void;
    open(): void;
    world(): void;
    save(): void;
    exportZone(): void;
    importZone(file: File): void;
    undo(): void;
    redo(): void;
    character(): void;
    test(): void;
    /** Abre/fecha o painel de terrenos e objetos. */
    togglePanel(): void;
}
export declare class EditorUI {
    private state;
    private storage;
    private hooks;
    readonly root: HTMLDivElement;
    readonly stage: HTMLDivElement;
    private nameInput?;
    private toolButtons;
    private toggles;
    private brushLabel;
    private undoBtn?;
    private redoBtn?;
    private barListeners;
    private statusEl;
    private tab;
    /** Atualiza as barrinhas de nível do painel Sons. */
    private meterTimer;
    /** Camada escolhida no painel Sons (mostra a régua dela). */
    private soundPick;
    /** Qual luz solta o painel Luz está mostrando (só redesenha quando troca). */
    private shownLight;
    private testClockEl;
    private muteBtn;
    /** Seção aberta de cada lista (só uma por vez). */
    private openSection;
    private tabButtons;
    private paneEl;
    private zonePropsEl;
    private portalEl;
    private testZoneEl;
    /** Qual saída o painel está mostrando (só redesenha quando troca). */
    private shownPortal;
    private objectFilter;
    private terrainFilter;
    private objectEl;
    /** O que o painel da peça está mostrando (só redesenha quando muda). */
    private shownObject;
    private catalogVersion;
    private favorites;
    private recents;
    private terrainCells;
    private objectCells;
    private testing;
    private modals;
    private zoomLabel;
    private npcPanel;
    private npcButton;
    private zoomSlider;
    private offState;
    private onKey;
    private onBeforeUnload;
    constructor(parent: HTMLElement, state: EditorState, storage: WorldStorage, hooks: EditorHooks);
    /** Chamado quando a arte terminou de carregar (as miniaturas dependem dela). */
    assetsReady(): void;
    /** Relê o mundo e a lista de zonas salvas. */
    private reloadWorld;
    /** Nome da zona onde o teste está agora (muda ao atravessar saídas). */
    showTestZone(name: string): void;
    /** Relógio do teste (hora da zona). */
    showTestClock(hour: number): void;
    destroy(): void;
    private iconBtn;
    private buildTop;
    /** Gaveta da esquerda: nome da zona e ações em cima, painel de terrenos/objetos embaixo. */
    private buildDrawer;
    /** Canto do palco com a gaveta fechada: abre o painel, salva e testa. */
    private buildQuick;
    private setName;
    private notifyBar;
    /** As ações do editor pra uma barra de fora (ver `EditorHooks.externalBar`). */
    controls(): EditorControls;
    private setDrawer;
    private buildTools;
    /** Controle de zoom no canto do palco: −, régua, porcentagem (volta a 100%), +, enquadrar. */
    private buildZoomBar;
    private toSlider;
    private updateZoomBar;
    private buildPanel;
    private buildStatus;
    private renderPane;
    /**
     * Lista que abre e fecha: uma seção aberta por vez (clicar no título abre
     * e fecha as outras). Buscando, todas as seções com resultado ficam abertas.
     */
    private accordion;
    private searchBox;
    private terrainCell;
    /** Terrenos agrupados nas seções da lista (paredes juntas, com subtítulos por família). */
    private terrainSections;
    private renderTerrains;
    private objectCell;
    private renderObjects;
    /** Miniatura pequena de um terreno (estilo de cômodo). */
    private swatch;
    private renderRooms;
    /**
     * Clima da zona (presets, lugar, hora fixa ou ciclo) e as luzes soltas:
     * a selecionada é editada no lugar; sem seleção, o painel ajusta como
     * sai a próxima.
     */
    private renderLight;
    /** Cor, alcance, força e tremulação: da luz selecionada, ou de como sai a próxima. */
    private lightLookGroup;
    private toggleEditorSound;
    private toggleMute;
    /** Volume novo vale na hora (o motor lê as preferências). */
    private applySound;
    /** Interruptor (liga/desliga) no estilo do editor. */
    private switchEl;
    /**
     * Sons: camadas em cartões (clique liga/desliga; o escolhido mostra o
     * volume), automático, passos e o volume de quem joga.
     */
    private renderSound;
    /** Janela pra escolher o piso, a parede ou a moldura de um cômodo. */
    private openTerrainPicker;
    /** Miniatura de uma peça, encostada embaixo (como fica no chão). */
    private thumb;
    /** Peça base do grupo de variantes (é ela que aparece na paleta e que se cura). */
    private primary;
    /** Escolhe a peça pra carimbar (e lembra nos recentes). */
    private pick;
    private toggleFavorite;
    /** Espelha os selecionados (ou o que vai ser carimbado). */
    private flip;
    private renderObjectInfo;
    /** Vários objetos selecionados: quantos, e o que dá pra fazer com todos. */
    private renderMultiInfo;
    /** Sobe/desce um objeto colocado (em cima de mesa etc.). */
    private lift;
    private openCurate;
    private renderZoneProps;
    /** Nome, destino e ligação de volta da saída selecionada. */
    private renderPortal;
    /** Faz a saída de destino apontar de volta pra esta (criando uma, se preciso). */
    private linkBack;
    private refresh;
    private setTool;
    private setBrush;
    private save;
    private exportZone;
    private importFile;
    private importZone;
    /**
     * Antes de trocar de zona: se há mudanças, pergunta se salva, descarta ou
     * cancela. Devolve true quando pode seguir.
     */
    private resolveUnsaved;
    /** Abre uma zona salva (pelo mapa do mundo ou pela lista). */
    private openZone;
    private resizeZone;
    private openShortcuts;
    private openCredits;
    private openCharacter;
    private startTest;
    /** O pé do boneco no ponto de início encosta em água, buraco ou tronco? */
    private spawnBlocked;
    private stopTest;
    /** Janela por cima do editor. `onDismiss` roda se fechar por fora (Esc, clique no fundo). */
    private modal;
    private openNewModal;
    private openOpenModal;
    private openWorldModal;
    private toast;
    private handleKey;
}
