import { ARMORS, SHIELD, getArmor, getWeapon } from '../../catalog'
import { getBookItem, type BookItem } from '../../catalog/itemBook'
import type { DndCharacterAttackInput, DndCharacterInventoryInput } from '../../../../../shared/types'
import type { Ctx } from '../ctx'
import { itemCandidates, matchArmorText, matchItemExact, matchWeapon, rank } from '../match'
import { clip, fold, parseDamage, parseInt0, splitBullets } from '../text'

// ────────────────────────────────────────────────────────
// Etapa 6: moedas, armadura e escudo vestidos, ataques e o inventário
// (as listas em texto livre, os consumíveis, a munição e os itens
// sintonizados). Armas e armaduras do catálogo entram com a chave do catálogo,
// que é o que liga o item às contas da ficha.
// ────────────────────────────────────────────────────────

function invRow(over: Partial<DndCharacterInventoryInput> & { name: string }): DndCharacterInventoryInput {
  return { quantity: 1, weight: 0, equipped: false, notes: '', catalog_entry_key: null, sort_order: 0, ...over }
}
function fromBook(b: BookItem, over: Partial<DndCharacterInventoryInput> = {}): DndCharacterInventoryInput {
  return invRow({ name: b.name, weight: b.weight, notes: b.note, catalog_entry_key: b.key, ...over })
}

function coins(c: Ctx): void {
  const f = c.draft.form
  const k = c.read.coins
  const get = (label: string, v: string) => {
    if (!v) return 0
    const n = parseInt0(v)
    if (n == null || n < 0) { c.note(`Moeda ${label}: "${v}" não é um número, ficou 0.`); return 0 }
    return Math.min(n, 99999999)
  }
  f.coin_cp = get('PC', k.cp); f.coin_sp = get('PP', k.sp); f.coin_ep = get('PE', k.ep); f.coin_gp = get('PO', k.gp); f.coin_pp = get('PL', k.pp)
}

/** CA que a armadura dá com o modificador de Destreza (para reconhecer a armadura pelo número do PDF). */
function acWith(armor: (typeof ARMORS)[number], dexMod: number): number {
  const dex = armor.dexCap == null ? dexMod : Math.min(dexMod, armor.dexCap)
  return armor.baseAc + dex
}

function wornArmor(c: Ctx): void {
  const a = c.read.armor
  const dexMod = Math.floor((c.draft.form.dexterity - 10) / 2)
  const pdfAc = parseInt0(a.ac)

  if (a.type && !/^[-–—]+$/.test(a.type)) {
    let armor = matchArmorText(a.type)
    // reconhecida só pelo nome parecido ou não reconhecida: o número de CA do PDF desempata
    if (!armor) {
      const byAc = pdfAc != null ? ARMORS.filter((x) => acWith(x, dexMod) === pdfAc) : []
      const pick = c.askChoice({
        id: 'armor', section: 'Equipamento', kind: 'choice',
        title: `Qual é a armadura "${a.type}"?`,
        body: `Não achei essa armadura no catálogo${pdfAc != null ? ` (o PDF diz CA ${pdfAc} com ela)` : ''}. Escolha a mais parecida, ou guarde só o nome.`,
        options: [
          ...rank(a.type, ARMORS, 0.3).slice(0, 3).map((r) => ({ value: r.item.key, label: r.item.name, hint: `CA ${r.item.baseAc}${byAc.some((b) => b.key === r.item.key) ? ' · bate com a CA do PDF' : ''}` })),
          ...byAc.filter((b) => !rank(a.type, ARMORS, 0.3).slice(0, 3).some((r) => r.item.key === b.key)).map((b) => ({ value: b.key, label: b.name, hint: `CA ${b.baseAc} · bate com a CA do PDF` })),
          { value: 'custom', label: `Guardar só o nome "${clip(a.type, 40)}"`, hint: 'Entra no inventário como item próprio, sem contas de CA.' },
          { value: 'none', label: 'Não está vestindo armadura' },
        ],
        recommended: byAc[0]?.key,
      })
      if (pick === 'custom') c.draft.inventory.push(invRow({ name: a.type.slice(0, 120), equipped: true, notes: 'Armadura (do PDF)' }))
      else if (pick !== 'none') armor = getArmor(pick) ?? null
    }
    if (armor) {
      const book = getBookItem(armor.key)
      c.draft.inventory.push(book ? fromBook(book, { equipped: true }) : invRow({ name: armor.name, equipped: true, catalog_entry_key: armor.key, weight: armor.weight }))
    }
  }
  const shield = parseInt0(a.shield)
  if (shield != null && shield > 0) {
    const book = getBookItem(SHIELD.key)
    c.draft.inventory.push(book ? fromBook(book, { equipped: true }) : invRow({ name: SHIELD.name, equipped: true, catalog_entry_key: SHIELD.key, weight: SHIELD.weight }))
  }
}

