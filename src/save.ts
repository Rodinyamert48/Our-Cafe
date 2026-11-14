/** IndexedDB kayıt sistemi (veritabanı sunucusu yok; yalnızca tarayıcı deposu). */
import { World } from './types';
export interface SaveRec { slot: string; at: number; day: number; level: number; money: number; world: World }
const DB = 'ourcafe', ST = 'saves';
const open = () => new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: 'slot' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) => { const db = await open(); return new Promise<T>((res, rej) => { const r = f(db.transaction(ST, mode).objectStore(ST)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
const clean = (w: World): World => { const c = JSON.parse(JSON.stringify(w)) as World; c.stn = {}; c.cust = []; c.dirty = {}; c.report = null; c.paused = false; c.players.forEach(p => { p.hand = null; }); return c; };
export async function saveSlot(slot: string, w: World) {
  const rec: SaveRec = { slot, at: Date.now(), day: w.meta.day, level: w.meta.level, money: w.meta.money, world: clean(w) };
  await tx('readwrite', s => s.put(rec));
}
export const loadSlot = (slot: string) => tx<SaveRec | undefined>('readonly', s => s.get(slot));
export const delSlot = (slot: string) => tx('readwrite', s => s.delete(slot));
export const listSlots = async () => { try { return await tx<SaveRec[]>('readonly', s => s.getAll()); } catch { return []; } };
export const exportJSON = (rec: SaveRec) => JSON.stringify({ game: 'OUR CAFE', v: 1, at: rec.at, world: rec.world }, null, 1);
export function parseImport(text: string): World {
  const o = JSON.parse(text); const w = o?.world as World; if (o?.game !== 'OUR CAFE' || !w?.meta || !w.furn || !w.inv) throw new Error('Geçersiz kayıt dosyası');
  return w;
}
