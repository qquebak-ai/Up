/* ================= UPGRADER — демо-логика ================= */
'use strict';

const HOUSE_EDGE = 0.92;   // возврат по шансу
const MAX_CHANCE = 0.92;
const MIN_CHANCE = 0.01;
const START_BALANCE = 1000;
const STORE_KEY = 'upgrader.demo.v1';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const byId = id => ITEMS.find(i => i.id === id);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = n => Math.round(n).toLocaleString('ru-RU');

/* ---------- состояние ---------- */
let state = { balance: START_BALANCE, inv: [], uid: 1 };
let sel = { from: null, to: null };   // from — uid из инвентаря, to — id из каталога
let spinning = false;
let modalMode = 'from';

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.balance === 'number' && Array.isArray(p.inv)) {
        state = { balance: p.balance, inv: p.inv.filter(x => byId(x.id)), uid: p.uid || 1 };
        return;
      }
    }
  } catch (e) { /* повреждённые данные — стартуем заново */ }
  state.inv = STARTER_INVENTORY.map(id => ({ uid: state.uid++, id }));
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- уведомления ---------- */
function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(24px)';
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

/* ---------- карточка предмета ---------- */
function cardHTML(item, { action = '', uid = null, tag = true } = {}) {
  const r = RARITY[item.rarity];
  return `
  <article class="card" style="--rc:${r.color}" data-id="${item.id}" ${uid ? `data-uid="${uid}"` : ''}>
    <div class="card__rar"></div>
    ${tag ? `<span class="card__tag">${r.name}</span>` : ''}
    ${itemArt(item)}
    <div class="card__name">${item.name}</div>
    <div class="card__skin">${item.skin}</div>
    <div class="card__foot">
      <span class="card__price">${fmt(item.price)} ⛁</span>
      ${action ? `<button class="card__btn" data-act="${action}">${action === 'buy' ? 'Купить' : 'Продать'}</button>` : ''}
    </div>
  </article>`;
}

function pickedHTML(item) {
  return `
  <div class="picked">
    ${itemArt(item)}
    <div class="picked__name">${item.name}</div>
    <div class="picked__skin">${item.skin}</div>
    <div class="picked__price">${fmt(item.price)} ⛁</div>
  </div>`;
}

/* ---------- баланс ---------- */
function renderBalance() {
  const el = $('#balance');
  el.textContent = fmt(state.balance);
  const box = el.closest('.balance');
  box.classList.remove('is-bump');
  void box.offsetWidth;
  box.classList.add('is-bump');
}

/* ---------- магазин ---------- */
let shopFilter = { q: '', sort: 'asc', rarity: new Set() };

function renderChips() {
  $('#chips').innerHTML = Object.entries(RARITY).map(([key, r]) =>
    `<button data-rar="${key}" style="color:${r.color}"><i></i>${r.name}</button>`
  ).join('');
}

