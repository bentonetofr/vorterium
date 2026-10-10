// A zona em que esta pessoa está agora (o jogo avisa a cada zona que abre). Serve pra os sons das criaturas
// só tocarem pra quem está na zona onde o mestre os tocou.
let current: string | null = null

export function setLocalZone(id: string | null): void {
  current = id
}

export function getLocalZone(): string | null {
  return current
}
