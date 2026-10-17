// ────────────────────────────────────────────────────────
// Catálogo de erros do Vortable. Cada erro tem um código ESTÁVEL
// (VT-<ÁREA>-<NNN>): o código nunca muda de significado nem é reaproveitado,
// então dá pra procurar um erro antigo na lista e saber exatamente o que foi.
//
//   NET   rede: a ligação direta (WebRTC) ou a reserva entre jogador e mestre
//   SALA  a sessão: o canal de tempo real da campanha, o mestre, entrar e sair
//   SYNC  sincronização: quem está no mapa, versões, zonas desatualizadas
//   BANCO o banco do site (mundos, zonas, bonecos)
//   MOTOR o jogo em si (arquivos, gráficos, erros internos)
//   PERM  permissões
//
// Texto entre chaves ({quem}, {zona}, {ms}...) é trocado pelo valor na hora.
// ────────────────────────────────────────────────────────

/** info: só registro na tela; aviso: algo falhou mas se resolve sozinho; erro: falhou e precisa de atenção; grave: o jogo parou. */
export type VtSeverity = 'info' | 'aviso' | 'erro' | 'grave'

/** O que o pop-up oferece além de fechar. */
export type VtAction = 'reload' | 'retry'

export interface VtErrorDef {
  code: string
  severity: VtSeverity
  title: string
  /** O que aconteceu. */
  what: string
  /** O que fazer. */
  fix: string
  /** Aparece no pop-up de quem teve o erro (false = só fica registrado). */
  popup: boolean
  /** Vai pra lista do mestre e do desenvolvedor. */
  record: boolean
  action?: VtAction
}

const E = (
  code: string, severity: VtSeverity, title: string, what: string, fix: string,
  opts: { popup?: boolean; record?: boolean; action?: VtAction } = {},
): VtErrorDef => ({ code, severity, title, what, fix, popup: opts.popup ?? true, record: opts.record ?? severity !== 'info', action: opts.action })

