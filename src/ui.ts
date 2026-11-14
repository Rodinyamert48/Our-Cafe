import './style.css';
import { app, DecoState } from './app';
import { APRONC, DUCKC, HAIRC, OPT, SHIRTC, SKIN, charPreview, duckPreview, floorPreview, furnURL, iconURL, wallPreview } from './art';
import { audioCfg, initAudio, music, saveAudio, sfx } from './audio';
import { CAT, CATALOG, EXPAND, FLOORS, INGS, MAXUP, RECIPES, REC, STATION_NAMES, T, WALLS, upCost, xpFor, ING } from './data';
import { Peer, getStun } from './net';
import { SaveRec, delSlot, exportJSON, listSlots, loadSlot, parseImport, saveSlot } from './save';
import { Session } from './session';
import { defaultLook } from './sim';
import { fh, fw } from './layout';
import { Act, DuckLook, Evt, Look, World } from './types';

const root = document.getElementById('app')!;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let startGame: () => void = () => {}; let stopGame: () => void = () => {};
export const hooks = { set(s: () => void, e: () => void) { startGame = s; stopGame = e; } };
let sess: Session | null = null; let hudTimer = 0; let modal: HTMLElement | null = null; let modalKind = ''; let tab = 'market'; let deco: DecoState | null = null;
let myName = localStorage.getItem('oc_name') || ''; let myLook: Look | null = null; let reportOn = false;
const keys = new Set<string>(); let joy = { x: 0, y: 0 };
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0; if (isTouch) document.body.classList.add('touch');
const W = () => sess!.world;
const money = (n: number) => '₺' + Math.round(n);
const fmtT = (tm: number) => `${String(Math.floor(tm / 60)).padStart(2, '0')}:${String(Math.floor(tm % 60)).padStart(2, '0')}`;

function toast(m: string) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; root.appendChild(t); setTimeout(() => t.remove(), 2200); }
function closeModal() { modal?.remove(); modal = null; modalKind = ''; }
function openModal(kind: string, html: string, cls = '') { closeModal(); modal = document.createElement('div'); modal.className = 'screen ' + cls; modal.innerHTML = `<div class="panel">${html}</div>`; root.appendChild(modal); modalKind = kind; }
function copyText(t: string) { navigator.clipboard?.writeText(t).then(() => toast('Kopyalandı!'), () => fallbackCopy()); if (!navigator.clipboard) fallbackCopy(); function fallbackCopy() { const a = document.querySelector<HTMLTextAreaElement>('textarea[readonly]'); a?.select(); try { document.execCommand('copy'); toast('Kopyalandı!'); } catch { toast('Kodu elle seç ve kopyala'); } } }

// ================= ANA MENÜ =================
export function showMenu() {
  closeModal(); root.querySelectorAll('#menu,#hud,#joy,#ibtn,#banner,#decobar').forEach(e => e.remove()); music('off');
  const m = document.createElement('div'); m.id = 'menu'; m.className = 'screen';
  const items = ['plant_b', 'coffee', 'table_cozy', 'lamp', 'bookshelf'].map(k => `<img src="${furnURL(k)}" style="width:${CAT[k].w > 1 ? 96 : 48}px">`).join('');
  m.innerHTML = `<h1 class="logo">OUR CAFE<small>BİRLİKTE İŞLETİLEN KAFE</small></h1>
  <div class="menubtns">
   <button class="btn green" data-a="m-new">Yeni Oyun</button><button class="btn" data-a="m-host">Oda Oluştur</button><button class="btn blue" data-a="m-join">Odaya Katıl</button>
   <button class="btn gray" data-a="m-saves">Kayıtlar</button><button class="btn gray" data-a="m-settings">Ayarlar</button><button class="btn gray" data-a="m-about">Hakkında</button></div>
  <div class="deco-row">${items}<img src="${duckImg()}" style="width:54px"></div><div class="tip">Sunucu yok · Veriler cihazlar arasında doğrudan (P2P) aktarılır</div>`;
  root.appendChild(m);
}
const duckImg = () => duckPreview({ color: 0, hat: 0, acc: 0 }).toDataURL();

// ================= KARAKTER ÖZELLEŞTİRME =================
function showCustomize(title: string, then: (name: string, look: Look) => void) {
  const look: Look = myLook ? { ...myLook } : defaultLook(0); let name = myName;
  const rows: [string, keyof Look, string[]][] = [['Saç Modeli', 'hair', OPT.hair], ['Kıyafet', 'shirt', OPT.shirt], ['Önlük', 'apron', OPT.apron], ['Şapka', 'hat', OPT.hat], ['Aksesuar', 'acc', OPT.acc]];
  const sw = (k: keyof Look, cols: string[]) => `<div class="sw">${cols.map((c, i) => `<i data-a="cz-set" data-k="${k}" data-v="${i}" class="${look[k] === i ? 'on' : ''}" style="background:${c || '#ddd'}"></i>`).join('')}</div>`;
  const paint = () => {
    const o = document.getElementById('cz-opts')!, p = document.getElementById('cz-prev')!;
    o.innerHTML = `<div class="opt"><b>Ten</b>${sw('skin', SKIN)}</div><div class="opt"><b>Saç Rengi</b>${sw('hairC', HAIRC)}</div><div class="opt"><b>Kıyafet Rengi</b>${sw('shirtC', SHIRTC)}</div>` +
      rows.map(([t, k, a]) => `<div class="opt"><b>${t}</b><button class="btn sm" data-a="cz-step" data-k="${k}" data-d="-1">‹</button><span class="v">${a[look[k] % a.length]}</span><button class="btn sm" data-a="cz-step" data-k="${k}" data-d="1">›</button></div>`).join('');
    p.innerHTML = ''; for (const r of [0, 2]) { const c = charPreview(look, r, 0); c.className = 'px'; p.appendChild(c); }
  };
  openModal('custom', `<h2>${title}</h2><div class="custom"><div><div class="prev" id="cz-prev"></div><div class="row" style="margin-top:8px"><button class="btn sm" data-a="cz-rand">Rastgele</button></div></div>
   <div><div class="opt"><b>İsim</b><input type="text" id="cz-name" maxlength="14" placeholder="Adın" value="${esc(name)}"></div><div id="cz-opts"></div></div></div>
   <div class="row sp" style="margin-top:12px"><button class="btn gray" data-a="cz-back">Geri</button><button class="btn green" data-a="cz-ok">Devam ›</button></div>`);
  paint();
  (modal as any).cz = { look, rows, paint, then, getName: () => (document.getElementById('cz-name') as HTMLInputElement).value.trim() || 'Oyuncu' };
}

