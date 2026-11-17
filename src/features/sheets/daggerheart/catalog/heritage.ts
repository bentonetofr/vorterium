import type { DhAncestry, DhCommunity } from '../model/types'

// ────────────────────────────────────────────────────────
// Herança do personagem: ancestralidade (duas habilidades) e comunidade (uma habilidade). Livro Básico, capítulo 1.
// ────────────────────────────────────────────────────────

export const ANCESTRIES: DhAncestry[] = [
  {
    key: 'anao', name: 'Anão',
    description: 'Humanoides baixos, de estrutura quadrada, musculatura densa e cabelo grosso. Pele e unhas ricas em queratina os tornam naturalmente resistentes, e muitos decoram o corpo com tatuagens, piercings e até gemas incrustadas. Vivem cerca de 250 anos.',
    features: [
      { name: 'Pele Espessa', text: 'Quando sofrer dano menor, você pode marcar 2 Pontos de Fadiga em vez de marcar 1 Ponto de Vida.' },
      { name: 'Vigoroso', text: 'Gaste 3 Pontos de Esperança para reduzir à metade o dano físico sofrido.' },
    ],
  },
  {
    key: 'clank', name: 'Clank',
    description: 'Seres mecânicos conscientes, feitos de metal, madeira, pedra e outros materiais. Podem parecer humanoides, animais ou até objetos, com corpos especializados: garras, rodas, armas embutidas. A forma é quase imortal enquanto houver peças novas, mas a mente se desgasta com o tempo.',
    features: [
      { name: 'Projeto Intencional', text: 'Decida quem construiu você e para que propósito. Na criação do personagem, escolha uma das suas Experiências que mais se alinhe a esse propósito e receba +1 de bônus permanente nela.' },
      { name: 'Eficiente', text: 'Ao fazer um descanso curto, você pode escolher um movimento de descanso longo em vez de um de descanso curto.' },
    ],
  },
  {
    key: 'drakona', name: 'Drakona',
    description: 'Parecem dragões sem asas em forma humanoide, com escamas grossas que oferecem excelente armadura natural e um poderoso sopro elemental. Têm de 1,5 a 2 metros de altura, dentes longos e afiados, e vivem cerca de 350 anos.',
    features: [
      { name: 'Escamas', text: 'Suas escamas servem como proteção natural. Quando sofrer dano grave, você pode marcar 1 Ponto de Fadiga para marcar 1 Ponto de Vida a menos.' },
      { name: 'Sopro Elemental', text: 'Escolha um elemento para seu sopro (como eletricidade, fogo ou gelo). Você pode usar esse sopro contra um alvo ou grupo de alvos em alcance muito próximo, tratando-o como uma arma de Instinto que causa d8 de dano mágico com sua Proficiência.' },
    ],
  },
  {
    key: 'elfo', name: 'Elfo',
    description: 'Humanoides altos, de orelhas pontudas e sentidos aguçados. Em vez de dormir, entram em um transe celestial que os faz descansar bem em pouco tempo. Alguns têm uma “forma mística”: sardas celestiais, folhas ou flores no cabelo, olhos que cintilam como fogo. Vivem cerca de 350 anos.',
    features: [
      { name: 'Reação Rápida', text: 'Marque 1 Ponto de Fadiga para receber vantagem em um teste de reação.' },
      { name: 'Transe Celestial', text: 'Durante um descanso, você pode entrar em um transe celestial para escolher um movimento de descanso adicional.' },
    ],
  },
  {
    key: 'fada', name: 'Fada',
    description: 'Humanoides alados com traços de inseto, de 60 cm a 1,5 m de altura (algumas passam de 2 m). Todas têm asas membranosas e passam por uma metamorfose que define a aparência que terão pelos cerca de 50 anos de vida.',
    features: [
      { name: 'Testar a Sorte', text: 'Uma vez por sessão, depois que você ou um aliado voluntário em alcance próximo fizer um teste, você pode gastar 3 Pontos de Esperança para rolar novamente os Dados de Dualidade.' },
      { name: 'Asas', text: 'Você pode voar. Enquanto estiver voando, e depois que um adversário atacar você, você pode marcar 1 Ponto de Fadiga para receber +2 de bônus na Evasão contra esse ataque.' },
    ],
  },
  {
    key: 'fauno', name: 'Fauno',
    description: 'Parecem cabras humanoides, com chifres curvos, pupilas retangulares e cascos fendidos. Torso humanoide e parte de baixo coberta de pelos densos. Têm membros longos e dão coices poderosos. Vivem cerca de 225 anos e, com a idade, ficam mais caprinos.',
    features: [
      { name: 'Salto Caprino', text: 'Você pode saltar para qualquer ponto em alcance próximo como se estivesse usando seu movimento normal, o que lhe permite transpor obstáculos, atravessar fendas no solo ou escalar barreiras com facilidade.' },
      { name: 'Coice', text: 'Quando você acertar um ataque contra um alvo em alcance corpo a corpo, você pode marcar 1 Ponto de Fadiga para dar um coice, causando 2d6 de dano adicional. Ao fazer isso, você empurra o adversário ou a si mesmo para alcance muito próximo.' },
    ],
  },
  {
    key: 'firbolg', name: 'Firbolg',
    description: 'Humanoides bovinos de nariz largo e orelhas caídas, às vezes com cabeça inteira de gado (os minotauros). Altos e musculosos, de 1,5 a 2 metros, cobertos de pelos em tons terrosos ou pastéis. Vivem cerca de 150 anos.',
    features: [
      { name: 'Investida', text: 'Quando tiver sucesso em um teste de Agilidade para se mover de alcance distante ou muito distante até alcance corpo a corpo de um ou mais alvos, você pode marcar 1 Ponto de Fadiga para causar 1d12 de dano físico a todos os alvos em alcance corpo a corpo.' },
      { name: 'Inabalável', text: 'Quando for marcar 1 Ponto de Fadiga, role 1d6. Com resultado 6, não o marque.' },
    ],
  },
  {
    key: 'fungril', name: 'Fungril',
    description: 'Parecem cogumelos humanoides, mais humanoides ou mais fúngicos, em cores que vão de tons terrosos a vermelhos, amarelos, roxos e azuis. Não há um formato único: a altura vai de 60 cm a 2 m. Vivem cerca de 300 anos e se comunicam de modo não verbal e pela rede micelial.',
    features: [
      { name: 'Conexão Fungril', text: 'Faça um teste de Instinto (12) para conversar com outros membros da sua ancestralidade pela rede micelial. Em um sucesso, você pode se comunicar a qualquer distância.' },
      { name: 'Vínculo Mortal', text: 'Enquanto estiver tocando um cadáver que tenha morrido recentemente, você pode marcar 1 Ponto de Fadiga para extrair dele uma memória relacionada a uma emoção ou sensação específica à sua escolha.' },
    ],
  },
  {
    key: 'galapa', name: 'Galapa',
    description: 'Parecem tartarugas antropomórficas, com uma grande carapaça arredondada na qual podem se recolher. De 1,2 a 1,8 m, em tons de verde e marrom, com padrões únicos no casco. Em geral se movem devagar e vivem cerca de 150 anos.',
    features: [
      { name: 'Carapaça', text: 'Receba um bônus nos limiares de dano igual à sua Proficiência.' },
      { name: 'Retração', text: 'Marque 1 Ponto de Fadiga para entrar na sua carapaça. Enquanto estiver dentro dela, você tem resistência a dano físico, desvantagem em testes e não pode se mover.' },
    ],
  },
  {
    key: 'gigante', name: 'Gigante',
    description: 'Humanoides imponentes, de ombros largos, braços longos e de um a três olhos (os de um só olho são os ciclopes). Adultos medem de 2 a 2,6 m e são naturalmente musculosos. Nascem sem olhos e ficam cegos no primeiro ano. Vivem cerca de 75 anos.',
    features: [
      { name: 'Resistência', text: 'Receba 1 espaço de Vida adicional na criação do personagem.' },
      { name: 'Alcance', text: 'Trate qualquer arma, talento, feitiço ou outra habilidade com alcance corpo a corpo como se tivesse alcance muito próximo.' },
    ],
  },
  {
    key: 'goblin', name: 'Goblin',
    description: 'Humanoides pequenos de olhos grandes e enormes orelhas membranosas, com audição e visão aguçadas, até no escuro. Medem de 90 cm a 1,2 m e têm pele e olhos de cores muito variadas. Usam a posição das orelhas para se comunicar. Vivem cerca de 100 anos.',
    features: [
      { name: 'Passo Firme', text: 'Você ignora desvantagem em testes de Agilidade.' },
      { name: 'Cheiro de Perigo', text: 'Uma vez por descanso, marque 1 Ponto de Fadiga para forçar um adversário a refazer um teste de ataque contra você ou um aliado em alcance muito próximo.' },
    ],
  },
  {
    key: 'humano', name: 'Humano',
    description: 'Reconhecidos pelas mãos ágeis, orelhas arredondadas e corpos feitos para resistir. De cerca de 1,5 a 2 m, com ampla variedade de formas. Adaptam-se com facilidade a climas hostis e vivem cerca de 100 anos.',
    features: [
      { name: 'Resiliência', text: 'Receba 1 espaço de Fadiga adicional na criação do personagem.' },
      { name: 'Adaptabilidade', text: 'Ao falhar em um teste que usou uma das suas Experiências, você pode marcar 1 Ponto de Fadiga para refazer a rolagem.' },
    ],
  },
  {
    key: 'infernis', name: 'Infernis',
    description: 'Humanoides de caninos afiados, orelhas pontudas e chifres, descendentes de demônios dos Círculos Inferiores. Têm de 1,5 a 2 m, dedos longos e unhas pontudas; alguns têm cauda. Seu “aspecto apavorante” se manifesta com emoções fortes ou de propósito. Vivem cerca de 350 anos.',
    features: [
      { name: 'Destemido', text: 'Quando rolar com Medo, você pode marcar 2 Pontos de Fadiga para rolar com Esperança em vez disso.' },
      { name: 'Aspecto Apavorante', text: 'Você tem vantagem em testes para intimidar criaturas hostis.' },
    ],
  },
  {
    key: 'katari', name: 'Katari',
    description: 'Humanoides felinos de garras retráteis, pupilas verticais e orelhas triangulares que giram quase 180 graus. Pelagem macia em muitos padrões e bigodes que ajudam na percepção; cerca de metade tem cauda. De 90 cm a 2 m, vivem cerca de 150 anos.',
    features: [
      { name: 'Instinto Felino', text: 'Ao fazer um teste de Agilidade, você pode gastar 2 Pontos de Esperança para rolar novamente seu Dado de Esperança.' },
      { name: 'Garras Retráteis', text: 'Faça um teste de Agilidade para arranhar um alvo em alcance corpo a corpo. Em um sucesso, ele fica temporariamente Vulnerável.' },
    ],
  },
  {
    key: 'orc', name: 'Orc',
    description: 'Humanoides de traços quadrados e presas de javali que saem da mandíbula inferior e crescem a vida toda; muitos as ornamentam. Orelhas pontudas, pele e cabelo em tons de verde, azul, rosa ou cinza e porte musculoso, de 1,5 a 2 m. Vivem cerca de 125 anos.',
    features: [
      { name: 'Robusto', text: 'Quando você tiver apenas 1 Ponto de Vida restante, ataques contra você têm desvantagem.' },
      { name: 'Presas', text: 'Quando acertar um ataque contra um alvo em alcance corpo a corpo, você pode gastar 1 Ponto de Esperança para perfurá-lo com as presas, causando 1d6 de dano adicional.' },
    ],
  },
  {
    key: 'pequenino', name: 'Pequenino',
    description: 'Humanoides pequenos, de pés grandes e peludos e orelhas redondas e proeminentes. Têm de 90 cm a 1,2 m e a aparência continua jovem mesmo na velhice. Possuem uma bússola interna natural e olfato e audição aguçados. Vivem cerca de 150 anos.',
    features: [
      { name: 'Talismã da Sorte', text: 'No início de cada sessão, todos os membros do seu grupo recebem 1 Ponto de Esperança.' },
      { name: 'Senso de Direção', text: 'Ao rolar 1 no seu Dado de Esperança, você pode rolá-lo novamente.' },
    ],
  },
  {
    key: 'quacho', name: 'Quacho',
    description: 'Parecem sapos antropomórficos, de olhos saltados e mãos e pés com membranas. Pele lisa e úmida, às vezes verrugosa; de 90 cm a 1,4 m, se movem principalmente aos saltos. Nascem de ovos na água, passam por girinos e vivem cerca de 100 anos.',
    features: [
      { name: 'Anfíbio', text: 'Você pode respirar e se movimentar naturalmente debaixo d’água.' },
      { name: 'Linguarudo', text: 'Você pode usar sua língua para agarrar coisas em alcance próximo. Marque 1 Ponto de Fadiga para usá-la como uma arma de Acuidade com alcance próximo que causa d12 de dano físico com sua Proficiência.' },
    ],
  },
  {
    key: 'simio', name: 'Símio',
    description: 'Parecem macacos e símios antropomórficos, de membros longos e pés preênseis. De 60 cm a 1,8 m, usam os pés com destreza para trabalho, comunicação e combate; alguns têm cauda preênsil. Escaladores natos, vivem cerca de 100 anos.',
    features: [
      { name: 'Escalador Natural', text: 'Você tem vantagem em testes de Agilidade que envolvam equilibrar-se e escalar.' },
      { name: 'Ágil', text: 'Receba +1 de bônus permanente na Evasão na criação do personagem.' },
    ],
  },
]

