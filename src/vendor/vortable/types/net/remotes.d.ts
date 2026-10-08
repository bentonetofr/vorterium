import Phaser from 'phaser';
import type { NetHub } from './hub';
export declare class Remotes {
    private scene;
    private hub;
    private assetBase;
    private zoneId;
    private avatars;
    constructor(scene: Phaser.Scene, hub: NetHub, assetBase: string, zoneId: string);
    /** Sprites visíveis agora (pra sombra do sol). */
    get sprites(): Phaser.GameObjects.Sprite[];
    update(dt: number): void;
    private build;
    private drop;
    private destroy;
}
