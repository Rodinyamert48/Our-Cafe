import { Peer, PeerState } from './net';
import { Sim, Sim as S, newWorld } from './sim';
import { Act, Evt, Look, Msg, World } from './types';
import { saveSlot } from './save';

export interface PosRec { x: number; y: number; d: number; m: number }
export type Conn = 'solo' | 'waiting' | 'connecting' | 'connected' | 'lost';

/** Tek oyun oturumu: HOST (otoriter simülasyon) veya GUEST (yalnızca eylem gönderir, snapshot alır). */
export class Session {
  role: 'host' | 'guest'; me = 0; sim?: Sim; world!: World; peer?: Peer; pos: Record<number, PosRec> = {};
  conn: Conn = 'solo'; lastRx = 0; autoPaused = false; solo = true;
  onEvt: (e: Evt) => void = () => {}; onConn: (c: Conn) => void = () => {}; onSaved: () => void = () => {};
  private acc = 0; private snapT = 0; private posT = 0; private saveT = 0; private pingT = 0; private verSent = -1; private lastSnap = '';
  private hello?: { name: string; look: Look }; private slot = 'auto'; private lastPos = '';

  constructor(role: 'host' | 'guest') { this.role = role; }

  startHost(world: World | undefined, name: string, look: Look, solo: boolean) {
    this.solo = solo; const w = world ? S.sanitize(world) : newWorld(); this.sim = new Sim(w); this.world = w;
    const p = w.players.find(p => p.id === 0)!; p.name = name; p.look = look; p.on = true;
    this.sim.emit = e => this.localEvt(e);
    this.pos[0] = { x: 7.5 * 16, y: 3.5 * 16, d: 0, m: 0 };
    if (!solo) { w.paused = true; this.autoPaused = true; this.setConn('waiting'); }
  }
  startGuest(name: string, look: Look) { this.hello = { name, look }; this.setConn('connecting'); }
  private setConn(c: Conn) { if (this.conn !== c) { this.conn = c; this.onConn(c); } }

  /** Bir Peer'i oturuma bağlar (ilk bağlantı veya yeniden bağlanma). */
  attach(peer: Peer) {
    this.peer?.close(); this.peer = peer;
    peer.onMsg = m => { this.lastRx = performance.now(); this.onMsg(m); };
    peer.onState = (s: PeerState) => {
      if (this.peer !== peer) return;
      if (s === 'connected') { this.lastRx = performance.now(); if (this.role === 'guest') { peer.send({ t: 'hello', ...this.hello! }); } else this.setConn('connecting'); }
      else if (s === 'connecting') this.setConn('connecting');
      else if (s === 'disconnected') this.lost();
    };
  }
  private lost() {
    this.setConn('lost');
    if (this.role === 'host') { const p = this.world.players.find(p => p.id === 1); if (p) p.on = false; this.verSent = -1; }
  }
  disconnect() { this.peer?.close(); this.peer = undefined; }

  private localEvt(e: Evt) {
    if (e.e === 'sfx' && e.n === 'autosave') { void this.save('auto'); return; }
    if (e.e === 'toast') { if (e.to === 0) this.onEvt(e); else this.peer?.send({ t: 'ev', ev: e }); return; }
    this.onEvt(e); this.peer?.send({ t: 'ev', ev: e });
  }
  async save(slot = this.slot) { if (this.role !== 'host') return; try { await saveSlot(slot, this.world); this.onSaved(); } catch { /* depolama kapalı olabilir */ } }

  act(a: Act) {
    if (this.role === 'host') { this.sim!.handle(0, a); } else this.peer?.send({ t: 'a', a });
  }
  sendPos(p: PosRec) {
    this.pos[this.me] = p; const s = `${p.x | 0},${p.y | 0},${p.d},${p.m}`;
    if (this.peer?.open && s !== this.lastPos) { this.lastPos = s; this.peer.send({ t: 'pp', id: this.me, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, d: p.d, m: p.m }); }
  }

  private onMsg(m: Msg) {
    if (this.role === 'host') {
      const w = this.world;
      if (m.t === 'hello') {
        let p = w.players.find(p => p.id === 1);
        if (!p) { p = { id: 1, name: m.name.slice(0, 14), look: m.look, hand: null, on: true }; w.players.push(p); }
        p.name = m.name.slice(0, 14) || 'Misafir'; p.look = m.look; p.on = true; p.hand = null;
        this.pos[1] = this.pos[1] ?? { x: 9.5 * 16, y: 3.5 * 16, d: 0, m: 0 };
        this.setConn('connected'); if (this.autoPaused) { w.paused = false; this.autoPaused = false; }
        this.verSent = -1; this.lastSnap = ''; this.sendSnap(true, 1);
      } else if (m.t === 'a') this.sim!.handle(1, m.a);
      else if (m.t === 'pp') this.pos[1] = { x: m.x, y: m.y, d: m.d, m: m.m };
    } else {
      if (m.t === 'snap') {
        if (m.me !== undefined) this.me = m.me;
        if (!this.world) this.world = m.w as World; else Object.assign(this.world, m.w);
        if (this.conn !== 'connected') this.setConn('connected');
      } else if (m.t === 'ev') this.onEvt(m.ev);
      else if (m.t === 'pp') this.pos[m.id] = { x: m.x, y: m.y, d: m.d, m: m.m };
    }
  }
  private sendSnap(full: boolean, me?: number) {
    const w = this.world; if (!this.peer?.open) return;
    const o: any = { meta: w.meta, inv: w.inv, stn: w.stn, cust: w.cust.map(c => ({ ...c, path: undefined, x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 })), players: w.players, duck: w.duck, dirty: w.dirty, stats: w.stats, report: w.report, paused: w.paused };
    const key = JSON.stringify(o);
    if (!full && key === this.lastSnap && w.meta.ver === this.verSent) return;
    this.lastSnap = key; if (full || w.meta.ver !== this.verSent) { o.furn = w.furn; this.verSent = w.meta.ver; }
    this.peer.send({ t: 'snap', w: o, me });
  }

  update(dt: number) {
    const now = performance.now();
    if (this.peer && this.conn === 'connected' && now - this.lastRx > 9000) { this.peer.close(); this.lost(); }
    if (this.peer?.open && (this.pingT -= dt) <= 0) { this.pingT = 2; this.peer.send({ t: 'ping', n: now | 0 }); }
    if (this.role !== 'host') return;
    this.acc += Math.min(dt, 0.25); while (this.acc >= 0.05) { this.sim!.tick(0.05); this.acc -= 0.05; }
    if (this.conn === 'connected' && (this.snapT -= dt) <= 0) { this.snapT = 0.1; this.sendSnap(false); }
    if ((this.saveT += dt) > 45) { this.saveT = 0; void this.save('auto'); }
  }
}
