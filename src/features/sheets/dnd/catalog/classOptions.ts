import type { CatalogBase } from './types'

// ────────────────────────────────────────────────────────
// Opções que o jogador escolhe dentro de uma característica de classe: a
// Metamagia do Feiticeiro (8 do SRD 5.1) e as Invocações Místicas do Bruxo
// (32 do SRD 5.1). Alcances em metros, como na edição brasileira.
// ────────────────────────────────────────────────────────

export type ClassOptionKind = 'metamagic' | 'invocation'

export interface ClassOptionEntry extends CatalogBase {
  kind:     ClassOptionKind
  /** Classe que escolhe a opção. */
  classKey: string
  /** Pré-requisito em texto, se houver. */
  prerequisite?: string
  /** Nível mínimo de bruxo, quando o pré-requisito pede nível. */
  minLevel?: number
  summary:  string
}

const meta = (key: string, name: string, original: string, summary: string): ClassOptionEntry =>
  ({ key, name, original, kind: 'metamagic', classKey: 'sorcerer', summary })

const inv = (key: string, name: string, original: string, summary: string, prerequisite?: string, minLevel?: number): ClassOptionEntry =>
  ({ key, name, original, kind: 'invocation', classKey: 'warlock', summary, ...(prerequisite ? { prerequisite } : {}), ...(minLevel ? { minLevel } : {}) })

export const METAMAGIC: ClassOptionEntry[] = [
  meta('careful_spell', 'Magia Cuidadosa', 'Careful Spell',
    'Ao conjurar uma magia que obriga outras criaturas a fazer uma salvaguarda, você gasta 1 ponto de feitiçaria e escolhe criaturas até o seu modificador de Carisma (mínimo 1): elas são bem-sucedidas automaticamente na salvaguarda contra a magia.'),
  meta('distant_spell', 'Magia Distante', 'Distant Spell',
    'Ao conjurar uma magia com alcance de 1,5 metro ou mais, gaste 1 ponto de feitiçaria para dobrar o alcance. Se o alcance for toque, gaste 1 ponto para que passe a ser 9 metros.'),
  meta('empowered_spell', 'Magia Potencializada', 'Empowered Spell',
    'Ao rolar o dano de uma magia, gaste 1 ponto de feitiçaria para rolar de novo uma quantidade de dados de dano até o seu modificador de Carisma (mínimo 1). Você precisa usar os novos resultados. Pode usar esta opção junto com outra Metamagia na mesma conjuração.'),
  meta('extended_spell', 'Magia Prolongada', 'Extended Spell',
    'Ao conjurar uma magia com duração de 1 minuto ou mais, gaste 1 ponto de feitiçaria para dobrar a duração, até no máximo 24 horas.'),
  meta('heightened_spell', 'Magia Intensificada', 'Heightened Spell',
    'Ao conjurar uma magia que obriga uma criatura a fazer uma salvaguarda para resistir a seus efeitos, gaste 3 pontos de feitiçaria para dar a um alvo da magia desvantagem na primeira salvaguarda contra ela.'),
  meta('quickened_spell', 'Magia Acelerada', 'Quickened Spell',
    'Ao conjurar uma magia com tempo de conjuração de 1 ação, gaste 2 pontos de feitiçaria para mudar o tempo de conjuração para 1 ação bônus nesta conjuração.'),
  meta('subtle_spell', 'Magia Sutil', 'Subtle Spell',
    'Ao conjurar uma magia, gaste 1 ponto de feitiçaria para conjurá-la sem componentes somáticos nem verbais.'),
  meta('twinned_spell', 'Magia Gêmea', 'Twinned Spell',
    'Ao conjurar uma magia que tem só uma criatura como alvo e não tem alcance pessoal, gaste pontos de feitiçaria iguais ao nível da magia (1 se for truque) para escolher um segundo alvo ao alcance. A magia não pode ser capaz de afetar mais de uma criatura no nível atual: mísseis mágicos e raio ardente não servem, raio de gelo serve.'),
]

