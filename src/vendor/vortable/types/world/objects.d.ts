import Phaser from 'phaser';
import { type ObjectCatalog } from '../assets/objects';
import type { ZoneObject } from '../types';
export type ObjectSprite = Phaser.GameObjects.Sprite;
/**
 * Registra os quadros e animações das peças nas folhas já carregadas. Pode
 * rodar de novo depois da curadoria (refaz as animações, mantém o resto).
 */
export declare function registerObjectArt(scene: {
    textures: Phaser.Textures.TextureManager;
    anims: Phaser.Animations.AnimationManager;
}, catalog: ObjectCatalog): void;
/**
 * Sprite de um objeto. Objeto que não está no catálogo (arte removida, zona
 * de outra versão): `missing` decide — no jogo some, no editor vira um
 * quadrado de aviso que dá pra selecionar e apagar.
 */
export declare function createObjectSprite(scene: Phaser.Scene, o: ZoneObject, missing?: 'skip' | 'placeholder'): ObjectSprite | null;
/** Reaplica posição/espelho/arte de um sprite (arrastar, espelhar, trocar variante no editor). */
export declare function updateObjectSprite(s: ObjectSprite, o: ZoneObject): void;
/** Corpos estáticos invisíveis nos retângulos de colisão dos objetos. */
export declare function addObjectSolids(scene: Phaser.Scene, objects: ZoneObject[], solids: Phaser.Physics.Arcade.StaticGroup): void;
/**
 * Objetos que ficam transparentes quando escondem o jogador: telhados e
 * copas (por cima) sempre que ele está embaixo; árvores e móveis altos
 * (em pé) quando ele passa por trás.
 */
export declare class Occluders {
    private list;
    add(s: ObjectSprite | null, o: ZoneObject): void;
    /** (x, y) = pés do jogador; o corpo dele ocupa ~16px pros lados e ~40px pra cima. */
    update(x: number, y: number): void;
}
