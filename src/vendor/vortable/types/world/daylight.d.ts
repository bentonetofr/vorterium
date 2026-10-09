import { type WorldSky, type ZoneLighting } from '../types';
export type RGB = [number, number, number];
export declare const UNDERGROUND_TINT = "#2a2e3c";
/** Luz de uma zona que nunca foi ajustada: interior se o fundo é o vazio, senão ao ar livre. */
export declare function lightingOf(zone: {
    lighting?: ZoneLighting;
    base?: string;
}): ZoneLighting;
/** Hora e tempo do mundo (iguais em todas as zonas); mundo sem ajuste = ciclo dia/noite, tempo limpo. */
export declare function skyOf(world?: {
    sky?: WorldSky;
} | null): WorldSky;
export declare function hexToRgb(hex: string): RGB;
export declare function rgbToInt([r, g, b]: RGB): number;
/** Quanto de sol há (0 = noite, 1 = dia pleno), suave na aurora e no pôr do sol. */
export declare function daylight(hour: number): number;
/** Cor da luz ambiente da zona naquela hora. */
export declare function ambientAt(l: ZoneLighting, hour: number): RGB;
/** Quão escuro está (0 = claro, 1 = breu): decide o brilho extra das luzes. */
export declare function darkness(ambient: RGB): number;
/**
 * Sol: direção da sombra (radianos; 0 = pra baixo, + = pra esquerda) e
 * comprimento (escala da silhueta). De manhã a sombra cai pra oeste
 * (esquerda) e é longa; ao meio-dia é curta; à tarde vai pro leste.
 */
/**
 * Hora dourada (0–1): o amanhecer (~5h–8h, pico 6h30) e o entardecer
 * (~16h30–20h, pico 18h20). É quando a luz esquenta, as sombras esticam
 * e o céu ganha cor.
 */
/**
 * Semi noite (0–1): a "hora azul" entre o pôr do sol e a noite (pico 19h35)
 * e entre a noite e a aurora (pico 5h20). O mapa fica num gradiente: o lado
 * do sol ainda rosado e claro, o lado oposto já azul-noite.
 */
export declare function twilight(hour: number): number;
/** Noite de verdade (0–1): do fim do crepúsculo (20h30) até a aurora (~5h). */
export declare function nightAmount(hour: number): number;
/** Dia aberto, sem hora dourada (0–1): manhã, meio-dia e tarde. */
export declare function sunny(hour: number): number;
/**
 * Lua: ângulo da sombra e comprimento. Nasce no leste às 18h, passa em cima
 * à meia-noite (sombra curta, pra baixo) e se põe no oeste às 6h.
 */
export declare function moonAt(hour: number): {
    angle: number;
    length: number;
};
export declare function golden(hour: number): number;
/**
 * Sol: direção da sombra (radianos; 0 = pra baixo, + = pra esquerda) e
 * comprimento (escala da silhueta). De manhã a sombra cai pra oeste
 * (esquerda) e é longa; ao meio-dia é curta; à tarde vai pro leste.
 * `strength` é a força da sombra: existe do nascer ao pôr do sol, mesmo
 * quando a luz ainda é fraca (as sombras compridas do amanhecer).
 */
export declare function sunAt(hour: number): {
    angle: number;
    length: number;
    strength: number;
};
/** Posição (0–1) da hora no ciclo do relógio real. */
export declare function hourToCycle(hour: number): number;
export declare function worldHour(dayMinutes?: number, now?: number): number;
/** Hora do mundo agora (a mesma em todas as zonas): a fixa, ou a do ciclo. */
export declare function skyHour(sky: WorldSky, now?: number): number;
export declare function formatHour(hour: number): string;
/** Presets de lugar do painel Luz (valem só pra zona aberta). */
export declare const LIGHT_PRESETS: {
    id: string;
    label: string;
    lighting: ZoneLighting;
}[];
/** Presets de hora do painel Luz (valem pro mundo todo). */
/** Durações do dia no ciclo (minutos reais). */
export declare const DAY_LENGTHS: number[];
/** Amostra de cor de uma hora do mundo (no ciclo, dois tons: dia e noite). */
export declare function skySwatch(hour: number | null): string;
export declare const SKY_PRESETS: {
    id: string;
    label: string;
    hour: number | null;
}[];
