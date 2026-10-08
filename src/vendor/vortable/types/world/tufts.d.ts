import Phaser from 'phaser';
import { type TerrainDef } from '../assets/terrains';
/**
 * Um tufo recortado: a textura (só a caixa em volta dos tufos) e onde fica
 * o canto de baixo à esquerda dela dentro do tile — o balanço prende ali,
 * no pé do tufo, não no pé do tile.
 */
export interface Tuft {
    key: string;
    x: number;
    bottom: number;
}
/** O tufo (o que difere do miolo liso), recortado na primeira vez. */
export declare function tuftTexture(scene: Phaser.Scene, t: TerrainDef, frame: number): Tuft | null;
/** Os tufos de uma zona: qual textura em cada tile, e os sprites dos que estão à vista. */
export declare class Tufts {
    private scene;
    private w;
    private h;
    /** Tufo de cada tile (índice ty * w + tx); null = sem tufo solto. */
    private keys;
    private active;
    private pool;
    private time;
    constructor(scene: Phaser.Scene, w: number, h: number);
    set(tx: number, ty: number, key: Tuft | null): void;
    destroy(): void;
    /**
     * Põe sprite nos tiles à vista e tira dos que saíram. `feet` = quem está
     * andando (a grama chacoalha embaixo).
     */
    update(cam: Phaser.Cameras.Scene2D.Camera, dt: number, feet?: {
        x: number;
        y: number;
    }[]): void;
    /** Sprite no lugar do tufo; quanto mais alto o tufo, mais a ponta anda. */
    private place;
    private shake;
}
