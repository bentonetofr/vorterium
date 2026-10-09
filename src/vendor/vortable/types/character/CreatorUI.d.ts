import { type CharacterStorage } from './storage';
import { type CharacterSave } from '../types';
export interface CreatorOptions {
    assetBase: string;
    storage: CharacterStorage;
    /** Botão de fechar/voltar (ex.: pro editor). Sem ele, o botão não aparece. */
    back?: {
        label: string;
        onClick: () => void;
    };
    /**
     * Modo jogador: um boneco só, sem lista nem "Novo". Salvar guarda o boneco
     * e chama `onSaved` (é como o jogador fixa o personagem dele na campanha).
     */
    single?: boolean;
    /** Título no alto da tela (padrão: "Definir aparência"). */
    title?: string;
    /** Nome do personagem novo (padrão: "Novo personagem"). */
    initialName?: string;
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
    /** Sobe a cada folha nova (a ampliação guardada vale só pra versão dela). */
    private rev;
    private raf;
    private cam;
    /** Altura mostrada agora (anima até a escolhida). */
    private hs;
    private camOverride;
    private upCache;
    private stageEl;
    private canvas;
    private resizeObs;
    private nameInput;
    private tabsEl;
    private rowsEl;
    private statusEl;
    private camBtn;
    private nextBtn;
    private prevBtn;
    /** O cavaleiro correndo, por cima do criador enquanto o catálogo carrega. */
    private loading?;
    private animButtons;
    private thumbObserver;
    private baseThumb;
    private modals;
    private drag;
    private onKey;
    private onBeforeUnload;
    constructor(parent: HTMLElement, opts: CreatorOptions);
    private init;
    destroy(): void;
    private tool;
    private get appearance();
    /** As peças de um espaço que servem pro corpo e pra cabeça de agora. */
    private itemsFor;
    private groupOf;
    /** Abas com peças pra escolher (na ordem do criador). */
    private groups;
    private slotsOfGroup;
    private renderTabs;
    private setGroup;
    private stepGroup;
    private focusSlot;
    /** Linhas da aba: uma por peça (◀ valor ▶); a escolhida mostra as cores embaixo. */
    private renderRows;
    private arrow;
    /** Uma linha de escolha com ◀ valor ▶ (sem peça do catálogo). */
    private choiceRow;
    /** Corpo: masculino, feminino, jovem esguio ou pequeno. (O musculoso é um porte do masculino.) */
    private bodyRow;
    /** Porte do corpo: peito, bunda e peso no feminino; magro, normal, musculoso ou gordo no masculino. */
    private shapeRows;
    private heightRow;
    private skinRow;
    private slotRow;
    /** Cores e variantes da peça escolhida. */
    private detail;
    private swatches;
    /** Janela com todas as opções de uma peça, com miniaturas. */
    private openGrid;
    /** Miniatura: o item sobre o corpo e a cabeça atuais (meio apagados). */
    private drawThumb;
    /** Ao trocar de item, mantém as cores que fazem sentido (mesmo canal e material). */
    private carryColors;
    private update;
    private chooseItem;
    /** Passa pra a peça anterior/seguinte do espaço (volta ao começo no fim; "Nenhum" conta, se puder). */
    private cycle;
    private setBody;
    /** Troca o corpo da aparência `a`: as peças que não existem pro corpo novo viram uma parecida (mesmo nome) ou, nas roupas de baixo, a primeira da lista. */
    private swapBody;
    private randomize;
    private turn;
    private refreshAnimButtons;
    private markDirty;
    private refreshStatus;
    private cameraMode;
    private toggleCamera;
    private setupStageInput;
    private fitCanvas;
    /** O quadro (anim, direção, coluna) já ampliado 8×, guardado enquanto a folha for a mesma. */
    private upscaled;
    /** Prévia animada: desenha o quadro ampliado, com a câmera chegando no rosto ou no corpo todo. */
    private loop;
    /** Remonta as folhas da prévia (a mais recente vence se clicarem rápido). */
    private recompose;
    private handleKey;
    private save;
    /** Baixa o personagem aberto como arquivo (vale em qualquer campanha). */
    private exportFile;
    /** Abre um arquivo de personagem na tela (sem salvar). No modo jogador, troca o boneco que já existe. */
    private importFile;
    /** Fechar: com mudanças, pergunta se salva (OK) ou descarta (Cancelar). */
    private goBack;
    private openCredits;
    private newCharacter;
    private afterLoad;
    private openList;
    private modal;
    private toast;
}
