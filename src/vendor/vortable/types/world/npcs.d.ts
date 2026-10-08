import Phaser from 'phaser';
import type { ZoneNpc } from '../types';
export declare class NpcLayer {
    private scene;
    private assetBase;
    private names;
    private items;
    /** `names`: 'near' mostra o nome de quem está perto do foco; 'always' sempre (editor). */
    constructor(scene: Phaser.Scene, assetBase: string, names?: 'near' | 'always');
    /** Sprites visíveis agora (pra sombra do sol e luzes). */
    get sprites(): Phaser.GameObjects.Sprite[];
    /** Põe a lista de NPCs da zona na cena (cria os novos, move os que mudaram, tira os que saíram). */
    set(npcs: ZoneNpc[]): void;
    private build;
    private place;
    /** Mostra o nome de quem está perto de `focus` (o jogador). */
    update(focus?: {
        x: number;
        y: number;
    }): void;
    /** O NPC (do editor) sob um ponto do mundo, ou null. */
    npcAt(x: number, y: number): ZoneNpc | null;
    private drop;
    destroy(): void;
}
