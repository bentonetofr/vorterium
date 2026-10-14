import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const cleric: ClassDef = {
  key: 'cleric', name: 'Clérigo', original: 'Cleric',
  hitDie: 8,
  primaryAbilities: ['wisdom'],
  saves: ['wisdom', 'charisma'],
  skills: { count: 2, from: ['history', 'insight', 'medicine', 'persuasion', 'religion'] },
  armor: ['light', 'medium', 'shield'],
  weapons: ['simple'],
  tools: [],
  startingEquipment: [
    '(a) uma maça ou (b) um martelo de guerra (se for proficiente)',
    '(a) cota de escamas, (b) armadura de couro ou (c) cota de malha (se for proficiente)',
    '(a) uma besta leve e 20 virotes ou (b) qualquer arma simples',
    '(a) um pacote de sacerdote ou (b) um pacote de explorador',
    'Um escudo e um símbolo sagrado',
  ],
  summary: 'Canal do poder divino: cura, protege e conjura magias sagradas, com habilidades que dependem do seu domínio.',
  subclassLevel: 1,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'wisdom', kind: 'full', learning: 'prepared',
    cantripsKnown: byLevel([[1, 3], [4, 4], [10, 5]]),
  },
  features: [
    f(1, 'spellcasting', 'Conjuração', 'Spellcasting', 'Conjura magias de clérigo com Sabedoria. Depois de um descanso longo, prepara magias da lista de clérigo: nível de clérigo + modificador de Sabedoria. Usa um símbolo sagrado como foco.'),
    f(1, 'divine_domain', 'Domínio Divino', 'Divine Domain', 'Escolha o domínio ligado à sua divindade. Ele dá magias de domínio e características nos níveis 1, 2, 6, 8 e 17.'),
    f(2, 'channel_divinity', 'Canalizar Divindade', 'Channel Divinity', 'Canalize energia divina para o efeito Expulsar Mortos-Vivos e o do seu domínio. Usos por descanso curto ou longo: 1 (nível 2), 2 (nível 6), 3 (nível 18).'),
    f(2, 'turn_undead', 'Expulsar Mortos-Vivos', 'Turn Undead', 'Ação: cada morto-vivo a 9 metros que ouça você faz uma salvaguarda de Sabedoria; se falhar, fica expulso por 1 minuto e foge.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(5, 'destroy_undead', 'Destruir Mortos-Vivos', 'Destroy Undead', 'Mortos-vivos que falham na salvaguarda de Expulsar são destruídos se o ND for baixo: 1/2 no nível 5, 1 no 8, 2 no 11, 3 no 14 e 4 no 17.'),
    f(10, 'divine_intervention', 'Intervenção Divina', 'Divine Intervention', 'Peça ajuda à divindade: role d100; se tirar até o seu nível de clérigo, ela atende. Dá certo e fica 7 dias sem poder usar de novo; falhou, pode tentar após um descanso longo.'),
    f(20, 'divine_intervention_improvement', 'Intervenção Divina Aprimorada', 'Divine Intervention improvement', 'A Intervenção Divina passa a funcionar automaticamente, sem rolagem.'),
  ],
  progression: [
    { key: 'channel_divinity', label: 'Canalizar Divindade', values: byLevel([[1, 0], [2, 1], [6, 2], [18, 3]]) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['wisdom'] },
    gained: { armor: ['light', 'medium', 'shield'], weapons: [], tools: [] },
  },
  subclasses: [
    {
      key: 'life', name: 'Domínio da Vida', original: 'Life Domain', kind: 'Domínio Divino',
      summary: 'O melhor curandeiro do jogo: magias de cura mais fortes e armadura pesada.',
      features: [
        f(1, 'bonus_proficiency', 'Proficiência Bônus', 'Bonus Proficiency', 'Proficiência em armaduras pesadas.'),
        f(1, 'disciple_of_life', 'Discípulo da Vida', 'Disciple of Life', 'Suas magias de cura que restauram PV curam 2 + o nível da magia a mais.'),
        f(1, 'life_domain_spells', 'Magias de Domínio', 'Life Domain Spells', 'Sempre preparadas: bênção e curar ferimentos (1º); restauração menor e arma espiritual (3º); farol de esperança e reviver (5º); proteção contra a morte e guardião da fé (7º); curar ferimentos em massa e ressurreição (9º).'),
        f(2, 'preserve_life', 'Canalizar Divindade: Preservar Vida', 'Channel Divinity: Preserve Life', 'Ação: distribua até 5 × seu nível de clérigo em PV entre criaturas a 9 metros, sem passar da metade do PV máximo de cada uma.'),
        f(6, 'blessed_healer', 'Curandeiro Abençoado', 'Blessed Healer', 'Quando você cura outra criatura com uma magia, você também recupera 2 + o nível da magia em PV.'),
        f(8, 'divine_strike', 'Golpe Divino', 'Divine Strike', 'Uma vez por turno, um acerto de arma causa 1d8 de dano radiante extra (2d8 a partir do 14º nível).'),
        f(17, 'supreme_healing', 'Cura Suprema', 'Supreme Healing', 'Ao rolar dados para recuperar PV com uma magia ou característica, você usa o valor máximo de cada dado.'),
      ],
    },
  ],
}
