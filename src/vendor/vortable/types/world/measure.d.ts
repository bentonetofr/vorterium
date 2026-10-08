export interface Ruler {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
/** Metros → pixels do mundo. */
export declare const metersToPx: (m: number) => number;
/** Pixels do mundo → metros. */
export declare const pxToMeters: (px: number) => number;
/** "12,4 m" (até 1 casa decimal; abaixo de 1 m, em centímetros). */
export declare function formatMeters(px: number): string;
/** Direção da régua como bússola: 0° = norte (pra cima), sentido horário. */
export declare function bearing(r: Ruler): {
    deg: number;
    cardinal: string;
};
export declare const rulerLength: (r: Ruler) => number;
/** O passo (em metros) das marcas da régua: o menor "redondo" que deixa as marcas separadas na tela. */
export declare function tickStepMeters(zoom: number, minGapPx?: number): number;
