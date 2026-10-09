import type { Appearance } from '../types';
import { type CharacterData } from '../character/catalog';
import type { ProfileId } from './analyze';
export type Rng = () => number;
/** O que sai do gerador (ainda sem lugar no mapa). */
export interface NpcDraft {
    name: string;
    role: string;
    appearance: Appearance;
    /** NPC especial: a ficha a que pertence (o gerador não usa). */
    sheet?: string;
}
/** Famílias de tom de pele aceitas, cada uma com as cores da paleta que a representam. */
export declare const SKIN_FAMILIES: {
    readonly branca: readonly ['light'];
    readonly parda: readonly ['amber', 'olive', 'taupe', 'bronze'];
    readonly negra: readonly ['brown', 'black'];
};
export type SkinFamily = keyof typeof SKIN_FAMILIES;
export interface GenerateOptions {
    rnd?: Rng;
    /** Estilo do lugar (da análise da zona). */
    profile: ProfileId;
    /** Família de pele; sem ela, sorteia. */
    skin?: SkinFamily;
    /** Força uma ocupação (pelo rótulo masculino). */
    role?: string;
    /** Cabelos e looks já usados nesta leva (pra não repetir). */
    avoid?: {
        hair: Set<string>;
        looks: Set<string>;
        roles: Map<string, number>;
    };
}
export declare function generateNpc(data: CharacterData, opts: GenerateOptions): NpcDraft;
/**
 * Uma leva de NPCs variados: peles em rodízio (brancas, pardas e negras), cabelos e
 * ocupações sem repetir demais.
 */
export declare function generateBatch(data: CharacterData, profile: ProfileId, count: number, rnd?: Rng): NpcDraft[];
