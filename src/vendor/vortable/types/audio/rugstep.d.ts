/** Meio segundo de ruído marrom (graves fortes, agudos fracos), feito uma vez. */
export declare function brownNoise(ctx: BaseAudioContext): AudioBuffer;
/** Toca um passo no tapete em `dest` (calcanhar e, logo depois, a ponta do pé). */
export declare function softRugStep(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, when: number, volume: number): void;
