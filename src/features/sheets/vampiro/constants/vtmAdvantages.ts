import type { VtmBook } from './vtmPowers'

// ────────────────────────────────────────────────────────
// Vantagens (V5): Antecedentes, Méritos e Defeitos com os pontos que cada
// um pode custar. Nome traduzido por nós, original ao lado. Os de
// sangue-ralo e de Caitiff são só pra esses personagens. "dots" é a lista
// de valores permitidos (Linguística, por exemplo, é 1 por idioma).
// ────────────────────────────────────────────────────────

export type VtmAdvKind = 'background' | 'merit' | 'flaw'

export interface VtmAdvDef {
  key:      string
  kind:     VtmAdvKind
  category: string
  name:     string
  en:       string
  dots:     number[]
  books:    VtmBook[]
  /** Só pra Caitiff ou sangue-ralo. */
  only?:    'caitiff' | 'sangue_ralo'
  /** O que escrever na anotação (ex.: qual idioma). */
  hint?:    string
}

export const VTM_ADV_KIND_LABEL: Record<VtmAdvKind, string> = {
  background: 'Antecedente',
  merit:      'Mérito',
  flaw:       'Defeito',
}

const r = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

type Row = [key: string, kind: VtmAdvKind, name: string, en: string, dots: number[], books: VtmBook[], extra?: { only?: 'caitiff' | 'sangue_ralo'; hint?: string }]

function cat(category: string, rows: Row[]): VtmAdvDef[] {
  return rows.map(([key, kind, name, en, dots, books, extra]) => ({ key, kind, category, name, en, dots, books, ...extra }))
}

const B = 'background' as const
const M = 'merit' as const
const F = 'flaw' as const

