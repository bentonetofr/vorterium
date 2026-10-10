import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { DEFAULT_SCENE, getTdaScene, subscribeToTdaScene, type TdaScene } from '../services/tdaSceneService'

/** Alerta e Atenção da cena da campanha, ao vivo (e o setter, pro mestre mexer na hora). */
export function useTdaScene(campaignId: string): [TdaScene, Dispatch<SetStateAction<TdaScene>>] {
  const [scene, setScene] = useState<TdaScene>(DEFAULT_SCENE)

  useEffect(() => {
    let alive = true
    void getTdaScene(campaignId).then((s) => { if (alive) setScene(s) })
    const off = subscribeToTdaScene(campaignId, (s) => { if (alive) setScene(s) })
    return () => { alive = false; off() }
  }, [campaignId])

  return [scene, setScene]
}
