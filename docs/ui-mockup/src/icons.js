// 圖示：作物用彩色平面插圖（每種作物都不一樣），介面用單色線條（跟著文字顏色）。viewBox 都是 24×24。
(function () {
  const CROP = {
    onion: '<path d="M12 5.5c-2.6 2.2-6 4.6-6 9.3A6 6 0 0 0 18 14.8c0-4.7-3.4-7.1-6-9.3z" fill="#A23A6B"/><path d="M12 6.5c-1.1 2-2.2 4.8-2.2 8.3s1 5.1 2.2 5.4M12 6.5c1.1 2 2.2 4.8 2.2 8.3s-1 5.1-2.2 5.4" fill="none" stroke="#DB8AB0" stroke-width="1.1"/><path d="M12 5.5V2.5M12 4l-2-1.5M12 4l2-1.5" stroke="#3F8F3A" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
    tomato: '<circle cx="12" cy="13.5" r="7.5" fill="#E2412F"/><path d="M12 6.2l1.6 1.8 2.4-.6-1.2 2 1.9 1.2-2.6.2L12 12l-2.1-1.2-2.6-.2 1.9-1.2-1.2-2 2.4.6z" fill="#3E9A3A"/><ellipse cx="8.8" cy="13" rx="1.3" ry="2.1" fill="#F79282" opacity=".75"/>',
    potato: '<ellipse cx="12" cy="13" rx="8.5" ry="6.3" transform="rotate(-18 12 13)" fill="#C8955A"/><g fill="#8A5E2F"><circle cx="9" cy="11.5" r=".9"/><circle cx="14" cy="10" r=".8"/><circle cx="15" cy="15" r=".9"/><circle cx="10.5" cy="15.5" r=".7"/></g>',
    chilli: '<path d="M7 7c3 1 4 5 5.5 8.5S17 21 19.5 20.5c-3.5 2-8.5-.5-11-5.5C7 12 6.5 9 7 7z" fill="#3E9A3A"/><path d="M7 7c.2-1.5 1-2.5 2.3-3" stroke="#2E6B2A" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M8.4 9.5c1 2 1.8 4.5 3.2 7" stroke="#8FD77C" stroke-width="1" fill="none" stroke-linecap="round"/>',
    soybean: '<path d="M4.5 15.5C6 9 12 5 19 5.5c.8 6.5-4.5 12.5-11 13.5-1.8.3-3-1.3-3.5-3.5z" fill="#9BBF4A"/><g fill="#EAD36A"><circle cx="9" cy="15" r="2"/><circle cx="12.5" cy="11.5" r="2"/><circle cx="16" cy="8.2" r="1.8"/></g>',
    maize: '<path d="M12 3c2.8 0 4 4 4 9s-1.6 8-4 8-4-3-4-8 1.2-9 4-9z" fill="#F2C12E"/><path d="M10 8h4M9.5 11h5M9.6 14h4.8M10.2 17h3.6M12 3.5v16" stroke="#D69A12" stroke-width=".9" fill="none"/><path d="M12 21c-3-1-5.5-4-6-9 2 1.5 3.5 4 4.5 7zM12 21c3-1 5.5-4 6-9-2 1.5-3.5 4-4.5 7z" fill="#5DAA3F"/>',
    wheat: '<path d="M12 21V7" stroke="#B07A1E" stroke-width="1.4" stroke-linecap="round"/><g fill="#E0A62B"><ellipse cx="12" cy="5" rx="1.6" ry="2.6"/><ellipse cx="9.6" cy="9" rx="1.5" ry="2.4" transform="rotate(-35 9.6 9)"/><ellipse cx="14.4" cy="9" rx="1.5" ry="2.4" transform="rotate(35 14.4 9)"/><ellipse cx="9.6" cy="13" rx="1.5" ry="2.4" transform="rotate(-35 9.6 13)"/><ellipse cx="14.4" cy="13" rx="1.5" ry="2.4" transform="rotate(35 14.4 13)"/><ellipse cx="9.8" cy="17" rx="1.4" ry="2.2" transform="rotate(-35 9.8 17)"/><ellipse cx="14.2" cy="17" rx="1.4" ry="2.2" transform="rotate(35 14.2 17)"/></g>',
    grapes: '<path d="M12 5.2V3" stroke="#4E9A3E" stroke-width="1.3" stroke-linecap="round"/><path d="M12 4.5c1.5-1.8 3.5-2 5-1.5-1 1.8-2.8 2.4-5 1.5z" fill="#4E9A3E"/><g fill="#7A3FA6"><circle cx="9" cy="8" r="2.3"/><circle cx="13.6" cy="8" r="2.3"/><circle cx="7.4" cy="12" r="2.3"/><circle cx="11.5" cy="12" r="2.3"/><circle cx="15.6" cy="12" r="2.3"/><circle cx="9.6" cy="16" r="2.3"/><circle cx="13.6" cy="16" r="2.3"/><circle cx="11.6" cy="19.8" r="2.1"/></g>',
    banana: '<path d="M4 9c2 6 7 10 14 9.5 1.5-.1 2-1.2 1-1.8C12.5 17 8.5 13 7 8c-.4-1.3-2.4-1.5-3 1z" fill="#F4CF3A"/><path d="M6.5 9.5c2 4.5 6 7.5 11.5 7.8" stroke="#D4A017" stroke-width="1" fill="none"/><path d="M4 9l-1.2-2.4" stroke="#6B5314" stroke-width="1.6" stroke-linecap="round"/>',
    garlic: '<path d="M12 4c-1 2.5-7 5-7 10a7 7 0 0 0 14 0c0-5-6-7.5-7-10z" fill="#F4EFE6" stroke="#B8A88C" stroke-width="1"/><path d="M12 6c-1.5 3-3 6-3 9.5M12 6c1.5 3 3 6 3 9.5M12 6v13" stroke="#C9BBA3" stroke-width="1" fill="none"/><path d="M12 4V2" stroke="#8FA36B" stroke-width="1.6" stroke-linecap="round"/>',
    cabbage: '<circle cx="12" cy="12.5" r="8" fill="#7CC35B"/><path d="M12 5c-2 2.5-3 5-3 7.5S10 18 12 20.5M12 5c2 2.5 3 5 3 7.5S14 18 12 20.5" stroke="#3F8A32" stroke-width="1.1" fill="none"/><path d="M5 11c2 .5 4 2 7 2s5-1.5 7-2" stroke="#C3EAA8" stroke-width="1.1" fill="none"/>',
    bokchoy: '<path d="M10 21c-.5-4-.5-7 0-10h4c.5 3 .5 6 0 10z" fill="#EEF5E4" stroke="#B4CF9B" stroke-width=".8"/><path d="M12 11C8 10 5 7 6 3c3 0 6 3 6 8zM12 11c4-1 7-4 6-8-3 0-6 3-6 8z" fill="#3E9A3A"/><path d="M12 11c-1.5-2-1.5-5 0-8 1.5 3 1.5 6 0 8z" fill="#62BF4E"/>',
    sweetpotato: '<path d="M4 14c1.5-5 7-8.5 12.5-7.5 3 .5 4 2.8 3 4.5-2 3.5-8 6.5-12.5 6-2-.2-3.3-1.4-3-3z" fill="#B24A6E"/><path d="M19.5 11l2-1M4 14.5l-2 1" stroke="#7A2E4A" stroke-width="1.3" stroke-linecap="round"/><g fill="#E794B2"><circle cx="10" cy="12" r=".7"/><circle cx="14" cy="10.5" r=".7"/></g>',
    scallion: '<path d="M9 21v-7M12 21v-8M15 21v-7" stroke="#EDEBDC" stroke-width="3" stroke-linecap="round"/><path d="M9 14c-1-4-2.5-8-4-11M12 13c0-4 .2-7.5 1-10M15 14c1-4 2.5-7 4.5-10" stroke="#3E9A3A" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    mango: '<path d="M7 9c3-4 10-3.5 12 1.5 2 5-1.5 10-7 10S3.5 14 7 9z" fill="#F6A623"/><path d="M7 9c3-4 10-3.5 12 1.5-3-1.5-7-1.5-12-1.5z" fill="#E4572E" opacity=".75"/><path d="M13 5.5c1-2 3-3 5-2.5-1 2-3 3-5 2.5z" fill="#3E9A3A"/>',
    pineapple: '<ellipse cx="12" cy="15" rx="5.5" ry="6.5" fill="#F2B632"/><path d="M8 11l8 8M8 15l5 5M11 9.5l6 6M16 11l-8 8M16 15l-5 5M13 9.5l-6 6" stroke="#C47F10" stroke-width=".9"/><path d="M12 9L9 3l2.2 3L12 1.5 12.8 6 15 3z" fill="#3E9A3A"/>',
    cauliflower: '<path d="M4.5 15c1 3.5 4 6 7.5 6s6.5-2.5 7.5-6c-2 1-5 1.5-7.5 1.5S6.5 16 4.5 15z" fill="#4E9A3E"/><g fill="#F7F3E3" stroke="#CFC39E" stroke-width=".8"><circle cx="8" cy="12" r="3"/><circle cx="12" cy="10" r="3.4"/><circle cx="16" cy="12" r="3"/><circle cx="10" cy="14.5" r="2.8"/><circle cx="14" cy="14.5" r="2.8"/></g>',
    waterspinach: '<path d="M12 21V9M12 13l-4-3M12 11l4-4" stroke="#6BAF4F" stroke-width="1.4" stroke-linecap="round" fill="none"/><path d="M12 9c-1-3 0-5.5 0-7 1.2 2 1.8 4.5 0 7zM8 10c-3 .5-5-1-6-2.5 2.5-.5 4.5 0 6 2.5zM16 7c1-2.8 3.5-3.6 5-3.5-.8 2.3-2.5 3.5-5 3.5z" fill="#3E9A3A"/>',
    oil: '<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" fill="#E8B92F"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" stroke="#FFF3C4" stroke-width="1.3" fill="none" stroke-linecap="round"/>',
    box: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z" fill="#8FA3B8"/><path d="M4 8l8 4 8-4M12 12v9" stroke="#5E738A" stroke-width="1.2" fill="none"/>',
    gridc: '<g fill="#4F7BD9"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5" opacity=".55"/></g>',
    clockc: '<circle cx="12" cy="12" r="8.5" fill="#8B6BE0"/><path d="M12 7v5l3.5 2" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
  };

  // 單色線條圖示
  const UI = {
    pin: '<path d="M12 21s-6-5.5-6-10.5a6 6 0 0 1 12 0C18 15.5 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
    speaker: '<path d="M5 9.5h3l4-3.5v12l-4-3.5H5z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    sort: '<path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5 7.5 7.5 0 1 0 19 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    chev: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    refresh: '<path d="M19 8a7.5 7.5 0 1 0 1 6"/><path d="M19.5 3.5V8H15"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.3"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
    star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
    store: '<path d="M4 9.5L5.5 4.5h13L20 9.5M4 9.5h16v10H4zM9 19.5v-5h6v5"/>',
    trend: '<path d="M4 17l5-5 4 3 7-7M15 8h5v5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z"/>',
    scale: '<path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>'
  };

  // 產品標誌：葉子加價格標籤
  const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="12" fill="#146C43"/><path d="M14 33c0-11 8-19 21-19 0 13-8 21-19 21" fill="#9BE07A"/><path d="M14 35c5-6 10-10 17-14" stroke="#146C43" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M27 30h9l3 3-3 3h-9z" fill="#FFC53D"/><circle cx="29.5" cy="33" r="1.2" fill="#146C43"/></svg>';

  const crop = (id, cls) => `<svg class="${cls || 'ci'}" viewBox="0 0 24 24" aria-hidden="true">${CROP[id] || CROP.box}</svg>`;
  const ui = (id, cls) => `<svg class="${cls || 'ui'}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${UI[id]}</svg>`;

  window.ICON = { crop, ui, LOGO };
})();
