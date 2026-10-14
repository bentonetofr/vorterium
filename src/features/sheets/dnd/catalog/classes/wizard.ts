import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const wizard: ClassDef = {
  key: 'wizard', name: 'Mago', original: 'Wizard',
  hitDie: 6,
  primaryAbilities: ['intelligence'],
  saves: ['intelligence', 'wisdom'],
  skills: { count: 2, from: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'] },
  armor: [],
  weapons: ['dagger', 'dart', 'sling', 'quarterstaff', 'light_crossbow'],
  tools: [],
  startingEquipment: [
    '(a) um bordão ou (b) uma adaga',
    '(a) uma bolsa de componentes ou (b) um foco arcano',
    '(a) um pacote de acadêmico ou (b) um pacote de explorador',
    'Um grimório',
  ],
  summary: 'Estudioso da magia arcana: o maior repertório de magias do jogo, aprendidas e copiadas num grimório.',
  subclassLevel: 2,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'intelligence', kind: 'full', learning: 'spellbook',
    cantripsKnown: byLevel([[1, 3], [4, 4], [10, 5]]),
  },
  features: [
    f(1, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias de mago com Inteligência, a partir de um grimório com 6 magias de 1º nível (e 2 novas a cada nível). Depois de um descanso longo, prepara magias do grimório: nível de mago + modificador de Inteligência. Pode conjurar magias rituais direto do grimório.'),
    f(1, 'arcane_recovery', 'Recuperação Arcana', 'Arcane Recovery', 'Uma vez por dia, num descanso curto, recupera espaços de magia de nível combinado até metade do seu nível de mago (arredondado para cima), nenhum de 6º nível ou mais.'),
    f(2, 'arcane_tradition', 'Tradição Arcana', 'Arcane Tradition', 'Escolha a escola de magia em que você se especializa.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(18, 'spell_mastery', 'Maestria em Magias', 'Spell Mastery', 'Escolha uma magia de 1º nível e uma de 2º nível do seu grimório: conjure-as no nível mais baixo, sem gastar espaço de magia.'),
    f(20, 'signature_spells', 'Assinatura Mágica', 'Signature Spell', 'Escolha duas magias de 3º nível do grimório: ficam sempre preparadas e cada uma pode ser conjurada uma vez sem gastar espaço, voltando no descanso curto ou longo.'),
  ],
  progression: [],
  multiclass: {
    requirement: { mode: 'all', abilities: ['intelligence'] },
    gained: { armor: [], weapons: [], tools: [] },
  },
  subclasses: [
    {
      key: 'evocation', name: 'Escola de Evocação', original: 'School of Evocation', kind: 'Tradição Arcana',
      summary: 'Magia de fogo, raio e gelo: dano em área sem ferir os aliados.',
      features: [
        f(2, 'evocation_savant', 'Perito em Evocação', 'Evocation Savant', 'O ouro e o tempo para copiar magias de evocação para o grimório caem pela metade.'),
        f(2, 'sculpt_spells', 'Moldar Magias', 'Sculpt Spells', 'Ao conjurar uma magia de evocação que afeta criaturas que você vê, escolha 1 + nível da magia delas: passam automaticamente na salvaguarda e não sofrem dano se tivessem sofrido metade.'),
        f(6, 'potent_cantrip', 'Truque Potente', 'Potent Cantrip', 'Seus truques de dano ainda causam metade do dano quando o alvo passa na salvaguarda.'),
        f(10, 'empowered_evocation', 'Evocação Potencializada', 'Empowered Evocation', 'Soma seu modificador de Inteligência a uma rolagem de dano de qualquer magia de evocação de mago.'),
        f(14, 'overchannel', 'Sobrecarga', 'Overchannel', 'Ao conjurar uma magia de mago de 5º nível ou menor que causa dano, causa o dano máximo. O primeiro uso não tem custo; os seguintes, antes de um descanso longo, causam 2d12 de dano necrótico por nível da magia (aumenta 1d12 por nível a cada uso adicional), sem resistência.'),
      ],
    },
  ],
}
