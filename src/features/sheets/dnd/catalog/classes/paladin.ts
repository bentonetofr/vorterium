import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const paladin: ClassDef = {
  key: 'paladin', name: 'Paladino', original: 'Paladin',
  hitDie: 10,
  primaryAbilities: ['strength', 'charisma'],
  saves: ['wisdom', 'charisma'],
  skills: { count: 2, from: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'] },
  armor: ['light', 'medium', 'heavy', 'shield'],
  weapons: ['simple', 'martial'],
  tools: [],
  startingEquipment: [
    '(a) uma arma marcial e um escudo ou (b) duas armas marciais',
    '(a) cinco azagaias ou (b) qualquer arma simples corpo a corpo',
    '(a) um pacote de sacerdote ou (b) um pacote de explorador',
    'Cota de malha e um símbolo sagrado',
  ],
  summary: 'Cavaleiro sagrado ligado a um juramento: armadura pesada, cura pelas mãos e golpes divinos.',
  subclassLevel: 3,
  asiLevels: STANDARD_ASI_LEVELS,
  spellcasting: {
    ability: 'charisma', kind: 'half', learning: 'prepared-half',
    cantripsKnown: new Array(20).fill(0),
  },
  features: [
    f(1, 'divine_sense', 'Sentido Divino', 'Divine Sense', 'Ação: até o fim do seu próximo turno, você sabe onde estão celestiais, ínferos e mortos-vivos a até 18 metros sem cobertura total. Usos por descanso longo: 1 + modificador de Carisma.'),
    f(1, 'lay_on_hands', 'Cura pelas Mãos', 'Lay on Hands', 'Reserva de PV igual a 5 × seu nível de paladino, que volta no descanso longo. Ação: toque para restaurar PV dessa reserva, ou gaste 5 para curar uma doença ou um veneno.'),
    f(2, 'fighting_style', 'Estilo de Luta', 'Fighting Style', 'Escolha um estilo de luta (Defesa, Duelismo, Combate com Arma Grande ou Proteção).'),
    f(2, 'spellcasting', 'Conjuração', 'Spellcasting', 'Prepara magias de paladino depois de um descanso longo: modificador de Carisma + metade do seu nível de paladino (mínimo 1). Usa um símbolo sagrado como foco.'),
    f(2, 'divine_smite', 'Destruição Divina', 'Divine Smite', 'Ao acertar um ataque corpo a corpo, gaste um espaço de magia para causar 2d8 de dano radiante extra (+1d8 por nível do espaço acima do 1º, máximo 5d8), mais 1d8 contra ínferos e mortos-vivos.'),
    f(3, 'divine_health', 'Saúde Divina', 'Divine Health', 'Você é imune a doenças.'),
    f(3, 'sacred_oath', 'Juramento Sagrado', 'Sacred Oath', 'Faça o juramento que define o seu caminho.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(5, 'extra_attack', 'Ataque Extra', 'Extra Attack', 'Faz dois ataques quando usa a ação Atacar.'),
    f(6, 'aura_of_protection', 'Aura de Proteção', 'Aura of Protection', 'Você e aliados a até 3 metros somam seu modificador de Carisma (mínimo +1) em todas as salvaguardas, enquanto você estiver consciente.'),
    f(10, 'aura_of_courage', 'Aura de Coragem', 'Aura of Courage', 'Você e aliados a até 3 metros não podem ser amedrontados enquanto você estiver consciente.'),
    f(11, 'improved_divine_smite', 'Destruição Divina Aprimorada', 'Improved Divine Smite', 'Todo acerto corpo a corpo com arma causa 1d8 de dano radiante extra.'),
    f(14, 'cleansing_touch', 'Toque Purificador', 'Cleansing Touch', 'Ação: encerra uma magia sobre você ou sobre uma criatura voluntária que você toque. Usos por descanso longo: modificador de Carisma (mínimo 1).'),
    f(18, 'aura_improvements', 'Aprimoramento de Aura', 'Aura improvements', 'O alcance das suas auras passa de 3 para 9 metros.'),
  ],
  progression: [
    { key: 'lay_on_hands_pool', label: 'Cura pelas Mãos (PV)', values: Array.from({ length: 20 }, (_, i) => (i + 1) * 5) },
    { key: 'aura_range', label: 'Alcance das Auras', values: byLevel([[1, 'nenhum'], [6, '3 m'], [18, '9 m']]) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['strength', 'charisma'] },
    gained: { armor: ['light', 'medium', 'shield'], weapons: ['simple', 'martial'], tools: [] },
  },
  subclasses: [
    {
      key: 'devotion', name: 'Juramento da Devoção', original: 'Oath of Devotion', kind: 'Juramento Sagrado',
      summary: 'O cavaleiro ideal: honestidade, coragem e compaixão, com poder contra o mal.',
      features: [
        f(3, 'oath_spells', 'Magias do Juramento', 'Oath Spells', 'Sempre preparadas: proteção contra o bem e o mal e santuário (3º); restauração menor e zona da verdade (5º); farol de esperança e dissipar magia (9º); liberdade de movimento e guardião da fé (13º); comunhão e golpe flamejante (17º).'),
        f(3, 'channel_divinity_devotion', 'Canalizar Divindade', 'Channel Divinity', 'Arma Sagrada: por 1 minuto uma arma ganha bônus de ataque igual ao seu Carisma e emite luz. Expulsar o Profano: ínferos e mortos-vivos a 9 metros fazem salvaguarda de Sabedoria ou ficam expulsos por 1 minuto.'),
        f(7, 'aura_of_devotion', 'Aura de Devoção', 'Aura of Devotion', 'Você e aliados a até 3 metros não podem ser enfeitiçados enquanto você estiver consciente.'),
        f(15, 'purity_of_spirit', 'Pureza de Espírito', 'Purity of Spirit', 'Você está sempre sob o efeito de proteção contra o bem e o mal.'),
        f(20, 'holy_nimbus', 'Halo Sagrado', 'Holy Nimbus', 'Ação: por 1 minuto emana luz do sol num raio de 9 metros, que causa 10 de dano radiante a inimigos que começam o turno ali. Você tem vantagem em salvaguardas contra magias de ínferos e mortos-vivos. Um uso por descanso longo.'),
      ],
    },
  ],
}
