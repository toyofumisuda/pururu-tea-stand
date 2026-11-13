/* =========================================================
   ぷるる茶房 — 画面の動き
   ・3D（three-scene.js）は読み込めたときだけ使う。
     動きを減らす設定 / WebGL が使えない / CDN が読めない ときは SVG イラストのまま。
   ・メニュー、ギャラリー、カスタマイズの絵は drinkSVG() でコードから描く。
   ========================================================= */

/* ---------- データ ---------- */
export const FLAVORS = {
  milk:   { short: 'ミルクティー', name: 'ぷるるミルクティー', en: 'Milk Tea',    price: 560, top: '#E1BE97', bottom: '#AE7B50', syrup: '#4A2A18', stripes: 0 },
  matcha: { short: '抹茶ミルク', name: '濃い抹茶ミルク',     en: 'Matcha',      price: 620, top: '#C3D394', bottom: '#6F8C43', syrup: '#2F3B1A', stripes: 0 },
  berry:  { short: '苺ミルク', name: 'まるごと苺ミルク',   en: 'Strawberry',  price: 680, top: '#F4C9CA', bottom: '#D8707F', syrup: '#9E2C42', stripes: 0 },
  kokuto: { short: '黒糖ミルク', name: '黒糖タイガーミルク', en: 'Brown Sugar', price: 650, top: '#F0DFC6', bottom: '#B98B60', syrup: '#3A1E0E', stripes: 1 },
};
const FLAVOR_ORDER = ['milk', 'matcha', 'berry', 'kokuto'];

const MENU = [
  { cat: 'milk',   name: 'ぷるるミルクティー', en: 'Pururu Milk Tea',    desc: '国産紅茶をミルクでじっくり。まろやかな、いちばんの定番。', price: 560, badge: '人気No.1', top: true, c: FLAVORS.milk, bg: '#F3E4D2' },
  { cat: 'milk',   name: '黒糖タイガーミルク', en: 'Brown Sugar Tiger',   desc: '煮詰めた黒糖蜜が、カップに虎もようを描きます。',     price: 650, badge: '人気No.2', c: FLAVORS.kokuto, bg: '#EFE0CB' },
  { cat: 'milk',   name: '濃い抹茶ミルク',     en: 'Deep Matcha Milk',    desc: '国産抹茶をたっぷり。ほろ苦さとミルクが好相性。',     price: 620, badge: 'おすすめ', c: FLAVORS.matcha, bg: '#E8EDD8' },
  { cat: 'fruit',  name: 'まるごと苺ミルク',   en: 'Whole Strawberry Milk', desc: '果肉ごと煮込んだ苺ソースに、ミルクを重ねて。',     price: 680, badge: '人気No.3', c: FLAVORS.berry, bg: '#F6E1DF' },
  { cat: 'fruit',  name: '白桃ウーロン',       en: 'White Peach Oolong',  desc: '香ばしい烏龍茶に、みずみずしい白桃の香り。',         price: 600, badge: 'NEW', c: { top: '#F7D2B0', bottom: '#E79C78', syrup: '#8A4A2A' }, bg: '#F8E6DA', nata: true },
  { cat: 'fruit',  name: '甘夏ジャスミン',     en: 'Amanatsu Jasmine',    desc: 'ほろ苦い甘夏と、華やかなジャスミン茶ですっきり。',   price: 580, c: { top: '#F8E4A0', bottom: '#EDB24E', syrup: '#8A5A16' }, bg: '#F7EED3', ice: 3 },
  { cat: 'season', name: '焼き芋ミルクティー', en: 'Roasted Sweet Potato', desc: 'ほっくり焼き芋ペーストと、ほうじ茶ミルクの冬の味。', price: 690, badge: '冬限定', c: { top: '#EED6B4', bottom: '#A782A6', syrup: '#4C2B4A' }, bg: '#EFE3EA', foam: true },
  { cat: 'season', name: '和栗ほうじ茶ラテ',   en: 'Chestnut Hojicha Latte', desc: '香ばしいほうじ茶に、なめらかな和栗クリームをのせて。', price: 720, badge: '数量限定', c: { top: '#DCC09A', bottom: '#8E6040', syrup: '#3E2414' }, bg: '#EDE1D2', foam: true },
];

