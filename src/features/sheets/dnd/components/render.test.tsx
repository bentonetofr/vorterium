import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  DndCharacterClass, DndCharacterFeature, DndCharacterResource, DndCharacterSheet, DndSheetDetails,
} from '../../../../shared/types'

// Estes testes só renderizam (sem navegador): pegam erro de execução ao montar o
// cabeçalho e as abas com uma ficha de exemplo. O cliente do Supabase e o botão
// do Vortable ficam de fora, pois dependem de variáveis de ambiente e do motor do mapa.
vi.mock('../../../../shared/lib/supabase', () => ({
  supabase: {},
  uniqueChannel: (base: string) => base,
}))
vi.mock('../../../vortable/components/CreateCharacterButton', () => ({
  CreateCharacterButton: () => null,
}))
// O Select de verdade abre a lista num portal no <body> (não existe no Node): aqui vira um <select> comum.
vi.mock('../../../../shared/components/Select', () => ({
  Select: ({ options, value, 'aria-label': label }: { options: { value: string; label: string }[]; value?: string; 'aria-label'?: string }) => (
    <select aria-label={label} defaultValue={value}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
  ),
}))

import { formFromSheet } from '../model/sheetForm'
import { deriveSheet } from '../model/sheetModel'
import type { DndSheetData } from '../hooks/useDndSheetData'
import { DndHero } from './DndHero'
import { DndPersonagemTab } from './DndPersonagemTab'
import { DndAtributosTab } from './DndAtributosTab'
import { DndCombateTab } from './DndCombateTab'
import { DndMagiasTab } from './DndMagiasTab'
import { DndInventarioTab } from './DndInventarioTab'
import { DndCaracteristicasTab } from './DndCaracteristicasTab'
import { DndHistoriaTab } from './DndHistoriaTab'
import type { SheetCtx } from './sheetContext'

const now = '2026-10-21T00:00:00Z'

function makeSheet(over: Partial<DndCharacterSheet> = {}): DndCharacterSheet {
  return {
    id: 's1', campaign_id: 'c1', user_id: 'u1',
    character_name: 'Aria Valente', player_name: 'Ana', class_name: null, subclass: null, background: null, race: null, alignment: 'Leal e Bom',
    level: 1, experience: 15000, inspiration: true,
    armor_class: 10, initiative_bonus: 0, speed: 30, proficiency_bonus: 2,
    hp_current: 30, hp_max: 40, hp_temp: 3,
    strength: 16, dexterity: 12, constitution: 16, intelligence: 14, wisdom: 13, charisma: 8,
    strength_save_proficient: true, dexterity_save_proficient: false, constitution_save_proficient: true,
    intelligence_save_proficient: false, wisdom_save_proficient: false, charisma_save_proficient: false,
    death_save_successes: 1, death_save_failures: 0,
    spellcasting_ability: null, spell_save_dc: null, spell_attack_bonus: null,
    notes: 'Nota', backstory: 'Vem do norte.', personality_traits: null, ideals: null, bonds: null, flaws: null,
    ruleset: 'dnd5e_2014', race_key: 'dwarf', subrace_key: 'hill_dwarf', class_key: 'fighter', subclass_key: null, background_key: 'acolyte',
    portrait_url: null, is_npc: false, conditions: ['poisoned'], exhaustion: 1, coin_gp: 25, coin_sp: 3,
    created_at: now, updated_at: now,
    ...over,
  }
}

const cls = (key: string, level: number, initial: boolean, sub: string | null = null): DndCharacterClass => ({
  id: key, sheet_id: 's1', class_key: key, level, subclass_key: sub, is_initial: initial, hp_rolls: [], created_at: now, updated_at: now,
})

const item = (key: string | null, name: string, equipped: boolean, weight = 1) => ({
  id: name, sheet_id: 's1', name, quantity: 1, weight, equipped, notes: '', catalog_entry_key: key, sort_order: 0, created_at: now, updated_at: now,
})

