/** Amplia um canvas `passes` vezes (cada uma dobra o tamanho: 3 passadas = 8×). */
export declare function scale2x(src: CanvasImageSource & {
    width: number;
    height: number;
}, passes: number): HTMLCanvasElement;
