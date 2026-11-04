/* ============================================================
   وسيلة — المزامنة بين التليفونات
   ------------------------------------------------------------
   الفكرة: كل تعديل بيتحفظ محليًا فورًا زي الأول، وبعدها بيترفع
   للسحابة في الخلفية. وأي تليفون تاني بيسأل كل ٢٥ ثانية «فيه جديد؟»
   فياخد أحدث نسخة لوحده — من غير أي زرار على الأهل.

   الإعداد (مرة واحدة لكل تليفون):
     • كود العيلة (٦ حروف)
     • رابط السيرفر (Cloudflare Worker)
   أو يفتحوا لينك فيه ?f=CODE&s=URL  ← أسهل طريقة للأهل
   ============================================================ */
(function () {
  'use strict';

  var CFG_KEY = 'wasila.sync.cfg.v1';
  var ST_KEY = 'wasila.sync.st.v1';
  var POLL_MS = 25000;
  var PUSH_DELAY = 1200;
  var RETRY_MS = 20000;

  var cfg = { url: '', code: '' };
  var st = { v: 0, at: 0, status: 'off', msg: '', pending: false, lastOk: 0 };

  var api = {
    getLocal: function () { return null; },
    onRemote: function () { },
    onStatus: function () { }
  };

  var pollTimer = null;
  var pushTimer = null;
  var retryTimer = null;
  var pushing = false;

  /* ---------------- أدوات ---------------- */
  function rj(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function wj(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function now() { return Date.now(); }
  function cleanUrl(u) { return String(u || '').trim().replace(/\/+$/, ''); }
  function validCode(c) { return /^[a-z0-9]{4,12}$/.test(String(c || '')); }

  function base() { return cleanUrl(cfg.url); }
  function on() { return !!base() && validCode(cfg.code); }

  function setStatus(s, m) {
    st.status = s;
    st.msg = m || '';
    document.body.setAttribute('data-sync', s);
    try { api.onStatus(st); } catch (e) { }
  }

  function persistState() {
    wj(ST_KEY, { v: st.v, at: st.at, code: cfg.code });
  }

  /* ---------------- الإعداد ---------------- */
  function loadConfig() {
    var c = rj(CFG_KEY);
    if (c && typeof c === 'object') { cfg.url = cleanUrl(c.url); cfg.code = String(c.code || ''); }

    /* لو الرابط فيه ?f= أو ?s= → نستخدمهم ونسجّلهم وننضّف العنوان */
    try {
      var u = new URL(location.href);
      var f = u.searchParams.get('f');
      var s = u.searchParams.get('s');
      var changed = false;
      if (f) {
        var cc = String(f).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
        if (cc) { cfg.code = cc; changed = true; }
      }
      if (s) { cfg.url = cleanUrl(decodeURIComponent(s)); changed = true; }
      if (changed) {
        saveConfig();
        u.searchParams.delete('f');
        u.searchParams.delete('s');
        try {
          var h = window.history;
          if (h && typeof h.replaceState === 'function') {
            h.replaceState(null, '', u.pathname + (u.search || '') + (u.hash || ''));
          }
        } catch (e) { /* مش حرج */ }
      }
    } catch (e) { /* متصفح قديم */ }

    /* لو مش متسجل، نشوف هلحقت في data.js */
    if (!cfg.url) {
      var meta = (window.APP_DATA && window.APP_DATA.meta) || {};
      if (meta.sync) cfg.url = cleanUrl(meta.sync);
    }

    var s2 = rj(ST_KEY);
    if (s2 && s2.code === cfg.code) { st.v = Number(s2.v) || 0; st.at = Number(s2.at) || 0; }
  }

  function saveConfig() { wj(CFG_KEY, { url: cleanUrl(cfg.url), code: String(cfg.code || '').toLowerCase() }); }

  /* ---------------- الشبكة ---------------- */
  function urlFor(extra) {
    return base() + '?f=' + encodeURIComponent(cfg.code) + (extra || '');
  }

  function getJSON(u) {
    return fetch(u, { cache: 'no-store', mode: 'cors' }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    });
  }

  /* سحب: نجيب أحدث نسخة ونطبّقها لو هي أحدث من اللي عندنا */
  function pull() {
    if (!on()) return Promise.resolve(false);
    return getJSON(urlFor()).then(function (res) {
      if (res && res.empty) {
        /* مفيش حاجة على السحابة → ارفع اللي عندنا كبداية */
        var local = api.getLocal();
        if (local && local.sections && local.sections.length) return push(local);
        setStatus('on', 'مفيش بيانات مرفوعة');
        return false;
      }
      if (!res || !res.data) { setStatus('on', ''); return false; }
      if (Number(res.v) > st.v) {
        st.v = Number(res.v) || 0;
        st.at = Number(res.at) || now();
        st.pending = false;
        persistState();
        setStatus('on', '');
        try { api.onRemote(res.data, res); } catch (e) { }
        return true;
      }
      st.pending = false;
      persistState();
      setStatus('on', '');
      return false;
    }).catch(function (e) {
      setStatus(navigator.onLine === false ? 'off' : 'err', String((e && e.message) || e));
      return false;
    });
  }

  /* رفع: نبعت النسخة الحالية */
  function push(data) {
    if (!on() || !data) return Promise.resolve(false);
    if (pushing) { st.pending = true; setStatus('pending', 'فيه تعديل مستني'); return Promise.resolve(false); }
    pushing = true;

    var body;
    try { body = JSON.stringify({ base: st.v, data: data }); } catch (e) { pushing = false; return Promise.resolve(false); }

    return fetch(urlFor(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body,
      mode: 'cors'
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error((j && j.error) || ('HTTP ' + r.status));
        return j;
      });
    }).then(function (res) {
      pushing = false;
      if (res && res.v) { st.v = Number(res.v); st.at = Number(res.at) || now(); }
      st.pending = false;
      st.lastOk = now();
      persistState();
      setStatus('on', '');
      return true;
    }).catch(function (e) {
      pushing = false;
      st.pending = true;
      setStatus('err', String((e && e.message) || e));
      scheduleRetry();
      return false;
    });
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(function () {
      retryTimer = null;
      if (document.visibilityState === 'visible') pull();
    }, RETRY_MS);
  }

  /* بعد أي تعديل محلي: رفع بعد ثانية ونص (لو عدّل تاني بسرعة مايبعتش مرتين) */
  function queuePush(data) {
    if (!on()) return;
    st.pending = true;
    setStatus('pending', 'بيرفع التعديل');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      push(data);
    }, PUSH_DELAY);
  }

  /* ---------------- الهيستوري (رجوع خطوة) ---------------- */
  function history() {
    if (!on()) return Promise.reject(new Error('المزامنة مش متشغلة'));
    return getJSON(urlFor('&history=1')).then(function (r) { return (r && r.history) || []; });
  }

  function restore(v) {
    if (!on()) return Promise.reject(new Error('المزامنة مش متشغلة'));
    return getJSON(urlFor('&v=' + encodeURIComponent(v))).then(function (snap) {
      if (!snap || !snap.data) throw new Error('النسخة دي مش موجودة');
      try { api.onRemote(snap.data, snap); } catch (e) { }
      return push(snap.data);
    });
  }

  /* ---------------- التشغيل ---------------- */
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(function () {
      if (document.visibilityState === 'visible') pull();
    }, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function start() {
    if (!on()) { setStatus('off', 'المزامنة مش متشغلة'); return Promise.resolve(false); }
    startPolling();
    return pull();
  }

  function stop() {
    stopPolling();
    clearTimeout(pushTimer);
    pushTimer = null;
    setStatus('off', 'المزامنة متوقفة');
  }

  /* ---------------- التعامل مع الأحداث ---------------- */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && on()) {
      startPolling();
      pull();
    }
  });

  window.addEventListener('online', function () {
    if (on()) pull();
  });

  /* ---------------- الواجهة العامة ---------------- */
  window.WasilaSync = {
    init: function (opts) {
      if (opts) {
        if (opts.getLocal) api.getLocal = opts.getLocal;
        if (opts.onRemote) api.onRemote = opts.onRemote;
        if (opts.onStatus) api.onStatus = opts.onStatus;
      }
      loadConfig();
      setStatus(on() ? 'on' : 'off', '');
      return this;
    },
    start: start,
    stop: stop,
    pull: pull,
    push: push,
    queuePush: queuePush,
    history: history,
    restore: restore,
    isOn: on,
    status: function () { return st; },
    config: function () { return cfg; },
    setConfig: function (url, code) {
      cfg.url = cleanUrl(url || '');
      cfg.code = String(code || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
      saveConfig();
      st.v = 0; st.at = 0; st.pending = false;
      persistState();
      return on();
    },
    makeCode: function () {
      var abc = 'abcdefghjkmnpqrstuvwxyz23456789';
      var out = '';
      for (var i = 0; i < 6; i++) out += abc.charAt(Math.floor(Math.random() * abc.length));
      return out;
    },
    /* لينك جاهز تبعته لأي تليفون: بيفتح ومظبوط لوحده */
    setupLink: function () {
      var u = location.origin + location.pathname;
      return u + '?f=' + encodeURIComponent(cfg.code) + '&s=' + encodeURIComponent(cleanUrl(cfg.url));
    }
  };
})();
