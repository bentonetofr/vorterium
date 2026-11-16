/** Chave do recurso no Painel de controle (nasce guardado). */
export const DH_FEATURE = 'daggerheart'

/** Identificador do sistema nas campanhas. */
export const DH_SYSTEM = 'daggerheart'

/** Atribuição exigida pela licença CC-BY-4.0 do SRD 2.0. */
export const DH_SRD_ATTRIBUTION =
  'This work includes material taken from the Daggerheart System Reference Document 2.0 ("Daggerheart SRD 2.0") ' +
  'by Darrington Press LLC and available at https://www.daggerheart.com/srd/. ' +
  'The Daggerheart SRD 2.0 is licensed under the Creative Commons Attribution 4.0 International License ' +
  'available at https://creativecommons.org/licenses/by/4.0/legalcode.'

/** Nível mínimo e máximo de personagem (SRD 2.0 vai até 10). */
export const DH_MIN_LEVEL = 1
export const DH_MAX_LEVEL = 10

/** Esperança: valor inicial e máximo. */
export const DH_HOPE_START = 2
export const DH_HOPE_MAX   = 6

/** Estresse: valor inicial e máximo. */
export const DH_STRESS_START = 6
export const DH_STRESS_MAX   = 12

/** HP máximo em slots. */
export const DH_HP_MAX_SLOTS = 12

/** Proficiência inicial. */
export const DH_PROFICIENCY_START = 1

/** Medo do Mestre: máximo de tokens. */
export const DH_GM_FEAR_MAX = 12

/** Nomes dos traços em PT-BR para exibição. */
export const DH_TRAIT_LABELS: Record<string, string> = {
  agility:   'Agilidade',
  strength:  'Força',
  finesse:   'Destreza',
  instinct:  'Instinto',
  presence:  'Presença',
  knowledge: 'Conhecimento',
}

/** Nomes dos domínios em PT-BR para exibição. */
export const DH_DOMAIN_LABELS: Record<string, string> = {
  arcana:    'Arcana',
  blade:     'Lâmina',
  bone:      'Osso',
  codex:     'Códice',
  grace:     'Graça',
  midnight:  'Meia-Noite',
  sage:      'Sábio',
  splendor:  'Esplendor',
  valor:     'Valor',
  wanderer:  'Andarilho',
}

/** Nomes das classes em PT-BR para exibição. */
export const DH_CLASS_LABELS: Record<string, string> = {
  assassin: 'Assassino',
  bard:     'Bardo',
  brawler:  'Brigão',
  druid:    'Druida',
  guardian: 'Guardião',
  ranger:   'Patrulheiro',
  rogue:    'Ladino',
  seraph:   'Serafim',
  sorcerer: 'Feiticeiro',
  warlock:  'Bruxo',
  warrior:  'Guerreiro',
  witch:    'Bruxa',
  wizard:   'Mago',
}
