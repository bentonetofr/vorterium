import { describe, expect, it } from 'vitest'
import {
  BAR_H, BOTTOM_GAP, FloatingStore, MAX_WINDOWS, MIN_H, MIN_W, TOP_GAP, defaultSize, fitWindow, floatingReducer, parseSaved, serialize, type FloatingAction, type FloatingState, type WinState,
} from './floatingStore'

const VP = { vw: 1400, vh: 900 }
const open = (s: FloatingState, id: string) => floatingReducer(s, { type: 'open', id, ...VP })
const run = (s: FloatingState, ...as: FloatingAction[]) => as.reduce(floatingReducer, s)
const ids = (s: FloatingState) => s.wins.map((w) => w.id)
const top = (s: FloatingState) => [...s.wins].filter((w) => !w.min).sort((a, b) => b.z - a.z)[0]?.id

describe('abrir e fechar janelas', () => {
  it('uma janela nova abre em cascata, na frente e dentro da tela', () => {
    let s: FloatingState = { wins: [] }
    s = open(s, 'a'); s = open(s, 'b'); s = open(s, 'c')
    expect(ids(s)).toEqual(['a', 'b', 'c'])
    expect(top(s)).toBe('c')
    const [a, b, c] = s.wins
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.y).toBeGreaterThan(b.y)
    for (const w of s.wins) {
      expect(w.x).toBeGreaterThanOrEqual(4)
      expect(w.x + w.w).toBeLessThanOrEqual(VP.vw)
      expect(w.y).toBeGreaterThanOrEqual(TOP_GAP)
      expect(w.min || w.col || w.pin).toBe(false)
    }
  })

  it('abrir uma que já está aberta não duplica: só traz para a frente', () => {
    let s = open(open({ wins: [] }, 'a'), 'b')
    s = open(s, 'a')
    expect(ids(s)).toEqual(['a', 'b'])
    expect(top(s)).toBe('a')
  })

  it('abrir uma minimizada a devolve à tela, na frente', () => {
    let s = run(open(open({ wins: [] }, 'a'), 'b'), { type: 'min', id: 'a', value: true })
    expect(s.wins.find((w) => w.id === 'a')!.min).toBe(true)
    s = open(s, 'a')
    expect(s.wins.find((w) => w.id === 'a')!.min).toBe(false)
    expect(top(s)).toBe('a')
  })

  it('fechar tira só aquela; fechar todas esvazia', () => {
    let s = open(open(open({ wins: [] }, 'a'), 'b'), 'c')
    s = floatingReducer(s, { type: 'close', id: 'b' })
    expect(ids(s)).toEqual(['a', 'c'])
    expect(floatingReducer(s, { type: 'close', id: 'zzz' })).toBe(s)   // nada muda: mesmo objeto
    expect(floatingReducer(s, { type: 'closeAll' }).wins).toEqual([])
  })

  it('o limite de janelas: passando dele sai a mais antiga que não esteja fixada, as minimizadas primeiro', () => {
    let s: FloatingState = { wins: [] }
    for (let i = 0; i < MAX_WINDOWS; i++) s = open(s, `w${i}`)
    s = run(s, { type: 'pin', id: 'w0' }, { type: 'min', id: 'w5', value: true })
    s = open(s, 'novo')
    expect(s.wins).toHaveLength(MAX_WINDOWS)
    expect(ids(s)).toContain('w0')       // fixada fica
    expect(ids(s)).not.toContain('w5')   // a minimizada sai primeiro
    expect(ids(s)).toContain('novo')
  })
})

describe('foco e ordem de empilhamento', () => {
  it('focar leva para a frente e mantém a ordem 1..n sem buracos', () => {
    let s = open(open(open({ wins: [] }, 'a'), 'b'), 'c')
    s = run(s, { type: 'focus', id: 'a' }, { type: 'focus', id: 'b' }, { type: 'focus', id: 'a' })
    expect(top(s)).toBe('a')
    expect(s.wins.map((w) => w.z).sort()).toEqual([1, 2, 3])
  })

  it('focar quem já está na frente não muda o estado', () => {
    const s = open(open({ wins: [] }, 'a'), 'b')
    expect(floatingReducer(s, { type: 'focus', id: 'b' })).toBe(s)
    expect(floatingReducer(s, { type: 'focus', id: 'nao-existe' })).toBe(s)
  })
})

