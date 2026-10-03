// ────────────────────────────────────────────────────────
// Enigmas: valida o conteúdo de enigmas/<jogo>/*.json e gera a migration
// com a função enigma_content() — o conteúdo (com as soluções) fica só no
// banco, nunca no navegador. Rodar depois de editar os JSON:
//
//   node scripts/enigma-content.mjs
//
// e rodar no Supabase o SQL gerado (supabase/migrations/20240178000000_enigmas_conteudo.sql).
// Os testes do conteúdo (solução única do A1, simulação do B1…) rodam aqui:
// se algo não fecha, o script para e diz o quê.
// ────────────────────────────────────────────────────────

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd(), 'enigmas')
const OUT = resolve(process.cwd(), 'supabase', 'migrations', '20240178000000_enigmas_conteudo.sql')

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}
function check(cond, msg) { if (!cond) fail(msg) }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ── A1: Testemunhas de Papel ────────────────────────────

function a1Text(d, a1) {
  const ala = (s) => a1.alas[a1.alas_curtas.indexOf(s)] ?? s
  const [s, t] = d.args
  switch (d.tipo) {
    case 'is':   return `${s} estava na ${ala(t)}.`
    case 'not':  return `${s} não estava na ${ala(t)}.`
    case 'left': return `${s} estava mais perto da entrada do que ${t}.`
    case 'adj':  return `${s} estava numa ala vizinha à de ${t}.`
    default: fail(`A1: tipo de depoimento desconhecido: ${d.tipo}`)
  }
}

function a1Holds(d, world, a1) {
  const pos = (name) => world[name]
  const [s, t] = d.args
  switch (d.tipo) {
    case 'is':   return pos(s) === a1.alas_curtas.indexOf(t)
    case 'not':  return pos(s) !== a1.alas_curtas.indexOf(t)
    case 'left': return pos(s) < pos(t)
    case 'adj':  return Math.abs(pos(s) - pos(t)) === 1
  }
}

function permutations(n) {
  if (n === 1) return [[0]]
  const out = []
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)])
  return out
}

/**
 * Mundos (suspeito → ala) consistentes com o que se sabe: a tinta de TODOS
 * os depoimentos (o Cruzador vê) e o texto só dos `known` (lidos, de livros
 * disponíveis). Regra: cada livro tem 1 falso, ele é de tinta fresca; antiga
 * é verdade. Livros em `gone` (lacrados sem leitura) não dizem nada.
 */
function a1Worlds(a1, known) {
  const perms = permutations(a1.suspeitos.length)
  const worlds = []
  for (const p of perms) {
    const world = Object.fromEntries(a1.suspeitos.map((s, i) => [s, p[i]]))
    let ok = true
    for (const book of a1.livros) {
      const items = a1.depoimentos.filter((d) => d.livro === book.id)
      const fresh = items.filter((d) => d.tinta === 'fresca')
      // Algum dos frescos pode ser o falso (exatamente um falso no livro).
      const fits = fresh.some((liar) => items.every((d) => {
        if (!known.has(`${d.livro}-${d.n}`)) return true
        const truth = d === liar ? false : true
        return a1Holds(d, world, a1) === truth
      }))
      if (!fits) { ok = false; break }
    }
    if (ok) worlds.push(world)
  }
  return worlds
}

function validateA1(a1) {
  check(a1.suspeitos.length === 5 && a1.alas.length === 5, 'A1: precisa de 5 suspeitos e 5 alas.')
  for (const book of a1.livros) {
    const items = a1.depoimentos.filter((d) => d.livro === book.id)
    check(items.length === 3, `A1: o ${book.titulo} precisa de 3 depoimentos.`)
    check(items.filter((d) => !d.verdade).length === 1, `A1: o ${book.titulo} precisa de exatamente 1 falso.`)
    check(items.every((d) => d.verdade || d.tinta === 'fresca'), `A1: no ${book.titulo} a mentira tem que ser de tinta fresca.`)
    check(items.filter((d) => d.tinta === 'fresca' && d.verdade).length === 1, `A1: o ${book.titulo} precisa de 1 verdade de tinta fresca (a isca).`)
  }
  // A solução declarada satisfaz cada depoimento como marcado.
  const sol = Object.fromEntries(Object.entries(a1.solucao).map(([s, ala]) => [s, a1.alas_curtas.indexOf(ala)]))
  for (const d of a1.depoimentos) check(a1Holds(d, sol, a1) === d.verdade, `A1: o depoimento ${d.livro} #${d.n} não bate com a solução.`)
  // Solução única lendo tudo.
  const all = new Set(a1.depoimentos.map((d) => `${d.livro}-${d.n}`))
  const worlds = a1Worlds(a1, all)
  check(worlds.length === 1 && a1.suspeitos.every((s) => worlds[0][s] === sol[s]), `A1: lendo tudo, existem ${worlds.length} mundos possíveis (precisa ser 1, a solução).`)
  check(a1.solucao[a1.culpado] === 'Proibida', 'A1: o culpado precisa estar na Ala Proibida.')
  // Existe um conjunto de 8 leituras que já determina a solução.
  const ids = [...all]
  let path8 = null
  const combo = (start, chosen) => {
    if (path8) return
    if (chosen.length === 8) { if (a1Worlds(a1, new Set(chosen)).length === 1) path8 = [...chosen]; return }
    for (let i = start; i < ids.length; i++) { chosen.push(ids[i]); combo(i + 1, chosen); chosen.pop() }
  }
  combo(0, [])
  check(path8, 'A1: não existe caminho de 8 leituras que determine a solução.')
  // Ordem de lacre: livros cuja falta (somada) ainda deixa a solução única.
  const sealOrder = []
  for (const book of a1.livros) {
    const without = new Set([...all].filter((id) => ![...sealOrder, book.id].some((b) => id.startsWith(`${b}-`))))
    if (a1Worlds(a1, without).length === 1) sealOrder.push(book.id)
  }
  console.log(`  A1: solução única ✓ · caminho de 8 leituras: ${path8.join(', ')} · livros lacráveis: ${sealOrder.join(', ') || 'nenhum'}`)
  return {
    ...a1,
    depoimentos: a1.depoimentos.map((d) => ({ ...d, id: `${d.livro}-${d.n}`, texto: a1Text(d, a1) })),
    lacre_ordem: sealOrder,
  }
}

