import { FIGHTER_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, f } from './helpers'

export const fighter: ClassDef = {
  key: 'fighter', name: 'Guerreiro', original: 'Fighter',
  hitDie: 10,
  primaryAbilities: ['strength', 'dexterity'],
  saves: ['strength', 'constitution'],
  skills: { count: 2, from: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'] },
  armor: ['light', 'medium', 'heavy', 'shield'],
  weapons: ['simple', 'martial'],
  tools: [],
  startingEquipment: [
    '(a) cota de malha ou (b) armadura de couro, arco longo e 20 flechas',
    '(a) uma arma marcial e um escudo ou (b) duas armas marciais',
    '(a) uma besta leve e 20 virotes ou (b) dois machados de mão',
    '(a) um pacote de aventureiro de masmorra ou (b) um pacote de explorador',
  ],
  summary: 'Mestre das armas e das armaduras: o mais resistente e o que mais ataca, com muitas opções de combate.',
  subclassLevel: 3,
  asiLevels: FIGHTER_ASI_LEVELS,
  features: [
    f(1, 'fighting_style', 'Estilo de Luta', 'Fighting Style', 'Escolha um estilo de luta (Arquearia, Defesa, Duelismo, Combate com Arma Grande, Proteção ou Combate com Duas Armas).'),
    f(1, 'second_wind', 'Retomar o Fôlego', 'Second Wind', 'Ação bônus: recupera 1d10 + seu nível de guerreiro em PV. Volta num descanso curto ou longo.'),
    f(2, 'action_surge', 'Surto de Ação', 'Action Surge', 'No seu turno, faça uma ação adicional. Um uso por descanso curto ou longo (dois a partir do 17º nível).'),
    f(3, 'martial_archetype', 'Arquétipo Marcial', 'Martial Archetype', 'Escolha o arquétipo que define o seu estilo de combate.'),
    ...asiFeatures(FIGHTER_ASI_LEVELS),
    f(5, 'extra_attack', 'Ataque Extra', 'Extra Attack', 'Faz dois ataques quando usa a ação Atacar.'),
    f(9, 'indomitable', 'Indomável', 'Indomitable', 'Refaça uma salvaguarda que falhou, usando o novo resultado. Um uso por descanso longo (dois no 13º nível, três no 17º).'),
    f(11, 'extra_attack_2', 'Ataque Extra (2)', 'Extra Attack (2)', 'Faz três ataques quando usa a ação Atacar.'),
    f(20, 'extra_attack_3', 'Ataque Extra (3)', 'Extra Attack (3)', 'Faz quatro ataques quando usa a ação Atacar.'),
  ],
  progression: [],
  multiclass: {
    requirement: { mode: 'any', abilities: ['strength', 'dexterity'] },
    gained: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], tools: [] },
  },
  subclasses: [
    {
      key: 'champion', name: 'Campeão', original: 'Champion', kind: 'Arquétipo Marcial',
      summary: 'Força física bruta e golpes críticos mais frequentes. É o arquétipo mais simples de jogar.',
      features: [
        f(3, 'improved_critical', 'Crítico Aprimorado', 'Improved Critical', 'Seus ataques com arma causam acerto crítico com 19 ou 20 no dado.'),
        f(7, 'remarkable_athlete', 'Atleta Notável', 'Remarkable Athlete', 'Soma metade da proficiência (para cima) em testes de Força, Destreza e Constituição em que não é proficiente. Também aumenta o salto em distância.'),
        f(10, 'additional_fighting_style', 'Estilo de Luta Adicional', 'Additional Fighting Style', 'Escolha um segundo Estilo de Luta.'),
        f(15, 'superior_critical', 'Crítico Superior', 'Superior Critical', 'Seus ataques com arma causam acerto crítico com 18, 19 ou 20 no dado.'),
        f(18, 'survivor', 'Sobrevivente', 'Survivor', 'No início do seu turno, se estiver com metade do PV ou menos e pelo menos 1 PV, recupera 5 + seu modificador de Constituição.'),
      ],
    },
  ],
}
