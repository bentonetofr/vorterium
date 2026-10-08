import type { ZoneData } from '../types';
export interface RoomStyle {
    floor: string;
    wall: string;
    trim: string;
    /** Altura da parede em tiles (0 = só a borda, como um corredor visto de cima). */
    height: number;
}
export declare const ROOM_HEIGHT_MAX = 4;
export declare const encodeRoom: (s: RoomStyle) => string;
export declare function decodeRoom(v: string): RoomStyle | null;
/** Estilos prontos (ids dos terrenos dos pacotes de piso, parede e moldura). */
export declare const ROOM_PRESETS: {
    name: string;
    style: RoomStyle;
}[];
/**
 * O papel de cada vértice: '' (fora), `${estilo}#f` (piso) ou `${estilo}#w`
 * (parede). A face da parede nasce abaixo de uma borda de cima de verdade:
 * a coluna precisa de uma vizinha (esquerda ou direita) que comece na mesma
 * linha — assim o vão de uma porta numa parede vertical não ganha face.
 */
export declare function roomRoles(zone: ZoneData): string[];
/**
 * Reescreve piso/parede/moldura onde o papel do vértice mudou (de `before`
 * pra agora). Devolve se algo mudou.
 */
export declare function applyRooms(zone: ZoneData, before: string[]): boolean;
/** Vértices do cômodo ligado ao vértice (x, y), com o mesmo estilo dele. */
export declare function connectedRoom(zone: ZoneData, vx: number, vy: number): number[];
