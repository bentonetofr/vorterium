import Phaser from 'phaser';
import type { Dir } from '../types';
export declare class Player {
    private charKey;
    private dir;
    readonly sprite: Phaser.Physics.Arcade.Sprite;
    private keys;
    /** Parado à força (trocando de zona, cutscene): ignora o teclado. */
    frozen: boolean;
    /** Travado de fora (o mestre cobriu a tela do jogador): ignora o teclado, sem mexer no `frozen` das transições. */
    locked: boolean;
    constructor(scene: Phaser.Scene, charKey: string, x: number, y: number, dir?: Dir);
    /** Troca a aparência (as texturas foram regeradas com a mesma chave). */
    refresh(): void;
    get facing(): Dir;
    /** Retângulo do pé (o que colide e o que pisa nas saídas), em px do mundo. */
    get foot(): {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    update(): void;
    private play;
}
/** O foco está num campo de texto? */
export declare function isTyping(): boolean;
