import type { ProfileId } from './analyze';
/** Uma peça possível num espaço: regex do id no catálogo, cores que combinam e a chance de usar. */
export interface SlotSpec {
    re: RegExp;
    colors?: string[];
    chance?: number;
}
export type HairStyle = 'neat' | 'rustic' | 'short' | 'elder';
/** Idade do rosto: adulto (padrão) ou idoso. */
export type Age = 'adult' | 'elder' | 'any';
export interface Outfit {
    clothes?: SlotSpec[];
    vest?: SlotSpec[];
    jacket?: SlotSpec[];
    dress?: SlotSpec[];
    legs?: SlotSpec[];
    shoes?: SlotSpec[];
    hat?: SlotSpec[];
    neck?: SlotSpec[];
    cape?: SlotSpec[];
    apron?: SlotSpec[];
    belt?: SlotSpec[];
    armour?: SlotSpec[];
    gloves?: SlotSpec[];
    arms?: SlotSpec[];
    backpack?: SlotSpec[];
    facial?: SlotSpec[];
    hair: HairStyle;
    age?: Age;
    /** Chance de barba/bigode (só corpo masculino). */
    beard?: number;
}
export interface Role {
    /** [masculino, feminino]. */
    label: [string, string];
    weight: number;
    outfit: Outfit;
}
/** As ocupações de cada tipo de lugar. */
export declare const PROFILES: Record<ProfileId, Role[]>;
/** Rótulo bonito dos estilos de cabelo → regex do id, por corpo. */
export declare const HAIR_STYLES: Record<HairStyle, {
    male: RegExp;
    female: RegExp;
}>;
