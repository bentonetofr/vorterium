import type { EditorState } from './EditorState';
export interface NpcPanelHooks {
    assetBase: string;
    /** Leva a câmera do editor até um ponto da zona. */
    focus(x: number, y: number): void;
    toast(msg: string, error?: boolean): void;
}
export declare class NpcPanel {
    private state;
    private hooks;
    readonly el: HTMLElement;
    private data;
    private analysis;
    /** 'auto' = o estilo que a análise achou; senão o que o mestre escolheu. */
    private style;
    private drafts;
    private zoneId;
    private body;
    private opened;
    private off;
    constructor(state: EditorState, hooks: NpcPanelHooks);
    get isOpen(): boolean;
    toggle(): void;
    open(): Promise<void>;
    close(): void;
    destroy(): void;
    /** Reanalisa a zona (e sorteia uma leva nova quando o estilo mudou ou é a primeira vez). */
    private refreshAnalysis;
    private get profile();
    private newBatch;
    private render;
    private listEl;
    private card;
    private paint;
    private reroll;
    /** Personagem de um arquivo (o do criador de personagens) vira NPC: o clique seguinte no mapa o põe. */
    private importCharacter;
    /** Escolheu: o NPC vai pro mouse e o próximo clique no mapa o põe na zona. */
    private pick;
    private renderList;
    private row;
    /** Abre o criador de personagem (o mesmo do jogador) com a aparência do NPC; Aplicar muda o NPC na zona. */
    private editLook;
    private look;
    private toggleName;
    private turn;
    private move;
    private remove;
}
