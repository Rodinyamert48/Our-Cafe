import { CAT, DAY_END, DAY_LAST_ORDER, DAY_START, DOOR_X, EXPAND, FLOORS, ING, INGS, MAXUP, RECIPES, REC, ROWS, T, WALLS, initialFurn, upCost, xpFor } from './data';
import { Act, Cust, Evt, Look, Player, Stats, World } from './types';
import { bfs, blockedCheck, blockedGrid, fh, fw, seatTiles, validatePlace } from './layout';

const rnd = (n: number) => Math.floor(Math.random() * n);
export const randomLook = (): Look => ({ skin: rnd(6), hair: rnd(6), hairC: rnd(8), shirt: rnd(3), shirtC: rnd(8), apron: 0, hat: 0, acc: 0 });
export const defaultLook = (n: number): Look => n === 0 ? { skin: 1, hair: 0, hairC: 1, shirt: 0, shirtC: 1, apron: 1, hat: 0, acc: 0 } : { skin: 0, hair: 1, hairC: 2, shirt: 1, shirtC: 0, apron: 2, hat: 0, acc: 0 };
const emptyStats = (): Stats => ({ income: 0, tips: 0, spent: 0, served: 0, dishes: 0, angry: 0, sat: [] });

export function newWorld(): World {
  const inv: Record<string, number> = {}; for (const i of INGS) inv[i.id] = 8;
  return {
    meta: { money: 250, xp: 0, level: 1, day: 1, tm: DAY_START, phase: 'open', rooms: 1, floor: 'wood', wall: 'cream', owned: ['wood', 'cream'], recipes: RECIPES.filter(r => r.start).map(r => r.id), up: { coffee: 1, stove: 1, oven: 1, prep: 1 }, total: 0, nid: 1000, ver: 1 },
    inv, furn: initialFurn(), stn: {}, cust: [],
    players: [{ id: 0, name: 'Ev Sahibi', look: defaultLook(0), hand: null, on: true }],
    duck: { x: 13.5 * T, y: 3.5 * T, d: 2, tx: 13.5 * T, ty: 3.5 * T, wait: 1, heart: 0, color: 0, hat: 0, acc: 0 },
    dirty: {}, stats: emptyStats(), report: null, paused: false,
  };
}

export class Sim {
  w: World; emit: (e: Evt) => void = () => {}; spawnT = 4;
  constructor(w?: World) { this.w = w ?? newWorld(); if (!this.w.duck) this.w.duck = newWorld().duck; }
  get m() { return this.w.meta; }
  private fx(n: 'coin' | 'heart' | 'level', x: number, y: number, v?: number) { this.emit({ e: 'fx', n, x, y, v }); }
  private sfx(n: string) { this.emit({ e: 'sfx', n }); }
  private spend(n: number) { this.m.money -= n; this.w.stats.spent += n; }
  furn(id: number) { return this.w.furn.find(f => f.id === id); }

  /** Kayıttan yüklenen dünyayı temizle: devam eden işler iptal olur */
  static sanitize(w: World): World {
    w.stn = {}; w.cust = []; w.dirty = {}; w.paused = false; w.report = null;
    for (const p of w.players) { p.hand = null; p.on = p.id === 0; }
    w.players = w.players.filter(p => p.id === 0 || true);
    if (w.meta.phase === 'report') { w.meta.phase = 'open'; w.meta.tm = DAY_START; w.meta.day++; w.stats = emptyStats(); }
    return w;
  }

  tick(dt: number) {
    const w = this.w, m = w.meta; if (w.paused) return;
    if (m.phase !== 'report') {
      if (m.tm < DAY_END) m.tm = Math.min(DAY_END, m.tm + dt * 2); // 1 oyun dakikası = 0.5 sn
      if (m.phase === 'open' && m.tm >= DAY_LAST_ORDER) m.phase = 'closing';
      if (m.tm >= DAY_END) for (const c of w.cust) if (c.st === 'sit' || c.st === 'wait' || c.st === 'eat') { if (c.st !== 'eat') { c.mood = 0; w.stats.angry++; } this.leave(c); }
      if (m.phase === 'closing' && w.cust.length === 0) this.endDay();
    }
    for (const id in w.stn) { const s = w.stn[id]; if (!s.ready) { s.left -= dt; if (s.left <= 0) { s.ready = true; s.left = 0; this.sfx('ding'); } } }
    if (m.phase === 'open') { this.spawnT -= dt; if (this.spawnT <= 0) { this.spawn(); this.spawnT = Math.max(5, 15 - m.level * 0.9) + Math.random() * 4; } }
    for (const c of w.cust.slice()) this.updCust(c, dt);
    this.updDuck(dt);
  }

