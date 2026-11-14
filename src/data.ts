export const T = 16;
export const ROWS = 13;
export const DOOR_X = 3;
export const DAY_START = 480, DAY_LAST_ORDER = 1140, DAY_END = 1200;
export const cols = (rooms: number) => 18 + 6 * (rooms - 1);

export interface Ing { id: string; name: string; cat: string; price: number }
export const INGS: Ing[] = [
  { id: 'ekmek', name: 'Ekmek', cat: 'Fırın', price: 3 }, { id: 'un', name: 'Un', cat: 'Fırın', price: 2 },
  { id: 'peynir', name: 'Peynir', cat: 'Süt Ürünleri', price: 4 }, { id: 'sut', name: 'Süt', cat: 'Süt Ürünleri', price: 3 },
  { id: 'yumurta', name: 'Yumurta', cat: 'Süt Ürünleri', price: 2 }, { id: 'tereyagi', name: 'Tereyağı', cat: 'Süt Ürünleri', price: 4 },
  { id: 'domates', name: 'Domates', cat: 'Sebze & Meyve', price: 2 }, { id: 'marul', name: 'Marul', cat: 'Sebze & Meyve', price: 2 },
  { id: 'patates', name: 'Patates', cat: 'Sebze & Meyve', price: 2 }, { id: 'limon', name: 'Limon', cat: 'Sebze & Meyve', price: 3 },
  { id: 'et', name: 'Et', cat: 'Et', price: 8 },
  { id: 'kahve', name: 'Kahve Çekirdeği', cat: 'İçecek & Kuru', price: 5 }, { id: 'cay', name: 'Çay', cat: 'İçecek & Kuru', price: 3 },
  { id: 'seker', name: 'Şeker', cat: 'İçecek & Kuru', price: 1 },
];
export const ING: Record<string, Ing> = Object.fromEntries(INGS.map(i => [i.id, i]));

export interface Recipe {
  id: string; name: string; price: number; need: Record<string, number>; steps: { st: string; t: number }[];
  lvl: number; cost: number; start?: boolean;
}
export const RECIPES: Recipe[] = [
  { id: 'kahve', name: 'Kahve', price: 12, need: { kahve: 1, seker: 1 }, steps: [{ st: 'coffee', t: 6 }], lvl: 1, cost: 0, start: true },
  { id: 'cay', name: 'Çay', price: 8, need: { cay: 1, seker: 1 }, steps: [{ st: 'coffee', t: 5 }], lvl: 1, cost: 0, start: true },
  { id: 'sandvic', name: 'Sandviç', price: 22, need: { ekmek: 1, peynir: 1, domates: 1, marul: 1 }, steps: [{ st: 'prep', t: 6 }], lvl: 1, cost: 0, start: true },
  { id: 'kurabiye', name: 'Kurabiye', price: 18, need: { un: 1, tereyagi: 1, seker: 1 }, steps: [{ st: 'prep', t: 4 }, { st: 'oven', t: 8 }], lvl: 1, cost: 0, start: true },
  { id: 'sutlu', name: 'Sütlü Kahve', price: 16, need: { kahve: 1, sut: 1 }, steps: [{ st: 'coffee', t: 7 }], lvl: 2, cost: 80 },
  { id: 'limonata', name: 'Limonata', price: 14, need: { limon: 2, seker: 1 }, steps: [{ st: 'prep', t: 5 }], lvl: 2, cost: 60 },
  { id: 'patates', name: 'Patates Kızartması', price: 16, need: { patates: 2 }, steps: [{ st: 'stove', t: 8 }], lvl: 3, cost: 120 },
  { id: 'pankek', name: 'Pankek', price: 26, need: { un: 1, yumurta: 1, sut: 1 }, steps: [{ st: 'prep', t: 4 }, { st: 'stove', t: 8 }], lvl: 3, cost: 150 },
  { id: 'burger', name: 'Hamburger', price: 38, need: { ekmek: 1, et: 1, marul: 1, domates: 1, peynir: 1 }, steps: [{ st: 'stove', t: 9 }, { st: 'prep', t: 4 }], lvl: 4, cost: 250 },
  { id: 'kek', name: 'Kek', price: 30, need: { un: 2, yumurta: 2, seker: 1, tereyagi: 1 }, steps: [{ st: 'prep', t: 5 }, { st: 'oven', t: 14 }], lvl: 5, cost: 300 },
  { id: 'pizza', name: 'Pizza', price: 55, need: { un: 2, peynir: 2, domates: 2 }, steps: [{ st: 'prep', t: 6 }, { st: 'oven', t: 12 }], lvl: 6, cost: 450 },
];
export const REC: Record<string, Recipe> = Object.fromEntries(RECIPES.map(r => [r.id, r]));