// ================= OYUN BAŞLATMA =================
async function beginHost(solo: boolean, world?: World) {
  initAudio(); sess = new Session('host'); const name = myName || 'Ev Sahibi'; sess.startHost(world, name, myLook ?? defaultLook(0), solo); wire(); enterGame();
  if (!solo) hostInvite();
}
function wire() {
  const s = sess!; app.session = s;
  s.onConn = c => { updateBanner(); if (c === 'connected') { toast(s.role === 'host' ? 'Misafir bağlandı!' : 'Bağlandın!'); sfx('bell'); if (modalKind === 'invite' || modalKind === 'join') closeModal(); } };
  s.onSaved = () => { const e = document.getElementById('h-save'); if (e) { e.style.opacity = '1'; setTimeout(() => (e.style.opacity = '0'), 1200); } };
  s.onEvt = (e: Evt) => { if (e.e === 'sfx') sfx(e.n); else if (e.e === 'toast' && e.to === s.me) toast(e.m); };
}
function enterGame() {
  root.querySelectorAll('#menu').forEach(e => e.remove());
  document.getElementById('game')!.style.display = 'block'; buildHud(); startGame(); music('cafe'); hudTimer = window.setInterval(tickHud, 220); updateBanner();
}
function leaveGame() {
  clearInterval(hudTimer); deco = null; reportOn = false; void sess?.save('auto'); sess?.disconnect(); sess = null; app.session = null; stopGame(); document.getElementById('game')!.style.display = 'none'; showMenu();
}

// ---- HOST davet ekranı ----
let hostPeer: Peer | null = null;
function hostInvite(again = false) {
  const s = sess!; openModal('invite', `<h2>Oda Oluştur — Sen HOST'sun</h2>
   <p style="margin:4px 0"><span class="status wait" id="i-st">Oda oluşturuluyor...</span></p>
   <div class="note"><b>1)</b> Aşağıdaki kodu kopyalayıp misafire mesajla gönder. <b>2)</b> Misafirin verdiği <b>cevap kodunu</b> alttaki kutuya yapıştır. <b>3)</b> Bağlan'a bas.<br>
   Not: Bağlantı doğrudan iki cihaz arasında kurulur. Bazı ağlarda (kurumsal Wi-Fi, bazı mobil operatörler) doğrudan P2P bağlantı kurulamayabilir; böyle olursa aynı Wi-Fi'ye geçmeyi veya STUN ayarını (Ayarlar) kontrol etmeyi dene.</div>
   <h3>Bağlantı kodu (HOST → GUEST)</h3><textarea id="i-code" readonly placeholder="Hazırlanıyor..."></textarea>
   <div class="row" style="margin:6px 0 10px"><button class="btn sm" data-a="i-copy">Kodu Kopyala</button></div>
   <h3>Misafirin cevap kodu (GUEST → HOST)</h3><textarea id="i-ans" placeholder="Misafirin gönderdiği kodu buraya yapıştır"></textarea>
   <div class="row sp" style="margin-top:8px"><button class="btn gray" data-a="i-close">${again ? 'Kapat' : 'Beklerken oyuna gir'}</button><button class="btn green" data-a="i-go">Bağlan</button></div>`);
  const st = (t: string, c = 'wait') => { const e = document.getElementById('i-st'); if (e) { e.textContent = t; e.className = 'status ' + c; } };
  hostPeer?.close(); const p = (hostPeer = new Peer()); s.attach(p);
  const base = p.onState; p.onState = x => { base(x); const m: Record<string, [string, string]> = { creating: ['Oda oluşturuluyor...', 'wait'], 'code-ready': ['Bağlantı kodu hazır · Diğer oyuncu bekleniyor', 'wait'], waiting: ['Bağlantı kuruluyor...', 'wait'], connecting: ['Bağlantı kuruluyor...', 'wait'], connected: ['Bağlandı', 'ok'], disconnected: ['Bağlantı kesildi', 'bad'] }; if (m[x]) st(m[x][0], m[x][1]); };
  p.createOffer().then(code => { const t = document.getElementById('i-code') as HTMLTextAreaElement | null; if (t) t.value = code; }).catch(() => st('Kod oluşturulamadı', 'bad'));
}
// ---- GUEST katılma ekranı ----
let guestPeer: Peer | null = null;
function guestJoin() {
  const s = sess!;
  openModal('join', `<h2>Odaya Katıl — Sen GUEST'sin</h2>
   <p style="margin:4px 0"><span class="status wait" id="j-st">Ev sahibinin kodunu bekliyorum</span></p>
   <div class="note"><b>1)</b> Ev sahibinin gönderdiği bağlantı kodunu yapıştır ve Bağlan'a bas. <b>2)</b> Çıkan <b>cevap kodunu</b> kopyalayıp ev sahibine gönder. <b>3)</b> Ev sahibi kodu girince otomatik bağlanırsın.<br>Doğrudan P2P bağlantı bazı ağlarda kurulamayabilir; mobil veriyle olmazsa Wi-Fi dene. Telefonu yatay tutmanı öneririz.</div>
   <h3>Bağlantı kodu (HOST'tan gelen)</h3><textarea id="j-code" placeholder="OC1.... ile başlayan kodu yapıştır"></textarea>
   <div class="row" style="margin:8px 0"><button class="btn sm gray" data-a="j-paste">Panodan Yapıştır</button><button class="btn green" data-a="j-go">Bağlan</button></div>
   <div id="j-out" style="display:none"><h3>Cevap kodu (GUEST → HOST)</h3><textarea id="j-ans" readonly></textarea><div class="row" style="margin-top:6px"><button class="btn sm" data-a="j-copy">Cevap Kodunu Kopyala</button></div></div>
   <div class="row" style="margin-top:10px"><button class="btn gray" data-a="j-back">İptal</button></div>`);
  void s;
}
async function doJoin() {
  const s = sess!, st = (t: string, c = 'wait') => { const e = document.getElementById('j-st'); if (e) { e.textContent = t; e.className = 'status ' + c; } };
  const code = (document.getElementById('j-code') as HTMLTextAreaElement).value; if (!code.trim()) return toast('Önce kodu yapıştır');
  try {
    st('Bağlantı kuruluyor...'); guestPeer?.close(); const p = (guestPeer = new Peer()); s.attach(p);
    const base = p.onState; p.onState = x => { base(x); if (x === 'connected') st('Bağlandı', 'ok'); else if (x === 'disconnected') st('Bağlantı kesildi', 'bad'); else if (x === 'connecting') st('Bağlantı kuruluyor...'); };
    const ans = await p.join(code); (document.getElementById('j-out') as HTMLElement).style.display = 'block'; (document.getElementById('j-ans') as HTMLTextAreaElement).value = ans; st('Cevap kodu hazır · Ev sahibi bekleniyor');
  } catch { st('Kod geçersiz ya da bağlantı kurulamadı', 'bad'); }
}
function waitGuestWorld() {
  const iv = setInterval(() => { if (!sess) return clearInterval(iv); if (sess.world && sess.conn === 'connected' && !document.getElementById('hud')) { clearInterval(iv); enterGame(); } }, 200);
}

