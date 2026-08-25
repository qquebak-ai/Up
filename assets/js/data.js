/* Каталог предметов. Цены — виртуальные монеты демо-режима. */

const RARITY = {
  mil:    { name: 'Армейское',      color: '#4b69ff' },
  res:    { name: 'Запрещённое',    color: '#8847ff' },
  clas:   { name: 'Засекреченное',  color: '#d32ce6' },
  cov:    { name: 'Тайное',         color: '#eb4b4b' },
  knife:  { name: 'Нож / Перчатки', color: '#ffd700' },
};

/* type — силуэт оружия (см. weapons.js) */
const ITEMS = [
  { id: 'p250-sand',      name: 'P250',        skin: 'Песчаная дюна',    type: 'pistol', rarity: 'mil',   price: 12 },
  { id: 'mp9-storm',      name: 'MP9',         skin: 'Штормовая волна',  type: 'smg',    rarity: 'mil',   price: 24 },
  { id: 'nova-polar',     name: 'Nova',        skin: 'Полярная мгла',    type: 'rifle',  rarity: 'mil',   price: 31 },
  { id: 'glock-water',    name: 'Glock-18',    skin: 'Водная стихия',    type: 'pistol', rarity: 'mil',   price: 46 },
  { id: 'mac10-neon',     name: 'MAC-10',      skin: 'Неоновый райдер',  type: 'smg',    rarity: 'res',   price: 78 },
  { id: 'famas-roll',     name: 'FAMAS',       skin: 'Роликовая волна',  type: 'rifle',  rarity: 'res',   price: 95 },
  { id: 'usp-cortex',     name: 'USP-S',       skin: 'Кортекс',          type: 'pistol', rarity: 'res',   price: 134 },
  { id: 'ak-phantom',     name: 'AK-47',       skin: 'Фантом',           type: 'rifle',  rarity: 'res',   price: 210 },
  { id: 'awp-atheris',    name: 'AWP',         skin: 'Атерис',           type: 'awp',    rarity: 'res',   price: 265 },
  { id: 'm4-desolate',    name: 'M4A1-S',      skin: 'Пустошь',          type: 'rifle',  rarity: 'clas',  price: 380 },
  { id: 'ak-neonrider',   name: 'AK-47',       skin: 'Неоновый гонщик',  type: 'rifle',  rarity: 'clas',  price: 520 },
  { id: 'deagle-blaze',   name: 'Desert Eagle',skin: 'Пламя',            type: 'pistol', rarity: 'clas',  price: 690 },
  { id: 'awp-neonoir',    name: 'AWP',         skin: 'Неонуар',          type: 'awp',    rarity: 'clas',  price: 880 },
  { id: 'ak-redline',     name: 'AK-47',       skin: 'Красная линия',    type: 'rifle',  rarity: 'cov',   price: 1150 },
  { id: 'm4-printstream', name: 'M4A1-S',      skin: 'Печатный поток',   type: 'rifle',  rarity: 'cov',   price: 1740 },
  { id: 'awp-asiimov',    name: 'AWP',         skin: 'Азимов',           type: 'awp',    rarity: 'cov',   price: 2300 },
  { id: 'ak-fireserp',    name: 'AK-47',       skin: 'Огненный змей',    type: 'rifle',  rarity: 'cov',   price: 4200 },
  { id: 'awp-dragon',     name: 'AWP',         skin: 'Драконий огонь',   type: 'awp',    rarity: 'cov',   price: 6100 },
  { id: 'karambit-fade',  name: 'Керамбит',    skin: 'Градиент',         type: 'knife',  rarity: 'knife', price: 11500 },
  { id: 'bayonet-doppler',name: 'Штык-нож',    skin: 'Доплер «Фаза 2»',  type: 'knife',  rarity: 'knife', price: 17800 },
  { id: 'butterfly-marb', name: 'Бабочка',     skin: 'Мраморный градиент',type:'knife',  rarity: 'knife', price: 29400 },
  { id: 'gloves-vice',    name: 'Перчатки',    skin: 'Порок',            type: 'gloves', rarity: 'knife', price: 43000 },
];

/* Стартовый инвентарь демо-аккаунта */
const STARTER_INVENTORY = ['glock-water', 'mp9-storm', 'famas-roll', 'usp-cortex', 'nova-polar'];

/* Ники для ленты живых апгрейдов */
const NICKS = [
  'Kirillow', 'sh1ro_fan', 'MarkelOFF', 'Zaza4ka', 'donk_777', 'Vertigo',
  'ЛехаБетон', 'nafany', 'blast_ok', 'Аркадий', 'GoodFella', 'm0NESY_jr',
  'Тимоха', 'sniper_kz', 'nikolka', 'PRO100', 'Fluffy', 'Дядя Гриша',
];

const MULTIPLIERS = [1.5, 2, 3, 5, 10, 20];
