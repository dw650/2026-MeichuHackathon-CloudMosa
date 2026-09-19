// UI 草圖用的示範資料。全部是假資料，數字只為了讓畫面像真的。
// 單位：地區（台灣＝縣市、印度＝縣 district）；市場是地區底下的細節。
(function () {
  const STR = {
    zh: {
      app: '農價', home: '{a}行情', wd: ['日', '一', '二', '三', '四', '五', '六'], date: '{m}/{d} 週{w}',
      mode: { w: '批發', r: '零售' }, modeAct: { w: '看零售', r: '看批發' },
      medLbl: '{n} 個市場中位數', oneMkt: '僅 1 個市場', retailLbl: '零售調查價',
      noRetail: '尚無零售資料', noRetailCrop: '這個作物沒有零售回報', retailNote: '零售價以地區為單位，沒有市場細項', homeTabs: ['關注', '全部作物'],
      mktsCard: '本地區 {n} 個市場', mktsSub: '最高 {hi}・最低 {lo}',
      tabs: ['走勢', '行情', '比價'], vsPrev: '較前一交易日',
      ipT: '你的位置', ipQ: '你在 {a} 附近嗎？', ipHow: '依網路位置推測（不用 GPS，也不保存）', ipYes: '是，就是這裡', ipNo: '不是，我自己選',
      ind: ['比 7 日均價', '到貨量', '30 日位置'], arr: ['偏少', '正常', '偏多'], lvl: ['低檔', '中段', '高檔'],
      vol: ['穩定', '普通', '劇烈'], volT: '波動', avg: '均價', hi: '高', lo: '低',
      demo: '示範資料', trend: '{n} 日走勢', closed: '休市', closedS: '休',
      sortT: '排序方式', sorts: ['價格 高→低', '價格 低→高', '距離 近→遠', '距離 遠→近'],
      youS: '你', rank: '{a} 價格排第 {r}／{n}', rankNone: '{a} 無資料，未列排名', dist: '直線 {k} km', mktsN: '{n} 市場',
      today: '今日', yday: '昨天', daysAgo: '{n} 天前', none: '無資料', old: '舊',
      loading: '正在取得 {m} 的行情', loadingNote: '超過 10 秒會顯示錯誤',
      errT: '連線失敗', errSub: '先顯示 09:12 的資料', retry: '重試', errKeep: '你的設定都還在',
      emptyT: '{m} 今天還沒更新', emptyNote: '這個地區通常 14:00 前更新', emptyLast: '最近一筆（{d}）：{p}',
      emptyA: ['看其他地區', '看走勢'],
      browse: '瀏覽作物', cats: ['穀物', '蔬菜', '水果', '豆類', '香料', '油籽', '其他', '全部', '最近'],
      pickArea: '選擇地區', recent: '最近使用', allAreas: '全部地區', upd: '已更新', otherAreas: '其他地區…', changeArea: '換地區',
      mktNoRetail: '這個市場沒有零售報價', seeAreaRetail: '看 {a} 的零售價', vsMedV: '與中位數 {p} 比較', changeCountry: '更改國家…',
      watch: '編輯關注', settings: '設定', help: '關於與資料說明',
      setRows: ['語言', '國家', '我的地區', '批發單位', '零售單位'],
      menu: '選單', menuG: ['換地區', '編輯關注', '重新整理', '關於與資料說明', '設定'],
      menuWatch: ['加入關注', '取消關注'],
      sk: { menu: '選單', open: '開啟', back: '返回', exit: '離開', select: '選取', close: '關閉', toggle: '切換', view: '查看', compare: '比價', trend: '走勢', today: '行情', retry: '重試', markets: '市場' },
      hint: { markets: '看市場', trend: '走勢', compare: '比價', listen: '聽', tabs: '分頁', open: '直接開啟', run: '直接執行', area: '換地區', sort: '排序', d7: '7 日', d30: '30 日' },
      langT: 'Language・語言', countryT: '選擇國家', area0: '你的地區', step: '第 {a} 步，共 {b} 步',
      welcome: '查各地今天的農產品價格', phoneLang: '手機語言', more: 'More・其他', moreSub: 'अन्य', notYet: '尚未提供',
      page: '第 {a}／{b} 頁',
      helpL: ['地區價＝該地區各市場代表價的中位數，並標出市場數。', '距離＝地區中心之間的直線距離，不是路程。',
        '零售價以地區為單位，沒有市場細項。', '批發和零售的差額不是利潤，還包含運費、損耗、包裝等成本。', '畫面上的價格都是示範資料。'],
      aboutL: ['資料來源', '畫面上的價格都是示範資料。', '本 App 不會向你要錢、', '密碼或驗證碼。'],
      exitT: '已離開 App（示意）', exitN: '按 OK 重新開啟，會回到剛才的畫面',
      voice: '語音播報', voiceS: '加分項・示意'
    },
    en: {
      app: 'AgriPrice', home: '{a} prices', wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], date: '{w} {d}/{m}',
      mode: { w: 'Wholesale', r: 'Retail' }, modeAct: { w: 'Retail', r: 'Wholesale' },
      medLbl: 'Median of {n} markets', oneMkt: 'Only 1 market', retailLbl: 'Retail survey price',
      noRetail: 'No retail data', noRetailCrop: 'No retail reports for this crop', retailNote: 'Retail prices are per area, not per market', homeTabs: ['Watchlist', 'All crops'],
      mktsCard: '{n} markets in this area', mktsSub: 'High {hi} · Low {lo}',
      tabs: ['Trend', 'Today', 'Compare'], vsPrev: 'vs last trading day',
      ipT: 'Your location', ipQ: 'Are you near {a}?', ipHow: 'Guessed from your network (no GPS, not stored)', ipYes: 'Yes, that’s right', ipNo: 'No, let me choose',
      ind: ['vs 7-day avg', 'Arrivals', '30-day level'], arr: ['Low', 'Normal', 'High'], lvl: ['Low', 'Mid', 'High'],
      vol: ['Calm', 'Normal', 'Choppy'], volT: 'Swing', avg: 'Avg', hi: 'High', lo: 'Low',
      demo: 'Demo data', trend: '{n}-day trend', closed: 'Closed', closedS: 'X',
      sortT: 'Sort by', sorts: ['Price high→low', 'Price low→high', 'Nearest first', 'Farthest first'],
      youS: 'You', rank: '{a}: price rank {r}/{n}', rankNone: '{a}: no data, not ranked', dist: '{k} km (straight)', mktsN: '{n} mkts',
      today: 'Today', yday: 'Yesterday', daysAgo: '{n}d ago', none: 'No data', old: 'Old',
      loading: 'Loading prices for {m}', loadingNote: 'Shows an error after 10 s',
      errT: 'Connection failed', errSub: 'Showing data from 09:12', retry: 'Retry', errKeep: 'Your settings are kept',
      emptyT: '{m}: no update yet', emptyNote: 'This area usually updates by 14:00', emptyLast: 'Last ({d}): {p}',
      emptyA: ['Other areas', 'See trend'],
      browse: 'Browse', cats: ['Cereals', 'Veg', 'Fruit', 'Pulses', 'Spices', 'Oilseed', 'Other', 'All', 'Recent'],
      pickArea: 'Choose area', recent: 'Recent', allAreas: 'All areas', upd: 'Updated', otherAreas: 'Other areas…', changeArea: 'Change area',
      mktNoRetail: 'No retail price for this market', seeAreaRetail: 'See {a} retail', vsMedV: 'Compared with median {p}', changeCountry: 'Change country…',
      watch: 'Watchlist', settings: 'Settings', help: 'About & data',
      setRows: ['Language', 'Country', 'My area', 'Wholesale unit', 'Retail unit'],
      menu: 'Menu', menuG: ['Change area', 'Watchlist', 'Refresh', 'About & data', 'Settings'],
      menuWatch: ['Add to watchlist', 'Remove from list'],
      sk: { menu: 'Menu', open: 'Open', back: 'Back', exit: 'Exit', select: 'Select', close: 'Close', toggle: 'Change', view: 'View', compare: 'Compare', trend: 'Trend', today: 'Today', retry: 'Retry', markets: 'Markets' },
      hint: { markets: 'Markets', trend: 'Trend', compare: 'Compare', listen: 'Listen', tabs: 'Tabs', open: 'Open', run: 'Run', area: 'Area', sort: 'Sort', d7: '7d', d30: '30d' },
      langT: 'Language・語言', countryT: 'Choose country', area0: 'Your area', step: 'Step {a} of {b}',
      welcome: "Today's crop prices, place by place", phoneLang: 'Phone language', more: 'More・其他', moreSub: 'अन्य', notYet: 'Not yet available',
      page: 'Page {a}/{b}',
      helpL: ['Area price = median of the area’s market prices; the market count is shown.', 'Distance = straight line between area centres, not road distance.',
        'Retail prices are per area; there is no market breakdown.', 'The retail–wholesale gap is not profit; it includes transport, loss and packing.', 'All prices shown are demo data.'],
      aboutL: ['Data source', 'All prices shown are demo data.', 'We never ask for money,', 'PINs or codes.'],
      exitT: 'App closed (demo)', exitN: 'Press OK to reopen where you left off',
      voice: 'Voice readout', voiceS: 'Bonus · demo'
    }
  };

  // 語言：首頁只放三個已完成的語言，其他放在「More・其他」清單
  const LANGS = [
    { id: 'zh', name: '繁體中文', g: '中', tone: 'green', ok: true }, { id: 'en', name: 'English', g: 'A', tone: 'blue', ok: true },
    { id: 'hi', name: 'हिन्दी', g: 'अ', tone: 'orange', ok: false }
  ];
  const MORE_LANGS = ['বাংলা', 'मराठी', 'Tiếng Việt', 'Kiswahili', 'اردو', 'தமிழ்', 'తెలుగు', 'Bahasa Indonesia'];

  // 分類：九宮格的位置和實體鍵 1–9 一致
  const CATS = [
    { id: 'cereal', ic: 'wheat', tone: 'amber' }, { id: 'veg', ic: 'cabbage', tone: 'green' },
    { id: 'fruit', ic: 'mango', tone: 'orange' }, { id: 'pulse', ic: 'soybean', tone: 'olive' },
    { id: 'spice', ic: 'chilli', tone: 'red' }, { id: 'oil', ic: 'oil', tone: 'yellow' },
    { id: 'other', ic: 'box', tone: 'slate' }, { id: 'all', ic: 'gridc', tone: 'blue' },
    { id: 'recent', ic: 'clockc', tone: 'purple' }
  ];
  const TONE_OF = Object.fromEntries(CATS.map(c => [c.id, c.tone]));

  // 地區 a：k＝價格水準、fresh＝批發資料新舊（0 今日、1 昨天、3 三天前、null 無資料）、retail＝有沒有零售回報
  const mk = (id, n, km, k, fresh) => ({ id, n, km, k, fresh: fresh === undefined ? 0 : fresh });
  const COUNTRIES = {
    IN: {
      name: { zh: '印度', en: 'India' }, cover: { zh: '6 個邦、11 個縣', en: '6 states, 11 districts' },
      locale: 'en-IN', time: '11:40', upIsPos: true, closedWd: 0, sfx: { zh: ' 縣', en: ' district' },
      src: { zh: 'Agmarknet・消費者事務部（印度政府）', en: 'Agmarknet · Dept of Consumer Affairs' },
      rep: { zh: '常見價', en: 'Modal price' }, arrUnit: { zh: '公擔', en: 'qtl' },
      units: [{ id: 'qtl', f: 1, dec: 0, zh: '₹/公擔', en: '₹/qtl' }, { id: 'kg', f: 0.01, dec: 1, zh: '₹/公斤', en: '₹/kg' }],
      unitDef: { w: 0, r: 1 }, home: 'nashik', ra: ['nashik', 'pune', 'ahmednagar'],
      areas: [
        { id: 'nashik', n: 'Nashik', st: 'Maharashtra', lat: 20.0, lon: 73.79, k: 1, fresh: 0, retail: true, markets: [
          mk('lasalgaon', 'Lasalgaon', 32, 1), mk('niphad', 'Niphad', 28, 0.99), mk('pimpalgaon', 'Pimpalgaon', 22, 1.055),
          mk('yeola', 'Yeola', 60, 1.043, 3), mk('chandvad', 'Chandvad', 55, 1.0), mk('manmad', 'Manmad', 70, 1.0, null),
          mk('nashikm', 'Nashik', 0, 1.017), mk('sinnar', 'Sinnar', 28, 0.98), mk('malegaon', 'Malegaon', 95, 1.03, 1), mk('satana', 'Satana', 88, 1.06)] },
        { id: 'pune', n: 'Pune', st: 'Maharashtra', lat: 18.52, lon: 73.86, k: 1.08, fresh: 0, retail: true, markets: [mk('pune1', 'Pune (Gultekdi)', 0, 1.02), mk('khed', 'Khed', 40, 0.97), mk('manchar', 'Manchar', 60, 0.99)] },
        { id: 'ahmednagar', n: 'Ahmednagar', st: 'Maharashtra', lat: 19.09, lon: 74.74, k: 0.97, fresh: 0, retail: false, markets: [mk('ahm', 'Ahmednagar', 0, 1), mk('rahuri', 'Rahuri', 35, 0.98), mk('sangamner', 'Sangamner', 70, 1.01)] },
        { id: 'jalgaon', n: 'Jalgaon', st: 'Maharashtra', lat: 21.0, lon: 75.56, k: 1.02, fresh: 1, retail: true, markets: [mk('jal', 'Jalgaon', 0, 1), mk('chalisgaon', 'Chalisgaon', 55, 0.98)] },
        { id: 'solapur', n: 'Solapur', st: 'Maharashtra', lat: 17.66, lon: 75.91, k: 0.95, fresh: 0, retail: true, markets: [mk('sol', 'Solapur', 0, 1), mk('pandharpur', 'Pandharpur', 65, 0.97)] },
        { id: 'indore', n: 'Indore', st: 'Madhya Pradesh', lat: 22.72, lon: 75.86, k: 1.05, fresh: 0, retail: true, markets: [mk('ind', 'Indore', 0, 1), mk('mhow', 'Mhow', 23, 0.98)] },
        { id: 'bengaluru', n: 'Bengaluru Urban', st: 'Karnataka', lat: 12.97, lon: 77.59, k: 1.18, fresh: 0, retail: true, markets: [mk('ypr', 'Yeshwanthpur', 0, 1.01), mk('binny', 'Binny Mill', 5, 0.99)] },
        { id: 'kolar', n: 'Kolar', st: 'Karnataka', lat: 13.14, lon: 78.13, k: 1.1, fresh: 3, retail: false, markets: [mk('kol', 'Kolar', 0, 1), mk('chintamani', 'Chintamani', 45, 0.98)] },
        { id: 'delhi', n: 'North Delhi', st: 'Delhi', lat: 28.7, lon: 77.1, k: 1.25, fresh: 0, retail: true, markets: [mk('azadpur', 'Azadpur', 0, 1.01), mk('narela', 'Narela', 18, 0.98)] },
        { id: 'kurnool', n: 'Kurnool', st: 'Andhra Pradesh', lat: 15.83, lon: 78.04, k: 0.92, fresh: null, retail: false, markets: [mk('kur', 'Kurnool', 0, 1, null)] },
        { id: 'agra', n: 'Agra', st: 'Uttar Pradesh', lat: 27.18, lon: 78.01, k: 1.12, fresh: 0, retail: true, markets: [mk('agr', 'Agra', 0, 1), mk('achhnera', 'Achhnera', 25, 0.97)] }
      ],
      crops: [
        { id: 'onion', zh: '洋蔥', en: 'Onion', cat: 'veg', v: { zh: '紅洋蔥', en: 'Red' }, p: 2350, lo: 1900, hi: 2610, chg: 0.042, arr: 12400, arrR: 1.18, f: 0, rt: 1.6 },
        { id: 'tomato', zh: '番茄', en: 'Tomato', cat: 'veg', v: { zh: '雜交種', en: 'Hybrid' }, p: 1180, lo: 900, hi: 1400, chg: -0.12, arr: 3100, arrR: 1.34, f: 0, rt: 1.9 },
        { id: 'potato', zh: '馬鈴薯', en: 'Potato', cat: 'veg', v: { zh: '本地種', en: 'Local' }, p: 1420, lo: 1250, hi: 1600, chg: 0, arr: 2200, arrR: 0.97, f: 1, rt: 1.55 },
        { id: 'chilli', zh: '青辣椒', en: 'Chilli', cat: 'spice', v: { zh: '本地種', en: 'Local' }, p: 3800, lo: 3200, hi: 4300, chg: 0.065, arr: 640, arrR: 0.82, f: 0, rt: null },
        { id: 'soybean', zh: '大豆', en: 'Soybean', cat: 'pulse', v: { zh: '黃豆', en: 'Yellow' }, p: 4650, lo: 4400, hi: 4800, chg: 0.011, arr: 5300, arrR: 1.02, f: 0, rt: null },
        { id: 'maize', zh: '玉米', en: 'Maize', cat: 'cereal', v: { zh: '雜交種', en: 'Hybrid' }, p: 2050, lo: 1900, hi: 2150, chg: -0.018, arr: 4100, arrR: 1.1, f: 0, rt: null },
        { id: 'wheat', zh: '小麥', en: 'Wheat', cat: 'cereal', v: { zh: '本地種', en: 'Local' }, p: 2480, lo: 2350, hi: 2600, chg: 0.006, arr: 900, arrR: 0.9, f: 3, rt: 1.35 },
        { id: 'grapes', zh: '葡萄', en: 'Grapes', cat: 'fruit', v: { zh: '綠葡萄', en: 'Green' }, p: 5200, lo: 4000, hi: 6100, chg: 0.09, arr: 380, arrR: 0.76, f: 0, rt: null },
        { id: 'banana', zh: '香蕉', en: 'Banana', cat: 'fruit', v: { zh: '本地種', en: 'Local' }, p: 1600, lo: 1300, hi: 1850, chg: -0.031, arr: 720, arrR: 1.05, f: 0, rt: 1.5 },
        { id: 'garlic', zh: '大蒜', en: 'Garlic', cat: 'spice', v: { zh: '本地種', en: 'Local' }, p: 9500, lo: 8200, hi: 10800, chg: 0.024, arr: 150, arrR: 0.88, f: 0, rt: 1.4 }
      ],
      watch: ['onion', 'tomato', 'potato', 'chilli', 'soybean', 'maize', 'wheat']
    },
    TW: {
      name: { zh: '台灣', en: 'Taiwan' }, cover: { zh: '10 個縣市', en: '10 cities/counties' },
      locale: 'zh-TW', time: '09:30', upIsPos: false, closedWd: 1, sfx: { zh: '', en: '' },
      src: { zh: '農業部 農產品交易行情', en: 'MOA wholesale prices (Govt)' },
      rep: { zh: '平均價', en: 'Average price' }, arrUnit: { zh: '公斤', en: 'kg' },
      units: [{ id: 'kg', f: 1, dec: 1, zh: '元/公斤', en: 'NT$/kg' }, { id: 'catty', f: 0.6, dec: 1, zh: '元/台斤', en: 'NT$/catty' }],
      unitDef: { w: 0, r: 0 }, home: 'taipei', ra: ['taipei', 'newtaipei', 'taichung'],
      areas: [
        { id: 'taipei', n: { zh: '台北市', en: 'Taipei' }, st: { zh: '北部', en: 'North' }, lat: 25.04, lon: 121.56, k: 1, fresh: 0, retail: true, markets: [mk('tp1', { zh: '台北一', en: 'Taipei 1' }, 4, 1), mk('tp2', { zh: '台北二', en: 'Taipei 2' }, 3, 1.02)] },
        { id: 'newtaipei', n: { zh: '新北市', en: 'New Taipei' }, st: { zh: '北部', en: 'North' }, lat: 25.01, lon: 121.46, k: 0.98, fresh: 0, retail: true, markets: [mk('sanchong', { zh: '三重', en: 'Sanchong' }, 6, 0.97), mk('banqiao', { zh: '板橋', en: 'Banqiao' }, 2, 1.0)] },
        { id: 'taoyuan', n: { zh: '桃園市', en: 'Taoyuan' }, st: { zh: '北部', en: 'North' }, lat: 24.99, lon: 121.3, k: 0.95, fresh: 0, retail: true, markets: [mk('taoyuanm', { zh: '桃園', en: 'Taoyuan' }, 3, 1)] },
        { id: 'taichung', n: { zh: '台中市', en: 'Taichung' }, st: { zh: '中部', en: 'Central' }, lat: 24.15, lon: 120.67, k: 0.92, fresh: 0, retail: true, markets: [mk('taichungm', { zh: '台中', en: 'Taichung' }, 5, 1), mk('fengyuan', { zh: '豐原', en: 'Fengyuan' }, 14, 1.01, null)] },
        { id: 'yunlin', n: { zh: '雲林縣', en: 'Yunlin' }, st: { zh: '中部', en: 'Central' }, lat: 23.8, lon: 120.46, k: 0.86, fresh: 0, retail: false, markets: [mk('xiluo', { zh: '西螺', en: 'Xiluo' }, 12, 1)] },
        { id: 'chiayi', n: { zh: '嘉義市', en: 'Chiayi' }, st: { zh: '南部', en: 'South' }, lat: 23.48, lon: 120.45, k: 0.9, fresh: 1, retail: true, markets: [mk('chiayim', { zh: '嘉義', en: 'Chiayi' }, 2, 1)] },
        { id: 'kaohsiung', n: { zh: '高雄市', en: 'Kaohsiung' }, st: { zh: '南部', en: 'South' }, lat: 22.63, lon: 120.3, k: 0.94, fresh: 0, retail: true, markets: [mk('kaohsiungm', { zh: '高雄', en: 'Kaohsiung' }, 4, 1), mk('fengshan', { zh: '鳳山', en: 'Fengshan' }, 9, 0.98)] },
        { id: 'pingtung', n: { zh: '屏東縣', en: 'Pingtung' }, st: { zh: '南部', en: 'South' }, lat: 22.67, lon: 120.49, k: 0.9, fresh: 0, retail: false, markets: [mk('pingtungm', { zh: '屏東', en: 'Pingtung' }, 3, 1)] },
        { id: 'yilan', n: { zh: '宜蘭縣', en: 'Yilan' }, st: { zh: '東部', en: 'East' }, lat: 24.75, lon: 121.75, k: 1.03, fresh: 3, retail: true, markets: [mk('yilanm', { zh: '宜蘭', en: 'Yilan' }, 3, 1)] },
        { id: 'hualien', n: { zh: '花蓮縣', en: 'Hualien' }, st: { zh: '東部', en: 'East' }, lat: 23.99, lon: 121.6, k: 1.05, fresh: null, retail: true, markets: [mk('hualienm', { zh: '花蓮', en: 'Hualien' }, 2, 1, null)] }
      ],
      crops: [
        { id: 'cabbage', zh: '甘藍', en: 'Cabbage', cat: 'veg', v: { zh: '初秋', en: 'Early autumn' }, p: 38.5, lo: 24.0, hi: 52.0, chg: 0.42, arr: 10862, arrR: 0.62, f: 0, rt: 1.7 },
        { id: 'bokchoy', zh: '小白菜', en: 'Bok choy', cat: 'veg', v: { zh: '土白菜', en: 'Local' }, p: 45.2, lo: 30.1, hi: 60.0, chg: 0.61, arr: 4210, arrR: 0.55, f: 0, rt: 1.6 },
        { id: 'banana', zh: '香蕉', en: 'Banana', cat: 'fruit', v: { zh: '北蕉', en: 'Pei-chiao' }, p: 27.0, lo: 18.5, hi: 35.0, chg: -0.031, arr: 8830, arrR: 1.04, f: 0, rt: 1.8 },
        { id: 'sweetpotato', zh: '甘藷', en: 'Sweet potato', cat: 'veg', v: { zh: '台農57號', en: 'TN57' }, p: 22.4, lo: 15.0, hi: 28.0, chg: 0, arr: 5120, arrR: 0.98, f: 1, rt: 1.7 },
        { id: 'scallion', zh: '青蔥', en: 'Scallion', cat: 'spice', v: { zh: '粉蔥', en: 'Local' }, p: 85.0, lo: 60.0, hi: 110.0, chg: 0.12, arr: 1960, arrR: 0.8, f: 0, rt: 1.5 },
        { id: 'tomato', zh: '番茄', en: 'Tomato', cat: 'veg', v: { zh: '牛番茄', en: 'Beef' }, p: 42.0, lo: 28.0, hi: 55.0, chg: 0.05, arr: 3300, arrR: 0.93, f: 0, rt: 1.6 },
        { id: 'mango', zh: '芒果', en: 'Mango', cat: 'fruit', v: { zh: '愛文', en: 'Irwin' }, p: 55.0, lo: 35.0, hi: 80.0, chg: -0.08, arr: 1250, arrR: 0.7, f: 0, rt: 1.5 },
        { id: 'pineapple', zh: '鳳梨', en: 'Pineapple', cat: 'fruit', v: { zh: '金鑽', en: 'Tainung 17' }, p: 25.0, lo: 17.0, hi: 31.0, chg: 0.02, arr: 2700, arrR: 1.0, f: 0, rt: 1.7 },
        { id: 'cauliflower', zh: '花椰菜', en: 'Cauliflower', cat: 'veg', v: { zh: '青梗', en: 'Green stem' }, p: 50.0, lo: 32.0, hi: 66.0, chg: 0.2, arr: 1830, arrR: 0.74, f: 0, rt: null },
        { id: 'waterspinach', zh: '空心菜', en: 'Water spinach', cat: 'veg', v: { zh: '小葉', en: 'Small leaf' }, p: 40.0, lo: 26.0, hi: 52.0, chg: 0.35, arr: 2400, arrR: 0.66, f: 3, rt: null }
      ],
      watch: ['cabbage', 'bokchoy', 'banana', 'sweetpotato', 'scallion', 'cauliflower']
    }
  };

  // 固定種子的亂數：每次打開畫面，數字都一樣
  function seeded(str) {
    let h = 1779033703;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  // 最近 n 天（今天 = 2026-09-19，週六）。休市日沒有資料。
  function days(country, n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(2026, 8, 19 - i));
      out.push({ m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay(), closed: d.getUTCDay() === COUNTRIES[country].closedWd });
    }
    return out;
  }

  // 30 天價格形狀：最後一天等於今日價，前一個交易日由漲跌幅推回去，其餘是固定種子的隨機漫步
  function series(country, crop) {
    const ds = days(country, 30), rnd = seeded(country + crop.id + 'walk');
    const v = new Array(30).fill(null);
    v[29] = crop.p;
    let j = 28; while (ds[j].closed) j--;
    v[j] = crop.p / (1 + crop.chg);
    let last = v[j];
    for (let i = j - 1; i >= 0; i--) {
      if (ds[i].closed) continue;
      last = last * (1 + (rnd() - 0.5) * 0.07);
      v[i] = last;
    }
    return ds.map((x, i) => ({ ...x, v: v[i] }));
  }

  // 依 X-Forwarded-For 的 IP 推測的位置（草圖用固定值模擬；none＝猜不到）
  const IPGUESS = { IN: { country: 'IN', area: 'nashik' }, TW: { country: 'TW', area: 'taipei' } };

  window.MOCK = { STR, LANGS, MORE_LANGS, CATS, TONE_OF, COUNTRIES, IPGUESS, days, series, seeded };
})();
