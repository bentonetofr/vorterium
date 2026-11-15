// Devolve os arquivos do backup do Storage pra um projeto Supabase (o novo, num caso B).
// Roda dentro do Docker; veja COMO-USAR-E-RESTAURAR.txt.
//
// Variaveis: SUPABASE_URL, SUPABASE_KEY (service_role do projeto de DESTINO), ORIGEM (pasta storage do backup).
//
// Cria os buckets que faltam (se as migrations ja rodaram, eles ja existem) e envia cada
// arquivo. Pode rodar de novo sem medo: o que ja esta la e sobrescrito.
//
// MODO LEVE (OTIMIZAR=1): as imagens (JPG, PNG, WebP) do bucket mesa-images saem do backup,
// passam por uma reducao (lado maior ate 2000 px, WebP qualidade 82) e so a versao leve sobe.
// O caminho do arquivo NAO muda (o banco continua apontando pro mesmo lugar); so o conteudo e o
// tipo mudam. Os originais continuam intactos no backup. Nao gasta trafego do Supabase pra baixar,
// porque le tudo do disco. GIF, WebP animado e imagem que ja e leve passam sem mudar; se a versao
// leve nao ficar pelo menos 20% menor, tambem fica o original.
//   OTIMIZAR=1              liga o modo leve
//   OTIMIZAR_BUCKETS=a,b    buckets que passam pela reducao (padrao: mesa-images)
//   LADO=2000               lado maior, em pixels
//   DESTINO_LOCAL=/saida    ensaio: grava o resultado nessa pasta em vez de enviar (nao precisa de URL nem chave)
//   SHARP_DIR=/tmp          onde o sharp foi instalado (o backup.bat/guia instala la)

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const BASE = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '')
const KEY = process.env.SUPABASE_KEY ?? ''
const ORIGEM = process.env.ORIGEM ?? '/backup/storage'
const DESTINO_LOCAL = process.env.DESTINO_LOCAL ?? ''
const OTIMIZAR = process.env.OTIMIZAR === '1'
const BUCKETS_LEVES = (process.env.OTIMIZAR_BUCKETS ?? 'mesa-images').split(',').map((s) => s.trim()).filter(Boolean)
const LADO = Number(process.env.LADO ?? 2000)
const QUALIDADE = 82
const JA_E_LEVE = 350 * 1024
const GANHO_MINIMO = 0.8
const CACHE_LONGO = '31536000'
const PARALELO = 4

if (!DESTINO_LOCAL && (!BASE || !KEY)) {
  console.error('FALHA: faltou SUPABASE_URL ou SUPABASE_KEY')
  process.exit(2)
}

const headers = { Authorization: `Bearer ${KEY}`, apikey: KEY }
const codifica = (caminho) => caminho.split('/').map(encodeURIComponent).join('/')

async function api(rota, init = {}) {
  return fetch(`${BASE}/storage/v1${rota}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
}

let sharp = null
if (OTIMIZAR) {
  try {
    sharp = createRequire(path.join(process.env.SHARP_DIR ?? '/tmp', 'x.js'))('sharp')
  } catch (err) {
    console.error(`FALHA: modo leve ligado, mas o sharp nao esta instalado em ${process.env.SHARP_DIR ?? '/tmp'} (${err.message})`)
    process.exit(2)
  }
}

const TIPOS_REDUZIVEIS = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** Devolve o que vai ser enviado: o original, ou a versao leve (com tipo e cache novos). */
async function prepara(item, conteudo) {
  const original = { conteudo, mimetype: item.mimetype ?? 'application/octet-stream', cacheControl: item.cacheControl ?? null, reduzida: false }
  if (!OTIMIZAR || !BUCKETS_LEVES.includes(item.bucket) || !TIPOS_REDUZIVEIS.has(item.mimetype ?? '')) return original
  try {
    const meta = await sharp(conteudo, { failOn: 'none' }).metadata()
    if ((meta.pages ?? 1) > 1) return original // WebP animado
    const maior = Math.max(meta.width ?? 0, meta.height ?? 0)
    if (maior <= LADO && conteudo.length <= JA_E_LEVE) return original
    const leve = await sharp(conteudo, { failOn: 'none' })
      .rotate() // grava a orientacao do celular (EXIF) na propria imagem
      .resize({ width: LADO, height: LADO, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE })
      .toBuffer()
    if (leve.length > conteudo.length * GANHO_MINIMO) return original
    return { conteudo: leve, mimetype: 'image/webp', cacheControl: CACHE_LONGO, reduzida: true }
  } catch (err) {
    console.error(`  AVISO nao deu pra reduzir ${item.bucket}/${item.path} (${err.message}); vai o original`)
    return original
  }
}

async function main() {
  const buckets = JSON.parse(await readFile(path.join(ORIGEM, '_buckets.json'), 'utf8'))
  const arquivos = JSON.parse(await readFile(path.join(ORIGEM, '_arquivos.json'), 'utf8'))

  if (!DESTINO_LOCAL) {
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
  }

  let enviados = 0
  let reduzidas = 0
  let bytesAntes = 0
  let bytesDepois = 0
  const falhas = []
  let proximo = 0
  async function trabalhador() {
    while (proximo < arquivos.length) {
      const item = arquivos[proximo++]
      try {
        const lido = await readFile(path.join(ORIGEM, item.bucket, ...item.path.split('/')))
        const envio = await prepara(item, lido)
        bytesAntes += lido.length
        bytesDepois += envio.conteudo.length
        if (envio.reduzida) reduzidas++
        if (DESTINO_LOCAL) {
          const alvo = path.join(DESTINO_LOCAL, item.bucket, ...item.path.split('/'))
          await mkdir(path.dirname(alvo), { recursive: true })
          await writeFile(alvo, envio.conteudo)
        } else {
          const res = await api(`/object/${encodeURIComponent(item.bucket)}/${codifica(item.path)}`, {
            method: 'POST',
            headers: {
              'Content-Type': envio.mimetype,
              'x-upsert': 'true',
              ...(envio.cacheControl ? { 'cache-control': envio.cacheControl } : {}),
            },
            body: envio.conteudo,
          })
          if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`)
        }
        enviados++
      } catch (err) {
        falhas.push(`${item.bucket}/${item.path}: ${err.message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: PARALELO }, trabalhador))

  for (const f of falhas.slice(0, 20)) console.error(`  ERRO ${f}`)
  const mb = (n) => (n / 1024 / 1024).toFixed(1)
  console.log(`RESUMO arquivos=${arquivos.length} ${DESTINO_LOCAL ? 'gravados' : 'enviados'}=${enviados} falhas=${falhas.length}` +
    (OTIMIZAR ? ` reduzidas=${reduzidas} MB_antes=${mb(bytesAntes)} MB_depois=${mb(bytesDepois)}` : ''))
  process.exitCode = falhas.length > 0 ? 1 : 0
}

// sem process.exit(): no Windows ele derruba o Node com erro no meio das conexoes abertas
main().catch((err) => {
  console.error(`FALHA: ${err.message}`)
  process.exitCode = 1
})
