import type { AudioEngine } from './engine';
export type Surface = 'grass' | 'dirt' | 'sand' | 'gravel' | 'snow' | 'stone' | 'wood' | 'rug' | 'water';
export declare const SURFACE_LABELS: Record<Surface, string>;
export declare class Steps {
    private e;
    private clips;
    private last;
    constructor(e: AudioEngine);
    /** Um passo. `wet` = chão molhado (chuva): um respingo leve junto. */
    play(surface: Surface, volume: number, pan?: number, wet?: boolean): void;
}