function shopList() {
  const q = shopFilter.q.trim().toLowerCase();
  let list = ITEMS.filter(i => {
    if (shopFilter.rarity.size && !shopFilter.rarity.has(i.rarity)) return false;
    if (!q) return true;
    return (`${i.name} ${i.skin} ${RARITY[i.rarity].name}`).toLowerCase().includes(q);
  });
  if (shopFilter.sort === 'asc') list.sort((a, b) => a.price - b.price);
  if (shopFilter.sort === 'desc') list.sort((a, b) => b.price - a.price);
  if (shopFilter.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return list;
}

function renderShop() {
  const list = shopList();
  $('#shop-grid').innerHTML = list.length
    ? list.map(i => cardHTML(i, { action: 'buy' })).join('')
    : `<div class="empty">По вашему запросу ничего не найдено.</div>`;
}

/* ---------- инвентарь ---------- */
function renderInv() {
  const grid = $('#inv-grid');
  grid.innerHTML = state.inv.length
    ? state.inv.map(x => cardHTML(byId(x.id), { action: 'sell', uid: x.uid })).join('')
    : `<div class="empty">Инвентарь пуст — купите предмет в магазине, чтобы начать апгрейд.</div>`;
  $('#inv-count').textContent = state.inv.length;
  $('#inv-sum').textContent = fmt(state.inv.reduce((s, x) => s + byId(x.id).price, 0));
}

/* ---------- шанс и барабан ---------- */
const CIRC = 2 * Math.PI * 100;

function fromItem() {
  const rec = state.inv.find(x => x.uid === sel.from);
  return rec ? byId(rec.id) : null;
}
function toItem() { return sel.to ? byId(sel.to) : null; }

function chance() {
  const f = fromItem(), t = toItem();
  if (!f || !t || t.price <= 0) return 0;
  if (t.price <= f.price) return MAX_CHANCE;
  return Math.min(MAX_CHANCE, Math.max(MIN_CHANCE, (f.price / t.price) * HOUSE_EDGE));
}

function renderUpgrader() {
  const f = fromItem(), t = toItem();

  $('#from-body').innerHTML = f ? pickedHTML(f)
    : `<button class="slot__empty" data-open="from"><span class="plus">+</span>Выбрать из инвентаря</button>`;
  $('#to-body').innerHTML = t ? pickedHTML(t)
    : `<button class="slot__empty" data-open="to"><span class="plus">+</span>Выбрать из магазина</button>`;

  $('#slot-from').classList.toggle('is-filled', !!f);
  $('#slot-to').classList.toggle('is-filled', !!t);

  const c = chance();
  $('#chance').innerHTML = `${(c * 100).toFixed(2)}<i>%</i>`;
  $('#wheel-zone').style.strokeDasharray = `${(c * CIRC).toFixed(2)} ${CIRC.toFixed(2)}`;

  $('#meta-bet').textContent = f ? `${fmt(f.price)} ⛁` : '—';
  $('#meta-win').textContent = t ? `${fmt(t.price)} ⛁` : '—';

  const go = $('#go');
  go.disabled = !(f && t) || spinning;
  go.textContent = spinning ? 'Крутим…'
    : !f ? 'Выберите свой предмет'
    : !t ? 'Выберите желаемый предмет'
    : `Апгрейд ×${(t.price / f.price).toFixed(2)}`;

  // подсветка активного множителя
  const ratio = f && t ? t.price / f.price : null;
  $$('#mults button').forEach(b => {
    const m = parseFloat(b.dataset.m);
    b.classList.toggle('is-on', ratio !== null && Math.abs(ratio - m) / m < 0.2);
  });
}

function renderMults() {
  $('#mults').innerHTML = MULTIPLIERS
    .map(m => `<button data-m="${m}">×${m}</button>`).join('');
}

/* подобрать цель по множителю */
function applyMult(m) {
  const f = fromItem();
  if (!f) { toast('Сначала выберите свой предмет', 'err'); return; }
  const target = f.price * m;
  const best = ITEMS.reduce((a, b) =>
    Math.abs(b.price - target) < Math.abs(a.price - target) ? b : a);
  sel.to = best.id;
  renderUpgrader();
}

/* ---------- прокрут ---------- */
function spin() {
  const f = fromItem(), t = toItem();
  if (!f || !t || spinning) return;

  spinning = true;
  const wheel = $('.wheel');
  wheel.classList.remove('is-win', 'is-lose');
  $('#go').classList.add('is-spin');
  renderUpgrader();

  const c = chance();
  const win = Math.random() < c;
  const zone = c * 360;
  const angle = win ? rnd(3, Math.max(4, zone - 3)) : rnd(zone + 3, 357);
  const total = 360 * 5 + angle;

  const needle = $('#wheel-needle');
  needle.style.transition = 'none';
  needle.style.transform = 'rotate(0deg)';
  void needle.getBoundingClientRect();
  needle.style.transition = 'transform 4.2s cubic-bezier(.12,.72,.15,1)';
  needle.style.transform = `rotate(${total}deg)`;

  $('#wheel-hint').textContent = 'барабан крутится…';

  setTimeout(() => finish(win, f, t, wheel), 4300);
}

function finish(win, f, t, wheel) {
  // ставка списывается в любом случае
  state.inv = state.inv.filter(x => x.uid !== sel.from);
  let wonUid = null;
  if (win) {
    wonUid = state.uid++;
    state.inv.push({ uid: wonUid, id: t.id });
  }
  save();

  wheel.classList.add(win ? 'is-win' : 'is-lose');
  $('#wheel-hint').textContent = win ? 'апгрейд успешен' : 'ставка сгорела';
  addFeed({ nick: 'Вы', from: f, to: t, win });

  showResult(win, win ? t : f, wonUid);

  sel.from = null;   // цель остаётся выбранной для быстрого повтора
  spinning = false;
  $('#go').classList.remove('is-spin');
  renderInv();
  renderUpgrader();
}

/* ---------- окно результата ---------- */
let pendingWin = null;

function showResult(win, item, uid) {
  pendingWin = win ? uid : null;
  const box = $('#result');
  const title = $('#result-title');
  title.className = `result__title ${win ? 'win' : 'lose'}`;
  title.textContent = win ? 'Апгрейд удался!' : 'Не повезло';
  $('#result-card').innerHTML = pickedHTML(item);
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
      save();
      renderBalance();
      renderInv();
      toast(`Продано за ${fmt(item.price)} ⛁`, 'ok');
    }
  }
  pendingWin = null;
  $('#result').hidden = true;
}

