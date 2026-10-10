import { useEffect, useRef } from 'react'

/**
 * Deixa soltar no mapa (a área do Vortable) o que foi arrastado dos painéis do mestre. `type` é o tipo do dado
 * do arrasto; `onDrop` recebe o dado e o ponto da tela (coordenadas de página). Mostra a moldura "Solte aqui".
 */
export function useMapDrop(viewEl: HTMLElement | null, type: string, onDrop: (data: string, pageX: number, pageY: number) => void): void {
  const handler = useRef(onDrop)
  handler.current = onDrop
  useEffect(() => {
    if (!viewEl) return
    const mine = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes(type)
    const over = (e: DragEvent) => {
      if (!mine(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      viewEl.classList.add('live__view--drop')
    }
    const leave = (e: DragEvent) => {
      if (e.relatedTarget && viewEl.contains(e.relatedTarget as Node)) return
      viewEl.classList.remove('live__view--drop')
    }
    const drop = (e: DragEvent) => {
      viewEl.classList.remove('live__view--drop')
      if (!mine(e)) return
      e.preventDefault()
      const data = e.dataTransfer?.getData(type)
      if (data) handler.current(data, e.pageX, e.pageY)
    }
    const end = () => viewEl.classList.remove('live__view--drop')
    viewEl.addEventListener('dragover', over); viewEl.addEventListener('dragenter', over); viewEl.addEventListener('dragleave', leave)
    viewEl.addEventListener('drop', drop); window.addEventListener('dragend', end)
    return () => {
      viewEl.removeEventListener('dragover', over); viewEl.removeEventListener('dragenter', over); viewEl.removeEventListener('dragleave', leave)
      viewEl.removeEventListener('drop', drop); window.removeEventListener('dragend', end)
      viewEl.classList.remove('live__view--drop')
    }
  }, [viewEl, type])
}

/** Converte um ponto da tela num ponto do mapa (precisa da remenda `worldAt` do motor); null = não deu. */
export function mapPoint(watch: unknown, pageX: number, pageY: number): { x: number; y: number } | null {
  const w = watch as { worldAt?: (x: number, y: number) => { x: number; y: number } | null } | null
  return w?.worldAt ? w.worldAt(pageX, pageY) : null
}
