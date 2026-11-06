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
export type RulerMode = 'line' | 'rect' | 'circle' | 'cone';
export declare const RULER_MODES: RulerMode[];
export declare const CONE_ANGLES: number[];
/** Pixels quadrados do mundo → metros quadrados. */
export declare const areaToM2: (px2: number) => number;
/** "24,0 m²" (até 100 m², 1 casa decimal; acima, inteiro com separador de milhar). */
export declare function formatArea(px2: number): string;
/** O retângulo da régua (cantos opostos), já normalizado. */
export declare function rulerRect(r: Ruler): {
    x: number;
    y: number;
    w: number;
    h: number;
    area: number;
    perimeter: number;
};
/** O círculo da régua: o centro é o primeiro ponto e o raio vai até o segundo. */
export declare function rulerCircle(r: Ruler): {
    cx: number;
    cy: number;
    radius: number;
    area: number;
    circumference: number;
};
/** O cone da régua: a ponta é o primeiro ponto, o eixo vai até o segundo e `angle` (graus) é a abertura total. */
export declare function rulerCone(r: Ruler, angle: number): {
    range: number;
    axis: number;
    half: number;
    area: number;
    chord: number;
};
/** O passo (em metros) das marcas da régua: o menor "redondo" que deixa as marcas separadas na tela. */
export declare function tickStepMeters(zoom: number, minGapPx?: number): number;