const details = (): DndSheetDetails => ({
  skills: [
    { id: 'k1', sheet_id: 's1', skill_key: 'athletics', proficient: true, expertise: false },
    { id: 'k2', sheet_id: 's1', skill_key: 'perception', proficient: true, expertise: true },
  ],
  attacks: [
    { id: 'a1', sheet_id: 's1', name: 'Espada longa', attack_bonus: '', damage: '', damage_type: 'cortante', notes: '', catalog_entry_key: 'longsword', sort_order: 0, created_at: now, updated_at: now },
    { id: 'a2', sheet_id: 's1', name: 'Soco de pedra', attack_bonus: '+7', damage: '2d6', damage_type: '', notes: 'mágico', catalog_entry_key: null, sort_order: 1, created_at: now, updated_at: now },
  ],
  inventory: [item('chain_mail', 'Cota de malha', true, 27.5), item('shield', 'Escudo', true, 3), item('longsword', 'Espada longa', false, 1.5), item(null, 'Corda', false, 5)],
  spells: [
    { id: 'p1', sheet_id: 's1', name: 'Bola de Fogo', spell_level: 3, school: '', casting_time: '', spell_range: '', duration: '', concentration: false, ritual: false, prepared: true, description: 'Explode.', sort_order: 0, created_at: now, updated_at: now },
    { id: 'p2', sheet_id: 's1', name: 'Prestidigitação', spell_level: 0, school: '', casting_time: '', spell_range: '', duration: '', concentration: false, ritual: false, prepared: false, description: '', sort_order: 1, created_at: now, updated_at: now },
  ],
  overrides: [{ id: 'o1', sheet_id: 's1', field_key: 'initiative_bonus', manual_value: '4', reason: '', updated_at: now }],
})

const resource = (key: string, label: string, cur: number, max: number, recharge: DndCharacterResource['recharge'], source: DndCharacterResource['source']): DndCharacterResource => ({
  id: key, sheet_id: 's1', key, label, current_value: cur, max_value: max, recharge, source, sort_order: 0, created_at: now, updated_at: now,
})

const feature = (key: string | null, source: DndCharacterFeature['source'], name: string, uses: number | null): DndCharacterFeature => ({
  id: name, sheet_id: 's1', source, feature_key: key, name, level: 1, notes: 'minha nota', uses_current: uses, uses_max: uses, recharge: uses ? 'short' : null, sort_order: 0, created_at: now, updated_at: now,
})

function makeData(over: Partial<DndSheetData> = {}): DndSheetData {
  const noop = () => {}
  return {
    loading: false, error: null, degraded: false,
    classes: [cls('fighter', 3, true, 'champion'), cls('wizard', 2, false)],
    details: details(),
    proficiencies: [{ id: 'x1', sheet_id: 's1', category: 'tool', entry_key: 'ferramentas_de_ladrao', label: 'Ferramentas de ladrão', source: 'manual', created_at: now }],
    resources: [
      resource('spell_slot_1', '1º nível', 2, 3, 'long', 'spell_slots'),
      resource('rage', 'Fúria', 1, 2, 'long', 'manual'),
    ],
    features: [feature('fighter__second_wind', 'class', 'Retomar o Fôlego', 1), feature(null, 'manual', 'Cicatriz de guerra', null)],
    hpMode: 'rolled',
    setClasses: noop, setDetails: noop, setProficiencies: noop, setResources: noop, setFeatures: noop,
    reload: async () => {},
    ...over,
  }
}

function makeCtx(opts: { sheet?: DndCharacterSheet; data?: DndSheetData; readOnly?: boolean } = {}): SheetCtx {
  const sheet = opts.sheet ?? makeSheet()
  const data = opts.data ?? makeData()
  const form = formFromSheet(sheet)
  const { derived, gear, prof } = deriveSheet({ sheet, classes: data.classes, details: data.details, proficiencies: data.proficiencies })
  return {
    sheet, form, set: () => {}, update: () => {}, data, derived, gear, prof,
    readOnly: opts.readOnly ?? false, campaignId: 'c1', report: () => {},
  }
}

const hero = (ctx: SheetCtx, isNpc = false) => renderToStaticMarkup(
  <DndHero ctx={ctx} isNpc={isNpc} portraitBusy={false} onPortraitChange={() => {}} onPortraitRemove={() => {}} onShortRest={() => {}} onLongRest={() => {}} restBusy={false} />,
)

