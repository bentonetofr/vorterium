// ────────────────────────────────────────────────────────
// Importar do Miro — função no servidor (Vercel) que lê um board pela API
// oficial do Miro (REST v2) em nome de quem está importando.
//
//  • Só atende quem está logado no Vorterium (confere a sessão no Supabase).
//  • A chave do Miro vem no pedido, é usada só nele e não é guardada nem
//    registrada em lugar nenhum.
//  • Só fala com api.miro.com, em caminhos fixos (não é um proxy aberto).
//
// Ações (POST JSON):
//   { action: 'board',      token, board }            → dados do board (nome)
//   { action: 'items',      token, board, cursor? }   → uma página de itens
//   { action: 'connectors', token, board, cursor? }   → uma página de setas
//   { action: 'resource',   token, url, format? }     → bytes de uma imagem/arquivo
// ────────────────────────────────────────────────────────

const MIRO = 'https://api.miro.com/v2'
/** A Vercel corta respostas acima de ~4,5 MB. */
const MAX_FILE_BYTES = 4_000_000

type Env = Record<string, string | undefined>
const env: Env = (globalThis as { process?: { env: Env } }).process?.env ?? {}

interface ImportRequest {
  action?: string
  token?:  string
  board?:  string
  cursor?: string
  url?:    string
  format?: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

async function signedIn(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization')
  const url = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL
  const key = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY
  if (!auth?.startsWith('Bearer ') || !url || !key) return false
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { authorization: auth, apikey: key } })
    return r.ok
  } catch {
    return false
  }
}

function miroError(status: number): string {
  if (status === 401) return 'A chave do Miro não vale (ou expirou). Gere outra e tente de novo.'
  if (status === 403) return 'Essa chave não pode ler esse board. Confira a permissão boards:read e se o app foi instalado no time do board.'
  if (status === 404) return 'Board não encontrado. Confira o link e se o app foi instalado no time desse board.'
  if (status === 429) return 'O Miro pediu pra ir mais devagar. Espere um minuto e tente de novo.'
  return `O Miro respondeu com erro ${status}.`
}

async function relay(r: Response): Promise<Response> {
  if (r.ok) return json(await r.json())
  return json({ error: miroError(r.status) }, r.status)
}

export async function POST(request: Request): Promise<Response> {
  if (!(await signedIn(request))) return json({ error: 'Entre na sua conta do Vorterium pra importar.' }, 401)

  let body: ImportRequest
  try {
    body = (await request.json()) as ImportRequest
  } catch {
    return json({ error: 'Pedido inválido.' }, 400)
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token || token.length > 1000 || /\s/.test(token)) return json({ error: 'Cole a chave de acesso do Miro.' }, 400)
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json' }

  try {
    if (body.action === 'resource') {
      const raw = typeof body.url === 'string' ? body.url : ''
      if (!raw.startsWith(`${MIRO}/boards/`)) return json({ error: 'Endereço de arquivo inválido.' }, 400)
      const url = new URL(raw)
      url.searchParams.set('redirect', 'false')
      url.searchParams.set('format', body.format === 'preview' ? 'preview' : 'original')
      const meta = await fetch(url, { headers })
      if (!meta.ok) return json({ error: miroError(meta.status) }, meta.status)
      const { url: fileUrl } = (await meta.json()) as { url?: string }
      if (!fileUrl || !fileUrl.startsWith('https://')) return json({ error: 'Arquivo indisponível no Miro.' }, 404)
      const file = await fetch(fileUrl)
      if (!file.ok) return json({ error: 'Não deu pra baixar o arquivo do Miro.' }, 502)
      const size = Number(file.headers.get('content-length') ?? 0)
      if (size > MAX_FILE_BYTES) return json({ error: 'Arquivo grande demais pra trazer de uma vez.' }, 413)
      const bytes = await file.arrayBuffer()
      if (bytes.byteLength > MAX_FILE_BYTES) return json({ error: 'Arquivo grande demais pra trazer de uma vez.' }, 413)
      return new Response(bytes, {
        headers: { 'content-type': file.headers.get('content-type') ?? 'application/octet-stream', 'cache-control': 'no-store' },
      })
    }

    const board = typeof body.board === 'string' ? body.board : ''
    if (!/^[A-Za-z0-9_=\-]{4,64}$/.test(board)) return json({ error: 'Link do board inválido.' }, 400)
    const id = encodeURIComponent(board)

    if (body.action === 'board') return relay(await fetch(`${MIRO}/boards/${id}`, { headers }))

    if (body.action === 'items' || body.action === 'connectors') {
      const q = new URLSearchParams({ limit: '50' })
      if (typeof body.cursor === 'string' && body.cursor) q.set('cursor', body.cursor)
      return relay(await fetch(`${MIRO}/boards/${id}/${body.action}?${q}`, { headers }))
    }
  } catch {
    return json({ error: 'Não deu pra falar com o Miro agora. Tente de novo.' }, 502)
  }

  return json({ error: 'Ação desconhecida.' }, 400)
}