export const VTM_ADVANTAGES: VtmAdvDef[] = [
  // ── Antecedentes ──
  ...cat('Aliados', [
    ['aliados', B, 'Aliados', 'Allies', r(1, 6), ['core'], { hint: 'quem são (eficiência + confiabilidade)' }],
    ['inimigo', F, 'Inimigo', 'Enemy', r(1, 5), ['core'], { hint: 'quem é' }],
  ]),
  ...cat('Contatos', [
    ['contatos', B, 'Contatos', 'Contacts', r(1, 3), ['core'], { hint: 'em que meio' }],
  ]),
  ...cat('Domínio', [
    ['dominio', B, 'Domínio', 'Domain', r(1, 5), ['core'], { hint: 'onde' }],
  ]),
  ...cat('Fama', [
    ['fama', B, 'Fama', 'Fame', r(1, 5), ['core'], { hint: 'conhecido por quê' }],
    ['influenciador', M, 'Influenciador', 'Influencer', [1], ['lsc'], { hint: 'precisa de Fama 2+' }],
    ['fama_duradoura', M, 'Fama Duradoura', 'Enduring Fame', [1], ['lsc'], { hint: 'precisa de Fama 3+' }],
    ['segredo_sombrio', F, 'Segredo Sombrio', 'Dark Secret', r(1, 5), ['core', 'im'], { hint: 'qual segredo' }],
    ['infamia', F, 'Infâmia', 'Infamy', r(1, 5), ['im']],
    ['banido_de', F, 'Banido de', 'Banned From', r(1, 3), ['im'], { hint: 'de onde' }],
  ]),
  ...cat('Influência', [
    ['influencia', B, 'Influência', 'Influence', r(1, 5), ['core'], { hint: 'em qual meio' }],
    ['antipatizado', F, 'Antipatizado', 'Disliked', [1], ['core'], { hint: 'por quem' }],
    ['desprezado', F, 'Desprezado', 'Despised', [2], ['core'], { hint: 'por quem' }],
  ]),
  ...cat('Refúgio', [
    ['refugio', B, 'Refúgio', 'Haven', r(1, 3), ['core']],
    ['sem_refugio', F, 'Sem Refúgio', 'No Haven', [1], ['core']],
    ['refugio_arsenal', M, 'Refúgio: Arsenal Escondido', 'Hidden Armory', r(1, 5), ['pg']],
    ['refugio_cela', M, 'Refúgio: Cela', 'Cell', r(1, 5), ['core']],
    ['refugio_vigias', M, 'Refúgio: Vigias', 'Watchmen', r(1, 5), ['core']],
    ['refugio_laboratorio', M, 'Refúgio: Laboratório', 'Laboratory', r(1, 5), ['pg']],
    ['refugio_biblioteca', M, 'Refúgio: Biblioteca', 'Library', r(1, 5), ['core']],
    ['refugio_localizacao', M, 'Refúgio: Localização', 'Location', [1], ['pg']],
    ['refugio_luxo', M, 'Refúgio: Luxo', 'Luxury', [1], ['pg']],
    ['refugio_passagem', M, 'Refúgio: Passagem Secreta', 'Postern', r(1, 5), ['pg']],
    ['refugio_seguranca', M, 'Refúgio: Sistema de Segurança', 'Security System', r(1, 5), ['core']],
    ['refugio_cirurgia', M, 'Refúgio: Sala de Cirurgia', 'Surgery', [1], ['pg']],
    ['refugio_protecao', M, 'Refúgio: Proteção Mística', 'Warding', r(1, 5), ['pg']],
    ['refugio_solo_sagrado', M, 'Refúgio: Solo Sagrado', 'Holy Ground', [1], ['cob']],
    ['refugio_santuario', M, 'Refúgio: Santuário', 'Shrine', r(1, 3), ['cob']],
    ['refugio_negocio', M, 'Refúgio: Estabelecimento Comercial', 'Business Establishment', r(2, 3), ['pg']],
    ['refugio_furcus', M, 'Refúgio: Furcus', 'Furcus', r(1, 3), ['pg']],
    ['refugio_oficina', M, 'Refúgio: Oficina', 'Machine Shop', r(1, 5), ['pg']],
    ['refugio_movel', M, 'Refúgio: Móvel', 'Mobile', r(1, 3), ['lsc']],
    ['refugio_assustador', F, 'Refúgio: Assustador', 'Creepy', [1], ['core']],
    ['refugio_assombrado', F, 'Refúgio: Assombrado', 'Haunted', r(1, 5), ['core']],
    ['refugio_comprometido', F, 'Refúgio: Comprometido', 'Compromised', [2], ['core']],
    ['refugio_compartilhado', F, 'Refúgio: Compartilhado', 'Shared', r(1, 2), ['pg']],
  ]),
  ...cat('Rebanho', [
    ['rebanho', B, 'Rebanho', 'Herd', r(1, 5), ['core'], { hint: 'quem são' }],
    ['predador_obvio', F, 'Predador Óbvio', 'Obvious Predator', [2], ['core']],
  ]),
  ...cat('Máscara', [
    ['mascara', B, 'Máscara', 'Mask', r(1, 2), ['core'], { hint: 'a identidade falsa' }],
    ['zerado', M, 'Zerado', 'Zeroed', [1], ['core']],
    ['sapateiro', M, 'Sapateiro', 'Cobbler', [1], ['pg']],
    ['cadaver_conhecido', F, 'Cadáver Conhecido', 'Known Corpse', [1], ['core']],
    ['corpo_vazio_conhecido', F, 'Corpo Vazio Conhecido', 'Known Blankbody', [2], ['core']],
  ]),
  ...cat('Mawla', [
    ['mawla', B, 'Mawla', 'Mawla', r(1, 5), ['core'], { hint: 'quem é o mentor' }],
    ['adversario', F, 'Adversário', 'Adversary', r(1, 5), ['core'], { hint: 'quem é' }],
    ['senhor_secreto', F, 'Senhor Secreto', 'Secret Master', [1], ['gw']],
    ['cria_vergonhosa', F, 'Cria Vergonhosa', 'Shameful Childe', [1], ['im']],
    ['pilar_abracado', F, 'Pilar Abraçado pelos Inimigos', 'Touchstone Embraced by your Enemies', [2], ['im']],
  ]),
  ...cat('Recursos', [
    ['recursos', B, 'Recursos', 'Resources', r(1, 5), ['core'], { hint: 'de onde vem o dinheiro' }],
    ['destituido', F, 'Destituído', 'Destitute', [1], ['core']],
  ]),
  ...cat('Lacaios', [
    ['lacaios', B, 'Lacaios', 'Retainers', r(1, 3), ['core'], { hint: 'quem são' }],
    ['perseguidores', F, 'Perseguidores', 'Stalkers', [1], ['core']],
  ]),
  ...cat('Status', [
    ['status', B, 'Status', 'Status', r(1, 5), ['core'], { hint: 'em qual seita' }],
    ['segredos_da_cidade', M, 'Segredos da Cidade', 'City Secrets', r(1, 3), ['pg']],
    ['suspeito', F, 'Suspeito', 'Suspect', [1], ['core']],
    ['rejeitado', F, 'Rejeitado', 'Shunned', [2], ['core']],
    ['mortal_fingido', F, 'Mortal Fingido', 'Mortal Pretender', [1], ['lsc']],
  ]),

  // ── Méritos e Defeitos ──
  ...cat('Linguística', [
    ['linguistica', M, 'Linguística', 'Linguistics', r(1, 5), ['core'], { hint: 'um idioma por ponto' }],
    ['analfabeto', F, 'Analfabeto', 'Illiterate', [2], ['core']],
  ]),
  ...cat('Aparência', [
    ['belo', M, 'Belo', 'Beautiful', [2], ['core']],
    ['deslumbrante', M, 'Deslumbrante', 'Stunning', [4], ['core']],
    ['rosto_famoso', M, 'Rosto Famoso', 'Famous Face', [1], ['pg']],
    ['ingenuo', M, 'Ingênuo', 'Ingénue', [1], ['pg']],
    ['traco_marcante', M, 'Traço Marcante', 'Remarkable Feature', [1], ['pg']],
    ['semblante_do_matusalem', M, 'Semblante do Matusalém', 'Semblance of the Methuselah', r(1, 2), ['fr']],
    ['acordado_a_noite_toda', M, 'Acordado a Noite Toda', 'Up All Night', [2, 4], ['bsl']],
    ['garoto_da_cena', M, 'Figura da Cena', 'Scene Kid', [1], ['lsc']],
    ['feio', F, 'Feio', 'Ugly', [1], ['core']],
    ['repulsivo', F, 'Repulsivo', 'Repulsive', [2], ['core']],
    ['fedor', F, 'Fedor', 'Stench', [1], ['core']],
    ['transparente', F, 'Transparente', 'Transparent', [1], ['core']],
    ['rosto_impassivel', F, 'Rosto Impassível', 'Unblinking Visage', [2], ['gw']],
  ]),
  ...cat('Substâncias', [
    ['viciado_funcional', M, 'Viciado Funcional', 'High-Functioning Addict', [1], ['core'], { hint: 'qual droga' }],
    ['vicio', F, 'Vício', 'Addiction', [1], ['core'], { hint: 'qual droga' }],
    ['vicio_sem_saida', F, 'Vício sem Saída', 'Hopeless Addiction', [2], ['core'], { hint: 'qual droga' }],
  ]),
  ...cat('Arcaico (ancilla)', [
    ['guardiao_da_historia', M, 'Guardião da História', 'Custodian of History', [1], ['im']],
    ['vivendo_no_passado', F, 'Vivendo no Passado', 'Living in the Past', [1], ['core']],
    ['arcaico', F, 'Arcaico', 'Archaic', [2], ['core']],
    ['fobia_de_luto', F, 'Fobia de Luto', 'Grief Phobia', [1], ['im']],
    ['truques_velhos', F, 'Truques Velhos', 'Old Tricks', [1], ['im']],
  ]),
  ...cat('Laços de sangue', [
    ['resistencia_ao_laco', M, 'Resistência ao Laço', 'Bond Resistance', r(1, 3), ['core']],
    ['laco_curto', M, 'Laço Curto', 'Short Bond', [2], ['core']],
    ['inquebravel', M, 'Inquebrável', 'Unbondable', [5], ['core']],
    ['lacos_de_lealdade', M, 'Laços de Lealdade', 'Bonds of Fealty', [3], ['gw']],
    ['laco_duradouro', M, 'Laço Duradouro', 'Enduring Bond', [1], ['gw']],
    ['viciado_em_laco', F, 'Viciado em Laço', 'Bond Junkie', [1], ['core']],
    ['laco_longo', F, 'Laço Longo', 'Long Bond', [1], ['core']],
    ['escravo_do_laco', F, 'Escravo do Laço', 'Bondslave', [2], ['core']],
    ['dois_senhores', F, 'Dois Senhores', 'Two Masters', [1], ['bsl']],
  ]),
  ...cat('Alimentação', [
    ['farejador', M, 'Farejador', 'Bloodhound', [1], ['core']],
    ['estomago_de_ferro', M, 'Estômago de Ferro', 'Iron Gullet', [3], ['core']],
    ['reconhecer_o_receptaculo', M, 'Reconhecer o Receptáculo', 'Vessel Recognition', [1], ['pg']],
    ['drive_thru', M, 'Drive-thru', 'Drive-thru', [1], ['lsc']],
    ['exclusao_de_presa', F, 'Exclusão de Presa', 'Prey Exclusion', r(1, 2), ['core'], { hint: 'de quem não bebe' }],
    ['sede_de_matusalem', F, 'Sede de Matusalém', "Methuselah's Thirst", [1], ['core']],
    ['fazendeiro', F, 'Fazendeiro', 'Farmer', [2], ['core']],
    ['organivoro', F, 'Organívoro', 'Organovore', [2], ['core']],
    ['furador_de_veias', F, 'Furador de Veias', 'Vein Tapper', [1], ['pg']],
    ['preferencia_ultrapassada', F, 'Preferência Ultrapassada', 'Outdated Preference', [2], ['im']],
    ['sensivel_a_ressonancia', F, 'Sensível à Ressonância', 'Resonance Sensitivity', [1], ['lsc']],
    ['imitador_de_ressonancia', F, 'Imitador de Ressonância', 'Resonance Mimic', [2], ['lsc']],
    ['bebedor_desleixado', F, 'Bebedor Desleixado', 'Sloppy Feeder', [2], ['lsc']],
  ]),
  ...cat('Míticos', [
    ['comer_comida', M, 'Comer Comida', 'Eat Food', [2], ['core']],
    ['fome_fria', M, 'Fome Fria e Morta', 'Cold Dead Hunger', [3], ['fr']],
    ['diablerie_em_bando', M, 'Diablerie em Bando', 'Pack Diablerie', [2], ['fr']],
    ['sorte_do_diabo', M, 'Sorte do Diabo', 'Luck of the Devil', [4], ['pg']],
    ['modo_nuit', M, 'Modo Nuit', 'Nuit Mode', [2], ['pg']],
    ['objeto_de_poder', M, 'Objeto de Poder', 'Object of Power', r(1, 3), ['im']],
    ['sanguessuga_ley', M, 'Sanguessuga de Linha Ley', 'Ley Line Leach', [1], ['lsc']],
    ['rubor_persistente', M, 'Rubor Persistente', 'Persistent Blush', [3], ['lsc']],
    ['perdicao_folclorica', F, 'Perdição Folclórica', 'Folkloric Bane', [1], ['core'], { hint: 'qual (alho, prata…)' }],
    ['bloqueio_folclorico', F, 'Bloqueio Folclórico', 'Folkloric Block', [1], ['core'], { hint: 'qual' }],
    ['estigmas', F, 'Estigmas', 'Stigmata', [1], ['core']],
    ['isca_de_estaca', F, 'Isca de Estaca', 'Stake Bait', [2], ['core']],
    ['decadencia_faminta', F, 'Decadência Faminta', 'Starving Decay', [2], ['pg']],
    ['objeto_amaldicoado', F, 'Objeto Amaldiçoado', 'Cursed Object', [1], ['im']],
    ['duas_vezes_amaldicoado', F, 'Duas Vezes Amaldiçoado', 'Twice Cursed', [2], ['pg']],
    ['rubor_resistente', F, 'Rubor Resistente', 'Resistant Blush', [1], ['lsc']],
    ['preso_a_terra', F, 'Preso à Terra', 'Land Locked', [1], ['lsc']],
    ['carne_de_cadaver', F, 'Carne de Cadáver', 'Corpse Flesh', [2], ['lsc']],
  ]),
  ...cat('Psicológicos', [
    ['vontade_profana', M, 'Vontade Profana', 'Unholy Will', [2, 4], ['core']],
    ['zelo', M, 'Zelo', 'Zealotry', r(1, 3), ['core']],
    ['penitencia', M, 'Penitência', 'Penitence', r(1, 5), ['core']],
    ['besta_acalmada', M, 'Besta Acalmada', 'Soothed Beast', [1], ['bsl']],
    ['falso_amor', M, 'Falso Amor', 'False Love', [1], ['bsl']],
    ['farol_da_profanacao', F, 'Farol da Profanação', 'Beacon of Profanity', [1], ['core']],
    ['crise_de_fe', F, 'Crise de Fé', 'Crisis of Faith', [1], ['core']],
    ['cicatrizes_da_penitencia', F, 'Cicatrizes da Penitência', 'Horrible Scars of Penitence', [1], ['core']],
    ['verme_rastejante', F, 'Verme Rastejante', 'Groveling Worm', [2], ['core']],
  ]),
  ...cat('Contágio', [
    ['vetor_de_doenca', F, 'Vetor de Doença', 'Disease Vector', [1], ['fr']],
    ['portador_da_praga', F, 'Portador da Praga', 'Plaguebringer', r(1, 2), ['fr']],
  ]),
  ...cat('Laços de linhagem', [
    ['sentido_consanguineo', M, 'Sentido Consanguíneo', 'Consanguineous Sense', [2], ['gw']],
    ['influencia_consanguinea', M, 'Influência Consanguínea', 'Consanguineous Influence', [2], ['gw']],
    ['pecados_do_pai', M, 'Pecados do Pai', 'Sins of the Father', [2, 3], ['gw']],
    ['diablerista_escancarado', F, 'Diablerista Escancarado', 'Blatant Diablerist', [1], ['gw']],
    ['perdicao_herdada', F, 'Perdição Herdada', 'Inherited Bane', [2], ['gw']],
  ]),
  ...cat('Outros', [
    ['confira_o_porta_malas', M, 'Confira o Porta-malas', 'Check the Trunk', [1], ['pg']],
    ['bico', M, 'Bico', 'Side Hustler', [2], ['pg']],
    ['vontade_temperada', M, 'Vontade Temperada', 'Tempered Will', [3], ['core']],
    ['intocavel', M, 'Intocável', 'Untouchable', [5], ['core']],
    ['mistico_do_vazio', M, 'Místico do Vazio', 'Mystic of the Void', [1, 2], ['tf']],
    ['fome_de_conhecimento', F, 'Fome de Conhecimento', 'Knowledge Hungry', [1], ['pg']],
    ['dividas_de_prestacao', F, 'Dívidas de Prestação', 'Prestation Debts', [1], ['pg']],
    ['arriscado', F, 'Arriscado', 'Risk-Taker', [1], ['core']],
    ['fraco_de_vontade', F, 'Fraco de Vontade', 'Weak-Willed', [2], ['core']],
  ]),
  ...cat('Caitiff', [
    ['sangue_favorecido', M, 'Sangue Favorecido', 'Favored Blood', [4], ['pg'], { only: 'caitiff' }],
    ['marca_de_caim', M, 'Marca de Caim', 'Mark of Caine', [2], ['pg'], { only: 'caitiff' }],
    ['imitador_caitiff', M, 'Imitador', 'Mockingbird', [3], ['pg'], { only: 'caitiff' }],
    ['marcado_pelo_sol', M, 'Marcado pelo Sol', 'Sun-Scarred', [5], ['pg'], { only: 'caitiff' }],
    ['tio_presas', M, 'Tio Presas', 'Uncle Fangs', [3], ['pg'], { only: 'caitiff' }],
    ['vitae_contaminante', F, 'Vitae Contaminante', 'Befouling Vitae', [2], ['pg'], { only: 'caitiff' }],
    ['maldicao_de_cla', F, 'Maldição de Clã', 'Clan Curse', [2], ['pg'], { only: 'caitiff' }],
    ['peao_endividado', F, 'Peão Endividado', 'Debt Peon', [2], ['pg'], { only: 'caitiff' }],
    ['liquidador', F, 'Liquidador', 'Liquidator', [1], ['pg'], { only: 'caitiff' }],
    ['sangue_turvo', F, 'Sangue Turvo', 'Muddled Blood', [1], ['pg'], { only: 'caitiff' }],
    ['pressagio_ambulante', F, 'Presságio Ambulante', 'Walking Omen', [2], ['pg'], { only: 'caitiff' }],
    ['marcado_por_palavras', F, 'Marcado por Palavras', 'Word-Scarred', [1], ['pg'], { only: 'caitiff' }],
  ]),
  ...cat('Sangue-ralo', [
    ['camaradas_anarquistas', M, 'Camaradas Anarquistas', 'Anarch Comrades', [1], ['core'], { only: 'sangue_ralo' }],
    ['contato_na_camarilla', M, 'Contato na Camarilla', 'Camarilla Contact', [1], ['core'], { only: 'sangue_ralo' }],
    ['sangue_encadeador', M, 'Sangue Encadeador', 'Catenating Blood', [1], ['core'], { only: 'sangue_ralo' }],
    ['bebedor_diurno', M, 'Bebedor Diurno', 'Day Drinker', [1], ['core'], { only: 'sangue_ralo' }],
    ['afinidade_com_disciplina', M, 'Afinidade com Disciplina', 'Discipline Affinity', [1], ['core'], { only: 'sangue_ralo', hint: 'qual disciplina' }],
    ['quase_vivo', M, 'Quase Vivo', 'Lifelike', [1], ['core'], { only: 'sangue_ralo' }],
    ['alquimista', M, 'Alquimista de Sangue-Ralo', 'Thin-blood Alchemist', [1], ['core'], { only: 'sangue_ralo' }],
    ['resiliencia_vampirica', M, 'Resiliência Vampírica', 'Vampiric Resilience', [1], ['core'], { only: 'sangue_ralo' }],
    ['a_prova_de_fe', M, 'À Prova de Fé', 'Faith-Proof', [1], ['pg'], { only: 'sangue_ralo' }],
    ['pouco_apetite', M, 'Pouco Apetite', 'Low Appetite', [1], ['pg'], { only: 'sangue_ralo' }],
    ['sonhador_lucido', M, 'Sonhador Lúcido', 'Lucid Dreamer', [1], ['pg'], { only: 'sangue_ralo' }],
    ['ar_de_mortal', M, 'Ar de Mortal', "Mortality's Mien", [1], ['pg'], { only: 'sangue_ralo' }],
    ['alimentacao_rapida', M, 'Alimentação Rápida', 'Swift Feeder', [1], ['pg'], { only: 'sangue_ralo' }],
    ['dentes_de_leite', F, 'Dentes de Leite', 'Baby Teeth', [1], ['core'], { only: 'sangue_ralo' }],
    ['temperamento_bestial', F, 'Temperamento Bestial', 'Bestial Temper', [1], ['core'], { only: 'sangue_ralo' }],
    ['marcado_pela_camarilla', F, 'Marcado pela Camarilla', 'Branded by the Camarilla', [1], ['core'], { only: 'sangue_ralo' }],
    ['maldicao_de_cla_ralo', F, 'Maldição de Clã', 'Clan Curse', [1], ['core'], { only: 'sangue_ralo', hint: 'de qual clã' }],
    ['carne_morta', F, 'Carne Morta', 'Dead Flesh', [1], ['core'], { only: 'sangue_ralo' }],
    ['fragilidade_mortal', F, 'Fragilidade Mortal', 'Mortal Frailty', [1], ['core'], { only: 'sangue_ralo' }],
    ['rejeitado_pelos_anarquistas', F, 'Rejeitado pelos Anarquistas', 'Shunned by the Anarchs', [1], ['core'], { only: 'sangue_ralo' }],
    ['dependencia_de_vitae', F, 'Dependência de Vitae', 'Vitae Dependency', [1], ['core'], { only: 'sangue_ralo' }],
    ['sangue_abominavel', F, 'Sangue Abominável', 'Abhorrent Blood', [1], ['pg'], { only: 'sangue_ralo' }],
    ['heliofobia', F, 'Heliofobia', 'Heliophobia', [1], ['pg'], { only: 'sangue_ralo' }],
    ['terrores_noturnos', F, 'Terrores Noturnos', 'Night Terrors', [1], ['pg'], { only: 'sangue_ralo' }],
    ['portadores_da_praga', F, 'Portadores da Praga', 'Plague Bearers', [1], ['pg'], { only: 'sangue_ralo' }],
    ['bebedor_descuidado', F, 'Bebedor Descuidado', 'Sloppy Drinker', [1], ['pg'], { only: 'sangue_ralo' }],
    ['desbotado_pelo_sol', F, 'Desbotado pelo Sol', 'Sun-Faded', [1], ['pg'], { only: 'sangue_ralo' }],
    ['sinal_sobrenatural', F, 'Sinal Sobrenatural', 'Supernatural Tell', [1], ['pg'], { only: 'sangue_ralo' }],
    ['presenca_crepuscular', F, 'Presença Crepuscular', 'Twilight Presence', [1], ['pg'], { only: 'sangue_ralo' }],
    ['fome_sem_fim', F, 'Fome sem Fim', 'Unending Hunger', [1], ['pg'], { only: 'sangue_ralo' }],
  ]),
  ...cat('Cultos', [
    ['textos_apocrifos', M, 'Textos Apócrifos', 'Apocryphal Texts', [1], ['cob']],
    ['artista_inspirado', M, 'Artista Inspirado', 'Inspired Artist', [2], ['cob']],
    ['pregador_itinerante', M, 'Pregador Itinerante', 'Traveling Preacher', [2], ['cob']],
    ['excomungado', F, 'Excomungado', 'Excommunicated', r(1, 2), ['cob']],
    ['sem_fe', F, 'Sem Fé', 'Faithless', [2], ['cob']],
    ['memorias_dos_caidos', M, 'Memórias dos Caídos', 'Memories of the Fallen', [2], ['cbg'], { only: 'sangue_ralo' }],
    ['transmissor', M, 'Transmissor', 'Streamer', [2], ['cbg']],
    ['vicio_em_ashe', F, 'Vício em Ashe', 'Ashe Addiction', [2], ['cbg']],
    ['jardineiro', M, 'Jardineiro', 'Gardener', r(1, 5), ['cbg']],
    ['cancao_da_mae_sombria', M, 'Canção da Mãe Sombria', "Dark Mother's Song", [2], ['cbg']],
    ['resistente_ao_fogo', M, 'Resistente ao Fogo', 'Fire Resistant', [1], ['cbg']],
    ['cisma', F, 'Cisma', 'Schism', [1], ['cbg']],
    ['vigilante', M, 'Vigilante', 'Vigilant', [2], ['cbg']],
    ['alarme_falso', F, 'Alarme Falso', 'False Alarm', [1], ['cbg']],
    ['quebra_galho', M, 'Quebra-galho', 'Fixer', [2], ['cbg']],
    ['sumir_do_mapa', M, 'Sumir do Mapa', 'Go to Ground', [1], ['cbg']],
    ['sussurros_insidiosos', M, 'Sussurros Insidiosos', 'Insidious Whispers', [2], ['cbg']],
    ['vazio', F, 'Vazio', 'Empty', [1], ['cbg']],
    ['gematria', M, 'Gematria', 'Gematria', [1], ['cbg']],
    ['matador_de_touros', M, 'Matador de Touros', 'Bull-Slayer', [3], ['cbg']],
    ['iniciado_fracassado', F, 'Iniciado Fracassado', 'Failed Initiate', [1], ['cbg']],
    ['negociante', M, 'Negociante', 'Bargainer', [1], ['cbg']],
    ['graca_do_arcanjo', M, 'Graça do Arcanjo', "Archangel's Grace", [3], ['cbg']],
    ['anseio', F, 'Anseio', 'Yearning', [1], ['cbg']],
  ]),
]

export const VTM_ADV_BY_KEY = new Map(VTM_ADVANTAGES.map((a) => [a.key, a]))

/** Limite da criação: pontos de vantagens e o mínimo de defeitos. */
export const VTM_CREATION_BUDGET = {
  neonato: { advantages: 7, flaws: 2 },
  ancilla: { advantages: 9, flaws: 4 },
} as const
