/* ============================================================
   وسيلة — سيرفر المزامنة (Cloudflare Worker + KV)
   ------------------------------------------------------------
   كل اللي بيعمله: بيخزّن نسخة الأقسام بتاعة «كود العيلة» ويرجّعها،
   وبيحتفظ بآخر ١٠ نسخ للرجوع خطوة.

   endpoints (كلها بتاخد ?f=كود_العيلة):
     GET  /                → { v, at, data }   (أو { empty: true })
     GET  /?history=1      → { history: [{v, at}] }
     GET  /?v=3            → نسخة قديمة محددة
     POST /  {data, base}  → { v, at, conflict }
   ============================================================ */

const MAX_HISTORY = 10;
const CODE_RE = /^[a-z0-9]{4,12}$/;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
  'cache-control': 'no-store'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, CORS)
  });
}

function raw(text) {
  return new Response(text, {
    status: 200,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8' }, CORS)
  });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(req.url);
    const f = (url.searchParams.get('f') || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!CODE_RE.test(f)) return json({ error: 'كود العيلة غير صالح' }, 400);
    if (!env.WASILA) return json({ error: 'مفيش KV متوصّل بالـ Worker (WASILA)' }, 500);

    const kDoc = 'd:' + f;
    const kHist = 'h:' + f;

    try {
      /* ---------------- قراءة ---------------- */
      if (req.method === 'GET') {
        if (url.searchParams.get('history')) {
          let hist = [];
          try { hist = JSON.parse((await env.WASILA.get(kHist)) || '[]'); } catch (e) { hist = []; }
          return json({ history: hist });
        }

        const wantV = url.searchParams.get('v');
        const key = wantV ? 's:' + f + ':' + wantV : kDoc;
        const got = await env.WASILA.get(key);
        if (!got) return json({ empty: true });
        return raw(got);
      }

      /* ---------------- كتابة ---------------- */
      if (req.method === 'POST') {
        let body;
        try { body = await req.json(); } catch (e) { return json({ error: 'JSON غير صالح' }, 400); }
        if (!body || !body.data || !Array.isArray(body.data.sections)) {
          return json({ error: 'البيانات غير صالحة (لازم sections)' }, 400);
        }

        const prevRaw = await env.WASILA.get(kDoc);
        const prev = prevRaw ? JSON.parse(prevRaw) : null;
        const prevV = (prev && prev.v) || 0;

        const v = prevV + 1;
        const at = Date.now();
        const snapshot = JSON.stringify({ v: v, at: at, data: body.data });

        /* هيستوري: النسخة اللي قبل كده */
        let hist = [];
        try { hist = JSON.parse((await env.WASILA.get(kHist)) || '[]'); } catch (e) { hist = []; }

        if (prev && prevRaw) {
          await env.WASILA.put('s:' + f + ':' + prev.v, prevRaw);
          hist = hist.filter((h) => h.v !== prev.v);
          hist.unshift({ v: prev.v, at: prev.at || 0 });
          hist = hist.slice(0, MAX_HISTORY);

          /* نظّف النسخ الأقدم من الحد */
          try {
            const list = await env.WASILA.list({ prefix: 's:' + f + ':' });
            const keep = {};
            hist.forEach((h) => { keep['s:' + f + ':' + h.v] = 1; });
            const dead = (list.keys || []).filter((k) => !keep[k.name]).map((k) => k.name);
            await Promise.all(dead.map((name) => env.WASILA.delete(name)));
          } catch (e) { /* التنظيف مش حرج */ }
        }

        await env.WASILA.put(kDoc, snapshot);
        await env.WASILA.put(kHist, JSON.stringify(hist));

        const conflict = !!(body.base && prevV && Number(body.base) < prevV);
        return json({ v: v, at: at, conflict: conflict });
      }

      return json({ error: 'method not allowed' }, 405);
    } catch (e) {
      return json({ error: String((e && e.message) || e) }, 500);
    }
  }
};
