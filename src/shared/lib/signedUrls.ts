import { supabase } from './supabase'

// ────────────────────────────────────────────────────────
// Links assinados do Storage com cache que sobrevive a recarregar a página.
//
// O navegador guarda a imagem pelo endereço COMPLETO (com o token). Link novo a
// cada chamada = imagem baixada de novo a cada vez, e é tráfego (egress) do
// Supabase. Aqui o mesmo arquivo recebe o mesmo link por até um dia, então o
// navegador reaproveita a imagem que já tem (ou só confere, sem baixar).
// ────────────────────────────────────────────────────────

/** Validade do link gerado (um dia). */
export const SIGNED_URL_SECONDS = 24 * 60 * 60
/** Só reaproveita o link se ainda faltar pelo menos isto pra vencer. */
const MIN_LEFT_MS = 60 * 60 * 1000
const STORE_KEY = 'vorterium:signed-urls:v1'
const MAX_SAVED = 600

interface Entry { url: string; until: number }

const memory = new Map<string, Entry>()
let loaded = false
let saveTimer = 0

const keyOf = (bucket: string, path: string) => `${bucket}\n${path}`

function loadStored() {
  if (loaded) return
  loaded = true
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return
    const now = Date.now()
    for (const [key, entry] of Object.entries(JSON.parse(raw) as Record<string, Entry>)) {
      if (entry && typeof entry.url === 'string' && entry.until - MIN_LEFT_MS > now) memory.set(key, entry)
    }
  } catch { /* sem storage ou JSON ruim: começa do zero */ }
}

function scheduleSave() {
  if (typeof window === 'undefined' || saveTimer) return
  saveTimer = window.setTimeout(() => {
    saveTimer = 0
    try {
      const now = Date.now()
      const alive = [...memory.entries()].filter(([, e]) => e.until - MIN_LEFT_MS > now)
      // se passar do limite, ficam os de validade mais longa (os mais novos)
      alive.sort((a, b) => b[1].until - a[1].until)
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(alive.slice(0, MAX_SAVED))))
    } catch { /* storage cheio ou bloqueado: o cache em memória continua valendo */ }
  }, 800)
}

/** Links assinados (path → link) de vários arquivos do mesmo bucket, reaproveitando os que ainda valem. */
export async function signedUrls(bucket: string, paths: string[], seconds = SIGNED_URL_SECONDS): Promise<Map<string, string>> {
  loadStored()
  const now = Date.now()
  const out = new Map<string, string>()
  const missing: string[] = []
  for (const path of new Set(paths)) {
    const hit = memory.get(keyOf(bucket, path))
    if (hit && hit.until - MIN_LEFT_MS > now) out.set(path, hit.url)
    else missing.push(path)
  }
  if (missing.length > 0) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(missing, seconds)
    for (const s of data ?? []) {
      if (!s.path || !s.signedUrl) continue
      memory.set(keyOf(bucket, s.path), { url: s.signedUrl, until: now + seconds * 1000 })
      out.set(s.path, s.signedUrl)
    }
    scheduleSave()
  }
  return out
}

/** Link assinado de um arquivo só (null se não deu pra gerar). */
export async function signedUrl(bucket: string, path: string, seconds = SIGNED_URL_SECONDS): Promise<string | null> {
  return (await signedUrls(bucket, [path], seconds)).get(path) ?? null
}

/** Esquece o link de um arquivo (apagado ou trocado). */
export function forgetSignedUrl(bucket: string, path: string) {
  loadStored()
  if (memory.delete(keyOf(bucket, path))) scheduleSave()
}

/** Só pros testes. */
export function resetSignedUrlCache() {
  memory.clear()
  loaded = false
  try { localStorage.removeItem(STORE_KEY) } catch { /* sem storage */ }
}
