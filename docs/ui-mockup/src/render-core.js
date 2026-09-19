// 畫面共用：格式化、地區價計算、指標、走勢圖、外框與底部面板。
(function () {
  const M = window.MOCK, I = window.ICON;
  const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const L = s => (s.lang === 'zh' ? 'zh' : 'en');
  const S = s => M.STR[L(s)];
  const t = (s, k, v) => { let x = S(s)[k]; if (v) for (const [a, b] of Object.entries(v)) x = x.split('{' + a + '}').join(b); return x; };
  const nm = (s, o) => (o == null ? '' : typeof o === 'string' ? o : o[L(s)]);
  const C = s => M.COUNTRIES[s.country];
  const crop = (s, id) => C(s).crops.find(c => c.id === id) || C(s).crops[0];
  const area = (s, id) => C(s).areas.find(a => a.id === id) || C(s).areas[0];
  const areaName = (s, a) => nm(s, a.n) + nm(s, C(s).sfx);
  const curAreaId = s => (['detail', 'mkts', 'mkt1'].includes(s.route) ? s.area : s.home[s.country]);
  const unit = (s, mode) => C(s).units[s.unit[s.country][mode || s.mode]];
  const unitLbl = (s, mode) => nm(s, unit(s, mode));
  const tone = c => M.TONE_OF[c.cat] || 'slate';
  const kc = k => `<span class="kc">${k}</span>`;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const median = a => { const b = [...a].sort((x, y) => x - y), h = b.length >> 1; return b.length % 2 ? b[h] : (b[h - 1] + b[h]) / 2; };

  function fmt(s, v, signed, mode) {
    if (v === null || v === undefined) return '—';
    const u = unit(s, mode), x = v * u.f;
    const f = new Intl.NumberFormat(C(s).locale, { minimumFractionDigits: u.dec, maximumFractionDigits: u.dec });
    if (!signed) return f.format(x);
    const r = Number(x.toFixed(u.dec));
    return (r > 0 ? '+' : r < 0 ? '−' : '±') + f.format(Math.abs(r));
  }
  const pct = p => { const a = Math.abs(p) * 100; return a < 0.05 ? '0%' : (a >= 10 ? a.toFixed(0) : a.toFixed(1)) + '%'; };
  const dir = p => (Math.abs(p) < 0.0005 ? 'eq' : p > 0 ? 'up' : 'dn');
  const glyph = d => ({ up: '▲', dn: '▼', eq: '＝' }[d]);
  const pill = (p, opt) => { const d = dir(p); return `<span class="pill ${d}">${glyph(d)}${opt && opt.noPct ? '' : pct(p)}</span>`; };
  const dateStr = (s, x) => t(s, 'date', { m: x.m, d: x.d, w: S(s).wd[x.wd] });
  const TODAY = { m: 9, d: 19, wd: 6 };
  function fresh(s, d) {
    if (d === null) return { txt: t(s, 'none'), cls: 'none' };
    if (d === 0) return { txt: t(s, 'today'), cls: '' };
    if (d === 1) return { txt: t(s, 'yday'), cls: '' };
    return { txt: t(s, 'daysAgo', { n: d }), cls: 'stale' };
  }
  const tileCrop = (c, num) => `<span class="tile tn-${tone(c)}">${I.crop(c.id)}${num ? kc(num) : ''}</span>`;
  const modeTag = s => `<span class="mtag ${s.mode}">${S(s).mode[s.mode]}</span>`;

  // ---------- 價格 ----------
  // 單一市場的批發代表價（印度＝常見價、台灣＝平均價）
  function mktPrice(s, c, a, m) {
    if (a.fresh === null || m.fresh === null) return null;
    return c.p * a.k * m.k * (1 + (M.seeded(s.country + c.id + a.id + m.id)() - 0.5) * 0.04);
  }
  // 地區價：批發＝今日有報價的市場代表價中位數；零售＝地區的零售調查價
  function price(s, c, a, mode) {
    const md = mode || s.mode;
    if (md === 'r') {
      if (!a.retail || !c.rt || a.fresh === null) return { p: null, n: 0 };
      return { p: c.p * c.rt * a.k * (1 + (M.seeded(s.country + c.id + a.id + 'r')() - 0.5) * 0.05), n: 1 };
    }
    const ps = a.markets.filter(m => m.fresh === 0).map(m => mktPrice(s, c, a, m)).filter(v => v !== null);
    return ps.length ? { p: median(ps), n: ps.length } : { p: null, n: 0 };
  }
  const freshOf = (c, a) => (a.fresh === null ? null : Math.max(a.fresh, c.f));

  // 30 天序列：批發依價格水準縮放；零售變動比較慢（和今日價各半平均）
  function seriesFor(s, c, p, mode) {
    if (p === null) return null;
    const r = p / c.p;
    return M.series(s.country, c).map(x => ({ ...x, v: x.v === null ? null : (mode === 'r' ? r * (0.5 * c.p + 0.5 * x.v) : r * x.v) }));
  }
  function stats(ser, c, mode) {
    const w7 = ser.slice(-7), v7 = w7.filter(x => x.v !== null).map(x => x.v), v30 = ser.filter(x => x.v !== null).map(x => x.v);
    const p = ser[29].v, lo30 = Math.min(...v30), hi30 = Math.max(...v30);
    let sw = 0; for (let i = 1; i < v7.length; i++) sw += Math.abs(v7[i] / v7[i - 1] - 1);
    const vol = sw / (v7.length - 1);
    return {
      w7, p, chg: v30[v30.length - 1] / v30[v30.length - 2] - 1, avg7: mean(v7), vsAvg: p / mean(v7) - 1,
      hi7: Math.max(...v7), lo7: Math.min(...v7), chg7: v7[v7.length - 1] / v7[0] - 1,
      avg30: mean(v30), chg30: v30[v30.length - 1] / v30[0] - 1, hi30, lo30, pos30: (p - lo30) / (hi30 - lo30 || 1),
      volIdx: vol < 0.02 ? 0 : vol < 0.045 ? 1 : 2, arrIdx: mode === 'r' ? null : c.arrR < 0.9 ? 0 : c.arrR > 1.1 ? 2 : 1
    };
  }
  // 一次算好某作物在某地區的價格、序列與指標
  function quote(s, c, a, mode) {
    const md = mode || s.mode, pr = price(s, c, a, md), ser = seriesFor(s, c, pr.p, md);
    return { ...pr, ser, st: ser ? stats(ser, c, md) : null, fresh: freshOf(c, a) };
  }

  // 直線距離（km）：地區中心之間，不是路程
  function distKm(a, b) {
    const R = 6371, rad = x => x * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }

  // 比價：各地區（基準＝目前看的地區），四種排序；沒資料的放最後
  function areaRows(s, cid) {
    const c = crop(s, cid), base = area(s, s.area), bp = price(s, c, base).p;
    const rows = C(s).areas.map(a => {
      const pr = price(s, c, a);
      return { a, p: pr.p, n: pr.n, km: distKm(base, a), me: a.id === base.id, fresh: freshOf(c, a), diff: pr.p === null || bp === null ? null : pr.p - bp };
    });
    const by = [(x, y) => y.p - x.p, (x, y) => x.p - y.p, (x, y) => x.km - y.km, (x, y) => y.km - x.km][s.sort];
    rows.sort((x, y) => (x.p === null) - (y.p === null) || by(x, y));
    const ranked = rows.filter(r => r.p !== null).map(r => r.p).sort((x, y) => y - x);
    const me = rows.find(r => r.me);
    return { rows, rank: me.p === null ? null : ranked.indexOf(me.p) + 1, total: ranked.length };
  }
  // 地區底下的各市場（只有批發）
  function marketRows(s, cid) {
    const c = crop(s, cid), a = area(s, s.area), med = price(s, c, a, 'w').p;
    return a.markets.map(m => {
      const p = mktPrice(s, c, a, m);
      return { m, p, km: m.km, fresh: m.fresh === null ? null : Math.max(m.fresh, a.fresh || 0, c.f), diff: p === null || med === null ? null : p - med };
    }).sort((x, y) => (x.p === null) - (y.p === null) || y.p - x.p);
  }

  // 走勢圖：7 日或 30 日。休市日斷線，今日點加粗並標數字。
  function chart(s, c, ser, n, z) {
    const data = n === 7 ? ser.slice(-7) : ser, q = z === 'q';
    const W = q ? 216 : 114, H = q ? 112 : 58, pl = 3, pr = q ? 36 : 3, pt = q ? 16 : 10, pb = q ? 15 : 3;
    const vals = data.filter(x => x.v !== null).map(x => x.v), vmax = Math.max(...vals), vmin = Math.min(...vals);
    const padv = (vmax - vmin || vmax * 0.05) * 0.12, mn = vmin - padv, mx = vmax + padv;
    const X = i => pl + (i / (data.length - 1)) * (W - pl - pr), Y = v => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
    let g = '';
    if (q) [vmax, (vmax + vmin) / 2, vmin].forEach(v => {
      g += `<line class="gl" x1="${pl}" x2="${W - pr + 2}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${W - pr + 5}" y="${(Y(v) + 3).toFixed(1)}">${fmt(s, v)}</text>`;
    });
    data.forEach((x, i) => { if (x.v === null) g += `<rect class="band" x="${(X(i) - 3).toFixed(1)}" y="${pt}" width="6" height="${H - pt - pb}" rx="2"/>`; });
    const segs = []; let cur = [];
    data.forEach((x, i) => { if (x.v === null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([X(i), Y(x.v)]); });
    if (cur.length) segs.push(cur);
    const base = H - pb;
    segs.forEach(sg => {
      const d = sg.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
      if (sg.length > 1) g += `<path class="ar" d="${d}L${sg[sg.length - 1][0].toFixed(1)} ${base}L${sg[0][0].toFixed(1)} ${base}Z"/>`;
      g += `<path class="ln" d="${d}"/>`;
    });
    if (n === 7) data.forEach((x, i) => { if (x.v !== null && i < data.length - 1) g += `<circle class="pt" cx="${X(i).toFixed(1)}" cy="${Y(x.v).toFixed(1)}" r="2.3"/>`; });
    const last = data[data.length - 1].v, tx = X(data.length - 1), ty = Y(last);
    g += `<circle class="now" cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${q ? 4.5 : 3}"/>`;
    if (q) g += `<text class="tv" x="${(tx - 7).toFixed(1)}" y="${(ty - 8).toFixed(1)}" text-anchor="end">${fmt(s, last)}</text>`;
    if (q) data.forEach((x, i) => {
      const lab = x.v === null && n === 7 ? t(s, 'closedS') : n === 7 ? S(s).wd[x.wd].slice(0, L(s) === 'zh' ? 1 : 2) : [0, 7, 14, 21, 29].includes(i) ? `${x.m}/${x.d}` : '';
      if (lab) g += `<text class="${x.v === null ? 'cz' : ''}" x="${X(i).toFixed(1)}" y="${H - 3}" text-anchor="${n === 30 && i === 0 ? 'start' : n === 30 && i === 29 ? 'end' : 'middle'}">${lab}</text>`;
    });
    return `<svg class="chart tn-${tone(c)}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${g}</svg>`;
  }
  // 首頁的迷你走勢線（7 日）
  function spark(ser, d) {
    const pts = ser.slice(-7).filter(x => x.v !== null).map(x => x.v);
    const mn = Math.min(...pts), mx = Math.max(...pts), W = 38, H = 16;
    const xy = pts.map((v, i) => [(i / (pts.length - 1)) * (W - 3) + 1.5, H - 2 - ((v - mn) / (mx - mn || 1)) * (H - 4)]);
    const path = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''), e = xy[xy.length - 1];
    return `<svg class="spark ${d}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${e[0]}" cy="${e[1]}" r="2.2" fill="currentColor"/></svg>`;
  }

  // ---------- 底部面板：選單、換地區、排序 ----------
  function sheetItems(s) {
    if (s.sheet === 'area') {
      const cur = curAreaId(s);
      return [...s.ra[s.country].map(id => ({ id: 'area:' + id, ic: 'pin', label: areaName(s, area(s, id)), on: id === cur })), { id: 'areas', ic: 'grid', label: t(s, 'otherAreas') }];
    }
    if (s.sheet === 'sort') return S(s).sorts.map((x, i) => ({ id: 'sort:' + i, ic: 'sort', label: x, on: i === s.sort }));
    const items = [];
    if (s.route === 'detail') items.push({ id: 'watchToggle', ic: 'star', label: S(s).menuWatch[s.watch[s.country].includes(s.crop) ? 1 : 0] });
    const ids = ['area', 'watch', 'refresh', 'help', 'settings'], ics = ['pin', 'star', 'refresh', 'info', 'gear'];
    ids.forEach((id, i) => items.push({ id, ic: ics[i], label: S(s).menuG[i] }));
    return items;
  }
  const sheetTitle = s => (s.sheet === 'area' ? t(s, 'changeArea') : s.sheet === 'sort' ? t(s, 'sortT') : t(s, 'menu'));

  function shell(s, z, v) {
    let ov = '', sk = v.sk;
    if (s.sheet) {
      const items = sheetItems(s);
      const rows = items.map((it, i) => z === 'q'
        ? `<div class="opt${s.sheetFocus === i ? ' f' : ''}">${kc(i + 1)}${I.ui(it.ic)}<span>${esc(it.label)}</span>${it.on ? `<span class="on">${I.ui('check')}</span>` : ''}</div>`
        : `<div class="opt${s.sheetFocus === i ? ' f' : ''}">${kc(i + 1)}<span>${esc(it.label)}${it.on ? ' ✓' : ''}</span></div>`).join('');
      ov = `<div class="ov"><div class="sheet"><div class="grab"></div>${z === 'q' ? `<div class="st">${sheetTitle(s)}</div>` : ''}${rows}</div></div>`;
      sk = ['', S(s).sk.select, S(s).sk.close];
    } else if (s.voice) {
      const heights = [5, 9, 13, 8, 12, 6, 10, 14, 7, 11, 5, 9];
      ov = `<div class="ov"><div class="sheet"><div class="grab"></div><div class="voice"><span class="tile">${I.ui('speaker')}</span><div><b>${t(s, 'voice')}</b> <small class="meta">${t(s, 'voiceS')}</small>` +
        `<div class="wave">${heights.map(h => `<i style="height:${h}px"></i>`).join('')}</div>${z === 'q' ? `<p>${esc(v.speech || '')}</p>` : ''}</div></div></div></div>`;
      sk = ['', '', S(s).sk.close];
    }
    const up = C(s).upIsPos ? 'pos' : 'neg';
    return `<div class="scr ${z}" lang="${s.lang === 'zh' ? 'zh-Hant' : 'en'}" data-up="${up}" data-sb="${s.sb ? 1 : 0}">` +
      `<div class="sb">${z === 'q' ? '系統區（待實機確認）' : ''}</div>` +
      `<header class="hdr"><span class="ttl">${esc(v.title)}</span>${v.hdrKey && z === 'q' ? kc(v.hdrKey) : ''}</header>` +
      `<main class="bd">${v.html}</main>` +
      `<footer class="sk"><span class="l">${sk[0] || ''}</span><span class="c">${sk[1] || ''}</span><span class="r">${sk[2] || ''}</span></footer>${ov}</div>`;
  }

  window.RC = {
    M, I, esc, L, S, t, nm, C, crop, area, areaName, curAreaId, unit, unitLbl, tone, kc, fmt, pct, dir, glyph, pill, dateStr, TODAY, fresh,
    tileCrop, modeTag, mktPrice, price, quote, stats, distKm, areaRows, marketRows, chart, spark, sheetItems, shell
  };
})();
