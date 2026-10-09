import Phaser from 'phaser';
export declare class BootScene extends Phaser.Scene {
    private assetBase;
    private onReady;
    constructor(assetBase: string, onReady: () => void);
    private failed;
    /** O cavaleiro correndo, por cima do palco enquanto a arte carrega. */
    private cover?;
    preload(): void;
    /** Sem a arte básica não dá pra montar nada: mostra o que faltou e para. */
    private fail;
    private dropCover;
    create(): void;
    private registerTerrains;
}