export interface Cat {
  k: string; name: string; cat: 'İstasyon' | 'Mobilya' | 'Bitki' | 'Duvar' | 'Dekor'; w: number; h: number; price: number;
  blocks: boolean; wall?: boolean; st?: string; seats?: boolean; oh: number; lvl?: number;
}
const C = (k: string, name: string, cat: Cat['cat'], w: number, h: number, price: number, o: Partial<Cat> = {}): Cat =>
  ({ k, name, cat, w, h, price, blocks: true, oh: 0, ...o });
export const CATALOG: Cat[] = [
  C('fridge', 'Buzdolabı', 'İstasyon', 1, 1, 200, { oh: 8, st: 'fridge' }), C('shelf', 'Malzeme Rafı', 'İstasyon', 1, 1, 120, { oh: 8, st: 'shelf' }),
  C('stove', 'Ocak', 'İstasyon', 1, 1, 180, { oh: 4, st: 'stove' }), C('oven', 'Fırın', 'İstasyon', 1, 1, 250, { oh: 4, st: 'oven' }),
  C('coffee', 'Kahve Makinesi', 'İstasyon', 1, 1, 220, { oh: 6, st: 'coffee' }), C('prep', 'Hazırlık Tezgâhı', 'İstasyon', 1, 1, 120, { oh: 4, st: 'prep' }),
  C('sink', 'Bulaşık Alanı', 'İstasyon', 1, 1, 90, { oh: 4, st: 'sink' }), C('register', 'Kasa', 'İstasyon', 1, 1, 150, { oh: 4, st: 'register' }),
  C('counter', 'Servis Tezgâhı', 'Mobilya', 1, 1, 20),
  C('table_wood', 'Ahşap Masa (2 kişilik)', 'Mobilya', 3, 1, 90, { seats: true }),
  C('table_cozy', 'Kareli Masa (2 kişilik)', 'Mobilya', 3, 1, 140, { seats: true, lvl: 2 }),
  C('bookshelf', 'Kitaplık', 'Mobilya', 1, 1, 90, { oh: 12 }), C('lamp', 'Boy Lambası', 'Mobilya', 1, 1, 45, { oh: 12 }),
  C('rug', 'Halı', 'Dekor', 2, 1, 40, { blocks: false }), C('rug2', 'Yuvarlak Halı', 'Dekor', 2, 1, 55, { blocks: false }),
  C('plant_s', 'Küçük Bitki', 'Bitki', 1, 1, 25, { oh: 4 }), C('plant_b', 'Büyük Bitki', 'Bitki', 1, 1, 60, { oh: 14 }),
  C('flower', 'Çiçek Saksısı', 'Bitki', 1, 1, 35, { oh: 4 }),
  C('paint_a', 'Manzara Tablosu', 'Duvar', 1, 1, 30, { wall: true, blocks: false }), C('paint_b', 'Kahve Tablosu', 'Duvar', 1, 1, 40, { wall: true, blocks: false }),
  C('window', 'Pencere', 'Duvar', 1, 1, 50, { wall: true, blocks: false }), C('clock', 'Duvar Saati', 'Duvar', 1, 1, 35, { wall: true, blocks: false }),
];
export const CAT: Record<string, Cat> = Object.fromEntries(CATALOG.map(c => [c.k, c]));

export const FLOORS = [{ id: 'wood', name: 'Ahşap Parke', price: 0 }, { id: 'check', name: 'Damalı Zemin', price: 120 }, { id: 'stone', name: 'Taş Zemin', price: 150 }];
export const WALLS = [{ id: 'cream', name: 'Krem Duvar', price: 0 }, { id: 'brick', name: 'Tuğla Duvar', price: 100 }, { id: 'mint', name: 'Nane Duvar', price: 100 }];
export const STATION_NAMES: Record<string, string> = { stove: 'Ocak', oven: 'Fırın', coffee: 'Kahve Makinesi', prep: 'Hazırlık Tezgâhı' };
export const EXPAND = [{ cost: 500, lvl: 3 }, { cost: 1200, lvl: 6 }];
export const xpFor = (lvl: number) => 50 * (lvl - 1) * (lvl - 1);
export const upCost = (cur: number) => 150 * cur;
export const MAXUP = 4;

export const initialFurn = () => {
  let id = 1; const f: { id: number; k: string; x: number; y: number; r: 0 | 1 }[] = [];
  const add = (k: string, x: number, y: number, r: 0 | 1 = 0) => f.push({ id: id++, k, x, y, r });
  add('fridge', 1, 2); add('shelf', 2, 2); add('stove', 4, 2); add('oven', 5, 2); add('coffee', 7, 2); add('prep', 9, 2); add('sink', 11, 2);
  for (let x = 1; x <= 14; x++) add(x === 12 ? 'register' : 'counter', x, 5);
  add('table_wood', 2, 8); add('table_wood', 7, 8); add('table_wood', 12, 8);
  add('plant_b', 1, 6); add('plant_s', 16, 3); add('paint_a', 3, 1); add('window', 8, 1); add('clock', 13, 1); add('lamp', 16, 6); add('rug', 8, 10);
  return f;
};
