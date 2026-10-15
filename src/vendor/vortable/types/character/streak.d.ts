import type { CharItem, CharSlot } from './catalog';
export declare const STREAK_SLOT = "hair_streak";
export type StreakSide = 'R' | 'L';
export type StreakKind = 'front' | 'half' | 'thin';
interface StreakDef {
    id: string;
    name: string;
    kind: StreakKind;
    side: StreakSide;
}
/** O espaço novo, na aba do cabelo. */
export declare const STREAK_SLOTS: CharSlot[];
/** As mechas como itens do catálogo (sem folhas de imagem): a cor vem da paleta do cabelo. */
export declare function streakItems(): CharItem[];
export declare const streakSpec: (id: string | undefined) => StreakDef | undefined;
/** Esta peça é uma mecha (e não uma peça desenhada no rosto)? */
export declare const isStreakItem: (id: string) => boolean;
/**
 * Troca, em `base` (a folha do cabelo na cor dele), os pixels da região da mecha pelos de `alt` (o
 * mesmo cabelo na cor da mecha). `frames`: onde cada quadro está na folha (px) e onde fica a cabeça
 * correspondente em `head` (a folha da cabeça), com a vista (`row`).
 */
export declare function applyStreak(base: HTMLCanvasElement, alt: HTMLCanvasElement, head: ImageData, frames: {
    dx: number;
    dy: number;
    hx: number;
    hy: number;
    row: number;
}[], def: StreakDef): void;
export {};
