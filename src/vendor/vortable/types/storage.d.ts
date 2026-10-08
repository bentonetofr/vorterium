import { type WorldData, type ZoneData } from './types';
export interface ZoneSummary {
    id: string;
    name: string;
    width: number;
    height: number;
    updatedAt: number;
    /** Zonas pra onde as saídas desta levam (pro mapa do mundo, sem abrir cada zona). */
    links: string[];
    /** Saídas desta zona (pra escolher o destino de uma saída sem abrir a zona). */
    portals: {
        id: string;
        name: string;
    }[];
}
export interface WorldStorage {
    /** Dados do mundo; se ainda não existe, devolve um mundo novo (sem salvar). */
    loadWorld(): Promise<WorldData>;
    saveWorld(world: WorldData): Promise<void>;
    list(): Promise<ZoneSummary[]>;
    load(id: string): Promise<ZoneData | null>;
    save(zone: ZoneData): Promise<void>;
    remove(id: string): Promise<void>;
}
export declare function summarize(zone: ZoneData, updatedAt?: number): ZoneSummary;
export declare function newWorld(name?: string): WorldData;
/**
 * Mundo no localStorage do navegador. `space` separa mundos diferentes
 * no mesmo navegador; o padrão ('') usa as mesmas chaves do M1, então as
 * zonas salvas antes continuam aparecendo.
 */
export declare class LocalWorldStorage implements WorldStorage {
    private readonly zoneKey;
    private readonly indexKey;
    private readonly worldKey;
    constructor(space?: string);
    private readIndex;
    private writeIndex;
    loadWorld(): Promise<WorldData>;
    saveWorld(world: WorldData): Promise<void>;
    list(): Promise<ZoneSummary[]>;
    load(id: string): Promise<ZoneData | null>;
    save(zone: ZoneData): Promise<void>;
    remove(id: string): Promise<void>;
}
/** localStorage pode estar bloqueado (aba anônima, cookies desligados). */
export declare function localStorageAvailable(): boolean;
/**
 * Confere um JSON importado e devolve uma zona utilizável. Recusa o que
 * quebraria o motor (tamanho fora do limite, grade com tamanho errado);
 * conserta o que dá (objetos/saídas malformados são descartados, início
 * fora da zona volta pro meio).
 */
export declare function parseZone(json: unknown): ZoneData;
export declare function parseWorld(json: unknown): WorldData;
