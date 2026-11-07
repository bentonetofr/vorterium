/**
 * Passa a folha `sheet` (cols × 4 quadros, em pé) pra pose sentada, no lugar.
 * `rest` = a folha da animação "parado" do mesmo boneco: de lá vêm as pernas.
 */
/**
 * Cavalgando (`pose = 'riding'`, só usada pela montaria): o boneco fica parado em cima do cavalo. Todos os quadros da folha
 * viram o quadro parado da mesma vista, então as pernas (e os braços) não balançam enquanto o cavalo anda.
 */
export declare function ridingSheet(sheet: HTMLCanvasElement, rest: HTMLCanvasElement, cols: number): void;
export declare function sitSheet(sheet: HTMLCanvasElement, rest: HTMLCanvasElement, cols: number): void;