// ================= HUD =================
function buildHud() {
  const h = document.createElement('div'); h.id = 'hud';
  h.innerHTML = `<div class="top"><div class="chip" id="h-money"></div><div class="chip" id="h-time"></div><div class="chip" id="h-lvl"></div><div class="chip" id="h-pl"></div>
   <div class="chip btnc" data-a="h-inv">Envanter</div><div class="chip btnc" data-a="h-deco">Dekor</div><div class="chip btnc" data-a="h-menu">☰ Menü</div><div class="chip" id="h-save" style="opacity:0">Kaydedildi</div></div>
   <div class="orders" id="orders"></div><div class="chip" id="hand" style="position:fixed;left:8px;top:92px;display:none"></div><div class="prompt" id="prompt"></div>`;
  root.appendChild(h);
  const joyEl = document.createElement('div'); joyEl.id = 'joy'; joyEl.innerHTML = '<i></i>'; root.appendChild(joyEl);
  const ib = document.createElement('button'); ib.id = 'ibtn'; ib.textContent = 'E'; root.appendChild(ib);
  ib.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); app.scene?.interact(); });
  const knob = joyEl.firstElementChild as HTMLElement; let pid = -1;
  const mv = (e: PointerEvent) => { const r = joyEl.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const l = Math.hypot(dx, dy), m = 46; if (l > m) { dx = dx / l * m; dy = dy / l * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; joy = { x: dx / m, y: dy / m }; if (Math.hypot(joy.x, joy.y) < 0.18) joy = { x: 0, y: 0 }; };
  joyEl.addEventListener('pointerdown', e => { pid = e.pointerId; joyEl.setPointerCapture(pid); initAudio(); mv(e); });
  joyEl.addEventListener('pointermove', e => { if (e.pointerId === pid) mv(e); });
  const up = (e: PointerEvent) => { if (e.pointerId === pid) { pid = -1; joy = { x: 0, y: 0 }; knob.style.transform = ''; } };
  joyEl.addEventListener('pointerup', up); joyEl.addEventListener('pointercancel', up);
  const b = document.createElement('div'); b.id = 'banner'; b.className = 'panel'; root.appendChild(b);
}
function tickHud() {
  const s = sess; if (!s?.world) return; const w = s.world, m = w.meta; const $ = (id: string) => document.getElementById(id);
  const set = (id: string, html: string) => { const e = $(id); if (e && e.dataset.h !== html) { e.dataset.h = html; e.innerHTML = html; } };
  set('h-money', `<img src="${iconURL('seker')}" width=0 style="display:none">₺ <b>${Math.floor(m.money)}</b>`);
  set('h-time', `Gün <b>${m.day}</b> · ${fmtT(m.tm)} ${m.phase === 'closing' ? '· Kapanıyor' : ''}${w.paused ? ' · ⏸' : ''}`);
  const lo = xpFor(m.level), hi = xpFor(m.level + 1); set('h-lvl', `Seviye <b>${m.level}</b><div class="xp"><i style="width:${Math.min(100, (m.xp - lo) / (hi - lo) * 100)}%"></i></div>`);
  set('h-pl', w.players.map(p => `<span style="opacity:${p.on ? 1 : .4}">${p.id === s.me ? '★' : '●'} ${esc(p.name)}</span>`).join(' '));
  const ords = w.cust.filter(c => c.st === 'wait').sort((a, b) => a.pat - b.pat).slice(0, 7); const tables = w.furn.filter(f => CAT[f.k].seats);
  set('orders', ords.map(c => { const f = c.pat / c.patMax; return `<div class="ord"><img src="${iconURL(c.r)}"><div style="flex:1"><div>Masa ${tables.findIndex(t => t.id === c.tbl) + 1}</div><div class="pb"><i style="width:${f * 100}%;background:${f > .5 ? '#6cc36b' : f > .25 ? '#f2b84b' : '#e85d5d'}"></i></div></div></div>`; }).join(''));
  const me = w.players.find(p => p.id === s.me), hd = $('hand')!;
  if (me?.hand) { const nm = me.hand.k === 'plate' ? 'Kirli tabak' : REC[me.hand.r].name + (me.hand.s < REC[me.hand.r].steps.length ? ' (yarım)' : ''); const html = `<img src="${iconURL(me.hand.k === 'plate' ? 'plate' : me.hand.r)}" width=24> ${nm} <button class="btn sm red" data-a="h-drop">At</button>`; hd.style.display = 'flex'; set('hand', html); } else hd.style.display = 'none';
  if (w.report && !reportOn) { reportOn = true; music('end'); showReport(); } else if (!w.report && reportOn) { reportOn = false; music('cafe'); if (modalKind === 'report') closeModal(); }
  if (['manage', 'picker'].includes(modalKind) && !document.querySelector('#modal-lock')) refreshModal();
  updateBanner();
}
function updateBanner() {
  const b = document.getElementById('banner'); const s = sess; if (!b || !s) return; let html = '';
  if (s.role === 'host') {
    if (s.conn === 'lost') html = `<span class="status bad">Bağlantı kesildi</span><button class="btn sm" data-a="b-pause">${s.world?.paused ? 'Oyunu Devam Ettir' : 'Oyunu Duraklat'}</button><button class="btn sm blue" data-a="b-reinvite">Yeniden Bağlan</button>`;
    else if (s.conn === 'waiting' && !document.getElementById('modal-lock') && modalKind !== 'invite') html = `<span class="status wait">Diğer oyuncu bekleniyor...</span><button class="btn sm" data-a="b-reinvite">Kodu Göster</button><button class="btn sm" data-a="b-pause">${s.world?.paused ? 'Başlat' : 'Duraklat'}</button>`;
    else if (s.conn === 'connecting') html = '<span class="status wait">Bağlantı kuruluyor...</span>';
  } else {
    if (s.conn === 'lost') html = `<span class="status bad">Bağlantı kesildi</span><button class="btn sm blue" data-a="b-rejoin">Yeniden Bağlan</button><button class="btn sm gray" data-a="b-leave">Çık</button>`;
    else if (s.conn === 'connecting' && s.world) html = '<span class="status wait">Yeniden bağlanılıyor...</span>';
    else if (s.world?.paused) html = '<span class="status wait">Ev sahibi oyunu duraklattı</span>';
  }
  b.style.display = html ? 'flex' : 'none'; if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
}

