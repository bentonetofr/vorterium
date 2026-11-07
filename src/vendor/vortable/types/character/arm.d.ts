export type MissingArm = 'left' | 'right';
/** Por vista: de qual borda da imagem sai o braço que falta ('l' / 'r'), ou null se ele não aparece nessa vista. */
export declare function armEdge(missing: MissingArm, row: number): 'l' | 'r' | null;
/**
 * Apaga o braço de `sheet` (frames colunas × 4 linhas de quadros de 64), no lugar. `body` é a folha do corpo
 * sozinho, do mesmo tamanho, que diz onde o braço está.
 */
export declare function removeArm(sheet: HTMLCanvasElement, body: HTMLCanvasElement, missing: MissingArm, frames: number): void;
