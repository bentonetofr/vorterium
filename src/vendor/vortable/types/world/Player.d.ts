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
    /** Velocidade em relação à normal (o rato é um pouco mais ligeiro). */
    speedScale: number;
    /** Caixa dos pés em px do mundo (a escala do boneco não muda o que ele ocupa no chão). */
    private feet;
    private heightScale;
    constructor(scene: Phaser.Scene, charKey: string, x: number, y: number, dir?: Dir);
    /** Troca de boneco (outra chave de texturas) sem mexer na posição. */
    setSkin(charKey: string): void;
    /** Caixa de colisão dos pés (a do boneco é 18×10; a de um rato é bem menor). */
    setFeetBox(w: number, h: number): void;
    /** Altura do boneco (1 = normal): escala em volta dos pés, sem mudar a caixa de colisão no chão. */
    setHeight(scale: number): void;
    private applyFeet;
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
    /** Animação em curso (a rede conta isso pros outros). */
    get animName(): "idle" | "run" | "walk";
    private current;
    private play;
}
/** O foco está num campo de texto? */
export declare function isTyping(): boolean;
