/* ============================================================
   وسيلة — مكتبة الأيقونات (SVG بسيطة، stroke-based)
   كل أيقونة: viewBox 24×24، بتاخد اللون من currentColor
   ============================================================ */
(function () {
  'use strict';

  const ICONS = {
    /* ---------- أقسام ---------- */
    pain: '<path d="M13.5 2 7 13h4l-1.5 9L17 11h-4l.5-9Z"/>',
    temp: '<path d="M14 14.8V4.5a2 2 0 1 0-4 0v10.3a4 4 0 1 0 4 0Z"/><path d="M12 9v7"/>',
    cup: '<path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/>',
    lung: '<path d="M12 4v9"/><path d="M9 8c0 3-4 3-4 7a3 3 0 0 0 6 0V9"/><path d="M15 8c0 3 4 3 4 7a3 3 0 0 1-6 0V9"/>',
    toilet: '<path d="M6 4v7h12v3a5 5 0 0 1-5 5H9"/><path d="M4 14h16"/><path d="M6 11A6 6 0 0 1 18 11"/>',
    alert: '<path d="M12 3 22 20H2L12 3Z"/><path d="M12 9v5"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',

    /* ---------- أعضاء / وجع ---------- */
    stomach: '<path d="M8 3v5a4 4 0 0 0 4 4h2a4 4 0 0 1 0 8H9a5 5 0 0 1-5-5"/>',
    liver: '<path d="M3 8c4-3 11-2 14 1 2 2 1 5-2 6-4 1-9 1-11-1-1-1-1-4-1-6Z"/>',
    spleen: '<ellipse cx="12" cy="12" rx="5" ry="7"/>',
    head: '<circle cx="12" cy="9" r="5"/><path d="M10 14v3a2 2 0 0 0 2 2h1"/>',
    knee: '<circle cx="12" cy="12" r="3"/><path d="M12 4v5"/><path d="M12 15v5"/>',
    arm: '<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 8h12"/>',
    itch: '<path d="M8 20V9a1.5 1.5 0 0 1 3 0v5"/><path d="M11 14V7a1.5 1.5 0 0 1 3 0v7"/><path d="M14 14V9a1.5 1.5 0 0 1 3 0v6a5 5 0 0 1-5 5H8"/>',
    sweat: '<path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9Z"/><path d="M9 13a3 3 0 0 0 3 3"/>',

    /* ---------- حران / سقعان ---------- */
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    snow: '<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/><path d="M9 4l3 3 3-3M9 20l3-3 3 3"/>',
    window: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M12 4v16M4 12h16"/>',
    ac: '<rect x="3" y="4" width="18" height="8" rx="2"/><path d="M6 8h12"/><path d="M8 15c0 1.5 1 2 1 3M12 15c0 1.5 1 2 1 3M16 15c0 1.5 1 2 1 3"/>',
    fan: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 4-4 4-1s-4 3-4 3M14 12c4 0 4 4 1 4s-3-4-3-4M12 14c0 4-4 4-4 1s4-3 4-3M10 12c-4 0-4-4-1-4s3 4 3 4"/>',
    socks: '<path d="M7 3v7l6 5a3 3 0 0 0 4-4l-4-3"/><path d="M5 3h4"/><path d="M9 3v7"/>',
    blanket: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18"/>',

    /* ---------- أكل وشرب ---------- */
    water: '<path d="M12 3c3.5 4.5 6 7 6 10a6 6 0 0 1-12 0c0-3 2.5-5.5 6-10Z"/>',
    soup: '<path d="M3 11h18a9 9 0 0 1-9 8 9 9 0 0 1-9-8Z"/><path d="M6 7c0-1 1-1 1-2M11 7c0-1 1-1 1-2M16 7c0-1 1-1 1-2"/>',
    juice: '<path d="M6 4h12l-1.5 16h-9L6 4Z"/><path d="M15 4 18 1"/>',
    egg: '<path d="M12 3c4 0 6 5 6 9a6 6 0 0 1-12 0c0-4 2-9 6-9Z"/>',
    chicken: '<path d="M13 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M10 11 4 20"/><path d="M15 6l4-2"/>',
    fish: '<path d="M3 12c3-4 7-4 10 0-3 4-7 4-10 0Z"/><path d="M13 12l7-4v8l-7-4Z"/><circle cx="6" cy="11.5" r=".8" fill="currentColor" stroke="none"/>',

    /* ---------- تنفّس ---------- */
    phlegm: '<path d="M8 20c-3 0-4-3-2-5l6-7 6 7c2 2 1 5-2 5H8Z"/><path d="M10 16h4"/>',
    cough: '<path d="M3 8h8M3 12h5M3 16h7"/><circle cx="17" cy="14" r="4"/>',

    /* ---------- ناس / مستشفى ---------- */
    person: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2"/>',
    bed: '<path d="M3 20V9"/><path d="M3 13h18v7"/><circle cx="8" cy="9" r="2"/><path d="M11 13V9h7a3 3 0 0 1 3 3v1"/>',
    doctor: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><path d="M12 15v3M10.5 16.5h3"/>',
    nurse: '<circle cx="12" cy="7" r="3"/><path d="M6 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><path d="M12 15.5v3M10.5 17h3"/>',
    exit: '<path d="M9 4H5v16h4"/><path d="M14 8l4 4-4 4"/><path d="M18 12H9"/>',

    /* ---------- عام ---------- */
    dot: '<circle cx="12" cy="12" r="6"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    ok: '<path d="M4 13l5 5L20 6"/>',
    no: '<path d="M6 6l12 12M18 6 6 18"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9A2.5 2.5 0 1 1 12 12v1"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
    hide: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/>',
    sos: '<path d="M6 18V9a6 6 0 0 1 12 0v9H6Z"/><path d="M10 21h4"/><path d="M12 2v2"/>',
    back: '<path d="M9 6l6 6-6 6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 7l2.6 1.5M17.2 15.5 19.8 17M4.2 17 6.8 15.5M17.2 8.5 19.8 7"/>',
    moon: '<path d="M20 14a8 8 0 1 1-10-10 7 7 0 0 0 10 10Z"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/>',
    save: '<path d="M4 4h12l4 4v12H4V4Z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    down: '<path d="M6 10l6 6 6-6"/>'
  };

  /* أسماء الأيقونات المتاحة في لوحة الاختيار (للوضع الأسري) */
  const PICKER = [
    'pain', 'temp', 'cup', 'lung', 'toilet', 'alert',
    'stomach', 'liver', 'spleen', 'head', 'knee', 'arm', 'itch', 'sweat',
    'sun', 'snow', 'window', 'ac', 'fan', 'socks', 'blanket',
    'water', 'soup', 'juice', 'egg', 'chicken', 'fish',
    'phlegm', 'cough', 'person', 'bed', 'doctor', 'nurse', 'exit', 'dot'
  ];

  function svg(name, cls) {
    const body = ICONS[name] || ICONS.dot;
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" ' +
      'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      body + '</svg>';
  }

  window.ICONS = ICONS;
  window.ICON_PICKER = PICKER;
  window.icon = svg;
})();