// ================= PANELLER =================
function statsHead() { const w = W(), s = w.stats; return `<div class="row sp" style="font-size:13px;margin-bottom:6px"><span>Para: <b>${money(w.meta.money)}</b></span><span>Bugün: gelir ${money(s.income)} · bahşiş ${money(s.tips)} · harcama ${money(s.spent)}</span><span>Net: <b>${money(s.income + s.tips - s.spent)}</b></span></div>`; }
function manageHtml(): string {
  const w = W(), m = w.meta; const tabs: [string, string][] = [['market', 'Envanter & Market'], ['recipes', 'Tarifler'], ['upgrade', 'Geliştir'], ['duck', 'Mertoş'], ['save', 'Kayıt'], ['conn', 'Bağlantı'], ['settings', 'Ayarlar']];
  let body = '';
  if (tab === 'market') {
    const cats = [...new Set(INGS.map(i => i.cat))];
    body = cats.map(c => `<h3>${c}</h3><div class="grid">${INGS.filter(i => i.cat === c).map(i => `<div class="card"><div class="r"><img src="${iconURL(i.id)}"><div><b>${i.name}</b><br>Stok: <b class="${(w.inv[i.id] || 0) < 3 ? 'bad' : ''}">${w.inv[i.id] || 0}</b></div></div>
      <div class="row"><button class="btn sm" data-a="buy" data-i="${i.id}" data-n="5">+5 ${money(i.price * 5)}</button><button class="btn sm" data-a="buy" data-i="${i.id}" data-n="10">+10 ${money(i.price * 10)}</button></div></div>`).join('')}</div>`).join('');
  } else if (tab === 'recipes') {
    body = `<div class="grid">${RECIPES.map(r => { const own = m.recipes.includes(r.id); return `<div class="card ${own ? '' : 'lock'}"><div class="r"><img src="${iconURL(r.id)}"><div><b>${r.name}</b><br>Satış: ${money(r.price)} · ${r.steps.reduce((a, s) => a + s.t, 0)}sn</div></div>
      <div class="need">${Object.entries(r.need).map(([k, n]) => `<span class="${(w.inv[k] || 0) < n ? 'bad' : ''}">${ING[k].name} ×${n}</span>`).join('')}</div><div class="need">${r.steps.map(s => `<span>${s.st === 'prep' ? 'Hazırlık' : STATION_NAMES[s.st]}</span>`).join(' → ')}</div>
      ${own ? '<span class="good">Açık ✔</span>' : `<button class="btn sm green" data-a="unlock" data-r="${r.id}">Aç ${money(r.cost)} · Sv.${r.lvl}</button>`}</div>`; }).join('')}</div>`;
  } else if (tab === 'upgrade') {
    const eq = Object.keys(m.up);
    body = `<h3>Ekipman Yükseltme (hazırlama süresi %15 kısalır)</h3><div class="grid">${eq.map(k => `<div class="card"><div class="r"><img src="${furnURL(k)}" style="object-fit:contain"><div><b>${STATION_NAMES[k]}</b><br>Seviye ${m.up[k]}/${MAXUP}</div></div>${m.up[k] >= MAXUP ? '<span class="good">Maksimum</span>' : `<button class="btn sm green" data-a="upgrade" data-k="${k}">Yükselt ${money(upCost(m.up[k]))}</button>`}</div>`).join('')}</div>
    <h3 style="margin-top:12px">Kafe Genişletme</h3><div class="card">${m.rooms - 1 >= EXPAND.length ? '<span class="good">Tüm odalar açık ✔</span>' : `<div>Yeni oda (${m.rooms}. → ${m.rooms + 1}. bölüm): kafe sağa doğru genişler.</div><button class="btn sm green" data-a="expand">Aç ${money(EXPAND[m.rooms - 1].cost)} · Sv.${EXPAND[m.rooms - 1].lvl}</button>`}</div>
    <p class="note">Yeni masa, sandalye, ocak, fırın ve süs eşyaları için üstteki <b>Dekor</b> düğmesini kullan.</p>`;
  } else if (tab === 'duck') {
    const d = w.duck; const sw = DUCKC.map((c, i) => `<i data-a="duck" data-k="color" data-v="${i}" class="${d.color === i ? 'on' : ''}" style="background:${c}"></i>`).join('');
    body = `<h3>Mertoş'u Özelleştir</h3><div class="custom"><div class="prev"><img src="${duckPreview(d).toDataURL()}" style="width:96px"></div><div>
     <div class="opt"><b>Renk</b><div class="sw">${sw}</div></div>
     <div class="opt"><b>Şapka</b><button class="btn sm" data-a="duck" data-k="hat" data-d="-1">‹</button><span class="v">${OPT.dhat[d.hat]}</span><button class="btn sm" data-a="duck" data-k="hat" data-d="1">›</button></div>
     <div class="opt"><b>Aksesuar</b><button class="btn sm" data-a="duck" data-k="acc" data-d="-1">‹</button><span class="v">${OPT.dacc[d.acc]}</span><button class="btn sm" data-a="duck" data-k="acc" data-d="1">›</button></div>
     <p class="note">Mertoş kasanın yanında dolaşır. Yanına gidip <b>E</b> tuşuna basarak onu sevebilirsin.</p></div></div>`;
  } else if (tab === 'save') {
    body = sess!.role === 'host' ? `<p class="note">Kayıtlar <b>HOST'un tarayıcısında</b> (IndexedDB) tutulur. Tarayıcı verisi silinirse kayıt da silinir; bu yüzden JSON yedeği al!</p><div id="saves"></div>` : '<p class="note">Kayıtlar ev sahibinin tarayıcısında tutulur. Senin yaptığın işlemler HOST\'a iletilir ve orada kaydedilir.</p>';
  } else if (tab === 'conn') {
    const s = sess!;
    body = s.role === 'host' ? `<p>Durum: <span class="status ${s.conn === 'connected' ? 'ok' : s.conn === 'lost' ? 'bad' : 'wait'}">${{ solo: 'Tek oyuncu', waiting: 'Diğer oyuncu bekleniyor', connecting: 'Bağlantı kuruluyor', connected: 'Bağlandı', lost: 'Bağlantı kesildi' }[s.conn]}</span></p>
      <div class="row"><button class="btn blue" data-a="b-reinvite">${s.conn === 'connected' ? 'Yeni Davet Kodu' : 'Misafir Davet Et'}</button><button class="btn" data-a="b-pause">${W().paused ? 'Oyunu Devam Ettir' : 'Oyunu Duraklat'}</button></div>`
      : `<p>Durum: <span class="status ${s.conn === 'connected' ? 'ok' : 'bad'}">${s.conn === 'connected' ? 'Bağlandı' : 'Bağlantı kesildi'}</span></p>${s.conn !== 'connected' ? '<button class="btn blue" data-a="b-rejoin">Yeniden Bağlan</button>' : ''}`;
  } else {
    body = settingsHtml() + `<div class="row" style="margin-top:12px"><button class="btn red" data-a="quit">Ana Menüye Dön</button></div>`;
  }
  return `<div class="row sp"><h2>Yönetim</h2><button class="btn sm red" data-a="x">Kapat ✕</button></div>${statsHead()}<div class="tabs">${tabs.map(([k, n]) => `<button class="btn ${tab === k ? 'on' : ''}" data-a="tab" data-k="${k}">${n}</button>`).join('')}</div><div id="tabbody">${body}</div>`;
}
function openManage(t?: string) { if (t) tab = t; openModal('manage', manageHtml()); if (tab === 'save') void renderSaves('saves'); }
function refreshModal() {
  if (!modal) return; const p = modal.querySelector('.panel')!; const sc = p.scrollTop;
  if (modalKind === 'manage') { if (tab === 'settings' || tab === 'save') return; p.innerHTML = manageHtml(); } else if (modalKind === 'picker') p.innerHTML = pickerHtml(pickerFor);
  p.scrollTop = sc;
}
let pickerFor = 0;
function pickerHtml(fid: number) {
  const w = W(), f = w.furn.find(x => x.id === fid); if (!f) return '<p>?</p>'; const st = CAT[f.k].st!;
  const list = RECIPES.filter(r => w.meta.recipes.includes(r.id) && r.steps[0].st === st);
  return `<div class="row sp"><h2>${CAT[f.k].name}: Ne hazırlayalım?</h2><button class="btn sm red" data-a="x">Kapat ✕</button></div><div class="grid">${list.map(r => { const ok = Object.entries(r.need).every(([k, n]) => (w.inv[k] || 0) >= n);
    return `<div class="card"><div class="r"><img src="${iconURL(r.id)}"><div><b>${r.name}</b><br>${money(r.price)}</div></div><div class="need">${Object.entries(r.need).map(([k, n]) => `<span class="${(w.inv[k] || 0) < n ? 'bad' : ''}">${ING[k].name} ${w.inv[k] || 0}/${n}</span>`).join('')}</div>
    <div class="need">${r.steps.map((s, i) => `<span ${i === 0 ? 'style="background:#ffe08a"' : ''}>${s.st === 'prep' ? 'Hazırlık' : STATION_NAMES[s.st]}</span>`).join(' → ')}</div><button class="btn sm ${ok ? 'green' : 'gray'}" data-a="start" data-r="${r.id}">${ok ? 'Hazırla' : 'Malzeme yok'}</button></div>`; }).join('') || '<p>Bu istasyon için açık tarif yok.</p>'}</div>`;
}
function settingsHtml() {
  return `<h3>Ses</h3><label class="chk"><input type="checkbox" data-a="aud" data-k="mOn" ${audioCfg.mOn ? 'checked' : ''}> Müzik açık</label><input type="range" min="0" max="1" step="0.05" value="${audioCfg.music}" data-a="aud" data-k="music">
  <label class="chk"><input type="checkbox" data-a="aud" data-k="sOn" ${audioCfg.sOn ? 'checked' : ''}> Ses efektleri açık</label><input type="range" min="0" max="1" step="0.05" value="${audioCfg.sfx}" data-a="aud" data-k="sfx">
  <h3 style="margin-top:12px">Ağ (STUN)</h3><input type="text" id="stun" value="${esc(getStun())}" placeholder="stun:stun.l.google.com:19302"><div class="note">STUN yalnızca bağlantı kurulurken ağ adresini keşfetmek için kullanılır; oyun verisi taşımaz. Boş bırakırsan yalnızca yerel ağ (aynı Wi-Fi) adayları kullanılır. Virgülle birden fazla adres yazabilirsin. TURN/relay kullanılmaz.</div>
  <button class="btn sm green" data-a="stun-save">STUN'u Kaydet</button>`;
}
async function renderSaves(id: string) {
  const el = document.getElementById(id); if (!el) return; const recs = await listSlots(); const by = new Map(recs.map(r => [r.slot, r]));
  const ingame = !!sess; const names: Record<string, string> = { auto: 'Otomatik Kayıt', s1: 'Kayıt 1', s2: 'Kayıt 2', s3: 'Kayıt 3' };
  el.innerHTML = Object.keys(names).map(k => { const r = by.get(k); return `<div class="slot"><div><b>${names[k]}</b><br><small>${r ? `Gün ${r.day} · Seviye ${r.level} · ₺${Math.floor(r.money)} · ${new Date(r.at).toLocaleString('tr-TR')}` : 'Boş'}</small></div>
    <div class="row">${ingame && k !== 'auto' ? `<button class="btn sm green" data-a="sv-save" data-s="${k}">Kaydet</button>` : ''}${!ingame && r ? `<button class="btn sm green" data-a="sv-load" data-s="${k}">Yükle</button>` : ''}${r ? `<button class="btn sm" data-a="sv-exp" data-s="${k}">JSON Dışa Aktar</button><button class="btn sm red" data-a="sv-del" data-s="${k}">Sil</button>` : ''}</div></div>`; }).join('') +
    `<div class="row" style="margin-top:8px">${ingame ? '<button class="btn sm green" data-a="sv-expnow">Şu anki oyunu JSON olarak indir</button>' : ''}<button class="btn sm blue" data-a="sv-imp">JSON İçe Aktar</button><input type="file" id="sv-file" accept=".json,application/json" style="display:none"></div>`;
  (document.getElementById('sv-file') as HTMLInputElement).onchange = async e => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try { const w = parseImport(await f.text()); const free = ['s1', 's2', 's3'].find(k => !by.has(k)) ?? 's3'; await saveSlot(free, w); toast(`İçe aktarıldı → ${names[free]}`); void renderSaves(id); } catch { toast('Geçersiz kayıt dosyası'); }
  };
}
function download(name: string, text: string) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function showReport() {
  const r = W().report!, host = sess!.role === 'host'; openModal('report', `<h2>Gün ${r.day} Sonu Raporu</h2><table class="rep">
   <tr><td>Toplam gelir</td><td>${money(r.income)}</td></tr><tr><td>Servis edilen müşteri</td><td>${r.served}</td></tr><tr><td>Satılan yemek</td><td>${r.dishes}</td></tr><tr><td>Toplam bahşiş</td><td>${money(r.tips)}</td></tr>
   <tr><td>Harcamalar</td><td>${money(r.spent)}</td></tr><tr><td>Sabrı taşan müşteri</td><td>${r.angry}</td></tr><tr><td><b>Net kâr</b></td><td class="${r.net >= 0 ? 'good' : 'bad'}">${money(r.net)}</td></tr>
   <tr><td>Müşteri memnuniyeti</td><td>%${Math.round(r.sat * 100)}</td></tr></table><div class="bar" style="margin:8px 0"><i style="width:${r.sat * 100}%"></i></div>
   ${host ? '<div class="row sp"><button class="btn gray" data-a="r-shop">Market / Yönetim</button><button class="btn green" data-a="r-next">Sonraki Gün ›</button></div>' : '<p>Ev sahibinin yeni güne başlaması bekleniyor... Bu arada market ve dekor kullanabilirsin.</p><button class="btn gray" data-a="r-shop">Market / Yönetim</button>'}`, 'rep');
}

