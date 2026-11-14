// Copia TODOS os arquivos do Storage do Supabase pra uma pasta local.
// Roda dentro do Docker (veja backup.bat); nao precisa de nada instalado.
//
// Variaveis: SUPABASE_URL, SUPABASE_KEY (chave service_role), DESTINO (pasta de saida).
//
// So baixa o que ainda nao tem (mesmo caminho e mesmo tamanho): os arquivos do site
// tem nome unico e nunca mudam, entao a segunda rodada em diante baixa so o que e novo
// e gasta quase nenhum trafego do Supabase. Nada que ja foi baixado e apagado aqui:
// se alguem apagar um arquivo no site, a copia dele continua no backup.

import { createWriteStream } from 'node:fs'
import { mkdir, rename, stat, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const BASE = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const KEY = process.env.SUPABASE_KEY ?? ''
const DESTINO = process.env.DESTINO ?? '/backup/storage'
const PARALELO = 4

if (!BASE || !KEY) {
  console.error('FALHA: faltou SUPABASE_URL ou SUPABASE_KEY no chave.txt')
  process.exit(2)
}

const headers = { Authorization: `Bearer ${KEY}`, apikey: KEY }

async function api(rota, init = {}) {
  return fetch(`${BASE}/storage/v1${rota}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
}

async function erroDe(res) {
  const texto = await res.text().catch(() => '')
  return `HTTP ${res.status} ${texto.slice(0, 200)}`
}

const codifica = (caminho) => caminho.split('/').map(encodeURIComponent).join('/')

/** Lista uma "pasta" do bucket (so um nivel; pastas voltam com id nulo). */
async function listaPasta(bucket, prefixo) {
  const itens = []
  for (let offset = 0; ; offset += 1000) {
    const res = await api(`/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefixo, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    if (!res.ok) throw new Error(`nao deu pra listar ${bucket}/${prefixo}: ${await erroDe(res)}`)
    const pagina = await res.json()
    itens.push(...pagina)
    if (pagina.length < 1000) return itens
  }
}

/** Todos os arquivos do bucket, entrando nas pastas. */
async function listaBucket(bucket) {
  const arquivos = []
  const fila = ['']
  while (fila.length > 0) {
    const prefixo = fila.pop()
    for (const item of await listaPasta(bucket, prefixo)) {
      const caminho = prefixo ? `${prefixo}/${item.name}` : item.name
      if (item.id === null || item.id === undefined) fila.push(caminho)
      else arquivos.push({
        bucket,
        path: caminho,
        size: Number(item.metadata?.size ?? 0),
        mimetype: item.metadata?.mimetype ?? null,
        cacheControl: item.metadata?.cacheControl ?? null,
      })
    }
  }
  return arquivos
}

/** Caminho local seguro: o nome vem do banco, mas nunca deixa sair da pasta de destino. */
function destinoLocal(bucket, caminho) {
  const partes = [bucket, ...caminho.split('/')]
  if (partes.some((p) => p === '' || p === '.' || p === '..')) throw new Error(`caminho estranho: ${caminho}`)
  return path.join(DESTINO, ...partes)
}

async function jaTem(arquivo, tamanho) {
  try {
    const info = await stat(arquivo)
    return info.isFile() && tamanho > 0 && info.size === tamanho
  } catch {
    return false
  }
}

async function baixa(item) {
  const alvo = destinoLocal(item.bucket, item.path)
  if (await jaTem(alvo, item.size)) return 'ja_tinha'
  await mkdir(path.dirname(alvo), { recursive: true })
  const res = await api(`/object/authenticated/${encodeURIComponent(item.bucket)}/${codifica(item.path)}`)
  if (!res.ok || !res.body) throw new Error(await erroDe(res))
  const parcial = `${alvo}.parte`
  try {
    await pipeline(Readable.fromWeb(res.body), createWriteStream(parcial))
    const gravado = (await stat(parcial)).size
    if (item.size > 0 && gravado !== item.size) throw new Error(`veio com ${gravado} bytes, o esperado era ${item.size}`)
    await rename(parcial, alvo)
  } catch (err) {
    await rm(parcial, { force: true })
    throw err
  }
  return 'baixado'
}

async function main() {
  const resBuckets = await api('/bucket')
  if (!resBuckets.ok) {
    console.error(`FALHA: nao deu pra listar os buckets: ${await erroDe(resBuckets)}`)
    process.exitCode = 1
    return
  }
  const buckets = await resBuckets.json()
  await mkdir(DESTINO, { recursive: true })

  const todos = []
  for (const b of buckets) {
    const arquivos = await listaBucket(b.id)
    console.log(`  ${b.id}: ${arquivos.length} arquivos`)
    todos.push(...arquivos)
  }

  let baixados = 0
  let jaTinha = 0
  let bytesNovos = 0
  const falhas = []
  let proximo = 0
  async function trabalhador() {
    while (proximo < todos.length) {
      const item = todos[proximo++]
      try {
        const resultado = await baixa(item)
        if (resultado === 'baixado') { baixados++; bytesNovos += item.size } else jaTinha++
      } catch (err) {
        falhas.push(`${item.bucket}/${item.path}: ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabalhador))

  // lista do que existia no momento: serve pra conferir e pra restaurar
  await writeFile(path.join(DESTINO, '_buckets.json'), JSON.stringify(buckets.map((b) => ({
    id: b.id, name: b.name, public: b.public, file_size_limit: b.file_size_limit ?? null,
    allowed_mime_types: b.allowed_mime_types ?? null,
  })), null, 2))
  await writeFile(path.join(DESTINO, '_arquivos.json'), JSON.stringify(todos, null, 2))

  for (const f of falhas.slice(0, 20)) console.error(`  ERRO ${f}`)
  if (falhas.length > 20) console.error(`  ... e mais ${falhas.length - 20} erros`)
  console.log(`RESUMO buckets=${buckets.length} arquivos=${todos.length} baixados=${baixados} ja_tinha=${jaTinha} falhas=${falhas.length} bytes_novos=${bytesNovos}`)
  process.exitCode = falhas.length > 0 ? 1 : 0
}

// sem process.exit(): no Windows ele derruba o Node com erro no meio das conexoes abertas
main().catch((err) => {
  console.error(`FALHA: ${err.message}`)
  process.exitCode = 1
})
