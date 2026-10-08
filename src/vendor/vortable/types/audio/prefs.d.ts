export interface SoundPrefs {
    master: number;
    muted: boolean;
    steps: number;
    /** O editor toca o som da zona (prévia). */
    editor: boolean;
}
export declare function readPrefs(): SoundPrefs;
export declare function writePrefs(patch: Partial<SoundPrefs>): SoundPrefs;
