import { STANDARD_ASI_LEVELS } from '../../rules/progression'
import type { ClassDef } from '../types'
import { asiFeatures, byLevel, f } from './helpers'

export const monk: ClassDef = {
  key: 'monk', name: 'Monge', original: 'Monk',
  hitDie: 8,
  primaryAbilities: ['dexterity', 'wisdom'],
  saves: ['strength', 'dexterity'],
  skills: { count: 2, from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'] },
  armor: [],
  weapons: ['simple', 'shortsword'],
  tools: ['Um tipo de ferramentas de artesão ou um instrumento musical à escolha'],
  startingEquipment: [
    '(a) uma espada curta ou (b) qualquer arma simples',
    '(a) um pacote de aventureiro de masmorra ou (b) um pacote de explorador',
    '10 dardos',
  ],
  summary: 'Lutador desarmado e ágil que canaliza o ki: ataques rápidos, movimento extraordinário e resistência sobrenatural.',
  subclassLevel: 3,
  asiLevels: STANDARD_ASI_LEVELS,
  features: [
    f(1, 'unarmored_defense', 'Defesa sem Armadura', 'Unarmored Defense', 'Sem armadura e sem escudo, sua CA é 10 + Destreza + Sabedoria.'),
    f(1, 'martial_arts', 'Artes Marciais', 'Martial Arts', 'Desarmado ou com armas de monge (espada curta e armas simples corpo a corpo sem as propriedades pesada ou duas mãos), sem armadura nem escudo: usa Destreza no ataque e dano, rola o dado de Artes Marciais no dano e, ao atacar, faz um ataque desarmado como ação bônus.'),
    f(2, 'ki', 'Ki', 'Ki', 'Reserva de pontos de ki (igual ao nível de monge) que volta no descanso curto ou longo. CD de ki = 8 + proficiência + Sabedoria. Gaste 1 ponto para Rajada de Golpes (dois ataques desarmados como ação bônus), Defesa Paciente (Esquivar como ação bônus) ou Passo do Vento (Desengajar ou Disparada como ação bônus, com salto dobrado).'),
    f(2, 'unarmored_movement', 'Movimento sem Armadura', 'Unarmored Movement', 'Sem armadura nem escudo, seu deslocamento aumenta (tabela da classe). No 9º nível, pode correr por paredes e sobre líquidos.'),
    f(3, 'monastic_tradition', 'Tradição Monástica', 'Monastic Tradition', 'Escolha a tradição que define o seu treinamento.'),
    f(3, 'deflect_missiles', 'Defletir Projéteis', 'Deflect Missiles', 'Reação: reduz o dano de um ataque à distância em 1d10 + Destreza + nível de monge. Se zerar, você pode pegar o projétil e, gastando 1 ki, devolvê-lo.'),
    ...asiFeatures(STANDARD_ASI_LEVELS),
    f(4, 'slow_fall', 'Queda Lenta', 'Slow Fall', 'Reação: reduz o dano de queda em 5 × seu nível de monge.'),
    f(5, 'extra_attack', 'Ataque Extra', 'Extra Attack', 'Faz dois ataques quando usa a ação Atacar.'),
    f(5, 'stunning_strike', 'Golpe Atordoante', 'Stunning Strike', 'Ao acertar um ataque corpo a corpo, gaste 1 ki: o alvo faz salvaguarda de Constituição ou fica atordoado até o fim do seu próximo turno.'),
    f(6, 'ki_empowered_strikes', 'Ataques Potencializados por Ki', 'Ki-Empowered Strikes', 'Seus ataques desarmados contam como mágicos para superar resistência e imunidade a dano não mágico.'),
    f(7, 'evasion', 'Evasão', 'Evasion', 'Em salvaguardas de Destreza para metade do dano, sucesso = nenhum dano e falha = metade do dano.'),
    f(7, 'stillness_of_mind', 'Mente Tranquila', 'Stillness of Mind', 'Ação: encerra um efeito de enfeitiçado ou amedrontado sobre você.'),
    f(9, 'unarmored_movement_improvement', 'Movimento sem Armadura Aprimorado', 'Unarmored Movement improvement', 'Você pode se mover por superfícies verticais e sobre líquidos sem cair, desde que termine o turno em terreno sólido.'),
    f(10, 'purity_of_body', 'Pureza Corporal', 'Purity of Body', 'Imune a doenças e a veneno.'),
    f(13, 'tongue_of_the_sun_and_moon', 'Língua do Sol e da Lua', 'Tongue of the Sun and Moon', 'Você entende todos os idiomas falados e qualquer criatura que entenda um idioma entende você.'),
    f(14, 'diamond_soul', 'Alma de Diamante', 'Diamond Soul', 'Proficiência em todas as salvaguardas. Gastando 1 ki, refaz uma salvaguarda que falhou.'),
    f(15, 'timeless_body', 'Corpo Atemporal', 'Timeless Body', 'Não envelhece pelo tempo, não sofre efeitos de idade e não precisa de comida nem de água.'),
    f(18, 'empty_body', 'Corpo Vazio', 'Empty Body', 'Gastando 4 ki, fica invisível por 1 minuto e resiste a todo dano exceto energético. Com 8 ki, conjura projeção astral.'),
    f(20, 'perfect_self', 'Perfeição Interior', 'Perfect Self', 'Ao rolar iniciativa sem pontos de ki, recupera 4.'),
  ],
  progression: [
    { key: 'martial_arts_die', label: 'Artes Marciais', values: byLevel([[1, 'd4'], [5, 'd6'], [11, 'd8'], [17, 'd10']]) },
    { key: 'ki_points', label: 'Pontos de Ki', values: [0, ...Array.from({ length: 19 }, (_, i) => i + 2)] },
    { key: 'unarmored_movement', label: 'Movimento sem Armadura', values: byLevel([[1, '0 m'], [2, '+3 m'], [6, '+4,5 m'], [10, '+6 m'], [14, '+7,5 m'], [18, '+9 m']]) },
  ],
  multiclass: {
    requirement: { mode: 'all', abilities: ['dexterity', 'wisdom'] },
    gained: { armor: [], weapons: ['simple', 'shortsword'], tools: [] },
  },
  subclasses: [
    {
      key: 'open_hand', name: 'Caminho da Mão Aberta', original: 'Way of the Open Hand', kind: 'Tradição Monástica',
      summary: 'Mestres do combate desarmado, capazes de empurrar, derrubar e até matar com um toque.',
      features: [
        f(3, 'open_hand_technique', 'Técnica da Mão Aberta', 'Open Hand Technique', 'Ao acertar com a Rajada de Golpes, imponha um efeito ao alvo: salvaguarda de Destreza ou cai caído; salvaguarda de Força ou é empurrado 4,5 metros; ou não pode usar reações até o fim do seu próximo turno.'),
        f(6, 'wholeness_of_body', 'Integridade Corporal', 'Wholeness of Body', 'Ação: recupera PV igual a 3 × seu nível de monge. Um uso por descanso longo.'),
        f(11, 'tranquility', 'Tranquilidade', 'Tranquility', 'Depois de um descanso longo, fica sob o efeito de santuário até o próximo descanso longo (CD 8 + Sabedoria + proficiência).'),
        f(17, 'quivering_palm', 'Palma Vibrante', 'Quivering Palm', 'Ao acertar um ataque desarmado, gaste 3 ki para plantar vibrações letais no alvo. Em até um número de dias igual ao seu nível, uma ação encerra: o alvo faz salvaguarda de Constituição; falha = 0 PV, sucesso = 10d10 de dano necrótico.'),
      ],
    },
  ],
}
