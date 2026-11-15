import { useEffect, useRef } from 'react'
import { confirmDialog } from '../../../shared/components/dialogs'
import { endPromptCopy, setCampaignSession, useLiveSession } from '../services/liveSession'

// ────────────────────────────────────────────────────────
// A pergunta ao mestre antes de a sessão fechar: "a sessão acabou?". O banco manda ask_end quando os jogadores foram saindo (a mesa deixou de
// estar reunida) ou quando chegou o horário de término da sessão marcada. "Sim" encerra; "Não" segue aberta por mais 30 minutos e a pergunta
// só volta depois disso. Fechar a janela sem escolher conta como "não" (o mais seguro: a sessão continua). Só o mestre vê.
// ────────────────────────────────────────────────────────

export function SessionEndPrompt({ campaignId }: { campaignId: string }) {
  const s = useLiveSession(campaignId)
  const asking = useRef(false)

  useEffect(() => {
    if (!s.askEnd || asking.current) return
    asking.current = true
    const copy = endPromptCopy(s.askEnd)
    void confirmDialog({ title: copy.title, message: copy.message, confirmLabel: copy.yes, cancelLabel: copy.no })
      .then((acabou) => setCampaignSession(campaignId, acabou ? 'close' : 'continue'))
      .catch(() => { /* sem resposta do banco: a pergunta volta no próximo estado */ })
      .finally(() => { asking.current = false })
  }, [s.askEnd, campaignId])

  return null
}
