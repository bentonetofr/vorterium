import type { Appearance } from '../types';
/** Níveis -2 (nenhum: tronco liso / quadril reto, só feminino), -1 (menor), 0 (como o LPC desenha) e 1 (maior). */
export interface Shape {
    bust?: number;
    hips?: number;
    weight?: number;
}
export declare function hasShape(a: Appearance): boolean;
/**
 * Aplica o porte numa folha pronta (`frames` colunas × 4 linhas de quadros de 64).
 * Altera o canvas no lugar.
 */
export declare function reshapeSheet(canvas: HTMLCanvasElement, a: Appearance, frames: number): void;
