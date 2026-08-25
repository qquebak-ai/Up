/* ================= NEON FORGE — логика демо-кузницы ================= */
'use strict';

const HOUSE_EDGE = 0.92;          // возврат по шансу
const MAX_CHANCE = 0.92;
const MIN_CHANCE = 0.01;
const START_BALANCE = 10000;      // 100.00 (цены хранятся в центах)
const STORE_KEY = 'neonforge.demo.v3';

const PHASES = [
  { id: 'scanning',    ms: 800,  state: 'проверка' },
  { id: 'calculating', ms: 800,  state: 'расчёт' },
  { id: 'forging',     ms: 1500, state: 'запуск' },
  { id: 'resonance',   ms: 1000, state: 'финиш' },
];
const SPIN_MS = PHASES[2].ms + PHASES[3].ms;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const on = (sel, ev, fn) => { const el = $(sel); if (el) el.addEventListener(ev, fn); };
const byId = id => ITEMS.find(i => i.id === id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const money = cents => '$' + (cents / 100).toLocaleString('en-US',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- состояние ---------- */
let state = { balance: START_BALANCE, inv: [], uid: 1, xp: 0,
  stats: { runs: 0, wins: 0, bestId: null },
  sel: { from: null, to: null, pct: null } };
let sel = state.sel;
let running = false;
let modalMode = 'from';

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (p && typeof p.balance === 'number' && Array.isArray(p.inv)) {
      const keep = p.sel && typeof p.sel === 'object' ? p.sel : {};
      const st = p.stats && typeof p.stats === 'object' ? p.stats : {};
      state = {
        balance: p.balance,
        inv: p.inv.filter(x => byId(x.id)),
        uid: p.uid || 1,
        xp: p.xp || 0,
        stats: { runs: st.runs || 0, wins: st.wins || 0, bestId: byId(st.bestId) ? st.bestId : null },
        sel: { from: keep.from ?? null, to: byId(keep.to) ? keep.to : null, pct: keep.pct ?? null },
      };
      sel = state.sel;
      if (!state.inv.some(x => x.uid === sel.from)) sel.from = null;
      return;
    }
  } catch (e) { /* повреждённые данные — стартуем заново */ }
  state.inv = STARTER_INVENTORY.map(id => ({ uid: state.uid++, id }));
}
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} };

