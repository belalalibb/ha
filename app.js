/* ============================================================
   وسيلة — منطق التطبيق (Vanilla JS، بدون أي مكتبة)
   ------------------------------------------------------------
   الفكرة: شاشة واحدة، مربعات كبيرة، اللي ماسك التليفون بيدوس،
   وبعدها شاشة تأكيد عشان ما يحصلش فهم غلط.
   ============================================================ */
(function () {
  'use strict';

  /* ------------------------------ مفاتيح التخزين */
  var VERSION = 'v7';
  var DATA_KEY = 'wasila.data.v1';
  var SET_KEY = 'wasila.set.v1';
  var LOG_KEY = 'wasila.log.v1';

  /* ------------------------------ DOM */
  var stage = document.getElementById('stage');
  var crumb = document.getElementById('crumb');
  var foot = document.getElementById('foot');
  var bar = document.getElementById('bar');

  /* ------------------------------ الحالة */
  var data, settings, logs;
  var state = {
    view: 'main',      // main | confirm | sent
    stack: [],         // [{label, options}]
    page: 0,
    pending: null,     // {item, path}
    timer: null,
    hideOpen: false
  };

  /* ============================================================
     تخزين
     ============================================================ */
  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); return true; }
    catch (e) { return false; }   /* المساحة اتملت أو متصفح خاص */
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function loadData() {
    var raw = read(DATA_KEY);
    if (raw) {
      try {
        var d = JSON.parse(raw);
        if (d && d.sections) return d;
      } catch (e) { /* تالفة → نرجع للأصل */ }
    }
    return clone(window.APP_DATA);
  }

  function loadSettings() {
    var def = { perScreen: 4, showNums: true, dark: false };
    var raw = read(SET_KEY);
    if (raw) {
      try {
        var s = JSON.parse(raw);
        for (var k in def) if (s[k] !== undefined) def[k] = s[k];
      } catch (e) { /* تجاهل */ }
    }
    return def;
  }

  function loadLogs() {
    var raw = read(LOG_KEY);
    if (raw) { try { return JSON.parse(raw) || []; } catch (e) { return []; } }
    return [];
  }

  function saveData() {
    data.meta.updated = today();
    var ok = write(DATA_KEY, JSON.stringify(data));
    if (!ok) {
      notify('مساحة التخزين اتملت. امسح صورة أو اتنين، أو استخدم «مسار صورة» بدل رفعها من الجهاز.');
    }
    /* المزامنة: نرفع في الخلفية من غير ما نعطّل الأهل */
    if (ok && window.WasilaSync && WasilaSync.isOn()) {
      try { WasilaSync.queuePush(clone(data)); } catch (e) { }
    }
    return ok;
  }
  function saveSettings() { write(SET_KEY, JSON.stringify(settings)); }
  function saveLogs() { write(LOG_KEY, JSON.stringify(logs.slice(-300))); }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ============================================================
     أدوات عرض
     ============================================================ */
  function items() {
    return state.stack.length
      ? state.stack[state.stack.length - 1].options
      : data.sections;
  }

  function pathLabel() {
    if (!state.stack.length) return 'الرئيسية';
    return state.stack.map(function (s) { return s.label; }).join(' › ');
  }

  function perPage() {
    var n = settings.perScreen;
    if (n === 'auto') return window.innerWidth > window.innerHeight ? 6 : 4;
    return Number(n) || 4;
  }

  /* عدد الصفوف والأعمدة على أساس عدد المربعات الظاهرة واتجاه الشاشة */
  function gridFor(n) {
    var land = window.innerWidth > window.innerHeight;
    if (n <= 1) return [1, 1];
    if (n === 2) return land ? [2, 1] : [1, 2];
    if (n === 3) return land ? [3, 1] : [1, 3];
    if (n === 4) return [2, 2];
    if (n === 5) return land ? [3, 2] : [2, 3];
    if (n === 6) return land ? [3, 2] : [2, 3];
    return [3, 3];
  }

  function setGrid(n) {
    var g = gridFor(n);
    var s = document.documentElement.style;
    s.setProperty('--cols', g[0]);
    s.setProperty('--rows', g[1]);
  }

  /* حجم الأيقونة والخط على أساس حجم المربع الفعلي — يشتغل على أي شاشة */
  function sizeTiles() {
    var t = stage.querySelector('.tile, .big');
    if (!t) return;
    var r = t.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var m = Math.min(r.width, r.height);
    var s = document.documentElement.style;
    s.setProperty('--icon', Math.round(m * 0.34) + 'px');
    s.setProperty('--label', Math.round(m * 0.135) + 'px');
    s.setProperty('--num', Math.round(m * 0.105) + 'px');
  }

  /* ------------------------------ رسم */
  var pendingRemote = null;

  /* نسخة جديدة وصلت من تليفون تاني */
  function applyRemote(remoteData) {
    if (!remoteData || !remoteData.sections) return;
    /* لو فيه نافذة تعديل مفتوحة أو المريض في نص اختيار — بنأجّلها */
    if ((modal && modal.parentNode) || state.view !== 'main') {
      pendingRemote = remoteData;
      return;
    }
    data = remoteData;
    if (!data.meta) data.meta = { version: 1, updated: today() };
    write(DATA_KEY, JSON.stringify(data));
    state.stack = [];
    state.page = 0;
    state.view = 'main';
    state.pending = null;
    render();
    if (overlay) renderFamily();
  }

  function render() {
    if (pendingRemote && state.view === 'main' && !(modal && modal.parentNode)) {
      var r = pendingRemote;
      pendingRemote = null;
      return applyRemote(r);
    }
    clearTimer();
    if (state.view === 'main') renderMain();
    else if (state.view === 'confirm') renderConfirm();
    else renderSent();
    sizeTiles();
  }

  function renderMain() {
    var all = items();
    var per = perPage();
    var pages = Math.max(1, Math.ceil(all.length / per));
    if (state.page >= pages) state.page = pages - 1;
    if (state.page < 0) state.page = 0;

    var start = state.page * per;
    var slice = all.slice(start, start + per);

    crumb.textContent = pathLabel();

    if (!all.length) {
      setGrid(1);
      stage.innerHTML =
        '<div class="empty">' +
        '<div>مفيش أقسام لسه.</div>' +
        '<button class="big-btn yes" id="emptyAdd">أضف قسم</button>' +
        '</div>';
      var b = document.getElementById('emptyAdd');
      if (b) b.addEventListener('click', openFamily);
      renderFoot(0, 0);
      return;
    }

    setGrid(slice.length);
    var html = '<div class="tiles">';
    slice.forEach(function (it, i) {
      var idx = start + i;
      html += tileHTML(it, idx, (settings.showNums ? i + 1 : 0));
    });
    html += '</div>';
    stage.innerHTML = html;

    var tiles = stage.querySelectorAll('.tile');
    Array.prototype.forEach.call(tiles, function (el) {
      el.addEventListener('click', function () {
        pick(Number(el.getAttribute('data-i')));
      });
    });

    renderFoot(state.page, pages);
  }

  /* علامة «تمريض» بتظهر لو العنصر نفسه محتاج تمريض، أو لو كل اللي تحته محتاج */
  function needsNurse(it) {
    if (it.nurse) return true;
    if (it.options && it.options.length) {
      return it.options.every(needsNurse);
    }
    return false;
  }

  /* ---------------- الصور والأيقونات ---------------- */

  /* لو العنصر له صورة بنعرضها، ولو لأ بنعرض الأيقونة */
  function mediaHTML(node, cls) {
    if (node && node.img) {
      return '<img class="photo ' + (cls || '') + '" src="' + esc(node.img) + '" alt="">';
    }
    return icon(node && node.icon);
  }

  /* كل الصيغ مدعومة: png · jpg · webp · gif · svg · avif · bmp · heic · ico ...
     الصور الكبيرة بتتصغّر تلقائيًا عشان التطبيق يفضل خفيف على تليفون قديم
     cb(info, err) — info = { url, w, h, kb, kind, note } */
  function processImage(file, cb) {
    if (!file) return cb(null, 'مفيش ملف');
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    var isImage = type.indexOf('image') === 0 ||
      /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico|heic|heif|tiff?|jfif|pjpeg|apng)$/.test(name);
    if (!isImage) return cb(null, 'الملف ده مش صورة');
    if (file.size > 15 * 1024 * 1024) return cb(null, 'الصورة كبيرة جدًا (أكبر من ١٥ ميجا)');

    var fr = new FileReader();
    fr.onerror = function () { cb(null, 'مش قادر أقرا الملف'); };
    fr.onload = function () {
      var dataUrl = String(fr.result);
      var isVector = type.indexOf('svg') > -1 || /\.svg$/.test(name);
      var isAnimated = type.indexOf('gif') > -1 || /\.gif$/.test(name);

      var finished = false;
      var guard = null;

      /* أي صورة متجهز، بنرجع الأصل — عشان الشاشة ما تفضلش معلقة على «بنجهز…» */
      function finish(url, w, h, kind) {
        if (finished) return;
        finished = true;
        if (guard) clearTimeout(guard);
        cb({ url: url, w: w || 0, h: h || 0, kb: Math.round((url.length * 0.75) / 1024), kind: kind }, null);
      }

      /* SVG و GIF بنسيبهم زي ما هم (عشان ميتحولوش لصورة ثابتة) */
      if (isVector) return finish(dataUrl, 0, 0, 'vector');
      if (isAnimated) return finish(dataUrl, 0, 0, 'animated');

      /* شبكة أمان: لو المتصفح اتأخر أو رفض يفك الصورة، بنحفظ الأصل بعد ٣ ثواني */
      guard = setTimeout(function () { finish(dataUrl, 0, 0, 'photo'); }, 3000);

      /* صورة صغيرة أصلاً — مفيش داعي نلمسها */
      if (dataUrl.length < 60 * 1024) {
        var quick = new Image();
        quick.onload = function () { finish(dataUrl, quick.naturalWidth, quick.naturalHeight, 'photo'); };
        quick.onerror = function () { finish(dataUrl, 0, 0, 'photo'); };
        quick.src = dataUrl;
        return;
      }

      var im = new Image();
      im.onload = function () {
        var max = 900;
        var w = im.naturalWidth || im.width;
        var h = im.naturalHeight || im.height;
        if (!w || !h) return finish(dataUrl, 0, 0, 'photo');
        var k = Math.min(1, max / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * k));
        var ch = Math.max(1, Math.round(h * k));
        try {
          var c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(im, 0, 0, cw, ch);
          var out = '';
          try { out = c.toDataURL('image/webp', 0.82); } catch (e1) { out = ''; }
          if (!out || out.indexOf('data:image/webp') !== 0) {
            try { out = c.toDataURL('image/jpeg', 0.82); } catch (e2) { out = ''; }
          }
          if (!out) return finish(dataUrl, w, h, 'photo');
          if (out.length >= dataUrl.length) return finish(dataUrl, w, h, 'photo');
          return finish(out, cw, ch, 'photo');
        } catch (e3) {
          /* مفيش canvas (متصفح قديم جدًا) → بنسيب الأصل وبيتحفظ عادي */
          return finish(dataUrl, w, h, 'photo');
        }
      };
      /* صيغة المتصفح مش فاهمها (زي HEIC على أندرويد) — بنسيب الأصل ولو مش هيتعرض تظهر الأيقونة */
      im.onerror = function () { finish(dataUrl, 0, 0, 'unsupported'); };
      im.src = dataUrl;
    };
    fr.readAsDataURL(file);
  }

  function imgSize(txt) {
    if (!txt || txt.indexOf('data:') !== 0) return '';
    var kb = Math.round((txt.length * 0.75) / 1024);
    return kb + ' كيلو';
  }

  function tileHTML(it, idx, num) {
    var hasKids = it.options && it.options.length;
    return '<button class="tile" data-i="' + idx + '">' +
      (num ? '<span class="num">' + num + '</span>' : '') +
      (needsNurse(it) ? '<span class="nurse">تمريض</span>' : '') +
      '<span class="art">' + mediaHTML(it) + '</span>' +
      '<span class="label">' + esc(it.label) + '</span>' +
      (hasKids ? '<span class="chev">‹</span>' : '') +
      '</button>';
  }

  function renderFoot(page, pages) {
    if (state.view !== 'main') { foot.style.visibility = 'hidden'; return; }
    foot.style.visibility = 'visible';

    var canBack = state.stack.length > 0;
    var html = '<button class="btn-back" id="btnBack"' + (canBack ? '' : ' disabled') + '>' +
      '<span class="chev">›</span><span>رجوع</span></button>' +
      '<div class="pager" id="pager">';

    if (pages > 1) {
      html += '<button class="pg-arrow" id="pgPrev"' + (page <= 0 ? ' disabled' : '') + '>قبل</button>';
      for (var i = 0; i < pages; i++) {
        html += '<button class="pg-dot' + (i === page ? ' on' : '') + '" data-p="' + i + '">' + (i + 1) + '</button>';
      }
      html += '<button class="pg-arrow" id="pgNext"' + (page >= pages - 1 ? ' disabled' : '') + '>بعد</button>';
    }
    html += '</div>';
    foot.innerHTML = html;

    var back = document.getElementById('btnBack');
    if (back) back.addEventListener('click', goBack);

    var dots = foot.querySelectorAll('.pg-dot');
    Array.prototype.forEach.call(dots, function (d) {
      d.addEventListener('click', function () {
        state.page = Number(d.getAttribute('data-p'));
        render();
      });
    });
    var pp = document.getElementById('pgPrev');
    if (pp) pp.addEventListener('click', function () { state.page--; render(); });
    var pn = document.getElementById('pgNext');
    if (pn) pn.addEventListener('click', function () { state.page++; render(); });
  }

  /* اختيار مربع */
  function pick(idx) {
    var list = items();
    var it = list[idx];
    if (!it) return;

    if (it.options && it.options.length) {
      state.stack.push({ label: it.label, options: it.options });
      state.page = 0;
      state.view = 'main';
      render();
      return;
    }
    state.pending = { item: it, path: pathLabel() };
    state.view = 'confirm';
    render();
  }

  function renderConfirm() {
    if (!state.pending) { state.view = 'main'; return render(); }
    var it = state.pending.item;
    crumb.textContent = pathLabel();

    stage.innerHTML =
      '<div class="confirm">' +
      '<p class="q">هو ده اللي قصدك؟</p>' +
      '<div class="big"><span class="art">' + mediaHTML(it) + '</span>' +
      '<span class="label">' + esc(it.label) + '</span></div>' +
      (needsNurse(it) ? '<div class="warn">اسأل التمريض الأول قبل التنفيذ</div>' : '') +
      '<div class="actions">' +
      '<button class="big-btn yes" id="btnYes">أيوه كده ✓</button>' +
      '<button class="big-btn" id="btnNo">مش قصدي ×</button>' +
      '</div></div>';

    foot.style.visibility = 'hidden';

    document.getElementById('btnYes').addEventListener('click', function () {
      logs.push({
        t: new Date().toISOString(),
        label: it.label,
        path: state.pending.path,
        nurse: !!it.nurse
      });
      saveLogs();
      state.view = 'sent';
      render();
    });

    document.getElementById('btnNo').addEventListener('click', function () {
      state.view = 'main';
      state.pending = null;
      render();
    });
  }

  function renderSent() {
    var it = state.pending ? state.pending.item : { label: '', icon: 'ok' };
    crumb.textContent = pathLabel();
    stage.innerHTML =
      '<div class="sent">' +
      '<span class="art">' + mediaHTML(it) + '</span>' +
      '<div class="label">' + esc(it.label) + '</div>' +
      '<div class="hint">' + (needsNurse(it) ? 'قوله للتمريض الأول' : 'قلناله خلاص') + '</div>' +
      '<button class="big-btn yes" id="btnDone">تمام ✓</button>' +
      '</div>';
    foot.style.visibility = 'hidden';
    document.getElementById('btnDone').addEventListener('click', function () {
      state.view = 'main';
      state.pending = null;
      render();
    });
    /* رجوع تلقائي بعد ١٠ ثواني — الشاشة متفضلش معلقة */
    state.timer = setTimeout(function () {
      state.view = 'main';
      state.pending = null;
      render();
    }, 10000);
  }

  function goBack() {
    if (state.view === 'confirm') { state.view = 'main'; state.pending = null; render(); return; }
    if (state.stack.length) {
      state.stack.pop();
      state.page = 0;
      render();
    }
  }

  function clearTimer() {
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ============================================================
     الطبقات الكاملة: إخفاء · طوارئ · مساعدة · وضع الأسرة
     ============================================================ */
  var overlay = null;
  var modal = null;

  function closeOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function closeModal() {
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    modal = null;
    if (pendingRemote) {
      var r = pendingRemote;
      pendingRemote = null;
      setTimeout(function () { applyRemote(r); }, 0);
    }
  }

  function makeOverlay(cls, inner) {
    closeOverlay();
    var d = document.createElement('div');
    d.className = 'fullscreen ' + (cls || '');
    d.innerHTML = inner;
    document.body.appendChild(d);
    overlay = d;
    return d;
  }

  /* ------------- إخفاء فوري ------------- */
  function showHide() {
    makeOverlay('hidden-screen', '');
    var peek = document.createElement('button');
    peek.className = 'peek';
    peek.textContent = '•';
    peek.setAttribute('aria-label', 'رجوع');
    peek.addEventListener('click', closeOverlay);
    overlay.appendChild(peek);
  }

  /* ------------- طوارئ ------------- */
  function showSos() {
    makeOverlay('sos-screen',
      '<div class="sos-title">نادي الممرض<br>بسرعة</div>' +
      '<div class="sos-sub">الشاشة دي تتقفل أول ما حد ييجي</div>' +
      '<div class="row" style="justify-content:center"><button class="big-btn" id="sosBack">رجعت</button></div>');
    document.getElementById('sosBack').addEventListener('click', closeOverlay);
  }

  /* ------------- مساعدة ------------- */
  function showHelp() {
    makeOverlay('', '<div class="help-sheet">' +
      '<h2>إزاي تستخدمه — ٤ خطوات</h2>' +
      '<ol>' +
      '<li>امسك التليفون قدامه على مسافة يشوفها كويس.</li>' +
      '<li>اقرا له المربعات بصوتك: واحد، اتنين، تلاتة، أربعة.</li>' +
      '<li>أول ما يشاور على حاجة — دوس على مربعها.</li>' +
      '<li>اسأله «هو ده؟» — لو أيوه دوس <b>أيوه كده</b>، لو لأ دوس <b>مش قصدي</b>.</li>' +
      '</ol>' +
      '<div class="card">' +
      '<div class="row"><b>علامة «تمريض»</b> معناها: اسأل التمريض الأول قبل أي أكل أو شرب.</div>' +
      '<div class="row"><b>إخفاء</b> = شاشة بيضا فورًا · <b>طوارئ</b> = شاشة تنادي الممرض.</div>' +
      '</div>' +
      '<div class="row">' +
      '<button class="mini" id="helpDark">الوضع الليلي</button>' +
      '<button class="mini" id="helpNums">' + (settings.showNums ? 'إخفاء الأرقام' : 'إظهار الأرقام') + '</button>' +
      '<span class="spacer"></span>' +
      '<button class="mini strong" id="helpFam">وضع الأسرة</button>' +
      '<button class="mini" id="helpClose">قفل</button>' +
      '</div>' +
      '<div class="row" style="font-size:12px;opacity:.7">' +
      '<span>الإصدار ' + VERSION + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="mini" id="helpUpd">تحديث النسخة</button>' +
      '</div>' +
      '</div>');

    document.getElementById('helpClose').addEventListener('click', closeOverlay);
    document.getElementById('helpUpd').addEventListener('click', hardRefresh);
    document.getElementById('helpDark').addEventListener('click', function () {
      settings.dark = !settings.dark;
      applySettings();
      saveSettings();
      closeOverlay();
      showHelp();
    });
    document.getElementById('helpNums').addEventListener('click', function () {
      settings.showNums = !settings.showNums;
      saveSettings();
      closeOverlay();
      showHelp();
      render();
    });
    document.getElementById('helpFam').addEventListener('click', openFamily);
  }

  /* ============================================================
     وضع الأسرة: تعديل الأقسام + الإعدادات + تصدير/استيراد
     ============================================================ */
  function openFamily() {
    makeOverlay('', '');
    renderFamily();
  }

  function renderFamily() {
    if (!overlay) { makeOverlay('', ''); }
    var stats = topStats();
    var html = '<div class="sheet">' +
      '<div class="row"><h2>وضع الأسرة</h2>' +
      '<span style="font-size:12px;opacity:.6">' + VERSION + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="mini" id="famClose">قفل</button></div>' +

      '<div class="card">' +
      '<h3>الإعدادات</h3>' +
      '<div class="row"><label>عدد المربعات في الشاشة: ' +
      '<select class="mini" id="setPer">' +
      opt('auto', 'تلقائي', settings.perScreen) +
      opt('2', '٢', settings.perScreen) +
      opt('4', '٤', settings.perScreen) +
      opt('6', '٦', settings.perScreen) +
      opt('9', '٩', settings.perScreen) +
      '</select></label>' +
      '<button class="mini" id="setDark">' + (settings.dark ? 'الوضع النهاري' : 'الوضع الليلي') + '</button>' +
      '<button class="mini" id="setNums">' + (settings.showNums ? 'إخفاء الأرقام' : 'إظهار الأرقام') + '</button>' +
      '</div></div>' +

      '<div class="card">' +
      '<div class="row"><h3>الأقسام والخيارات</h3><span class="spacer"></span>' +
      '<button class="mini strong" id="addSec">+ قسم جديد</button></div>' +
      sectionsHTML() +
      '</div>' +

      '<div class="card">' +
      '<h3>أكتر حاجة اتطلبت</h3>' +
      (stats.length
        ? '<div class="row" style="flex-direction:column;align-items:stretch">' +
          stats.map(function (s) {
            return '<div class="item-row"><span class="name">' + esc(s.label) + '</span><b>' + s.n + '</b></div>';
          }).join('') + '</div>'
        : '<div>لسه مفيش تسجيل.</div>') +
      '<div class="row"><button class="mini danger" id="clearLogs">مسح السجل</button>' +
      '<span>' + logs.length + ' تسجيل</span></div>' +
      '</div>' +

      syncCardHTML() +

      '<div class="card">' +
      '<h3>حفظ / نقل البيانات</h3>' +
      '<div class="row">' +
      '<button class="mini strong" id="expJson">تنزيل data.js</button>' +
      '<button class="mini" id="copyJson">نسخ المحتوى</button>' +
      '<label class="mini" style="cursor:pointer">استيراد ملف' +
      '<input type="file" id="impFile" accept=".js,.json,application/json,text/javascript" hidden>' +
      '</label>' +
      '<span class="spacer"></span>' +
      '<button class="mini danger" id="resetAll">رجوع للأصل</button>' +
      '</div>' +
      '<div style="font-size:12px;line-height:1.6">' +
      'الطريقة: عدّل اللي تحت → «تنزيل data.js» → ارفع الملف مكانه في GitHub → كل الأجهزة تتحدث.<br>' +
      'الصور اللي بترفعها من الجهاز بتتحفظ جوّه نفس الملف (فبيبقى أكبر)، ولو حبيت تخليه خفيف ' +
      'حط الصور في مجلد images في الريبو واستخدم «مسار صورة» بدل الرفع.' +
      '</div>' +
      '</div>' +

      '</div>';

    overlay.innerHTML = html;

    document.getElementById('famClose').addEventListener('click', function () { closeOverlay(); render(); });
    document.getElementById('setPer').addEventListener('change', function (e) {
      settings.perScreen = e.target.value === 'auto' ? 'auto' : Number(e.target.value);
      saveSettings(); render(); renderFamily();
    });
    document.getElementById('setDark').addEventListener('click', function () {
      settings.dark = !settings.dark; applySettings(); saveSettings(); renderFamily();
    });
    document.getElementById('setNums').addEventListener('click', function () {
      settings.showNums = !settings.showNums; saveSettings(); renderFamily(); render();
    });
    document.getElementById('addSec').addEventListener('click', function () {
      editNode(data.sections, -1, 'قسم جديد');
    });
    document.getElementById('clearLogs').addEventListener('click', function () {
      ask('تمسح السجل كله؟', function () { logs = []; saveLogs(); renderFamily(); });
    });
    /* ---------------- المزامنة ---------------- */
    var sSave = document.getElementById('syncSave');
    if (sSave) {
      sSave.addEventListener('click', function () {
        var u = document.getElementById('syncUrl').value.trim();
        var c = document.getElementById('syncCode').value.trim();
        if (!u || !c) { notify('اكتب رابط السيرفر وكود العيلة الأول.'); return; }
        var ok = WasilaSync.setConfig(u, c);
        if (!ok) { notify('رابط السيرفر أو الكود مش مظبوط.'); return; }
        WasilaSync.start().then(function () {
          notify('المزامنة اتشغلت ✅ — أي تعديل هيظهر على كل التليفونات.');
          renderFamily();
        });
      });
    }

    var sGen = document.getElementById('syncGen');
    if (sGen) {
      sGen.addEventListener('click', function () {
        document.getElementById('syncCode').value = WasilaSync.makeCode();
      });
    }

    var sNow = document.getElementById('syncNow');
    if (sNow) {
      sNow.addEventListener('click', function () {
        if (!WasilaSync.isOn()) { notify('شغّل المزامنة الأول.'); return; }
        WasilaSync.pull().then(function (changed) {
          notify(changed ? 'فيه جديد — اتحدّث ✅' : 'مفيش جديد، كله محدّث.');
          renderFamily();
        });
      });
    }

    var sLink = document.getElementById('syncLink');
    if (sLink) {
      sLink.addEventListener('click', function () {
        if (!WasilaSync.isOn()) { notify('شغّل المزامنة الأول.'); return; }
        copyText(WasilaSync.setupLink());
        notify('اتنسخ لينك الإعداد — ابعته لأي تليفون، هيفتح مظبوط لوحده.');
      });
    }

    var sOff = document.getElementById('syncOff');
    if (sOff) {
      sOff.addEventListener('click', function () {
        WasilaSync.stop();
        renderFamily();
      });
    }

    var sUndo = document.getElementById('syncUndo');
    if (sUndo) {
      sUndo.addEventListener('click', function () {
        if (!WasilaSync.isOn()) { notify('المزامنة مش متشغلة.'); return; }
        WasilaSync.history().then(function (h) {
          if (!h || !h.length) { notify('مفيش نسخ قديمة لسه.'); return; }
          var wrap = document.createElement('div');
          wrap.className = 'modal-wrap';
          var html = '<div class="modal"><h3>رجوع لنسخة قديمة</h3>';
          h.slice(0, 6).forEach(function (it) {
            html += '<div class="item-row"><span class="name">نسخة ' + it.v + ' — ' + timeStr(it.at) + '</span>' +
              '<button class="mini strong" data-restore="' + it.v + '">رجّعها</button></div>';
          });
          html += '<div class="row"><span class="spacer"></span><button class="mini" id="undoClose">إلغاء</button></div></div>';
          wrap.innerHTML = html;
          document.body.appendChild(wrap);
          modal = wrap;
          document.getElementById('undoClose').addEventListener('click', closeModal);
          wrap.querySelectorAll('[data-restore]').forEach(function (b) {
            b.addEventListener('click', function () {
              var v = Number(b.getAttribute('data-restore'));
              closeModal();
              WasilaSync.restore(v).then(function () {
                notify('رجعت النسخة ' + v + ' ✅');
                render();
                renderFamily();
              }).catch(function () { notify('مش قادر أرجّع النسخة دي.'); });
            });
          });
        }).catch(function () { notify('مش قادر أجيب النسخ القديمة.'); });
      });
    }

    document.getElementById('expJson').addEventListener('click', exportData);
    document.getElementById('copyJson').addEventListener('click', function () { copyText(dataFileText()); });
    document.getElementById('impFile').addEventListener('change', importData);
    document.getElementById('resetAll').addEventListener('click', function () {
      ask('ترجع لكل الأقسام الأصلية؟ التعديلات هتضيع.', function () {
        data = clone(window.APP_DATA);
        state.stack = []; state.page = 0;
        saveData(); render(); renderFamily();
      });
    });

    /* أزرار التعديل داخل القوائم */
    overlay.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = resolve(b.getAttribute('data-edit'));
        editNode(p.arr, p.i, 'تعديل');
      });
    });
    overlay.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = resolve(b.getAttribute('data-add'));
        var node = p.arr[p.i];
        if (!node.options) node.options = [];
        editNode(node.options, -1, 'خيار جديد في: ' + node.label);
      });
    });
    overlay.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = resolve(b.getAttribute('data-del'));
        var name = p.arr[p.i].label;
        ask('تمسح «' + name + '»؟', function () {
          p.arr.splice(p.i, 1);
          saveData(); render(); renderFamily();
        });
      });
    });
  }

  function opt(v, t, cur) {
    return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + t + '</option>';
  }

  /* مسار العنصر: s:0  أو  s:0/o:2  أو s:0/o:2/o:1 */
  function resolve(pathStr) {
    var parts = pathStr.split('/');
    var arr = data.sections, i = 0;
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k].split(':');
      i = Number(p[1]);
      if (k === parts.length - 1) return { arr: arr, i: i };
      arr = arr[i].options || [];
    }
    return { arr: arr, i: i };
  }

  function nodePath(base, i) {
    return base + '/s:' + i;
  }

  function sectionsHTML() {
    var out = '';
    data.sections.forEach(function (sec, i) {
      out += nodeRow(sec, 's:' + i, 0, true);
      out += childrenHTML(sec, 's:' + i, 1);
    });
    return out;
  }

  function childrenHTML(node, base, depth) {
    if (!node.options || !node.options.length) return '';
    var out = '';
    node.options.forEach(function (o, j) {
      var p = base + '/o:' + j;
      out += nodeRow(o, p, depth, false);
      out += childrenHTML(o, p, depth + 1);
    });
    return out;
  }

  function nodeRow(node, path, depth, isSection) {
    var pad = 14 + depth * 18;
    return '<div class="item-row" style="padding-inline-start:' + pad + 'px">' +
      mediaHTML(node, 'thumb') +
      '<span class="name">' + esc(node.label) + (node.nurse ? ' <b style="opacity:.6">(تمريض)</b>' : '') + '</span>' +
      '<button class="mini" data-edit="' + path + '">تعديل</button>' +
      '<button class="mini" data-add="' + path + '">+ خيار</button>' +
      '<button class="mini danger" data-del="' + path + '">مسح</button>' +
      '</div>';
  }

  /* ============================================================
     واجهة المزامنة
     ============================================================ */
  function timeStr(ts) {
    if (!ts) return '—';
    var d = new Date(Number(ts));
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function syncStateText() {
    if (!window.WasilaSync) return 'المزامنة مش موجودة في النسخة دي.';
    var st = WasilaSync.status();
    var cfg = WasilaSync.config();
    if (!WasilaSync.isOn()) return 'مش متشغلة — التعديلات بتتحفظ على التليفون ده بس.';
    if (st.status === 'err') return 'مش قادر يوصل للسيرفر — هيحاول تاني لوحده.';
    if (st.status === 'pending') return 'بيرفع آخر تعديل…';
    return 'متصلة ✓ · كود العيلة: ' + cfg.code + ' · آخر مزامنة: ' + timeStr(st.at);
  }

  function syncStatusHTML() {
    var extra = (window.WasilaSync && WasilaSync.isOn())
      ? ' <span style="opacity:.55">(نسخة ' + WasilaSync.status().v + ')</span>' : '';
    return esc(syncStateText()) + extra;
  }

  function syncCardHTML() {
    var cfg = (window.WasilaSync && WasilaSync.config()) || { url: '', code: '' };
    return '<div class="card">' +
      '<div class="row"><h3>المزامنة بين التليفونات</h3><span class="spacer"></span></div>' +
      '<div id="syncStatus" style="font-size:12px;line-height:1.7;opacity:.85">' + syncStatusHTML() + '</div>' +
      '<input type="text" id="syncUrl" placeholder="رابط السيرفر (Worker)" value="' + esc(cfg.url) + '">' +
      '<div class="row">' +
      '<input type="text" id="syncCode" placeholder="كود العيلة" value="' + esc(cfg.code) + '" style="max-width:190px">' +
      '<button class="mini" id="syncGen">كود جديد</button>' +
      '</div>' +
      '<div class="row">' +
      '<button class="mini strong" id="syncSave">تشغيل المزامنة</button>' +
      '<button class="mini" id="syncNow">زامن دلوقتي</button>' +
      '<button class="mini" id="syncLink">نسخ لينك الإعداد</button>' +
      '<button class="mini" id="syncOff">إيقاف</button>' +
      '</div>' +
      '<div class="row"><button class="mini" id="syncUndo">رجوع خطوة</button>' +
      '<span style="font-size:12px;opacity:.6">بيرجّع آخر نسخة قبل آخر تعديل</span></div>' +
      '</div>';
  }

  function updateSyncUI() {
    var box = document.getElementById('syncStatus');
    if (box) box.innerHTML = syncStatusHTML();
  }

  function initSync() {
    if (!window.WasilaSync) return;
    WasilaSync.init({
      getLocal: function () { return data; },
      onRemote: function (remote) { applyRemote(remote); },
      onStatus: function () { updateSyncUI(); }
    });
    if (WasilaSync.isOn()) WasilaSync.start();
  }

  /* ------------------------------ مودال تعديل عنصر */
  function editNode(arr, index, title) {
    var isNew = index < 0;
    var cur = isNew ? { label: '', icon: 'dot', nurse: false } : arr[index];
    var picked = cur.icon || 'dot';

    closeModal();
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal">' +
      '<h3>' + esc(title) + '</h3>' +
      '<input type="text" id="mLabel" placeholder="الاسم (مثال: حران)" value="' + esc(cur.label) + '">' +
      '<div style="font-size:13px;opacity:.75">الأيقونة أو الصورة</div>' +
      '<div class="icon-grid" id="mIcons">' +
      /* أول خانتين: صورة من التليفون + كاميرا (جوّه الشبكة نفسها) */
      '<button type="button" class="ph" id="mPick" aria-label="صورة من التليفون"><span class="ph-lab">صورة</span></button>' +
      '<button type="button" class="ph" id="mCam" aria-label="كاميرا"><span class="ph-lab">كاميرا</span></button>' +
      window.ICON_PICKER.map(function (n) {
        return '<button type="button" data-ic="' + n + '" class="' + (n === picked ? 'on' : '') + '">' + icon(n) + '</button>';
      }).join('') +
      '</div>' +
      '<div id="mImgNote" style="font-size:12px;opacity:.75"></div>' +
      '<input type="file" id="mFile" class="file-hidden" ' +
      'accept="image/*,.png,.jpg,.jpeg,.jfif,.webp,.gif,.svg,.avif,.bmp,.ico,.heic,.heif,.tif,.tiff,.apng">' +
      '<input type="file" id="mCamFile" class="file-hidden" accept="image/*" capture="environment">' +
      '<input type="text" id="mImgPath" placeholder="أو مسار صورة في الريبو: images/water.jpg" value="' +
        esc(cur.img && cur.img.indexOf('data:') !== 0 ? cur.img : '') + '">' +
      '<label><input type="checkbox" id="mNurse"' + (cur.nurse ? ' checked' : '') + '> محتاج موافقة تمريض</label>' +
      '<div class="row"><button class="mini strong" id="mSave">حفظ</button>' +
      '<span class="spacer"></span><button class="mini" id="mCancel">إلغاء</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    modal = wrap;

    wrap.querySelectorAll('#mIcons button[data-ic]').forEach(function (b) {
      b.addEventListener('click', function () {
        picked = b.getAttribute('data-ic');
        wrap.querySelectorAll('#mIcons button[data-ic]').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
    });

    /* -------- الصورة -------- */
    var imgVal = cur.img || '';
    var imgMeta = '';   /* «٩٠٠×٦٧٥ · ٩٦ كيلو» */

    function drawPreview() {
      var btn = document.getElementById('mPick');
      var note = document.getElementById('mImgNote');
      if (!btn) return;
      if (!imgVal) {
        btn.innerHTML = '<span class="ph-lab">صورة</span>';
        btn.classList.remove('on');
        note.textContent = '';
        return;
      }
      btn.innerHTML = '<img src="' + esc(imgVal) + '" alt="">' +
        '<span class="ph-x" id="mImgX" role="button" aria-label="مسح الصورة">×</span>';
      btn.classList.add('on');
      note.textContent = '✔ الصورة جاهزة' + (imgMeta || imgSize(imgVal) ? ' — ' + (imgMeta || imgSize(imgVal)) : '');
      var x = document.getElementById('mImgX');
      if (x) x.addEventListener('click', function (ev) {
        ev.stopPropagation();
        imgVal = '';
        imgMeta = '';
        document.getElementById('mImgPath').value = '';
        drawPreview();
      });
    }

    drawPreview();

    function takeFile(e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      document.getElementById('mImgNote').textContent = 'بنجهز الصورة… (ثانية واحدة)';
      processImage(f, function (info, err) {
        if (e.target) e.target.value = '';   /* عشان لو اختار نفس الصورة تاني */
        if (err || !info) {
          notify(err || 'مش قادر أجهز الصورة');
          drawPreview();
          return;
        }
        imgVal = info.url;
        imgMeta = info.kind === 'unsupported'
          ? '⚠ الصيغة دي مش بتتعرض على المتصفح ده — الأفضل PNG أو JPG (وإلا هتظهر الأيقونة)'
          : (info.w ? info.w + '×' + info.h + ' · ' : '') +
            (info.kb < 1 ? 'حجم صغير' : info.kb + ' كيلو') +
            (info.kind === 'vector' ? ' · SVG' : info.kind === 'animated' ? ' · GIF' : '');
        document.getElementById('mImgPath').value = '';
        drawPreview();
      });
    }

    document.getElementById('mFile').addEventListener('change', takeFile);
    document.getElementById('mCamFile').addEventListener('change', takeFile);

    /* أزرار حقيقية + click() برمجي = أضمن حاجة على أندرويد القديم وآيفون */
    document.getElementById('mPick').addEventListener('click', function () {
      document.getElementById('mFile').click();
    });
    document.getElementById('mCam').addEventListener('click', function () {
      var c = document.getElementById('mCamFile');
      if (c) c.click(); else document.getElementById('mFile').click();
    });

    /* اختيار أيقونة = بيستخدم الأيقونة بدل الصورة (الصورة بتتشال) */
    wrap.querySelectorAll('#mIcons button[data-ic]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (imgVal) {
          imgVal = '';
          imgMeta = '';
          document.getElementById('mImgPath').value = '';
          drawPreview();
        }
      });
    });

    document.getElementById('mCancel').addEventListener('click', closeModal);
    document.getElementById('mSave').addEventListener('click', function () {
      var label = document.getElementById('mLabel').value.trim();
      if (!label) { document.getElementById('mLabel').focus(); return; }
      var nurse = document.getElementById('mNurse').checked;
      var typed = document.getElementById('mImgPath').value.trim();
      var img = typed || imgVal || '';
      if (isNew) arr.push({ label: label, icon: picked, nurse: nurse, img: img });
      else {
        arr[index].label = label;
        arr[index].icon = picked;
        arr[index].nurse = nurse;
        if (img) arr[index].img = img;
        else delete arr[index].img;
      }
      /* قسم جديد لازم يكون له id */
      if (isNew && arr === data.sections) arr[arr.length - 1].id = 's' + Date.now();
      if (isNew && arr === data.sections && !arr[arr.length - 1].options) arr[arr.length - 1].options = [];
      saveData();
      closeModal();
      render();
      renderFamily();
    });
  }

  /* ------------------------------ تحديث الأقسام من الريبو */
  /* لو نسخة data.js في الريبو أحدث من اللي متخزنة على التليفون، بنسأل مرة واحدة */
  function maybeUpgrade() {
    var bundled = (window.APP_DATA.meta && window.APP_DATA.meta.version) || 1;
    var mine = (data.meta && data.meta.version) || 1;
    if (mine >= bundled) return;

    closeModal();
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML =
      '<div class="modal">' +
      '<h3>فيه تحديث في الأقسام</h3>' +
      '<div style="font-size:14px;line-height:1.8">' +
      'الأقسام اللي في الموقع اتغيّرت (شيلنا/عدّلنا خيارات).<br>' +
      'لو دوست «حدّث» هترجع للأقسام الأصلية — <b>وأي خيار أو صورة ضفتها من التليفون ده هتتشال</b>.' +
      '</div>' +
      '<div class="row"><button class="mini strong" id="upYes">حدّث الأقسام</button>' +
      '<span class="spacer"></span><button class="mini" id="upNo">سيب اللي عندي</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    modal = wrap;

    document.getElementById('upYes').addEventListener('click', function () {
      data = clone(window.APP_DATA);
      state.stack = [];
      state.page = 0;
      saveData();
      closeModal();
      render();
    });

    document.getElementById('upNo').addEventListener('click', function () {
      data.meta = data.meta || {};
      data.meta.version = bundled;
      saveData();
      closeModal();
    });
  }

  /* ------------------------------ تنبيه بسيط */
  function notify(msg) {
    closeModal();
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal"><h3>' + esc(msg) + '</h3>' +
      '<div class="row"><button class="mini strong" id="nOk">تمام</button></div></div>';
    document.body.appendChild(wrap);
    modal = wrap;
    document.getElementById('nOk').addEventListener('click', closeModal);
  }

  /* ------------------------------ تأكيد بسيط */
  function ask(msg, onYes) {
    closeModal();
    var wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = '<div class="modal"><h3>' + esc(msg) + '</h3>' +
      '<div class="row"><button class="mini strong" id="aYes">أيوه</button>' +
      '<span class="spacer"></span><button class="mini" id="aNo">لأ</button></div></div>';
    document.body.appendChild(wrap);
    modal = wrap;
    document.getElementById('aNo').addEventListener('click', closeModal);
    document.getElementById('aYes').addEventListener('click', function () { closeModal(); onYes(); });
  }

  /* ------------------------------ تصدير / استيراد */
  function dataFileText() {
    return '/* بيانات وسيلة — ارفع الملف ده على GitHub مكان data.js */\n' +
      '/* الصور المرفوعة من الجهاز بتتخزن جوّه الملف كـ data URL */\n' +
      'window.APP_DATA = ' + JSON.stringify(cleanData(), null, 2) + ';\n';
  }

  function cleanData() {
    return { meta: data.meta, sections: data.sections };
  }

  function exportData() {
    var blob = new Blob([dataFileText()], { type: 'text/javascript;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt);
    } else {
      var ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* تجاهل */ }
      ta.remove();
    }
  }

  function importData(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var txt = String(r.result);
        var json = txt.replace(/^\s*window\.APP_DATA\s*=\s*/, '').replace(/;\s*$/, '');
        var d = JSON.parse(json);
        if (!d || !d.sections || !d.sections.length) throw new Error('bad');
        data = d;
        if (!data.meta) data.meta = { version: 1, updated: today() };
        state.stack = []; state.page = 0;
        saveData(); render(); renderFamily();
        ask('تم الاستيراد ✓', function () { });
      } catch (err) {
        ask('الملف مش مفهوم. لازم يكون data.js أو JSON فيه sections.', function () { });
      }
    };
    r.readAsText(f);
  }

  function topStats() {
    var map = {};
    logs.forEach(function (l) {
      var k = l.label;
      map[k] = (map[k] || 0) + 1;
    });
    return Object.keys(map)
      .map(function (k) { return { label: k, n: map[k] }; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 8);
  }

  /* ============================================================
     إعدادات عامة + تشغيل
     ============================================================ */
  function applySettings() {
    document.body.classList.toggle('dark', !!settings.dark);
    var mt = document.querySelector('meta[name="theme-color"]');
    if (mt) mt.setAttribute('content', settings.dark ? '#000000' : '#ffffff');
  }

  function bindGlobal() {
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'help') showHelp();
      else if (act === 'hide') showHide();
      else if (act === 'sos') showSos();
    });

    /* لو صورة مش بتتعرض في المتصفح ده، بنرجع للأيقونة بدلها */
    stage.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      var host = t.parentNode;
      if (!host) return;
      var art = host.classList && host.classList.contains('art') ? host : null;
      if (!art) { t.style.display = 'none'; return; }
      var lvl = state.stack.length ? state.stack[state.stack.length - 1].options : data.sections;
      var node = null;
      if (state.view === 'confirm' || state.view === 'sent') node = state.pending && state.pending.item;
      if (!node) {
        var btn = art.closest('.tile');
        if (btn) node = lvl[Number(btn.getAttribute('data-i'))];
      }
      art.innerHTML = icon(node && node.icon ? node.icon : 'dot');
    }, true);

    document.addEventListener('keydown', function (e) {
      if (overlay || modal) {
        if (e.key === 'Escape') { closeModal(); closeOverlay(); render(); }
        return;
      }
      if (state.view === 'main') {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= 9) {
          var tiles = stage.querySelectorAll('.tile');
          if (tiles[n - 1]) tiles[n - 1].click();
        }
      }
      if (e.key === 'Backspace' || e.key === 'Escape') { e.preventDefault(); goBack(); }
      if (e.key === 'Enter' && state.view === 'confirm') {
        var y = document.getElementById('btnYes');
        if (y) y.click();
      }
    });

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { render(); }, 120);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(render, 200);
    });
  }

  /* الشاشة متقفلش وهي بتعرض اختيارات */
  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    var lock = null;
    function req() {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        l.addEventListener('release', function () { lock = null; });
      }).catch(function () { });
    }
    req();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !lock) req();
    });
  }

  /* مسح الكاش + إلغاء الـ Service Worker + إعادة تحميل: يضمن إنك على آخر نسخة */
  function hardRefresh() {
    function reload() { location.reload(); }
    try {
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }).then(function () {
          if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            return navigator.serviceWorker.getRegistrations().then(function (rs) {
              return Promise.all(rs.map(function (r) { return r.unregister(); }));
            });
          }
        }).then(reload).catch(reload);
        return;
      }
    } catch (e) { /* تجاهل */ }
    reload();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    var hadController = !!navigator.serviceWorker.controller;
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      /* نسخة جديدة مسكت — بنعمل تحديث مرة واحدة بس ومش أول زيارة */
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        if (reg && reg.update) reg.update();
      }).catch(function () { });
    });
  }

  /* ------------------------------ ابدأ */
  data = loadData();
  settings = loadSettings();
  logs = loadLogs();

  applySettings();
  bindGlobal();
  render();
  keepAwake();
  registerSW();
  initSync();
  maybeUpgrade();

  /* للاختبار: نصدّر شوية حاجات */
  window.__wasila = {
    state: state,
    getData: function () { return data; },
    getSettings: function () { return settings; },
    getLogs: function () { return logs; },
    render: render
  };

  window.addEventListener('load', sizeTiles);
})();
