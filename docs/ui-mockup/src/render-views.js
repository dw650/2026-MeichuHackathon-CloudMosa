// 各畫面。每個函式回傳 { title, hdrKey, html, n（可聚焦項目數）, sk（三個軟鍵）, ids, speech }。
// 按鍵提示的原則：每個按鍵只在一個地方提示，就放在它控制的東西旁邊（* 在批發／零售標籤旁、# 在地區名稱或切換鈕旁、◀ ▶ 在分頁兩側）。
(function () {
  const R = window.RC, I = R.I, M = R.M;
  const { esc, S, t, nm, C, crop, area, areaName, unitLbl, tone, kc, fmt, pct, dir, pill, dateStr, TODAY, fresh, tileCrop, modeTag, quote } = R;
  const f = (s, i) => (s.focus === i ? ' f' : '');
  const SK = s => S(s).sk, H = s => S(s).hint;
  const num = (z, i) => (z === 'q' && i < 9 ? i + 1 : '');
  const ctx = (left, right, z) => `<div class="ctx"><span>${left}</span>${right && z === 'q' ? `<span>${right}</span>` : ''}</div>`;
  const stateBox = (icon, title, lines) => `<div class="state"><span class="tile">${I.ui(icon)}</span><span class="big2">${title}</span>${lines.map(l => `<span class="meta">${l}</span>`).join('')}</div>`;
  const chev = `<span class="go">${I.ui('chev')}</span>`;
  // * 永遠是批發／零售：鍵帽放在標籤旁
  const modeCtl = (s, z) => `${z === 'q' ? kc('*') : ''}${modeTag(s)}`;
  // 地區名稱；這一頁的 # 是「換地區」時才加鍵帽
  const areaLbl = (s, a, z, hash) => `${I.ui('pin')}<b>${esc(areaName(s, a))}</b>${hash && z === 'q' ? kc('#') : ''}`;
  // 分頁：兩側的 ◀ ▶ 提示用方向鍵切換
  const tabsHTML = (z, labels, active) => {
    const seg = `<div class="tabseg">${labels.map((x, i) => `<span class="${i === active ? 'on' : ''}">${x}</span>`).join('')}</div>`;
    return z === 'q' ? `<div class="tabwrap"><span class="arr">◀</span>${seg}<span class="arr">▶</span></div>` : seg;
  };
  const card = (s, i, icon, label, extra) => `<div class="card${f(s, i)}"><span class="tile">${I.ui(icon)}</span><span class="nm">${label}</span>${extra || chev}</div>`;
  const speechFor = (s, c, a, q) => (R.L(s) === 'zh'
    ? `「${nm(s, c)}，${areaName(s, a)}，今天${S(s).mode[s.mode]}價 ${fmt(s, q.p)}，單位${unitLbl(s)}，比前一交易日${q.st.chg >= 0 ? '漲' : '跌'} ${pct(q.st.chg)}。」`
    : `"${nm(s, c)} in ${areaName(s, a)}: ${S(s).mode[s.mode].toLowerCase()} ${fmt(s, q.p)} ${unitLbl(s)}, ${q.st.chg >= 0 ? 'up' : 'down'} ${pct(q.st.chg)}."`);

  // 作物卡（首頁、作物清單共用）：說明列只放品種，不是今天的資料才加註「昨天」等
  function cropRow(s, z, c, a, i, o) {
    const q = quote(s, c, a), fc = o.load ? '' : f(s, i), n = num(z, o.numIdx === undefined ? i : o.numIdx);
    const noData = q.p === null, fr = fresh(s, q.fresh);
    const meta = noData ? (s.mode === 'r' ? t(s, 'noRetail') : t(s, 'none'))
      : esc(nm(s, c.v)) + (!o.err && fr.cls ? ` · <span class="warn">${fr.txt}</span>` : !o.err && q.fresh === 1 ? ` · ${fr.txt}` : '');
    const tag = noData ? '' : o.err ? `<span class="pill old">${t(s, 'old')}</span>` : z === 'q' ? pill(q.st.chg) : '';
    const right = o.load ? '<span class="skel" style="width:38px"></span>' : `<span class="pr">${fmt(s, q.p)}</span>${noData ? '' : tag}`;
    if (z === 'qq') return `<div class="card${fc}${noData ? ' dim' : ''}">${tileCrop(c)}<span class="nm">${esc(nm(s, c))}</span><span class="rt" style="grid-auto-flow:column;gap:2px">${right}${o.load || o.err || noData ? '' : pill(q.st.chg, { noPct: true })}</span></div>`;
    return `<div class="card sp${fc}${noData ? ' dim' : ''}">${tileCrop(c, n)}<span class="two"><span class="nm">${esc(nm(s, c))}</span><span class="meta">${o.load ? '<span class="skel" style="width:50px"></span>' : meta}</span></span>` +
      `${o.load || noData ? '<span></span>' : R.spark(q.ser, dir(q.st.chg))}<span class="rt">${right}</span></div>`;
  }

  // 首頁：「關注｜全部作物」兩個分頁，◀ ▶ 切換
  function vHome(s, z) {
    const a = area(s, s.home[s.country]), err = s.sim === 'error', load = s.sim === 'loading';
    let h = ctx(`${modeCtl(s, z)} ${unitLbl(s)}`, `${I.ui('cal')}${dateStr(s, TODAY)}`, z) + tabsHTML(z, S(s).homeTabs, s.htab);
    const base = { title: t(s, 'home', { a: areaName(s, a) }), hdrKey: '#' };
    if (s.htab === 1) { // 全部作物：九宮格，格子位置和實體鍵 1–9 一致
      h += '<div class="g9">' + M.CATS.map((c, i) => `<div class="cell tn-${c.tone}${f(s, i)}">${kc(i + 1)}${I.crop(c.ic)}<span class="cn">${S(s).cats[i]}</span></div>`).join('') + '</div>';
      return { ...base, html: h, n: 9, ids: M.CATS.map(c => c.id), sk: [SK(s).menu, SK(s).open, SK(s).exit] };
    }
    const w = s.watch[s.country].map(id => crop(s, id));
    h += '<div class="list">';
    let off = 0;
    if (err) {
      h += `<div class="card alert${f(s, 0)}"><span class="tile">${I.ui('alert')}</span><span class="two"><span class="nm">${t(s, 'errT')}</span><span class="meta">${t(s, 'errSub')}</span></span><span></span></div>`;
      off = 1;
    }
    w.forEach((c, i) => { h += cropRow(s, z, c, a, i + off, { err, load, numIdx: i }); });
    h += '</div>';
    if (load) h += `<div class="state"><span class="meta">${t(s, 'loading', { m: areaName(s, a) })}…</span><span class="meta">${t(s, 'loadingNote')}</span></div>`;
    const fc = w[Math.max(0, Math.min(w.length - 1, s.focus - off))], fq = fc ? quote(s, fc, a) : { p: null };
    return {
      ...base, html: h, n: load ? 0 : w.length + off, ids: w.map(c => c.id), off,
      sk: [SK(s).menu, load ? '' : err && s.focus === 0 ? SK(s).retry : SK(s).open, SK(s).exit],
      speech: fq.p === null ? '' : speechFor(s, fc, a, fq)
    };
  }

  // 作物詳情：三個分頁 走勢｜行情｜比價；本地區各市場從行情頁的卡片進入
  function vDetail(s, z) {
    const a = area(s, s.area), c = crop(s, s.crop), q = quote(s, c, a), fr = fresh(s, q.fresh);
    const when = q.fresh === 0 ? `${TODAY.m}/${TODAY.d} ${C(s).time}` : `<span class="warn">${fr.txt}</span>`;
    let h = ctx(areaLbl(s, a, z, s.tab === 1), `${modeCtl(s, z)} ${when}`, z) + tabsHTML(z, S(s).tabs, s.tab);
    const base = { title: nm(s, c), speech: q.p === null ? '' : speechFor(s, c, a, q) };

    if (s.sim === 'loading') return { ...base, html: h + stateBox('refresh', t(s, 'loading', { m: areaName(s, a) }), [t(s, 'loadingNote')]), n: 0, sk: [SK(s).menu, '', SK(s).back] };
    if (s.sim === 'error') return { ...base, html: h + stateBox('alert', t(s, 'errT'), [t(s, 'errKeep')]) + `<div class="list">${card(s, 0, 'refresh', t(s, 'retry'), '<span></span>')}</div>`, n: 1, sk: [SK(s).menu, SK(s).retry, SK(s).back] };

    // 走勢、行情：這個地區沒有資料
    if (s.tab !== 2 && (q.p === null || (s.sim === 'empty' && s.tab === 1))) {
      if (s.mode === 'r' && q.p === null) {
        const why = c.rt ? t(s, 'retailNote') : t(s, 'noRetailCrop');
        h += stateBox('scale', t(s, 'noRetail'), z === 'q' ? [why] : []) + `<div class="list">${card(s, 0, 'scale', S(s).modeAct.r)}</div>`;
        return { ...base, html: h, n: 1, sk: [SK(s).menu, SK(s).select, SK(s).back] };
      }
      h += stateBox('store', t(s, 'emptyT', { m: esc(areaName(s, a)) }), z === 'q' ? [t(s, 'emptyNote'), t(s, 'emptyLast', { d: t(s, 'daysAgo', { n: 3 }), p: fmt(s, c.p * 1.04) })] : []);
      h += `<div class="list">${S(s).emptyA.map((x, i) => card(s, i, i ? 'trend' : 'store', x)).join('')}</div>`;
      return { ...base, html: h, n: 2, sk: [SK(s).menu, SK(s).select, SK(s).back] };
    }

    if (s.tab === 1) { // 行情
      const st = q.st, prev = q.p / (1 + st.chg);
      const lbl = s.mode === 'r' ? t(s, 'retailLbl') : q.n === 1 ? t(s, 'oneMkt') : t(s, 'medLbl', { n: q.n });
      h += '<div class="stack">';
      h += `<div class="box hero">${z === 'q' ? tileCrop(c) : ''}<div><div class="lbl"><span>${lbl} · ${unitLbl(s)}</span>${z === 'q' ? `<span class="lis">${kc('0')}${I.ui('speaker')}</span>` : ''}</div><div class="big">${fmt(s, q.p)}</div>` +
        `<div class="cl">${pill(st.chg)}<b style="color:var(--ink)">${fmt(s, q.p - prev, true)}</b>${z === 'q' ? ' ' + t(s, 'vsPrev') : ''}</div></div></div>`;
      let n = 0;
      if (s.mode === 'w') { // 本地區各市場的入口：按 OK 展開
        const mr = R.marketRows(s, c.id).filter(r => r.p !== null && r.m.fresh === 0), hi = mr[0], lo = mr[mr.length - 1];
        h += `<div class="card${f(s, 0)}"><span class="tile">${I.ui('store')}</span><span class="two"><span class="nm">${t(s, 'mktsCard', { n: a.markets.length })}</span>` +
          (z === 'q' && hi ? `<span class="meta">${t(s, 'mktsSub', { hi: fmt(s, hi.p), lo: fmt(s, lo.p) })}</span>` : '') + `</span><span class="okgo">${z === 'q' ? kc('OK') : ''}${I.ui('chev')}</span></div>`;
        n = 1;
      } else if (z === 'q') {
        h += `<div class="box note">${I.ui('info')} ${t(s, 'retailNote')}</div>`;
      }
      if (z === 'q') {
        const lvl = st.pos30 < 0.34 ? 0 : st.pos30 > 0.66 ? 2 : 1, ad = c.arrR - 1;
        const k1 = `<div class="kpi"><span class="k">${S(s).ind[0]}</span><span class="v ${dir(st.vsAvg)}">${st.vsAvg >= 0 ? '+' : '−'}${pct(st.vsAvg)}</span></div>`;
        const k2 = s.mode === 'w'
          ? `<div class="kpi"><span class="k">${S(s).ind[1]}</span><span class="v">${S(s).arr[st.arrIdx]} ${Math.abs(ad) < 0.05 ? '' : (ad > 0 ? '▲' : '▼') + pct(ad)}</span></div>`
          : `<div class="kpi"><span class="k">${t(s, 'volT')}</span><span class="v">${S(s).vol[st.volIdx]}</span></div>`;
        const k3 = `<div class="kpi"><span class="k">${S(s).ind[2]}</span><span class="v">${S(s).lvl[lvl]} ${Math.round(st.pos30 * 100)}%</span><span class="gauge"><i style="width:${Math.round(st.pos30 * 100)}%"></i></span></div>`;
        h += `<div class="kpis tn-${tone(c)}">${k1}${k2}${k3}</div>`;
      }
      h += '</div>';
      return { ...base, html: h, n, sk: [SK(s).menu, n ? SK(s).markets : SK(s).compare, SK(s).back] };
    }

    if (s.tab === 0) { // 走勢：# 切 7／30 日，鍵帽就在切換鈕旁
      const n = s.range === 30 ? 30 : 7, st = q.st, chg = n === 7 ? st.chg7 : st.chg30;
      h += `<div class="stack"><div class="box"><div class="sumrow"><span><b>${t(s, 'trend', { n })}</b> ${pill(chg)}</span>` +
        (z === 'q' ? `<span>${kc('#')}<span class="fk${n === 7 ? ' on' : ''}">${H(s).d7}</span><span class="fk${n === 30 ? ' on' : ''}">${H(s).d30}</span></span>` : '') + `</div>${R.chart(s, c, q.ser, n, z)}</div>`;
      if (z === 'q') {
        const lo = n === 7 ? st.lo7 : st.lo30, hi = n === 7 ? st.hi7 : st.hi30;
        h += `<div class="kpis tn-${tone(c)}"><div class="kpi"><span class="k">${t(s, 'hi')}</span><span class="v">${fmt(s, hi)}</span></div>` +
          `<div class="kpi"><span class="k">${t(s, 'lo')}</span><span class="v">${fmt(s, lo)}</span></div>` +
          `<div class="kpi"><span class="k">${t(s, 'volT')}</span><span class="v">${S(s).vol[st.volIdx]}</span></div></div>`;
      }
      h += '</div>';
      return { ...base, html: h, n: 0, sk: [SK(s).menu, SK(s).today, SK(s).back] };
    }

    // 比價：各地區排行；# 打開排序面板，鍵帽就在目前的排序旁
    const { rows, rank, total } = R.areaRows(s, c.id);
    h += `<div class="sortbar"><span>${I.ui('sort')}${z === 'q' ? kc('#') : ''}<b>${S(s).sorts[s.sort]}</b></span></div>`;
    if (z === 'q') h += `<div class="rankline">${rank ? t(s, 'rank', { a: esc(areaName(s, a)), r: rank, n: total }) : t(s, 'rankNone', { a: esc(areaName(s, a)) })}</div>`;
    h += '<div class="list">';
    rows.forEach((r, i) => {
      const fx = fresh(s, r.fresh), noData = r.p === null;
      const diff = noData ? '' : r.me ? `<span class="pill me">${t(s, 'youS')}</span>` : `<span class="pill ${dir(r.diff)}">${fmt(s, r.diff, true)}</span>`;
      if (z === 'qq') { h += `<div class="card${f(s, i)}${r.me ? ' me' : ''}${noData ? ' dim' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(nm(s, r.a.n))}</span><span class="rt">${noData ? '—' : diff}</span></div>`; return; }
      const meta = noData ? (s.mode === 'r' ? t(s, 'noRetail') : t(s, 'none'))
        : [r.me ? '' : t(s, 'dist', { k: r.km }), s.mode === 'w' ? t(s, 'mktsN', { n: r.n }) : '', fx.cls ? `<span class="warn">${fx.txt}</span>` : ''].filter(Boolean).join(' · ');
      h += `<div class="card${f(s, i)}${r.me ? ' me' : ''}${noData ? ' dim' : ''}"><span class="rank">${i + 1}</span><span class="two"><span class="nm">${esc(areaName(s, r.a))}</span><span class="meta">${meta}</span></span>` +
        `<span class="rt"><span class="pr">${fmt(s, r.p)}</span>${diff}</span></div>`;
    });
    h += '</div>';
    return { ...base, html: h, n: rows.length, ids: rows.map(r => r.a.id), sk: [SK(s).menu, SK(s).view, SK(s).back] };
  }

  // 本地區各市場（只有批發）：從行情頁的卡片按 OK 進入
  function vMkts(s, z) {
    const a = area(s, s.area), c = crop(s, s.crop);
    let h = ctx(areaLbl(s, a, z, true), `${modeCtl(s, z)} ${unitLbl(s)}`, z);
    if (s.mode === 'r') {
      h += stateBox('store', t(s, 'retailNote'), []) + `<div class="list">${card(s, 0, 'scale', S(s).modeAct.r)}</div>`;
      return { title: nm(s, c), html: h, n: 1, sk: [SK(s).menu, SK(s).select, SK(s).back] };
    }
    const rows = R.marketRows(s, c.id), med = R.price(s, c, a, 'w').p;
    if (z === 'q' && med !== null) h += `<div class="rankline">${t(s, 'vsMedV', { p: fmt(s, med) })}</div>`;
    h += '<div class="list">';
    rows.forEach((r, i) => {
      const fx = fresh(s, r.fresh), noData = r.p === null;
      const diff = noData ? '' : `<span class="pill ${dir(r.diff)}">${fmt(s, r.diff, true)}</span>`;
      h += z === 'q'
        ? `<div class="card${f(s, i)}${noData ? ' dim' : ''}"><span class="rank">${i + 1}</span><span class="two"><span class="nm">${esc(nm(s, r.m.n))}</span><span class="meta">${r.km} km${fx.cls || r.fresh === 1 ? ` · <span class="${fx.cls ? 'warn' : ''}">${fx.txt}</span>` : ''}</span></span><span class="rt"><span class="pr">${fmt(s, r.p)}</span>${diff}</span></div>`
        : `<div class="card${f(s, i)}${noData ? ' dim' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(nm(s, r.m.n))}</span><span class="rt">${noData ? '—' : fmt(s, r.p)}</span></div>`;
    });
    h += '</div>';
    return { title: nm(s, c), html: h, n: rows.length, ids: rows.map(r => r.m.id), sk: [SK(s).menu, SK(s).open, SK(s).back] };
  }

  // 單一市場
  function vMkt1(s, z) {
    const a = area(s, s.area), c = crop(s, s.crop), m = a.markets.find(x => x.id === s.mkt) || a.markets[0];
    let h = ctx(`${I.ui('store')}<b>${esc(nm(s, m.n))}</b>`, modeCtl(s, z), z);
    if (s.mode === 'r') {
      h += stateBox('store', t(s, 'mktNoRetail'), z === 'q' ? [t(s, 'retailNote')] : []) + `<div class="list">${card(s, 0, 'pin', t(s, 'seeAreaRetail', { a: esc(areaName(s, a)) }))}</div>`;
      return { title: nm(s, c), html: h, n: 1, sk: ['', SK(s).select, SK(s).back] };
    }
    const p = R.mktPrice(s, c, a, m), r = p === null ? 1 : p / c.p;
    if (p === null) return { title: nm(s, c), html: h + stateBox('store', t(s, 'none'), []), n: 0, sk: ['', '', SK(s).back] };
    const lo = c.lo * r, hi = c.hi * r, pos = Math.min(96, Math.max(4, ((p - lo) / (hi - lo)) * 100));
    h += `<div class="stack"><div class="box hero">${z === 'q' ? tileCrop(c) : ''}<div><div class="lbl"><span>${nm(s, C(s).rep)} · ${unitLbl(s)}</span></div><div class="big">${fmt(s, p)}</div>` +
      `<div class="cl">${pill(c.chg)}${z === 'q' ? ' ' + t(s, 'vsPrev') : ''}</div></div></div>` +
      `<div class="box rng tn-${tone(c)}"><div class="bar"><span class="fill"></span><span class="mk" style="left:${pos}%"></span></div><div class="ends"><span>${fmt(s, lo)}</span><span>${fmt(s, hi)}</span></div></div>` +
      (z === 'q' ? `<div class="srcl">${I.ui('shield')}${esc(nm(s, C(s).src))} · ${t(s, 'demo')}</div>` : '') + '</div>';
    return { title: nm(s, c), html: h, n: 0, sk: ['', '', SK(s).back] };
  }

  function cropsIn(s) {
    if (s.cat === 'recent') return s.recent[s.country].map(id => crop(s, id));
    if (s.cat === 'all') return C(s).crops;
    return C(s).crops.filter(c => c.cat === s.cat);
  }
  function vCrops(s, z) {
    const a = area(s, s.home[s.country]), list = cropsIn(s), ci = M.CATS.findIndex(c => c.id === s.cat);
    let h = ctx(areaLbl(s, a, z, true), `${modeCtl(s, z)} ${unitLbl(s)}`, z) + '<div class="list">';
    h += list.length ? list.map((c, i) => cropRow(s, z, c, a, i, {})).join('') : `<div class="state"><span class="meta">${t(s, 'none')}</span></div>`;
    h += '</div>';
    return { title: S(s).cats[ci], html: h, n: list.length, ids: list.map(c => c.id), sk: [SK(s).menu, SK(s).open, SK(s).back] };
  }

  // 地區清單：最近使用放前面，其他依距離；最後一項是「更改國家…」
  function areaOrder(s) {
    const cur = R.curAreaId(s), from = area(s, s.home[s.country]);
    const rec = [cur, ...s.ra[s.country].filter(id => id !== cur)];
    const rest = C(s).areas.filter(a => !rec.includes(a.id)).sort((x, y) => R.distKm(from, x) - R.distKm(from, y));
    return { list: [...rec.map(id => area(s, id)), ...rest], nRec: rec.length, from };
  }
  function vAreas(s, z, onb) {
    const { list, nRec, from } = areaOrder(s);
    let h = onb ? `<div class="steps"><i></i><i></i><i class="on"></i></div>` : '';
    h += '<div class="list">';
    list.forEach((a, i) => {
      if (z === 'q' && !onb && i === 0) h += `<div class="sec">${t(s, 'recent')}</div>`;
      if (z === 'q' && !onb && i === nRec) h += `<div class="sec">${t(s, 'allAreas')}</div>`;
      const fx = fresh(s, a.fresh), tn = a.fresh === null ? 'slate' : fx.cls ? 'amber' : 'green', km = R.distKm(from, a);
      const status = a.fresh === 0 ? '' : ` <span class="${fx.cls ? 'warn' : ''}">${fx.txt}</span>`;
      h += `<div class="card${f(s, i)}"><span class="tile tn-${tn}">${I.ui('pin')}${num(z, i) ? kc(num(z, i)) : ''}</span>` +
        `<span class="two"><span class="nm">${esc(areaName(s, a))}${a.id === R.curAreaId(s) && !onb ? ' ✓' : ''}</span>${z === 'q' ? `<span class="meta">${esc(nm(s, a.st))}${km ? ' · ' + t(s, 'dist', { k: km }) : ''}</span>` : ''}</span>` +
        `${z === 'q' ? `<span class="rt"><span class="meta"><i class="dot ${fx.cls || (a.fresh === null ? 'none' : '')}"></i>${status}</span></span>` : '<span></span>'}</div>`;
    });
    const ids = list.map(a => a.id);
    if (!onb) { h += card(s, list.length, 'globe', t(s, 'changeCountry')); ids.push('country'); }
    h += '</div>';
    return { title: onb ? t(s, 'area0') : t(s, 'pickArea'), html: h, n: ids.length, ids, sk: ['', SK(s).select, SK(s).back] };
  }

  function vWatch(s, z) {
    const cs = C(s).crops, w = s.watch[s.country];
    const h = '<div class="list">' + cs.map((c, i) => `<div class="card${f(s, i)}">${tileCrop(c)}<span class="two"><span class="nm">${esc(nm(s, c))}</span>${z === 'q' ? `<span class="meta">${esc(nm(s, c.v))}</span>` : ''}</span><span class="chk${w.includes(c.id) ? ' on' : ''}">${w.includes(c.id) ? I.ui('check') : ''}</span></div>`).join('') + '</div>';
    return { title: t(s, 'watch'), html: h, n: cs.length, ids: cs.map(c => c.id), sk: ['', SK(s).toggle, SK(s).back] };
  }

  function vSettings(s, z) {
    const rows = S(s).setRows, ics = ['globe', 'pin', 'store', 'scale', 'scale'];
    const vals = [s.lang === 'zh' ? '繁體中文' : 'English', nm(s, C(s).name), areaName(s, area(s, s.home[s.country])), unitLbl(s, 'w'), unitLbl(s, 'r')];
    const h = '<div class="list">' + rows.map((r, i) => `<div class="card cmp${f(s, i)}"><span class="tile">${I.ui(ics[i])}${num(z, i) ? kc(num(z, i)) : ''}</span><span class="nm">${r}</span>${z === 'q' ? `<span class="val">${esc(vals[i])}</span>` : '<span></span>'}</div>`).join('') + '</div>';
    return { title: t(s, 'settings'), html: h, n: rows.length, sk: ['', SK(s).toggle, SK(s).back] };
  }

  // 關於與資料說明（合併成一頁）
  function vHelp(s, z) {
    const A = S(s).aboutL;
    const h = `<div class="stack" style="padding-top:4px">${S(s).helpL.map(x => `<div class="box meta">${x}</div>`).join('')}` +
      `<div class="box meta"><b style="color:var(--ink)">${A[0]}</b>：${esc(nm(s, C(s).src))}</div><div class="box meta">${A.slice(2).join(R.L(s) === 'zh' ? '' : ' ')}</div></div>`;
    return { title: t(s, 'help'), html: h, n: 0, sk: ['', '', SK(s).back] };
  }

  // 語言：手機語言排第一，再來是另外兩個語言，最後是「More・其他」
  function langOrder(s) { const L = M.LANGS, sys = L.find(l => l.id === s.sysLang); return sys ? [sys, ...L.filter(l => l !== sys)] : L; }
  function vLang(s, z) {
    const list = langOrder(s);
    let h = `<div class="steps"><i class="on"></i><i></i><i></i></div><div class="list">`;
    list.forEach((l, i) => {
      const meta = l.id === s.sysLang ? t(s, 'phoneLang') : !l.ok ? `→ English・${t(s, 'notYet')}` : '';
      h += `<div class="card cmp${f(s, i)}"><span class="tile tn-${l.tone}" style="font-weight:900">${l.g}</span><span class="two"><span class="nm">${l.name}</span>${z === 'q' && meta ? `<span class="meta">${meta}</span>` : ''}</span><span></span></div>`;
    });
    h += `<div class="card cmp${f(s, list.length)}"><span class="tile tn-blue">${I.ui('globe')}</span><span class="two"><span class="nm">${t(s, 'more')}</span>${z === 'q' ? `<span class="meta">${t(s, 'moreSub')}</span>` : ''}</span>${chev}</div></div>`;
    return { title: t(s, 'langT'), html: h, n: list.length + 1, ids: [...list.map(l => l.id), 'more'], sk: ['', SK(s).select, SK(s).exit] };
  }
  function vLangs(s, z) {
    const per = 4, pages = Math.ceil(M.MORE_LANGS.length / per), pg = Math.min(s.lpage, pages - 1), items = M.MORE_LANGS.slice(pg * per, pg * per + per);
    let h = `<div class="rankline">◀ ${t(s, 'page', { a: pg + 1, b: pages })} ▶</div><div class="list">`;
    items.forEach((x, i) => { h += `<div class="card cmp${f(s, i)}"><span class="tile tn-slate">${I.ui('globe')}${num(z, i) ? kc(num(z, i)) : ''}</span><span class="two"><span class="nm" dir="auto">${x}</span>${z === 'q' ? `<span class="meta">→ English・${t(s, 'notYet')}</span>` : ''}</span><span></span></div>`; });
    h += '</div>';
    return { title: t(s, 'more'), html: h, n: items.length, ids: items, pages, sk: ['', SK(s).select, SK(s).back] };
  }
  function vCountry(s, z) {
    const ids = ['IN', 'TW'];
    let h = s.onb ? `<div class="steps"><i></i><i class="on"></i><i></i></div>` : '';
    h += '<div class="list">' + ids.map((id, i) => `<div class="card${f(s, i)}"><span class="tile tn-${i ? 'red' : 'orange'}">${I.ui('globe')}${num(z, i) ? kc(num(z, i)) : ''}</span><span class="two"><span class="nm">${nm(s, M.COUNTRIES[id].name)}</span>${z === 'q' ? `<span class="meta">${nm(s, M.COUNTRIES[id].cover)}</span>` : ''}</span><span></span></div>`).join('') + '</div>';
    return { title: t(s, 'countryT'), html: h, n: 2, ids, sk: ['', SK(s).select, SK(s).back] };
  }
  // 首次設定：依網路位置（X-Forwarded-For 的 IP）推測地區，讓使用者確認
  function vLoc(s, z) {
    const a = area(s, M.IPGUESS[s.ipc].area);
    let h = `<div class="steps"><i></i><i class="on"></i><i></i></div>`;
    h += `<div class="state"><span class="tile">${I.ui('pin')}</span><span class="big2 locq">${t(s, 'ipQ', { a: esc(areaName(s, a)) })}</span>${z === 'q' ? `<span class="meta">${esc(nm(s, a.st))} · ${nm(s, C(s).name)}</span><span class="meta">${t(s, 'ipHow')}</span>` : ''}</div>`;
    h += `<div class="list"><div class="card cmp${f(s, 0)}"><span class="tile tn-green">${I.ui('check')}${z === 'q' ? kc(1) : ''}</span><span class="nm">${t(s, 'ipYes')}</span>${chev}</div>` +
      `<div class="card cmp${f(s, 1)}"><span class="tile">${I.ui('grid')}${z === 'q' ? kc(2) : ''}</span><span class="nm">${t(s, 'ipNo')}</span>${chev}</div></div>`;
    return { title: t(s, 'ipT'), html: h, n: 2, ids: ['yes', 'no'], sk: ['', SK(s).select, SK(s).back] };
  }
  function vExit(s, z) {
    const h = `<div class="os"><div class="apps"><span></span>${I.LOGO}<span></span><span></span><span></span><span></span></div><b>${t(s, 'exitT')}</b>${z === 'q' ? `<span class="meta">${t(s, 'exitN')}</span>` : ''}</div>`;
    return { title: 'Cloud Phone', html: h, n: 0, sk: ['', SK(s).open, ''] };
  }

  const VIEWS = {
    home: vHome, detail: vDetail, mkts: vMkts, mkt1: vMkt1, crops: vCrops, areas: (s, z) => vAreas(s, z, false), area0: (s, z) => vAreas(s, z, true),
    watch: vWatch, settings: vSettings, help: vHelp, lang: vLang, langs: vLangs, country: vCountry, loc: vLoc, exit: vExit
  };
  const build = (s, z) => (VIEWS[s.route] || vHome)(s, z);
  const screen = (s, z) => R.shell(s, z, build(s, z));

  window.Render = { build, screen, sheetItems: R.sheetItems };
})();
