import Phaser from 'phaser';
import type { Appearance, Dir } from '../types';
export declare const FRAME = 64;
export declare const DIR_ROWS: Dir[];
/** Animações LPC: quadros por linha; linhas sempre up, left, down, right. */
export declare const ANIMS: {
    readonly walk: {
        readonly frames: 9;
        readonly rate: 10;
    };
    readonly run: {
        readonly frames: 8;
        readonly rate: 12;
    };
    readonly idle: {
        readonly frames: 2;
        readonly rate: 2;
    };
};
export type AnimName = keyof typeof ANIMS;
/** Folha de uma animação com a aparência inteira (ou só de um espaço, pras miniaturas). */
export declare function composeAnim(assetBase: string, a: Appearance, anim: AnimName, only?: string): Promise<HTMLCanvasElement>;
/**
 * Um quadro só (64×64) da "walk", pra miniaturas: rápido porque recolore
 * só o quadro. Passe uma aparência com só os espaços que quer ver.
 */
export declare function composeFrame(assetBase: string, a: Appearance, row?: number, col?: number): Promise<HTMLCanvasElement>;
/** As três animações (prévia do criador e textura do jogo). */
export declare function composeAll(assetBase: string, a: Appearance): Promise<Record<"idle" | "run" | "walk", HTMLCanvasElement>>;
/**
 * Gera (ou regera) as texturas e animações de um boneco no Phaser.
 * Texturas: `${key}:walk`, `${key}:idle`...  Animações: `${key}:walk:down`...
 */
export declare function buildCharacter(scene: Phaser.Scene, key: string, assetBase: string, appearance: Appearance): Promise<void>;