// ================= DEKOR MODU =================
let decoCat = 'Mobilya';
function openDeco() {
  const p = (app.scene as any); deco = { x: Math.floor((p?.px ?? 100) / T), y: Math.floor((p?.py ?? 60) / T) + 1, r: 0, valid: false }; closeModal(); renderDeco();
}
function renderDeco() {
  let bar = document.getElementById('decobar'); if (!bar) { bar = document.createElement('div'); bar.id = 'decobar'; root.appendChild(bar); } bar.style.display = 'block'; const w = W(); const d = deco!;
  const cats = ['Mobilya', 'İstasyon', 'Bitki', 'Dekor', 'Duvar', 'Zemin', 'Duvar Rengi'];
  let items = '';
  if (decoCat === 'Zemin') items = FLOORS.map(f => `<div class="card" data-a="d-style" data-t="floor" data-id="${f.id}"><img src="${floorPreview(f.id)}"><b>${f.name}</b><span>${w.meta.owned.includes(f.id) ? (w.meta.floor === f.id ? 'Seçili' : 'Sahipsin') : money(f.price)}</span></div>`).join('');
  else if (decoCat === 'Duvar Rengi') items = WALLS.map(f => `<div class="card" data-a="d-style" data-t="wall" data-id="${f.id}"><img src="${wallPreview(f.id)}"><b>${f.name}</b><span>${w.meta.owned.includes(f.id) ? (w.meta.wall === f.id ? 'Seçili' : 'Sahipsin') : money(f.price)}</span></div>`).join('');
  else items = CATALOG.filter(c => c.cat === decoCat).map(c => `<div class="card ${deco?.key === c.k ? 'sel' : ''}" data-a="d-pick" data-k="${c.k}"><img src="${furnURL(c.k)}"><b>${c.name}</b><span>${money(c.price)}${c.lvl && w.meta.level < c.lvl ? ` · Sv.${c.lvl}` : ''}</span></div>`).join('');
  const ghost = d.key || d.id !== undefined; const selF = d.sel ? w.furn.find(f => f.id === d.sel) : null;
  const act = ghost ? `<button class="btn green" data-a="d-ok">✔ Yerleştir</button><button class="btn" data-a="d-rot">⟳ Döndür</button><button class="btn gray" data-a="d-cancel">İptal</button>`
    : selF ? `<span><b>${CAT[selF.k].name}</b></span><button class="btn blue sm" data-a="d-move">Taşı</button><button class="btn sm" data-a="d-rotsel">⟳ Döndür</button><button class="btn sm red" data-a="d-sell">Sat (${money(CAT[selF.k].price * .5)})</button>` : '<span class="tip" style="color:#5a4a3a">Yerleştirmek için bir eşya seç · taşımak için sahnede bir eşyaya dokun</span>';
  bar.innerHTML = `<div class="row sp" style="margin-bottom:6px"><div class="tabs" style="margin:0">${cats.map(c => `<button class="btn ${decoCat === c ? 'on' : ''}" data-a="d-cat" data-k="${c}">${c}</button>`).join('')}</div><button class="btn red sm" data-a="d-exit">Dekoru Bitir ✕</button></div>
  <div class="row" style="margin-bottom:6px">${act}<span style="margin-left:auto;font-weight:700">${money(w.meta.money)}</span></div><div class="items">${items}</div>`;
  (window as any).__decoSel = () => renderDeco();
  (window as any).__decoConfirm = () => decoConfirm();
}
function decoConfirm() {
  const d = deco; if (!d) return; const s = sess!;
  if (d.key) s.act({ a: 'place', k: d.key, x: d.x, y: d.y, r: d.r }); else if (d.id !== undefined) s.act({ a: 'move', id: d.id, x: d.x, y: d.y, r: d.r });
  if (d.valid) { const keep = d.key; d.id = undefined; d.sel = undefined; if (!keep) d.key = undefined; setTimeout(renderDeco, 150); }
}
function closeDeco() { deco = null; document.getElementById('decobar')?.remove(); }

