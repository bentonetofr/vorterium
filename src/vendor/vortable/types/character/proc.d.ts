import type { CharItem, CharPalettes, CharSlot } from './catalog';
/** Caixa da cabeça num quadro (px do quadro de 64). */
interface Box {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
/** Caneta que pinta no rosto: traduz (u, v) pro quadro e respeita a máscara da cabeça. */
export declare class Gfx {
    private ctx;
    private ox;
    private oy;
    private head;
    private sx;
    private sy;
    /** 0 cima, 1 esquerda, 2 baixo, 3 direita (linhas do LPC). */
    private row;
    private box;
    /** Lado de quem pinta: 1 = lado direito da imagem, -1 = esquerdo (o espelho). */
    side: 1 | -1;
    color: string;
    alpha: number;
    /** Pode pintar por cima dos olhos (cicatriz que corta o olho, sombra). */
    eyes: boolean;
    constructor(ctx: CanvasRenderingContext2D, ox: number, oy: number, head: ImageData, sx: number, sy: number, 
    /** 0 cima, 1 esquerda, 2 baixo, 3 direita (linhas do LPC). */
    row: number, box: Box);
    private get eyeY();
    /** Pixel do quadro pra um ponto do rosto; null = não aparece nesta vista. */
    private map;
    private opaque;
    /** Um pixel do rosto. */
    dot(u: number, v: number, alpha?: number, color?: string): void;
    /** Um pixel no meio do rosto (u de -3 a 2): de lado vira um pontinho na frente. */
    cdot(u: number, v: number, alpha?: number, color?: string): void;
    pts(list: [number, number][], alpha?: number): void;
    line(u0: number, v0: number, u1: number, v1: number, alpha?: number): void;
    rect(u: number, v: number, w: number, h: number, alpha?: number): void;
    /** Roda a receita nos dois lados do rosto. */
    both(fn: () => void): void;
    /** Pontos espalhados, sempre os mesmos pra mesma `seed` (pintas e sardas não "andam" entre quadros). */
    scatter(seed: number, n: number, area: [number, number, number, number], alpha?: number, size?: number): void;
}
/** Receita de uma peça. */
export interface ProcDef {
    id: string;
    slot: string;
    name: string;
    /** Camada (zPos do LPC): cabeça 100, expressão 101, cabelo acima. */
    z?: number;
    /** Cor da paleta (nome de PROC_PALETTES); sem isso a peça não tem cor. */
    palette?: keyof typeof PROC_PALETTES;
    /** Cor padrão (nome na paleta). */
    color?: string;
    /** Pode pintar por cima dos olhos. */
    eyes?: boolean;
    alpha?: number;
    draw(g: Gfx): void;
}
export declare const PROC_PALETTES: {
    freckle: {
        castanho: string[];
        ruivo: string[];
        claro: string[];
        escuro: string[];
        dourado: string[];
        cinza: string[];
    };
    scar: {
        palida: string[];
        fresca: string[];
        antiga: string[];
        branca: string[];
        escura: string[];
        arroxeada: string[];
    };
    lip: {
        vermelho: string[];
        rosa: string[];
        vinho: string[];
        ameixa: string[];
        nude: string[];
        coral: string[];
        preto: string[];
        roxo: string[];
        azul: string[];
        verde: string[];
        dourado: string[];
        branco: string[];
        neon_rosa: string[];
        neon_ciano: string[];
    };
    shadow: {
        preto: string[];
        marrom: string[];
        cinza: string[];
        azul: string[];
        verde: string[];
        roxo: string[];
        rosa: string[];
        dourado: string[];
        prata: string[];
        vermelho: string[];
        neon_azul: string[];
        neon_rosa: string[];
        neon_verde: string[];
    };
    blush: {
        rosa: string[];
        pessego: string[];
        coral: string[];
        vermelho: string[];
        roxo: string[];
        marrom: string[];
        dourado: string[];
    };
    paint: {
        branco: string[];
        vermelho: string[];
        preto: string[];
        azul: string[];
        verde: string[];
        amarelo: string[];
        laranja: string[];
        roxo: string[];
        dourado: string[];
        prata: string[];
        neon_ciano: string[];
        neon_rosa: string[];
        neon_verde: string[];
        neon_amarelo: string[];
    };
    ink: {
        preto: string[];
        azul_escuro: string[];
        verde_escuro: string[];
        vermelho: string[];
        branco: string[];
        roxo: string[];
        cinza: string[];
    };
};
export declare const PROC_DEFS: Map<string, ProcDef>;
/** Espaços novos (aba e nome em português). */
export declare const PROC_SLOTS: CharSlot[];
/** As receitas como itens do catálogo (sem folhas de imagem: `proc`). */
export declare function procItems(): CharItem[];
/** Paletas das peças desenhadas, no formato das do boneco. */
export declare function procPalettes(): CharPalettes;
/** A cor (hex) de uma peça: a escolhida na paleta, senão a padrão. */
export declare function procColor(def: ProcDef, chosen?: string): string;
/** Caixa da cabeça no quadro (col, row) de uma folha de cabeça. */
export declare function headBox(head: ImageData, sx: number, sy: number): Box | null;
/**
 * Pinta uma peça no quadro (col,row) da folha de saída.
 * `head` = a folha (já com a cor da pele) da cabeça; `dx,dy` = onde o quadro fica em `ctx`; `sx,sy` = onde fica em `head`.
 */
export declare function paintProc(ctx: CanvasRenderingContext2D, dx: number, dy: number, head: ImageData, sx: number, sy: number, row: number, def: ProcDef, chosenColor?: string): void;
export {};
