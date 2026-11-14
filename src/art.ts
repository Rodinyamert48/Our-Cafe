/** Özgün, kod ile çizilen pixel art (16x16 ızgara). Tüm sprite'lar dış çizgi geçişinden geçer. Harici asset yoktur. */
import Phaser from 'phaser';
import { CAT, CATALOG, INGS, RECIPES } from './data';
import { DuckLook, Look } from './types';

type Ctx = CanvasRenderingContext2D;
export const SKIN = ['#f9d8bd', '#efc19b', '#d9a273', '#b87c52', '#8d5a3a', '#5c3a26'];
export const HAIRC = ['#2b1b17', '#5a3520', '#9a5b2a', '#e0b050', '#c8452e', '#8a8f98', '#ece4d4', '#3a5db5'];
export const SHIRTC = ['#e85d75', '#4f9bd9', '#6cc36b', '#f2b84b', '#9b6bd6', '#f08a4b', '#3ec5b5', '#f4efe6'];
export const APRONC = ['', '#f6f1e7', '#c8453a', '#4a8f5a', '#3c6fb0'];
export const DUCKC = ['#ffd23f', '#ff9f43', '#f5f5f5', '#ff8fb8', '#6ec1ff', '#9be564'];
export const OPT = {
  hair: ['Kısa', 'Uzun', 'Topuz', 'Kıvırcık', 'Kel', 'At Kuyruğu'], shirt: ['Tişört', 'Kazak', 'Gömlek'],
  apron: ['Yok', 'Beyaz', 'Kırmızı', 'Yeşil', 'Mavi'], hat: ['Yok', 'Kasket', 'Aşçı Şapkası', 'Bere', 'Hasır Şapka'], acc: ['Yok', 'Gözlük', 'Atkı', 'Papyon'],
  dhat: ['Yok', 'Silindir', 'Fiyonk', 'Taç', 'Bere'], dacc: ['Yok', 'Gözlük', 'Atkı', 'Papyon'],
};
const OL = '#2e1f26';
export const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const R = (c: Ctx, col: string, x: number, y: number, w = 1, h = 1) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const sh = (hex: string, d: number) => { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.max(0, Math.min(255, v + d)); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join(''); };

