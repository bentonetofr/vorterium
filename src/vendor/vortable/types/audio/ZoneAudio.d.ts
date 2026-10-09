import Phaser from 'phaser';
import type { TerrainDef } from '../assets/terrains';
import { type ZoneData, type ZoneSound } from '../types';
import type { WeatherDef } from '../world/weather';
import { AudioEngine } from './engine';
import { type LayerId } from './ambience';
import { type Surface } from './steps';
export interface AudioFrame {
    /** Quem escuta (o jogador; no editor, o meio da tela). */
    x: number;
    y: number;
    hour: number;
    wind: number;
    weather: WeatherDef;
    /** Relâmpagos até agora (cada novo vira um trovão). */
    strikes: number;
}
/** O som da zona: o que está salvo, ou o automático. */
export declare function soundOf(zone: ZoneData): ZoneSound;
export declare class ZoneAudio {
    private engine;
    private zone;
    private layers;
    private fires;
    private torches;
    private water;
    private swamp;
    private steps;
    private trees;
    private strikes;
    private pending;
    private stepSide;
    private nearCache;
    /** Silencia tudo (editor com a prévia de som desligada). */
    enabled: boolean;
    /** Sons ao vivo do mestre (Controle): valem no lugar do som salvo da zona. null = o da zona. */
    live: ZoneSound | null;
    constructor(engine: AudioEngine, zone: ZoneData);
    static create(scene: Phaser.Scene, zone: ZoneData): ZoneAudio | null;
    setZone(zone: ZoneData): void;
    /** Nível de cada camada agora (pro painel mostrar). */
    levels(): Partial<Record<LayerId, number>>;
    /** Ouvir um passo num chão (botões do painel). */
    previewStep(surface: Surface): void;
    /** Ouvir um trovão agora (botão do painel). */
    thunderNow(): void;
    update(dt: number, f: AudioFrame): void;
    /** Fogo e água mais perto (volume pela distância, lado pelo x), recalculado a cada 0,2 s. */
    private near;
    /** Um passo em (x, y): o chão decide o timbre; chuva molha, neve cobre. */
    step(x: number, y: number, running: boolean, weather: WeatherDef): void;
    destroy(): void;
}
/** Que chão está sob os pés: tapete/moldura por cima, senão o terreno do vértice mais perto. */
export declare function surfaceAt(zone: ZoneData, x: number, y: number): Surface;
/** O timbre de cada terreno, pelo nome/categoria. */
export declare function surfaceOf(t: TerrainDef): Surface;