// ── B1: O Baile em 3 Valsas ─────────────────────────────

function b1Apply(arr, rule) {
  const n = arr.length
  const out = [...arr]
  switch (rule.op) {
    case 'girar':      for (let i = 0; i < n; i++) out[i] = arr[(((i - rule.k) % n) + n) % n]; return out
    case 'pares':      for (let i = 0; i + 1 < n; i += 2) { out[i] = arr[i + 1]; out[i + 1] = arr[i] } return out
    case 'oposto':     for (let i = 0; i < n; i++) out[i] = arr[(i + n / 2) % n]; return out
    case 'espelhar':   for (let i = 0; i < n; i++) out[i] = arr[n - 1 - i]; return out
    case 'inverter03': out[0] = arr[3]; out[1] = arr[2]; out[2] = arr[1]; out[3] = arr[0]; return out
    default: fail(`B1: operação desconhecida: ${rule.op}`)
  }
}

function validateB1(b1) {
  let masks = b1.mascaras
  let people = b1.pessoas
  for (const v of b1.valsas) { masks = b1Apply(masks, v.mascaras); people = b1Apply(people, v.pessoas) }
  check(eq(masks, b1.esperado.mascaras), `B1: máscaras no fim deram ${masks.join(', ')} (esperado ${b1.esperado.mascaras.join(', ')}).`)
  check(eq(people, b1.esperado.pessoas), `B1: pessoas no fim deram ${people.join(', ')} (esperado ${b1.esperado.pessoas.join(', ')}).`)
  const seat = masks.indexOf('Raposa')
  check(people[seat] === b1.culpado, `B1: a Raposa termina no assento ${seat}, com ${people[seat]} — não com ${b1.culpado}.`)
  console.log(`  B1: simulação bate ✓ · Raposa no assento ${seat}, com ${people[seat]}`)
  return { ...b1, assento_final: seat }
}

// ── Gerar ───────────────────────────────────────────────

const games = {}
for (const id of readdirSync(ROOT)) {
  const dir = resolve(ROOT, id)
  const read = (f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8'))
  console.log(`• ${id}`)
  const game = { historia: read('historia.json') }
  if (existsSync(resolve(dir, 'a1.json'))) game.a1 = validateA1(read('a1.json'))
  if (existsSync(resolve(dir, 'b1.json'))) game.b1 = validateB1(read('b1.json'))
  games[id] = game
}

const json = JSON.stringify(games)
check(!json.includes('$conteudo$'), 'O conteúdo não pode ter o texto $conteudo$.')
const sql = `-- ════════════════════════════════════════════════════════
-- Enigmas: conteúdo dos jogos (GERADO — não editar à mão).
-- Fonte: enigmas/<jogo>/*.json · gerar com: node scripts/enigma-content.mjs
-- Só as funções do banco leem isto (as soluções nunca vão pro navegador).
-- ════════════════════════════════════════════════════════

create or replace function public.enigma_content(p_game text)
returns jsonb
language sql
immutable
set search_path = public
as $fn$
  select ($conteudo$${json}$conteudo$::jsonb) -> p_game;
$fn$;

revoke all on function public.enigma_content(text) from public, anon, authenticated;
`
writeFileSync(OUT, sql)
console.log(`\n✓ ${OUT.replace(process.cwd() + '\\', '').replace(process.cwd() + '/', '')} (${(sql.length / 1024).toFixed(1)} KB)`)
