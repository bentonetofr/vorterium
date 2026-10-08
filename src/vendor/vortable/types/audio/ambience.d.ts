import type { AudioEngine } from './engine';
export type LayerId = 'forest' | 'spooky' | 'wind' | 'rain' | 'storm' | 'thunder' | 'snow' | 'stream' | 'lake' | 'waterfall' | 'swamp' | 'sea' | 'cave' | 'fire' | 'torch';
/** Camadas do painel, na ordem em que aparecem; `icon` = nome no ICONS do editor. */
export declare const LAYERS: {
    id: LayerId;
    label: string;
    icon: string;
}[];
export interface LayerFrame {
    /** Volume alvo (0–1). */
    level: number;
    /** Dia (1) ou noite (0): a floresta troca de gravação. */
    day: number;
    /** De que lado está (−1 esquerda, 1 direita): fogo e água perto. */
    pan: number;
    /** Abafado (dentro de casa ouvindo a chuva lá fora). */
    muffled: boolean;
}
export declare class Layer {
    private e;
    readonly id: LayerId;
    private out?;
    private muffle?;
    private panner?;
    private sources;
    /** Volume de cada gravação da camada (floresta: dia e noite). */
    private parts;
    private current;
    private nextThunder;
    private thunder?;
    /** Nível de agora (pro painel mostrar). */
    level: number;
    constructor(e: AudioEngine, id: LayerId);
    /** Monta os nós e começa os laços (assim que os arquivos chegarem). */
    private build;
    /** Um trovão agora: perto (0) é forte e agudo; longe (1) é fraco e grave. */
    strike(distance: number, volume?: number): void;
    update(dt: number, f: LayerFrame): void;
    destroy(): void;
}
