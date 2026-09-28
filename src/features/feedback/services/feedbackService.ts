import { supabase } from '../../../shared/lib/supabase'
import { APP_VERSION } from '../../../shared/constants/changelog'

// ────────────────────────────────────────────────────────
// Enviar feedback — tabela site_feedback (quem envia só cria e lê os
// próprios; quem administra lê tudo pelo painel do Supabase) e bucket
// privado feedback-images pro print opcional.
// ────────────────────────────────────────────────────────

export type FeedbackKind = 'problema' | 'sugestao' | 'outro'

export interface SiteFeedback {
  id:          string
  kind:        FeedbackKind
  message:     string
  page:        string | null
  image_path:  string | null
  status:      'novo' | 'lido' | 'resolvido'
  created_at:  string
}

export const FEEDBACK_MESSAGE_MAX = 2000
export const FEEDBACK_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const FEEDBACK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const BUCKET = 'feedback-images'
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function validateFeedbackImage(file: File): string | null {
  if (!FEEDBACK_IMAGE_TYPES.includes(file.type as (typeof FEEDBACK_IMAGE_TYPES)[number])) {
    return 'Escolha uma imagem JPG, PNG ou WebP.'
  }
  if (file.size > FEEDBACK_IMAGE_MAX_BYTES) return 'A imagem deve ter no máximo 5 MB.'
  return null
}

export interface FeedbackInput {
  kind:    FeedbackKind
  message: string
  page:    string | null
  image:   File | null
}

export async function sendFeedback(input: FeedbackInput): Promise<SiteFeedback> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado.')

  const message = input.message.trim()
  if (!message) throw new Error('Escreva o que aconteceu ou a sua ideia.')
  if (message.length > FEEDBACK_MESSAGE_MAX) throw new Error(`Máximo de ${FEEDBACK_MESSAGE_MAX} caracteres.`)

  let imagePath: string | null = null
  if (input.image) {
    const problem = validateFeedbackImage(input.image)
    if (problem) throw new Error(problem)
    imagePath = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[input.image.type] ?? 'img'}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(imagePath, input.image, { contentType: input.image.type })
    if (uploadError) {
      console.error('Erro do Storage ao enviar print do feedback:', uploadError)
      throw new Error('Não foi possível enviar a imagem.')
    }
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .insert({
      user_id:     user.id,
      kind:        input.kind,
      message,
      page:        input.page?.trim().slice(0, 300) || null,
      app_version: APP_VERSION,
      user_agent:  navigator.userAgent.slice(0, 400),
      image_path:  imagePath,
    })
    .select('id, kind, message, page, image_path, status, created_at')
    .single()

  if (error || !data) {
    if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath])
    throw new Error('Não foi possível enviar o feedback.')
  }
  return data as SiteFeedback
}

/** Os feedbacks que a própria pessoa já mandou, mais novos primeiro. */
export async function getMyFeedback(): Promise<SiteFeedback[]> {
  const { data, error } = await supabase
    .from('site_feedback')
    .select('id, kind, message, page, image_path, status, created_at')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw new Error('Não foi possível carregar seus envios.')
  return (data ?? []) as SiteFeedback[]
}
