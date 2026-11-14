import type { Session } from './session';
import type { CafeScene } from './scene';
export interface Ctl { move(): { x: number; y: number }; blocked(): boolean; deco: DecoState | null; setPrompt(s: string | null): void; openPicker(f: number): void; openManage(tab: string): void; toast(m: string): void; levelUp(l: number): void }
export interface DecoState { key?: string; id?: number; x: number; y: number; r: 0 | 1; sel?: number; valid: boolean }
export const app: { session: Session | null; scene: CafeScene | null; ui: Ctl | null } = { session: null, scene: null, ui: null };