/** Her kareyi (cell boyutlu) 1px dış çizgiyle çevreler. */
/** Hacim hissi için otomatik ışık/gölge: üst kenar aydınlık, alt kenar koyu (sol üstten ışık). */
function shade(cv: HTMLCanvasElement, cw: number, ch: number) {
  const c = cv.getContext('2d')!; const img = c.getImageData(0, 0, cv.width, cv.height); const d = img.data, W = cv.width, H = cv.height; const src = new Uint8ClampedArray(d);
  const a = (x: number, y: number, ox: number, oy: number) => { const nx = x + ox, ny = y + oy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || Math.floor(nx / cw) !== Math.floor(x / cw) || Math.floor(ny / ch) !== Math.floor(y / ch)) return 0; return src[(ny * W + nx) * 4 + 3]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; if (!src[i + 3]) continue; let k = 0;
    if (!a(x, y, 0, -1)) k += 26; else if (!a(x, y, -1, 0)) k += 12;
    if (!a(x, y, 0, 1)) k -= 34; else if (!a(x, y, 1, 0)) k -= 16; else if (!a(x, y, 0, 2)) k -= 12;
    if (k) for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, src[i + j] + k * (k > 0 ? 1 : 1.15)));
  }
  c.putImageData(img, 0, 0);
}
function outline(cv: HTMLCanvasElement, cw = cv.width, ch = cv.height) {
  shade(cv, cw, ch); const c = cv.getContext('2d')!; const img = c.getImageData(0, 0, cv.width, cv.height); const d = img.data, W = cv.width;
  const src = new Uint8ClampedArray(d); const a = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= cv.height ? 0 : src[(y * W + x) * 4 + 3]);
  const col = [0x2e, 0x1f, 0x26];
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < W; x++) {
    if (a(x, y)) continue; const lx = x % cw, ly = y % ch; void lx; void ly;
    if ((x % cw !== 0 && a(x - 1, y)) || (x % cw !== cw - 1 && a(x + 1, y)) || (y % ch !== 0 && a(x, y - 1)) || (y % ch !== ch - 1 && a(x, y + 1))) {
      const i = (y * W + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0); return cv;
}

// ---------- KARAKTER ----------
export const CW = 18, CH = 24;
function drawChar(c: Ctx, ox: number, oy: number, L: Look, row: number, fr: number) {
  const skin = SKIN[L.skin], hairc = HAIRC[L.hairC], shirt = SHIRTC[L.shirtC];
  const walk = fr === 1 || fr === 2 || fr === 4 || fr === 5, carry = fr >= 3 && fr <= 5, act = fr >= 6;
  const ph = fr === 1 || fr === 4 ? 1 : fr === 2 || fr === 5 ? -1 : 0, side = row === 2, back = row === 1;
  c.save(); c.translate(ox + 1, oy + 1);
  const pants = '#3d4a6b', shoe = '#5a3a2c';
  // bacaklar
  if (!side) {
    const a = ph === 1 ? 1 : 0, b = ph === -1 ? 1 : 0;
    R(c, pants, 5, 17, 3, 4 - a); R(c, shoe, 5, 21 - a, 3, 1); R(c, pants, 8, 17, 3, 4 - b); R(c, shoe, 8, 21 - b, 3, 1);
  } else { R(c, sh(pants, -15), 6 - ph, 17, 3, 5); R(c, shoe, 6 - ph - (ph > 0 ? 0 : 0), 21, 3, 1); R(c, pants, 7 + ph, 17, 3, 5); R(c, shoe, 7 + ph - 1, 21, 4, 1); }
  // gövde
  R(c, shirt, 4, 10, 8, 7); R(c, sh(shirt, -28), 4, 16, 8, 1);
  if (L.shirt === 2 && !side && !back) { R(c, '#fff', 6, 10, 4, 1); R(c, sh(shirt, -40), 8, 11, 1, 5); }
  // önlük
  if (L.apron > 0) {
    const ac = APRONC[L.apron];
    if (back) R(c, ac, 4, 12, 8, 1); else if (side) R(c, ac, 4, 11, 5, 6); else { R(c, ac, 6, 10, 4, 2); R(c, ac, 5, 12, 6, 5); R(c, sh(ac, -35), 5, 16, 6, 1); }
  }
  // kollar
  const sleeve = L.shirt === 0 ? skin : shirt;
  if (!side) {
    if (carry) { R(c, shirt, 2, 9, 2, 4); R(c, skin, 2, 8, 2, 1); R(c, shirt, 12, 9, 2, 4); R(c, skin, 12, 8, 2, 1); }
    else if (act) { const y = fr === 6 ? 12 : 11; R(c, shirt, 3, y - 1, 2, 3); R(c, skin, 4, y + 2, 2, 1); R(c, shirt, 11, y - 1, 2, 3); R(c, skin, 10, y + 2, 2, 1); }
    else { R(c, shirt, 2, 11, 2, 2); R(c, sleeve, 2, 13, 2, 2); R(c, skin, 2, 15, 2, 1); R(c, shirt, 12, 11, 2, 2); R(c, sleeve, 12, 13, 2, 2); R(c, skin, 12, 15, 2, 1); }
  } else {
    if (carry) { R(c, shirt, 5, 10, 3, 2); R(c, skin, 3, 9, 3, 2); }
    else if (act) { R(c, shirt, 5, 11, 3, 2); R(c, skin, 3, fr === 6 ? 12 : 11, 3, 2); }
    else { R(c, shirt, 6 - ph, 11, 3, 3); R(c, sleeve, 6 - ph, 14, 3, 1); R(c, skin, 6 - ph, 15, 3, 1); }
  }
  // baş
  R(c, skin, 4, 2, 8, 8); R(c, skin, 3, 5, 1, 3); R(c, skin, 12, 5, 1, 3);
  if (!back) {
    if (!side) { R(c, '#2b1b17', 6, 6, 1, 2); R(c, '#2b1b17', 9, 6, 1, 2); R(c, sh(skin, -35), 7, 9, 2, 1); R(c, sh('#e85d75', 0), 5, 8, 1, 1, ); R(c, '#f0968f', 5, 8, 1, 1); R(c, '#f0968f', 10, 8, 1, 1); }
    else { R(c, '#2b1b17', 5, 6, 1, 2); R(c, sh(skin, -35), 4, 9, 2, 1); }
  }
  // saç
  const H = L.hair;
  if (H !== 4) {
    if (back) {
      R(c, hairc, 3, 1, 10, 9); if (H === 1) R(c, hairc, 3, 10, 10, 3); if (H === 3) { R(c, hairc, 2, 1, 12, 8); } if (H === 5) R(c, hairc, 7, 10, 2, 4);
    } else if (!side) {
      R(c, hairc, 3, 1, 10, 3); R(c, hairc, 3, 4, 1, 3); R(c, hairc, 12, 4, 1, 3); R(c, hairc, 4, 4, 3, 1); R(c, hairc, 9, 4, 3, 1);
      if (H === 1) { R(c, hairc, 3, 4, 2, 8); R(c, hairc, 11, 4, 2, 8); } if (H === 3) { R(c, hairc, 2, 1, 12, 5); R(c, hairc, 2, 6, 2, 2); R(c, hairc, 12, 6, 2, 2); }
      if (H === 5) R(c, hairc, 12, 5, 2, 5);
    } else {
      R(c, hairc, 3, 1, 10, 3); R(c, hairc, 8, 4, 5, 5); R(c, hairc, 4, 4, 2, 1);
      if (H === 1) R(c, hairc, 8, 4, 5, 9); if (H === 3) { R(c, hairc, 2, 1, 12, 5); R(c, hairc, 8, 6, 6, 3); } if (H === 5) R(c, hairc, 11, 6, 3, 6);
    }
    if (H === 2) R(c, hairc, 6, 0, 4, 2);
  }
  // şapka
  const hat = L.hat;
  if (hat === 1) { R(c, '#d4453a', 3, 1, 10, 3); R(c, '#a8322a', 3, 3, 10, 1); if (back) { } else if (side) R(c, '#a8322a', 1, 4, 4, 1); else R(c, '#a8322a', 4, 4, 8, 1); }
  if (hat === 2) { R(c, '#fff', 4, 0, 8, 2); R(c, '#fff', 3, 2, 10, 2); R(c, '#e3dccb', 4, 4, 8, 1); }
  if (hat === 3) { R(c, '#4f7fd1', 3, 1, 10, 3); R(c, '#86aef0', 3, 4, 10, 1); R(c, '#fff', 7, 0, 2, 1); }
  if (hat === 4) { R(c, '#e8c568', 1, 3, 14, 2); R(c, '#e8c568', 4, 1, 8, 2); R(c, '#c8452e', 4, 2, 8, 1); }
  // aksesuar
  if (L.acc === 1 && !back) { if (!side) { R(c, '#333', 5, 5, 6, 1); R(c, '#333', 5, 8, 6, 1); R(c, '#333', 5, 5, 1, 4); R(c, '#333', 10, 5, 1, 4); R(c, '#333', 7, 6, 2, 1); } else { R(c, '#333', 3, 5, 4, 1); R(c, '#333', 3, 8, 4, 1); R(c, '#333', 3, 5, 1, 3); R(c, '#333', 6, 5, 6, 1); } }
  if (L.acc === 2) R(c, '#c8453a', side ? 5 : 4, 10, side ? 6 : 8, 2);
  if (L.acc === 3 && !back) { R(c, '#c8453a', side ? 5 : 6, 10, 4, 2); R(c, '#7a2a22', side ? 6 : 7, 10, 2, 1); }
  c.restore();
}
const charCache = new Map<string, string>();
export const lookKey = (L: Look) => 'ch_' + [L.skin, L.hair, L.hairC, L.shirt, L.shirtC, L.apron, L.hat, L.acc].join('.');
export function charSheet(L: Look): HTMLCanvasElement {
  const cv = mk(CW * 8, CH * 3); const c = cv.getContext('2d')!;
  for (let r = 0; r < 3; r++) for (let f = 0; f < 8; f++) drawChar(c, f * CW, r * CH, L, r, f);
  return outline(cv, CW, CH);
}
export function ensureChar(scene: Phaser.Scene, L: Look): string {
  const k = lookKey(L); if (charCache.has(k)) return k;
  const t = scene.textures.addCanvas(k, charSheet(L))!; for (let r = 0; r < 3; r++) for (let f = 0; f < 8; f++) t.add(`${r}_${f}`, 0, f * CW, r * CH, CW, CH);
  charCache.set(k, k); return k;
}
/** Menü önizlemesi: kare başına bir canvas */
export function charPreview(L: Look, row = 0, fr = 0): HTMLCanvasElement {
  const cv = mk(CW, CH); drawChar(cv.getContext('2d')!, 0, 0, L, row, fr); return outline(cv);
}

// ---------- ÖRDEK (Mertoş) ----------
export function drawDuck(c: Ctx, ox: number, oy: number, D: DuckLook, fr: number) {
  const col = DUCKC[D.color], dk = sh(col, -40), beak = '#ff8c1a'; c.save(); c.translate(ox + 1, oy + 4);
  R(c, col, 10, 6, 3, 2); R(c, col, 5, 8, 8, 1); R(c, col, 4, 9, 10, 4); R(c, col, 5, 13, 8, 1); R(c, dk, 6, 10, 5, 2);
  R(c, col, 5, 6, 4, 3); R(c, col, 3, 3, 5, 4); R(c, col, 4, 2, 3, 1); R(c, beak, 0, 5, 3, 2); R(c, '#222', 4, 4, 1, 1);
  R(c, beak, fr ? 5 : 6, 14, 2, 1); R(c, beak, fr ? 10 : 9, fr ? 13 : 14, 2, 1);
  if (D.acc === 1) { R(c, '#333', 3, 3, 3, 1); R(c, '#333', 3, 5, 3, 1); R(c, '#333', 3, 3, 1, 3); R(c, '#333', 5, 3, 1, 3); }
  if (D.acc === 2) { R(c, '#c8453a', 4, 7, 5, 2); R(c, '#c8453a', 5, 9, 1, 3); }
  if (D.acc === 3) { R(c, '#c8453a', 4, 7, 2, 2); R(c, '#c8453a', 7, 7, 2, 2); R(c, '#7a2a22', 6, 7, 1, 2); }
  if (D.hat === 1) { R(c, '#222', 4, -3, 3, 4); R(c, '#222', 2, 1, 6, 1); R(c, '#c8453a', 4, 0, 3, 1); }
  if (D.hat === 2) { R(c, '#ff6fa5', 3, 0, 2, 2); R(c, '#ff6fa5', 6, 0, 2, 2); R(c, '#c8305f', 5, 1, 1, 1); }
  if (D.hat === 3) { R(c, '#f2c14e', 3, 0, 5, 2); R(c, '#f2c14e', 3, -1, 1, 1); R(c, '#f2c14e', 5, -1, 1, 1); R(c, '#f2c14e', 7, -1, 1, 1); }
  if (D.hat === 4) { R(c, '#4f7fd1', 3, 0, 5, 3); R(c, '#86aef0', 3, 2, 5, 1); R(c, '#fff', 5, -1, 1, 1); }
  c.restore();
}
export const DW = 18, DH = 22;
export function ensureDuck(scene: Phaser.Scene, D: DuckLook): string {
  const k = `duck_${D.color}_${D.hat}_${D.acc}`; if (scene.textures.exists(k)) return k;
  const cv = mk(DW * 2, DH); const c = cv.getContext('2d')!; drawDuck(c, 0, 0, D, 0); drawDuck(c, DW, 0, D, 1); outline(cv, DW, DH);
  const t = scene.textures.addCanvas(k, cv)!; t.add('0', 0, 0, 0, DW, DH); t.add('1', 0, DW, 0, DW, DH); return k;
}
export function duckPreview(D: DuckLook) { const cv = mk(DW, DH); drawDuck(cv.getContext('2d')!, 0, 0, D, 0); return outline(cv); }

// ---------- MOBİLYA ----------
const W1 = ['#d9a45f', '#b9803f', '#8a5a2b'], STEEL = ['#d6dde5', '#aab4c0', '#7d8794'];
function counterBase(c: Ctx, y0: number) { R(c, '#e6b97a', 0, y0, 16, 3); R(c, '#f3d29c', 0, y0, 16, 1); R(c, W1[1], 0, y0 + 3, 16, 11); R(c, W1[2], 0, y0 + 14, 16, 2); R(c, W1[2], 5, y0 + 4, 1, 9); R(c, W1[2], 10, y0 + 4, 1, 9); }
type Drawer = (c: Ctx, f: number) => void;
const FD: Record<string, { w: number; h: number; frames?: number; d: Drawer }> = {
  counter: { w: 16, h: 16, d: c => counterBase(c, 0) },
  register: { w: 16, h: 20, d: c => { counterBase(c, 4); R(c, '#3b4656', 3, 0, 10, 5); R(c, '#9fe3b0', 4, 1, 5, 2); R(c, '#d9a45f', 10, 2, 2, 2); R(c, '#6b7686', 2, 5, 12, 2); R(c, '#f2c14e', 12, 4, 2, 1); } },
  fridge: { w: 16, h: 24, d: c => { R(c, '#dfe8f0', 1, 0, 14, 24); R(c, '#f4f8fb', 2, 1, 2, 22); R(c, '#9fb0c2', 1, 10, 14, 1); R(c, '#7d8794', 12, 3, 1, 5); R(c, '#7d8794', 12, 13, 1, 6); R(c, '#c8453a', 6, 4, 3, 3); R(c, '#4f9bd9', 8, 15, 3, 3); R(c, '#aab4c0', 1, 22, 14, 2); } },
  shelf: { w: 16, h: 24, d: c => { R(c, W1[2], 0, 0, 16, 24); R(c, '#5c3a1e', 1, 1, 14, 22); R(c, W1[0], 1, 8, 14, 2); R(c, W1[0], 1, 16, 14, 2); R(c, W1[0], 1, 22, 14, 1);
    R(c, '#c8453a', 3, 4, 3, 4); R(c, '#6cc36b', 8, 4, 3, 4); R(c, '#f2c14e', 12, 5, 2, 3); R(c, '#f1ead8', 2, 11, 5, 5); R(c, '#4f9bd9', 9, 12, 4, 4); R(c, '#e85d75', 3, 19, 4, 3); R(c, '#9a5b2a', 9, 19, 5, 3); } },
  stove: { w: 16, h: 20, frames: 2, d: (c, f) => { R(c, '#4a4f5a', 0, 4, 16, 16); R(c, '#2f333b', 0, 4, 16, 6); R(c, '#16181d', 2, 5, 5, 3); R(c, '#16181d', 9, 5, 5, 3); R(c, '#3a3f48', 2, 12, 12, 6); R(c, '#d6dde5', 3, 10, 1, 1); R(c, '#d6dde5', 12, 10, 1, 1);
    R(c, '#8a8f99', 9, 1, 5, 4); R(c, '#aab4c0', 9, 1, 5, 1); if (f) { R(c, '#ffb02e', 3, 5, 3, 2); R(c, '#ff6b2e', 4, 6, 1, 1); R(c, '#ffe27a', 3, 3, 1, 1); R(c, '#fff', 10, 0, 1, 1); R(c, '#fff', 12, -0, 1, 1); } } },
  oven: { w: 16, h: 20, frames: 2, d: (c, f) => { R(c, STEEL[2], 0, 2, 16, 18); R(c, STEEL[1], 0, 2, 16, 4); R(c, '#2a2d33', 2, 8, 12, 9); R(c, STEEL[0], 2, 7, 12, 1); R(c, '#3a3f48', 3, 3, 1, 1); R(c, '#3a3f48', 6, 3, 1, 1); R(c, '#c8453a', 12, 3, 2, 1); if (f) { R(c, '#ff9a3c', 3, 9, 10, 7); R(c, '#ffd27a', 5, 11, 6, 3); } else R(c, '#4b5260', 3, 9, 3, 7); } },
  coffee: { w: 16, h: 24, frames: 2, d: (c, f) => { counterBase(c, 8); R(c, '#b93a32', 2, 3, 12, 11); R(c, '#8a2a24', 2, 3, 12, 2); R(c, STEEL[0], 4, 6, 8, 4); R(c, '#2a2d33', 5, 7, 6, 2); R(c, '#555', 7, 10, 2, 2); R(c, '#f6f1e7', 6, 12, 4, 3); R(c, f ? '#6dff7a' : '#555', 11, 4, 1, 1); if (f) { R(c, '#5a3520', 7, 12, 2, 1); R(c, '#5a3520', 7, 11, 1, 1); R(c, '#fff', 7, 1, 1, 1); R(c, '#fff', 8, 0, 1, 1); R(c, '#ddd', 6, 2, 1, 1); } } },
  prep: { w: 16, h: 20, frames: 2, d: (c, f) => { counterBase(c, 4); R(c, '#e9d3a4', 2, 4, 12, 3); R(c, '#d4453a', 4, 2, 3, 3); R(c, '#4a9a5a', 5, 1, 1, 1); if (f) { R(c, STEEL[0], 9, 0, 1, 4); R(c, '#6b4220', 9, 0, 1, 1); R(c, '#e85d5d', 7, 3, 2, 1); } else { R(c, STEEL[0], 9, 3, 4, 1); R(c, '#6b4220', 13, 3, 2, 1); } } },
  sink: { w: 16, h: 20, frames: 2, d: (c, f) => { R(c, STEEL[1], 0, 4, 16, 16); R(c, STEEL[0], 0, 4, 16, 2); R(c, '#6f93b8', 2, 6, 12, 5); R(c, '#9fd4ff', 3, 7, 6, 2); R(c, STEEL[2], 0, 17, 16, 3); R(c, STEEL[0], 7, 1, 2, 5); R(c, STEEL[0], 7, 1, 5, 1); R(c, STEEL[0], 11, 1, 1, 3); if (f) { R(c, '#9fd4ff', 11, 4, 1, 3); R(c, '#fff', 4, 7, 1, 1); R(c, '#fff', 7, 8, 1, 1); } } },
  table_wood: { w: 48, h: 16, d: c => tbl(c, '#d9a45f', '#b9803f') },
  table_cozy: { w: 48, h: 16, d: c => { tbl(c, '#f3e6c8', '#c8453a'); for (let x = 17; x < 31; x += 2) for (let y = 3; y < 11; y += 2) if (((x + y) >> 1) % 2) R(c, '#d85a4e', x, y, 2, 2); R(c, '#c8453a', 17, 11, 14, 2); R(c, '#f2c14e', 22, 5, 4, 3); R(c, '#d4453a', 23, 4, 2, 1); } },
  bookshelf: { w: 16, h: 28, d: c => { R(c, W1[2], 0, 0, 16, 28); R(c, '#5c3a1e', 1, 1, 14, 26); for (let s = 0; s < 3; s++) { const y = 2 + s * 9; R(c, W1[0], 1, y + 6, 14, 2); for (let i = 0; i < 6; i++) R(c, ['#c8453a', '#4f9bd9', '#6cc36b', '#f2b84b', '#9b6bd6', '#f4efe6'][(i + s * 2) % 6], 2 + i * 2, y + (i % 3 === 0 ? 1 : 0), 2, 6 - (i % 3 === 0 ? 1 : 0)); } } },
  lamp: { w: 16, h: 28, d: c => { R(c, '#f2d27a', 4, 0, 8, 7); R(c, '#fff0b0', 5, 1, 6, 2); R(c, '#555', 7, 7, 2, 18); R(c, '#444', 4, 25, 8, 3); } },
  rug: { w: 32, h: 16, d: c => { R(c, '#c8453a', 1, 2, 30, 12); R(c, '#f3e6c8', 3, 4, 26, 8); R(c, '#c8453a', 5, 6, 22, 4); R(c, '#f2c14e', 14, 7, 4, 2); } },
  rug2: { w: 32, h: 16, d: c => { R(c, '#3c6fb0', 3, 1, 26, 14); R(c, '#3c6fb0', 1, 3, 30, 10); R(c, '#f3e6c8', 4, 3, 24, 10); R(c, '#f3e6c8', 3, 4, 26, 8); R(c, '#86aef0', 7, 5, 18, 6); R(c, '#fff', 14, 7, 4, 2); } },
  plant_s: { w: 16, h: 20, d: c => { R(c, '#c8742c', 4, 12, 8, 8); R(c, '#a85a1c', 4, 12, 8, 2); R(c, '#4a9a5a', 5, 6, 3, 6); R(c, '#6cc36b', 8, 4, 3, 8); R(c, '#4a9a5a', 3, 8, 2, 3); R(c, '#6cc36b', 11, 8, 2, 3); } },
  plant_b: { w: 16, h: 30, d: c => { R(c, '#c8742c', 3, 21, 10, 9); R(c, '#a85a1c', 3, 21, 10, 2); R(c, '#3f8a4f', 7, 6, 2, 15); R(c, '#4a9a5a', 2, 8, 5, 3); R(c, '#6cc36b', 9, 4, 5, 3); R(c, '#4a9a5a', 3, 14, 4, 3); R(c, '#6cc36b', 9, 11, 5, 3); R(c, '#6cc36b', 6, 0, 4, 5); R(c, '#4a9a5a', 1, 5, 3, 3); } },
  flower: { w: 16, h: 20, d: c => { R(c, '#f6f1e7', 4, 12, 8, 8); R(c, '#d8cfb9', 4, 12, 8, 2); R(c, '#4a9a5a', 5, 8, 1, 4); R(c, '#4a9a5a', 10, 7, 1, 5); R(c, '#4a9a5a', 8, 9, 1, 3); R(c, '#ff8fb8', 4, 5, 3, 3); R(c, '#f2c14e', 5, 6, 1, 1); R(c, '#ffd23f', 9, 4, 3, 3); R(c, '#fff', 8, 7, 3, 2); } },
  paint_a: { w: 16, h: 16, d: c => { R(c, W1[2], 2, 2, 12, 12); R(c, '#8fd0ff', 3, 3, 10, 10); R(c, '#6cc36b', 3, 9, 10, 4); R(c, '#8a8f98', 5, 6, 4, 4); R(c, '#fff', 6, 5, 2, 1); R(c, '#ffd23f', 10, 4, 2, 2); } },
  paint_b: { w: 16, h: 16, d: c => { R(c, '#2f333b', 2, 2, 12, 12); R(c, '#f3e6c8', 3, 3, 10, 10); R(c, '#f6f1e7', 5, 7, 6, 4); R(c, '#5a3520', 5, 7, 6, 1); R(c, '#f6f1e7', 11, 8, 1, 2); R(c, '#aaa', 7, 4, 1, 2); R(c, '#aaa', 9, 4, 1, 2); } },
  window: { w: 16, h: 16, d: c => { R(c, '#f3e6c8', 1, 1, 14, 14); R(c, '#8fd0ff', 2, 2, 12, 12); R(c, '#f3e6c8', 7, 2, 2, 12); R(c, '#f3e6c8', 2, 7, 12, 2); R(c, '#fff', 3, 3, 3, 1); R(c, '#fff', 10, 10, 3, 1); } },
  clock: { w: 16, h: 16, d: c => { R(c, W1[2], 3, 3, 10, 10); R(c, '#f6f1e7', 4, 4, 8, 8); R(c, '#333', 8, 5, 1, 4); R(c, '#333', 8, 8, 3, 1); R(c, '#c8453a', 4, 8, 1, 1); } },
};
function tbl(c: Ctx, top: string, edge: string) {
  for (const [cx, flip] of [[0, 0], [32, 1]]) { // sandalyeler (arkalıklı)
    const bx = cx + (flip ? 12 : 1); R(c, W1[2], bx, 1, 3, 13); R(c, W1[1], bx + 1, 2, 1, 11);
    const sx = cx + (flip ? 3 : 4); R(c, W1[0], sx, 5, 9, 7); R(c, sh(W1[0], 18), sx, 5, 9, 1); R(c, '#c8453a', sx + 1, 6, 7, 4); R(c, '#e0675a', sx + 1, 6, 7, 1); R(c, W1[2], sx, 12, 9, 1);
    R(c, W1[2], sx + 1, 13, 1, 2); R(c, W1[2], sx + 7, 13, 1, 2);
  }
  R(c, edge, 15, 1, 18, 12); R(c, top, 16, 2, 16, 9); R(c, sh(top, 22), 16, 2, 16, 1); R(c, sh(top, -10), 18, 5, 10, 1); R(c, sh(top, -10), 20, 8, 9, 1);
  R(c, sh(edge, -30), 15, 12, 18, 1); R(c, W1[2], 17, 13, 2, 3); R(c, W1[2], 29, 13, 2, 3);
  R(c, '#f6f1e7', 21, 4, 6, 4); R(c, '#e6dccb', 21, 7, 6, 1); R(c, '#6cc36b', 23, 3, 2, 2); R(c, '#ff8fb8', 23, 2, 2, 1); // küçük vazo/peçete
}
export { hash };
export const fdesc = (k: string) => FD[k];
export function furnCanvas(k: string, frame = 0, r = 0): HTMLCanvasElement {
  const d = FD[k]; let cv = mk(d.w, d.h); d.d(cv.getContext('2d')!, frame); outline(cv);
  if (r && d.w !== d.h && CAT[k].w !== CAT[k].h) { const o = mk(d.h, d.w); const c = o.getContext('2d')!; c.translate(d.h, 0); c.rotate(Math.PI / 2); c.drawImage(cv, 0, 0); cv = o; }
  return cv;
}

// ---------- İKONLAR ----------
const IC: Record<string, Drawer> = {
  ekmek: c => { R(c, '#c98a4b', 2, 6, 12, 6); R(c, '#e0a566', 3, 4, 10, 3); R(c, '#a8692e', 5, 6, 1, 2); R(c, '#a8692e', 8, 6, 1, 2); R(c, '#a8692e', 11, 6, 1, 2); },
  un: c => { R(c, '#f1ead8', 4, 4, 8, 10); R(c, '#c98a4b', 5, 3, 6, 1); R(c, '#9a8f78', 6, 7, 4, 3); },
  peynir: c => { R(c, '#f4c542', 2, 6, 12, 6); R(c, '#fadb7a', 2, 6, 12, 1); R(c, '#d9a52a', 5, 8, 2, 2); R(c, '#d9a52a', 10, 9, 2, 2); },
  sut: c => { R(c, '#fff', 5, 3, 6, 11); R(c, '#4f9bd9', 5, 6, 6, 4); R(c, '#c8e0f5', 6, 4, 1, 9); },
  yumurta: c => { R(c, '#f7efe0', 5, 5, 6, 7); R(c, '#f7efe0', 6, 4, 4, 1); R(c, '#f7efe0', 6, 12, 4, 1); R(c, '#e3d6bd', 9, 7, 1, 4); },
  tereyagi: c => { R(c, '#f8e08a', 3, 6, 10, 5); R(c, '#fff', 3, 9, 10, 2); R(c, '#e8c85a', 3, 6, 10, 1); },
  domates: c => { R(c, '#d4453a', 3, 5, 10, 8); R(c, '#d4453a', 4, 4, 8, 1); R(c, '#e8685c', 4, 6, 2, 2); R(c, '#4a9a5a', 6, 2, 4, 3); },
  marul: c => { R(c, '#7bc96f', 3, 4, 10, 9); R(c, '#a5e08f', 5, 6, 4, 5); R(c, '#5aa850', 3, 11, 10, 2); },
  patates: c => { R(c, '#c9a15b', 3, 5, 10, 8); R(c, '#a8803f', 5, 7, 1, 1); R(c, '#a8803f', 9, 9, 1, 1); R(c, '#dbb878', 4, 5, 4, 1); },
  limon: c => { R(c, '#f5e050', 3, 5, 10, 7); R(c, '#f5e050', 2, 7, 1, 3); R(c, '#f5e050', 13, 7, 1, 3); R(c, '#fff6a0', 5, 6, 3, 1); },
  et: c => { R(c, '#c84a4a', 3, 5, 10, 7); R(c, '#f0b0b0', 5, 7, 4, 2); R(c, '#a83030', 3, 11, 10, 1); R(c, '#f6f1e7', 11, 4, 3, 2); },
  kahve: c => { R(c, '#6b4220', 4, 3, 8, 11); R(c, '#8a5a2b', 4, 3, 8, 2); R(c, '#f3e6c8', 6, 7, 4, 3); R(c, '#6b4220', 7, 8, 2, 1); },
  cay: c => { R(c, '#2f7a4a', 4, 3, 8, 11); R(c, '#4aa56a', 4, 3, 8, 2); R(c, '#f3e6c8', 6, 7, 4, 3); R(c, '#2f7a4a', 7, 8, 2, 1); },
  seker: c => { R(c, '#f6f6f6', 3, 7, 5, 5); R(c, '#e0e0e0', 3, 11, 5, 1); R(c, '#f6f6f6', 8, 8, 5, 5); R(c, '#e0e0e0', 8, 12, 5, 1); },
  kahveD: c => { R(c, '#cfd8e0', 2, 12, 12, 2); R(c, '#f6f1e7', 3, 6, 8, 6); R(c, '#f6f1e7', 11, 7, 2, 3); R(c, '#5a3520', 4, 6, 6, 2); R(c, '#fff', 6, 2, 1, 2); R(c, '#fff', 8, 3, 1, 2); },
  sutluD: c => { IC.kahveD(c, 0); R(c, '#e8d4b8', 4, 6, 6, 2); R(c, '#fff', 5, 7, 2, 1); },
  cayD: c => { R(c, '#cfd8e0', 2, 12, 12, 2); R(c, '#d8e8f0', 5, 4, 6, 8); R(c, '#b5482a', 5, 6, 6, 6); R(c, '#d8e8f0', 4, 4, 8, 1); R(c, '#fff', 7, 1, 1, 2); },
  limonataD: c => { R(c, '#e8f4f8', 5, 3, 6, 11); R(c, '#f5e050', 5, 5, 6, 9); R(c, '#fff6a0', 6, 6, 1, 6); R(c, '#c8453a', 9, 0, 1, 6); R(c, '#f5e050', 10, 3, 3, 3); },
  sandvicD: c => { R(c, '#f6f1e7', 1, 11, 14, 3); R(c, '#e0a566', 2, 5, 12, 3); R(c, '#7bc96f', 2, 8, 12, 1); R(c, '#d4453a', 2, 9, 12, 1); R(c, '#f4c542', 2, 10, 12, 1); R(c, '#e0a566', 2, 11, 12, 2); },
  patatesD: c => { R(c, '#d4453a', 3, 8, 10, 6); R(c, '#f5d442', 4, 3, 2, 6); R(c, '#f5d442', 7, 2, 2, 7); R(c, '#e8c030', 10, 4, 2, 5); R(c, '#fff', 5, 11, 6, 1); },
  burgerD: c => { R(c, '#e0a566', 2, 4, 12, 4); R(c, '#f6f1e7', 5, 5, 1, 1); R(c, '#7bc96f', 2, 8, 12, 1); R(c, '#f4c542', 2, 9, 12, 1); R(c, '#7a3a22', 2, 10, 12, 2); R(c, '#d4453a', 3, 12, 10, 1); R(c, '#c98a4b', 2, 13, 12, 2); },
  pizzaD: c => { R(c, '#e0a566', 2, 3, 12, 3); R(c, '#e0a566', 3, 6, 10, 3); R(c, '#e0a566', 5, 9, 6, 3); R(c, '#f4c542', 3, 4, 10, 3); R(c, '#f4c542', 5, 7, 6, 3); R(c, '#d4453a', 5, 5, 2, 2); R(c, '#d4453a', 9, 6, 2, 2); R(c, '#d4453a', 7, 9, 2, 2); R(c, '#e0a566', 7, 12, 2, 2); },
  kurabiyeD: c => { R(c, '#d9a45f', 3, 5, 10, 8); R(c, '#d9a45f', 4, 4, 8, 10); R(c, '#5a3520', 5, 6, 2, 2); R(c, '#5a3520', 9, 8, 2, 2); R(c, '#5a3520', 6, 10, 2, 2); },
  kekD: c => { R(c, '#f6f1e7', 1, 12, 14, 2); R(c, '#e8c88a', 3, 7, 10, 5); R(c, '#ff8fb8', 3, 5, 10, 3); R(c, '#fff', 4, 5, 3, 1); R(c, '#d4453a', 7, 2, 2, 3); R(c, '#4a9a5a', 8, 1, 1, 1); },
  pankekD: c => { R(c, '#f6f1e7', 1, 12, 14, 2); R(c, '#d9a45f', 3, 9, 10, 3); R(c, '#e8b878', 3, 6, 10, 3); R(c, '#d9a45f', 3, 3, 10, 3); R(c, '#8a4a1c', 4, 3, 8, 2); R(c, '#f8e08a', 7, 1, 3, 2); },
  coin: c => { R(c, '#c98a1c', 3, 2, 10, 12); R(c, '#c98a1c', 2, 4, 12, 8); R(c, '#f5c542', 4, 3, 8, 10); R(c, '#f5c542', 3, 5, 10, 6); R(c, '#fff0a0', 5, 4, 2, 2); R(c, '#c98a1c', 7, 5, 2, 6); R(c, '#c98a1c', 6, 6, 4, 1); R(c, '#c98a1c', 6, 8, 4, 1); },
  clock: c => { R(c, '#f6f1e7', 3, 2, 10, 12); R(c, '#f6f1e7', 2, 4, 12, 8); R(c, '#4f9bd9', 3, 2, 10, 1); R(c, '#333', 7, 4, 2, 5); R(c, '#333', 7, 8, 4, 1); R(c, '#c8453a', 3, 7, 1, 1); },
  star: c => { R(c, '#f5c542', 7, 1, 2, 3); R(c, '#f5c542', 2, 5, 12, 3); R(c, '#f5c542', 4, 8, 8, 2); R(c, '#f5c542', 3, 10, 4, 3); R(c, '#f5c542', 9, 10, 4, 3); R(c, '#f5c542', 6, 4, 4, 1); R(c, '#fff0a0', 6, 5, 2, 2); },
  user: c => { R(c, '#f0b9a0', 5, 2, 6, 6); R(c, '#5a3520', 5, 2, 6, 2); R(c, '#e85d75', 3, 9, 10, 5); R(c, '#f6f1e7', 7, 9, 2, 4); },
  bag: c => { R(c, '#a8692e', 2, 5, 12, 9); R(c, '#c98a4b', 3, 5, 10, 2); R(c, '#5a3520', 5, 2, 6, 1); R(c, '#5a3520', 5, 2, 1, 4); R(c, '#5a3520', 10, 2, 1, 4); R(c, '#f5c542', 7, 8, 2, 2); },
  brush: c => { R(c, '#8a5a2b', 9, 1, 3, 7); R(c, '#aab4c0', 7, 7, 5, 2); R(c, '#c8453a', 5, 9, 6, 3); R(c, '#c8453a', 3, 11, 6, 3); R(c, '#e8685c', 5, 10, 2, 1); },
  menu: c => { for (const y of [3, 7, 11]) { R(c, '#f6f1e7', 2, y, 12, 2); } },
  plate: c => { R(c, '#f6f1e7', 2, 8, 12, 5); R(c, '#dcd4c0', 3, 11, 10, 2); R(c, '#f6f1e7', 4, 7, 8, 1); },
};
const DISH_IC: Record<string, string> = { kahve: 'kahveD', sutlu: 'sutluD', cay: 'cayD', limonata: 'limonataD', sandvic: 'sandvicD', patates: 'patatesD', burger: 'burgerD', pizza: 'pizzaD', kurabiye: 'kurabiyeD', kek: 'kekD', pankek: 'pankekD' };
export function iconCanvas(id: string): HTMLCanvasElement { const cv = mk(16, 16); (IC[DISH_IC[id] ?? id] ?? IC.plate)(cv.getContext('2d')!, 0); return outline(cv); }
const urls = new Map<string, string>();
export function iconURL(id: string) { let u = urls.get(id); if (!u) { u = iconCanvas(id).toDataURL(); urls.set(id, u); } return u; }
export function furnURL(k: string) { const key = 'f:' + k; let u = urls.get(key); if (!u) { u = furnCanvas(k).toDataURL(); urls.set(key, u); } return u; }

// ---------- ZEMİN / DUVAR ----------
const hash = (a: number, b: number) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const FLOOR_VARIANTS = 4;
function noise(c: Ctx, seed: number, w: number, h: number, dark: string, light: string, n = 10) { for (let i = 0; i < n; i++) { const r = hash(seed, i); R(c, r < 0.5 ? dark : light, Math.floor(hash(i, seed) * w), Math.floor(hash(seed + 7, i * 3) * h)); } }
function floorTile(style: string, v: number): HTMLCanvasElement {
  const cv = mk(16, 16), c = cv.getContext('2d')!;
  if (style === 'wood') {
    const tones = ['#c99b63', '#cda26b', '#c4945c', '#c99f66'];
    for (let b = 0; b < 2; b++) {
      const y = b * 8, cut = 4 + Math.floor(hash(v, b) * 9);
      for (const [x0, x1, t] of [[0, cut, b + v], [cut, 16, b + v + 2]] as const) {
        const col = tones[t % tones.length]; R(c, col, x0, y, x1 - x0, 8); R(c, sh(col, 10), x0, y, x1 - x0, 1);
        if (x1 - x0 > 5) { R(c, sh(col, -10), x0 + 2, y + 3, x1 - x0 - 4, 1); R(c, sh(col, -7), x0 + 1 + (t % 3), y + 5, Math.max(1, x1 - x0 - 5), 1); }
      }
      R(c, '#9c7244', 0, y + 7, 16, 1); R(c, '#a97c4b', cut, y, 1, 7);
    }
  } else if (style === 'check') {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const dk = (x + y) % 2; const col = dk ? '#7e4f36' : '#efe2c4'; R(c, col, x * 8, y * 8, 8, 8); R(c, sh(col, 16), x * 8, y * 8, 8, 1); R(c, sh(col, 16), x * 8, y * 8, 1, 8); R(c, sh(col, -20), x * 8, y * 8 + 7, 8, 1); }
    noise(c, v + 30, 16, 16, 'rgba(0,0,0,.08)', 'rgba(255,255,255,.12)', 8);
  } else if (style === 'kitchen') {
    R(c, '#b9c2c9', 0, 0, 16, 16);
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { const col = hash(v * 4 + x, y) > 0.8 ? '#dfe7ec' : '#eef3f5'; R(c, col, x * 8, y * 8, 7, 7); R(c, '#ffffff', x * 8, y * 8, 6, 1); R(c, '#d3dce2', x * 8 + 6, y * 8 + 1, 1, 6); }
  } else {
    R(c, '#8f959e', 0, 0, 16, 16);
    for (const [x, y, w, h] of [[0, 0, 9, 7], [10, 0, 6, 7], [0, 8, 5, 8], [6, 8, 10, 8]]) { const col = ['#a7adb5', '#9ea4ac', '#b0b6bd', '#a2a8b0'][(x + y + v) % 4]; R(c, col, x, y, w, h); R(c, sh(col, 16), x, y, w, 1); R(c, sh(col, -16), x, y + h - 1, w, 1); }
    noise(c, v + 50, 16, 16, '#8a9099', '#c0c6cc', 6);
  }
  return cv;
}
const WALLS_DEF: Record<string, { paper: string; pat: string; panel: string; trim: string }> = {
  cream: { paper: '#f0dfbb', pat: '#e6cfa2', panel: '#a8743c', trim: '#7a4f28' },
  brick: { paper: '#b5573f', pat: '#7a3524', panel: '#6b3b26', trim: '#4a2418' },
  mint: { paper: '#cfe8d4', pat: '#b4d8bd', panel: '#5f9a70', trim: '#3f6e4d' },
};
function wallTile(style: string, part: 0 | 1): HTMLCanvasElement {
  const cv = mk(16, 16), c = cv.getContext('2d')!, w = WALLS_DEF[style] ?? WALLS_DEF.cream;
  const paper = (h: number) => {
    R(c, w.paper, 0, 0, 16, h);
    if (style === 'brick') { for (let y = 0; y < h; y += 4) { R(c, w.pat, 0, y + 3, 16, 1); const o = (y / 4) % 2 ? 0 : 8; R(c, w.pat, o + 3, y, 1, 3); R(c, w.pat, (o + 11) % 16, y, 1, 3); R(c, sh(w.paper, 14), o + 4, y, 3, 1); } }
    else for (let y = 1; y < h; y += 6) for (let x = (y % 12 ? 0 : 4); x < 16; x += 8) { R(c, w.pat, x + 2, y, 1, 3); R(c, w.pat, x + 1, y + 1, 3, 1); }
  };
  if (part === 0) { paper(16); R(c, w.trim, 0, 0, 16, 3); R(c, sh(w.trim, 30), 0, 3, 16, 1); R(c, 'rgba(0,0,0,.12)', 0, 4, 16, 2); }
  else {
    paper(5); R(c, w.trim, 0, 5, 16, 2); R(c, sh(w.trim, 40), 0, 5, 16, 1);
    R(c, w.panel, 0, 7, 16, 7); R(c, sh(w.panel, -22), 1, 8, 6, 5); R(c, sh(w.panel, -22), 9, 8, 6, 5); R(c, sh(w.panel, 14), 2, 9, 4, 3); R(c, sh(w.panel, 14), 10, 9, 4, 3);
    R(c, w.trim, 0, 14, 16, 2); R(c, sh(w.trim, -25), 0, 15, 16, 1);
  }
  return cv;
}
function wallTop(style: string): HTMLCanvasElement {
  const cv = mk(16, 16), c = cv.getContext('2d')!, w = WALLS_DEF[style] ?? WALLS_DEF.cream;
  R(c, sh(w.trim, -10), 0, 0, 16, 16); R(c, sh(w.trim, 18), 0, 0, 16, 2); for (let y = 4; y < 16; y += 5) R(c, sh(w.trim, -28), 0, y, 16, 1); R(c, sh(w.trim, -40), 0, 15, 16, 1); return cv;
}
export const floorPreview = (s: string) => floorTile(s, 0).toDataURL();
export const wallPreview = (s: string) => wallTile(s, 1).toDataURL();
function doorTile(part: number) {
  const cv = mk(16, 16), c = cv.getContext('2d')!; R(c, '#6b4220', 0, 0, 16, 16); R(c, '#8a5a2b', 0, 0, 16, 1);
  R(c, '#9fd2ea', part ? 1 : 3, 2, 12, 10); R(c, '#cdeefa', part ? 2 : 4, 3, 3, 1); R(c, '#e8f6fc', part ? 3 : 5, 4, 1, 6); R(c, '#e8f6fc', part ? 5 : 7, 4, 1, 3);
  R(c, '#f2c14e', part ? 1 : 14, 6, 1, 3); R(c, '#5a3520', 0, 13, 16, 3); R(c, '#c8453a', 2, 14, 12, 2); return cv;
}
function shadowTex(): HTMLCanvasElement { const cv = mk(16, 6), c = cv.getContext('2d')!; c.fillStyle = 'rgba(20,10,20,0.32)'; c.fillRect(3, 0, 10, 6); c.fillRect(1, 1, 14, 4); c.fillRect(0, 2, 16, 2); return cv; }
function wallShadow(): HTMLCanvasElement { const cv = mk(16, 8), c = cv.getContext('2d')!; for (let y = 0; y < 8; y++) { c.fillStyle = `rgba(30,15,25,${0.3 * (1 - y / 8)})`; c.fillRect(0, y, 16, 1); } return cv; }
function beam(): HTMLCanvasElement {
  const cv = mk(32, 48), c = cv.getContext('2d')!;
  for (let y = 0; y < 48; y++) { const a = 0.55 * (1 - y / 48); c.fillStyle = `rgba(255,236,180,${a})`; const sk = Math.floor(y * 0.33); c.fillRect(4 + sk, y, 12, 1); c.fillStyle = `rgba(255,236,180,${a * 0.5})`; c.fillRect(2 + sk, y, 16, 1); }
  return cv;
}