export const VT_ERRORS = {
  // ── Rede ──────────────────────────────────────────────
  'VT-NET-001': E('VT-NET-001', 'aviso', 'Sem internet',
    'Seu aparelho ficou sem internet.',
    'Confira o Wi-Fi ou os dados móveis. O Vortable volta sozinho quando a internet voltar.'),
  'VT-NET-002': E('VT-NET-002', 'aviso', 'Conexão com o mestre caiu',
    'A ligação com o mestre caiu.',
    'Reconectando sozinho. Se passar de 1 minuto, recarregue a página.'),
  'VT-NET-003': E('VT-NET-003', 'aviso', 'Usando a conexão reserva',
    'Sua rede não deixou abrir a ligação direta com o mestre (comum em 4G e em redes de empresa ou faculdade).',
    'Você entrou pela conexão reserva, pelo servidor: funciona, mas pode ficar um pouco mais lento.'),
  'VT-NET-004': E('VT-NET-004', 'aviso', 'Conexão lenta',
    'A conexão está lenta: as mensagens estão levando {ms} ms para ir e voltar.',
    'Feche downloads e vídeos, chegue mais perto do roteador ou troque de rede.'),
  'VT-NET-005': E('VT-NET-005', 'aviso', 'Conexão demorou a abrir',
    'A ligação com o mestre não abriu a tempo.',
    'Nada a fazer: o Vortable tenta de novo sozinho.', { popup: false }),
  'VT-NET-006': E('VT-NET-006', 'aviso', 'Mensagem não entregue',
    'Uma mensagem do jogo não pôde ser enviada (fila cheia ou ligação fechando).',
    'Nada a fazer: as posições são reenviadas sozinhas a cada segundo.', { popup: false }),
  'VT-NET-007': E('VT-NET-007', 'aviso', 'Jogador parou de responder',
    '{quem} parou de responder e saiu do mapa.',
    'Ele volta sozinho quando a internet dele voltar.'),
  'VT-NET-008': E('VT-NET-008', 'aviso', 'Navegador sem conexão direta',
    'Este navegador não tem a ligação direta (WebRTC).',
    'O jogo usa a conexão reserva. Para ficar mais rápido, use Chrome, Edge, Firefox ou Safari atualizados.'),
  'VT-NET-009': E('VT-NET-009', 'aviso', 'Conexão reserva caiu',
    'A conexão reserva (pelo servidor) caiu.',
    'Reconectando sozinho. Se passar de 1 minuto, recarregue a página.'),
  'VT-NET-010': E('VT-NET-010', 'erro', 'Falha ao montar a conexão',
    'O navegador não conseguiu montar a ligação com {quem} ({detalhe}).',
    'O Vortable tenta de novo sozinho; se repetir sempre, recarregue a página.', { popup: false }),

  // ── Sala (sessão) ─────────────────────────────────────
  'VT-SALA-001': E('VT-SALA-001', 'erro', 'Não entrou na sala',
    'Não foi possível entrar no canal da sessão (servidor de tempo real).',
    'Tentando de novo sozinho. Confira a internet; se continuar, recarregue a página.'),
  'VT-SALA-002': E('VT-SALA-002', 'aviso', 'Canal da sala caiu',
    'O canal da sessão caiu (servidor de tempo real).',
    'Reconectando sozinho. O jogo continua enquanto isso.'),
  'VT-SALA-003': E('VT-SALA-003', 'aviso', 'Sala demorou a responder',
    'O servidor de tempo real demorou demais para responder.',
    'Tentando de novo sozinho. Se continuar, recarregue a página.'),
  'VT-SALA-004': E('VT-SALA-004', 'aviso', 'Mestre sem conexão',
    'O mestre está sem conexão (ou recarregando a página).',
    'Espere: quando ele voltar, o jogo continua de onde parou.'),
  'VT-SALA-005': E('VT-SALA-005', 'aviso', 'Sessão encerrada',
    'O mestre não voltou em {s} segundos e a sessão foi encerrada.',
    'Quando ele iniciar de novo, o botão de entrar destrava.'),
  'VT-SALA-006': E('VT-SALA-006', 'aviso', 'Removido pelo mestre',
    'O mestre tirou você da sessão.',
    'Se foi engano, clique em "Entrar de novo".'),
  'VT-SALA-007': E('VT-SALA-007', 'aviso', 'Aberto em outro lugar',
    'O Vortable foi aberto em outra aba ou aparelho com a sua conta, e esta aba saiu da sessão.',
    'Use só uma. Para jogar por esta, clique em "Usar aqui".'),
  'VT-SALA-008': E('VT-SALA-008', 'erro', 'Mestre em duas abas',
    'O Vortable foi aberto como mestre em outra aba ou aparelho, e esta aba parou de comandar a sessão.',
    'Feche esta aba e use a mais nova (ou recarregue esta para ela voltar a comandar).', { action: 'reload' }),
  'VT-SALA-009': E('VT-SALA-009', 'aviso', 'Mestre não respondeu',
    'O mestre não respondeu ao pedido para ir para {zona}.',
    'Ande até a saída de novo ou chame o mestre no chat.'),
  'VT-SALA-010': E('VT-SALA-010', 'aviso', 'Pedido de passagem perdido',
    'A conexão caiu enquanto você esperava o mestre deixar ir para {zona}.',
    'Quando reconectar, ande até a saída de novo.'),
  'VT-SALA-011': E('VT-SALA-011', 'aviso', 'Jogador desconectado',
    '{quem} não está conectado agora: "{acao}" não foi entregue.',
    'Espere ele voltar e tente de novo.'),

  // ── Sincronização ─────────────────────────────────────
  'VT-SYNC-001': E('VT-SYNC-001', 'info', 'Reconectado',
    'A ligação voltou e o mapa foi atualizado (quem está nele, hora, tempo e zonas).',
    'Nada a fazer.'),
  'VT-SYNC-002': E('VT-SYNC-002', 'aviso', 'Bonecos fantasmas removidos',
    '{n} boneco(s) de quem já tinha saído ficaram no mapa e foram tirados.',
    'Nada a fazer: o mapa se corrigiu sozinho.', { popup: false }),
  'VT-SYNC-003': E('VT-SYNC-003', 'aviso', 'Mensagem ilegível',
    'Chegou uma mensagem do jogo que não dá para ler.',
    'Nada a fazer se for raro. Se repetir, recarregue a página.', { popup: false }),
  'VT-SYNC-004': E('VT-SYNC-004', 'erro', 'Versões diferentes',
    '{quem} está com uma versão diferente do Vortable e não dá para jogar junto.',
    'Recarregue a página (Ctrl+F5). Quem estiver com a versão velha também precisa recarregar.', { action: 'reload' }),
  'VT-SYNC-005': E('VT-SYNC-005', 'info', 'Zona atualizada',
    'A zona mudou enquanto você estava sem conexão e foi recarregada.',
    'Nada a fazer.'),
  'VT-SYNC-006': E('VT-SYNC-006', 'aviso', 'Conexão dupla desligada',
    '{quem} entrou de novo por outra aba ou aparelho; a conexão antiga foi desligada para não duplicar o boneco.',
    'Nada a fazer.', { popup: false }),

  // ── Banco ─────────────────────────────────────────────
  'VT-BANCO-001': E('VT-BANCO-001', 'erro', 'Mundo não carregou',
    'Não deu para ler o mundo no servidor.',
    'Confira a internet e clique em "Tentar de novo".', { action: 'retry' }),
  'VT-BANCO-002': E('VT-BANCO-002', 'erro', 'Zona não carregou',
    'Não deu para ler a zona no servidor.',
    'Confira a internet e tente de novo.'),
  'VT-BANCO-003': E('VT-BANCO-003', 'grave', 'Mudanças não foram salvas',
    'As mudanças da zona ou do mundo NÃO foram salvas no servidor.',
    'Não feche o editor: quando a internet voltar, salve de novo.'),
  'VT-BANCO-004': E('VT-BANCO-004', 'erro', 'Boneco não carregou',
    'Não deu para ler o boneco no servidor.',
    'Confira a internet e clique em "Tentar de novo".', { action: 'retry' }),
  'VT-BANCO-005': E('VT-BANCO-005', 'erro', 'Personagem não foi salvo',
    'Não deu para salvar o personagem ou boneco no servidor.',
    'Confira a internet e salve de novo.'),
  'VT-BANCO-006': E('VT-BANCO-006', 'grave', 'Login expirado',
    'Seu login no site expirou.',
    'Recarregue a página; se pedir, entre de novo na sua conta.', { action: 'reload' }),
  'VT-BANCO-007': E('VT-BANCO-007', 'erro', 'Servidor não respondeu',
    'O servidor do Vorterium não respondeu a tempo.',
    'Espere alguns segundos e tente de novo.'),
  'VT-BANCO-008': E('VT-BANCO-008', 'erro', 'Mundos não carregaram',
    'Não deu para ler a lista de mundos da campanha.',
    'O Vortable tenta de novo a cada 20 segundos. Confira a internet.'),
  'VT-BANCO-009': E('VT-BANCO-009', 'erro', 'Mundo não abriu',
    'Não deu para abrir o mundo para os jogadores.',
    'Tente de novo em alguns segundos.'),
  'VT-BANCO-010': E('VT-BANCO-010', 'aviso', 'Posição do NPC não salva',
    'O NPC mudou de lugar na tela, mas a nova posição não foi salva no servidor.',
    'Quem entrar depois pode ver o NPC no lugar antigo. Mova-o de novo quando a internet voltar.', { popup: false }),
  'VT-BANCO-011': E('VT-BANCO-011', 'erro', 'Falha no servidor',
    'O servidor recusou um pedido do Vortable ({detalhe}).',
    'Tente de novo. Se repetir, mande o código pro desenvolvedor.'),

  // ── Motor (o jogo) ────────────────────────────────────
  'VT-MOTOR-001': E('VT-MOTOR-001', 'grave', 'Arquivos do jogo não carregaram',
    'Os arquivos do Vortable não carregaram (o site pode ter sido atualizado agora).',
    'Recarregue a página.', { action: 'reload' }),
  'VT-MOTOR-002': E('VT-MOTOR-002', 'erro', 'O jogo não abriu',
    'O jogo deu erro ao abrir ({detalhe}).',
    'Clique em "Tentar de novo"; se repetir, recarregue a página.', { action: 'retry' }),
  'VT-MOTOR-003': E('VT-MOTOR-003', 'erro', 'Seu boneco não carregou',
    'As imagens do seu boneco não carregaram.',
    'Confira a internet e recarregue a página.', { action: 'reload' }),
  'VT-MOTOR-004': E('VT-MOTOR-004', 'aviso', 'Boneco de outro jogador não carregou',
    'As imagens do boneco de outro jogador não carregaram.',
    'Ele fica invisível para você até ele trocar de zona ou você recarregar.', { popup: false }),
  'VT-MOTOR-005': E('VT-MOTOR-005', 'aviso', 'NPC não carregou',
    'As imagens de um NPC não carregaram.',
    'Recarregue a página se ele fizer falta.', { popup: false }),
  'VT-MOTOR-006': E('VT-MOTOR-006', 'erro', 'Tela do jogo apagou',
    'A placa de vídeo do aparelho reiniciou e a tela do jogo apagou.',
    'Espere alguns segundos; se não voltar, recarregue a página.', { action: 'reload' }),
  'VT-MOTOR-007': E('VT-MOTOR-007', 'erro', 'Erro interno do jogo',
    'O jogo encontrou um erro interno ({detalhe}).',
    'Se algo parou de funcionar, recarregue a página e mande o código pro desenvolvedor.'),
  'VT-MOTOR-008': E('VT-MOTOR-008', 'erro', 'Erro ao tratar mensagem',
    'O jogo deu erro ao tratar uma mensagem da rede ({detalhe}).',
    'Nada a fazer se for raro; os outros continuam recebendo normalmente.', { popup: false }),
  'VT-MOTOR-009': E('VT-MOTOR-009', 'erro', 'Mundo não abriu no jogo',
    'O jogo não conseguiu ler o mundo e abriu uma zona vazia.',
    'Confira a internet e recarregue a página.', { action: 'reload' }),
  'VT-MOTOR-010': E('VT-MOTOR-010', 'aviso', 'Saída sem destino',
    'Uma saída do mapa leva para uma zona que não existe mais.',
    'Mestre: abra o editor e religue essa saída.', { popup: false }),
  'VT-MOTOR-011': E('VT-MOTOR-011', 'aviso', 'Imagem ou som não carregou',
    'Uma imagem, peça de roupa ou som do mapa não carregou ({detalhe}).',
    'Se fizer falta, recarregue a página. Se repetir, mande o código pro desenvolvedor.', { popup: false }),

  // ── Permissões ────────────────────────────────────────
  'VT-PERM-001': E('VT-PERM-001', 'grave', 'Sem acesso à sala',
    'Sua conta não tem acesso à sessão desta campanha.',
    'Confira se você ainda é membro da campanha; se não, peça ao mestre um convite novo.'),
  'VT-PERM-002': E('VT-PERM-002', 'erro', 'Sem permissão',
    'O servidor não deixou fazer isso com a sua conta ({detalhe}).',
    'Só o mestre (ou o dono do boneco) pode fazer isso. Se você deveria poder, mande o código pro desenvolvedor.'),

  // ── Geral ─────────────────────────────────────────────
  'VT-GERAL-001': E('VT-GERAL-001', 'erro', 'Erro inesperado',
    'Aconteceu um erro que o Vortable não conhece ({detalhe}).',
    'Recarregue a página se algo parou de funcionar e mande o código pro desenvolvedor.'),
} as const satisfies Record<string, VtErrorDef>

export type VtCode = keyof typeof VT_ERRORS

export const VT_AREAS: Record<string, string> = {
  NET: 'Rede', SALA: 'Sala', SYNC: 'Sincronização', BANCO: 'Banco', MOTOR: 'Motor', PERM: 'Permissões', GERAL: 'Geral',
}

export function vtDef(code: string): VtErrorDef {
  return (VT_ERRORS as Record<string, VtErrorDef>)[code] ?? {
    code, severity: 'erro', title: 'Erro desconhecido', what: `Código ${code} (não está no catálogo desta versão).`,
    fix: 'Recarregue a página para atualizar o site.', popup: true, record: true,
  }
}

/** Troca {chave} pelos valores (o que faltar some). */
export function fillText(text: string, vars: Record<string, string | number | undefined> = {}): string {
  return text
    .replace(/\{(\w+)\}/g, (_m, k: string) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : '…'))
    .replace(/ \(…\)/g, '')
}

export const SEVERITY_LABEL: Record<VtSeverity, string> = { info: 'Info', aviso: 'Aviso', erro: 'Erro', grave: 'Grave' }