export const INVOCATIONS: ClassOptionEntry[] = [
  inv('agonizing_blast', 'Rajada Agonizante', 'Agonizing Blast',
    'Ao conjurar rajada mística, some seu modificador de Carisma ao dano que ela causa ao acertar.', 'truque rajada mística'),
  inv('armor_of_shadows', 'Armadura de Sombras', 'Armor of Shadows',
    'Você pode conjurar armadura arcana em si mesmo à vontade, sem gastar espaço de magia nem componentes materiais.'),
  inv('ascendant_step', 'Passo Ascendente', 'Ascendant Step',
    'Você pode conjurar levitação em si mesmo à vontade, sem gastar espaço de magia nem componentes materiais.', '9º nível', 9),
  inv('beast_speech', 'Fala Bestial', 'Beast Speech',
    'Você pode conjurar falar com animais à vontade, sem gastar espaço de magia.'),
  inv('beguiling_influence', 'Influência Sedutora', 'Beguiling Influence',
    'Você ganha proficiência nas perícias Enganação e Persuasão.'),
  inv('bewitching_whispers', 'Sussurros Enfeitiçantes', 'Bewitching Whispers',
    'Você pode conjurar compulsão uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.', '7º nível', 7),
  inv('book_of_ancient_secrets', 'Livro dos Segredos Antigos', 'Book of Ancient Secrets',
    'Você pode inscrever rituais mágicos no seu Livro das Sombras. Escolha duas magias de 1º nível com a marca ritual de qualquer lista de classe (não precisam ser da mesma). Elas entram no livro e não contam nas magias que você conhece; com o livro em mãos, você as conjura como rituais, e também pode conjurar como ritual qualquer magia de bruxo que conheça e tenha a marca ritual. Em suas aventuras, você pode acrescentar outras magias rituais ao livro, se o nível da magia for no máximo metade do seu nível de bruxo (arredondado para cima) e se tiver tempo para transcrevê-la: 2 horas e 50 po de tinta rara por nível da magia.',
    'característica Pacto do Tomo'),
  inv('chains_of_carceri', 'Correntes de Carceri', 'Chains of Carceri',
    'Você pode conjurar imobilizar monstro à vontade, tendo como alvo um celestial, ínfero ou elemental, sem gastar espaço de magia nem componentes materiais. Precisa concluir um descanso longo antes de usar esta invocação na mesma criatura de novo.', '15º nível, característica Pacto da Corrente', 15),
  inv('devils_sight', 'Visão do Diabo', "Devil's Sight",
    'Você enxerga normalmente na escuridão, mágica ou não, até 36 metros.'),
  inv('dreadful_word', 'Palavra Terrível', 'Dreadful Word',
    'Você pode conjurar confusão uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.', '7º nível', 7),
  inv('eldritch_sight', 'Visão Mística', 'Eldritch Sight',
    'Você pode conjurar detectar magia à vontade, sem gastar espaço de magia.'),
  inv('eldritch_spear', 'Lança Mística', 'Eldritch Spear',
    'Ao conjurar rajada mística, o alcance dela passa a ser 90 metros.', 'truque rajada mística'),
  inv('eyes_of_the_rune_keeper', 'Olhos do Guardião das Runas', 'Eyes of the Rune Keeper',
    'Você pode ler qualquer escrita.'),
  inv('fiendish_vigor', 'Vigor Ínfero', 'Fiendish Vigor',
    'Você pode conjurar vida falsa em si mesmo à vontade, como magia de 1º nível, sem gastar espaço de magia nem componentes materiais.'),
  inv('gaze_of_two_minds', 'Olhar de Duas Mentes', 'Gaze of Two Minds',
    'Com uma ação, você toca um humanoide voluntário e percebe através dos sentidos dele até o fim do seu próximo turno. Enquanto a criatura estiver no mesmo plano de existência que você, pode usar a ação em turnos seguintes para manter a ligação, estendendo a duração até o fim do seu próximo turno. Percebendo pelos sentidos dela, você aproveita quaisquer sentidos especiais que ela tenha, e fica cego e surdo ao seu próprio entorno.'),
  inv('lifedrinker', 'Sorvedor de Vida', 'Lifedrinker',
    'Quando você acerta uma criatura com sua arma do pacto, ela sofre dano necrótico extra igual ao seu modificador de Carisma (mínimo 1).', '12º nível, característica Pacto da Lâmina', 12),
  inv('mask_of_many_faces', 'Máscara de Muitas Faces', 'Mask of Many Faces',
    'Você pode conjurar disfarçar-se à vontade, sem gastar espaço de magia.'),
  inv('master_of_myriad_forms', 'Mestre de Mil Formas', 'Master of Myriad Forms',
    'Você pode conjurar alterar-se à vontade, sem gastar espaço de magia.', '15º nível', 15),
  inv('minions_of_chaos', 'Lacaios do Caos', 'Minions of Chaos',
    'Você pode conjurar invocar elemental uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.', '9º nível', 9),
  inv('mire_the_mind', 'Atolar a Mente', 'Mire the Mind',
    'Você pode conjurar lentidão uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.', '5º nível', 5),
  inv('misty_visions', 'Visões Nebulosas', 'Misty Visions',
    'Você pode conjurar imagem silenciosa à vontade, sem gastar espaço de magia nem componentes materiais.'),
  inv('one_with_shadows', 'Uno com as Sombras', 'One with Shadows',
    'Quando estiver numa área de penumbra ou escuridão, você pode usar uma ação para ficar invisível até se mover ou realizar uma ação ou reação.', '5º nível', 5),
  inv('otherworldly_leap', 'Salto de Outro Mundo', 'Otherworldly Leap',
    'Você pode conjurar salto em si mesmo à vontade, sem gastar espaço de magia nem componentes materiais.', '9º nível', 9),
  inv('repelling_blast', 'Rajada Repelente', 'Repelling Blast',
    'Quando você acerta uma criatura com rajada mística, pode empurrá-la até 3 metros para longe de você, em linha reta.', 'truque rajada mística'),
  inv('sculptor_of_flesh', 'Escultor de Carne', 'Sculptor of Flesh',
    'Você pode conjurar polimorfia uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.', '7º nível', 7),
  inv('sign_of_ill_omen', 'Sinal de Mau Agouro', 'Sign of Ill Omen',
    'Você pode conjurar rogar maldição uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.', '5º nível', 5),
  inv('thief_of_five_fates', 'Ladrão de Cinco Destinos', 'Thief of Five Fates',
    'Você pode conjurar praga uma vez usando um espaço de magia de bruxo. Só pode fazer isso de novo depois de um descanso longo.'),
  inv('thirsting_blade', 'Lâmina Sedenta', 'Thirsting Blade',
    'Você pode atacar com sua arma do pacto duas vezes, em vez de uma, sempre que realizar a ação Atacar no seu turno.', '5º nível, característica Pacto da Lâmina', 5),
  inv('visions_of_distant_realms', 'Visões de Reinos Distantes', 'Visions of Distant Realms',
    'Você pode conjurar olho arcano à vontade, sem gastar espaço de magia.', '15º nível', 15),
  inv('voice_of_the_chain_master', 'Voz do Mestre das Correntes', 'Voice of the Chain Master',
    'Você pode se comunicar telepaticamente com seu familiar e perceber através dos sentidos dele enquanto estiverem no mesmo plano de existência. Além disso, enquanto percebe pelos sentidos dele, você também pode falar através dele com a sua própria voz, mesmo que ele normalmente seja incapaz de falar.', 'característica Pacto da Corrente'),
  inv('whispers_of_the_grave', 'Sussurros do Túmulo', 'Whispers of the Grave',
    'Você pode conjurar falar com os mortos à vontade, sem gastar espaço de magia.', '9º nível', 9),
  inv('witch_sight', 'Visão de Bruxo', 'Witch Sight',
    'Você enxerga a verdadeira forma de qualquer metamorfo ou criatura oculta por magia de ilusão ou transmutação enquanto ela estiver a até 9 metros de você e na sua linha de visão.', '15º nível', 15),
]

export const CLASS_OPTIONS: readonly ClassOptionEntry[] = [...METAMAGIC, ...INVOCATIONS]

export function getClassOption(kind: ClassOptionKind, key: string): ClassOptionEntry | undefined {
  return CLASS_OPTIONS.find((o) => o.kind === kind && o.key === key)
}

export const CLASS_OPTION_LABEL: Record<ClassOptionKind, string> = { metamagic: 'Metamagia', invocation: 'Invocação Mística' }

/** Chave gravada na ficha (feature_key) para uma opção escolhida. */
export function classOptionFeatureKey(o: Pick<ClassOptionEntry, 'kind' | 'classKey' | 'key'>): string {
  return `${o.classKey}__${o.kind}_${o.key}`.slice(0, 80)
}