function glow(): HTMLCanvasElement {
  const cv = mk(64, 64), c = cv.getContext('2d')!; const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,225,150,0.85)'); g.addColorStop(0.5, 'rgba(255,200,110,0.3)'); g.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return cv;
}

export function buildTextures(scene: Phaser.Scene) {
  const tx = scene.textures;
  const add = (k: string, cv: HTMLCanvasElement) => { if (!tx.exists(k)) tx.addCanvas(k, cv); };
  for (const s of ['wood', 'check', 'stone', 'kitchen']) for (let v = 0; v < FLOOR_VARIANTS; v++) add(`fl_${s}_${v}`, floorTile(s, v));
  for (const s of ['cream', 'brick', 'mint']) { for (const p of [0, 1] as const) add(`wl_${s}_${p}`, wallTile(s, p)); add(`wt_${s}`, wallTop(s)); }
  add('door_0', doorTile(0)); add('door_1', doorTile(1)); add('glow', glow()); add('shadow', shadowTex()); add('wshadow', wallShadow()); add('beam', beam());
  for (const c of CATALOG) { const fr = FD[c.k].frames ?? 1; for (let r = 0; r < (c.w !== c.h ? 2 : 1); r++) for (let f = 0; f < fr; f++) add(`f_${c.k}_${r}_${f}`, furnCanvas(c.k, f, r)); }
  for (const i of INGS) add('i_' + i.id, iconCanvas(i.id));
  for (const r of RECIPES) add('i_' + r.id, iconCanvas(r.id));
  add('i_plate', iconCanvas('plate'));
  const h = mk(9, 8), c = h.getContext('2d')!; R(c, '#e8456b', 1, 0, 2, 1); R(c, '#e8456b', 5, 0, 2, 1); R(c, '#e8456b', 0, 1, 8, 3); R(c, '#e8456b', 1, 4, 6, 1); R(c, '#e8456b', 2, 5, 4, 1); R(c, '#e8456b', 3, 6, 2, 1); add('heart', outline(h));
}
