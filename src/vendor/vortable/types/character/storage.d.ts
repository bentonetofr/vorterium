import type { Appearance, CharacterSave } from '../types';
export interface CharacterStorage {
    list(): Promise<CharacterSave[]>;
    save(c: CharacterSave): Promise<void>;
    remove(id: string): Promise<void>;
    /** Personagem usado pra testar/jogar neste navegador. */
    getActive(): Promise<string | null>;
    setActive(id: string | null): Promise<void>;
}
export declare function newCharacter(name: string, appearance: Appearance): CharacterSave;
/** Confere um personagem lido do armazenamento (aparência v2). */
export declare function parseCharacter(json: unknown): CharacterSave | null;
export declare class LocalCharacterStorage implements CharacterStorage {
    private readonly key;
    private readonly activeKey;
    constructor(space?: string);
    private read;
    list(): Promise<CharacterSave[]>;
    save(c: CharacterSave): Promise<void>;
    remove(id: string): Promise<void>;
    getActive(): Promise<string | null>;
    setActive(id: string | null): Promise<void>;
}
