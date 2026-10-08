import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../shared/lib/supabase'

// ────────────────────────────────────────────────────────
// Mesa: o que está "na mesa" (imagem da galeria ou documento) e o aviso de
// "ao vivo". O Supabase Realtime (canal privado "mesa:<campanha>", só
// membros) leva o estado do mestre pros jogadores:
//
//   jogador → viewer-join {viewerId, name}   "estou aqui"
//   mestre  → state {stage}                  o que está na mesa
//
// E no canal "mesa-aviso:<campanha>" (que os jogadores escutam de todas
// as campanhas deles, em qualquer página), o mestre manda:
//   live {liveId, masterName} / ended {liveId} — e responde "status?".
//
// A transmissão de tela foi retirada: a Mesa agora é o Vortable. As artes
// e os documentos ficam guardados aqui pra entrarem no Vortable depois.
// ────────────────────────────────────────────────────────

export interface MesaImage {
  /** Id na galeria do mestre (pra marcar qual está na mesa). */
  id:   string
  url:  string
  name: string
}

/** Documento (carta ou livro) na mesa — e a página aberta, num livro. */
export interface MesaDocRef {
  id:    string
  title: string
  /** Página aberta do livro (0 = capa, n = página n — igual em qualquer tela); numa folha, sempre 0. */
  page:  number
}

/** O que está na mesa agora — o mestre define e manda pra todos. */
export interface MesaStage {
  /** Id da "sessão ao vivo"; null = nada na mesa. */
  liveId:   string | null
  image:    MesaImage | null
  /** Documento na mesa (no lugar da imagem). */
  document: MesaDocRef | null
}

export interface MesaSnapshot {
  channelError: string | null
  stage:        MesaStage
  /** Tem algo na mesa. */
  live:         boolean
}

export const EMPTY_STAGE: MesaStage = { liveId: null, image: null, document: null }

export const EMPTY_SNAPSHOT: MesaSnapshot = { channelError: null, stage: EMPTY_STAGE, live: false }

interface SessionOptions {
  campaignId: string
  userId:     string
  name:       string
  isMaster:   boolean
  onChange:   (snapshot: MesaSnapshot) => void
}

type Payload = Record<string, unknown>

function newId(): string {
  return crypto.randomUUID().slice(0, 8)
}

function isStage(value: unknown): value is MesaStage {
  return typeof value === 'object' && value !== null && 'liveId' in value
}

export class MesaSession {
  private readonly opts: SessionOptions
  private readonly myId: string
  private channel: RealtimeChannel | null = null
  private aviso:   RealtimeChannel | null = null
  private disposed = false
  private snap: MesaSnapshot = { ...EMPTY_SNAPSHOT }

  constructor(opts: SessionOptions) {
    this.opts = opts
    this.myId = `${opts.userId}:${newId()}`
  }

  get snapshot(): MesaSnapshot {
    return this.snap
  }

  private update(patch: Partial<MesaSnapshot>) {
    if (this.disposed) return
    const next = { ...this.snap, ...patch }
    next.live = Boolean(next.stage.image || next.stage.document)
    this.snap = next
    this.opts.onChange(next)
  }

  private send(event: string, payload: Payload = {}) {
    if (!this.channel) return
    void this.channel.send({ type: 'broadcast', event, payload })
  }

  // ── Ciclo de vida ──────────────────────────────────────

  async connect(): Promise<void> {
    // Canais privados: o Realtime confere a policy com o token do usuário.
    await supabase.realtime.setAuth()
    if (this.disposed) return

    const channel = supabase.channel(`mesa:${this.opts.campaignId}`, {
      config: { private: true, broadcast: { self: false } },
    })
    this.channel = channel

    if (this.opts.isMaster) {
      channel.on('broadcast', { event: 'viewer-join' }, () => this.sendState())
      this.connectAviso()
    } else {
      channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        const stage = (payload as Payload | null)?.stage
        if (isStage(stage)) this.update({ stage: { ...EMPTY_STAGE, ...stage } })
      })
    }

    channel.subscribe((status) => {
      if (this.disposed) return
      if (status === 'SUBSCRIBED') {
        this.update({ channelError: null })
        if (this.opts.isMaster) {
          // Reconectou no meio: manda o estado de novo.
          if (this.snap.live) this.sendState()
        } else {
          this.send('viewer-join', { viewerId: this.myId, name: this.opts.name })
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.update({ channelError: 'Não foi possível conectar à Mesa. Recarregue a página e tente de novo.' })
      }
    })
  }

  dispose(): void {
    if (this.disposed) return
    if (this.opts.isMaster && this.snap.live) {
      this.snap = { ...this.snap, stage: EMPTY_STAGE }
      this.sendState()
      this.sendAviso('ended', { liveId: null })
    }
    this.disposed = true
    if (this.channel) void supabase.removeChannel(this.channel)
    if (this.aviso) void supabase.removeChannel(this.aviso)
    this.channel = null
    this.aviso = null
  }

  // ── Mestre: estado e aviso ─────────────────────────────

  private setStage(patch: Partial<MesaStage>) {
    const prev = this.snap.stage
    const next: MesaStage = { ...prev, ...patch }
    const wasLive = Boolean(prev.image || prev.document)
    const isLive  = Boolean(next.image || next.document)
    if (!wasLive && isLive) next.liveId = newId()
    if (!isLive) next.liveId = null
    this.update({ stage: next })
    this.sendState()
    if (!wasLive && isLive) this.sendAviso('live', { liveId: next.liveId, masterName: this.opts.name })
    if (wasLive && !isLive) this.sendAviso('ended', { liveId: prev.liveId })
  }

  private sendState() {
    this.send('state', { stage: this.snap.stage })
  }

  private connectAviso() {
    const aviso = supabase.channel(`mesa-aviso:${this.opts.campaignId}`, {
      config: { private: true, broadcast: { self: false } },
    })
    this.aviso = aviso
    // Jogador que abriu o site agora pergunta se tem algo rolando.
    aviso.on('broadcast', { event: 'status?' }, () => {
      if (this.snap.live) this.sendAviso('live', { liveId: this.snap.stage.liveId, masterName: this.opts.name })
    })
    aviso.subscribe()
  }

  private sendAviso(event: 'live' | 'ended', payload: Payload) {
    if (!this.aviso) return
    void this.aviso.send({ type: 'broadcast', event, payload: { ...payload, campaignId: this.opts.campaignId } })
  }

  // ── Mestre: imagem ─────────────────────────────────────

  showImage(image: MesaImage): void {
    if (!this.opts.isMaster) return
    this.setStage({ image, document: null })
  }

  hideImage(): void {
    if (!this.opts.isMaster) return
    this.setStage({ image: null })
  }

  // ── Mestre: documento ──────────────────────────────────

  showDocument(doc: MesaDocRef): void {
    if (!this.opts.isMaster) return
    this.setStage({ document: doc, image: null })
  }

  hideDocument(): void {
    if (!this.opts.isMaster) return
    this.setStage({ document: null })
  }

  /** Virou a página do livro na mesa: vira pra todos. */
  setDocumentPage(page: number): void {
    const doc = this.snap.stage.document
    if (!this.opts.isMaster || !doc || doc.page === page) return
    this.setStage({ document: { ...doc, page } })
  }
}