  private seatXY(c: Cust) { const t = this.furn(c.tbl); if (!t) return null; const s = seatTiles(t)[c.seat]; return s; }
  private spawn() {
    const w = this.w; const taken = new Set(w.cust.map(c => c.tbl * 2 + c.seat));
    const free: { t: number; s: number }[] = [];
    for (const f of w.furn) if (CAT[f.k].seats && !(w.dirty[f.id] > 0)) for (let s = 0; s < 2; s++) if (!taken.has(f.id * 2 + s)) free.push({ t: f.id, s });
    if (!free.length) return;
    const pick = free[rnd(free.length)]; const t = this.furn(pick.t)!; const st = seatTiles(t)[pick.s];
    const g = blockedGrid(w); const path = bfs(g, [DOOR_X, ROWS - 1], [st[0], st[1]]) as [number, number][] | null; if (!path) return;
    const rs = w.meta.recipes; const r = rs[rnd(rs.length)]; const pat = 80 + rnd(50);
    const c: Cust = { id: w.meta.nid++, x: (DOOR_X + 0.5) * T, y: (ROWS - 1 + 0.5) * T, d: 1, look: randomLook(), st: 'in', tbl: pick.t, seat: pick.s, r, pat, patMax: pat, t: 0, tip: 0, mood: 1, path: path.map(([x, y]) => [(x + 0.5) * T, (y + 0.5) * T] as [number, number]) };
    w.cust.push(c); this.sfx('bell');
  }
  private leave(c: Cust) {
    const w = this.w; c.st = 'out'; const g = blockedGrid(w);
    const p = bfs(g, [Math.floor(c.x / T), Math.floor(c.y / T)], [DOOR_X, ROWS - 1]) as [number, number][] | null;
    c.path = p ? p.map(([x, y]) => [(x + 0.5) * T, (y + 0.5) * T] as [number, number]) : [[(DOOR_X + 0.5) * T, (ROWS - 0.5) * T]];
  }
  private move(c: { x: number; y: number; d: number; path?: [number, number][] }, dt: number, sp: number) {
    const p = c.path; if (!p || !p.length) return true; let left = sp * dt;
    while (left > 0 && p.length) {
      const [tx, ty] = p[0]; const dx = tx - c.x, dy = ty - c.y; const dist = Math.hypot(dx, dy);
      if (dist <= left) { c.x = tx; c.y = ty; p.shift(); left -= dist; } else { c.x += dx / dist * left; c.y += dy / dist * left; left = 0; }
      if (Math.abs(dx) > Math.abs(dy)) c.d = dx < 0 ? 2 : 3; else if (dist > 0.01) c.d = dy < 0 ? 1 : 0;
    }
    return p.length === 0;
  }
  private updCust(c: Cust, dt: number) {
    const w = this.w;
    switch (c.st) {
      case 'in': if (this.move(c, dt, 30)) { const t = this.furn(c.tbl); const s = seatTiles(t!)[c.seat]; c.d = s[2]; c.st = 'sit'; c.t = 1.5 + Math.random() * 2; c.path = undefined; } break;
      case 'sit': if ((c.t -= dt) <= 0) { c.st = 'wait'; this.sfx('order'); } break;
      case 'wait': if ((c.pat -= dt) <= 0) { c.mood = 0; w.stats.angry++; this.leave(c); this.sfx('angry'); } break;
      case 'eat': if ((c.t -= dt) <= 0) {
        const price = REC[c.r].price; const total = price + c.tip; const m = w.meta;
        m.money += total; m.total += total; w.stats.income += price; w.stats.tips += c.tip; w.stats.served++; w.stats.sat.push(c.mood);
        w.dirty[c.tbl] = (w.dirty[c.tbl] || 0) + 1; this.addXp(8 + Math.round(c.mood * 7));
        this.sfx('coin'); this.fx('coin', c.x, c.y - 10, total); this.leave(c);
      } break;
      case 'out': if (this.move(c, dt, 34)) w.cust.splice(w.cust.indexOf(c), 1); break;
    }
  }
  private addXp(n: number) { const m = this.m; m.xp += n; while (m.xp >= xpFor(m.level + 1)) { m.level++; this.sfx('level'); this.fx('level', 0, 0, m.level); } }
  private updDuck(dt: number) {
    const d = this.w.duck; d.heart = Math.max(0, d.heart - dt);
    if ((d.wait -= dt) > 0) return;
    if (Math.hypot(d.tx - d.x, d.ty - d.y) < 1) { d.wait = 1 + Math.random() * 3; const r = this.w.furn.find(f => f.k === 'register'); const cx = r ? r.x + 1.2 : 13.2, cy = r ? r.y - 2 : 3; d.tx = (cx - 1.6 + Math.random() * 3.2) * T; d.ty = (cy + Math.random() * 1.5) * T; return; }
    const dx = d.tx - d.x, dy = d.ty - d.y, l = Math.hypot(dx, dy), s = Math.min(l, 14 * dt); d.x += dx / l * s; d.y += dy / l * s; if (Math.abs(dx) > 0.5) d.d = dx < 0 ? 2 : 3;
  }
  private endDay() {
    const w = this.w, s = w.stats, m = w.meta; m.phase = 'report';
    const sat = s.sat.length ? s.sat.reduce((a, b) => a + b, 0) / (s.sat.length + s.angry) : 0;
    w.report = { day: m.day, income: s.income, tips: s.tips, spent: s.spent, net: s.income + s.tips - s.spent, served: s.served, dishes: s.dishes, angry: s.angry, sat };
    w.stn = {}; for (const p of w.players) p.hand = null; this.sfx('dayend'); this.emit({ e: 'sfx', n: 'autosave' });
  }

