// ────────────────────────────────────────────────────────
// Tradução de erros do Supabase Auth para português
// ────────────────────────────────────────────────────────

const ERROR_MAP: Array<[string, string]> = [
  ['Invalid login credentials',         'E-mail ou senha inválidos.'],
  ['Email not confirmed',               'Confirme seu e-mail antes de entrar.'],
  ['User already registered',           'Este e-mail já está cadastrado.'],
  ['Password should be at least',       'A senha deve ter pelo menos 6 caracteres.'],
  ['Unable to validate email address',  'Formato de e-mail inválido.'],
  ['signup is disabled',               'O cadastro está desabilitado no momento.'],
  ['Email rate limit exceeded',         'Muitas tentativas. Aguarde alguns minutos.'],
  ['over_email_send_rate_limit',        'Muitas tentativas. Aguarde alguns minutos.'],
  ['Anonymous sign-ins are disabled',   'Autenticação não permitida.'],
  ['OAuth provider not found',          'Provedor de autenticação inválido.'],
]

export function translateAuthError(message: string): string {
  for (const [pattern, translation] of ERROR_MAP) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return translation
    }
  }
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