describe('cabeçalho', () => {
  it('mostra nome, raça, classes, nível e os números da mesa', () => {
    const html = hero(makeCtx())
    expect(html).toContain('Aria Valente')
    expect(html).toContain('Anão da Colina')
    expect(html).toContain('Guerreiro 3 / Mago 2')
    expect(html).toContain('nível 5')
    expect(html).toContain('Acólito')
    expect(html).toContain('Descanso curto')
    expect(html).toContain('Descanso longo')
    expect(html).toContain('CA')
    expect(html).toContain('Percepção passiva')
  })

  it('CA, deslocamento em metros e iniciativa manual aparecem', () => {
    const html = hero(makeCtx())
    expect(html).toContain('18')            // cota de malha 16 + escudo 2
    expect(html).toContain('7,5 m')         // anão: 25 pés
    expect(html).toContain('MANUAL')        // iniciativa manual
    expect(html).toContain('AUTO')
  })

  it('barra de PV arrastável com campos de PV atual, máximo e temporário', () => {
    const html = hero(makeCtx())
    expect(html).toContain('Pontos de Vida')
    expect(html).toContain('aria-label="PV atuais"')
    expect(html).toContain('aria-label="PV temporários"')
    expect(html).toContain('aria-label="PV máximo"')            // o máximo calculado tem o selo AUTO
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuenow="30"')
    expect(html).toContain('width:60%')                         // 30 de 50 (Guerreiro 3 + Mago 2, Con +3, anão da colina)
    expect(html).toContain('dsh-drag__handle')
  })

  it('sem classes, o PV máximo é um campo digitável', () => {
    const html = hero(makeCtx({ data: makeData({ classes: [] }) }))
    expect(html).toContain('dsh-hp__input--max')
  })

  it('NPC e modo leitura não mostram o botão de criar personagem nem permitem descansar', () => {
    const html = hero(makeCtx({ readOnly: true }), true)
    expect(html).toContain('disabled')
  })

  it('ficha sem classes mostra a dica em vez de quebrar', () => {
    const html = hero(makeCtx({ data: makeData({ classes: [] }), sheet: makeSheet({ class_key: null, race_key: null, subrace_key: null, background_key: null }) }))
    expect(html).toContain('Escolha raça e classe na aba Personagem.')
  })
})

