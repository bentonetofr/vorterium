import Phaser from 'phaser';
/** Quanto a imagem ampliada é maior que a original (2 passadas = 4×). */
export declare const HI_SCALE: number;
/** Chave de textura sem o sufixo da animação: "char:r:abc:walk" → "char:r:abc". */
export declare function baseKey(textureKey: string): string;
/**
 * A versão ampliada do boneco parado, de frente (2 quadros). Devolve a textura e a animação, ou null se
 * este boneco não tem folha de "parado" (ex.: o rato), caso em que quem chama usa o desenho normal.
 */
export declare function hiResFront(scene: Phaser.Scene, base: string): {
    texture: string;
    anim: string;
} | null;
/**
 * Câmera de conversa: o cenário fica atrás (desfocado pela interface) com os dois personagens à vista, e os
 * retratos grandes vão por cima, em tela. Aqui, o quanto de chão aparece em volta dos dois (px do mundo) e os
 * limites do zoom.
 */
export declare const CINEMA_WIDE: {
    padX: number;
    padY: number;
    minZoom: number;
    maxZoom: number;
};