// ================= OLAYLAR =================
root.addEventListener('click', async e => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]'); if (!el) return; const a = el.dataset.a!, d = el.dataset; if (el instanceof HTMLInputElement && el.type !== 'checkbox') return; initAudio(); if (el.tagName !== 'INPUT') sfx('click');
  const s = sess, act = (x: Act) => s?.act(x);
  switch (a) {
    case 'm-new': myLook = null; showCustomize('Karakterini Oluştur', (n, l) => { myName = n; myLook = l; localStorage.setItem('oc_name', n); closeModal(); void beginHost(true); }); break;
    case 'm-host': {
      const auto = await loadSlot('auto').catch(() => undefined); const go = (w?: World) => { const p = w?.players.find(p => p.id === 0); if (p) { myName = p.name; myLook = p.look; closeModal(); void beginHost(false, w); } else showCustomize('Karakterini Oluştur (HOST)', (n, l) => { myName = n; myLook = l; localStorage.setItem('oc_name', n); closeModal(); void beginHost(false, w); }); };
      if (auto && confirm(`Kayıtlı oyun bulundu (Gün ${auto.day}, Seviye ${auto.level}).\nTamam = Kayıttan devam et\nİptal = Yeni oyun`)) go(auto.world); else go(); break;
    }
    case 'm-join': showCustomize('Karakterini Oluştur (GUEST)', (n, l) => { myName = n; myLook = l; localStorage.setItem('oc_name', n); sess = new Session('guest'); sess.startGuest(n, l); wire(); guestJoin(); waitGuestWorld(); }); break;
    case 'm-saves': openModal('saves', `<div class="row sp"><h2>Kayıtlar</h2><button class="btn sm red" data-a="x">Kapat ✕</button></div><p class="note">Kayıtlar bu tarayıcıda (IndexedDB) tutulur. Tarayıcı verisini silersen kaybolur — JSON yedeği al.</p><div id="msaves"></div>`); void renderSaves('msaves'); break;
    case 'm-settings': openModal('settings', `<div class="row sp"><h2>Ayarlar</h2><button class="btn sm red" data-a="x">Kapat ✕</button></div>${settingsHtml()}`); break;
    case 'm-about': openModal('about', `<div class="row sp"><h2>Hakkında</h2><button class="btn sm red" data-a="x">Kapat ✕</button></div><p><b>OUR CAFE</b> — iki kişilik, sunucusuz P2P pixel art kafe simülasyonu.</p>
      <p><b>Nasıl oynanır:</b> Bilgisayar: WASD/ok tuşları hareket, E etkileşim, ESC menü. Telefon: sol joystick + sağdaki E düğmesi.<br>Siparişe göre istasyonda (kahve makinesi, ocak, fırın, hazırlık tezgâhı) tarif seç, hazır olunca al, gerekirse sonraki istasyona götür, sonra masaya servis et. Kirli tabakları sink'e götür. Gün sonunda rapor çıkar; kazandığın parayla market, tarif, ekipman ve dekorasyon al.</p>
      <p><b>Çok oyunculu:</b> Ev sahibi "Oda Oluştur" der, kodu misafire yollar; misafir "Odaya Katıl" ile cevap kodu üretir. Oyun dünyası HOST'ta tutulur, kayıtlar HOST'un tarayıcısındadır.</p><p style="font-size:12px">Tüm grafikler ve sesler kodla üretilmiştir; harici asset yoktur (bkz. ASSETS-LICENSES.md).</p>`); break;
    case 'x': if (modalKind === 'report') return; closeModal(); break;
    case 'cz-set': { const c = (modal as any).cz; c.look[d.k!] = +d.v!; c.paint(); break; }
    case 'cz-step': { const c = (modal as any).cz; const arr = c.rows.find((r: any) => r[1] === d.k)[2]; c.look[d.k!] = (c.look[d.k!] + +d.d! + arr.length) % arr.length; c.paint(); break; }
    case 'cz-rand': { const c = (modal as any).cz; const R = (n: number) => Math.floor(Math.random() * n); Object.assign(c.look, { skin: R(6), hair: R(6), hairC: R(8), shirt: R(3), shirtC: R(8), apron: R(5), hat: R(5), acc: R(4) }); c.paint(); break; }
    case 'cz-ok': { const c = (modal as any).cz; c.then(c.getName(), c.look); break; }
    case 'cz-back': closeModal(); break;
    case 'i-copy': copyText((document.getElementById('i-code') as HTMLTextAreaElement).value); break;
    case 'i-go': { const v = (document.getElementById('i-ans') as HTMLTextAreaElement).value; if (!v.trim()) return toast('Önce misafirin cevap kodunu yapıştır'); try { await hostPeer!.acceptAnswer(v); } catch { toast('Cevap kodu geçersiz'); } break; }
    case 'i-close': closeModal(); break;
    case 'j-paste': try { (document.getElementById('j-code') as HTMLTextAreaElement).value = await navigator.clipboard.readText(); } catch { toast('Panoya erişilemedi, elle yapıştır'); } break;
    case 'j-go': void doJoin(); break;
    case 'j-copy': copyText((document.getElementById('j-ans') as HTMLTextAreaElement).value); break;
    case 'j-back': guestPeer?.close(); sess?.disconnect(); sess = null; app.session = null; closeModal(); showMenu(); break;
    case 'h-inv': openManage('market'); break;
    case 'h-menu': openManage(); break;
    case 'h-deco': openDeco(); break;
    case 'h-drop': act({ a: 'drop' }); break;
    case 'tab': tab = d.k!; openManage(); break;
    case 'buy': act({ a: 'buy', i: d.i!, n: +d.n! }); setTimeout(refreshModal, 80); break;
    case 'unlock': act({ a: 'unlock', r: d.r! }); break;
    case 'upgrade': act({ a: 'upgrade', k: d.k! }); break;
    case 'expand': act({ a: 'expand' }); break;
    case 'start': act({ a: 'start', f: pickerFor, r: d.r! }); closeModal(); break;
    case 'duck': { const dk = W().duck; const l: DuckLook = { color: dk.color, hat: dk.hat, acc: dk.acc }; if (d.k === 'color') l.color = +d.v!; else { const n = d.k === 'hat' ? OPT.dhat.length : OPT.dacc.length; (l as any)[d.k!] = ((l as any)[d.k!] + +d.d! + n) % n; } act({ a: 'duck', look: l }); setTimeout(() => { if (modalKind === 'manage') openManage(); }, 120); break; }
    case 'b-pause': act({ a: 'pause', v: !W().paused }); setTimeout(() => { updateBanner(); if (modalKind === 'manage') openManage(); }, 100); break;
    case 'b-reinvite': closeModal(); hostInvite(true); break;
    case 'b-rejoin': guestJoin(); break;
    case 'b-leave': case 'quit': leaveGame(); break;
    case 'r-next': act({ a: 'next' }); closeModal(); break;
    case 'r-shop': { const k = modalKind; void k; reportOn = true; openManage('market'); break; }
    case 'stun-save': localStorage.setItem('oc_stun', (document.getElementById('stun') as HTMLInputElement).value.trim()); toast('STUN kaydedildi'); break;
    case 'sv-save': await s!.save(d.s!); toast('Kaydedildi'); void renderSaves('saves'); break;
    case 'sv-load': { const r = await loadSlot(d.s!); if (r) { myName = r.world.players.find(p => p.id === 0)?.name ?? 'Ev Sahibi'; myLook = r.world.players.find(p => p.id === 0)?.look ?? defaultLook(0); closeModal(); void beginHost(true, r.world); } break; }
    case 'sv-del': if (confirm('Bu kayıt silinsin mi?')) { await delSlot(d.s!); void renderSaves(sess ? 'saves' : 'msaves'); } break;
    case 'sv-exp': { const r = await loadSlot(d.s!); if (r) download(`ourcafe-gun${r.day}-${d.s}.json`, exportJSON(r)); break; }
    case 'sv-expnow': { const w = JSON.parse(JSON.stringify(W())) as World; w.stn = {}; w.cust = []; w.dirty = {}; w.report = null; w.players.forEach(p => (p.hand = null)); download(`ourcafe-gun${w.meta.day}.json`, exportJSON({ slot: 'x', at: Date.now(), day: w.meta.day, level: w.meta.level, money: w.meta.money, world: w } as SaveRec)); break; }
    case 'sv-imp': document.getElementById('sv-file')?.click(); break;
    case 'd-cat': decoCat = d.k!; renderDeco(); break;
    case 'd-pick': { deco!.key = d.k; deco!.id = undefined; deco!.sel = undefined; deco!.r = 0; renderDeco(); break; }
    case 'd-style': act({ a: 'style', t: d.t as 'floor' | 'wall', id: d.id! }); setTimeout(renderDeco, 150); break;
    case 'd-ok': decoConfirm(); break;
    case 'd-rot': deco!.r = (deco!.r ^ 1) as 0 | 1; break;
    case 'd-cancel': deco!.key = undefined; deco!.id = undefined; renderDeco(); break;
    case 'd-move': { const f = W().furn.find(f => f.id === deco!.sel); if (f) { Object.assign(deco!, { id: f.id, key: undefined, x: f.x, y: f.y, r: f.r }); renderDeco(); } break; }
    case 'd-rotsel': { const f = W().furn.find(f => f.id === deco!.sel); if (f) act({ a: 'move', id: f.id, x: f.x, y: f.y, r: (f.r ^ 1) as 0 | 1 }); setTimeout(renderDeco, 150); break; }
    case 'd-sell': if (deco!.sel) { act({ a: 'sell', id: deco!.sel }); deco!.sel = undefined; setTimeout(renderDeco, 150); } break;
    case 'd-exit': closeDeco(); break;
  }
});
root.addEventListener('input', e => {
  const el = e.target as HTMLInputElement; if (el.dataset.a !== 'aud') return; const k = el.dataset.k as 'music' | 'sfx' | 'mOn' | 'sOn';
  if (el.type === 'checkbox') (audioCfg as any)[k] = el.checked; else (audioCfg as any)[k] = +el.value; saveAudio(); if (el.type === 'checkbox' && k === 'sOn' && el.checked) sfx('coin');
});
window.addEventListener('keydown', e => {
  if ((e.target as HTMLElement)?.matches?.('input,textarea')) return; const k = e.key.toLowerCase(); keys.add(k);
  if (!sess) return;
  if (k === 'e' || k === ' ') { e.preventDefault(); app.scene?.interact(); }
  if (k === 'escape') { if (deco) closeDeco(); else if (modal && modalKind !== 'report') closeModal(); else openManage(); }
  if (k === 'i') openManage('market'); if (k === 'b' && !modal) openDeco();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

app.ui = {
  move() { const x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0), y = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0); return x || y ? { x, y } : joy; },
  blocked: () => !!modal, get deco() { return deco; },
  setPrompt(t) { const p = document.getElementById('prompt'); if (p) { p.style.display = t ? 'block' : 'none'; p.textContent = t ? `${isTouch ? 'E düğmesi' : 'E'}: ${t}` : ''; } },
  openPicker(f) { pickerFor = f; openModal('picker', pickerHtml(f)); }, openManage, toast, levelUp(l) { toast(`Seviye atladın! Seviye ${l}`); },
};
export const modalLock = () => !!modal;
