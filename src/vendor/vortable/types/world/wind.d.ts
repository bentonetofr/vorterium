import Phaser from 'phaser';
import type { ObjectDef } from '../assets/objects';
import type { TerrainDef } from '../assets/terrains';
/** Como uma peça balança. amp = px que o topo anda no vento forte. */
export interface SwaySpec {
    amp: number;
    /** Oscilações por segundo (planta pequena treme mais rápido que árvore). */
    freq: number;
    /** bottom = pé preso (plantas); top = pendurado (placas, lamparinas). */
    anchor: 'bottom' | 'top';
    phase: number;
    /** Onde a peça está (a rajada chega em cada lugar numa hora). */
    x: number;
    y: number;
    /** Empurrão extra agora, em px (grama chacoalhando quando alguém passa). */
    kick?: number;
}
export declare const WIND_LEVELS: [number, string, string][];
export declare const DEFAULT_WIND = 0.45;
/** Como a peça balança (null = não balança). */
export declare function swaySpec(def: ObjectDef, x: number, y: number): SwaySpec | null;
/** Terrenos cujos tufos balançam (grama 1, capim/trigo mais; 0 = nada). */
export declare function terrainSway(t: TerrainDef): 0 | 0.8 | 1 | 1.6;
export declare class Wind {
    /** 0–1. */
    strength: number;
    time: number;
    /** Direção (normalizada): pra direita, um pouco pra baixo. */
    readonly dx = 0.97;
    readonly dy = 0.24;
    update(dt: number, strength: number): void;
    /** Rajada neste ponto agora (0–1): duas ondas de tamanhos diferentes andando juntas. */
    gust(x: number, y: number): number;
    /** Deslocamento (px) do topo (ou da ponta, se pendurado) agora. */
    sway(s: SwaySpec): number;
}
export declare function setActiveWind(w: Wind | null): void;
export declare const SWAY_PIPELINE = "VortableSway";
/** Põe (ou tira) o balanço num sprite de objeto. */
export declare function applySway(s: Phaser.GameObjects.Sprite, def: ObjectDef | undefined, x: number, y: number, z?: number): void;
/** Põe (ou tira) um balanço qualquer num sprite. */
export declare function setSway(s: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite, spec: SwaySpec | null): void;
/** O balanço de uma peça (pras sombras acompanharem). */
export declare function swayOf(s: SwaySpec | undefined): number;