// ── Ataques ─────────────────────────────────────────────

function attacks(c: Ctx): void {
  const out: DndCharacterAttackInput[] = []
  c.read.attacks.forEach((a, i) => {
    if (!a.name) return
    let weapon = matchWeapon(a.name)
    if (!weapon) {
      const cands = itemCandidates(a.name, 0.7, 3).filter((x) => x.item.kind === 'weapon')
      if (cands.length > 0) {
        const pick = c.askChoice({
          id: `attack:${i}`, section: 'Ataques', kind: 'choice',
          title: `Qual é a arma "${a.name}"?`,
          body: 'O nome não é exatamente o de uma arma do catálogo. Ligar a uma arma do catálogo faz o bônus e o dano saírem das contas da ficha.',
          options: [...cands.map((x) => ({ value: x.item.key, label: x.item.name, hint: x.item.tags[0] })), { value: 'custom', label: `Ataque próprio "${clip(a.name, 40)}"`, hint: 'Mantém o bônus e o dano escritos no PDF.' }],
        })
        if (pick !== 'custom') weapon = getWeapon(pick) ?? null
      }
    }
    const dmg = a.damage ? parseDamage(a.damage) : null
    const bonusN = parseInt0(a.bonus)
    const bonus = bonusN != null ? (bonusN >= 0 ? `+${bonusN}` : `${bonusN}`) : a.bonus.trim()
    // dano igual ao da arma do catálogo: deixa vazio (a ficha calcula com o modificador)
    const sameAsBook = !!weapon && !!dmg && dmg.dice === (weapon.damage ?? '')
    out.push({
      name: (weapon?.name ?? a.name).slice(0, 120),
      attack_bonus: bonus.slice(0, 20),
      damage: sameAsBook ? '' : (dmg?.dice ?? a.damage).slice(0, 60),
      damage_type: (weapon?.damageType ?? dmg?.type ?? '').slice(0, 40),
      notes: weapon && a.name !== weapon.name && fold(a.name) !== fold(weapon.name) ? `No PDF: ${a.name}` : '',
      catalog_entry_key: weapon?.key ?? null,
      sort_order: out.length,
    })
  })
  c.draft.attacks = out
  if (out.length) c.note(`Ataques: ${out.map((a) => a.name).join(', ')}`)
}

// ── Inventário ──────────────────────────────────────────

interface ItemCand { raw: string; name: string; notes: string; qty: number; book: BookItem | null; origin: string }

/** "3 Tochas", "Flechas x20", "Banjo (Estribeira Lamentável)", "Pacote de Diplomata (39 po). Inclui...". */
export function parseItemLine(raw: string): { name: string; notes: string; qty: number } {
  let text = raw.trim()
  let qty = 1
  const lead = /^(\d{1,4})\s*[xX×]?\s+(?=\D)/.exec(text)
  const trail = /\s[xX×]\s*(\d{1,4})$/.exec(text)
  if (lead) { qty = Number(lead[1]); text = text.slice(lead[0].length).trim() } else if (trail) { qty = Number(trail[1]); text = text.slice(0, trail.index).trim() }
  const paren = text.indexOf(' (')
  const dot = text.indexOf('. ')
  const cut = [paren, dot].filter((n) => n > 0).sort((a, b) => a - b)[0]
  if (cut == null) return { name: text, notes: '', qty }
  const name = text.slice(0, cut).trim()
  let notes = text.slice(cut).trim().replace(/^\.\s*/, '')
  const wholeParen = /^\(([^()]*)\)$/.exec(notes)
  if (wholeParen) notes = wholeParen[1].trim()
  return { name, notes, qty }
}

