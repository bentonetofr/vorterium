import Phaser from 'phaser';
import { type AnimName } from './compose';
export declare const RAT_KEY = "char:rat";
/** As folhas do rato (parado, andando, correndo), no mesmo formato das do boneco. */
export declare function composeRat(): Record<AnimName, HTMLCanvasElement>;
/** Põe o rato na cena com a chave dada (uma vez só por cena). */
export declare function buildRat(scene: Phaser.Scene, key?: string): void;