describe('mover, redimensionar, recolher, minimizar, fixar', () => {
  it('mover e redimensionar guardam números inteiros; o tamanho respeita o mínimo', () => {
    let s = open({ wins: [] }, 'a')
    s = run(s, { type: 'move', id: 'a', x: 100.6, y: 120.2 }, { type: 'resize', id: 'a', w: 10, h: 10 })
    const w = s.wins[0]
    expect([w.x, w.y]).toEqual([101, 120])
    expect([w.w, w.h]).toEqual([MIN_W, MIN_H])
  })

  it('recolher alterna, e arrumar a janela (organizar) desfaz o recolhido', () => {
    let s = open({ wins: [] }, 'a')
    s = floatingReducer(s, { type: 'col', id: 'a' })
    expect(s.wins[0].col).toBe(true)
    expect(floatingReducer(s, { type: 'col', id: 'a' }).wins[0].col).toBe(false)
    expect(floatingReducer(s, { type: 'col', id: 'a', value: true })).toBe(s)
    s = floatingReducer(s, { type: 'arrange', mode: 'cascade', ...VP })
    expect(s.wins[0].col).toBe(false)
  })

  it('minimizar e fixar são independentes', () => {
    let s = open({ wins: [] }, 'a')
    s = run(s, { type: 'pin', id: 'a' }, { type: 'min', id: 'a', value: true })
    expect(s.wins[0]).toMatchObject({ pin: true, min: true })
    expect(floatingReducer(s, { type: 'min', id: 'a', value: true })).toBe(s)
  })
})

describe('organizar e caber na tela', () => {
  it('cascata: cada janela com o tamanho padrão, uma deslocada da outra, a que estava na frente continua na frente', () => {
    let s = open(open(open({ wins: [] }, 'a'), 'b'), 'c')
    s = run(s, { type: 'move', id: 'a', x: 700, y: 400 }, { type: 'focus', id: 'a' }, { type: 'arrange', mode: 'cascade', ...VP })
    const size = defaultSize(VP)
    for (const w of s.wins) { expect(w.w).toBe(size.w); expect(w.h).toBe(size.h) }
    expect(new Set(s.wins.map((w) => `${w.x},${w.y}`)).size).toBe(3)
    expect(top(s)).toBe('a')
  })

  it('lado a lado: ocupa a tela em colunas, sem sobrepor e sem passar das bordas, e ignora as minimizadas', () => {
    let s: FloatingState = { wins: [] }
    for (const id of ['a', 'b', 'c', 'd', 'e']) s = open(s, id)
    s = run(s, { type: 'min', id: 'e', value: true }, { type: 'arrange', mode: 'tile', ...VP })
    const shown = s.wins.filter((w) => !w.min)
    expect(shown).toHaveLength(4)
    for (const w of shown) {
      expect(w.x).toBeGreaterThanOrEqual(0)
      expect(w.x + w.w).toBeLessThanOrEqual(VP.vw)
      expect(w.y + w.h).toBeLessThanOrEqual(VP.vh - BOTTOM_GAP)
    }
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) {
      const a = shown[i], b = shown[j]
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      expect(overlap, `${a.id} x ${b.id}`).toBe(false)
    }
    expect(s.wins.find((w) => w.id === 'e')!.min).toBe(true)   // a minimizada não mexe
  })

  it('uma janela sozinha em "lado a lado" ocupa a tela toda; sem janelas abertas não muda nada', () => {
    const s = floatingReducer(open({ wins: [] }, 'a'), { type: 'arrange', mode: 'tile', ...VP })
    expect(s.wins[0].w).toBeGreaterThan(VP.vw * 0.9)
    const empty: FloatingState = { wins: [] }
    expect(floatingReducer(empty, { type: 'arrange', mode: 'tile', ...VP })).toBe(empty)
  })

  it('a tela encolheu: as janelas voltam para dentro dela, com o título sempre alcançável', () => {
    let s = open({ wins: [] }, 'a')
    s = run(s, { type: 'move', id: 'a', x: 1200, y: 800 }, { type: 'fit', vw: 800, vh: 500 })
    const w = s.wins[0]
    expect(w.x + w.w).toBeLessThanOrEqual(800)
    expect(w.y).toBeLessThanOrEqual(500 - BOTTOM_GAP - BAR_H)
    expect(w.y).toBeGreaterThanOrEqual(TOP_GAP)
  })

  it('fitWindow não mexe em janela que já cabe', () => {
    const w: WinState = { id: 'a', x: 50, y: 80, w: 600, h: 400, z: 1, min: false, col: false, pin: false, snap: 0 }
    expect(fitWindow(w, VP)).toBe(w)
  })
})