export const COMMUNITIES: DhCommunity[] = [
  {
    key: 'aristocratica', name: 'Aristocrática',
    description: 'Você está acostumado a uma vida de elegância, opulência e prestígio no topo da sociedade. Aristocratas costumam ter imensa riqueza material (ouro, terras ou o controle dos meios de produção), e isso sempre vem com poder e influência.',
    traits: ['Afável', 'Franco', 'Ardiloso', 'Empreendedor', 'Ostentoso', 'Imperturbável'],
    feature: { name: 'Privilégio', text: 'Você tem vantagem em testes para se relacionar com nobres, negociar preços ou se aproveitar da sua reputação para conseguir o que quer.' },
  },
  {
    key: 'disciplinada', name: 'Disciplinada',
    description: 'Você vem de um povo que se concentra em disciplina ou fé e defende um conjunto de princípios. Comunidades disciplinadas costumam estar entre as mais poderosas, alinhando a sociedade em torno de um deus, doutrina ou ofício; as mais temidas se estruturam em torno do poderio militar.',
    traits: ['Ambicioso', 'Benevolente', 'Cínico', 'Estoico', 'Pensativo', 'Prudente'],
    feature: { name: 'Princípios', text: 'Anote três ditados ou valores com os quais você cresceu. Uma vez por descanso, ao descrever como incorpora um desses princípios na ação atual, você pode rolar 1d20 como seu Dado de Esperança.' },
  },
  {
    key: 'erudita', name: 'Erudita',
    description: 'Você vem de uma sociedade que valoriza a prática acadêmica e política. Comunidades eruditas prezam o conhecimento (preservação histórica, avanço político, estudo científico, compilação de saberes e mitos), em geral em instituições erguidas em polos da civilização.',
    traits: ['Direto', 'Eloquente', 'Inquisitivo', 'Paciente', 'Rapsódico', 'Espirituoso'],
    feature: { name: 'Culto', text: 'Você tem vantagem em testes que envolvam a história, a cultura ou a política de um lugar ou pessoa importante.' },
  },
  {
    key: 'fora_da_lei', name: 'Fora da Lei',
    description: 'Você vem de um grupo que opera fora da lei: criminosos, vigaristas e golpistas, unidos por objetivos desonestos e meios inteligentes. Falsificação, furto, contrabando e violência são habilidades comuns. Seus códigos de honra são rígidos, e quebrá-los pode ter um fim terrível.',
    traits: ['Calculista', 'Esperto', 'Formidável', 'Perceptivo', 'Astuto', 'Tenaz'],
    feature: { name: 'Malandro', text: 'Você tem vantagem em testes para negociar com criminosos, perceber mentiras ou encontrar um lugar seguro para se esconder.' },
  },
  {
    key: 'maritima', name: 'Marítima',
    description: 'Você viveu em, ou perto de, um grande corpo d’água. Comunidades marítimas são construídas, física e culturalmente, em torno de suas águas: portos, ilhas, navios. Aprendem a pescar cedo e a prender a respiração e nadar nas águas mais turbulentas.',
    traits: ['Franco', 'Cooperativo', 'Exuberante', 'Feroz', 'Resoluto', 'Calejado'],
    feature: { name: 'Conhecer a Maré', text: 'Você sente o fluxo da vida. Ao rolar com Medo, coloque 1 marcador na sua carta de comunidade. Você pode acumular um número de marcadores igual ao seu nível. Antes de fazer um teste, gaste qualquer número desses marcadores para receber +1 de bônus por marcador gasto. No fim de cada sessão, perca os marcadores não utilizados.' },
  },
  {
    key: 'montanhesa', name: 'Montanhesa',
    description: 'Você chamou de lar os picos rochosos e penhascos da montanha. Quem vive nas montanhas se considera mais resistente que a maioria, adaptando-se com tecnologias e equipamentos próprios para transportar pessoas e produtos por terreno difícil.',
    traits: ['Ousado', 'Resistente', 'Indomável', 'Leal', 'Reservado', 'Teimoso'],
    feature: { name: 'Firme', text: 'Você tem vantagem em testes para cruzar abismos e saliências, orientar-se em ambientes inóspitos e usar seus conhecimentos de sobrevivência.' },
  },
  {
    key: 'nomade', name: 'Nômade',
    description: 'Você viveu como nômade, sem lar permanente e vendo uma grande variedade de culturas. Nômades valorizam menos acumular bens e mais ganhar informações, habilidades e conexões, e são conhecidos pela lealdade inabalável.',
    traits: ['Inescrutável', 'Magnânimo', 'Alegre', 'Confiável', 'Esperto', 'Heterodoxo'],
    feature: { name: 'Mochila de Nômade', text: 'Adicione uma Mochila de Nômade ao seu inventário. Uma vez por sessão, você pode gastar 1 Ponto de Esperança para tirar dela um item mundano útil para a situação. Colabore com o mestre para definir esse item.' },
  },
  {
    key: 'silvestre', name: 'Silvestre',
    description: 'Você viveu nas profundezas da floresta. Comunidades silvestres se dedicam a conservar suas terras e muitas têm laços religiosos ou culturais com a fauna local, integrando vilas e cidades ao ambiente natural sem perturbar plantas e animais.',
    traits: ['Resistente', 'Leal', 'Acolhedor', 'Recluso', 'Sagaz', 'Vibrante'],
    feature: { name: 'Pés Leves', text: 'Seu movimento é naturalmente silencioso. Você tem vantagem em testes para se mover sem ser ouvido.' },
  },
  {
    key: 'subterranea', name: 'Subterrânea',
    description: 'Você vem de uma sociedade subterrânea, que pode ficar logo abaixo das cidades de outros povos ou bem mais fundo, de tocas familiares a metrópoles em cavernas. Povos subterrâneos são conhecidos pela ousadia e pelas grandes obras de arquitetura e engenharia.',
    traits: ['Sereno', 'Esquivo', 'Indomável', 'Inovador', 'Engenhoso', 'Despretensioso'],
    feature: { name: 'Habituado à Penumbra', text: 'Quando estiver em uma área de pouca luz ou sombra forte, você tem vantagem em testes para se esconder, investigar ou perceber detalhes nessa área.' },
  },
]

const A_BY_KEY = new Map(ANCESTRIES.map((a) => [a.key, a]))
const C_BY_KEY = new Map(COMMUNITIES.map((c) => [c.key, c]))

export function ancestry(key: string | null | undefined): DhAncestry | undefined {
  return key ? A_BY_KEY.get(key) : undefined
}

export function community(key: string | null | undefined): DhCommunity | undefined {
  return key ? C_BY_KEY.get(key) : undefined
}
