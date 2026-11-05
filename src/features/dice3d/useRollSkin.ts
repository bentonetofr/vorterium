import { useCallback, useEffect, useRef } from 'react'
import { getMyDiceSkin, onDiceSkinChange, peekMyDiceSkin } from './diceSkinService'
import { DEFAULT_SKIN } from './skins'

// ────────────────────────────────────────────────────────
// A skin dos dados na hora de rolar. Quem rola chama a função devolvida a cada
// rolagem: ela lê o conjunto escolhido agora (no banco), então a rolagem nunca
// sai com o padrão só porque a leitura do começo ainda não tinha voltado (as
// janelas que rolam sozinhas ao abrir) ou porque a skin foi trocada depois.
// Se a leitura falhar, vale a última que se sabia.
// ────────────────────────────────────────────────────────

export function useRollSkin(): () => Promise<string> {
  const known = useRef<string>(peekMyDiceSkin() ?? DEFAULT_SKIN)

  useEffect(() => {
    let alive = true
    void getMyDiceSkin().then((s) => { if (alive) known.current = s }).catch(() => { /* fica a última */ })
    const off = onDiceSkinChange((s) => { known.current = s })
    return () => { alive = false; off() }
  }, [])

  return useCallback(async () => {
    try {
      known.current = await getMyDiceSkin({ fresh: true })
    } catch { /* sem rede: vale a última */ }
    return known.current
  }, [])
}
