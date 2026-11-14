/** Manuel WebRTC sinyalleşme: sunucu yok, kodlar elle taşınır. STUN yalnızca ağ keşfi içindir. */
import { Msg } from './types';

export type PeerState = 'idle' | 'creating' | 'code-ready' | 'waiting' | 'connecting' | 'connected' | 'disconnected';

const b64 = (u: Uint8Array) => { let s = ''; u.forEach(b => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s: string) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const t = atob(s); return Uint8Array.from(t, c => c.charCodeAt(0)); };

export async function pack(o: unknown): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(o));
  if (typeof CompressionStream !== 'undefined') {
    const out = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    return 'OC1.' + b64(out);
  }
  return 'OC0.' + b64(raw);
}
export async function unpack(code: string): Promise<any> {
  code = code.replace(/\s+/g, ''); const [h, body] = [code.slice(0, 4), code.slice(4)];
  if (h === 'OC0.') return JSON.parse(new TextDecoder().decode(unb64(body)));
  if (h !== 'OC1.') throw new Error('Geçersiz kod');
  const out = await new Response(new Blob([unb64(body)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  return JSON.parse(new TextDecoder().decode(out));
}

export function getStun(): string { try { return localStorage.getItem('oc_stun') ?? 'stun:stun.l.google.com:19302'; } catch { return 'stun:stun.l.google.com:19302'; } }

export class Peer {
  pc: RTCPeerConnection; dc?: RTCDataChannel; state: PeerState = 'idle';
  onMsg: (m: Msg) => void = () => {}; onState: (s: PeerState) => void = () => {};
  private bytes = 0;
  constructor(stun = getStun()) {
    const servers = stun.trim() ? stun.split(',').map(u => ({ urls: u.trim() })) : [];
    this.pc = new RTCPeerConnection({ iceServers: servers });
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if (s === 'connecting') this.set('connecting');
      else if (s === 'failed' || s === 'closed' || s === 'disconnected') { if (this.state !== 'idle') this.set('disconnected'); }
    };
  }
  private set(s: PeerState) { if (this.state === s) return; this.state = s; this.onState(s); }
  private wire(dc: RTCDataChannel) {
    this.dc = dc;
    dc.onopen = () => this.set('connected');
    dc.onclose = () => this.set('disconnected');
    dc.onmessage = e => { try { this.onMsg(JSON.parse(e.data)); } catch { /* bozuk paket yok sayılır */ } };
  }
  private gathered(): Promise<void> {
    return new Promise(res => {
      if (this.pc.iceGatheringState === 'complete') return res();
      const t = setTimeout(res, 6000);
      this.pc.addEventListener('icegatheringstatechange', () => { if (this.pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
    });
  }
  /** HOST: davet kodu üretir */
  async createOffer(): Promise<string> {
    this.set('creating');
    this.wire(this.pc.createDataChannel('cafe', { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gathered();
    const code = await pack(this.pc.localDescription!.toJSON());
    this.set('code-ready'); return code;
  }
  /** HOST: misafirin cevap kodunu uygular */
  async acceptAnswer(code: string) {
    const d = await unpack(code); this.set('waiting');
    await this.pc.setRemoteDescription(d);
  }
  /** GUEST: davet kodundan cevap kodu üretir */
  async join(code: string): Promise<string> {
    const d = await unpack(code); this.set('creating');
    this.pc.ondatachannel = e => this.wire(e.channel);
    await this.pc.setRemoteDescription(d);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gathered();
    const out = await pack(this.pc.localDescription!.toJSON());
    this.set('waiting'); return out;
  }
  send(m: Msg) { if (this.dc?.readyState === 'open') { const s = JSON.stringify(m); this.bytes += s.length; this.dc.send(s); } }
  get open() { return this.dc?.readyState === 'open'; }
  close() { this.state = 'idle'; try { this.dc?.close(); this.pc.close(); } catch { /* */ } }
}
