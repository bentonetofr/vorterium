import type { FeatureEntry, RaceDef } from './types'

// ────────────────────────────────────────────────────────
// Raças do SRD 5.1 (9 raças). Nomes em português do livro brasileiro,
// resumos próprios. Deslocamento em pés (canônico); a tela converte para
// metros (30 pés = 9 m). Idiomas e proficiências conforme o SRD.
// ────────────────────────────────────────────────────────

function t(key: string, name: string, original: string, summary: string): FeatureEntry {
  return { level: 1, key, name, original, summary }
}

const darkvision = t('darkvision', 'Visão no Escuro', 'Darkvision', 'Enxerga na penumbra a até 18 metros como se fosse luz plena, e no escuro como se fosse penumbra, mas só em tons de cinza.')
const feyAncestry = t('fey_ancestry', 'Ancestral Feérico', 'Fey Ancestry', 'Vantagem em salvaguardas contra ser enfeitiçado, e magia não consegue colocar você para dormir.')

export const RACES: RaceDef[] = [
  {
    key: 'dwarf', name: 'Anão', original: 'Dwarf',
    summary: 'Resistentes, tradicionais e ótimos artesãos, acostumados à vida subterrânea.',
    abilityBonuses: { constitution: 2 },
    size: 'medium', speed: 25, darkvision: 60,
    languages: ['Comum', 'Anão'], extraLanguages: 0,
    skills: [], weaponProficiencies: ['battleaxe', 'handaxe', 'light_hammer', 'warhammer'],
    toolChoice: ['smith_tools', 'brewers_supplies', 'masons_tools'],
    resistances: ['poison'],
    traits: [
      t('dwarf_speed', 'Deslocamento Resistente', 'Speed', 'Seu deslocamento não é reduzido por usar armadura pesada.'),
      darkvision,
      t('dwarven_resilience', 'Resiliência Anã', 'Dwarven Resilience', 'Vantagem em salvaguardas contra veneno e resistência a dano de veneno.'),
      t('dwarven_combat_training', 'Treinamento Anão em Combate', 'Dwarven Combat Training', 'Proficiência com machado de batalha, machado de mão, martelo leve e martelo de guerra.'),
      t('dwarf_tool_proficiency', 'Proficiência com Ferramentas', 'Tool Proficiency', 'Proficiência com uma ferramenta de artesão à escolha: ferramentas de ferreiro, suprimentos de cervejeiro ou ferramentas de pedreiro.'),
      t('stonecunning', 'Especialista em Rochas', 'Stonecunning', 'Em testes de Inteligência (História) sobre a origem de trabalhos em pedra, conta como proficiente e soma o dobro da proficiência.'),
    ],
    subraces: [
      {
        key: 'hill_dwarf', name: 'Anão da Colina', original: 'Hill Dwarf',
        summary: 'Sentidos aguçados, intuição profunda e resistência notável.',
        abilityBonuses: { wisdom: 1 }, hpBonusPerLevel: 1,
        traits: [t('dwarven_toughness', 'Vigor Anão', 'Dwarven Toughness', 'Seu PV máximo aumenta em 1 e aumenta em 1 a cada nível que você ganha.')],
      },
    ],
  },
  {
    key: 'elf', name: 'Elfo', original: 'Elf',
    summary: 'Graciosos e longevos, com sentidos apurados e afinidade com a magia.',
    abilityBonuses: { dexterity: 2 },
    size: 'medium', speed: 30, darkvision: 60,
    languages: ['Comum', 'Élfico'], extraLanguages: 0,
    skills: ['perception'], weaponProficiencies: [], resistances: [],
    traits: [
      darkvision,
      t('keen_senses', 'Sentidos Aguçados', 'Keen Senses', 'Proficiência na perícia Percepção.'),
      feyAncestry,
      t('trance', 'Transe', 'Trance', 'Elfos não dormem: meditam por 4 horas por dia, e isso vale como 8 horas de sono.'),
    ],
    subraces: [
      {
        key: 'high_elf', name: 'Alto Elfo', original: 'High Elf',
        summary: 'Mente aguçada e domínio básico da magia.',
        abilityBonuses: { intelligence: 1 },
        weaponProficiencies: ['longsword', 'shortsword', 'shortbow', 'longbow'],
        extraLanguages: 1,
        cantripChoice: { classKey: 'wizard', count: 1, ability: 'intelligence' },
        traits: [
          t('elf_weapon_training', 'Treinamento Élfico com Armas', 'Elf Weapon Training', 'Proficiência com espada longa, espada curta, arco curto e arco longo.'),
          t('high_elf_cantrip', 'Truque', 'Cantrip', 'Você conhece um truque de mago à sua escolha. Inteligência é seu atributo de conjuração para ele.'),
          t('high_elf_extra_language', 'Idioma Adicional', 'Extra Language', 'Fala, lê e escreve um idioma extra à sua escolha.'),
        ],
      },
    ],
  },
  {
    key: 'halfling', name: 'Halfling', original: 'Halfling',
    summary: 'Pequenos, corajosos e sortudos, apegados à família e ao conforto.',
    abilityBonuses: { dexterity: 2 },
    size: 'small', speed: 25, darkvision: 0,
    languages: ['Comum', 'Halfling'], extraLanguages: 0,
    skills: [], weaponProficiencies: [], resistances: [],
    traits: [
      t('lucky', 'Sortudo', 'Lucky', 'Ao tirar 1 natural em um d20 de ataque, teste de habilidade ou salvaguarda, você rola de novo e usa o novo resultado.'),
      t('brave', 'Corajoso', 'Brave', 'Vantagem em salvaguardas contra ser amedrontado.'),
      t('halfling_nimbleness', 'Agilidade Halfling', 'Halfling Nimbleness', 'Pode atravessar o espaço de qualquer criatura de tamanho maior que o seu.'),
    ],
    subraces: [
      {
        key: 'lightfoot', name: 'Pés Leves', original: 'Lightfoot',
        summary: 'Furtivos e sociáveis, fáceis de passar despercebidos.',
        abilityBonuses: { charisma: 1 },
        traits: [t('naturally_stealthy', 'Furtividade Natural', 'Naturally Stealthy', 'Pode tentar se esconder mesmo quando só uma criatura pelo menos um tamanho maior que o seu o encobre.')],
      },
    ],
  },
  {
    key: 'human', name: 'Humano', original: 'Human',
    summary: 'Adaptáveis e ambiciosos, presentes em todo canto do mundo.',
    abilityBonuses: { strength: 1, dexterity: 1, constitution: 1, intelligence: 1, wisdom: 1, charisma: 1 },
    size: 'medium', speed: 30, darkvision: 0,
    languages: ['Comum'], extraLanguages: 1,
    skills: [], weaponProficiencies: [], resistances: [],
    traits: [
      t('human_extra_language', 'Idioma Adicional', 'Languages', 'Fala, lê e escreve Comum e mais um idioma à sua escolha.'),
    ],
    subraces: [],
  },
  {
    key: 'dragonborn', name: 'Draconato', original: 'Dragonborn',
    summary: 'Descendentes de dragões, orgulhosos e com um sopro destruidor.',
    abilityBonuses: { strength: 2, charisma: 1 },
    size: 'medium', speed: 30, darkvision: 0,
    languages: ['Comum', 'Dracônico'], extraLanguages: 0,
    skills: [], weaponProficiencies: [], resistances: [],
    traits: [
      t('draconic_ancestry', 'Ancestral Dracônico', 'Draconic Ancestry', 'Escolha um tipo de dragão (tabela abaixo): ele define o tipo de dano do seu sopro e da sua resistência.'),
      t('breath_weapon', 'Arma de Sopro', 'Breath Weapon', 'Ação: exala energia destrutiva, em linha ou cone conforme o ancestral. Cada criatura na área faz uma salvaguarda (CD 8 + Constituição + proficiência): falha = 2d6, sucesso = metade. O dano sobe para 3d6 no 6º nível, 4d6 no 11º e 5d6 no 16º. Volta no descanso curto ou longo.'),
      t('draconic_damage_resistance', 'Resistência a Dano', 'Damage Resistance', 'Resistência ao tipo de dano do seu ancestral dracônico.'),
    ],
    subraces: [],
  },
  {
    key: 'gnome', name: 'Gnomo', original: 'Gnome',
    summary: 'Pequenos, curiosos e inventivos, cheios de energia.',
    abilityBonuses: { intelligence: 2 },
    size: 'small', speed: 25, darkvision: 60,
    languages: ['Comum', 'Gnômico'], extraLanguages: 0,
    skills: [], weaponProficiencies: [], resistances: [],
    traits: [
      darkvision,
      t('gnome_cunning', 'Esperteza Gnômica', 'Gnome Cunning', 'Vantagem em salvaguardas de Inteligência, Sabedoria e Carisma contra magia.'),
    ],
    subraces: [
      {
        key: 'rock_gnome', name: 'Gnomo das Rochas', original: 'Rock Gnome',
        summary: 'Inventores natos, resistentes e hábeis com engenhocas.',
        abilityBonuses: { constitution: 1 },
        tools: ['tinkers_tools'],
        traits: [
          t('artificers_lore', 'Conhecimento de Artífice', 'Artificer\'s Lore', 'Em testes de Inteligência (História) sobre itens mágicos, objetos alquímicos e dispositivos tecnológicos, soma o dobro da proficiência.'),
          t('tinker', 'Engenhoqueiro', 'Tinker', 'Proficiência com ferramentas de engenhoqueiro. Com 1 hora e 10 po de materiais, constrói um dispositivo mecânico Miúdo (CA 5, 1 PV) que funciona por 24 horas: brinquedo, acendedor de fogo ou caixa de música. Até três ativos.')],
      },
    ],
  },
  {
    key: 'half_elf', name: 'Meio-Elfo', original: 'Half-Elf',
    summary: 'Carisma e versatilidade de dois mundos, sem pertencer inteiramente a nenhum.',
    abilityBonuses: { charisma: 2 },
    abilityChoice: { count: 2, amount: 1, exclude: ['charisma'] },
    size: 'medium', speed: 30, darkvision: 60,
    languages: ['Comum', 'Élfico'], extraLanguages: 1,
    skills: [], skillChoices: 2, weaponProficiencies: [], resistances: [],
    traits: [
      darkvision,
      feyAncestry,
      t('skill_versatility', 'Versatilidade em Perícias', 'Skill Versatility', 'Proficiência em duas perícias à sua escolha.'),
    ],
    subraces: [],
  },
  {
    key: 'half_orc', name: 'Meio-Orc', original: 'Half-Orc',
    summary: 'Força bruta e resistência herdadas dos orcs.',
    abilityBonuses: { strength: 2, constitution: 1 },
    size: 'medium', speed: 30, darkvision: 60,
    languages: ['Comum', 'Orc'], extraLanguages: 0,
    skills: ['intimidation'], weaponProficiencies: [], resistances: [],
    traits: [
      darkvision,
      t('menacing', 'Ameaçador', 'Menacing', 'Proficiência na perícia Intimidação.'),
      t('relentless_endurance', 'Resistência Implacável', 'Relentless Endurance', 'Ao cair a 0 PV sem morrer na hora, você fica com 1 PV. Um uso por descanso longo.'),
      t('savage_attacks', 'Ataques Selvagens', 'Savage Attacks', 'Em um acerto crítico corpo a corpo, role um dado de dano da arma a mais e some ao dano extra.'),
    ],
    subraces: [],
  },
  {
    key: 'tiefling', name: 'Tiefling', original: 'Tiefling',
    summary: 'Marcados por uma herança infernal, mal vistos e de personalidade forte.',
    abilityBonuses: { intelligence: 1, charisma: 2 },
    size: 'medium', speed: 30, darkvision: 60,
    languages: ['Comum', 'Infernal'], extraLanguages: 0,
    skills: [], weaponProficiencies: [], resistances: ['fire'],
    traits: [
      darkvision,
      t('hellish_resistance', 'Resistência Infernal', 'Hellish Resistance', 'Resistência a dano de fogo.'),
      t('infernal_legacy', 'Legado Infernal', 'Infernal Legacy', 'Você conhece o truque taumaturgia. No 3º nível, pode conjurar repreensão infernal como magia de 2º nível uma vez por descanso longo; no 5º, escuridão uma vez por descanso longo. Carisma é seu atributo de conjuração.'),
    ],
    subraces: [],
  },
]