const SWEET = [0, 30, 50, 70, 100, 120];
const ICE = ['なし', '少なめ', 'ふつう', '多め'];
const TOPPINGS = {
  pearl: { name: 'タピオカ増量', price: 100 },
  foam:  { name: 'チーズフォーム', price: 150 },
  nata:  { name: 'ナタデココ', price: 100 },
};

/* ---------- ドリンクの SVG イラスト ---------- */
let uid = 0;
// 底のタピオカの位置（下の段から順に）
const PEARL_SPOTS = (() => {
  const rows = [268, 254, 240, 227, 214];
  const out = [];
  rows.forEach((y, r) => {
    const hw = 50 + ((278 - y) * 14) / 204 - 10;
    const step = 15.5;
    const n = Math.floor((hw * 2) / step);
    const start = 100 - ((n - 1) * step) / 2 + (r % 2 ? 4 : -3);
    for (let i = 0; i < n; i++) out.push([start + i * step + ((i * 7 + r * 3) % 5) - 2, y + ((i * 5 + r) % 4) - 1.5]);
  });
  return out;
})();

export function drinkSVG(opt = {}) {
  const o = { top: '#E1BE97', bottom: '#AE7B50', syrup: '#4A2A18', stripes: 0, foam: false, ice: 2, pearls: 18, nata: false, sweet: 100, straw: '#D9A3A1', attrs: '', ...opt };
  const id = `dk${++uid}`;
  const cup = 'M36 74 L164 74 L150.5 266 Q149.5 278 138 278 L62 278 Q50.5 278 49.5 266 Z';
  const syrupOp = (0.18 + 0.4 * (o.sweet / 120)).toFixed(2);
  const liqTop = o.foam ? 100 : 92;

  const pearls = PEARL_SPOTS.slice(0, o.pearls).map(([x, y]) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.6" fill="url(#${id}p)"/><circle cx="${(x - 2.6).toFixed(1)}" cy="${(y - 2.8).toFixed(1)}" r="2" fill="#fff" opacity=".55"/>`
  ).join('');

  const nata = o.nata ? [[70, 232], [118, 246], [92, 222], [136, 230], [80, 258], [124, 262]].map(([x, y], i) =>
    `<rect x="${x}" y="${y}" width="10" height="10" rx="2.5" fill="#F7F2E4" stroke="#E2D6BE" transform="rotate(${i * 23} ${x + 5} ${y + 5})"/>`
  ).join('') : '';

  const ice = [[58, 80, -12], [96, 76, 8], [128, 82, -4]].slice(0, Math.min(3, o.ice)).map(([x, y, r]) =>
    `<rect x="${x}" y="${y}" width="24" height="22" rx="5" fill="#fff" fill-opacity=".55" stroke="#fff" stroke-opacity=".9" stroke-width="1.5" transform="rotate(${r} ${x + 12} ${y + 11})"/>`
  ).join('');

  const stripes = o.stripes ? `<g opacity=".7" fill="${o.syrup}">
      <path d="M44 ${liqTop} q6 30 -2 60 q-3 14 6 22 q4-26 2-46 q-1-20 6-36 Z"/>
      <path d="M70 ${liqTop} q-6 40 6 72 q4 12 0 26 q10-18 6-40 q-6-26 -2-58 Z"/>
      <path d="M104 ${liqTop} q8 34 -2 66 q-4 16 4 30 q8-24 4-46 q-4-24 4-50 Z"/>
      <path d="M134 ${liqTop} q-8 28 2 58 q4 18 -2 34 q12-22 8-44 q-4-24 2-48 Z"/>
    </g>` : '';

  const foam = o.foam ? `<path d="M36 78 H164 L162.6 98 q-8 6 -16 1 q-8 6 -16 1 q-8 6 -16 1 q-8 6 -16 1 q-8 6 -16 1 q-8 6 -16 1 q-8 6 -16 1 q-8 5 -14 1 Z" fill="#FBF3E6"/>` : '';

  return `<svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" ${o.attrs} aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="${id}c"><path d="${cup}"/></clipPath>
    <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${o.top}"/><stop offset=".72" stop-color="${o.bottom}"/><stop offset="1" stop-color="${o.bottom}"/>
    </linearGradient>
    <radialGradient id="${id}p" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#6A4636"/><stop offset=".55" stop-color="#2A1911"/><stop offset="1" stop-color="#160C08"/></radialGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".22" stop-color="#fff" stop-opacity=".08"/><stop offset=".8" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity=".4"/>
    </linearGradient>
  </defs>
  <ellipse cx="100" cy="284" rx="72" ry="9" fill="#5C3A24" opacity=".16"/>
  <path d="${cup}" fill="#fff" fill-opacity=".35"/>
  <line x1="112" y1="250" x2="137" y2="10" stroke="${o.straw}" stroke-width="21"/>
  <line x1="106.5" y1="250" x2="131.5" y2="10" stroke="#fff" stroke-opacity=".35" stroke-width="4"/>
  <ellipse cx="137" cy="10" rx="10.5" ry="4" fill="#9D5F62" transform="rotate(6 137 10)"/>
  <g clip-path="url(#${id}c)">
    <rect x="30" y="${liqTop}" width="140" height="${222 - liqTop}" fill="url(#${id}l)"/>
    <rect x="30" y="221" width="140" height="60" fill="${o.syrup}" opacity="${syrupOp}"/>
    <rect x="30" y="219" width="140" height="5" fill="${o.bottom}" opacity=".6"/>
    ${stripes}
    ${pearls}
    ${nata}
    ${foam}
    ${ice}
    <rect x="30" y="150" width="140" height="38" fill="#F4E6D2"/>
    <rect x="30" y="153" width="140" height="1.6" fill="#E2C9AC"/><rect x="30" y="183.5" width="140" height="1.6" fill="#E2C9AC"/>
    <text x="100" y="173.5" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="600" font-size="17" fill="#7A5038">Pururu</text>
    <circle cx="62" cy="169" r="3" fill="#D9A3A1"/><circle cx="138" cy="169" r="3" fill="#D9A3A1"/>
  </g>
  <path d="${cup}" fill="url(#${id}g)" stroke="#fff" stroke-opacity=".9" stroke-width="2"/>
  <path d="M47 84 L55 84 L64 262 L59 262 Z" fill="#fff" opacity=".45"/>
  <path d="M40 72 Q44 45 100 43 Q156 45 160 72 Z" fill="#fff" fill-opacity=".42" stroke="#fff" stroke-width="2"/>
  <rect x="30" y="68" width="140" height="9" rx="4.5" fill="#fff" fill-opacity=".75" stroke="#fff"/>
</svg>`;
}

/* ---------- ギャラリー（Instagram風）のタイル ---------- */
const deco = {
  pearls: (pts) => pts.map(([x, y, r = 9]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2A1911"/><circle cx="${x - r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.28}" fill="#fff" opacity=".5"/>`).join(''),
  heart: (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 6C-6-2-14 2-12 9-10 15 0 21 0 21S10 15 12 9C14 2 6-2 0 6Z" fill="${c}"/>`,
  sparkle: (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-12 3-3 12 0 3 3 0 12-3 3-12 0-3-3Z" fill="${c}"/>`,
  leaf: (x, y, r, c) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 0C4-14 18-20 30-18 28-6 18 4 0 0Z" fill="${c}"/><path transform="translate(${x} ${y}) rotate(${r})" d="M2-1 24-15" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>`,
};
const TILES = [
  {
    alt: '定番のミルクティーと、手作りタピオカ', likes: '1,284', comments: 36,
    svg: () => `<rect width="300" height="300" fill="#EBD8C2"/>
      <g fill="#F4E6D6">${Array.from({ length: 36 }, (_, i) => `<circle cx="${(i % 6) * 54 + 18 + (Math.floor(i / 6) % 2) * 27}" cy="${Math.floor(i / 6) * 54 + 20}" r="7"/>`).join('')}</g>
      ${drinkSVG({ ...FLAVORS.milk, attrs: 'x="70" y="34" width="160" height="240"' })}
      ${deco.pearls([[52, 252, 11], [76, 264, 9], [40, 274, 8], [250, 262, 9]])}
      <circle cx="236" cy="64" r="30" fill="#D9A3A1"/><text x="236" y="60" text-anchor="middle" font-family="Fraunces, serif" font-style="italic" font-size="13" fill="#3D2A21">No.</text><text x="236" y="78" text-anchor="middle" font-family="Fraunces, serif" font-weight="600" font-size="22" fill="#3D2A21">1</text>`,
  },
  {
    alt: '濃い抹茶ミルク', likes: '962', comments: 21,
    svg: () => `<rect width="300" height="300" fill="#E6EBD5"/>
      <g fill="#DCE3C6">${Array.from({ length: 25 }, (_, i) => (i % 2 ? '' : `<rect x="${(i % 5) * 60}" y="${Math.floor(i / 5) * 60}" width="60" height="60"/>`)).join('')}</g>
      ${deco.leaf(40, 90, -20, '#9DB07A')}${deco.leaf(230, 240, 150, '#9DB07A')}${deco.leaf(250, 70, 30, '#B9CC8A')}
      ${drinkSVG({ ...FLAVORS.matcha, ice: 3, attrs: 'x="75" y="40" width="150" height="225"' })}
      <text x="150" y="284" text-anchor="middle" font-family="Fraunces, serif" font-style="italic" font-size="15" fill="#6F8C43">matcha time</text>`,
  },
  {
    alt: '苺ミルクとミルクティーで乾杯', likes: '2,031', comments: 58,
    svg: () => `<rect width="300" height="300" fill="#F3D9D6"/>
      <circle cx="150" cy="150" r="118" fill="#F8E7E3"/>
      <g transform="rotate(-10 110 170)">${drinkSVG({ ...FLAVORS.berry, attrs: 'x="38" y="58" width="140" height="210"' })}</g>
      <g transform="rotate(10 190 170)">${drinkSVG({ ...FLAVORS.milk, straw: '#C9A47E', attrs: 'x="122" y="58" width="140" height="210"' })}</g>
      ${deco.heart(150, 30, 1.2, '#C27E7C')}${deco.heart(52, 56, 0.8, '#D9A3A1')}${deco.heart(250, 50, 0.7, '#D9A3A1')}`,
  },
  {
    alt: '黒糖タイガーミルクの虎もよう', likes: '1,577', comments: 42,
    svg: () => `<rect width="300" height="300" fill="#4A3226"/>
      <circle cx="150" cy="160" r="110" fill="#5B3E30"/>
      ${drinkSVG({ ...FLAVORS.kokuto, straw: '#E7D3BA', attrs: 'x="72" y="40" width="156" height="234"' })}
      ${deco.sparkle(56, 70, 1.2, '#F0DFC6')}${deco.sparkle(246, 110, 0.8, '#D9A3A1')}${deco.sparkle(238, 236, 1, '#F0DFC6')}
      <text x="38" y="270" font-family="Fraunces, serif" font-style="italic" font-weight="600" font-size="20" fill="#F0DFC6">Brown Sugar</text>`,
  },
  {
    alt: '炊きあがったばかりのタピオカ', likes: '845', comments: 17,
    svg: () => `<rect width="300" height="300" fill="#F6EEE2"/>
      <path d="M96 70q-8-14 0-28M150 62q-8-14 0-28M204 70q-8-14 0-28" stroke="#C9A47E" stroke-width="4" stroke-linecap="round" fill="none"/>
      <ellipse cx="150" cy="150" rx="112" ry="40" fill="#C9A47E"/>
      <path d="M38 150 Q42 252 150 256 Q258 252 262 150 Z" fill="#E7D3BA"/>
      <ellipse cx="150" cy="150" rx="104" ry="34" fill="#3A1E0E"/>
      ${deco.pearls(Array.from({ length: 26 }, (_, i) => [62 + (i % 9) * 22 + (Math.floor(i / 9) % 2) * 11, 132 + Math.floor(i / 9) * 14 + ((i * 7) % 5), 10]))}
      <path d="M38 150 Q42 252 150 256 Q258 252 262 150" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>
      <text x="150" y="292" text-anchor="middle" font-family="Fraunces, serif" font-style="italic" font-size="16" fill="#7A5038">today's pearls</text>`,
  },
  {
    alt: '冬限定の焼き芋ミルクティー', likes: '1,106', comments: 29,
    svg: () => `<rect width="300" height="300" fill="#EFE1E6"/>
      ${deco.leaf(36, 60, 10, '#E3A36A')}${deco.leaf(240, 52, 120, '#D98B5A')}${deco.leaf(250, 230, 200, '#E3A36A')}${deco.leaf(30, 250, -40, '#C9A47E')}
      ${drinkSVG({ ...MENU[6].c, foam: true, ice: 0, attrs: 'x="72" y="36" width="156" height="234"' })}
      <rect x="24" y="22" width="78" height="28" rx="14" fill="#3D2A21"/><text x="63" y="41" text-anchor="middle" font-family="Zen Maru Gothic, sans-serif" font-weight="700" font-size="13" fill="#FBF6EE">冬限定</text>`,
  },
];

/* ---------- 小道具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const yen = (n) => n.toLocaleString('ja-JP');

/* ---------- 起動 ---------- */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // URL に ?static を付けると、3D を使わない表示（SVG イラスト）を確認できる
  const forceStatic = new URLSearchParams(window.location.search).has('static');
  const mqPC = window.matchMedia('(min-width: 900px)');
  const lowSpec = window.matchMedia('(pointer: coarse)').matches ||
    (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  const quality = lowSpec ? 'low' : 'high';

  // three-scene.js は動的に読む（読めなくてもサイトは動く）
  const threeReady = (reduceMotion || forceStatic) ? Promise.resolve(null) : import('./three-scene.js?v=2')
    .then((m) => (m.webglAvailable() ? m : null))
    .catch((err) => { console.warn('[pururu] 3D を使わずに表示します:', err); return null; });

  initHeader();
  initPurun();
  initReveal(reduceMotion);
  initCount(reduceMotion);
  initMenu();
  initGallery();
  initForm();
  const hero = initHero(mqPC);
  const custom = initCustom();
  $('#year').textContent = new Date().getFullYear();

  threeReady.then((mod) => {
    if (!mod) return;
    try { hero.attach(mod.createDrinkScene($('#heroStage'), { quality })); } catch (e) { console.warn(e); }
    try { custom.attach(mod.createDrinkScene($('#customStage'), { quality, drag: true, dark: true, tiltArea: 'element' })); } catch (e) { console.warn(e); }
  });
}

/* ---------- ヘッダー・スマホメニュー ---------- */
function initHeader() {
  const header = $('#header');
  const burger = $('#burger');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setOpen = (open) => {
    document.body.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  };
  burger.addEventListener('click', () => setOpen(!document.body.classList.contains('nav-open')));
  $$('#gnav a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}

/* ---------- ぷるん（押したときの弾み） ---------- */
function initPurun() {
  const SEL = '.btn, .tab, .chip, .seg__opt, .topping, .bottom-bar__btn, .hero__dots button, .sns a';
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest(SEL);
    if (!el) return;
    const target = el.matches('.chip, .topping') ? el.firstElementChild.nextElementSibling || el : el.matches('.seg__opt') ? el.querySelector('span') : el;
    target.classList.remove('is-purun');
    void target.offsetWidth;
    target.classList.add('is-purun');
  });
  document.addEventListener('animationend', (e) => e.target.classList.remove('is-purun'));
}

/* ---------- ふわっと表示 ---------- */
function initReveal(reduceMotion) {
  const els = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
}

/* ---------- 数字のカウントアップ ---------- */
function initCount(reduceMotion) {
  const els = $$('[data-count]');
  if (reduceMotion) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, to = Number(el.dataset.count), t0 = performance.now(), dur = 1400;
      const step = (now) => {
        const t = clamp((now - t0) / dur, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

/* ---------- メニュー（タブ切り替え） ---------- */
function initMenu() {
  const grid = $('#menuGrid');
  const tabs = $$('.tab');
  const render = (cat) => {
    grid.innerHTML = MENU.filter((m) => m.cat === cat).map((m, i) => `
      <article class="menu-card" style="animation-delay:${i * 0.07}s">
        <div class="menu-card__img" style="background:${m.bg}">
          ${drinkSVG({ ...m.c, foam: !!m.foam, nata: !!m.nata, ice: m.ice ?? 2, pearls: 16 })}
        </div>
        <div class="menu-card__body">
          ${m.badge ? `<span class="menu-card__badge${m.top ? ' menu-card__badge--top' : ''}">${m.badge}</span>` : ''}
          <h3 class="menu-card__name">${m.name}</h3>
          <p class="menu-card__en">${m.en}</p>
          <p class="menu-card__desc">${m.desc}</p>
          <p class="menu-card__price">¥${yen(m.price)}<small>（税込）</small></p>
        </div>
      </article>`).join('');
  };
  const select = (tab, focus = false) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    grid.setAttribute('aria-labelledby', tab.id);
    render(tab.dataset.cat);
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next, true);
    });
  });
  render('milk');
}

/* ---------- ギャラリー ---------- */
function initGallery() {
  const grid = $('#igGrid');
  grid.innerHTML = TILES.map((t, i) => `
    <li class="ig__item">
      <button type="button" aria-label="${t.alt}（いいね ${t.likes}）">
        <svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">${t.svg()}</svg>
      </button>
      <span class="ig__over" aria-hidden="true"><span>♡ <b>${t.likes}</b></span><span>💬 <b>${t.comments}</b></span></span>
      <svg class="ig__heart" viewBox="-14 -2 28 24" aria-hidden="true"><path d="M0 6C-6-2-14 2-12 9-10 15 0 21 0 21S10 15 12 9C14 2 6-2 0 6Z" fill="#fff"/></svg>
    </li>`).join('');

  // タップで「いいね」風のハートが弾む
  $$('.ig__item', grid).forEach((item) => {
    const heart = $('.ig__heart', item);
    $('button', item).addEventListener('click', () => {
      $$('.ig__item.is-open', grid).forEach((o) => o !== item && o.classList.remove('is-open'));
      item.classList.toggle('is-open');
      heart.classList.remove('is-pop'); void heart.offsetWidth; heart.classList.add('is-pop');
    });
  });
}

/* ---------- ヒーロー（スクロールで味が変わる） ---------- */
function initHero(mqPC) {
  const hero = $('#hero');
  const fallback = $('#heroFallback');
  const layers = $$('.hero__layer', hero);
  const dots = $$('.hero__dots button', hero);
  let drink = null;
  let seg = -1;
  let ticking = false;

  // PC と スマホで、カップの置き場所を変える（x, y は画面の -1〜1）
  const POSES_PC = [
    { x: 0.4, y: -0.04, s: 1.0 },
    { x: -0.38, y: -0.04, s: 0.94 },
    { x: 0.38, y: -0.04, s: 0.94 },
    { x: -0.38, y: -0.04, s: 0.94 },
  ];
  const POSES_SP = [
    { x: 0, y: 0.4, s: 0.5 },
    { x: -0.06, y: 0.33, s: 0.6 },
    { x: 0.06, y: 0.33, s: 0.6 },
    { x: -0.06, y: 0.33, s: 0.6 },
  ];

  // 縦が短いスマホでは、カップを少し小さく・上にして文字と重ならないようにする
  const posesNow = () => {
    if (mqPC.matches) return POSES_PC;
    const k = clamp((window.innerHeight - 560) / 240, 0, 1);
    return POSES_SP.map((q) => ({ x: q.x, y: q.y + (1 - k) * 0.06, s: q.s * (0.8 + 0.2 * k) }));
  };

  const progress = () => {
    const total = hero.offsetHeight - window.innerHeight;
    return clamp(-hero.getBoundingClientRect().top / Math.max(1, total), 0, 1);
  };

  function setSeg(n) {
    if (n === seg) return;
    seg = n;
    const key = FLAVOR_ORDER[n];
    hero.dataset.flavor = key;
    hero.dataset.seg = String(n);
    layers.forEach((l) => l.classList.toggle('is-active', Number(l.dataset.seg) === n));
    dots.forEach((d, i) => { d.classList.toggle('is-active', i === n); d.setAttribute('aria-current', i === n ? 'step' : 'false'); });
    if (drink) drink.setFlavor(FLAVORS[key]);
    else fallback.innerHTML = drinkSVG({ ...FLAVORS[key], ice: 2 });
    fallback.setAttribute('aria-label', `${FLAVORS[key].name}のイラスト`);
  }

  function update() {
    ticking = false;
    const p = progress();
    setSeg(Math.min(3, Math.floor(p * 4)));
    if (!drink) return;
    const poses = posesNow();
    const f = clamp(p * 4 - 0.5, 0, 3);
    const i = Math.min(2, Math.floor(f));
    const t = smoothstep(0.25, 0.75, f - i);
    const a = poses[i], b = poses[i + 1];
    drink.setPose({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t) });
    drink.setScrollRotation(p * Math.PI * 3);
  }
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);

  dots.forEach((d) => d.addEventListener('click', () => {
    const n = Number(d.dataset.go);
    const total = hero.offsetHeight - window.innerHeight;
    window.scrollTo({ top: hero.offsetTop + total * ((n + 0.4) / 4), behavior: 'smooth' });
  }));

  update();

  return {
    attach(scene) {
      drink = scene;
      drink.setFlavor(FLAVORS[FLAVOR_ORDER[Math.max(0, seg)]], true);
      drink.setPose(posesNow()[0], true);
      update();
      // ヒーローのカップをクリック／タップすると、ぷるん
      $('#heroStage').addEventListener('pointerdown', () => drink.bounce());
    },
  };
}

/* ---------- カスタマイズ ---------- */
function initCustom() {
  const form = $('#customForm');
  const chips = $('#baseChips');
  const sweet = $('#sweet');
  const sweetOut = $('#sweetOut');
  const totalEl = $('#totalPrice');
  const totalBox = $('.total__price');
  const summary = $('#summary');
  const fallback = $('#customFallback');
  let drink = null;
  let shown = 0;

  chips.innerHTML = FLAVOR_ORDER.map((k, i) => {
    const f = FLAVORS[k];
    return `<label class="chip"><input type="radio" name="base" value="${k}"${i === 0 ? ' checked' : ''}>
      <span class="chip__body"><span class="chip__dot" style="background:linear-gradient(${f.top},${f.bottom})"></span>
      <span class="chip__text">${f.short}<small>¥${yen(f.price)}</small></span></span></label>`;
  }).join('');

  const read = () => {
    const base = form.base.value;
    const sIdx = Number(sweet.value);
    const ice = Number(form.ice.value);
    const tops = $$('input[name="top"]:checked', form).map((i) => i.value);
    return { base, sweet: SWEET[sIdx], sIdx, ice, tops };
  };

  const animateTotal = (to) => {
    const from = shown, t0 = performance.now(), dur = 420;
    shown = to;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      totalEl.textContent = yen(Math.round(lerp(from, to, 1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    totalBox.classList.remove('is-purun'); void totalBox.offsetWidth; totalBox.classList.add('is-purun');
  };

  function apply(first = false) {
    const s = read();
    const f = FLAVORS[s.base];
    const total = f.price + s.tops.reduce((sum, t) => sum + TOPPINGS[t].price, 0);
    sweetOut.textContent = `${s.sweet}%`;
    sweet.setAttribute('aria-valuetext', `${s.sweet}%`);
    sweet.style.setProperty('--fill', `${(s.sIdx / 5) * 100}%`);
    summary.textContent = [f.name, `甘さ${s.sweet}%`, `氷${ICE[s.ice]}`, ...s.tops.map((t) => `+${TOPPINGS[t].name}`)].join('／');
    if (first) { shown = total; totalEl.textContent = yen(total); } else if (total !== shown) animateTotal(total);

    const look = { foam: s.tops.includes('foam'), nata: s.tops.includes('nata'), extraPearls: s.tops.includes('pearl') };
    if (drink) {
      drink.setFlavor(f);
      drink.setOptions({ sweet: s.sweet / 100, ice: s.ice, ...look });
    } else {
      fallback.innerHTML = drinkSVG({ ...f, sweet: s.sweet, ice: [0, 1, 2, 3][s.ice], foam: look.foam, nata: look.nata, pearls: look.extraPearls ? 30 : 18 });
    }
  }

  form.addEventListener('input', () => apply());
  form.addEventListener('change', () => { apply(); if (drink) drink.bounce(); });
  form.addEventListener('submit', (e) => e.preventDefault());
  apply(true);

  return {
    attach(scene) {
      drink = scene;
      drink.setPose({ x: 0, y: -0.02, s: 0.95 }, true);
      apply(true);
      const s = read();
      drink.setFlavor(FLAVORS[s.base], true);
    },
  };
}

/* ---------- お問い合わせ（Formspree） ---------- */
function initForm() {
  const form = $('#contactForm');
  const status = $('#formStatus');
  const msgs = {
    valueMissing: '入力してください。',
    typeMismatch: 'メールアドレスの形式で入力してください（例：you@example.com）。',
  };
  const check = (el) => {
    const err = $(`.form__err[data-for="${el.id}"]`, form);
    if (!err) return true;
    let text = '';
    if (el.validity.valueMissing) text = msgs.valueMissing;
    else if (el.validity.typeMismatch) text = msgs.typeMismatch;
    err.textContent = text;
    el.classList.toggle('is-invalid', !!text);
    el.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (text) el.setAttribute('aria-describedby', err.id || (err.id = `${el.id}-err`));
    return !text;
  };
  const fields = $$('input[required], textarea[required]', form);
  fields.forEach((el) => el.addEventListener('blur', () => check(el)));
  fields.forEach((el) => el.addEventListener('input', () => { if (el.classList.contains('is-invalid')) check(el); }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = fields.filter((el) => !check(el));
    if (bad.length) { bad[0].focus(); return; }
    const btn = $('button[type="submit"]', form);
    status.className = 'form__status';
    status.textContent = '';

    // ID 未設定（見本）のときは送信しない
    if (form.action.includes('YOUR_FORM_ID')) {
      status.classList.add('is-ok');
      status.textContent = '送信ありがとうございました！（見本サイトのため、実際には送信されていません）';
      form.reset();
      return;
    }

    btn.disabled = true;
    btn.textContent = '送信中…';
    try {
      const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      status.classList.add('is-ok');
      status.textContent = '送信ありがとうございました！2営業日以内にご返信します。';
      form.reset();
    } catch (err) {
      status.classList.add('is-ng');
      status.textContent = '送信できませんでした。時間をおいて、もう一度お試しください。';
    } finally {
      btn.disabled = false;
      btn.textContent = '送信する';
    }
  });
}
