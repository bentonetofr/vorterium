import Phaser from 'phaser';
import { type WorldSky, type ZoneData } from '../types';
import { Wind } from './wind';
export declare const BLOB = "light:blob";
/** Quem mais faz sombra além dos objetos (os bonecos): quadro atual e os pés. */
export interface ExtraCaster {
    key: string;
    frame: string | number;
    x: number;
    y: number;
    /** Onde ficam os pés no quadro (0–1, de cima). */
    originY: number;
    flipX?: boolean;
}
export interface LightingView {
    x: number;
    y: number;
    w: number;
    h: number;
    zoom: number;
}
export declare class Lighting {
    private scene;
    private zone;
    private dark;
    private glow;
    private shade;
    /** Sombra de nuvens e cantos do pôr do sol: multiplicam a cena, por baixo da escuridão. */
    private cloudShade;
    private vignette;
    /** Manchas de sol entre as folhas, passando devagar (dia aberto). */
    private dapple;
    private particles;
    private live;
    private windows;
    private casters;
    private emission;
    private occ;
    /** Texturas de luz recortadas, por posição/raio/paredes (reaproveitadas entre rebuilds). */
    private masks;
    private serial;
    private time;
    readonly wind: Wind;
    private weather;
    /** O tempo usado no último quadro (o som acompanha). */
    weatherNow: import("./weather").WeatherDef;
    private trees;
    private water;
    /** Desligada (editor: "ver iluminação" desmarcado) = tudo claro, sem sombras. */
    enabled: boolean;
    /** Hora forçada (prévia do editor); null = a da zona. */
    hourOverride: number | null;
    /** Ajuste ao vivo do mestre (hora, tempo, vento); cada campo null = o padrão da zona. */
    liveEnv: {
        hour: number | null;
        weather: string | null;
        wind: number | null;
    } | null;
    /** Deslocamento do relógio do mundo, em ms (o teste do editor começa na hora da prévia). */
    timeOffset: number;
    /** Hora e tempo do mundo: os mesmos em todas as zonas. */
    sky: WorldSky;
    /** Bonecos que fazem sombra. */
    extraCasters: () => ExtraCaster[];
    /** Relâmpagos que já caíram. */
    get strikes(): number;
    /** Hora usada no último quadro. */
    hour: number;
    constructor(scene: Phaser.Scene, zone: ZoneData);
    /**
     * Camadas do tamanho da tela. Recriadas quando a tela muda: uma
     * RenderTexture redimensionada no Phaser 3.90 para de receber desenhos.
     */
    private resize;
    destroy(): void;
    setZone(zone: ZoneData): void;
    /**
     * Relê luzes, janelas, sombras e brilho do chão da zona. `walls` = recorta
     * as luzes pelas paredes (mais lento; o editor desliga enquanto arrasta).
     */
    rebuild(walls?: boolean): void;
    /**
     * Raios de luz atravessando o mapa. São do CENÁRIO: ficam em linhas fixas do
     * mundo (só a luz oscila), e a câmera passa por eles — não andam colados no
     * boneco. `skip` = fração de faixas sem raio; `seed` muda o sorteio.
     */
    private rays;
    /** Onde tem água (os reflexos piscam ali). */
    private findWater;
    /** Brilho do chão (lava, água venenosa): um mapa pequeno, borrado e esticado. */
    private buildEmission;
    /** Área do mundo que a câmera mostra agora (a câmera dá zoom em volta do centro). */
    private view;
    /**
     * Desenha as três camadas. Chame no PRE_RENDER da cena, depois de a
     * câmera chegar na posição final do quadro (senão a luz "atrasa").
     */
    render(delta: number): void;
}
