import { type CharacterStorage } from './storage';
import type { CharacterSave } from '../types';
export interface CreatorOptions {
    assetBase: string;
    storage: CharacterStorage;
    /** Botão "voltar" (ex.: pro editor). Sem ele, o botão não aparece. */
    back?: {
        label: string;
        onClick: () => void;
    };
    /**
     * Modo jogador: um boneco só, sem lista nem "Novo". Salvar guarda o boneco
     * e chama `onSaved` (é como o jogador entra no jogo pela primeira vez).
     */
    single?: boolean;
    saveLabel?: string;
    /** Salvar também põe o boneco em uso (padrão: sim). O mestre cria NPCs sem tomar o lugar do dele. */
    activateOnSave?: boolean;
    onSaved?: (c: CharacterSave) => void;
}
export declare class CreatorUI {
    private opts;
    readonly root: HTMLDivElement;
    private data;
    private character;
    private dirty;
    private group;
    private slot;
    private anim;
    private dir;
    private sheets;
    private composeToken;
    private raf;
    private nameInput;
    private preview;
    private tabsEl;
    private slotsEl;
    private optionsEl;
    private statusEl;
    private animButtons;
    private thumbObserver;
    private baseThumb;
    private modals;
    private onKey;
    private onBeforeUnload;
    constructor(parent: HTMLElement, opts: CreatorOptions);
    private init;
    destroy(): void;
    private iconBtn;
    private get appearance();
    private groups;
    private renderTabs;
    /** Lista de espaços da aba, com o item escolhido em cada um. */
    private renderSlots;
    /** Opções do espaço escolhido: corpo/pele (no Corpo), itens, cores e variantes. */
    private renderOptions;
    private swatches;
    /** Miniatura: o item sobre o corpo e a cabeça atuais (meio apagados). */
    private drawThumb;
    /** Ao trocar de item, mantém as cores que fazem sentido (mesmo canal e material). */
    private carryColors;
    private update;
    private chooseItem;
    private setBody;
    private randomize;
    private turn;
    private refreshAnimButtons;
    private markDirty;
    private refreshStatus;
    /** Remonta as folhas da prévia (a mais recente vence se clicarem rápido). */
    private recompose;
    /** Prévia animada (desenha a folha da animação escolhida, quadro a quadro). */
    private loop;
    private save;
    /** Voltar: com mudanças, pergunta se salva (OK) ou descarta (Cancelar). */
    private goBack;
    private openCredits;
    private newCharacter;
    private afterLoad;
    private openList;
    private modal;
    private toast;
}