describe('abas', () => {
  it('Personagem: identidade, classes com subclasse, XP e proficiências', () => {
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx()} />)
    expect(html).toContain('Identidade')
    expect(html).toContain('Classes e níveis')
    expect(html).toContain('Guerreiro')
    expect(html).toContain('Mago')
    expect(html).toContain('inicial')
    expect(html).toContain('PV rolados')            // hpMode = rolled
    expect(html).toContain('Experiência')
    expect(html).toContain('Já dá para subir de nível') // 15.000 XP = nível 6; a ficha tem nível 5
  })

  it('Personagem sem classes pede o nível', () => {
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx({ data: makeData({ classes: [] }) })} />)
    expect(html).toContain('vale enquanto não houver classes')
  })

  it('Atributos e Perícias: seis atributos, 18 perícias e passivas', () => {
    const html = renderToStaticMarkup(<DndAtributosTab ctx={makeCtx()} />)
    expect(html).toContain('Força')
    expect(html).toContain('Carisma')
    expect(html).toContain('Atletismo')
    expect(html).toContain('Sobrevivência')
    expect(html).toContain('Percepções passivas')
    expect(html).toContain('Salvaguarda')
  })

  it('Combate: PV, dados de vida, defesa, condições, exaustão e ataques calculados', () => {
    const html = renderToStaticMarkup(<DndCombateTab ctx={makeCtx()} />)
    expect(html).toContain('Pontos de vida')
    expect(html).toContain('Dados de vida')
    expect(html).toContain('d10')
    expect(html).toContain('Cota de malha (CA 16)')
    expect(html).toContain('Envenenado')
    expect(html).toContain('Exaustão')
    expect(html).toContain('Espada longa')
    expect(html).toContain('+6')               // Força +3 + proficiência +3 (nível 5)
    expect(html).toContain('1d8+3')
    expect(html).toContain('Soco de pedra')
  })

  it('Combate avisa quando falta proficiência com a armadura', () => {
    const ctx = makeCtx({ data: makeData({ classes: [cls('wizard', 3, true)] }) })
    const html = renderToStaticMarkup(<DndCombateTab ctx={ctx} />)
    expect(html).toContain('Sem proficiência com armadura pesada e escudo')
  })

  it('Magias de um conjurador: espaços, CD e lista de magias', () => {
    const data = makeData({ classes: [cls('wizard', 5, true)] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data })} />)
    expect(html).toContain('Conjuração')
    expect(html).toContain('CD das magias')
    expect(html).toContain('Espaços de magia')
    expect(html).toContain('1º nível')
    expect(html).toContain('Bola de Fogo')
    expect(html).toContain('Truque')
    expect(html).toContain('Preparadas')
  })

  it('Magias de um não conjurador explica quem conjura', () => {
    const data = makeData({ classes: [cls('fighter', 5, true)] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data })} />)
    expect(html).toContain('Nenhuma das classes do personagem conjura')
  })

  it('Magias de um Bruxo mostra o Pacto', () => {
    const data = makeData({ classes: [cls('warlock', 5, true)], resources: [resource('pact_slot', 'Pacto', 1, 2, 'short', 'spell_slots')] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data })} />)
    expect(html).toContain('Pacto (3º nível)')
  })

  it('Inventário: moedas, carga, itens equipados e catálogo', () => {
    const html = renderToStaticMarkup(<DndInventarioTab ctx={makeCtx()} />)
    expect(html).toContain('Moedas')
    expect(html).toContain('Cota de malha')
    expect(html).toContain('Equipado')
    expect(html).toContain('Carga')
    expect(html).toContain('kg')
    expect(html).toContain('Corda')
  })

  it('Características: recursos, importação do catálogo e características da ficha', () => {
    const html = renderToStaticMarkup(<DndCaracteristicasTab ctx={makeCtx()} />)
    expect(html).toContain('Fúria')
    expect(html).toContain('Retomar o Fôlego')
    expect(html).toContain('Cicatriz de guerra')
    expect(html).toContain('Trazer do catálogo')
    expect(html).not.toContain('1º nível')      // espaços de magia ficam na aba Magias
  })

  it('História: os seis campos de texto', () => {
    const html = renderToStaticMarkup(<DndHistoriaTab ctx={makeCtx()} />)
    for (const t of ['Traços de personalidade', 'Ideais', 'Vínculos', 'Defeitos', 'História do personagem', 'Anotações']) expect(html).toContain(t)
    expect(html).toContain('Vem do norte.')
  })

  it('modo leitura (NPC mostrado a um jogador): nada de botões de adicionar', () => {
    const ctx = makeCtx({ readOnly: true })
    for (const Tab of [DndPersonagemTab, DndCombateTab, DndMagiasTab, DndInventarioTab, DndCaracteristicasTab]) {
      const html = renderToStaticMarkup(<Tab ctx={ctx} />)
      expect(html).not.toContain('>Adicionar<')
    }
  })

  it('todas as abas renderizam com a ficha vazia e sem dados', () => {
    const empty = makeData({
      classes: [], proficiencies: [], resources: [], features: [],
      details: { skills: [], attacks: [], inventory: [], spells: [], overrides: [] },
    })
    const ctx = makeCtx({ data: empty, sheet: makeSheet({ race_key: null, subrace_key: null, background_key: null, conditions: [], exhaustion: 0, level: 1, experience: 0 }) })
    for (const Tab of [DndPersonagemTab, DndAtributosTab, DndCombateTab, DndMagiasTab, DndInventarioTab, DndCaracteristicasTab, DndHistoriaTab]) {
      expect(() => renderToStaticMarkup(<Tab ctx={ctx} />)).not.toThrow()
    }
    expect(() => hero(ctx)).not.toThrow()
  })
})
