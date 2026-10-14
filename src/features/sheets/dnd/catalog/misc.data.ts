import type { BackgroundDef, FightingStyleDef, GlossaryEntry } from './types'

// ────────────────────────────────────────────────────────
// Estilos de Luta, antecedentes e glossário (SRD 5.1).
// ────────────────────────────────────────────────────────

export const FIGHTING_STYLES: FightingStyleDef[] = [
  { key: 'archery', name: 'Arquearia', original: 'Archery', classes: ['fighter', 'ranger'], summary: '+2 nas jogadas de ataque com armas à distância.' },
  { key: 'defense', name: 'Defesa', original: 'Defense', classes: ['fighter', 'paladin', 'ranger'], summary: '+1 de CA enquanto usa armadura.' },
  { key: 'dueling', name: 'Duelismo', original: 'Dueling', classes: ['fighter', 'paladin', 'ranger'], summary: '+2 de dano com uma arma corpo a corpo empunhada com uma mão, sem outra arma na outra.' },
  { key: 'great_weapon_fighting', name: 'Combate com Arma Grande', original: 'Great Weapon Fighting', classes: ['fighter', 'paladin'], summary: 'Ao tirar 1 ou 2 num dado de dano de uma arma corpo a corpo empunhada com duas mãos, role de novo e fique com o novo resultado. A arma precisa ser de duas mãos ou versátil.' },
  { key: 'protection', name: 'Proteção', original: 'Protection', classes: ['fighter', 'paladin'], summary: 'Reação, com um escudo: impõe desvantagem no ataque contra um alvo a 1,5 metro de você que não seja você.' },
  { key: 'two_weapon_fighting', name: 'Combate com Duas Armas', original: 'Two-Weapon Fighting', classes: ['fighter', 'ranger'], summary: 'Soma o modificador de atributo ao dano do segundo ataque ao lutar com duas armas.' },
]

export const BACKGROUNDS: BackgroundDef[] = [
  {
    key: 'acolyte', name: 'Acólito', original: 'Acolyte',
    summary: 'Você passou a vida a serviço de um templo, intermediando o mundo sagrado e o mortal.',
    skills: ['insight', 'religion'],
    skillChoices: 0,
    languagesChoices: 2,
    toolOrLanguageChoices: 0,
    tools: [],
    equipment: ['Um símbolo sagrado', 'Um livro de orações ou uma roda de orações', '5 bastões de incenso', 'Vestes', 'Roupas comuns', 'Uma bolsa com 15 po'],
    feature: {
      level: 1, key: 'shelter_of_the_faithful', name: 'Abrigo dos Fiéis', original: 'Shelter of the Faithful',
      summary: 'Você e seus companheiros podem esperar cura e cuidados gratuitos em templos da sua fé (você fornece os componentes materiais de magias). Quem compartilha a sua religião sustenta você, mas só você, num estilo de vida modesto.',
    },
  },
  {
    key: 'custom', name: 'Antecedente personalizado', original: 'Customized Background',
    summary: 'Regra do Livro do Jogador: monte um antecedente que combine com o personagem, trocando uma característica, escolhendo duas perícias e duas proficiências entre ferramentas e idiomas.',
    skills: [],
    skillChoices: 2,
    languagesChoices: 0,
    toolOrLanguageChoices: 2,
    tools: [],
    equipment: [],
    feature: null,
    custom: true,
  },
]

/** Termos fixos de tradução, para os textos do site ficarem consistentes. */
export const GLOSSARY: GlossaryEntry[] = [
  { term: 'Salvaguarda', original: 'Saving Throw' },
  { term: 'Teste de habilidade', original: 'Ability Check' },
  { term: 'Perícia', original: 'Skill' },
  { term: 'Bônus de proficiência', original: 'Proficiency Bonus' },
  { term: 'Classe de Armadura (CA)', original: 'Armor Class (AC)' },
  { term: 'Pontos de Vida (PV)', original: 'Hit Points (HP)' },
  { term: 'Dado de Vida', original: 'Hit Die' },
  { term: 'Iniciativa', original: 'Initiative' },
  { term: 'Deslocamento', original: 'Speed' },
  { term: 'Vantagem', original: 'Advantage' },
  { term: 'Desvantagem', original: 'Disadvantage' },
  { term: 'Inspiração', original: 'Inspiration' },
  { term: 'Espaço de magia', original: 'Spell Slot' },
  { term: 'Truque', original: 'Cantrip' },
  { term: 'Magia preparada', original: 'Prepared Spell' },
  { term: 'Concentração', original: 'Concentration' },
  { term: 'Ritual', original: 'Ritual' },
  { term: 'Componentes verbais, somáticos e materiais', original: 'Verbal, Somatic, Material Components' },
  { term: 'Foco de conjuração', original: 'Spellcasting Focus' },
  { term: 'Descanso curto', original: 'Short Rest' },
  { term: 'Descanso longo', original: 'Long Rest' },
  { term: 'Ataque de oportunidade', original: 'Opportunity Attack' },
  { term: 'Ação bônus', original: 'Bonus Action' },
  { term: 'Reação', original: 'Reaction' },
  { term: 'Acerto crítico', original: 'Critical Hit' },
  { term: 'Resistência (a dano)', original: 'Resistance' },
  { term: 'Vulnerabilidade', original: 'Vulnerability' },
  { term: 'Imunidade', original: 'Immunity' },
  { term: 'PV temporários', original: 'Temporary Hit Points' },
  { term: 'Salvaguarda contra a morte', original: 'Death Saving Throw' },
  { term: 'Ínfero', original: 'Fiend' },
  { term: 'Morto-vivo', original: 'Undead' },
  { term: 'Fada', original: 'Fey' },
  { term: 'Grau de Desafio (ND)', original: 'Challenge Rating (CR)' },
  { term: 'Antecedente', original: 'Background' },
  { term: 'Alinhamento', original: 'Alignment' },
]
