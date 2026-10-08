import Phaser from 'phaser';
import { type TerrainDef } from '../assets/terrains';
import { type ZoneData } from '../types';
import { Tufts } from './tufts';
export declare const MASK_FRAMES: Record<number, number[]>;
export declare function overlayTerrain(zone: ZoneData, vx: number, vy: number): TerrainDef | null;
export declare function cornerTerrain(zone: ZoneData, vx: number, vy: number): TerrainDef;
/** O chão desenhado numa textura só; dá pra redesenhar só um pedaço (editor). */
export declare class Ground {
    private scene;
    private zone;
    readonly rt: Phaser.GameObjects.RenderTexture;
    /** Tufinhos de grama soltos do chão (balançam com o vento). */
    readonly tufts: Tufts;
    constructor(scene: Phaser.Scene, zone: ZoneData);
    destroy(): void;
    setZone(zone: ZoneData): void;
    redrawAll(): void;
    /** Redesenha os tiles afetados por vértices no retângulo (inclusive). */
    redrawVertices(vx0: number, vy0: number, vx1: number, vy1: number): void;
    redrawTiles(tx0: number, ty0: number, tx1: number, ty1: number): void;
    private drawTile;
}
/**
 * Bloqueios do terreno: cada canto sólido (água, buraco, abismo) bloqueia o
 * quarto de tile em volta dele, como o desenho. Junta vizinhos. Nos cômodos
 * (zone.rooms) a estrutura manda: todo tile que toca a parede é sólido, e todo tile da BORDA (cantos dentro e fora do cômodo)
 * também — é nele que a moldura e a faixa escura são desenhadas, a partir
 * da linha exata onde o piso acaba. Vale em qualquer fundo.
 */
export declare function solidTerrainRects(zone: ZoneData): {
    x: number;
    y: number;
    w: number;
    h: number;
}[];