/* ---------- модалка выбора ---------- */
function openModal(mode) {
  modalMode = mode;
  $('#modal-title').textContent = mode === 'from' ? 'Предмет из инвентаря' : 'Желаемый предмет';
  $('#modal-search').value = '';
  renderModal();
  $('#modal').hidden = false;
  setTimeout(() => $('#modal-search').focus(), 30);
}

function renderModal() {
  const q = $('#modal-search').value.trim().toLowerCase();
  const match = i => !q || (`${i.name} ${i.skin}`).toLowerCase().includes(q);
  let html;

  if (modalMode === 'from') {
    const list = state.inv.filter(x => match(byId(x.id)));
    html = list.map(x => cardHTML(byId(x.id), { uid: x.uid })).join('');
    $('#modal-empty').textContent = state.inv.length
      ? 'Ничего не найдено.' : 'Инвентарь пуст — купите предмет в магазине.';
    $('#modal-empty').hidden = list.length > 0;
  } else {
    const list = ITEMS.filter(match).sort((a, b) => a.price - b.price);
    html = list.map(i => cardHTML(i)).join('');
    $('#modal-empty').textContent = 'Ничего не найдено.';
    $('#modal-empty').hidden = list.length > 0;
  }
  $('#modal-grid').innerHTML = html;
}

function closeModal() { $('#modal').hidden = true; }

/* ---------- лента ---------- */
function addFeed({ nick, from, to, win }) {
  const el = document.createElement('div');
  el.className = `feed__item ${win ? 'win' : 'lose'}`;
  el.innerHTML = `
    <div class="feed__nick">${nick}</div>
    <div class="feed__line">${from.name} → ${to.name} | ${to.skin}</div>
    <div class="feed__x">×${(to.price / from.price).toFixed(2)} · ${win ? 'успех' : 'провал'}</div>`;
  const row = $('#feed');
  row.prepend(el);
  while (row.children.length > 24) row.lastElementChild.remove();
}

function fakeFeed() {
  const from = pick(ITEMS.slice(0, 14));
  const better = ITEMS.filter(i => i.price > from.price * 1.4);
  if (!better.length) return;
  const to = pick(better.slice(0, 8));
  const c = Math.min(MAX_CHANCE, (from.price / to.price) * HOUSE_EDGE);
  addFeed({ nick: pick(NICKS), from, to, win: Math.random() < c });
}

/* ---------- счётчики ---------- */
function counters() {
  let online = Math.round(rnd(2400, 3100));
  let upg = Math.round(rnd(48000, 61000));
  const paint = () => {
    $('#stat-online').textContent = fmt(online);
    $('#stat-upg').textContent = fmt(upg);
  };
  paint();
  setInterval(() => {
    online = Math.max(1800, online + Math.round(rnd(-14, 16)));
    upg += Math.round(rnd(0, 5));
    paint();
  }, 2200);
}