/* ---------- уведомления ---------- */
function toast(text, kind = '') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  box.append(el);
  setTimeout(() => {
    el.style.cssText = 'transition:opacity .3s,transform .3s;opacity:0;transform:translateX(24px)';
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ---------- разметка предметов ---------- */
function cardHTML(item, { action = '', uid = null } = {}) {
  const r = RARITY[item.rarity];
  return `
  <article class="card" style="--rc:${r.color}" data-id="${item.id}" ${uid ? `data-uid="${uid}"` : ''}>
    <span class="card__edge"></span>
    <span class="card__scan"></span>
    <span class="tag card__rar">${r.name}</span>
    ${itemArt(item)}
    <div class="card__n">${item.name}</div>
    <div class="card__meta"><em>${item.skin}</em>${item.wear ? `<span class="wear">${item.wear}</span>` : ''}</div>
    <div class="card__inspect"><span>Осмотреть</span><span>${item.type}</span></div>
    <div class="card__foot">
      <span class="card__p">${money(item.price)}</span>
      ${action ? `<button class="card__act" data-act="${action}">${action === 'buy' ? 'Купить' : 'Продать'}</button>` : ''}
    </div>
  </article>`;
}

function unitHTML(item) {
  return `
  <div class="unit">
    ${itemArt(item)}
    <div class="unit__n">${item.name}</div>
    <div class="unit__s">${item.skin}${item.wear ? ` <span class="wear">${item.wear}</span>` : ''}</div>
    <div class="unit__p">${money(item.price)}</div>
  </div>`;
}

const emptyBay = side => `
  <button class="bay__pick" data-open="${side}">
    <i>+</i>${side === 'from' ? 'Выбрать предмет' : 'Выбрать цель'}
  </button>`;

/* ---------- баланс и уровень кузницы ---------- */
function renderBalance() {
  const el = $('#balance');
  if (!el) return;
  el.textContent = money(state.balance);
  const box = el.closest('.bal');
  box.classList.remove('is-bump'); void box.offsetWidth; box.classList.add('is-bump');
}

const xpAt = l => 2 * (l - 1) * l;              // сколько опыта нужно на уровень l
function levelInfo(xp) {
  let l = 1;
  while (xp >= xpAt(l + 1)) l++;
  const base = xpAt(l), next = xpAt(l + 1);
  return { level: l, into: xp - base, need: next - base };
}
function renderLevel() {
  if (!$('#lvl-num')) return;
  const { level, into, need } = levelInfo(state.xp);
  $('#lvl-num').textContent = level;
  $('#lvl-xp').textContent = `${into}/${need}`;
  $('#lvl-fill').style.width = `${Math.round(into / need * 100)}%`;
  // ядро наливается светом по мере роста уровня
  const core = $('#core');
  if (core) core.style.setProperty('--lvl', Math.min(1, level / 30).toFixed(2));
}

/* ---------- профиль ---------- */
function renderProfile() {
  if (!$('#pf-level')) return;
  const { level, into, need } = levelInfo(state.xp);
  const { runs, wins, bestId } = state.stats;
  const best = byId(bestId);
  const value = state.inv.reduce((s, x) => s + byId(x.id).price, 0);

  $('#pf-level').textContent = level;
  $('#pf-xp').textContent = `${into}/${need} XP`;
  $('#pf-fill').style.width = `${Math.round(into / need * 100)}%`;
  $('#pf-runs').textContent = runs;
  $('#pf-wins').textContent = wins;
  $('#pf-rate').textContent = runs ? `${Math.round(wins / runs * 100)}%` : '—';
  $('#pf-best').textContent = best ? `${best.name} | ${best.skin}` : 'нет данных';
  $('#pf-best-p').textContent = best ? money(best.price) : '—';
  $('#pf-balance').textContent = money(state.balance);
  $('#pf-items').textContent = state.inv.length;
  $('#pf-value').textContent = money(value);

  // реактор наливается светом по мере роста уровня
  const reactor = $('#pf-reactor');
  if (reactor) {
    const seg = Math.min(12, Math.max(1, Math.round(level / 30 * 12) || 1));
    reactor.innerHTML = Array.from({ length: 12 },
      (_, i) => `<i class="${i < seg ? 'on' : ''}"></i>`).join('');
  }
}

/* ---------- инвентарь и витрины ---------- */
function renderInv() {
  const grid = $('#inv-grid');
  if (!grid) return;
  grid.innerHTML = state.inv.length
    ? state.inv.map(x => cardHTML(byId(x.id), { action: 'sell', uid: x.uid })).join('')
    : '<div class="empty">Инвентарь пуст — купите предмет в маркете</div>';
  $('#inv-count').textContent = state.inv.length;
  $('#inv-sum').textContent = money(state.inv.reduce((s, x) => s + byId(x.id).price, 0));
}

function renderPopular() {
  const grid = $('#popular');
  if (!grid) return;
  grid.innerHTML = [...ITEMS].sort((a, b) => b.price - a.price).slice(0, 8)
    .map(i => cardHTML(i, { action: 'buy' })).join('');
}

/* ---------- ядро: шанс ---------- */
const ARC_R = 88;
const ARC_C = 2 * Math.PI * ARC_R;

const fromItem = () => { const r = state.inv.find(x => x.uid === sel.from); return r ? byId(r.id) : null; };
const toItem = () => (sel.to ? byId(sel.to) : null);

function chance() {
  const f = fromItem(), t = toItem();
  if (!f || !t || t.price <= 0) return 0;
  if (t.price <= f.price) return MAX_CHANCE;
  return Math.min(MAX_CHANCE, Math.max(MIN_CHANCE, (f.price / t.price) * HOUSE_EDGE));
}

function renderCoreTicks() {
  const g = $('#core-ticks');
  if (!g) return;
  const out = [];
  for (let a = 0; a < 360; a += 6) {
    const major = a % 45 === 0;
    const rad = a * Math.PI / 180;
    const p = (r, fn) => (130 + fn(rad) * r).toFixed(1);
    out.push(`<line class="core__tick${major ? ' major' : ''}" stroke-width="${major ? 1.8 : 1}"` +
      ` x1="${p(major ? 100 : 103, Math.cos)}" y1="${p(major ? 100 : 103, Math.sin)}"` +
      ` x2="${p(108, Math.cos)}" y2="${p(108, Math.sin)}"/>`);
  }
  g.innerHTML = out.join('');
}

function renderForge() {
  if (!$('#from-body')) return;
  const f = fromItem(), t = toItem();

  $('#from-body').innerHTML = f ? unitHTML(f) : emptyBay('from');
  $('#to-body').innerHTML = t ? unitHTML(t) : emptyBay('to');
  $('#bay-from').classList.toggle('is-set', !!f);
  $('#bay-to').classList.toggle('is-set', !!t);

  const c = chance();
  $('#chance').innerHTML = `${(c * 100).toFixed(1)}<i>%</i>`;
  $('#chance-scale').style.width = `${(c * 100).toFixed(1)}%`;
  $('#core-arc').style.strokeDasharray = `${(c * ARC_C).toFixed(2)} ${ARC_C.toFixed(2)}`;

  $('#meta-in').textContent = f ? money(f.price) : '—';
  $('#meta-out').textContent = t ? money(t.price) : '—';

  const btn = $('#forge-btn');
  btn.disabled = !(f && t) || running;
  $('#forge-sub').textContent = running ? 'Идёт прокачка…'
    : !f ? 'Выберите предмет'
    : !t ? 'Выберите цель'
    : `×${(t.price / f.price).toFixed(2)} · ${money(f.price)} → ${money(t.price)}`;

  $$('#presets button').forEach(b =>
    b.classList.toggle('is-on', !!t && sel.pct === Number(b.dataset.c)));
}

function renderPresets() {
  const box = $('#presets');
  if (!box) return;
  box.innerHTML = CHANCES.map(c => `<button data-c="${c}"><b>${c}%</b><span>шанс</span></button>`).join('');
}

/* подобрать цель под желаемый шанс */
function applyPreset(pct) {
  const f = fromItem();
  if (!f) { toast('Сначала выберите свой предмет', 'err'); return; }
  const want = pct / 100;
  const err = i => Math.abs(Math.min(MAX_CHANCE, f.price * HOUSE_EDGE / i.price) - want);
  const best = ITEMS.filter(i => i.price > f.price)
    .reduce((a, b) => (!a || err(b) < err(a) ? b : a), null);
  if (!best) { toast('Дороже этого предмета в каталоге ничего нет', 'err'); return; }
  sel.to = best.id;
  sel.pct = pct;
  save();
  renderForge();
  const real = Math.round(chance() * 100);
  if (Math.abs(real - pct) > 5) toast(`Ближайшая цель даёт ${real}% вместо ${pct}%`);
}

/* ---------- частицы вокруг ядра ---------- */
function coreParticles() {
  const cv = $('#core-canvas');
  if (!cv || calm()) return { run() {}, burst() {}, calm() {} };
  const ctx = cv.getContext('2d');
  let w = 0, h = 0, mode = 'idle', until = 0;
  const parts = Array.from({ length: 64 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 34 + Math.random() * 78,
    sp: (0.0016 + Math.random() * 0.004) * (Math.random() < 0.5 ? -1 : 1),
    sz: 0.5 + Math.random() * 1.5,
    al: 0.15 + Math.random() * 0.5,
    lime: Math.random() < 0.22,
  }));

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const frame = () => {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, k = Math.min(w, h) / 260;
    const boost = mode === 'run' ? 4.2 : 1;
    const bursting = mode === 'burst' && performance.now() < until;
    for (const p of parts) {
      p.a += p.sp * boost;
      if (bursting) p.r += 1.6;
      else if (p.r > 112) p.r = 34 + Math.random() * 20;
      const x = cx + Math.cos(p.a) * p.r * k;
      const y = cy + Math.sin(p.a) * p.r * k;
      ctx.globalAlpha = bursting ? Math.max(0, p.al * (1 - (p.r - 34) / 120)) : p.al * (mode === 'run' ? 1.4 : 1);
      ctx.fillStyle = p.lime ? '#B8FF3D' : '#20E6FF';
      ctx.beginPath();
      ctx.arc(x, y, p.sz * (mode === 'run' ? 1.3 : 1), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return {
    run() { mode = 'run'; },
    calm() { mode = 'idle'; },
    burst() { mode = 'burst'; until = performance.now() + 900; setTimeout(() => { mode = 'idle'; parts.forEach(p => { p.r = 34 + Math.random() * 78; }); }, 950); },
  };
}
let particles = { run() {}, burst() {}, calm() {} };

/* ---------- запуск ядра ---------- */
function forge() {
  const f = fromItem(), t = toItem();
  if (!f || !t || running) return;

  running = true;
  const core = $('#core');
  core.classList.remove('is-win', 'is-fail');
  core.classList.add('is-run');
  particles.run();
  renderForge();

  const c = chance();
  const win = Math.random() < c;
  const zone = c * 360;
  const angle = win ? rnd(4, Math.max(5, zone - 4)) : rnd(zone + 4, 356);

  let t0 = 0;
  PHASES.forEach(ph => {
    setTimeout(() => {
      $('#core-state').textContent = ph.state;
      if (ph.id === 'forging') {
        const m = $('#core-marker');
        m.style.transition = 'none';
        m.style.transform = 'rotate(0deg)';
        void m.getBoundingClientRect();
        m.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.13,.71,.16,1)`;
        m.style.transform = `rotate(${360 * 5 + angle}deg)`;
      }
    }, t0);
    t0 += ph.ms;
  });

  setTimeout(() => settle(win, f, t, core), t0);
}

function settle(win, f, t, core) {
  state.inv = state.inv.filter(x => x.uid !== sel.from);      // ставка списывается всегда
  let wonUid = null;
  if (win) { wonUid = state.uid++; state.inv.push({ uid: wonUid, id: t.id }); }
  state.xp += win ? 3 : 1;
  state.stats.runs++;
  if (win) {
    state.stats.wins++;
    const best = byId(state.stats.bestId);
    if (!best || t.price > best.price) state.stats.bestId = t.id;
  }
  save();

  core.classList.remove('is-run');
  core.classList.add(win ? 'is-win' : 'is-fail');
  $('#core-state').textContent = win ? 'успех' : 'мимо';
  win ? particles.burst() : particles.calm();

  pushRecent({ who: 'Вы', from: f, to: t, win });
  showResult(win, win ? t : f, wonUid);

  sel.from = null;
  running = false;
  renderBalance(); renderLevel(); renderInv(); renderProfile(); renderForge();
}

/* ---------- окно результата ---------- */
let pendingWin = null;

function showResult(win, item, uid) {
  pendingWin = win ? uid : null;
  const box = $('#result');
  box.className = `result ${win ? 'win' : 'fail'}`;
  $('#result-st').textContent = win ? 'Прокачка удалась' : 'Не в этот раз';
  $('#result-title').textContent = win ? `${item.name} | ${item.skin}` : 'Предмет сгорел';
  $('#result-card').innerHTML = unitHTML(item);
  $('#result-sell').hidden = !win;
  $('#result-keep').textContent = win ? 'В инвентарь' : 'Продолжить';
  box.hidden = false;
}

function closeResult(sell) {
  if (sell && pendingWin !== null) {
    const rec = state.inv.find(x => x.uid === pendingWin);
    if (rec) {
      const item = byId(rec.id);
      state.inv = state.inv.filter(x => x.uid !== pendingWin);
      state.balance += item.price;
      save(); renderBalance(); renderInv(); renderProfile();
      toast(`Продано за ${money(item.price)}`, 'ok');
    }
  }
  pendingWin = null;
  $('#result').hidden = true;
}

/* ---------- модалка выбора ---------- */
function openModal(mode) {
  if (!$('#modal')) return;
  modalMode = mode;
  $('#modal-title').textContent = mode === 'from' ? 'Ваш инвентарь' : 'Каталог предметов';
  $('#modal-search').value = '';
  renderModal();
  $('#modal').hidden = false;
  setTimeout(() => $('#modal-search').focus(), 30);
}
function renderModal() {
  const q = $('#modal-search').value.trim().toLowerCase();
  const match = i => !q || `${i.name} ${i.skin} ${i.wear || ''}`.toLowerCase().includes(q);
  let list, html;
  if (modalMode === 'from') {
    list = state.inv.filter(x => match(byId(x.id)));
    html = list.map(x => cardHTML(byId(x.id), { uid: x.uid })).join('');
    $('#modal-empty').textContent = state.inv.length ? 'Ничего не найдено' : 'Инвентарь пуст';
  } else {
    list = ITEMS.filter(match).sort((a, b) => a.price - b.price);
    html = list.map(i => cardHTML(i)).join('');
    $('#modal-empty').textContent = 'Ничего не найдено';
  }
  $('#modal-empty').hidden = list.length > 0;
  $('#modal-grid').innerHTML = html;
}
const closeModal = () => { const m = $('#modal'); if (m) m.hidden = true; };

/* ---------- телеметрия ---------- */
function pushRecent({ who, from, to, win }) {
  const rail = $('#recent');
  if (rail) {
    const el = document.createElement('div');
    el.className = `rec ${win ? 'win' : 'fail'}`;
    el.innerHTML = `
      <div class="rec__top">
        <span class="rec__who">${who}</span>
        <span class="rec__x">×${(to.price / from.price).toFixed(2)}</span>
      </div>
      <div class="rec__line">${from.name} → ${to.name} | ${to.skin}</div>
      <div class="tag rec__st">${win ? 'успех' : 'мимо'} · ${money(to.price)}</div>`;
    rail.prepend(el);
    while (rail.children.length > 20) rail.lastElementChild.remove();
  }
  pushLive({ who, to, win });
}

function pushLive({ who, to, win }) {
  const list = $('#live-list');
  if (!list) return;
  const el = document.createElement('div');
  el.className = `live__row ${win ? 'win' : 'fail'}`;
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `<b>${who}</b><span>${win ? 'выбил' : 'потерял'} ${to.name} | ${to.skin}</span><i>${time}</i>`;
  list.prepend(el);
  while (list.children.length > 26) list.lastElementChild.remove();
}

function fakeRun() {
  const from = pick(ITEMS.slice(0, Math.max(6, Math.floor(ITEMS.length * 0.6))));
  const better = ITEMS.filter(i => i.price > from.price * 1.4);
  if (!better.length) return;
  const to = pick(better.slice(0, 10));
  const c = Math.min(MAX_CHANCE, (from.price / to.price) * HOUSE_EDGE);
  pushRecent({ who: pick(NICKS), from, to, win: Math.random() < c });
}

/* ---------- рыночная витрина (market.html) ---------- */
let shopFilter = { q: '', sort: 'asc', rarity: new Set() };

function renderChips() {
  const box = $('#chips');
  if (!box) return;
  box.innerHTML = Object.entries(RARITY)
    .map(([k, r]) => `<button data-rar="${k}" style="color:${r.color}"><i></i>${r.name}</button>`).join('');
}
function renderShop() {
  const grid = $('#shop-grid');
  if (!grid) return;
  const q = shopFilter.q.trim().toLowerCase();
  let list = ITEMS.filter(i => {
    if (shopFilter.rarity.size && !shopFilter.rarity.has(i.rarity)) return false;
    return !q || `${i.name} ${i.skin} ${i.wear || ''} ${RARITY[i.rarity].name}`.toLowerCase().includes(q);
  });
  if (shopFilter.sort === 'asc') list.sort((a, b) => a.price - b.price);
  if (shopFilter.sort === 'desc') list.sort((a, b) => b.price - a.price);
  if (shopFilter.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  grid.innerHTML = list.length
    ? list.map(i => cardHTML(i, { action: 'buy' })).join('')
    : '<div class="empty">Ничего не найдено</div>';
}

/* ---------- события ---------- */
function bind() {
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { openModal(open.dataset.open); return; }

    const modalCard = e.target.closest('#modal-grid .card');
    if (modalCard) {
      if (modalMode === 'from') sel.from = Number(modalCard.dataset.uid);
      else { sel.to = modalCard.dataset.id; sel.pct = null; }
      save(); closeModal(); renderForge();
      return;
    }

    const act = e.target.closest('[data-act]');
    if (act) {
      const card = act.closest('.card');
      const item = byId(card.dataset.id);
      if (act.dataset.act === 'buy') {
        if (state.balance < item.price) { toast('Недостаточно средств на демо-балансе', 'err'); return; }
        state.balance -= item.price;
        state.inv.push({ uid: state.uid++, id: item.id });
        save(); renderBalance(); renderInv(); renderProfile();
        toast(`${item.name} | ${item.skin} — в инвентаре`, 'ok');
      } else {
        const uid = Number(card.dataset.uid);
        state.inv = state.inv.filter(x => x.uid !== uid);
        state.balance += item.price;
        if (sel.from === uid) sel.from = null;
        save(); renderBalance(); renderInv(); renderProfile(); renderForge();
        toast(`Продано за ${money(item.price)}`, 'ok');
      }
      return;
    }

    const target = e.target.closest('#shop-grid .card, #popular .card');
    if (target) {
      sel.to = target.dataset.id;
      sel.pct = null;
      save();
      const item = byId(sel.to);
      if ($('#forge')) { renderForge(); $('#forge').scrollIntoView({ behavior: 'smooth' }); }
      else {
        toast(`${item.name} | ${item.skin} — цель прокачки`, 'ok');
        setTimeout(() => { location.href = 'index.html#forge'; }, 450);
      }
      return;
    }

    const invCard = e.target.closest('#inv-grid .card');
    if (invCard) {
      sel.from = Number(invCard.dataset.uid);
      save(); renderForge();
      if ($('#forge')) $('#forge').scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const preset = e.target.closest('#presets button');
    if (preset) { applyPreset(Number(preset.dataset.c)); return; }

    const chip = e.target.closest('#chips button');
    if (chip) {
      const key = chip.dataset.rar;
      shopFilter.rarity.has(key) ? shopFilter.rarity.delete(key) : shopFilter.rarity.add(key);
      chip.classList.toggle('is-on');
      renderShop();
      return;
    }

    if (e.target.closest('[data-deposit]')) {
      state.balance += START_BALANCE;
      save(); renderBalance(); renderProfile();
      toast(`Зачислено ${money(START_BALANCE)} демо-баланса`, 'ok');
      return;
    }

    if (e.target.closest('[data-close]')) closeModal();
  });

  on('#forge-btn', 'click', forge);
  on('#modal-search', 'input', renderModal);
  on('#search', 'input', e => { shopFilter.q = e.target.value; renderShop(); });
  on('#sort', 'change', e => { shopFilter.sort = e.target.value; renderShop(); });
  on('#result-keep', 'click', () => closeResult(false));
  on('#result-sell', 'click', () => closeResult(true));


  on('#sell-all', 'click', () => {
    if (!state.inv.length) { toast('Инвентарь пуст', 'err'); return; }
    const sum = state.inv.reduce((s, x) => s + byId(x.id).price, 0);
    state.inv = []; sel.from = null; state.balance += sum;
    save(); renderBalance(); renderInv(); renderProfile(); renderForge();
    toast(`Инвентарь продан за ${money(sum)}`, 'ok');
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeModal();
    const r = $('#result');
    if (r && !r.hidden) closeResult(false);
  });

  const links = $$('#nav a').filter(a => a.getAttribute('href').startsWith('#'));
  const sections = $$('main section[id]');
  if (!links.length || !sections.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${en.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => obs.observe(s));
}

/* ---------- обновление потягиванием ---------- */
const PTR_TRIGGER = 70, PTR_MAX = 110, PTR_RESIST = 0.6;

function pullToRefresh() {
  if (!('ontouchstart' in window)) return;
  const el = $('#ptr');
  if (!el) return;
  const root = document.documentElement;
  let startY = 0, startX = 0, dist = 0, tracking = false, ready = false, busy = false;

  const atTop = () => (window.scrollY || root.scrollTop) <= 0;
  const free = id => { const n = $(id); return !n || n.hidden; };
  const blocked = () => busy || !free('#modal') || !free('#result') || running;

  const move = (px, drag) => {
    el.classList.toggle('is-drag', drag);
    root.classList.toggle('ptr-anim', !drag);
    root.style.setProperty('--ptr', `${px}px`);
    el.style.transform = `translate(-50%, ${Math.min(px, 64) - 64}px)`;
    el.style.opacity = px > 8 ? '1' : '0';
  };
  const reset = () => {
    tracking = false; ready = false; dist = 0;
    el.classList.remove('is-drag', 'is-ready');
    root.classList.add('ptr-anim');
    root.style.setProperty('--ptr', '0px');
    el.style.transform = ''; el.style.opacity = '';
  };

  document.addEventListener('touchstart', e => {
    if (blocked() || e.touches.length !== 1 || !atTop()) return;
    startY = e.touches[0].clientY; startX = e.touches[0].clientX;
    tracking = true; dist = 0;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!tracking || blocked()) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || !atTop()) { reset(); return; }
    e.preventDefault();
    dist = Math.min(dy * PTR_RESIST, PTR_MAX);
    ready = dist >= PTR_TRIGGER;
    el.classList.toggle('is-ready', ready);
    move(dist, true);
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (!tracking) return;
    if (ready) {
      busy = true;
      el.classList.remove('is-drag', 'is-ready');
      el.classList.add('is-load');
      move(56, false);
      setTimeout(() => location.reload(), 320);
      return;
    }
    reset();
  }, { passive: true });

  document.addEventListener('touchcancel', reset, { passive: true });
}

/* ---------- мобильные ограничения ---------- */
function mobileGuards() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(type =>
    document.addEventListener(type, e => e.preventDefault(), { passive: false }));

  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  let lastTap = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    const interactive = e.target.closest('button, a, input, select, textarea, [data-open], .card');
    if (now - lastTap < 350 && !interactive) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  const lockPortrait = () => {
    try {
      const r = screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait');
      if (r && typeof r.catch === 'function') r.catch(() => {});
    } catch (e) { /* нет поддержки — работает CSS-заглушка .rotate */ }
  };
  lockPortrait();
  document.addEventListener('fullscreenchange', lockPortrait);
}

/* ---------- запуск ---------- */
function init() {
  load();
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  renderChips();
  renderShop();
  renderPresets();
  renderCoreTicks();
  renderBalance();
  renderLevel();
  renderInv();
  renderProfile();
  renderPopular();
  renderForge();
  bind();
  particles = coreParticles();
  mobileGuards();
  pullToRefresh();
  for (let i = 0; i < 7; i++) fakeRun();
  setInterval(fakeRun, 4600);
}

document.addEventListener('DOMContentLoaded', init);
