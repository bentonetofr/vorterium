import Phaser from 'phaser';
import type { Wind } from './wind';
export declare const DOT = "light:dot";
export declare const PUFF = "light:puff";
export declare const DEPTH_GLOWING = 900010;
export declare const DEPTH_AIR = 800000;
export interface FireSource {
    x: number;
    y: number;
    /** Tamanho do fogo (1 = tocha). */
    size: number;
    /** Fogueira/lareira grande: solta faíscas. */
    sparks: boolean;
    /** Fogueira ao ar livre: solta fumaça. */
    smoke: boolean;
}
export interface LeafSource {
    /** Área da copa (de onde as folhas se soltam), px do mundo. */
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    /** Onde fica o chão embaixo da árvore. */
    foot: number;
    colors: number[];
}
export interface ParticleFrame {
    /** Área visível do mundo (com folga). */
    view: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** A zona (px): folhas não voam pra fora dela. */
    bounds: {
        w: number;
        h: number;
    };
    wind: Wind;
    fires: FireSource[];
    trees: LeafSource[];
    /** Pontos com água (centros de vértice), pra os reflexos. */
    water: {
        x: number;
        y: number;
    }[];
    /** 0–1: quantos vaga-lumes (noite ao ar livre). */
    fireflies: number;
    /** 0–1: quanta poeira no ar (interiores, subterrâneos). */
    dust: number;
    /** 0–1: quanto sol (reflexos na água mais fortes de dia). */
    day: number;
    /** Hora dourada ao ar livre (0–1): grãos de luz e pássaros. */
    warm: number;
    /** Amanhecer (0–1): orvalho na grama. */
    dew: number;
}
export declare function ensureParticleTextures(scene: Phaser.Scene): void;
export declare class Particles {
    private scene;
    private pool;
    private list;
    /** Sobra fracionária de partículas a soltar por fonte (chave → acumulado). */
    private due;
    constructor(scene: Phaser.Scene);
    private take;
    private drop;
    /** Some com tudo (iluminação desligada, troca de zona). */
    clear(): void;
    destroy(): void;
    /** Quantas soltar agora de uma fonte que solta `rate` por segundo. */
    private emit;
    update(dt: number, t: number, f: ParticleFrame): void;
}
