import { type WorldStorage } from './storage';
import { type Appearance, type CharacterSave, type ZoneData } from './types';
import { formatHour } from './world/daylight';
import { type NetLink } from './net/hub';
import { type CharacterStorage } from './character/storage';
export * from './types';
export * from './storage';
export * from './character/storage';
export * from './character/transfer';
export { TERRAINS } from './assets/terrains';
export { composeFrame as characterFrame } from './character/compose';
export { defaultAppearance, randomAppearance, loadCharacterData, normalizeAppearance } from './character/catalog';
export { parseNet } from './net/hub';
export type { NetLink, NetMsg, NetHello, NetState, NetAnim, NetEnv } from './net/hub';
export { formatHour };
export { WEATHERS, WEATHER_ORDER } from './world/weather';
export { WIND_LEVELS, DEFAULT_WIND } from './world/wind';
export interface VortableOptions {
    /** play: jogar · edit: editor · watch: câmera livre do mestre (sem boneco; precisa de `net`). */
    mode?: 'play' | 'edit' | 'watch';
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
    /** Avisado a cada zona que a cena abre (o mestre acompanha em que zona a câmera está). */
    onZone?: (zone: ZoneData) => void;
    /** Editor: mostra o botão "Personagem" e chama isto ao clicar. */
    onEditCharacter?: () => void;
    /** Rede: com isto, os outros jogadores aparecem no mundo (sem, o jogo é solo). */
    net?: NetLink;
    /**
     * Editor: liga a curadoria de peças (gravar ajustes nos pack.json). Só
     * funciona com o servidor de desenvolvimento do Vortable (npm run dev).
     */
    curate?: boolean;
}
/** Controles da câmera do mestre (mode 'watch'). */
export interface WatchControls {
    setZone(id: string): Promise<void>;
    /** Enquadra a zona inteira. */
    fit(): void;
    zoomBy(factor: number): void;
    focus(x: number, y: number): void;
    /** A câmera acompanha um jogador (null solta). */
    follow(id: string | null): void;
    /** Quem está na sala e onde. */
    peers(): {
        id: string;
        name: string;
        zone: string | null;
        x: number;
        y: number;
    }[];
    /** Muda hora/tempo/vento ao vivo pra todos (zone '*' = todas as zonas; null = padrão da zona). */
    setEnv(env: {
        zone: string;
        hour: number | null;
        weather: string | null;
        wind: number | null;
    }): void;
    /** Ajuste que está valendo agora (pra a interface mostrar). */
    envs(): {
        zone: string;
        hour: number | null;
        weather: string | null;
        wind: number | null;
    }[];
}
export interface VortableHandle {
    /** Só no mode 'watch'. */
    watch?: WatchControls;
    /** Entrega uma mensagem que chegou da rede (ver NetMsg). */
    receive(msg: unknown): void;
    /** A rede abriu depois do jogo: reanuncia o boneco e pergunta quem está na sala. */
    resync(): void;
    /** O nome do jogador mudou (NetLink.name): os outros passam a ver o nome novo. */
    rename(): void;
    setAppearance(appearance: Appearance): Promise<void>;
    /** Trava o teclado do boneco (o mestre cobriu a tela com uma cena). */
    setInputLocked(locked: boolean): void;
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
