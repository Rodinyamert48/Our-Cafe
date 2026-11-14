import Phaser from 'phaser';
import { app } from './app';
import { buildTextures, ensureChar, ensureDuck, fdesc, lookKey } from './art';
import { CAT, DAY_END, DAY_START, REC, T, cols, ROWS, DOOR_X, STATION_NAMES } from './data';
import { blockedGrid, dims, fh, fw, validatePlace } from './layout';
import { Evt, Furn } from './types';

interface PSpr { s: Phaser.GameObjects.Sprite; name: Phaser.GameObjects.Text; hand: Phaser.GameObjects.Image; key: string; t: number }
const INTERACTIVE = new Set(['fridge', 'shelf', 'stove', 'oven', 'coffee', 'prep', 'sink', 'register']);

export class CafeScene extends Phaser.Scene {
  private lay: Phaser.GameObjects.GameObject[] = []; private fsp = new Map<number, { img: Phaser.GameObjects.Image; f: Furn }>();
  private psp = new Map<number, PSpr>(); private csp = new Map<number, { s: Phaser.GameObjects.Sprite; b: Phaser.GameObjects.Image; t: number }>();
  private duck!: Phaser.GameObjects.Sprite; private duckKey = ''; private dname?: Phaser.GameObjects.Text; private gfx!: Phaser.GameObjects.Graphics; private dark!: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = []; private ghost!: Phaser.GameObjects.Image; private bubbles = new Map<number, Phaser.GameObjects.Image>();
  private ver = -1; private rooms = 0; private grid: boolean[][] = []; private actT = 0; private tAnim = 0; private target: { kind: 'f' | 'duck'; f?: Furn } | null = null;
  private lastPrompt: string | null = null; private posT = 0; private hearts: Phaser.GameObjects.Image[] = []; private px = 0; private py = 0; private dir = 0; private zoom = 3;
  constructor() { super('cafe'); }