function candidate(raw: string, origin: string, qtyText = ''): ItemCand {
  const p = parseItemLine(raw)
  const q = parseInt0(qtyText)
  const armor = matchArmorText(p.name)
  const book = matchItemExact(p.name) ?? matchItemExact(raw.replace(/\s*\(.*$/, '').trim()) ?? (armor ? getBookItem(armor.key) ?? null : null)
  return { raw, name: p.name, notes: p.notes, qty: q != null && q > 0 ? q : p.qty, book, origin }
}

function inventory(c: Ctx): void {
  const r = c.read
  const cands: ItemCand[] = []
  for (const line of [...splitBullets(r.texts.equipment), ...splitBullets(r.texts.equipment2)]) cands.push(candidate(line, 'Equipamento'))
  for (const x of r.consumables) if (x.name) cands.push(candidate(x.name, 'Consumíveis', x.qty))
  for (const x of r.ammo) if (x.name) cands.push(candidate(x.name, 'Munição', x.qty))
  for (const x of r.attuned) cands.push(candidate(x, 'Itens sintonizados'))

  // o mesmo item escrito em dois lugares (ex.: a lista e os "sintonizados") entra uma vez
  const seen = new Set<string>()
  const unique = cands.filter((x) => { const k = fold(x.name); if (!k || seen.has(k)) return false; seen.add(k); return true })
  // a armadura vestida já entrou; não repete a que aparece na lista de texto
  const worn = new Set(c.draft.inventory.map((i) => i.catalog_entry_key).filter(Boolean))
  const items = unique.filter((x) => !(x.book && worn.has(x.book.key)))

  // itens com nome parecido (não igual) a um do catálogo: pergunta se é o do catálogo
  const resolved: { cand: ItemCand; book: BookItem | null }[] = []
  items.forEach((cand) => {
    if (cand.book) { resolved.push({ cand, book: cand.book }); return }
    const near = itemCandidates(cand.name, 0.8, 2)
    if (near.length === 0) { resolved.push({ cand, book: null }); return }
    const pick = c.askChoice({
      id: `item:${fold(cand.name).replace(/ /g, '_')}`, section: 'Equipamento', kind: 'choice',
      title: `"${clip(cand.name, 50)}" é um item do catálogo?`,
      body: `Está em ${cand.origin} no PDF. Se for do catálogo, entra com o peso e a descrição dele.`,
      options: [...near.map((n) => ({ value: n.item.key, label: n.item.name, hint: n.item.tags.slice(0, 2).join(' · ') })), { value: 'custom', label: `Item próprio "${clip(cand.name, 40)}"` }, { value: 'skip', label: 'Não importar este item' }],
    })
    if (pick === 'skip') return
    resolved.push({ cand, book: pick === 'custom' ? null : getBookItem(pick) ?? null })
  })

  if (resolved.length > 0) {
    const chosen = new Set(c.askMulti({
      id: 'items', section: 'Equipamento', kind: 'multi',
      title: 'Estes são os itens do inventário. Está certo?',
      body: 'Separei o texto do PDF em itens. Desmarque o que não é um item (anotações, por exemplo). Os que reconheci do catálogo mostram o nome do catálogo.',
      options: resolved.map(({ cand, book }, idx) => ({
        value: String(idx), checked: true,
        label: `${cand.qty > 1 ? `${cand.qty}× ` : ''}${book ? book.name : cand.name}`,
        hint: [book ? 'do catálogo' : 'item próprio', cand.notes ? clip(cand.notes, 70) : '', cand.origin].filter(Boolean).join(' · '),
      })),
    }))
    resolved.forEach(({ cand, book }, idx) => {
      if (!chosen.has(String(idx))) return
      const notes = [book?.note, cand.notes].filter(Boolean).join(' · ')
      c.draft.inventory.push(book
        ? fromBook(book, { quantity: Math.min(9999, cand.qty), notes: notes.slice(0, 1000) })
        : invRow({ name: cand.name.slice(0, 120), quantity: Math.min(9999, cand.qty), notes: cand.notes.slice(0, 1000) }))
    })
  }
  c.draft.inventory.forEach((it, i) => { it.sort_order = i })
  c.note(`Inventário: ${c.draft.inventory.length} item(ns)`)
}

export const GEAR_STEPS = [coins, wornArmor, attacks, inventory]
