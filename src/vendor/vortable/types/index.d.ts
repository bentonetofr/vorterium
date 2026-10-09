import { type WorldStorage } from './storage';
import { type Appearance, type CharacterSave, type Dir, type ZoneData } from './types';
import { daylight, formatHour, worldHour } from './world/daylight';
import { type LiveSound, type NetLink } from './net/hub';
import { type CharacterStorage } from './character/storage';
export * from './types';
export * from './storage';
export * from './character/storage';
export * from './character/transfer';
export { TERRAINS } from './assets/terrains';
export { composeFrame as characterFrame } from './character/compose';
export { defaultAppearance, randomAppearance, loadCharacterData, normalizeAppearance } from './character/catalog';
export { parseNet, REACTIONS } from './net/hub';
export type { LiveSound } from './net/hub';
export { ICONS as EDITOR_ICONS } from './editor/icons';
export { DAY_LENGTHS, SKY_PRESETS, skySwatch } from './world/daylight';
export { SURFACE_LABELS } from './audio/steps';
export { LAYERS as SOUND_LAYERS } from './audio/ambience';
export type { NetLink, NetMsg, NetHello, NetState, NetAnim, NetEnv, NetReact } from './net/hub';
export { formatHour, worldHour, daylight };
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
    /** Volta de onde a pessoa parou (ver `VortableHandle.snapshot`). Vale pro mesmo `mode` em que foi tirado. */
    resume?: VortableSnapshot;
    /** Câmera de observador: também ouve os sons da zona (espectador). */
    listen?: boolean;
    /**
     * Editor: liga a curadoria de peças (gravar ajustes nos pack.json). Só
     * funciona com o servidor de desenvolvimento do Vortable (npm run dev).
     */
    curate?: boolean;
}
/**
 * Onde a pessoa estava quando saiu (pra voltar exatamente aí): no jogo, a zona e o ponto
 * em que o boneco parou; no editor, a zona aberta (com o que ainda não foi salvo) e a câmera.
 */
export type VortableSnapshot = {
    kind: 'play';
    zoneId: string;
    x: number;
    y: number;
    dir: Dir;
} | {
    kind: 'edit';
    zone: ZoneData;
    dirty: boolean;
    view: {
        x: number;
        y: number;
    } | null;
    zoom: number;
};
/** Controles da câmera do mestre (mode 'watch'). */
export interface WatchControls {
    setZone(id: string): Promise<void>;
    /** Enquadra a zona inteira. */
    fit(): void;
    zoomBy(factor: number): void;
    focus(x: number, y: number): void;
    /** A câmera acompanha um jogador (null solta); `zoom` padrão 2 (o enquadramento do jogo). */
    follow(id: string | null, zoom?: number): void;
    /** Quem a câmera acompanha agora (null = ninguém). */
    following(): string | null;
    /** Espectador: manda uma reação (emoji de REACTIONS) pra todos verem no mapa. */
    react(emoji: string): void;
    /** Quem está na sala e onde. */
    peers(): {
        id: string;
        name: string;
        zone: string | null;
        x: number;
        y: number;
    }[];
    /** NPCs parados da zona que a câmera está vendo. */
    npcs(): {
        id: string;
        name: string;
        role: string;
    }[];
    /** O NPC que o mestre controla agora (null = nenhum). */
    controllingNpc(): string | null;
    /** Passa a controlar este NPC como um jogador (teclado WASD/setas, Shift corre). false = não deu. */
    controlNpc(id: string): Promise<boolean>;
    /** Solta o NPC onde ele está: todos o veem parado ali, e o ponto fica guardado na zona. */
    releaseNpc(): Promise<void>;
    /**
     * Muda hora/tempo/vento/sons ao vivo pra todos (zone '*' = todas as zonas). `hour: null` = ciclo dia/noite
     * (o tempo passa); `weather`/`wind`/`sound` null = o padrão do mundo e da zona.
     */
    setEnv(env: {
        zone: string;
        hour: number | null;
        weather: string | null;
        wind: number | null;
        sound?: LiveSound | null;
        dayMinutes?: number | null;
    }): void;
    /** Ajuste que está valendo agora (pra a interface mostrar). */
    envs(): {
        zone: string;
        hour: number | null;
        weather: string | null;
        wind: number | null;
        sound: LiveSound | null;
        dayMinutes: number | null;
    }[];
    /** Som da zona que o mestre ouve no Controle (os jogadores ouvem o deles). */
    audio: {
        /** Nível de cada camada agora (0–1). */
        levels(): Record<string, number>;
        /** "Ouvir" ligado? */
        listening(): boolean;
        listen(on: boolean): void;
        prefs(): {
            master: number;
            muted: boolean;
            steps: number;
        };
        setPrefs(patch: {
            master?: number;
            muted?: boolean;
            steps?: number;
        }): void;
        /** Ouvir o passo num chão. */
        previewStep(surface: string): void;
        /** Ouvir um trovão. */
        thunderNow(): void;
    };
    /** Hora do mundo definida no editor: fixa (número) ou ciclo (null), e a duração do dia em minutos. */
    sky(): {
        hour: number | null;
        dayMinutes: number;
    };
}
export interface VortableHandle {
    /** Só no mode 'watch'. */
    watch?: WatchControls;
    /** Onde a pessoa está agora, pra `resume` na próxima vez (null = sem o que guardar). */
    snapshot(): VortableSnapshot | null;
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
