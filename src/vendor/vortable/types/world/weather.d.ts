import Phaser from 'phaser';
import type { RGB } from './daylight';
import type { Wind } from './wind';
export type WeatherId = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'storm' | 'lightsnow' | 'snow' | 'blizzard';
export interface WeatherDef {
    label: string;
    /** Quanto do céu está coberto (0–1): sombra de nuvens e nuvens visíveis. */
    cover: number;
    /** Escurece a luz do dia (0–1) e tira cor (0–1). */
    dim: number;
    desat: number;
    /** Puxa a luz pra essa cor (neve: azulada). */
    tint?: string;
    /** Força do sol (sombras): 1 = limpo, 0 = encoberto. */
    sun: number;
    /** 0–1. */
    rain: number;
    snow: number;
    fog: number;
    fogColor: number;
    /** Nuvens no céu, cinza nas de chuva. */
    skyColor: number;
    /** Vento mínimo (tempestade e nevasca sopram forte). */
    minWind: number;
    lightning: boolean;
}
export declare const WEATHERS: Record<WeatherId, WeatherDef>;
export declare const WEATHER_ORDER: WeatherId[];
export declare function weatherOf(id: string | undefined): WeatherDef;
/** A luz do dia passando pelas nuvens: mais escura, menos colorida, às vezes azulada. */
export declare function weatherAmbient(a: RGB, w: WeatherDef, amount?: number): RGB;
export declare const CLOUD_SIZE = 256;
/** Um ladrilho da textura de nuvens cobre isso do mundo (px). */
export declare const CLOUD_TILE = 1024;
/**
 * Texturas das nuvens pra uma cobertura: a SOMBRA (opaca, cinza no branco,
 * pra multiplicar a luz) e o CÉU (branco com alfa, pra passar por cima).
 */
export declare function cloudTextures(scene: Phaser.Scene, cover: number): {
    shadow: string;
    sky: string;
    mist: string;
};
export interface WeatherFrame {
    view: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    def: WeatherDef;
    wind: Wind;
    /** Ao ar livre (dentro de casa não chove nem neva). */
    outdoor: boolean;
    /** Pra onde cai a sombra (radianos, 0 = pra baixo): a nuvem fica do outro lado. */
    sunAngle: number;
    /** Brilho das nuvens de dia/noite (de noite somem no escuro). */
    day: number;
    /** Névoa baixa do amanhecer (0–1), rosada, mesmo com o céu limpo. */
    mist: number;
    /** Cor da névoa baixa (rosa no amanhecer, azul de noite). */
    mistTint?: number;
    /** Onde está o desenho das nuvens agora (o mesmo da sombra delas). */
    cloudX: number;
    cloudY: number;
}
export declare class WeatherFx {
    private scene;
    private drops;
    private flakes;
    private splashes;
    private spare;
    private sky?;
    private fog?;
    private time;
    private nextStrike;
    /** Relâmpago agora (0–1): a luz clareia por um instante. */
    flash: number;
    /** Quantos relâmpagos já caíram (o som do trovão acompanha). */
    strikes: number;
    private strike;
    constructor(scene: Phaser.Scene);
    private take;
    private give;
    clear(): void;
    destroy(): void;
    update(dt: number, f: WeatherFrame): void;
    /** Ladrilho que cobre a tela, preso ao mundo e deslizando (ox, oy) px. */
    private tile;
    private newDrop;
    private newFlake;
}
