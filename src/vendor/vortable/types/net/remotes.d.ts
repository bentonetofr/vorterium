import Phaser from 'phaser';
import type { Dir } from '../types';
import type { NetHub } from './hub';
/** Onde está quem conduz um cavalo (pra quem vai na garupa se posicionar). */
export interface DriverInfo {
    x: number;
    y: number;
    dir: Dir;
    depth: number;
}
/** Deslocamento do cavaleiro da garupa em relação ao do cavalo, por direção: [x, y, profundidade extra]. */
export declare function pillionOffset(dir: Dir, scale?: number): [number, number, number];
export declare class Remotes {
    private scene;
    private hub;
    private assetBase;
    private zoneId;
    /** Quem conduz o cavalo `npcId` é o jogador desta tela? Devolve onde ele está (pra quem vai na garupa dele). */
    private localDriver?;
    private avatars;
    constructor(scene: Phaser.Scene, hub: NetHub, assetBase: string, zoneId: string, 
    /** Quem conduz o cavalo `npcId` é o jogador desta tela? Devolve onde ele está (pra quem vai na garupa dele). */
    localDriver?: ((npcId: string) => DriverInfo | null) | undefined);
    /** Onde está (e pra onde olha) quem conduz o cavalo `npcId`: ele mesmo, aqui, ou um jogador da sala. */
    driverOf(npcId: string): DriverInfo | null;
    /** Sprites visíveis agora (pra sombra do sol). */
    get sprites(): Phaser.GameObjects.Sprite[];
    /** O boneco deste jogador, se está nesta zona e à vista (câmera de conversa). */
    spriteOf(id: string): Phaser.GameObjects.Sprite | null;
    update(dt: number): void;
    private build;
    /** Subiu (ou desceu) de um cavalo: monta as texturas dele e troca o desenho do boneco. */
    /** O cavaleiro da garupa: no lugar de quem conduz, deslocado pra trás e um pouco mais alto. */
    private placePillion;
    private buildMount;
    private drop;
    private destroy;
}
