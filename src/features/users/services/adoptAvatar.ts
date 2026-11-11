import { supabase } from '../../../shared/lib/supabase'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, uploadCurrentAvatar } from './profileService'

// ────────────────────────────────────────────────────────
// Guarda no próprio site a foto de quem entrou com o Google.
//
// Quem cria a conta pelo Google fica com a foto apontando pro servidor do
// Google (lh3.googleusercontent.com), que de vez em quando recusa o pedido
// e a foto some. Aqui a foto é copiada UMA vez pro armazenamento do site
// (o mesmo lugar de quem envia a foto pelo Perfil) e o perfil passa a
// apontar pra cópia.
//
// Só mexe quando o PERFIL aponta pro Google. Quem removeu a foto (perfil
// sem foto) ou já enviou uma própria não é tocado. Qualquer falha é
// silenciosa: a foto continua como estava e tenta de novo outro dia.
// ────────────────────────────────────────────────────────

const RETRY_AFTER_MS = 24 * 60 * 60 * 1000
const triedKey = (userId: string) => `vorterium:foto-copiada:${userId}`

export function isGooglePhoto(url: string | null | undefined): boolean {
  if (!url) return false
  try { return new URL(url).hostname.endsWith('.googleusercontent.com') } catch { return false }
}

function isOwnPhoto(url: string | null | undefined): boolean {
  return !!url && url.includes('/storage/v1/object/public/avatars/')
}

/** A mesma foto num tamanho melhor que o padrão de 96px ("…=s96-c" → "…=s256-c"). */
export function biggerGooglePhoto(url: string): string {
  return /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, '=s256-c') : url
}

function triedRecently(userId: string): boolean {
  try { return Date.now() - Number(localStorage.getItem(triedKey(userId)) || 0) < RETRY_AFTER_MS } catch { return true }
}
function markTried(userId: string) {
  try { localStorage.setItem(triedKey(userId), String(Date.now())) } catch { /* sem armazenamento */ }
}

/** Devolve true se a foto foi copiada (ou a sessão ressincronizada) agora. */
export async function adoptExternalAvatar(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase.from('profiles').select('avatar_url').eq('id', user.id).maybeSingle()
  if (!profile) return false
  const profileUrl = profile.avatar_url as string | null
  const sessionUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  // Já tem a cópia, mas um novo login pelo Google devolveu o endereço do
  // Google pra sessão: só realinha a sessão com o perfil.
  if (isOwnPhoto(profileUrl) && isGooglePhoto(sessionUrl)) {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: profileUrl } })
    return !error
  }

  if (!isGooglePhoto(profileUrl) || triedRecently(user.id)) return false
  markTried(user.id)

  const response = await fetch(biggerGooglePhoto(profileUrl!), { referrerPolicy: 'no-referrer', credentials: 'omit' })
  if (!response.ok) return false
  const blob = await response.blob()
  const type = blob.type.split(';')[0]
  if (!(AVATAR_TYPES as readonly string[]).includes(type) || blob.size === 0 || blob.size > AVATAR_MAX_BYTES) return false

  await uploadCurrentAvatar(new File([blob], 'avatar', { type }))
  return true
}
