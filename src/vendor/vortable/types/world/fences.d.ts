import Phaser from 'phaser';
import { type TerrainDef } from '../assets/terrains';
import { type ZoneData } from '../types';
export declare function fenceAt(zone: ZoneData, tx: number, ty: number): TerrainDef | null;
/** Bordas ligadas do tile (vizinhos com a mesma cerca). */
export declare function fenceMask(zone: ZoneData, tx: number, ty: number): number;
/** Pedaço da folha pra máscara; sem ele, o mais parecido (mais bordas em comum). */
export declare function fenceTile(t: TerrainDef, mask: number): [number, number] | null;
/** Retângulos que colidem: o poste no meio e um braço pra cada borda ligada. */
export declare function fenceSolids(zone: ZoneData): {
    x: number;
    y: number;
    w: number;
    h: number;
}[];
/** Os sprites das cercas de uma zona (refaz tudo a cada mudança: são poucos). */
export declare class FenceLayer {
    private scene;
    private zone;
    private sprites;
    constructor(scene: Phaser.Scene, zone: ZoneData);
    setZone(zone: ZoneData): void;
    rebuild(): void;
    destroy(): void;
}