  create() {
    app.scene = this; buildTextures(this); this.cameras.main.setBackgroundColor('#1c1420'); this.cameras.main.roundPixels = true;
    this.gfx = this.add.graphics().setDepth(9500); this.dark = this.add.rectangle(0, 0, 10, 10, 0x0c0c2a, 0).setOrigin(0).setDepth(9000);
    this.ghost = this.add.image(0, 0, 'glow').setOrigin(0, 1).setDepth(9400).setVisible(false).setAlpha(0.7);
    const s = app.session!; const p = s.pos[s.me] ?? (s.pos[s.me] = { x: (s.me ? 9.5 : 7.5) * T, y: 3.5 * T, d: 0, m: 0 }); this.px = p.x; this.py = p.y;
    this.scale.on('resize', () => this.fit()); this.fit();
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onPtr(ptr));
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => { const d = app.ui?.deco; if (d && (d.key || d.id !== undefined) && !ptr.wasTouch) { const p = this.cameras.main.getWorldPoint(ptr.x, ptr.y); d.x = Math.floor(p.x / T); d.y = Math.floor(p.y / T); } });
    s.onEvt = e => this.onEvt(e);
    this.events.once('shutdown', () => { app.scene = null; this.dname = undefined; (this as any).duck = undefined; this.fsp.clear(); this.psp.clear(); this.csp.clear(); this.bubbles.clear(); this.glows = []; });
  }
  private fit() {
    const w = this.scale.width, h = this.scale.height; this.zoom = Math.max(2, Math.min(5, Math.floor(Math.min(w / 300, h / 200)))); this.cameras.main.setZoom(this.zoom);
  }
  private onEvt(e: Evt) {
    if (e.e === 'fx') {
      if (e.n === 'coin') this.pop(e.x, e.y, `+₺${e.v}`, '#ffd84a');
      else if (e.n === 'heart') { const h = this.add.image(e.x, e.y, 'heart').setDepth(9600); this.tweens.add({ targets: h, y: e.y - 14, alpha: 0, duration: 1000, onComplete: () => h.destroy() }); }
      else app.ui?.levelUp(e.v ?? 0);
    }
  }
  private pop(x: number, y: number, t: string, col: string) {
    const tx = this.add.text(x, y, t, { fontFamily: 'monospace', fontSize: '8px', color: col, stroke: '#2e1f26', strokeThickness: 2, fontStyle: 'bold' }).setOrigin(0.5).setDepth(9600).setResolution(this.zoom);
    this.tweens.add({ targets: tx, y: y - 16, alpha: 0, duration: 1100, onComplete: () => tx.destroy() });
  }

  // ---- harita ----
  private rebuild() {
    const w = app.session!.world, m = w.meta, { W, H } = dims(w);
    this.lay.forEach(o => o.destroy()); this.lay = []; this.fsp.forEach(v => v.img.destroy()); this.fsp.clear(); this.glows.forEach(g => g.destroy()); this.glows = [];
    const add = (k: string, x: number, y: number) => { const i = this.add.image(x * T, y * T, k).setOrigin(0).setDepth(-1000); this.lay.push(i); return i; };
    for (let y = 2; y < H - 1; y++) for (let x = 1; x < W - 1; x++) add(`fl_${m.floor}_${(x + y) % 2}`, x, y);
    for (let x = 0; x < W; x++) { add(`wl_${m.wall}_0`, x, 0); add(`wl_${m.wall}_1`, x, 1); }
    for (let y = 2; y < H; y++) { add(`wl_${m.wall}_1`, 0, y); add(`wl_${m.wall}_1`, W - 1, y); }
    for (let x = 1; x < W - 1; x++) if (x !== DOOR_X && x !== DOOR_X + 1) add(`wl_${m.wall}_1`, x, H - 1);
    add('door_0', DOOR_X, H - 1); add('door_1', DOOR_X + 1, H - 1);
    for (const f of w.furn) {
      const d = CAT[f.k]; const flip = f.r === 1 && d.w === d.h; const img = this.add.image(f.x * T, (f.y + fh(f)) * T, `f_${f.k}_${d.w !== d.h ? f.r : 0}_0`).setOrigin(0, 1).setFlipX(flip);
      const rug = !d.blocks && !d.wall; img.setDepth(d.wall ? -900 : rug ? -500 : (f.y + fh(f)) * T);
      this.fsp.set(f.id, { img, f });
      if (f.k === 'lamp' || f.k === 'window') { const g = this.add.image(f.x * T + 8, (f.y + (f.k === 'lamp' ? -0.2 : 1)) * T + (f.k === 'lamp' ? 0 : 4), 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(9100).setAlpha(0).setScale(f.k === 'lamp' ? 1.6 : 1.1); (g as any).lamp = f.k === 'lamp'; this.glows.push(g); }
    }
    w.furn.filter(f => CAT[f.k].seats).forEach((f, i) => { const t = this.add.text((f.x + fw(f) / 2) * T, (f.y + fh(f) / 2) * T + 1, String(i + 1), { fontFamily: 'monospace', fontSize: '7px', color: '#3b2a2a', fontStyle: 'bold' }).setOrigin(0.5).setDepth((f.y + fh(f)) * T + 0.5).setResolution(this.zoom * 2); this.lay.push(t); });
    this.dark.setSize(W * T, H * T);
    this.ver = m.ver; this.rooms = m.rooms; this.grid = blockedGrid(w);
  }

  // ---- giriş ----
  private onPtr(ptr: Phaser.Input.Pointer) {
    const d = app.ui?.deco; if (!d) return; const p = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T); const w = app.session!.world;
    if (d.key || d.id !== undefined) {
      if (d.x === tx && d.y === ty) { (window as any).__decoConfirm?.(); return; }
      d.x = tx; d.y = ty;
    } else {
      const f = w.furn.find(f => !CAT[f.k].wall ? tx >= f.x && tx < f.x + fw(f) && ty >= f.y && ty < f.y + fh(f) && CAT[f.k].blocks !== false : tx >= f.x && tx < f.x + fw(f) && ty === 1 && f.y === 1);
      const rug = !f ? w.furn.find(f => !CAT[f.k].blocks && !CAT[f.k].wall && tx >= f.x && tx < f.x + fw(f) && ty >= f.y && ty < f.y + fh(f)) : undefined;
      d.sel = (f ?? rug)?.id; (window as any).__decoSel?.();
    }
  }
  interact() {
    const s = app.session!, w = s.world, ui = app.ui!, t = this.target; if (!t || ui.blocked()) return;
    const me = w.players.find(p => p.id === s.me); if (!me) return; this.actT = 0.5;
    if (t.kind === 'duck') { s.act({ a: 'pet' }); return; }
    const f = t.f!, d = CAT[f.k], hand = me.hand;
    if (d.seats) {
      if (hand?.k === 'dish') s.act({ a: 'serve', f: f.id }); else if ((w.dirty[f.id] || 0) > 0 && !hand) s.act({ a: 'clean', f: f.id });
      else if (hand) ui.toast('Bu masada servis edilecek bir şey yok'); else ui.toast('Bu masayı bekleyen müşteri sipariş verecek');
      return;
    }
    switch (d.st) {
      case 'fridge': case 'shelf': ui.openManage('market'); return;
      case 'register': ui.toast(`Kasa: bugün ₺${w.stats.income + w.stats.tips} kazanç, ${w.stats.served} müşteri`); return;
      case 'sink': if (hand?.k === 'plate') s.act({ a: 'wash', f: f.id }); else ui.toast('Kirli tabakları masalardan toplayıp buraya getir'); return;
    }
    const st = w.stn[f.id];
    if (st) { if (st.ready && !hand) s.act({ a: 'take', f: f.id }); else if (st.ready) ui.toast('Elin dolu'); else ui.toast('Hazırlanıyor...'); return; }
    if (hand?.k === 'dish') { const step = REC[hand.r].steps[hand.s]; if (step && step.st === d.st) s.act({ a: 'put', f: f.id }); else ui.toast('Bu yemek burada işlenmez'); return; }
    if (hand) { ui.toast('Elin dolu'); return; }
    ui.openPicker(f.id);
  }
  private findTarget(w: import('./types').World, dir: number) {
    const fx = this.px + (dir === 2 ? -6 : dir === 3 ? 6 : 0), fy = this.py - 2 + (dir === 0 ? 6 : dir === 1 ? -6 : 0);
    let best: typeof this.target = null, bd = 9;
    for (const f of w.furn) {
      const d = CAT[f.k]; if (!(INTERACTIVE.has(f.k) || d.seats)) continue;
      const x0 = f.x * T, y0 = f.y * T, x1 = x0 + fw(f) * T, y1 = y0 + fh(f) * T; const dx = Math.max(x0 - fx, 0, fx - x1), dy = Math.max(y0 - fy, 0, fy - y1); const dist = Math.hypot(dx, dy);
      if (dist < bd) { bd = dist; best = { kind: 'f', f }; }
    }
    const du = w.duck; if (Math.hypot(du.x - this.px, du.y - this.py) < 16) return { kind: 'duck' as const };
    return best;
  }

  update(_t: number, delta: number) {
    const s = app.session; if (!s || !s.world) return; const dt = Math.min(delta / 1000, 0.1); const w = s.world, ui = app.ui!; s.update(dt);
    if (this.ver !== w.meta.ver || this.rooms !== w.meta.rooms) this.rebuild();
    this.tAnim += dt; this.actT = Math.max(0, this.actT - dt);
    // yerel hareket
    let { x: vx, y: vy } = ui.blocked() ? { x: 0, y: 0 } : ui.move(); const l = Math.hypot(vx, vy); if (l > 1) { vx /= l; vy /= l; }
    const moving = l > 0.1; if (moving) { this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 2 : 3) : (vy < 0 ? 1 : 0); }
    const sp = 64 * dt, nx = this.px + vx * sp, ny = this.py + vy * sp;
    if (this.free(nx, this.py)) this.px = nx; if (this.free(this.px, ny)) this.py = ny;
    s.pos[s.me] = { x: this.px, y: this.py, d: this.dir, m: this.actT > 0 ? 2 : moving ? 1 : 0 };
    if ((this.posT -= dt) <= 0) { this.posT = 1 / 15; s.sendPos(s.pos[s.me]); }
    this.syncPlayers(w, dt); this.syncCustomers(w, dt); this.syncStations(w); this.syncDuck(w, dt);
    // hedef ve ipucu
    this.gfx.clear(); this.target = ui.deco ? null : this.findTarget(w, this.dir);
    let label: string | null = null;
    if (this.target?.kind === 'duck') label = 'Mertoş\'u sev'; else if (this.target?.f) { const d = CAT[this.target.f.k]; label = d.seats ? 'Masa' : (d.name); }
    if (label !== this.lastPrompt) { this.lastPrompt = label; ui.setPrompt(label); }
    if (this.target?.f) { const f = this.target.f; this.gfx.lineStyle(1, 0xffe27a, 1).strokeRect(f.x * T - 0.5, f.y * T - 0.5, fw(f) * T + 1, fh(f) * T + 1); }
    this.cameras.main.scrollX += 0; const cam = this.cameras.main; cam.startFollow; // takip aşağıda
    cam.centerOn(Math.round(this.px), Math.round(this.py - 8)); this.clampCam(w);
    this.drawDeco(w); this.lighting(w);
  }
  private clampCam(w: import('./types').World) {
    const cam = this.cameras.main, { W, H } = dims(w); const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom;
    const cx = vw >= W * T ? W * T / 2 : Phaser.Math.Clamp(cam.midPoint.x, vw / 2, W * T - vw / 2);
    const cy = vh >= H * T ? H * T / 2 : Phaser.Math.Clamp(cam.midPoint.y, vh / 2, H * T - vh / 2); cam.centerOn(Math.round(cx), Math.round(cy));
  }
  private free(x: number, y: number) {
    const g = this.grid; const pts = [[x - 3.5, y], [x + 3.5, y], [x - 3.5, y - 3], [x + 3.5, y - 3]];
    for (const [a, b] of pts) { const tx = Math.floor(a / T), ty = Math.floor(b / T); if (!g[ty] || g[ty][tx] !== false) return false; }
    return true;
  }

  // ---- senkron çizim ----
  private syncPlayers(w: import('./types').World, dt: number) {
    const s = app.session!;
    for (const p of w.players) {
      const pos = s.pos[p.id]; if (!pos) continue; let sp = this.psp.get(p.id); const key = ensureChar(this, p.look);
      if (!sp) { sp = { s: this.add.sprite(pos.x, pos.y, key, '0_0').setOrigin(0.5, 1), name: this.add.text(0, 0, p.name, { fontFamily: 'monospace', fontSize: '7px', color: '#fff', stroke: '#2e1f26', strokeThickness: 2 }).setOrigin(0.5, 1).setResolution(this.zoom * 2), hand: this.add.image(0, 0, 'i_plate').setVisible(false), key, t: 0 }; this.psp.set(p.id, sp); }
      if (sp.key !== key) { sp.key = key; sp.s.setTexture(key); }
      const local = p.id === s.me; if (local) { sp.s.x = pos.x; sp.s.y = pos.y; } else { sp.s.x += (pos.x - sp.s.x) * Math.min(1, dt * 14); sp.s.y += (pos.y - sp.s.y) * Math.min(1, dt * 14); }
      sp.t += dt; const row = pos.d === 1 ? 1 : pos.d >= 2 ? 2 : 0; const walk = pos.m === 1, act = pos.m === 2; const carry = p.hand ? 3 : 0; const alt = Math.floor(sp.t / 0.16) % 2;
      const fr = act ? 6 + alt : walk ? (carry ? 4 : 1) + alt : carry;
      sp.s.setFrame(`${row}_${fr}`).setFlipX(pos.d === 3).setDepth(sp.s.y).setVisible(p.on || local); sp.name.setText(p.name).setPosition(sp.s.x, sp.s.y - 25).setDepth(9300).setVisible(p.on || local);
      if (p.hand) { sp.hand.setTexture(p.hand.k === 'plate' ? 'i_plate' : 'i_' + p.hand.r).setPosition(sp.s.x, sp.s.y - 28 - (carry ? 3 : 0)).setDepth(9200).setVisible(true); } else sp.hand.setVisible(false);
      if (p.hand?.k === 'dish') { const r = REC[p.hand.r]; sp.hand.setAlpha(p.hand.s >= r.steps.length ? 1 : 0.65); } else sp.hand.setAlpha(1);
      sp.name.y = sp.s.y - 26 - (p.hand ? 12 : 0);
    }
  }
  private syncCustomers(w: import('./types').World, dt: number) {
    const seen = new Set<number>();
    for (const c of w.cust) {
      seen.add(c.id); let o = this.csp.get(c.id); const key = ensureChar(this, c.look);
      if (!o) { o = { s: this.add.sprite(c.x, c.y, key, '0_0').setOrigin(0.5, 1), b: this.add.image(c.x, c.y, 'i_' + c.r).setVisible(false).setDepth(9250), t: Math.random() * 3 }; this.csp.set(c.id, o); }
      const seated = c.st === 'sit' || c.st === 'wait' || c.st === 'eat'; const ty = c.y + (seated ? 5 : 8), tx = c.x;
      const mv = Math.hypot(tx - o.s.x, ty - o.s.y); const k = Math.min(1, dt * 14); o.s.x += (tx - o.s.x) * k; o.s.y += (ty - o.s.y) * k; o.t += dt;
      const row = c.d === 1 ? 1 : c.d >= 2 ? 2 : 0; const alt = Math.floor(o.t / 0.18) % 2;
      const fr = c.st === 'eat' ? 6 + alt : mv > 0.4 && !seated ? 1 + alt : 0;
      o.s.setFrame(`${row}_${fr}`).setFlipX(c.d === 3);
      const tf = seated ? w.furn.find(f => f.id === c.tbl) : null; o.s.setDepth(tf ? (tf.y + fh(tf)) * T + 1 : o.s.y);
      // sipariş balonu ve sabır çubuğu
      if (c.st === 'wait') { o.b.setVisible(true).setPosition(o.s.x, o.s.y - 30).setDepth(9250); const f = c.pat / c.patMax; const col = f > 0.5 ? 0x6cc36b : f > 0.25 ? 0xf2b84b : 0xe85d5d; this.gfx.fillStyle(0x2e1f26, 1).fillRect(o.s.x - 7, o.s.y - 21, 14, 3).fillStyle(col, 1).fillRect(o.s.x - 6, o.s.y - 20, Math.max(0, 12 * f), 1); }
      else if (c.st === 'sit') { o.b.setVisible(false); } else o.b.setVisible(false);
      if (c.st === 'out' && c.mood === 0) { o.s.setTint(0xffb0a0); }
    }
    for (const [id, o] of this.csp) if (!seen.has(id)) { o.s.destroy(); o.b.destroy(); this.csp.delete(id); }
    // kirli masa göstergesi
    for (const f of w.furn) if ((w.dirty[f.id] || 0) > 0) this.gfx.fillStyle(0xf6f1e7, 1).fillRect(f.x * T + (f.r ? 4 : 20), f.y * T + (f.r ? 20 : 5), 8, 3).lineStyle(1, 0x2e1f26).strokeRect(f.x * T + (f.r ? 4 : 20), f.y * T + (f.r ? 20 : 5), 8, 3);
  }
  private syncStations(w: import('./types').World) {
    for (const [id, o] of this.fsp) {
      const f = o.f, d = CAT[f.k], fd = fdesc(f.k); const fr = fd.frames ?? 1; if (fr < 2) continue; const st = w.stn[id];
      const active = d.st === 'sink' ? false : !!st && !st.ready; const frame = active ? Math.floor(this.tAnim / 0.22) % 2 : (d.st === 'oven' && st?.ready ? 0 : 0);
      o.img.setTexture(`f_${f.k}_0_${active ? (frame ? 1 : 0) : 0}`);
      if (d.st === 'stove' || d.st === 'oven' || d.st === 'coffee') o.img.setTexture(`f_${f.k}_0_${active ? 1 : 0}`);
      if (st) {
        const x = f.x * T, y = f.y * T; if (!st.ready) { const p = 1 - st.left / st.total; this.gfx.fillStyle(0x2e1f26, 1).fillRect(x + 1, y - 12, 14, 4).fillStyle(0xffd84a, 1).fillRect(x + 2, y - 11, 12 * p, 2); this.dishIcon(id, st.r, x + 8, y - 17, 0.6); }
        else this.dishIcon(id, st.r, x + 8, y - 14 + Math.sin(this.tAnim * 6) * 1.5, 1);
      } else this.dishIcon(id, null, 0, 0, 0);
    }
  }
  private dishIcon(id: number, r: string | null, x: number, y: number, a: number) {
    let b = this.bubbles.get(id);
    if (!r) { b?.setVisible(false); return; }
    if (!b) { b = this.add.image(0, 0, 'i_' + r).setDepth(9250); this.bubbles.set(id, b); }
    b.setTexture('i_' + r).setPosition(x, y).setAlpha(a).setVisible(true);
  }
  private syncDuck(w: import('./types').World, dt: number) {
    const d = w.duck, key = ensureDuck(this, d); if (!this.duck) { this.duck = this.add.sprite(d.x, d.y, key, '0').setOrigin(0.5, 1); }
    if (this.duckKey !== key) { this.duckKey = key; this.duck.setTexture(key); }
    this.dname ??= this.add.text(0, 0, 'Mertoş', { fontFamily: 'monospace', fontSize: '6px', color: '#fff', stroke: '#2e1f26', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(9300).setResolution(this.zoom * 2);
    const mv = Math.hypot(d.x - this.duck.x, d.y - this.duck.y); this.duck.x += (d.x - this.duck.x) * Math.min(1, dt * 12); this.duck.y += (d.y - this.duck.y) * Math.min(1, dt * 12);
    this.duck.setFrame(mv > 0.3 ? String(Math.floor(this.tAnim / 0.2) % 2) : '0').setFlipX(d.d === 3).setDepth(this.duck.y + 2);
    this.dname.setPosition(this.duck.x, this.duck.y - 16); this.duck.setScale(1, mv > 0.3 ? 1 + Math.sin(this.tAnim * 20) * 0.04 : 1);
  }
  private drawDeco(w: import('./types').World) {
    const d = app.ui?.deco; if (!d || (!d.key && d.id === undefined)) { this.ghost.setVisible(false); return; }
    const key = d.key ?? w.furn.find(f => f.id === d.id)?.k; if (!key) { this.ghost.setVisible(false); return; } const def = CAT[key];
    const r = def.w === def.h ? 0 : d.r; const ww = r ? def.h : def.w, hh = r ? def.w : def.h;
    const err = validatePlace(w, def, d.x, d.y, d.r, d.id ?? -1); d.valid = !err;
    this.ghost.setTexture(`f_${key}_${r}_0`).setPosition(d.x * T, (d.y + hh) * T).setVisible(true).setTint(err ? 0xff6060 : 0x80ff80).setFlipX(false);
    this.gfx.lineStyle(1, err ? 0xff4040 : 0x60ff60, 1).strokeRect(d.x * T, d.y * T, ww * T, hh * T);
    if (d.sel) void 0;
  }
  private lighting(w: import('./types').World) {
    const tm = w.meta.tm; let a = 0; if (tm > 1000) a = Math.min(0.5, (tm - 1000) / 200 * 0.5); else if (tm < DAY_START + 60) a = (1 - (tm - DAY_START) / 60) * 0.18; if (w.meta.phase === 'report') a = 0.5;
    this.dark.setFillStyle(0x10103a, a); for (const g of this.glows) g.setAlpha(Math.min(1, a * 2 + ((g as any).lamp ? 0.12 : 0)) * ((g as any).lamp ? 1 : 0.5));
    const sel = app.ui?.deco?.sel; if (sel) { const f = w.furn.find(f => f.id === sel); if (f) this.gfx.lineStyle(1, 0x80d0ff, 1).strokeRect(f.x * T - 1, f.y * T - 1, fw(f) * T + 2, fh(f) * T + 2); }
  }
}
export { cols, ROWS, DAY_END, STATION_NAMES, lookKey };
