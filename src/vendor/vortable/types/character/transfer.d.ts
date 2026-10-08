import type { CharacterSave } from '../types';
import { type CharacterData } from './catalog';
export declare const CHARACTER_FORMAT = "vortable-character";
/** O arquivo com um ou mais personagens, pronto pra gravar. */
export declare function exportCharacters(list: Pick<CharacterSave, 'name' | 'appearance'>[]): string;
/** Nome de arquivo seguro: "Maria da Silva" → "maria-da-silva.vortable-personagem.json". */
export declare function characterFileName(name: string): string;
/**
 * Lê o conteúdo de um arquivo de personagem (texto JSON ou já convertido).
 * Devolve os personagens com ids novos; lança um erro em português se não for um arquivo válido.
 */
export declare function parseCharacterFile(raw: unknown, data?: CharacterData): CharacterSave[];
/** Baixa um texto como arquivo (navegador). */
export declare function downloadText(filename: string, text: string, type?: string): void;
/** Abre o seletor de arquivo e devolve o texto do escolhido (null se cancelar). */
export declare function pickTextFile(accept?: string): Promise<string | null>;
