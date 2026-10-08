import Phaser from 'phaser';
import { readPrefs, writePrefs } from './prefs';
export type Room = 'none' | 'room' | 'cave';
/** Onde ficam os assets (mountVortable avisa). */
export declare function setAudioBase(assetBase: string): void;
/** Um som carregado e os pontos de laço (sem o silêncio que o MP3 põe nas pontas). */
export interface Clip {
    buffer: AudioBuffer;
    start: number;
    end: number;
}
export declare class AudioEngine {
    readonly ctx: AudioContext;
    readonly master: GainNode;
    /** Entrada sem eco (cada som decide quanto manda pro eco também). */
    readonly dry: GainNode;
    readonly reverbSend: GainNode;
    private reverb;
    private room;
    private irs;
    private clips;
    /** O motor do jogo (um por jogo); null se o navegador não tem Web Audio. */
    static of(scene: Phaser.Scene): AudioEngine | null;
    private constructor();
    get now(): number;
    /** Som destravado e tocando (o navegador só deixa depois de um clique/tecla). */
    get running(): boolean;
    applyPrefs(): void;
    /** Eco do lugar: nenhum (ao ar livre), sala, caverna. */
    setRoom(room: Room): void;
    /** Resposta de eco gerada: ruído que se apaga (curto na sala, longo na caverna). */
    private ir;
    /** Carrega (uma vez) audio/<nome>.mp3. null = não deu (sem rede, arquivo faltando). */
    clip(name: string): Promise<Clip | null>;
    /** Toca um som uma vez. */
    play(clip: Clip, dest: AudioNode, volume?: number, rate?: number, at?: number): AudioBufferSourceNode;
    filter(type: BiquadFilterType, freq: number, q?: number): BiquadFilterNode;
    gain(v?: number): GainNode;
    /** Saída de um som: seco no master e uma parte no eco. */
    out(node: AudioNode, reverb?: number, pan?: number): void;
}
export { readPrefs, writePrefs };
