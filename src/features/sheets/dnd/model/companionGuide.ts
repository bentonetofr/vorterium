// ────────────────────────────────────────────────────────
// Guia de regras da aba Companheiros: como cada tipo de companheiro funciona no D&D 5e, em resumo e em português.
// Texto próprio (não copiado do livro); confira o livro na dúvida e combine os detalhes com o Mestre.
// ────────────────────────────────────────────────────────

export interface GuideSection {
  id: string
  title: string
  /** A ideia em uma frase. */
  lead: string
  points: string[]
}

export const COMPANION_GUIDE: GuideSection[] = [
  {
    id: 'turno',
    title: 'Como um companheiro age',
    lead: 'Quase todo companheiro joga no seu turno ou logo depois dele, sem rolar iniciativa própria.',
    points: [
      'Constructos do Artificeiro, bestas da Tasha, Espírito de Fogo Selvagem e criaturas invocadas por magia agem na SUA iniciativa, logo depois de você. Eles se movem sozinhos e usam a própria ação e reação.',
      'Sem comando, a criatura só faz a ação de Esquivar. O comando varia: o Defensor de Aço obedece a ordens faladas sem gastar nada; as bestas da Tasha pedem uma ação bônus sua; o Companheiro do Patrulheiro (livro-base) pede uma ação sua.',
      'Se você ficar incapacitado, a maioria deles passa a agir por conta própria.',
      'O familiar de Convocar Familiar é a exceção: rola a própria iniciativa, age sozinho e não pode atacar.',
      'A 0 PV, uma criatura comum morre ou cai conforme o Mestre decidir. Constructos e objetos ficam destruídos, e familiares e corcéis convocados simplesmente desaparecem e podem ser chamados de novo.',
      'Atacar o companheiro ou atacar você são escolhas do inimigo: ele pode ser alvo de ataques, magias de área e efeitos como qualquer criatura.',
    ],
  },
  {
    id: 'familiar',
    title: 'Familiar (Convocar Familiar e Pacto da Corrente)',
    lead: 'Um espírito em forma de bicho: olhos e ouvidos extras, entrega magias de toque, mas não luta.',
    points: [
      'Convocar Familiar (1º nível, ritual de 1 hora, 10 po de carvão, incenso e ervas): o familiar tem as estatísticas da forma escolhida (coruja, gato, morcego, corvo, falcão, rato, doninha, sapo, aranha, lagarto, polvo, cavalo-marinho, caranguejo, peixe ou cobra venenosa), mas é feérico, celestial ou ínfero.',
      'Você tem um familiar por vez. Conjurar a magia de novo com ele vivo só troca a forma.',
      'Telepatia a até 30 m. Com uma ação, você vê e ouve pelos sentidos dele até o início do seu próximo turno (e fica cego e surdo ao seu redor enquanto isso).',
      'Entrega magias de toque como reação, a até 30 m de você: ele precisa estar ao alcance do alvo. Se a magia pede jogada de ataque, é ele quem faz, usando o seu bônus.',
      'Pode ser dispensado para uma bolsa dimensional e chamado de volta com uma ação, aparecendo a até 9 m de você.',
      'Pacto da Corrente (Bruxo, nível 3): formas especiais (diabrete, quasit, pseudodragão, fadinha) que PODEM atacar. Você abre mão de um ataque seu na ação de Atacar para o familiar atacar no lugar.',
      'Invocação Investidura do Mestre da Corrente (Tasha): o familiar ganha voo ou natação de 12 m, ataca como ação bônus sua, os ataques dele são mágicos, usa a sua CD de magia e você pode dar a ele resistência a um dano com a sua reação.',
    ],
  },
  {
    id: 'constructos',
    title: 'Constructos do Artificeiro',
    lead: 'Criaturas e engenhocas feitas por você. O automático desta aba usa o seu nível de Artificeiro.',
    points: [
      'Defensor de Aço (Ferreiro de Batalha, nível 3): PV = 2 + Int + 5 × nível, CA 15 (17 no nível 15), deslocamento 12 m. Ataca com ataque de magia (1d8 + proficiência de energia), repara 3 vezes por dia (2d8 + proficiência), desvia ataques como reação e não é surpreendido. Se morrer há menos de 1 hora, você o revive com as ferramentas de ferreiro e um espaço de magia.',
      'Servo Homúnculo (infusão): PV = 1 + Int + nível, CA 13, voa 9 m. Dispara energia a 9 m (1d4 + proficiência), tem Evasão e entrega magias de toque como reação a até 36 m de você. Você só pode ter um.',
      'Canhão Místico (Artilheiro, nível 3): objeto com CA 18 e PV = 5 × nível, que dura 1 hora. Três formas: Lança-chamas (cone de 4,5 m, 2d8 de fogo, salvaguarda de Destreza), Balista de Energia (ataque de magia a 36 m, 2d8 de energia, empurra) e Protetor (PV temporários 1d8 + Int). Você o ativa com uma ação bônus. No nível 9 o dano soma 1d8 e ele pode ser detonado.',
      'Nenhum deles precisa de concentração. O Defensor e o Homúnculo contam como constructos (imunes a veneno e exaustão).',
      'A classe Artificeiro não vem na lista de classes da ficha: digite o nível de Artificeiro no campo "Nível de referência" do companheiro, ou crie a classe como própria (ela é reconhecida pelo nome).',
    ],
  },
  {
    id: 'animal',
    title: 'Companheiro animal (Mestre das Feras)',
    lead: 'Uma besta fiel que cresce com você. Há duas versões; use a que a sua mesa usa.',
    points: [
      'Livro-base (Companheiro do Patrulheiro): besta de ND 1/4 ou menos, Média ou Pequena. Soma a SUA proficiência à CA, às jogadas de ataque e de dano, e às salvaguardas e perícias em que já é proficiente. PV = o maior entre os dela e 4 × nível de Patrulheiro. Você usa uma ação para mandá-la atacar.',
      'Nível 7: pode correr, soltar-se, esquivar ou ajudar em vez de atacar quando você manda. Nível 11: ataca duas vezes. Nível 15: as magias que você conjura em si valem para ela.',
      'Tasha (Companheiro Primal): Fera da Terra, do Mar ou do Céu. PV = 5 + 5 × nível (Céu: 4 + 4 × nível), CA 13 + proficiência, ataque de magia seu, dano com + proficiência, e soma a proficiência a testes e salvaguardas (Vínculo Primal). Obedece a uma ação bônus sua.',
      'Se a fera morrer, você obtém outra passando 8 horas criando um vínculo mágico com uma besta que não seja hostil a você.',
      'O Companheiro Primal vem com o Mestre das Feras; o Espírito de Fogo Selvagem vem do Círculo do Fogo Selvagem do Druida e usa a Forma Selvagem para ser invocado.',
    ],
  },
  {
    id: 'montaria',
    title: 'Montaria e Corcel Convocado',
    lead: 'Cavalgar muda o seu deslocamento e o do animal. Montaria comum e corcel convocado funcionam diferente.',
    points: [
      'Montar e desmontar custa metade do seu deslocamento. A montaria precisa ser pelo menos um tamanho maior que você, ter anatomia pra isso e estar disposta.',
      'Montaria CONTROLADA (a que foi treinada): age na sua iniciativa, vai para onde você manda e só pode Correr, Desengajar ou Esquivar. Montaria INDEPENDENTE (inteligente ou rebelde) age sozinha, com a própria iniciativa.',
      'Se algo empurra a montaria, ou ela fica caída, você faz salvaguarda de Destreza CD 10 ou cai e fica no chão em um espaço a até 1,5 m. Se você for derrubado, o mesmo vale.',
      'Quem ataca pode escolher você ou a montaria como alvo.',
      'Corcel Convocado (Convocar Corcel, 2º nível; o Paladino tem a versão dele): é espírito celestial, feérico ou ínfero com forma de cavalo de guerra, pônei, camelo, alce ou mastim (o mestre pode liberar outras). Inteligência 6, entende o que você fala e fala telepaticamente com você.',
      'Magias que você conjura só em si mesmo também afetam o corcel se ele estiver a até 1,5 m. A 0 PV, ele desaparece, e você pode convocá-lo de novo.',
      'A capacidade de carga de uma montaria é a de um quadrúpede (Força × 7,5 kg × 2); animais de carga podem puxar o dobro disso.',
    ],
  },
  {
    id: 'invocados',
    title: 'Criaturas invocadas por magia (Tasha)',
    lead: 'Espíritos que a magia chama, com números que crescem com o espaço usado.',
    points: [
      'Invocar Fera, Fada, Constructo, Elemental, Morto-vivo, Aberração, Celestial, Ínfero, Espírito Dracônico e a magia de Demônio Maior: todas exigem concentração e a criatura some se você a perder ou ela chegar a 0 PV.',
      'A criatura age na sua iniciativa, logo depois de você, obedece aos seus comandos e, sem comando, só esquiva. Usa o seu ataque e a sua CD de magia.',
      'PV, CA e dano dependem do nível do espaço de magia. Para o Constructo Invocado: PV = 40 + 15 por nível acima do 4º, CA = 13 + nível do espaço, faz metade do nível do espaço (arredondado para baixo) de ataques por ação, e cada material (argila, metal, pedra) dá um traço próprio.',
      'Aqui há modelo pronto só para o Constructo Invocado. Para as outras, use "Criatura invocada em branco" e digite o bloco do livro.',
    ],
  },
  {
    id: 'pets',
    title: 'Pets e animais comuns',
    lead: 'Um bicho que anda com você, sem poderes: a regra é o bom senso do Mestre.',
    points: [
      'Um animal comum não tem ação própria no combate a menos que o Mestre decida. Acalmar ou mandar o bicho fazer algo é um teste de Lidar com Animais (Sabedoria).',
      'Cães de guarda (mastim), cavalos, pôneis e camelos estão no equipamento do livro: mastim 25 po, pônei 30 po, camelo 50 po, cavalo de montaria 75 po, cavalo de guerra 400 po.',
      'Animais comuns usam o bloco da criatura do livro (por isso os modelos de pet trazem PV e CA de livro) e não ganham a proficiência do dono.',
      'Um pet pode virar companheiro de verdade: use o modelo de pet como base e digite os números que o Mestre autorizar, como um dado de vida extra ou um traço de história.',
    ],
  },
  {
    id: 'aba',
    title: 'Como usar esta aba',
    lead: 'Cada companheiro é uma mini-ficha dentro da sua, salva junto com ela.',
    points: [
      'Adicione um modelo do livro ou um em branco. Tudo o que vem do modelo pode ser editado no lápis de cada parte.',
      'Companheiros de regra (Defensor de Aço, Homúnculo, Canhão Místico, bestas da Tasha, Companheiro do Patrulheiro, Espírito de Fogo Selvagem, Constructo Invocado) começam no Automático: PV, CA, bônus de ataque e CD saem do seu nível e do seu bônus de proficiência. No Manual os números ficam do jeito que estão e você digita o que quiser.',
      'Dano e cura mexem nos PV do companheiro (PV temporários absorvem primeiro). Os botões com d20 rolam ataques, dano e testes no cartão de dados da mesa.',
      'Os usos das habilidades voltam sozinhos nos descansos curto e longo do cabeçalho da ficha. A cura dos PV é com você, porque nem todo companheiro se cura sozinho.',
    ],
  },
]
