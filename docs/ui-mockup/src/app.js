// 草圖的互動：狀態、按鍵、兩種檢視模式（互動試玩／全部畫面）。
(function () {
  const M = window.MOCK, R = window.Render, CO = M.COUNTRIES;
  const $ = s => document.querySelector(s);

  function freshState(p) {
    return {
      lang: p.lang, sysLang: 'zh', country: p.country, sb: p.sb, sim: 'ok', mode: 'w',
      route: 'home', htab: 0, tab: 1, range: 7, sort: 0, cat: 'veg', lpage: 0, ipc: p.ip,
      crop: CO[p.country].watch[0], area: CO[p.country].home, mkt: null,
      home: { IN: CO.IN.home, TW: CO.TW.home },
      watch: { IN: CO.IN.watch.slice(), TW: CO.TW.watch.slice() },
      recent: { IN: ['grapes', 'onion', 'garlic'], TW: ['mango', 'cabbage'] },
      ra: { IN: CO.IN.ra.slice(), TW: CO.TW.ra.slice() },
      unit: { IN: { ...CO.IN.unitDef }, TW: { ...CO.TW.unitDef } },
      focus: 0, sheet: null, sheetFocus: 0, voice: false, hist: [], onb: false, exited: null
    };
  }

  // 頁面偏好（只是方便，讀寫失敗也照常運作）
  const prefs = { mode: 'play', lang: 'zh', country: 'IN', ip: 'IN', sb: false, zoom: 1.5 };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem('ui-mockup-prefs-v4') || '{}')); } catch (e) { /* 忽略 */ }
  const q = new URLSearchParams(location.search);
  ['mode', 'lang', 'country', 'ip'].forEach(k => { if (q.get(k)) prefs[k] = q.get(k); });
  if (q.get('zoom')) prefs.zoom = +q.get('zoom');
  if (!['play', 'gallery'].includes(prefs.mode)) prefs.mode = 'play';
  if (!CO[prefs.country]) prefs.country = 'IN';
  const savePrefs = () => { try { localStorage.setItem('ui-mockup-prefs-v4', JSON.stringify(prefs)); } catch (e) { /* 忽略 */ } };

  let st = freshState(prefs);
  const scrollMemo = {};

  // ---------- 導覽 ----------
  const snap = () => ({ route: st.route, htab: st.htab, tab: st.tab, crop: st.crop, area: st.area, mkt: st.mkt, cat: st.cat, focus: st.focus, lpage: st.lpage });
  function push(route, patch) { st.hist.push(snap()); Object.assign(st, { route, focus: 0 }, patch || {}); }
  function back() {
    if (st.hist.length) { Object.assign(st, st.hist.pop()); return; }
    st.exited = { ...snap(), hist: [] }; st.route = 'exit'; st.focus = 0;
  }
  function reopen() { const e = st.exited; st.exited = null; Object.assign(st, e); }
  function setCountry(id) { st.country = id; st.crop = CO[id].watch[0]; st.area = st.home[id]; prefs.country = id; savePrefs(); }
  function pushRa(id) { st.ra[st.country] = [id, ...st.ra[st.country].filter(x => x !== id)].slice(0, 3); }
  function pickHome(id) { st.home[st.country] = id; pushRa(id); }
  const VIEWING = ['detail', 'mkts', 'mkt1'];
  // 詳情頁換的是「正在看的地區」，不改首頁的地區
  function chooseArea(id) { if (VIEWING.includes(st.route)) { st.area = id; pushRa(id); } else pickHome(id); }
  function recordRecent(id) { const r = st.recent[st.country]; st.recent[st.country] = [id, ...r.filter(x => x !== id)].slice(0, 5); }
  function openCrop(id, tab) { recordRecent(id); push('detail', { crop: id, area: st.home[st.country], tab }); }

  function activate(i) {
    const v = R.build(st, 'q');
    if (i >= v.n) return;
    st.focus = i;
    switch (st.route) {
      case 'home':
        if (st.htab === 1) { push('crops', { cat: v.ids[i] }); return; } // 全部作物 → 該分類的作物清單
        if (st.sim === 'error' && i === 0) { st.sim = 'ok'; st.focus = 0; syncToolbar(); return; }
        openCrop(v.ids[i - v.off], 1); return;
      case 'detail':
        if (st.sim === 'error') { st.sim = 'ok'; syncToolbar(); return; }
        if (st.tab === 2) { push('detail', { area: v.ids[i], tab: 1 }); return; } // 比價 → 開那個地區
        if (v.n === 2) { st.sim = 'ok'; syncToolbar(); st.tab = i === 0 ? 2 : 0; st.focus = 0; return; } // 今天還沒更新的兩個出口
        if (st.mode === 'r') { st.mode = 'w'; st.focus = 0; return; } // 沒有零售資料 → 看批發
        push('mkts'); return; // 行情頁的卡片 → 本地區各市場
      case 'mkts':
        if (st.mode === 'r') { st.mode = 'w'; return; }
        push('mkt1', { mkt: v.ids[i] }); return;
      case 'mkt1': while (st.route !== 'detail' && st.hist.length) back(); return; // 回到地區的零售價
      case 'crops': openCrop(v.ids[i], 1); return;
      case 'areas': { const id = v.ids[i]; if (id === 'country') { push('country'); return; } back(); chooseArea(id); return; }
      case 'area0': pickHome(v.ids[i]); st.onb = false; st.hist = []; Object.assign(st, { route: 'home', focus: 0, area: v.ids[i] }); return;
      case 'watch': {
        const w = st.watch[st.country], id = v.ids[i];
        st.watch[st.country] = w.includes(id) ? w.filter(x => x !== id) : [...w, id];
        return;
      }
      case 'settings': {
        const u = st.unit[st.country], n = CO[st.country].units.length;
        if (i === 0) { st.lang = st.lang === 'zh' ? 'en' : 'zh'; syncToolbar(); }
        if (i === 1) { setCountry(st.country === 'IN' ? 'TW' : 'IN'); syncToolbar(); }
        if (i === 2) push('areas');
        if (i === 3) u.w = (u.w + 1) % n;
        if (i === 4) u.r = (u.r + 1) % n;
        return;
      }
      case 'lang': {
        const id = v.ids[i];
        if (id === 'more') { push('langs', { lpage: 0 }); return; }
        st.lang = id === 'zh' ? 'zh' : 'en'; syncToolbar(); afterLang(); return; // 印地文尚未翻譯 → 英文
      }
      case 'langs': st.lang = 'en'; syncToolbar(); afterLang(); return;
      case 'loc': // 是 → 用推測的地區；不是 → 自己選國家和地區
        if (i === 0) { pickHome(M.IPGUESS[st.ipc].area); st.onb = false; st.hist = []; Object.assign(st, { route: 'home', focus: 0, area: st.home[st.country] }); }
        else push('country');
        return;
      case 'country': setCountry(v.ids[i]); syncToolbar(); if (st.onb) push('area0'); else back(); return;
    }
  }

  // 選完語言：猜得到位置就先問「是不是這裡」，猜不到就直接選國家
  function afterLang() {
    if (st.ipc !== 'none' && M.IPGUESS[st.ipc]) { setCountry(M.IPGUESS[st.ipc].country); syncToolbar(); push('loc'); }
    else push('country');
  }

  // ---------- 底部面板：選單、換地區、排序 ----------
  function openSheet(kind) { st.sheet = kind; st.sheetFocus = kind === 'sort' ? st.sort : 0; }
  function sheetAct(it) {
    const [kind, arg] = it.id.split(':');
    st.sheet = null;
    if (kind === 'area' && arg) chooseArea(arg);
    if (kind === 'area' && !arg) openSheet('area');
    if (kind === 'areas') push('areas');
    if (kind === 'sort') { st.sort = +arg; st.focus = 0; }
    if (kind === 'watchToggle') { const w = st.watch[st.country]; st.watch[st.country] = w.includes(st.crop) ? w.filter(x => x !== st.crop) : [...w, st.crop]; }
    if (kind === 'watch') push('watch');
    if (kind === 'refresh' && st.sim !== 'ok') { st.sim = 'ok'; syncToolbar(); }
    if (kind === 'help') push('help');
    if (kind === 'settings') push('settings');
  }

  const MENU_ROUTES = ['home', 'detail', 'crops', 'mkts', 'areas'];
  const PRICE_ROUTES = ['home', 'crops', 'detail', 'mkts', 'mkt1'];
  function press(k) {
    showKey(k);
    if (st.voice) { st.voice = false; if (['0', 'LSK', 'RSK'].includes(k)) return draw(); }
    if (st.route === 'exit') { if (k === 'Enter') reopen(); return draw(); }
    if (st.sheet) {
      const items = R.sheetItems(st), n = items.length;
      if (k === 'ArrowUp') st.sheetFocus = Math.max(0, st.sheetFocus - 1);
      else if (k === 'ArrowDown') st.sheetFocus = Math.min(n - 1, st.sheetFocus + 1);
      else if (k === 'Enter') sheetAct(items[st.sheetFocus]);
      else if (/^[1-9]$/.test(k) && +k <= n) sheetAct(items[+k - 1]);
      else if (k === 'LSK' || k === 'RSK') st.sheet = null;
      return draw();
    }
    if (k === 'RSK') { back(); return draw(); }
    if (k === 'LSK') { if (MENU_ROUTES.includes(st.route)) openSheet('menu'); return draw(); }
    if (k === '0') { if (st.route === 'detail' && st.tab === 1) st.voice = true; return draw(); } // 語音（加分項）只在行情頁
    if (k === '*') { // 全站：批發 ⇄ 零售（只在價格畫面有效）
      if (PRICE_ROUTES.includes(st.route)) { st.mode = st.mode === 'w' ? 'r' : 'w'; if (!['home', 'crops'].includes(st.route)) st.focus = 0; }
      return draw();
    }
    if (k === '#') { // 依頁面：換地區／7↔30 日／排序
      const d = st.route === 'detail';
      if (['home', 'crops', 'mkts'].includes(st.route) || (d && st.tab === 1)) openSheet('area');
      else if (d && st.tab === 0) st.range = st.range === 7 ? 30 : 7;
      else if (d && st.tab === 2) openSheet('sort');
      return draw();
    }
    const v = R.build(st, 'q');
    if (st.route === 'home' && (k === 'ArrowLeft' || k === 'ArrowRight')) { // 首頁分頁：關注｜全部作物
      if (st.htab === 0) { if (k === 'ArrowRight') { st.htab = 1; st.focus = 0; } return draw(); }
      const col = st.focus % 3; // 九宮格：◀ ▶ 在同一列裡移動，最左欄再按 ◀ 回到「關注」
      if (k === 'ArrowLeft') { if (col === 0) { st.htab = 0; st.focus = 0; } else st.focus -= 1; }
      else if (col < 2) st.focus += 1;
      return draw();
    }
    if (st.route === 'detail' && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      st.tab = Math.max(0, Math.min(2, st.tab + (k === 'ArrowLeft' ? -1 : 1))); st.focus = 0; return draw();
    }
    if (st.route === 'langs' && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      st.lpage = Math.max(0, Math.min(v.pages - 1, st.lpage + (k === 'ArrowLeft' ? -1 : 1))); st.focus = 0; return draw();
    }
    if (st.route === 'home' && st.htab === 1) { // 九宮格：上下一次跳一列
      const d = { ArrowUp: -3, ArrowDown: 3 }[k];
      if (d) { st.focus = Math.max(0, Math.min(8, st.focus + d)); return draw(); }
    }
    if (st.route === 'detail' && k === 'Enter' && v.n === 0) { st.tab = Math.min(2, st.tab + 1); st.focus = 0; return draw(); } // 走勢→行情→比價
    if (!v.n && (k === 'ArrowUp' || k === 'ArrowDown')) { scrollContent(k === 'ArrowDown' ? 1 : -1); return; } // 沒有可選項目的頁面：上下捲動內容
    if (k === 'ArrowUp' && v.n) st.focus = Math.max(0, st.focus - 1);
    else if (k === 'ArrowDown' && v.n) st.focus = Math.min(v.n - 1, st.focus + 1);
    else if (k === 'Enter') activate(st.focus);
    else if (/^[1-9]$/.test(k)) activate(+k - 1 + (st.route === 'home' && st.htab === 0 ? v.off || 0 : 0));
    draw();
  }

  // ---------- 畫面輸出 ----------
  function keepFocus(root, key) {
    const bd = root.querySelector('.bd'); if (!bd) return;
    const memoKey = root.dataset.slot, prev = scrollMemo[memoKey];
    bd.scrollTop = prev && prev.key === key ? prev.top : 0;
    const el = bd.querySelector('.f');
    if (el) {
      const top = el.offsetTop, bot = top + el.offsetHeight;
      if (top < bd.scrollTop + 4) bd.scrollTop = top - 6;
      else if (bot > bd.scrollTop + bd.clientHeight - 4) bd.scrollTop = bot - bd.clientHeight + 6;
      if (el === bd.querySelector('.card, .cell') && bot <= bd.clientHeight) bd.scrollTop = 0; // 第一項放得下時，連上方的說明一起露出來
    }
    scrollMemo[memoKey] = { key, top: bd.scrollTop };
  }
  function scrollContent(d) {
    ['#dev-q', '#dev-qq'].forEach(sel => {
      const root = $(sel), bd = root.querySelector('.bd'), memo = scrollMemo[root.dataset.slot];
      bd.scrollTop += d * Math.round(bd.clientHeight * 0.6);
      if (memo) memo.top = bd.scrollTop;
    });
  }
  const devHTML = (s, z, slot) => `<div class="device ${z}" data-slot="${slot}">${R.screen(s, z)}</div>`;

  // 畫面旁的按鍵盤：* 和 # 的小字跟著目前的頁面改變
  function fnLabels() {
    const F = M.STR.zh, d = st.route === 'detail';
    if (st.sheet || st.voice || !PRICE_ROUTES.includes(st.route)) return ['—', '—'];
    const star = F.modeAct[st.mode];
    if (['home', 'crops', 'mkts'].includes(st.route) || (d && st.tab === 1)) return [star, F.hint.area];
    if (d && st.tab === 0) return [star, st.range === 7 ? F.hint.d30 : F.hint.d7];
    if (d && st.tab === 2) return [star, F.hint.sort];
    return [star, '—'];
  }

  function drawPlay() {
    const key = [st.route, st.htab, st.tab, st.crop, st.area, st.mkt, st.cat, st.sort, st.range, st.sim, st.mode, st.lpage].join('|');
    $('#dev-q').innerHTML = R.screen(st, 'q');
    $('#dev-qq').innerHTML = R.screen(st, 'qq');
    keepFocus($('#dev-q'), key); keepFocus($('#dev-qq'), key);
    $('#route-now').textContent = routeName();
    const [a, b] = fnLabels();
    $('.pad-key[data-key="*"] small').textContent = a;
    $('.pad-key[data-key="#"] small').textContent = b;
  }

  const noRetailCrop = { IN: 'chilli', TW: 'cauliflower' };
  const PRESETS = [
    ['首次設定・選語言', { route: 'lang', onb: true }],
    ['首次設定・確認位置（網路位置推測）', { route: 'loc', onb: true }],
    ['語言・More／其他清單', { route: 'langs', onb: true }],
    ['首頁：地區行情（批發）', { route: 'home' }],
    ['首頁：按 * 看零售', { route: 'home', mode: 'r' }],
    ['首頁：連線失敗，先顯示舊資料', { route: 'home', sim: 'error' }],
    ['行情：批發（本地區各市場的入口卡片）', { route: 'detail', tab: 1 }],
    ['行情：零售', { route: 'detail', tab: 1, mode: 'r' }],
    ['行情：這個作物沒有零售資料', s => ({ route: 'detail', tab: 1, mode: 'r', crop: noRetailCrop[s.country] })],
    ['本地區各市場（卡片按 OK）', { route: 'mkts' }],
    ['走勢：30 日（# 切換）', { route: 'detail', tab: 0, range: 30 }],
    ['比價：各地區，價格高→低（預設）', { route: 'detail', tab: 2, sort: 0 }],
    ['比價：距離近→遠', { route: 'detail', tab: 2, sort: 2 }],
    ['比價頁按 #：排序面板', { route: 'detail', tab: 2, sheet: 'sort', sheetFocus: 0 }],
    ['首頁按 #：換地區面板', { route: 'home', sheet: 'area' }],
    ['選擇地區（全部）', { route: 'areas' }],
    ['左軟鍵選單', { route: 'home', sheet: 'menu' }],
    ['關於與資料說明', { route: 'help' }],
    ['首頁：全部作物（九宮格，◀ ▶ 切換）', { route: 'home', htab: 1 }],
    ['設定', { route: 'settings' }],
    ['離開後重開', { route: 'exit' }]
  ];
  function drawGallery() {
    $('#gallery').innerHTML = PRESETS.map((p, i) => {
      const s = freshState(prefs);
      Object.assign(s, typeof p[1] === 'function' ? p[1](s) : JSON.parse(JSON.stringify(p[1])));
      return `<figure class="shot"><figcaption><span class="idx">${String(i + 1).padStart(2, '0')}</span>${p[0]}</figcaption>` +
        `<div class="pair">${devHTML(s, 'q', 'g' + i + 'q')}${devHTML(s, 'qq', 'g' + i + 'qq')}</div></figure>`;
    }).join('');
    document.querySelectorAll('#gallery .device').forEach(d => keepFocus(d, 'g'));
    if (q.get('audit')) audit();
  }

  // 版面檢查：列出每個畫面內容超出可視高度多少 px（清單可以捲動，固定畫面應該是 0）
  function audit() {
    const rows = [...document.querySelectorAll('#gallery .shot')].flatMap(fig => {
      const name = fig.querySelector('figcaption').textContent;
      return [...fig.querySelectorAll('.device')].map(d => {
        const bd = d.querySelector('.bd'), over = bd.scrollHeight - bd.clientHeight;
        return `${over > 0 ? 'OVER' : 'ok  '} ${String(over).padStart(4)}px  ${d.classList.contains('qq') ? '128×160' : '240×320'}  ${name}`;
      });
    });
    let pre = document.getElementById('audit');
    if (!pre) { pre = document.createElement('pre'); pre.id = 'audit'; document.body.appendChild(pre); }
    pre.textContent = rows.join('\n');
  }

  function draw() {
    document.documentElement.style.setProperty('--zoom', prefs.zoom);
    ['play', 'gallery'].forEach(m => { $('#mode-' + m).hidden = prefs.mode !== m; });
    if (prefs.mode === 'play') drawPlay(); else drawGallery();
  }

  const ROUTE_NAMES = { home: '首頁', detail: '作物詳情', loc: '首次設定・確認位置', mkts: '本地區各市場', mkt1: '單一市場', crops: '作物清單', areas: '選擇地區', area0: '首次設定・地區', watch: '編輯關注', settings: '設定', help: '關於與資料說明', lang: '首次設定・語言', langs: '其他語言', country: '選擇國家', exit: '已離開 App' };
  function routeName() {
    let n = ROUTE_NAMES[st.route] || st.route;
    if (st.route === 'detail') n += '・' + ['走勢', '行情', '比價'][st.tab];
    if (st.route === 'home') n += st.htab ? '・全部作物' : '・關注';
    n += st.mode === 'w' ? '・批發' : '・零售';
    if (st.sheet) n += '（面板開啟）';
    return `${n}　返回堆疊 ${st.hist.length} 層`;
  }
  const KEY_TEXT = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'OK', LSK: '左軟鍵', RSK: '右軟鍵' };
  function showKey(k) {
    $('#last-key').textContent = KEY_TEXT[k] || k;
    document.querySelectorAll('.pad-key').forEach(b => b.classList.toggle('hit', b.dataset.key === k));
  }

  // ---------- 工具列 ----------
  function syncToolbar() {
    prefs.lang = st.lang; prefs.country = st.country; savePrefs();
    document.querySelectorAll('[data-set]').forEach(b => {
      const [k, v] = b.dataset.set.split(':'), on = String(prefs[k]) === v;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    document.querySelectorAll('[data-sim]').forEach(b => { const on = b.dataset.sim === st.sim; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.set) {
      const [k, v] = b.dataset.set.split(':');
      const val = v === 'true' ? true : v === 'false' ? false : k === 'zoom' ? +v : v;
      prefs[k] = val; savePrefs();
      if (k === 'country') setCountry(val);
      if (k === 'ip') st.ipc = val;
      if (['lang', 'sb'].includes(k)) st[k] = val;
      syncToolbar(); draw(); return;
    }
    if (b.dataset.sim) { st.sim = b.dataset.sim; st.focus = 0; syncToolbar(); draw(); return; }
    if (b.dataset.key) { press(b.dataset.key); return; }
    if (b.id === 'restart') { st = freshState(prefs); Object.assign(st, { route: 'lang', onb: true }); syncToolbar(); draw(); }
    if (b.id === 'reset') { st = freshState(prefs); syncToolbar(); draw(); }
  });
  const KEYMAP = { Escape: 'LSK', Backspace: 'RSK', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Enter: 'Enter', '*': '*', '#': '#' };
  document.addEventListener('keydown', e => {
    if (prefs.mode !== 'play' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    let k = KEYMAP[e.key];
    if (!k && /^[0-9]$/.test(e.key)) k = e.key;
    if (!k) return;
    if (k === 'Enter' && e.target.closest && e.target.closest('button') && !e.target.closest('.pad-key')) return;
    e.preventDefault();
    if (e.repeat && !k.startsWith('Arrow')) return; // 長按只讓方向鍵連續觸發
    press(k);
  });

  syncToolbar();
  draw();
})();
