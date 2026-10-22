import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Estes testes só renderizam (sem navegador): pegam erro de execução ao montar o
// cabeçalho e as abas com uma ficha de exemplo. O cliente do Supabase e o botão
// do Vortable ficam de fora, pois dependem de variáveis de ambiente e do motor do mapa.
vi.mock('../../../../shared/components/ModalOverlay', () => ({ ModalOverlay: ({ children }: { children: ReactNode }) => <div className="modal-overlay">{children}</div> }))
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

import { DndHero } from './DndHero'
import { DndPersonagemTab } from './DndPersonagemTab'
import { DndAtributosTab } from './DndAtributosTab'
import { DndCombateTab } from './DndCombateTab'
import { DndMagiasTab } from './DndMagiasTab'
import { DndInventarioTab } from './DndInventarioTab'
import { DndCaracteristicasTab } from './DndCaracteristicasTab'
import { DndHistoriaTab } from './DndHistoriaTab'
import type { SheetCtx } from './sheetContext'
import { cls, makeCtx, makeData, makeSheet, resource } from './fixtures'
import { DndSpellBrowser } from './DndSpellBrowser'
import { DndItemBrowser } from './DndItemBrowser'
import { DndRollProvider } from '../rolls/DndRollProvider'
import { moveHpBar } from './DndDragBar'
import { DndAutomationPanel } from './DndAutomationPanel'
import { AUTOMATION_ITEMS } from '../model/automation'
import * as spellCatalog from '../catalog/spells'
import { primeSpellCatalog } from '../hooks/useSpellCatalog'

