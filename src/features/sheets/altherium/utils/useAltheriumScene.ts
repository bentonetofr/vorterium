import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { DEFAULT_SCENE, getAltheriumScene, subscribeToAltheriumScene, type AltheriumScene } from '../services/altheriumSceneService'

/** A cena da campanha, ao vivo (e o setter, pra quem mexe ver a mudança na hora). */
export function useAltheriumScene(campaignId: string): [AltheriumScene, Dispatch<SetStateAction<AltheriumScene>>] {
  const [scene, setScene] = useState<AltheriumScene>(DEFAULT_SCENE)
  useEffect(() => {
    let alive = true
    void getAltheriumScene(campaignId).then((s) => { if (alive) setScene(s) })
    const off = subscribeToAltheriumScene(campaignId, (s) => { if (alive) setScene(s) })
    return () => { alive = false; off() }
  }, [campaignId])
  return [scene, setScene]
}
