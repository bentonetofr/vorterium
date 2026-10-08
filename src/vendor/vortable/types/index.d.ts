import { type WorldStorage } from './storage';
import { type Appearance, type CharacterSave, type ZoneData } from './types';
import { type CharacterStorage } from './character/storage';
export * from './types';
export * from './storage';
export * from './character/storage';
export { TERRAINS } from './assets/terrains';
export { composeFrame as characterFrame } from './character/compose';
export { defaultAppearance, randomAppearance, loadCharacterData, normalizeAppearance } from './character/catalog';
export interface VortableOptions {
    mode?: 'play' | 'edit';
    /**
     * Zona inicial. No editor: a zona aberta (sem zona = uma nova vazia).
     * No jogo: onde começar (sem zona = a zona inicial do mundo).
     */
    zone?: ZoneData;
    appearance: Appearance;
    /** URL da pasta de assets (com / no fim). Padrão: './assets/'. */
    assetBase?: string;
    /** Onde ficam o mundo e as zonas. Padrão: localStorage do navegador. */
    storage?: WorldStorage;
    /** Editor: mostra o botão "Personagem" e chama isto ao clicar. */
    onEditCharacter?: () => void;
    /**
     * Editor: liga a curadoria de peças (gravar ajustes nos pack.json). Só
     * funciona com o servidor de desenvolvimento do Vortable (npm run dev).
     */
    curate?: boolean;
}
export interface VortableHandle {
    setAppearance(appearance: Appearance): Promise<void>;
    destroy(): void;
}
export declare function mountVortable(parent: HTMLElement, opts: VortableOptions): VortableHandle;
export interface CreatorMountOptions {
    /** URL da pasta de assets (com / no fim). Padrão: './assets/'. */
    assetBase?: string;
    /** Onde ficam os personagens. Padrão: localStorage do navegador. */
    storage?: CharacterStorage;
    /** Botão de voltar (ex.: pro editor), opcional. */
    back?: {
        label: string;
        onClick: () => void;
    };
    /** Modo jogador (um boneco só). Ver CreatorOptions. */
    single?: boolean;
    saveLabel?: string;
    activateOnSave?: boolean;
    onSaved?: (c: CharacterSave) => void;
}
/** Criador de personagem (não usa o Phaser: só DOM e canvas). */
export declare function mountCharacterCreator(parent: HTMLElement, opts?: CreatorMountOptions): {
    destroy: () => void;
};
