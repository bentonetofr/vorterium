import type { Appearance, ZoneNpc } from '../types';
/** O corpo (peça do criador de personagem) que faz um NPC ser um cavalo. */
export declare const HORSE_BODY = "tlou/body/cavalo";
/** Até que distância (px) do cavalo o botão de montar aparece. */
export declare const MOUNT_RANGE = 46;
/** Quão mais rápido o cavalo é (em relação ao boneco a pé). */
export declare const HORSE_SPEED = 1.6;
/** Quanto o cavaleiro sobe (px) em cima do cavalo, pra o quadril ficar na altura do lombo. */
export declare const RIDER_LIFT = 17;
/** Caixa dos pés do cavalo (px do mundo): mais comprida que a do boneco. */
export declare const HORSE_FEET: {
    w: number;
    h: number;
};
export declare const isHorseAppearance: (a: Appearance | undefined | null) => boolean;
export declare const isHorse: (n: ZoneNpc) => boolean;
/** O cavalo mais perto de (x, y) dentro do alcance, ignorando os que já estão montados. */
export declare function nearestHorse(npcs: readonly ZoneNpc[], x: number, y: number, skip: ReadonlySet<string>): ZoneNpc | null;
/** O cavaleiro fica atrás do cavalo só quando olha pra frente (o cavalo vem de frente, com a cabeça na frente dele). */
export declare const riderDepthOffset: (dir: string) => -0.2 | 0.2;
/** O botão solto por cima do jogo: Montar / Desmontar. */
export declare class MountButton {
    private el;
    private label;
    constructor(parent: HTMLElement, onClick: () => void);
    /** Mostra o botão com este texto (a tecla E aparece ao lado, no PC). */
    show(label: string): void;
    hide(): void;
    destroy(): void;
}
