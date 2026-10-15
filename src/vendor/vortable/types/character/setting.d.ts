import type { CharItem, CharacterData } from './catalog';
/** 'medieval' = fantasia/Idade Média · 'modern' = atual/apocalipse · ausente = tudo. */
export type CharacterSetting = 'medieval' | 'modern';
/** A peça combina com a ambientação? */
export declare function fitsSetting(item: CharItem, setting: CharacterSetting | undefined): boolean;
/**
 * Uma cópia do catálogo só com as peças da ambientação. É um catálogo novo (o
 * original fica intacto, ele é compartilhado): `normalizeAppearance` com ele tira
 * do personagem aberto o que não combina.
 */
export declare function restrictData(data: CharacterData, setting: CharacterSetting | undefined): CharacterData;
