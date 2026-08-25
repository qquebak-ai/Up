/* Стилизованные силуэты оружия (без внешних картинок) */

const WEAPON_SHAPES = {
  rifle: `
    <path d="M28 17 L6 23 v7 l22 -3 z"/>
    <rect x="26" y="15" width="52" height="11" rx="2"/>
    <rect x="66" y="10" width="28" height="5" rx="2"/>
    <rect x="78" y="18" width="36" height="5" rx="2"/>
    <rect x="101" y="11" width="4" height="8" rx="1"/>
    <path d="M47 26 h17 l-2 12 q-1 6 -7 6 h-3 q-6 0 -7 -6 z"/>
    <path d="M34 26 h10 l-4 15 h-10 z"/>
    <rect x="64" y="26" width="12" height="3" rx="1"/>`,
  awp: `
    <path d="M24 19 L4 23 v7 h7 v6 h6 l9 -6 z"/>
    <rect x="22" y="19" width="50" height="10" rx="2"/>
    <rect x="70" y="22" width="48" height="4" rx="2"/>
    <rect x="40" y="9" width="36" height="7" rx="3.5"/>
    <rect x="46" y="15" width="4" height="5"/>
    <rect x="66" y="15" width="4" height="5"/>
    <rect x="52" y="29" width="13" height="10" rx="1.5"/>
    <path d="M33 29 h9 l-3 13 h-9 z"/>`,
  smg: `
    <path d="M30 17 L10 21 v6 l20 -2 z"/>
    <rect x="28" y="14" width="46" height="12" rx="2"/>
    <rect x="74" y="17" width="20" height="5" rx="2"/>
    <rect x="48" y="26" width="10" height="15" rx="1.5"/>
    <path d="M33 26 h9 l-3 12 h-9 z"/>`,
  pistol: `
    <rect x="34" y="13" width="52" height="11" rx="2"/>
    <rect x="84" y="16" width="9" height="5" rx="1.5"/>
    <rect x="36" y="24" width="42" height="4" rx="1"/>
    <path d="M40 26 h15 l-5 18 h-14 z"/>
    <path d="M57 28 h18 v3 h-14 z"/>`,
  knife: `
    <path d="M24 32 C44 8, 78 5, 100 11 C80 21, 52 31, 32 38 Z"/>
    <path d="M14 33 l12 -5 5 9 -12 5 a5 5 0 0 1 -5 -9 z"/>`,
  gloves: `
    <path d="M38 36 v-12 a5.5 5.5 0 0 1 11 0 v-5 a5.5 5.5 0 0 1 11 0 v3 a5.5 5.5 0 0 1 11 0 v5 a5.5 5.5 0 0 1 9 3 v6 a13 13 0 0 1 -13 12 h-17 a12 12 0 0 1 -12 -12 z"/>`,
};

let __artId = 0;

/* Возвращает разметку карточки-«картинки» предмета */
function itemArt(item, opts = {}) {
  const rarity = RARITY[item.rarity];
  const gid = `g${++__artId}`;
  const shape = WEAPON_SHAPES[item.type] || WEAPON_SHAPES.rifle;
  return `
  <svg class="art" viewBox="0 0 120 48" role="img" aria-label="${item.name} | ${item.skin}">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f3f5ff"/>
        <stop offset="45%" stop-color="${rarity.color}"/>
        <stop offset="100%" stop-color="#161a26"/>
      </linearGradient>
    </defs>
    <g fill="url(#${gid})">${shape}</g>
  </svg>`;
}
