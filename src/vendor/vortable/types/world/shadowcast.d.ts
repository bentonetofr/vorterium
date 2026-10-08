import { type ZoneData } from '../types';
/** Segmento de parede alinhado aos eixos (y fixo = horizontal). */
interface Seg {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}
export interface Occlusion {
    w: number;
    h: number;
    opaque: Uint8Array;
    segs: Seg[];
    /** Muda quando as paredes mudam (chave do cache das texturas de luz). */
    version: string;
}
/** Tiles que barram a luz e as bordas entre eles e os livres. null = nada barra. */
export declare function buildOcclusion(zone: ZoneData): Occlusion | null;
/**
 * Textura da luz recortada pelas paredes, num canvas de `size`×`size`
 * (cobre o quadrado do raio). null = nenhuma parede perto (use o
 * gradiente comum).
 */
export declare function maskedLight(occ: Occlusion, x: number, y: number, radius: number, gradient: CanvasImageSource, size: number): HTMLCanvasElement | null;
export {};