/** Ancestrais dracônicos do Draconato: tipo de dano e forma do sopro. */
export const DRAGONBORN_ANCESTRIES = [
  { key: 'black',  name: 'Negro',   original: 'Black',  damage: 'ácido',    save: 'dexterity',    area: 'linha de 1,5 por 9 metros' },
  { key: 'blue',   name: 'Azul',    original: 'Blue',   damage: 'elétrico', save: 'dexterity',    area: 'linha de 1,5 por 9 metros' },
  { key: 'brass',  name: 'Latão',   original: 'Brass',  damage: 'fogo',     save: 'dexterity',    area: 'linha de 1,5 por 9 metros' },
  { key: 'bronze', name: 'Bronze',  original: 'Bronze', damage: 'elétrico', save: 'dexterity',    area: 'linha de 1,5 por 9 metros' },
  { key: 'copper', name: 'Cobre',   original: 'Copper', damage: 'ácido',    save: 'dexterity',    area: 'linha de 1,5 por 9 metros' },
  { key: 'gold',   name: 'Ouro',    original: 'Gold',   damage: 'fogo',     save: 'dexterity',    area: 'cone de 4,5 metros' },
  { key: 'green',  name: 'Verde',   original: 'Green',  damage: 'veneno',   save: 'constitution', area: 'cone de 4,5 metros' },
  { key: 'red',    name: 'Vermelho', original: 'Red',   damage: 'fogo',     save: 'dexterity',    area: 'cone de 4,5 metros' },
  { key: 'silver', name: 'Prata',   original: 'Silver', damage: 'gélido',   save: 'constitution', area: 'cone de 4,5 metros' },
  { key: 'white',  name: 'Branco',  original: 'White',  damage: 'gélido',   save: 'constitution', area: 'cone de 4,5 metros' },
] as const
