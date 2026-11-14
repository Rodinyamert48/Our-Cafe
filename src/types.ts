export interface Look { skin: number; hair: number; hairC: number; shirt: number; shirtC: number; apron: number; hat: number; acc: number }
export interface Furn { id: number; k: string; x: number; y: number; r: 0 | 1 }
export type Hand = { k: 'dish'; r: string; s: number } | { k: 'plate' };
export interface Player { id: number; name: string; look: Look; hand: Hand | null; on: boolean }
export interface Stn { r: string; s: number; left: number; total: number; ready: boolean; by: number }
export type CState = 'in' | 'sit' | 'wait' | 'eat' | 'out';
export interface Cust {
  id: number; x: number; y: number; d: number; look: Look; st: CState; tbl: number; seat: number;
  r: string; pat: number; patMax: number; t: number; tip: number; mood: number; path?: [number, number][];
}
export interface DuckLook { color: number; hat: number; acc: number }
export interface Duck extends DuckLook { x: number; y: number; d: number; tx: number; ty: number; wait: number; heart: number }
export interface Stats { income: number; tips: number; spent: number; served: number; dishes: number; angry: number; sat: number[] }
export interface Meta {
  money: number; xp: number; level: number; day: number; tm: number; phase: 'open' | 'closing' | 'report';
  rooms: number; floor: string; wall: string; owned: string[]; recipes: string[]; up: Record<string, number>;
  total: number; nid: number; ver: number;
}
export interface Report { day: number; income: number; tips: number; spent: number; net: number; served: number; dishes: number; angry: number; sat: number }
export interface World {
  meta: Meta; inv: Record<string, number>; furn: Furn[]; stn: Record<number, Stn>; cust: Cust[];
  players: Player[]; duck: Duck; dirty: Record<number, number>; stats: Stats; report: Report | null; paused: boolean;
}
export type Act =
  | { a: 'start'; f: number; r: string } | { a: 'take'; f: number } | { a: 'put'; f: number }
  | { a: 'serve'; f: number } | { a: 'clean'; f: number } | { a: 'wash'; f: number } | { a: 'pet' } | { a: 'drop' }
  | { a: 'buy'; i: string; n: number } | { a: 'unlock'; r: string } | { a: 'upgrade'; k: string } | { a: 'expand' }
  | { a: 'place'; k: string; x: number; y: number; r: 0 | 1 } | { a: 'move'; id: number; x: number; y: number; r: 0 | 1 }
  | { a: 'sell'; id: number } | { a: 'style'; t: 'floor' | 'wall'; id: string }
  | { a: 'duck'; look: DuckLook } | { a: 'look'; name: string; look: Look }
  | { a: 'next' } | { a: 'pause'; v: boolean };
export type Evt = { e: 'sfx'; n: string } | { e: 'toast'; to: number; m: string } | { e: 'fx'; n: 'coin' | 'heart' | 'level'; x: number; y: number; v?: number };
/** Ağ protokolü */
export type Msg =
  | { t: 'hello'; name: string; look: Look }
  | { t: 'snap'; w: Partial<World> & { meta: Meta }; me?: number }
  | { t: 'a'; a: Act }
  | { t: 'pp'; id: number; x: number; y: number; d: number; m: number }
  | { t: 'ev'; ev: Evt }
  | { t: 'ping'; n: number };
