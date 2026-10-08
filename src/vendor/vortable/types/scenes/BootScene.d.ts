import Phaser from 'phaser';
export declare class BootScene extends Phaser.Scene {
    private assetBase;
    private onReady;
    constructor(assetBase: string, onReady: () => void);
    private failed;
    private status?;
    preload(): void;
    /** Sem a arte básica não dá pra montar nada: mostra o que faltou e para. */
    private fail;
    create(): void;
    private registerTerrains;
}
