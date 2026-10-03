// ────────────────────────────────────────────────────────
// O Crime de Caatedrum — confere o conteúdo (jogos/caatedrum/*.json) e
// grava a migration que guarda ele no banco: caat_content().
//
//   node scripts/caatedrum-conteudo.mjs
//
// Confere: regras com os campos certos; o caso coerente (mapa ligado,
// todo mundo se move só pra sala vizinha entre sinos, o culpado está no
// local do corpo na hora do crime, o motivo é um dos 3 do culpado, cúmplice
// diferente do culpado, cada arma com 2 sinais e nenhum par repetido).
// O baralho (marco 3) entra aqui também, com o resolvedor.
// ────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve(process.cwd(), 'jogos', 'caatedrum')
const out = resolve(process.cwd(), 'supabase', 'migrations', '20240178000000_caatedrum_conteudo.sql')
const read = (f) => JSON.parse(readFileSync(resolve(dir, f), 'utf8'))

const erros = []
const check = (ok, msg) => { if (!ok) erros.push(msg) }
const isInt = (v, min = 0) => Number.isInteger(v) && v >= min

// ── Regras ──
const regras = read('regras.config.json')
const o = regras.original ?? {}
for (const k of ['jogadores', 'maoInicial', 'referenciasPorPedido', 'compraQuandoNinguemOferta', 'descartarAteFicarCom', 'completarMaoAte', 'aoReembaralharRevelar', 'erroNaSolucaoFicaForaDe', 'baralhoPorCaso', 'ofertaPrecisaCitarAoMenos']) {
  check(isInt(o[k]), `regras.original.${k} precisa ser um número inteiro`)
}
check(o.jogadores === 4, 'regras.original.jogadores: este jogo é para 4')
check(o.descartarAteFicarCom <= o.completarMaoAte, 'descartarAteFicarCom não pode passar de completarMaoAte')
check(Array.isArray(o.tiposDeReferencia) && o.tiposDeReferencia.every((t) => ['suspeito', 'sala'].includes(t)), 'tiposDeReferencia: só "suspeito" e "sala"')
const se = regras.sessao ?? {}
for (const k of ['timerPedirSegundos', 'timerOfertaSegundos', 'timerTrocaSegundos', 'timerSolucaoSegundos', 'fichasInterrogatorio', 'pontosVitoria', 'pontosPorAcertoSecundario']) {
  check(isInt(se[k]), `regras.sessao.${k} precisa ser um número inteiro (0 desliga)`)
}
check(se.rodadasMax === null || isInt(se.rodadasMax, 1), 'regras.sessao.rodadasMax: número ou null (sem limite)')

// ── Textos ──
const textos = read('textos.json')
check(Array.isArray(textos.niveis) && textos.niveis.length === 5, 'textos.niveis: 5 níveis')
check(Array.isArray(textos.assentos) && textos.assentos.length === o.jogadores, 'textos.assentos: um por jogador')

// ── Caso ──
const caso = read('caso1.json')
const pub = caso.publico
const sec = caso.secreto
const ids = (list) => list.map((x) => x.id)
const salas = new Set(ids(pub.salas))
const suspeitos = new Set(ids(pub.suspeitos))
const motivos = new Set(ids(pub.motivos))
const sinais = new Set(ids(pub.sinais))
const armas = new Map(pub.armas.map((a) => [a.id, a]))
check(pub.suspeitos.length === 6, 'o caso precisa de 6 suspeitos')
check(pub.sinos.length === 3, 'o caso usa 3 sinos')

const viz = new Map([...salas].map((s) => [s, new Set([s])]))
for (const [a, b] of pub.ligacoes) {
  check(salas.has(a) && salas.has(b), `ligação com sala desconhecida: ${a}-${b}`)
  viz.get(a)?.add(b)
  viz.get(b)?.add(a)
}
// Mapa todo ligado
const seen = new Set([pub.salas[0].id])
const fila = [pub.salas[0].id]
while (fila.length) for (const n of viz.get(fila.shift())) if (!seen.has(n)) { seen.add(n); fila.push(n) }
check(seen.size === salas.size, 'o mapa tem salas soltas (sem caminho)')

for (const s of pub.suspeitos) {
  check(s.motivos?.length === 3 && s.motivos.every((m) => motivos.has(m)), `${s.nome}: precisa de 3 motivos possíveis da lista`)
}
const pares = new Set()
for (const a of pub.armas) {
  check(a.sinais?.length === 2 && a.sinais.every((x) => sinais.has(x)), `${a.nome}: precisa de 2 sinais da lista`)
  const par = [...a.sinais].sort().join('+')
  check(!pares.has(par), `${a.nome}: o par de sinais ${par} repete outra arma`)
  pares.add(par)
}

const pessoas = [...suspeitos, ...ids(pub.criadagem)]
const crime = pub.sinos.findIndex((x) => x.id === pub.sino_do_crime)
for (const p of pessoas) {
  const rota = sec.mundo[p]
  check(Array.isArray(rota) && rota.length === 3 && rota.every((r) => salas.has(r)), `mundo: rota de ${p} precisa de 3 salas válidas`)
  if (rota) for (let i = 1; i < rota.length; i++) check(viz.get(rota[i - 1])?.has(rota[i]), `mundo: ${p} não chega de ${rota[i - 1]} a ${rota[i]} entre dois sinos`)
}
const sol = sec.solucao
check(suspeitos.has(sol.quem), 'solução: culpado desconhecido')
check(sec.mundo[sol.quem]?.[crime] === pub.local_do_corpo, 'solução: o culpado precisa estar no local do corpo na hora do crime')
check(pub.suspeitos.find((s) => s.id === sol.quem)?.motivos.includes(sol.porque), 'solução: o motivo precisa ser um dos 3 do culpado')
check(armas.has(sol.como), 'solução: arma desconhecida')
check(sol.cumplice === null || (suspeitos.has(sol.cumplice) && sol.cumplice !== sol.quem), 'solução: cúmplice precisa ser outro suspeito (ou null)')

if (erros.length) {
  console.error('Conteúdo com problemas:')
  for (const e of erros) console.error('  ✗ ' + e)
  process.exit(1)
}

// ── Migration ──
const conteudo = { regras, textos, casos: { caso1: caso } }
const json = JSON.stringify(conteudo)
if (json.includes('$conteudo$')) { console.error('O conteúdo não pode ter o texto $conteudo$.'); process.exit(1) }

const sql = `-- ════════════════════════════════════════════════════════
-- O Crime de Caatedrum — conteúdo (regras, textos, casos).
-- GERADO por scripts/caatedrum-conteudo.mjs a partir de jogos/caatedrum/.
-- Não edite aqui: edite os JSON e rode o script de novo.
-- Tem a solução: só as funções do jogo leem (ninguém chama direto).
-- ════════════════════════════════════════════════════════

create or replace function public.caat_content()
returns jsonb
language sql
immutable
set search_path = public
as $fn$
  select $conteudo$${json}$conteudo$::jsonb
$fn$;

revoke all on function public.caat_content() from public, anon, authenticated;
`
writeFileSync(out, sql)
console.log('Conteúdo OK:')
console.log(`  regras: mão ${o.maoInicial}, pede ${o.referenciasPorPedido} referências, descarta até ${o.descartarAteFicarCom}, completa até ${o.completarMaoAte}`)
console.log(`  caso1: ${pub.suspeitos.length} suspeitos, ${pub.salas.length} salas, ${pub.armas.length} armas, solução coerente com o mundo`)
console.log(`✓ ${out} (${(sql.length / 1024).toFixed(1)} KB)`)