const hero = (ctx: SheetCtx, isNpc = false) => renderToStaticMarkup(
  <DndHero ctx={ctx} isNpc={isNpc} portraitBusy={false} onPortraitChange={async () => {}} onPortraitRemove={() => {}} onShortRest={() => {}} onLongRest={() => {}} restBusy={false} />,
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
    expect(html).toContain('7,5')           // anão: 25 pés = 7,5 m
    expect(html).toContain('dsh-num--manual')   // iniciativa manual vira campo para digitar
    expect(html).not.toMatch(/>(AUTO|MANUAL)</) // a ficha não tem mais selo de modo
  })

  it('barra de PV arrastável com campos de PV atual, máximo e temporário', () => {
    const html = hero(makeCtx())
    expect(html).toContain('Pontos de Vida')
    expect(html).toContain('aria-label="PV atuais"')
    expect(html).toContain('aria-label="PV temporários"')
    expect(html).toContain('aria-label="PV máximo"')            // o máximo calculado tem o selo AUTO
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuenow="33"')                // PV atuais + temporários (30 + 3)
    expect(html).toContain('width:60%')                         // 30 de 50 (Guerreiro 3 + Mago 2, Con +3, anão da colina)
    expect(html).toContain('dsh-drag__handle')
    expect(html).toContain('left:66%')                          // a linha branca fica no fim da barra, depois do azul
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

  it('Identidade: campos em tile e bônus da raça em tiles, não em etiquetas soltas', () => {
    const ctx = makeCtx()
    ctx.form.race_key = 'human'
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={ctx} />)
    expect(html.match(/dsh-field--tile/g)!.length).toBeGreaterThanOrEqual(4)
    expect(html).toContain('dsh-bonuses__grid')
    expect(html).toContain('Da raça · Humano')
    expect(html).toContain('Deslocamento')
    expect(html.match(/dsh-bonus--good/g)).toHaveLength(6)        // humano: +1 em todos os seis atributos
    expect(html).toContain('dsh-lore')                            // característica do antecedente
  })

  it('Classes e níveis: nível, subclasse, PV rolados e adicionar classe em tiles', () => {
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx()} />)
    expect(html).toContain('dsh-class__level-label')
    expect(html).toContain('dsh-addclass')
    expect(html).toContain('Adicionar classe')
    expect(html).toContain('dsh-roll')
    expect(html).toContain('Regras de PV')
    expect(html).not.toContain('PV rolados (d')
    const empty = renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx({ data: makeData({ classes: [] }) })} />)
    expect(empty).toContain('dsh-field--tile')
    expect(empty).not.toContain('· vale enquanto não houver classes')
  })

  it('Proficiências e idiomas: um bloco por tipo, com etiquetas em português e as adicionadas com ×', () => {
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx()} />)
    expect(html).toContain('dsh-profs')
    for (const t of ['Armaduras', 'Armas', 'Ferramentas', 'Idiomas']) expect(html).toContain(`dsh-prof__title">${t}<`)
    expect(html).toContain('dsh-prof__chip')
    expect(html).not.toContain('hand crossbow')            // nomes das armas em português, não a chave em inglês
    expect(html).toContain('dsh-addprof')
    expect(html).toContain('Nova proficiência')
    expect(renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx({ readOnly: true })} />)).not.toContain('dsh-addprof')
  })

  it('Personagem sem classes pede o nível', () => {
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={makeCtx({ data: makeData({ classes: [] }) })} />)
    expect(html).toContain('Vale enquanto o personagem não tem classes')
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
    expect(html).toContain('Atributo de conjuração')
  })

  it('Magias sem classe conjuradora, com atributo escolhido, mostra CD e ataque', () => {
    const data = makeData({ classes: [cls('fighter', 5, true)] })
    const ctx = makeCtx({ data, sheet: makeSheet({ choices: { spellAbility: 'intelligence' } }) })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={ctx} />)
    expect(html).toContain('CD das magias')
    expect(html).toContain('<option value="intelligence" selected="">')
    expect(html).toContain('<small>INT</small>')
    expect(html).not.toContain('Nenhuma das classes do personagem conjura')
  })

  it('Magias do livro mostram o texto completo, agrupadas por nível, e podem virar cópia própria', () => {
    primeSpellCatalog(spellCatalog)
    const data = makeData({ classes: [cls('wizard', 5, true)] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data })} />)
    expect(html).toContain('Truques')
    expect(html).toContain('Ver a magia')
    expect(html).toContain('Tempo de conjuração')
    expect(html).toContain('45 metros')
    expect(html).toContain('Em níveis superiores.')
    expect(html).toContain('Personalizar')
    expect(html).toContain('Livro de magias')
    expect(html).toContain('Abrir o livro')
    expect(html).not.toContain('Buscar magia')       // o livro só abre sob demanda
  })

  it('Magias em modo leitura: sem livro e sem personalizar', () => {
    primeSpellCatalog(spellCatalog)
    const data = makeData({ classes: [cls('wizard', 5, true)] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data, readOnly: true })} />)
    expect(html).toContain('Ver a magia')
    expect(html).not.toContain('Abrir o livro')
    expect(html).not.toContain('Personalizar')
  })

  it('botões de rolar: aparecem na ficha editável dentro do provedor e somem só de leitura', () => {
    const ctx = makeCtx()
    const html = renderToStaticMarkup(<DndRollProvider ctx={ctx}><DndAtributosTab ctx={ctx} /></DndRollProvider>)
    expect(html.match(/class="dsh-rollbtn/g)).toHaveLength(6 + 6 + 18)
    expect(html).toContain('aria-label="Rolar Furtividade"')
    expect(html).toContain('aria-label="Rolar salvaguarda de Destreza"')
    const ro = makeCtx({ readOnly: true })
    expect(renderToStaticMarkup(<DndRollProvider ctx={ro}><DndAtributosTab ctx={ro} /></DndRollProvider>)).not.toContain('dsh-rollbtn')
    expect(renderToStaticMarkup(<DndAtributosTab ctx={makeCtx()} />)).not.toContain('dsh-rollbtn')
    const combat = renderToStaticMarkup(<DndRollProvider ctx={ctx}><DndCombateTab ctx={ctx} /></DndRollProvider>)
    expect(combat).toContain('aria-label="Rolar iniciativa"')
    expect(combat).toContain('aria-label="Rolar salvaguarda contra a morte"')
    expect(combat).toContain('aria-label="Atacar com Espada longa"')
    expect(combat).toContain('aria-label="Dano de Espada longa"')
  })

  it('Livro de itens: cards de tudo, filtros, o que a ficha já tem e o botão Ver mais', () => {
    const props = { prof: { weapons: ['simple'], armor: ['light'] }, readOnly: false, busy: null, onAdd: () => {} }
    const html = renderToStaticMarkup(<DndItemBrowser owned={new Map([['club', 2]])} {...props} />)
    expect(html).toContain('Livro de itens')
    expect(html).toContain('Buscar item')
    for (const f of ['Todos', 'Armas', 'Armaduras e escudo', 'Equipamento', 'Ferramentas', 'Mais leve', 'Mais barato', 'Só o que sei usar']) expect(html).toContain(f)
    expect(html).toContain('Clava')
    expect(html).toContain('✓ Tem ×2 · + mais um')                 // a clava já está na ficha
    expect(html).toContain('+ Adicionar')
    expect(html).toContain('Ver mais')
    expect(html).toContain('Mostrar mais')
    expect(html).not.toContain('Alcance</span>')                   // filtros de arma só aparecem ao escolher Armas
    const ro = renderToStaticMarkup(<DndItemBrowser owned={new Map()} {...props} readOnly />)
    expect(ro).toContain('disabled')
  })

  it('Inventário: abre o livro de itens e só cria item próprio no formulário', () => {
    const html = renderToStaticMarkup(<DndInventarioTab ctx={makeCtx()} />)
    expect(html).toContain('Livro de itens')
    expect(html).toContain('Abrir o livro')
    expect(html).toContain('Item próprio')
    expect(html).not.toContain('Item do catálogo')
    expect(renderToStaticMarkup(<DndInventarioTab ctx={makeCtx({ readOnly: true })} />)).not.toContain('Abrir o livro')
  })

  it('Livro de magias: lista o catálogo, marca o que já está na ficha e mostra o filtro da ficha', () => {
    const html = renderToStaticMarkup(
      <DndSpellBrowser catalog={spellCatalog.SPELLS} have={new Set(['jump'])} myClasses={['wizard']} readOnly={false} busy={null} onAdd={() => {}} />,
    )
    expect(html).toContain('204 magias')                              // classe "Da minha ficha" = Mago
    expect(html).toContain('Mostrar mais 48')
    expect(html).toContain('+ Adicionar')
    expect(html).toContain('✓ Na ficha')                              // Salto já está na ficha
    expect(html).toContain('Ver mais')
    expect(html).toContain('Buscar magia')
    expect(html).toContain('Truque')
    const todas = renderToStaticMarkup(<DndSpellBrowser catalog={spellCatalog.SPELLS} have={new Set(['fireball'])} myClasses={[]} readOnly={false} busy={null} onAdd={() => {}} />)
    expect(todas).toContain('319 magias')
    const so = renderToStaticMarkup(<DndSpellBrowser catalog={null} have={new Set()} myClasses={[]} readOnly={false} busy={null} onAdd={() => {}} />)
    expect(so).toContain('Abrindo o livro de magias')
  })

  it('barra de PV: a linha branca fica no fim, depois dos PV temporários, mesmo com a barra crescendo', () => {
    const ctx = makeCtx()
    ctx.form.hp_current = 50
    ctx.form.hp_temp = 25
    const html = hero(ctx)
    expect(html).toContain('aria-valuenow="75"')
    expect(html).toContain('left:100%')
    expect(html).toContain('width:66.67%')          // 50 de 75: a escala cresceu para caber o azul
  })

  it('moveHpBar: ao diminuir gasta os temporários primeiro e depois os PV; ao aumentar cura até o máximo', () => {
    const at = { hp: 30, temp: 10 }
    expect(moveHpBar(at, 50, 40)).toEqual(at)                         // sem mudança
    expect(moveHpBar(at, 50, 36)).toEqual({ hp: 30, temp: 6 })        // só temporários
    expect(moveHpBar(at, 50, 30)).toEqual({ hp: 30, temp: 0 })        // temporários zerados
    expect(moveHpBar(at, 50, 22)).toEqual({ hp: 22, temp: 0 })        // depois os PV atuais
    expect(moveHpBar(at, 50, 0)).toEqual({ hp: 0, temp: 0 })
    expect(moveHpBar(at, 50, -5)).toEqual({ hp: 0, temp: 0 })
    expect(moveHpBar(at, 50, 45)).toEqual({ hp: 35, temp: 10 })       // cura PV, não cria temporários
    expect(moveHpBar(at, 50, 200)).toEqual({ hp: 50, temp: 10 })      // até o máximo
    expect(moveHpBar({ hp: 8, temp: 0 }, 8, 8)).toEqual({ hp: 8, temp: 0 })
  })

  it('barra de PV: sem botões de +/-, PV temporários em azul dentro da barra', () => {
    const ctx = makeCtx()
    ctx.form.hp_temp = 3
    const html = hero(ctx)
    expect(html).toContain('class="dsh-hp__temp"')
    expect(html).toContain('3 PV temporários')
    expect(html).not.toContain('dsh-hp__btns')
    expect(html).not.toContain('Dano de')
    expect(html).not.toContain('Cura de')
    ctx.form.hp_temp = 0
    expect(hero(ctx)).not.toContain('class="dsh-hp__temp"')
  })

  it('inspiração é um tile clicável igual aos outros, com Sim ou Não', () => {
    const ctx = makeCtx()
    ctx.form.inspiration = true
    const on = hero(ctx)
    expect(on).toContain('dsh-stat dsh-stat--click is-on')
    expect(on).toContain('aria-pressed="true"')
    expect(on).toContain('>Sim<')
    ctx.form.inspiration = false
    const off = hero(ctx)
    expect(off).toContain('aria-pressed="false"')
    expect(off).toContain('>Não<')
    expect(off).not.toContain('dsh-toggle')
    expect(off).not.toContain('<svg')
  })

  it('deslocamento: a unidade é um botão que alterna entre metros e pés', () => {
    const m = hero(makeCtx())
    expect(m).toContain('aria-label="Deslocamento em metros"')
    expect(m).toMatch(/dsh-derived__unit"[^>]*>m</)
    const ctx = makeCtx()
    ctx.form.speed_unit = 'ft'
    const ft = hero(ctx)
    expect(ft).toContain('aria-label="Deslocamento em pés"')
    expect(ft).toContain('>25<')
    expect(ft).toMatch(/dsh-derived__unit"[^>]*>ft</)
    expect(hero(makeCtx({ readOnly: true }))).not.toContain('dsh-derived__unit')
  })

  it('botão Automatizar no cabeçalho, só para quem pode editar', () => {
    expect(hero(makeCtx())).toContain('Automatizar')
    expect(hero(makeCtx({ readOnly: true }))).not.toContain('Automatizar')
  })

  it('janela Automatizar: lista vertical com descrição à esquerda e Automático/Manual à direita', () => {
    const html = renderToStaticMarkup(<DndAutomationPanel ctx={makeCtx()} onClose={() => {}} />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Valores do personagem')
    expect(html).toContain('Atributos e perícias')
    expect(html).toContain('Recursos')
    for (const item of AUTOMATION_ITEMS) expect(html).toContain(item.title)
    expect(html.match(/>Automático</g)).toHaveLength(AUTOMATION_ITEMS.length)
    expect(html.match(/>Manual</g)).toHaveLength(AUTOMATION_ITEMS.length)
    expect(html).toContain('Automatizar tudo')
    expect(html).toContain('Manualizar tudo')
    expect(html).toContain('Fechar')
  })

  it('janela Automatizar mostra quais itens estão manuais', () => {
    // a ficha de exemplo tem a iniciativa manual
    const html = renderToStaticMarkup(<DndAutomationPanel ctx={makeCtx()} onClose={() => {}} />)
    expect(html).toContain('1 item em modo manual')
    const ctx = makeCtx()
    ctx.form.manual_modes = ['spell_slots']
    const two = renderToStaticMarkup(<DndAutomationPanel ctx={ctx} onClose={() => {}} />)
    expect(two).toContain('2 itens em modo manual')
  })

  it('nenhuma aba tem selo AUTO ou MANUAL', () => {
    const ctx = makeCtx({ data: makeData({ classes: [cls('wizard', 5, true)] }) })
    for (const Tab of [DndPersonagemTab, DndAtributosTab, DndCombateTab, DndMagiasTab, DndInventarioTab, DndCaracteristicasTab, DndHistoriaTab]) {
      expect(renderToStaticMarkup(<Tab ctx={ctx} />)).not.toMatch(/>(AUTO|MANUAL)</)
    }
  })

  it('perícias, salvaguardas e modificadores viram campos quando manuais', () => {
    const ctx = makeCtx()
    ctx.data.details.overrides.push(
      { id: 'o9', sheet_id: 's1', field_key: 'skill_stealth', manual_value: '9', reason: '', updated_at: '2026-10-21T00:00:00Z' },
      { id: 'o10', sheet_id: 's1', field_key: 'mod_strength', manual_value: '5', reason: '', updated_at: '2026-10-21T00:00:00Z' },
      { id: 'o11', sheet_id: 's1', field_key: 'save_wisdom', manual_value: '7', reason: '', updated_at: '2026-10-21T00:00:00Z' },
    )
    const html = renderToStaticMarkup(<DndAtributosTab ctx={ctx} />)
    expect(html.match(/dsh-num--manual/g)).toHaveLength(3)
    expect(html).toContain('aria-label="Bônus de Furtividade"')
    const normal = renderToStaticMarkup(<DndAtributosTab ctx={makeCtx()} />)
    expect(normal).not.toContain('dsh-num--manual')
  })

  it('espaços de magia em modo manual: total digitável em todos os níveis', () => {
    const ctx = makeCtx({ data: makeData({ classes: [cls('fighter', 5, true)] }) })
    ctx.form.manual_modes = ['spell_slots']
    const html = renderToStaticMarkup(<DndMagiasTab ctx={ctx} />)
    expect(html).toContain('Total de espaços de 1º nível')
    expect(html).toContain('Total de espaços de 9º nível')
  })

  it('recursos de classe em modo manual: total e recarga editáveis', () => {
    const base = makeCtx({ data: makeData({ resources: [resource('rage', 'Fúria', 2, 3, 'long', 'class')] }) })
    expect(renderToStaticMarkup(<DndCaracteristicasTab ctx={base} />)).not.toContain('aria-label="Remover Fúria"')
    base.form.manual_modes = ['class_resources']
    expect(renderToStaticMarkup(<DndCaracteristicasTab ctx={base} />)).toContain('aria-label="Remover Fúria"')
  })

  it('Experiência é um medidor com nível, barra e quanto falta, e não um parágrafo', () => {
    const ctx = makeCtx()
    ctx.form.experience = 299
    const html = renderToStaticMarkup(<DndPersonagemTab ctx={ctx} />)
    expect(html).toContain('dsh-xp__bar')
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('Nível pelo XP')
    expect(html).toContain('faltam <strong>1</strong> XP')
    expect(html).not.toContain('Pelo XP, o nível seria')
    ctx.form.experience = 14000
    expect(renderToStaticMarkup(<DndPersonagemTab ctx={ctx} />)).toContain('Já dá para subir de nível')
    ctx.form.experience = 400000
    expect(renderToStaticMarkup(<DndPersonagemTab ctx={ctx} />)).toContain('nível 20')
  })

  it('CD e ataque de magia aparecem em tiles com a conta em etiquetas', () => {
    const data = makeData({ classes: [cls('wizard', 5, true)] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data })} />)
    expect(html).toContain('dsh-spellstat__value')
    expect(html).toContain('Cálculo da CD das magias')
    expect(html).toContain('Cálculo do ataque de magia')
    expect(html).not.toContain('CD = 8 + bônus de proficiência')
  })

  it('legendas visuais no lugar de frases: bolinhas das perícias e recarga dos recursos', () => {
    expect(renderToStaticMarkup(<DndAtributosTab ctx={makeCtx()} />)).toContain('Meia proficiência')
    const car = renderToStaticMarkup(<DndCaracteristicasTab ctx={makeCtx()} />)
    expect(car).toContain('dsh-legend__code')
    expect(car).toContain('Descanso curto')
    expect(car).not.toContain('recarrega no descanso curto, <strong>DL</strong>')
  })

  it('Defesa e Inventário usam etiquetas de valor, e sobrecarga vira selo', () => {
    const def = renderToStaticMarkup(<DndCombateTab ctx={makeCtx()} />)
    expect(def).toContain('dsh-statchip')
    expect(def).not.toContain('Equipe a armadura e o escudo na aba Inventário')
    const ctx = makeCtx()
    ctx.form.strength = 3
    const inv = renderToStaticMarkup(<DndInventarioTab ctx={ctx} />)
    expect(inv).toContain('Capacidade')
    expect(inv).toContain('Carregando')
    expect(inv).not.toContain('Capacidade de carga = Força')
  })

  it('Magias de um não conjurador explica quem conjura', () => {
    const data = makeData({ classes: [cls('fighter', 5, true)] })
    const html = renderToStaticMarkup(<DndMagiasTab ctx={makeCtx({ data })} />)
    expect(html).toContain('Nenhuma classe conjuradora')
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
    for (const t of ['Nome', 'Recarga', 'Restante', 'Total', 'Traços raciais', 'Traços de antecedente', 'Características de classe']) expect(html).toContain(t)
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
