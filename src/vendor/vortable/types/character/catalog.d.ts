import { type Appearance, type BodyType } from '../types';
export interface CharLayer {
    z: number;
    /** Pasta da folha por tipo de corpo (relativa a `sheets`). */
    paths: Partial<Record<BodyType, string>>;
}
export interface CharColorChannel {
    key: string;
    label: string | null;
    material: string;
    /** Cores em que a folha foi desenhada (as que são trocadas). */
    source: string[];
}
export interface CharItem {
    id: string;
    slot: string;
    name: string;
    layers: CharLayer[];
    bodies: BodyType[];
    /** Animações que existem; as que faltam usam a "walk". */
    anims: string[];
    variants?: string[];
    colors?: CharColorChannel[];
    /** Pele acompanha a cor do corpo (cabeça, orelhas, nariz...). */
    matchBody?: boolean;
    /** Só vale com certas cabeças (as expressões pedem cabeça humana). */
    requiresHead?: 'human';
    /** Peça desenhada por código (ver proc.ts), sem folhas de imagem. */
    proc?: boolean;
}
export interface CharSlot {
    id: string;
    label: string;
    group: string;
    required?: boolean;
}
export interface CharCatalog {
    sheets: string;
    source: string;
    bodies: BodyType[];
    slots: CharSlot[];
    items: CharItem[];
}
/** material → nome da cor → rampa de cores. */
export type CharPalettes = Record<string, Record<string, string[]>>;
export interface CharacterData {
    catalog: CharCatalog;
    palettes: CharPalettes;
    byId: Map<string, CharItem>;
}
export declare function loadCharacterData(assetBase: string): Promise<CharacterData>;
export declare const BODY_LABELS: Record<BodyType, string>;
/** Nomes das alturas, da mais baixa à mais alta (mesma ordem de HEIGHTS). */
export declare const HEIGHT_LABELS: string[];
/** Cor representativa de uma rampa (pra amostras). */
export declare function swatch(palettes: CharPalettes, material: string, color: string): string;
export declare function itemsForSlot(data: CharacterData, slot: string, body: BodyType, a?: Appearance): CharItem[];
/** Pasta de uma camada pro corpo pedido (cai no outro corpo se faltar). */
export declare function layerDir(layer: CharLayer, body: BodyType): string;
export declare function itemLabel(item: CharItem): string;
export declare function defaultAppearance(body?: BodyType): Appearance;
/**
 * Tira o que não existe pro corpo escolhido (itens, variantes, cores) e
 * garante os espaços obrigatórios. Usado ao carregar e ao trocar de corpo.
 */
export declare function normalizeAppearance(data: CharacterData, a: Appearance): Appearance;
export declare function randomAppearance(data: CharacterData, rnd?: () => number): Appearance;
