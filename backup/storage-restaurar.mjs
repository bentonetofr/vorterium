// Devolve os arquivos do backup do Storage pra um projeto Supabase (o novo, num caso B).
// Roda dentro do Docker; veja COMO-USAR-E-RESTAURAR.txt.
//
// Variaveis: SUPABASE_URL, SUPABASE_KEY (service_role do projeto de DESTINO), ORIGEM (pasta storage do backup).
//
// Cria os buckets que faltam (se as migrations ja rodaram, eles ja existem) e envia cada
// arquivo. Pode rodar de novo sem medo: o que ja esta la e sobrescrito com o mesmo conteudo.

import { readFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const KEY = process.env.SUPABASE_KEY ?? ''
const ORIGEM = process.env.ORIGEM ?? '/backup/storage'
const PARALELO = 4

if (!BASE || !KEY) {
  console.error('FALHA: faltou SUPABASE_URL ou SUPABASE_KEY')
  process.exit(2)
}

const headers = { Authorization: `Bearer ${KEY}`, apikey: KEY }
const codifica = (caminho) => caminho.split('/').map(encodeURIComponent).join('/')

async function api(rota, init = {}) {
  return fetch(`${BASE}/storage/v1${rota}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
}

async function main() {
  const buckets = JSON.parse(await readFile(path.join(ORIGEM, '_buckets.json'), 'utf8'))
  const arquivos = JSON.parse(await readFile(path.join(ORIGEM, '_arquivos.json'), 'utf8'))

  for (const b of buckets) {
    const res = await api('/bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: b.id, name: b.name, public: b.public,
        file_size_limit: b.file_size_limit ?? undefined,
        allowed_mime_types: b.allowed_mime_types ?? undefined,
      }),
    })
    // 400/409: o bucket ja existe (as migrations criaram) - tudo certo
    if (!res.ok && res.status !== 409 && res.status !== 400) {
      console.error(`FALHA: nao deu pra criar o bucket ${b.id}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
      process.exitCode = 1
      return
    }
  }

  let enviados = 0
  const falhas = []
  let proximo = 0
  async function trabalhador() {
    while (proximo < arquivos.length) {
      const item = arquivos[proximo++]
      try {
        const conteudo = await readFile(path.join(ORIGEM, item.bucket, ...item.path.split('/')))
        const res = await api(`/object/${encodeURIComponent(item.bucket)}/${codifica(item.path)}`, {
          method: 'POST',
          headers: {
            'Content-Type': item.mimetype ?? 'application/octet-stream',
            'x-upsert': 'true',
            ...(item.cacheControl ? { 'cache-control': item.cacheControl } : {}),
          },
          body: conteudo,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
        enviados++
      } catch (err) {
        falhas.push(`${item.bucket}/${item.path}: ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabalhador))

  for (const f of falhas.slice(0, 20)) console.error(`  ERRO ${f}`)
  console.log(`RESUMO arquivos=${arquivos.length} enviados=${enviados} falhas=${falhas.length}`)
  process.exitCode = falhas.length > 0 ? 1 : 0
}

// sem process.exit(): no Windows ele derruba o Node com erro no meio das conexoes abertas
main().catch((err) => {
  console.error(`FALHA: ${err.message}`)
  process.exitCode = 1
})
