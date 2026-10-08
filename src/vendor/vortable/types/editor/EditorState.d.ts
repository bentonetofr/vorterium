import type { WorldData, ZoneData, ZoneLight, ZoneObject } from '../types';
import { type RoomStyle } from '../world/rooms';
import type { ZoneSummary } from '../storage';
export type Tool = 'brush' | 'fill' | 'erase' | 'object' | 'select' | 'room' | 'light' | 'portal' | 'spawn';
/** Jeito de uma luz solta (o que a ferramenta Luz põe; a selecionada é editada no lugar). */
export type LightLook = Pick<ZoneLight, 'radius' | 'color' | 'intensity' | 'flicker'>;
/**
 * zone   = a zona inteira mudou (desfazer, abrir, nova) → redesenhar tudo
 * edit   = a zona mudou por uma edição que a cena já aplicou
 * ui     = ferramenta/opções mudaram
 * cursor = o mouse andou
 * world  = dados do mundo ou lista de zonas salvas mudaram
 * objects = objetos mudaram no lugar (espelhar, trocar variante) → reaplicar sprites
 * catalog = o catálogo de objetos mudou (curadoria) → refazer sprites e paleta
 * view   = a câmera mudou (zoom): só o indicador de zoom acompanha
 */
export type Change = 'zone' | 'edit' | 'ui' | 'cursor' | 'world' | 'objects' | 'catalog' | 'view';
export declare class EditorState {
    zone: ZoneData;
    tool: Tool;
    terrain: string;
    brush: number;
    objectKind: string | null;
    /** O objeto a carimbar sai espelhado. */
    flip: boolean;
    /** Estilo dos cômodos novos (ferramenta Cômodo). */
    roomStyle: RoomStyle;
    /** Ferramenta Cômodo: criar cômodo, riscar parede interna ou abrir porta. */
    roomMode: 'room' | 'wall' | 'door';
    snap: boolean;
    showGrid: boolean;
    showCollision: boolean;
    /** Índices dos objetos selecionados em zone.objects (vários com Shift ou retângulo). */
    selected: number[];
    /** Objetos copiados (Ctrl C), com posição relativa ao centro do grupo. Vale entre zonas. */
    clipboard: ZoneObject[];
    /** Há uma janela aberta por cima do editor (o teclado é dela). */
    modalOpen: boolean;
    /** Id da saída selecionada (ferramenta de saída). */
    selectedPortal: string | null;
    /** Id da luz solta selecionada (ferramenta Luz). */
    selectedLight: string | null;
    /** Como sai a próxima luz solta. */
    lightLook: LightLook;
    /** Mostrar a iluminação no editor (escuro da hora, luzes, sombras). */
    lightPreview: boolean;
    /** Zona em ciclo dia/noite: que hora mostrar no editor (só prévia, não é salva). */
    previewHour: number;
    /** O mundo e as zonas salvas nele (pro mapa do mundo e destinos das saídas). */
    world: WorldData | null;
    zones: ZoneSummary[];
    cursor: {
        tx: number;
        ty: number;
    } | null;
    zoom: number;
    /** Centro da câmera do editor (pra voltar ao mesmo lugar depois de testar). */
    view: {
        x: number;
        y: number;
    } | null;
    /** Há mudanças não salvas. */
    dirty: boolean;
    private undoStack;
    private redoStack;
    private listeners;
    constructor(zone: ZoneData);
    on(fn: (c: Change) => void): () => boolean;
    emit(c: Change): void;
    set(patch: Partial<Pick<EditorState, 'tool' | 'terrain' | 'brush' | 'objectKind' | 'flip' | 'roomStyle' | 'roomMode' | 'snap' | 'showGrid' | 'showCollision' | 'selected' | 'selectedPortal' | 'selectedLight' | 'lightLook' | 'lightPreview' | 'previewHour' | 'zoom'>>): void;
    /** Guarda o estado atual ANTES de uma edição (uma pincelada inteira = 1 passo). */
    checkpoint(): void;
    /** Avisa que uma edição foi aplicada (a cena já desenhou). */
    edited(): void;
    get canUndo(): boolean;
    get canRedo(): boolean;
    undo(): void;
    redo(): void;
    /** Troca a zona inteira (abrir/nova): zera o histórico. */
    load(zone: ZoneData): void;
    private replace;
    markSaved(): void;
    /** O objeto selecionado, quando é um só. */
    get single(): ZoneObject | null;
    get light(): ZoneLight | null;
    get portal(): import("..").Portal | null;
    /** Nome de uma zona pelo id (a atual pode ainda não estar salva). */
    zoneName(id: string): string;
}