describe('salvar e abrir', () => {
  it('ida e volta: o que foi salvo abre igual (menos o que é só de animação)', () => {
    let s = open(open({ wins: [] }, 'dhs:1'), 'gm:2')
    s = run(s, { type: 'move', id: 'dhs:1', x: 33, y: 99 }, { type: 'col', id: 'gm:2' }, { type: 'pin', id: 'gm:2' }, { type: 'min', id: 'dhs:1', value: true })
    const back = parseSaved(JSON.parse(serialize(s)), VP)
    expect(back.wins.map((w) => ({ ...w, snap: 0 }))).toEqual(s.wins.map((w) => ({ ...w, snap: 0 })))
  })

  it('lê lixo sem quebrar e descarta o que não presta', () => {
    expect(parseSaved(null, VP).wins).toEqual([])
    expect(parseSaved('oi', VP).wins).toEqual([])
    expect(parseSaved({ wins: 5 }, VP).wins).toEqual([])
    const s = parseSaved({ wins: [null, 3, { id: '' }, { id: 'a', x: 'x', w: Number.NaN }, { id: 'a' }, { id: 'b', x: -9999, y: 99999, w: 99999, h: 5 }] }, VP)
    expect(ids(s)).toEqual(['a', 'b'])                      // repetida e inválidas somem
    for (const w of s.wins) {
      expect(Number.isFinite(w.x + w.y + w.w + w.h)).toBe(true)
      expect(w.x).toBeGreaterThanOrEqual(4)
      expect(w.x + w.w).toBeLessThanOrEqual(VP.vw)
      expect(w.y).toBeLessThanOrEqual(VP.vh - BOTTOM_GAP - BAR_H)
    }
  })

  it('guarda no máximo MAX_WINDOWS', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `w${i}` }))
    expect(parseSaved({ wins: many }, VP).wins).toHaveLength(MAX_WINDOWS)
  })
})

describe('a loja', () => {
  const vp = () => VP
  it('avisa quem assina só quando algo muda, e dá os ids por prefixo', () => {
    const store = new FloatingStore(null, vp)
    let calls = 0
    const off = store.subscribe(() => { calls++ })
    store.open('dhs:1'); store.open('gm:9'); store.open('dhs:2')
    expect(calls).toBe(3)
    store.focus('dhs:2')                      // já está na frente: nada muda
    expect(calls).toBe(3)
    expect(store.idsWithPrefix('dhs:')).toEqual(['dhs:1', 'dhs:2'])
    expect(store.isOpen('gm:9')).toBe(true)
    off()
    store.close('gm:9')
    expect(calls).toBe(3)                     // cancelou a assinatura
  })

  it('os títulos para a barra de baixo: só avisa quando mudam', () => {
    const store = new FloatingStore(null, vp)
    let calls = 0
    store.subscribe(() => { calls++ })
    store.setMeta('a', { title: 'Lobo', badge: 'PV 3/6' })
    store.setMeta('a', { title: 'Lobo', badge: 'PV 3/6' })
    expect(calls).toBe(1)
    store.setMeta('a', { title: 'Lobo', badge: 'PV 2/6' })
    expect(calls).toBe(2)
    expect(store.getMeta('a')?.badge).toBe('PV 2/6')
  })
})