/* ---------- события ---------- */
function bind() {
  // открыть модалку (в т.ч. по кнопкам внутри слотов)
  document.addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    if (open) { openModal(open.dataset.open); return; }

    // карточка в модалке
    const modalCard = e.target.closest('#modal-grid .card');
    if (modalCard) {
      if (modalMode === 'from') sel.from = Number(modalCard.dataset.uid);
      else sel.to = modalCard.dataset.id;
      closeModal();
      renderUpgrader();
      return;
    }

    // покупка / продажа
    const act = e.target.closest('[data-act]');
    if (act) {
      e.stopPropagation();
      const card = act.closest('.card');
      const item = byId(card.dataset.id);
      if (act.dataset.act === 'buy') {
        if (state.balance < item.price) { toast('Недостаточно монет на балансе', 'err'); return; }
        state.balance -= item.price;
        state.inv.push({ uid: state.uid++, id: item.id });
        save(); renderBalance(); renderInv();
        toast(`${item.name} | ${item.skin} — куплен`, 'ok');
      } else {
        const uid = Number(card.dataset.uid);
        state.inv = state.inv.filter(x => x.uid !== uid);
        state.balance += item.price;
        if (sel.from === uid) sel.from = null;
        save(); renderBalance(); renderInv(); renderUpgrader();
        toast(`Продано за ${fmt(item.price)} ⛁`, 'ok');
      }
      return;
    }

    // карточка магазина -> сразу в правый слот
    const shopCard = e.target.closest('#shop-grid .card');
    if (shopCard) {
      sel.to = shopCard.dataset.id;
      renderUpgrader();
      $('#upgrade').scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // карточка инвентаря -> в левый слот
    const invCard = e.target.closest('#inv-grid .card');
    if (invCard) {
      sel.from = Number(invCard.dataset.uid);
      renderUpgrader();
      $('#upgrade').scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // множители
    const mult = e.target.closest('#mults button');
    if (mult) { applyMult(parseFloat(mult.dataset.m)); return; }

    // фильтры по редкости
    const chip = e.target.closest('#chips button');
    if (chip) {
      const key = chip.dataset.rar;
      shopFilter.rarity.has(key) ? shopFilter.rarity.delete(key) : shopFilter.rarity.add(key);
      chip.classList.toggle('is-on');
      renderShop();
      return;
    }

    if (e.target.closest('[data-close]')) closeModal();
  });

  $('#go').addEventListener('click', spin);
  $('#modal-search').addEventListener('input', renderModal);
  $('#search').addEventListener('input', e => { shopFilter.q = e.target.value; renderShop(); });
  $('#sort').addEventListener('change', e => { shopFilter.sort = e.target.value; renderShop(); });

  $('#result-keep').addEventListener('click', () => closeResult(false));
  $('#result-sell').addEventListener('click', () => closeResult(true));

  $('#topup').addEventListener('click', () => {
    state.balance += START_BALANCE;
    save(); renderBalance();
    toast(`Начислено ${fmt(START_BALANCE)} демо-монет`, 'ok');
  });
  $('#login').addEventListener('click', () =>
    toast('Демо-режим: авторизация Steam не подключена'));

  $('#sell-all').addEventListener('click', () => {
    if (!state.inv.length) { toast('Инвентарь пуст', 'err'); return; }
    const sum = state.inv.reduce((s, x) => s + byId(x.id).price, 0);
    state.inv = [];
    sel.from = null;
    state.balance += sum;
    save(); renderBalance(); renderInv(); renderUpgrader();
    toast(`Инвентарь продан за ${fmt(sum)} ⛁`, 'ok');
  });

  $('#burger').addEventListener('click', () => $('#nav').classList.toggle('is-open'));
  $$('#nav a').forEach(a => a.addEventListener('click', () => $('#nav').classList.remove('is-open')));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); if (!$('#result').hidden) closeResult(false); }
  });

  // подсветка активного пункта меню
  const links = $$('#nav a');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${en.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach(s => obs.observe(s));
}

/* ---------- запуск ---------- */
function init() {
  load();
  $('#year').textContent = new Date().getFullYear();
  renderChips();
  renderMults();
  renderBalance();
  renderShop();
  renderInv();
  renderUpgrader();
  bind();
  counters();
  for (let i = 0; i < 8; i++) fakeFeed();
  setInterval(fakeFeed, 4200);
}

document.addEventListener('DOMContentLoaded', init);
