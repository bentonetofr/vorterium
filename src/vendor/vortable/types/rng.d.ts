/** Número pseudoaleatório estável pra uma posição (mesma posição → mesmo valor). */
export declare function hash2(x: number, y: number): number;
/** Gerador com semente (mulberry32): mesma semente → mesma sequência. */
export declare function seeded(seed: number): () => number;
