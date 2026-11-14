import { CAT, ROWS, DOOR_X, cols, Cat } from './data';
import { Furn, World } from './types';

export const fw = (f: { k: string; r: number }) => (f.r ? CAT[f.k].h : CAT[f.k].w);
export const fh = (f: { k: string; r: number }) => (f.r ? CAT[f.k].w : CAT[f.k].h);
export const dims = (w: World) => ({ W: cols(w.meta.rooms), H: ROWS });

/** Çarpışan (geçilemeyen) karelerin ızgarası */
export function blockedGrid(w: World, extra?: { k: string; x: number; y: number; r: 0 | 1 }, ignoreId = -1): boolean[][] {
  const { W, H } = dims(w);
  const g: boolean[][] = [];
  for (let y = 0; y < H; y++) { g.push([]); for (let x = 0; x < W; x++) g[y].push(y < 2 || x === 0 || x === W - 1 || (y === H - 1 && x !== DOOR_X && x !== DOOR_X + 1)); }
  const put = (f: { k: string; x: number; y: number; r: 0 | 1 }) => {
    if (!CAT[f.k].blocks) return;
    for (let i = 0; i < fw(f); i++) for (let j = 0; j < fh(f); j++) if (g[f.y + j] && f.x + i < W) g[f.y + j][f.x + i] = true;
  };
  for (const f of w.furn) if (f.id !== ignoreId) put(f);
  if (extra) put(extra);
  return g;
}

export function bfs(g: boolean[][], from: [number, number], to?: [number, number]): [number, number][] | Set<number> | null {
  const H = g.length, W = g[0].length; const prev = new Map<number, number>(); const q = [from[1] * W + from[0]]; prev.set(q[0], -1);
  const goal = to ? to[1] * W + to[0] : -2;
  for (let i = 0; i < q.length; i++) {
    const c = q[i]; if (c === goal) break; const cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx;
      if (prev.has(n)) continue; if (g[ny][nx] && n !== goal) continue; prev.set(n, c); q.push(n);
    }
  }
  if (!to) return new Set(prev.keys());
  if (!prev.has(goal)) return null;
  const out: [number, number][] = []; for (let c = goal; c !== -1; c = prev.get(c)!) out.push([c % W, (c / W) | 0]);
  return out.reverse();
}

export const seatTiles = (f: Furn): [number, number, number][] => // [x, y, bakış yönü]
  f.r ? [[f.x, f.y, 0], [f.x, f.y + 2, 1]] : [[f.x, f.y, 3], [f.x + 2, f.y, 2]];

export function validatePlace(w: World, def: Cat, x: number, y: number, r: 0 | 1, ignoreId = -1): string | null {
  const { W, H } = dims(w);
  const ww = r ? def.h : def.w, hh = r ? def.w : def.h;
  if (def.wall) { if (y !== 1 || x < 1 || x + ww > W - 1) return 'Duvara yerleştirilmeli'; if (w.furn.some(f => f.id !== ignoreId && CAT[f.k].wall && f.y === 1 && f.x < x + ww && f.x + fw(f) > x)) return 'Burası dolu'; return null; }
  if (x < 1 || y < 2 || x + ww > W - 1 || y + hh > H - 1) return 'Kafenin dışında';
  for (const f of w.furn) {
    if (f.id === ignoreId || CAT[f.k].wall) continue;
    if (CAT[f.k].blocks !== def.blocks) continue; // halı üstüne eşya konabilir
    if (f.x < x + ww && f.x + fw(f) > x && f.y < y + hh && f.y + fh(f) > y) return 'Burası dolu';
  }
  if (def.blocks && !blockedCheck(w, { k: def.k, x, y, r }, ignoreId)) return 'Geçiş yolunu kapatıyor!';
  return null;
}

/** Her istasyon/koltuk için kapıdan ulaşılabilir bir komşu kare olmalı */
export function blockedCheck(w: World, extra: { k: string; x: number; y: number; r: 0 | 1 } | undefined, ignoreId = -1): boolean {
  const g = blockedGrid(w, extra, ignoreId); const reach = bfs(g, [DOOR_X, ROWS - 2]) as Set<number>; const W = g[0].length;
  if (g[ROWS - 2][DOOR_X]) return false;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < ROWS && reach.has(y * W + x);
  const list = w.furn.filter(f => f.id !== ignoreId).map(f => ({ k: f.k, x: f.x, y: f.y, r: f.r }));
  if (extra) list.push(extra);
  for (const f of list) {
    const d = CAT[f.k]; if (!d.st && !d.seats) continue;
    const ww = fw(f), hh = fh(f); let found = false;
    for (let i = -1; i <= ww && !found; i++) for (let j = -1; j <= hh && !found; j++) {
      if ((i >= 0 && i < ww) === (j >= 0 && j < hh)) continue; // sadece 4-komşu
      if (ok(f.x + i, f.y + j)) found = true;
    }
    if (!found) return false;
  }
  return true;
}
