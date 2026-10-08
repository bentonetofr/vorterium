import type { ZoneObject } from '../types';
/**
 * Como o objeto se comporta na cena:
 *   stand = em pé: ordenado pela linha do pé (y-sort), pode colidir
 *   floor = no chão: sempre por baixo de quem anda (tapete, folhas)
 *   wall  = na parede: ordenado pela base, sem colisão (quadro, tocha)
 *   over  = por cima de tudo; fica transparente com alguém embaixo (telhado, copa)
 */
export type ObjectKind = 'stand' | 'floor' | 'wall' | 'over';
export declare const KIND_LABELS: Record<ObjectKind, string>;
/** Retângulo relativo à base-centro do objeto (y negativo = pra cima). */
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
/** Luz própria do objeto (usada pela iluminação, M3.5). x/y relativos à base-centro. */
export interface ObjectLight {
    x: number;
    y: number;
    radius: number;
    color: string;
    intensity: number;
    /** 0 = luz parada; 1 = tremula muito (fogo). */
    flicker: number;
}
export interface ObjectDef {
    /** `${folha}@${x},${y}` — posição na folha original, estável entre versões. */
    id: string;
    pack: string;
    sheet: string;
    category: string;
    label: string;
    tags: string[];
    kind: ObjectKind;
    /** Quadro (o primeiro, se animado) na folha gerada. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** O que colide (vazio = atravessável). */
    solids: Rect[];
    /** Linha de profundidade: px acima da base (o pé, sem a sombra). */
    sort: number;
    anim?: {
        fps: number;
        frames: [number, number][];
    };
    light?: ObjectLight;
    /** Peça base do grupo de variantes (cores/estados da mesma peça). */
    group?: string;
    variant?: string;
}
export interface PackInfo {
    id: string;
    name: string;
    license: string;
    credits: string;
}
export interface ObjectCatalog {
    packs: PackInfo[];
    sheets: {
        id: string;
        pack: string;
        url: string;
    }[];
    objects: ObjectDef[];
}
export declare const CATALOG_URL = "catalog/objects.json";
export declare const sheetTexture: (sheet: string) => string;
export declare const animKey: (id: string) => string;
export declare const animFrame: (id: string, n: number) => string;
export declare function setObjectCatalog(c: ObjectCatalog): void;
export declare const objectCatalog: () => ObjectCatalog;
export declare const objectDef: (id: string) => ObjectDef | undefined;
/** Variantes da peça (ela inclusa), ou só ela. */
export declare const variantsOf: (def: ObjectDef) => ObjectDef[];
/** Peças que aparecem na paleta: uma por grupo de variantes. */
export declare const paletteObjects: () => ObjectDef[];
/** Curadoria: troca a definição de uma peça já carregada (os sprites são refeitos por quem chamou). */
export declare function patchObjectDef(def: ObjectDef): void;
/**
 * Profundidade de desenho. Em pé: a linha do pé, não a borda de baixo do
 * sprite (que inclui a sombra) — quem pisa na sombra, na frente do tronco,
 * aparece na frente da árvore.
 */
export declare function objectDepth(def: ObjectDef | undefined, y: number): number;
/** Retângulos que colidem de um objeto colocado, em px do mundo. */
export declare function objectSolids(def: ObjectDef, o: Pick<ZoneObject, 'x' | 'y' | 'flip'>): Rect[];
