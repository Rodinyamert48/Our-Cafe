/** WebAudio ile üretilen müzik ve efektler (harici ses dosyası yok). */
interface Cfg { music: number; sfx: number; mOn: boolean; sOn: boolean }
const load = (): Cfg => { try { return { music: 0.4, sfx: 0.7, mOn: true, sOn: true, ...JSON.parse(localStorage.getItem('oc_audio') || '{}') }; } catch { return { music: 0.4, sfx: 0.7, mOn: true, sOn: true }; } };
export const audioCfg: Cfg = load();
export const saveAudio = () => { try { localStorage.setItem('oc_audio', JSON.stringify(audioCfg)); } catch { /* */ } applyVol(); };
let ctx: AudioContext | null = null, mGain: GainNode, sGain: GainNode, timer = 0, step = 0, mode: 'cafe' | 'end' | 'off' = 'off';
function applyVol() { if (!ctx) return; mGain.gain.value = audioCfg.mOn ? audioCfg.music * 0.35 : 0; sGain.gain.value = audioCfg.sOn ? audioCfg.sfx : 0; }
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
  ctx = new AC(); mGain = ctx.createGain(); sGain = ctx.createGain(); mGain.connect(ctx.destination); sGain.connect(ctx.destination); applyVol();
}
function tone(f: number, t0: number, dur: number, type: OscillatorType, vol: number, dest: GainNode, slide = 0) {
  if (!ctx) return; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0: number, dur: number, vol: number, hp = 1000) {
  if (!ctx) return; const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(sGain); s.start(t0);
}
const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
export function sfx(name: string) {
  if (!ctx || !audioCfg.sOn) return; const t = ctx.currentTime;
  const seq = (notes: number[], d: number, type: OscillatorType = 'square', v = 0.15) => notes.forEach((n, i) => tone(N(n), t + i * d, d * 1.4, type, v, sGain));
  switch (name) {
    case 'click': tone(660, t, 0.06, 'square', 0.1, sGain); break;
    case 'bell': seq([84, 88], 0.09, 'sine', 0.2); break;
    case 'order': seq([79, 83, 86], 0.07, 'triangle', 0.18); break;
    case 'coin': seq([88, 95], 0.07, 'square', 0.12); break;
    case 'ding': seq([91, 96], 0.1, 'sine', 0.25); break;
    case 'serve': seq([72, 76, 79], 0.06, 'triangle', 0.2); break;
    case 'pick': tone(500, t, 0.08, 'triangle', 0.15, sGain, 300); break;
    case 'place': tone(200, t, 0.1, 'square', 0.15, sGain, -80); noise(t, 0.05, 0.2, 800); break;
    case 'buy': seq([76, 83], 0.06, 'square', 0.1); break;
    case 'water': noise(t, 0.4, 0.25, 2500); break;
    case 'angry': seq([60, 55], 0.12, 'sawtooth', 0.12); break;
    case 'level': seq([72, 76, 79, 84], 0.09, 'square', 0.14); break;
    case 'quack': tone(520, t, 0.1, 'sawtooth', 0.16, sGain, -200); tone(480, t + 0.13, 0.12, 'sawtooth', 0.16, sGain, -200); break;
    case 'st_coffee': for (let i = 0; i < 6; i++) noise(t + i * 0.12, 0.12, 0.16, 400); break;
    case 'st_prep': for (let i = 0; i < 5; i++) tone(900, t + i * 0.09, 0.04, 'square', 0.1, sGain); break;
    case 'st_stove': noise(t, 0.7, 0.18, 3000); break;
    case 'st_oven': tone(300, t, 0.15, 'sine', 0.2, sGain, 200); tone(300, t + 0.2, 0.15, 'sine', 0.2, sGain, 200); break;
    case 'dayend': mode = 'end'; step = 0; break;
  }
}
// Müzik: pentatonik, sakin bir döngü
const MEL = [69, 72, 74, 76, 74, 72, 69, 67, 69, 72, 76, 79, 76, 74, 72, 69];
const BASS = [45, 45, 52, 52, 43, 43, 50, 50];
export function music(m: 'cafe' | 'end' | 'off') {
  mode = m; if (timer) { clearInterval(timer); timer = 0; } if (!ctx || m === 'off') return; step = 0;
  timer = window.setInterval(() => {
    if (!ctx || !audioCfg.mOn || ctx.state !== 'running') return; const t = ctx.currentTime + 0.05;
    const mel = mode === 'end' ? [72, 71, 69, 67, 65, 64, 62, 60] : MEL; const i = step % mel.length;
    if (Math.random() > 0.15) tone(N(mel[i]), t, 0.5, 'triangle', 0.5, mGain);
    if (step % 2 === 0) tone(N(BASS[(step / 2) % BASS.length | 0] ?? 45), t, 0.9, 'sine', 0.6, mGain);
    step++;
  }, mode === 'end' ? 700 : 480);
}
