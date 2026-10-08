export interface TerrainDef {
    id: string;
    label: string;
    category: string;
    block: [band: number, col: number];
    rank: number;
    /** Não dá pra andar por cima (água, lava, buraco, parede). */
    solid?: boolean;
    /**
     * Bloqueia também em volta de cada vértice que encosta em outro terreno
     * (o vazio dos interiores: sem isso, a parede fina entre dois cômodos —
     * uma linha de vértices vazios — seria só desenho).
     */
    edgeSolid?: boolean;
    /** Pode ser o fundo da zona (padrão: só os que não são sólidos). */
    canBeBase?: boolean;
    /** Quadros de variação do miolo que existem na folha (padrão 15, 16, 17). */
    fills?: number[];
    /**
     * Terreno GERADO no navegador a partir de uma textura de 32×32 que se
     * repete (pisos, paredes) ou de uma cor: bordas retas, sem franja.
     * O bloco dele fica na textura TERRAIN_GEN_TEXTURE.
     */
    gen?: {
        url: string;
        x: number;
        y: number;
        size?: 32 | 64;
    } | {
        color: string;
    };
    /** Pacote de onde veio (terrenos de pacote). */
    pack?: string;
    /** Folha própria (terrenos de pacote): id em catalog/terrains.json. */
    sheet?: string;
    /** Bloco LPC (3×6 ou 3×7) na folha própria: canto de cima à esquerda, px. */
    origin?: [number, number];
    /** Autotile do Tiled: máscara de cantos → tiles [x, y] na folha própria. */
    wang?: Record<number, [number, number][]>;
    /** Cerca (camada de tiles): bordas ligadas (cima=1, dir=2, baixo=4, esq=8) → tiles [x, y]. */
    fence?: Record<number, [number, number][]>;
    /** Tile da miniatura (wang, cerca). */
    thumb?: [number, number];
    layer?: 'ground' | 'overlay' | 'fence';
    /** Brilha no escuro (lava, água venenosa): cor e força do brilho. */
    glow?: {
        color: string;
        intensity: number;
    };
}
export interface TerrainCatalog {
    sheets: {
        id: string;
        pack: string;
        url: string;
    }[];
    terrains: TerrainDef[];
}
export declare const TERRAIN_CATALOG_URL = "catalog/terrains.json";
export declare const terrainSheetTexture: (sheet: string) => string;
export declare const TERRAIN_TEXTURE = "terrain";
export declare const TERRAIN_GEN_TEXTURE = "terrain-gen";
export declare const TERRAIN_URL = "lpc/terrain.png";
export declare const TERRAINS: TerrainDef[];
/** Blocos por linha na textura dos terrenos gerados. */
export declare const GEN_COLS = 16;
export declare const terrainById: Map<string, TerrainDef>;
/** Terrenos gerados no navegador; cada um ganha um bloco na textura gerada (grade de GEN_COLS). */
export declare function genTerrains(): TerrainDef[];
/** Imagens de onde os terrenos gerados tiram a textura. */
export declare function genSources(): string[];
/** Entram os terrenos dos pacotes (uma vez, no carregamento). */
export declare function addTerrains(list: TerrainDef[]): void;
export declare const isOverlay: (t: TerrainDef) => boolean;
export declare const isFence: (t: TerrainDef) => boolean;
export declare function terrainTexture(t: TerrainDef): string;
export declare const canBeBase: (t: TerrainDef) => boolean;
/** Nome do quadro `n` (0..20) do terreno na textura. */
export declare function terrainFrame(id: string, n: number): string;
/** Posição do quadro `n` do bloco na folha. */
export declare function terrainFrameRect(t: TerrainDef, n: number): {
    x: number;
    y: number;
};
/** Nome do quadro de um tile de autotile (wang) na folha. */
export declare const wangFrame: (x: number, y: number) => string;
/** Retângulo da miniatura de um terreno (textura + posição). */
export declare function terrainThumb(t: TerrainDef): {
    x: number;
    y: number;
};