  /** Oyuncu eylemlerini doğrular ve uygular. Hata varsa mesaj döner. */
  handle(pid: number, a: Act): string | void {
    const w = this.w, m = w.meta, p = w.players.find(q => q.id === pid); if (!p) return;
    const err = (s: string) => { this.emit({ e: 'toast', to: pid, m: s }); return s; };
    const st = (id: number) => { const f = this.furn(id); return f ? { f, d: CAT[f.k] } : null; };
    switch (a.a) {
      case 'look': p.name = String(a.name).slice(0, 14) || p.name; p.look = a.look; return;
      case 'pause': if (pid === 0) w.paused = !!a.v; return;
      case 'drop': p.hand = null; return;
      case 'pet': w.duck.heart = 2; this.sfx('quack'); this.fx('heart', w.duck.x, w.duck.y - 8); return;
      case 'duck': w.duck.color = a.look.color | 0; w.duck.hat = a.look.hat | 0; w.duck.acc = a.look.acc | 0; this.sfx('quack'); return;
      case 'next': if (pid !== 0 || m.phase !== 'report') return; m.day++; m.tm = DAY_START; m.phase = 'open'; w.report = null; w.stats = emptyStats(); this.spawnT = 3; this.sfx('bell'); return;
      case 'start': {
        const s = st(a.f); if (!s || !s.d.st || !['stove', 'oven', 'coffee', 'prep'].includes(s.d.st)) return err('Burada hazırlık yapılamaz');
        if (w.stn[s.f.id]) return err('Bu istasyon meşgul'); if (p.hand) return err('Elin dolu');
        const r = REC[a.r]; if (!r || !m.recipes.includes(r.id)) return err('Tarif açık değil'); if (r.steps[0].st !== s.d.st) return err('Yanlış istasyon');
        for (const k in r.need) if ((w.inv[k] || 0) < r.need[k]) return err(ING[k].name + ' yetersiz!');
        for (const k in r.need) w.inv[k] -= r.need[k];
        const t = r.steps[0].t * Math.pow(0.85, (m.up[s.d.st] || 1) - 1);
        w.stn[s.f.id] = { r: r.id, s: 0, left: t, total: t, ready: false, by: pid }; this.sfx('st_' + s.d.st); return;
      }
      case 'take': {
        const s = st(a.f), x = s && w.stn[s.f.id]; if (!s || !x || !x.ready) return err('Henüz hazır değil'); if (p.hand) return err('Elin dolu');
        p.hand = { k: 'dish', r: x.r, s: x.s + 1 }; delete w.stn[s.f.id]; this.sfx('pick'); return;
      }
      case 'put': {
        const s = st(a.f); if (!s || p.hand?.k !== 'dish') return; const r = REC[p.hand.r]; const step = r.steps[p.hand.s];
        if (!step || step.st !== s.d.st) return err('Bu yemek burada işlenmez'); if (w.stn[s.f.id]) return err('Bu istasyon meşgul');
        const t = step.t * Math.pow(0.85, (m.up[s.d.st] || 1) - 1);
        w.stn[s.f.id] = { r: r.id, s: p.hand.s, left: t, total: t, ready: false, by: pid }; p.hand = null; this.sfx('st_' + s.d.st); return;
      }
      case 'serve': {
        const s = st(a.f); if (!s || !s.d.seats) return; if (p.hand?.k !== 'dish') return err('Elinde servis edilecek yemek yok');
        const r = REC[p.hand.r]; if (p.hand.s < r.steps.length) return err('Yemek henüz tamamlanmadı');
        const c = w.cust.filter(c => c.tbl === s.f.id && c.st === 'wait' && c.r === r.id).sort((x, y) => x.pat - y.pat)[0];
        if (!c) return err('Bu masada bunu isteyen yok');
        const frac = c.pat / c.patMax; c.mood = 0.4 + 0.6 * frac; c.tip = frac > 0.4 ? Math.round(r.price * 0.3 * frac) : 0;
        c.st = 'eat'; c.t = 6 + Math.random() * 3; w.stats.dishes++; p.hand = null; this.sfx('serve'); return;
      }
      case 'clean': {
        const s = st(a.f); if (!s || !s.d.seats || !(w.dirty[s.f.id] > 0)) return; if (p.hand) return err('Elin dolu');
        w.dirty[s.f.id]--; p.hand = { k: 'plate' }; this.sfx('pick'); return;
      }
      case 'wash': { if (p.hand?.k !== 'plate') return err('Yıkanacak tabak yok'); p.hand = null; this.addXp(2); this.sfx('water'); return; }
      case 'buy': {
        const i = ING[a.i]; const n = Math.max(1, Math.min(20, a.n | 0)); if (!i) return; const c = i.price * n;
        if (m.money < c) return err('Yeterli paran yok'); if ((w.inv[i.id] || 0) + n > 99) return err('Depo dolu (en fazla 99)');
        this.spend(c); w.inv[i.id] = (w.inv[i.id] || 0) + n; this.sfx('buy'); return;
      }
      case 'unlock': {
        const r = REC[a.r]; if (!r || m.recipes.includes(r.id)) return; if (m.level < r.lvl) return err(`Seviye ${r.lvl} gerekli`);
        if (m.money < r.cost) return err('Yeterli paran yok'); this.spend(r.cost); m.recipes.push(r.id); this.sfx('level'); return;
      }
      case 'upgrade': {
        const cur = m.up[a.k]; if (!cur || cur >= MAXUP) return err('Daha fazla yükseltilemez'); const c = upCost(cur);
        if (m.money < c) return err('Yeterli paran yok'); this.spend(c); m.up[a.k] = cur + 1; this.sfx('level'); return;
      }
      case 'expand': {
        const e = EXPAND[m.rooms - 1]; if (!e) return err('Tüm odalar açık'); if (m.level < e.lvl) return err(`Seviye ${e.lvl} gerekli`);
        if (m.money < e.cost) return err('Yeterli paran yok'); this.spend(e.cost); m.rooms++; m.ver++; this.sfx('level'); return;
      }
      case 'style': {
        const list = a.t === 'floor' ? FLOORS : WALLS; const it = list.find(x => x.id === a.id); if (!it) return;
        if (!m.owned.includes(it.id)) { if (m.money < it.price) return err('Yeterli paran yok'); this.spend(it.price); m.owned.push(it.id); }
        if (a.t === 'floor') m.floor = it.id; else m.wall = it.id; m.ver++; this.sfx('place'); return;
      }
      case 'place': {
        const d = CAT[a.k]; if (!d) return; if (d.lvl && m.level < d.lvl) return err(`Seviye ${d.lvl} gerekli`);
        if (m.money < d.price) return err('Yeterli paran yok'); const e = validatePlace(w, d, a.x, a.y, a.r); if (e) return err(e);
        this.spend(d.price); w.furn.push({ id: m.nid++, k: a.k, x: a.x, y: a.y, r: d.w === d.h ? 0 : a.r }); m.ver++; this.sfx('place'); return;
      }
      case 'move': {
        const f = this.furn(a.id); if (!f) return; if (w.stn[f.id]) return err('İstasyon şu an kullanımda');
        if (w.cust.some(c => c.tbl === f.id)) return err('Masada müşteri var');
        const d = CAT[f.k]; const e = validatePlace(w, d, a.x, a.y, a.r, f.id); if (e) return err(e);
        f.x = a.x; f.y = a.y; f.r = d.w === d.h ? 0 : a.r; m.ver++; this.sfx('place'); return;
      }
      case 'sell': {
        const f = this.furn(a.id); if (!f) return; const d = CAT[f.k]; if (w.stn[f.id]) return err('İstasyon şu an kullanımda');
        if (w.cust.some(c => c.tbl === f.id)) return err('Masada müşteri var');
        if (['fridge', 'shelf', 'stove', 'oven', 'coffee', 'prep', 'sink', 'register', 'table_wood', 'table_cozy'].includes(f.k) &&
          w.furn.filter(x => (CAT[x.k].st ?? CAT[x.k].seats) && (CAT[x.k].seats ? CAT[f.k].seats : CAT[x.k].st === d.st)).length <= 1) return err('Bundan en az bir tane kalmalı');
        const idx = w.furn.indexOf(f); w.furn.splice(idx, 1);
        if (!blockedCheck(w, undefined)) { w.furn.splice(idx, 0, f); return err('Kaldırınca yollar kapanıyor'); }
        m.money += Math.floor(d.price * 0.5); delete w.dirty[f.id]; m.ver++; this.sfx('coin'); return;
      }
    }
  }
}
export { fh, fw };
