// In-memory stand-in for the AutoShop Pro Supabase project, mirroring the SQL functions' rules.
export function fakeCloud() {
  const db = { records: new Map(), seq: 0, history: [], backups: [], files: new Map(), public: new Map(), users: new Map(), inbox: [], calls: [], secrets: new Map(), aiCalls: [], aiUsage: 0, phone: { configured: false, connected: false, number: '+15125550100', optOuts: [], aiReady: true }, phoneEvents: [], sms: [], dials: [], outbox: new Map(), pay: { configured: false, connected: false, mode: 'test' }, links: new Map(), payEvents: [], refunds: [], checkouts: [], qbo: { configured: false, connected: false, env: 'sandbox', company: 'Main Street Auto LLC', error: null, accounts: [], entries: new Map(), authorizes: [], posts: [] }, cars: { configured: false, connected: new Map(), links: [], reads: 0, nextReading: null } };
  let evSeq = 0;
  let payId = 0;
  // A row in shop_pay_events, as the stripe-webhook function would write it.
  const payEvent = (kind, ref, payload) => {
    if (!db.payEvents.some((e) => e.ref === ref)) db.payEvents.push({ id: ++payId, kind, ref, payload, created_at: new Date().toISOString() });
  };
  // A row in shop_phone_events, as the twilio-webhook function would write it.
  const phoneEvent = (kind, sid, payload, final = true) => {
    const cur = db.phoneEvents.find((e) => e.kind === kind && e.sid === sid);
    if (cur) Object.assign(cur, { payload: { ...cur.payload, ...payload }, final: cur.final || final });
    else db.phoneEvents.push({ id: ++evSeq, kind, sid, payload, final, created_at: new Date().toISOString() });
  };
  const tokens = new Map();
  const refresh = new Map();
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  let n = 0;
  const id = () => `u-${++n}`;

  function issue(u) {
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, email: u.email, role: 'authenticated', app_metadata: u.app_metadata, user_metadata: u.user_metadata, exp: Math.floor(Date.now() / 1000) + 3600, n: ++n })}.sig`;
    const r = `r-${++n}`;
    tokens.set(access, u.id);
    refresh.set(r, u.id);
    return { access_token: access, refresh_token: r, expires_in: 3600, user: { id: u.id, email: u.email, user_metadata: u.user_metadata } };
  }
  const who = (req) => {
    const t = (req.headers().authorization || '').replace(/^Bearer /, '');
    const uid = tokens.get(t);
    return uid ? db.users.get(uid) : null;
  };
  const staff = (u) => Boolean(u?.app_metadata?.autoshop_staff) && !u.banned;
  const key = (c, i) => `${c}/${i}`;

  function push(u, changes, actor, device) {
    const applied = [];
    const conflicts = [];
    for (const c of changes) {
      const k = key(c.collection, c.id);
      const cur = db.records.get(k);
      const body = c.deleted ? null : c.data;
      let row;
      if (!cur) row = { collection: c.collection, id: c.id, data: body, deleted: Boolean(c.deleted), version: 1 };
      else if (c.force || c.base === cur.version) row = { ...cur, data: body, deleted: Boolean(c.deleted), version: cur.version + 1 };
      else {
        conflicts.push({ collection: cur.collection, id: cur.id, version: cur.version, deleted: cur.deleted, data: cur.data, updated_at: cur.updated_at, actor: cur.actor });
        continue;
      }
      Object.assign(row, { seq: ++db.seq, updated_at: new Date().toISOString(), actor, device, updated_by: u.id });
      db.records.set(k, row);
      if (row.collection !== 'activity') db.history.push({ collection: row.collection, id: row.id, version: row.version, data: row.data, deleted: row.deleted, changed_at: row.updated_at, actor, device });
      applied.push({ collection: row.collection, id: row.id, version: row.version, seq: row.seq });
    }
    return { applied, conflicts };
  }
  const pub = (r) => ({ collection: r.collection, id: r.id, data: r.data, deleted: r.deleted, version: r.version, seq: r.seq, updated_at: r.updated_at, actor: r.actor });

  async function handle(route) {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const m = req.method();
    const body = () => {
      try {
        return req.postDataJSON() || {};
      } catch {
        return {};
      }
    };
    const json = (status, data) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    db.calls.push(`${m} ${p}`);
    if (db.offline) return route.abort('internetdisconnected');

    if (p === '/auth/v1/token') {
      const b = body();
      if (url.searchParams.get('grant_type') === 'password') {
        const u = [...db.users.values()].find((x) => x.email === b.email && x.password === b.password && !x.banned);
        return u ? json(200, issue(u)) : json(400, { error_description: 'Invalid login credentials' });
      }
      const uid = refresh.get(b.refresh_token);
      return uid ? json(200, issue(db.users.get(uid))) : json(400, { error_description: 'Invalid Refresh Token: Refresh Token Not Found' });
    }
    if (p === '/auth/v1/user' && m === 'PUT') {
      const u = who(req);
      if (!u) return json(401, { msg: 'JWT expired' });
      const b = body();
      if (b.password) u.password = b.password;
      if (b.data) u.user_metadata = { ...u.user_metadata, ...b.data };
      return json(200, { id: u.id, email: u.email, user_metadata: u.user_metadata });
    }

    if (p.startsWith('/rest/v1/rpc/')) {
      const u = who(req);
      if (!u) return json(401, { message: 'JWT expired' });
      const fn = p.slice('/rest/v1/rpc/'.length);
      const b = body();
      const visible = staff(u);
      if (fn === 'shop_outbox_schedule' || fn === 'shop_outbox_cancel') {
        if (!visible) return json(400, { message: 'Shop staff only' });
        if (fn === 'shop_outbox_cancel') {
          for (const k of b.keys || []) if (db.outbox.get(k)?.status === 'pending') db.outbox.get(k).status = 'cancelled';
          return json(200, 1);
        }
        for (const x of b.items || []) {
          const cur = db.outbox.get(x.key);
          if (cur && !['pending', 'cancelled', 'skipped'].includes(cur.status)) continue;
          db.outbox.set(x.key, { ...x, status: 'pending' });
        }
        return json(200, (b.items || []).length);
      }
      if (fn === 'push_records') {
        if (!visible) return json(403, { message: 'Only shop staff can change shop data' });
        return json(200, push(u, b.changes, b.who, b.from_device));
      }
      const rows = visible ? [...db.records.values()] : [];
      if (fn === 'pull_records') {
        const page = rows.filter((r) => r.seq > (b.since || 0)).sort((a, z) => a.seq - z.seq).slice(0, b.max_rows || 1000);
        return json(200, { rows: page.map(pub), last_seq: page.length ? page.at(-1).seq : b.since, head: Math.max(0, ...rows.map((r) => r.seq)) });
      }
      if (fn === 'shop_manifest') return json(200, { records: rows.sort((a, z) => a.seq - z.seq).map((r) => [r.collection, r.id, r.version]), live: rows.filter((r) => !r.deleted).length, head: Math.max(0, ...rows.map((r) => r.seq)) });
      if (fn === 'get_records') return json(200, (b.keys || []).map(([c, i]) => db.records.get(key(c, i))).filter(Boolean).map(pub));
      if (fn === 'snapshot_shop') {
        if (u.app_metadata.autoshop_role !== 'owner') return json(403, { message: 'Only the owner can make a backup' });
        const live = rows.filter((r) => !r.deleted);
        db.backups.unshift({ id: db.backups.length + 1, created_at: new Date().toISOString(), note: b.note, records: live.length, data: live.map((r) => [r.collection, r.id, r.data]) });
        return json(200, db.backups[0].id);
      }
      if (fn === 'restore_backup') {
        if (u.app_metadata.autoshop_role !== 'owner') return json(403, { message: 'Only the owner can restore a backup' });
        const bk = db.backups.find((x) => x.id === b.backup_id);
        const keep = new Map(bk.data.map(([c, i, d]) => [key(c, i), d]));
        for (const [k, r] of db.records) {
          if (keep.has(k)) push(u, [{ collection: r.collection, id: r.id, data: keep.get(k), force: true }], 'Restored from backup');
          else if (!r.deleted) push(u, [{ collection: r.collection, id: r.id, deleted: true, force: true }], 'Restored from backup');
        }
        return json(200, keep.size);
      }
      return json(404, { message: `no rpc ${fn}` });
    }
    if (p === '/rest/v1/shop_record_history') {
      const u = who(req);
      if (!staff(u)) return json(200, []);
      const c = url.searchParams.get('collection')?.replace(/^eq\./, '');
      const i = url.searchParams.get('id')?.replace(/^eq\./, '');
      return json(200, db.history.filter((h) => h.collection === c && h.id === i).sort((a, z) => z.version - a.version));
    }
    if (p === '/rest/v1/shop_backups') {
      const u = who(req);
      if (!staff(u)) return json(200, []);
      const idq = url.searchParams.get('id');
      const list = idq ? db.backups.filter((x) => `eq.${x.id}` === idq) : db.backups;
      const withData = (url.searchParams.get('select') || '').includes('data');
      return json(200, list.map((x) => (withData ? x : { id: x.id, created_at: x.created_at, note: x.note, records: x.records })));
    }
    if (p === '/rest/v1/shop_inbox') {
      if (m === 'POST') {
        const b = body();
        if (!['booking', 'approval', 'message', 'checkin'].includes(b.kind)) return json(400, { message: 'new row violates check constraint "shop_inbox_kind_check"' });
        if (JSON.stringify(b.payload || {}).length >= 20000) return json(400, { message: 'new row violates check constraint "shop_inbox_payload_check"' });
        db.inbox.push({ id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, created_at: new Date().toISOString(), kind: b.kind, ref: b.ref || null, payload: b.payload });
        return route.fulfill({ status: 201 });
      }
      if (!staff(who(req))) return m === 'GET' ? json(200, []) : route.fulfill({ status: 204 });
      if (m === 'GET') return json(200, db.inbox);
      if (m === 'DELETE') {
        const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map(decodeURIComponent);
        db.inbox = db.inbox.filter((r) => !ids.includes(r.id));
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({ status: 204 });
    }
    if (p.startsWith('/storage/v1/object/authenticated/autoshop-files/')) {
      if (!staff(who(req))) return json(400, { statusCode: '403', error: 'Unauthorized' });
      const f = db.files.get(p.slice('/storage/v1/object/authenticated/autoshop-files/'.length));
      return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body }) : json(400, { statusCode: '404', error: 'not_found' });
    }
    if (p.startsWith('/storage/v1/object/autoshop-files/')) {
      if (!staff(who(req))) return json(403, { message: 'new row violates row-level security policy' });
      db.files.set(p.slice('/storage/v1/object/autoshop-files/'.length), { type: req.headers()['content-type'], body: req.postDataBuffer() });
      return json(200, { Key: p });
    }
    if (p.startsWith('/storage/v1/object/public/')) {
      const f = db.public.get(p.slice('/storage/v1/object/public/'.length));
      return f ? route.fulfill({ status: 200, contentType: f.type, body: f.body, headers: { 'access-control-allow-origin': '*' } }) : json(400, { statusCode: '404', error: 'not_found' });
    }
    if (p.startsWith('/storage/v1/object/') && (m === 'POST' || m === 'PUT')) {
      if (!staff(who(req))) return json(403, { message: 'new row violates row-level security policy' });
      db.public.set(p.slice('/storage/v1/object/'.length), { type: req.headers()['content-type'], body: req.postDataBuffer() });
      return json(200, { Key: p });
    }
    if (p.startsWith('/storage/v1/object/')) return json(200, {});
    if (p === '/rest/v1/shop_phone_events') {
      if (!staff(who(req))) return json(200, []);
      if (m === 'GET') return json(200, [...db.phoneEvents].sort((a, b) => a.id - b.id));
      if (m === 'DELETE') {
        const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map(Number);
        db.phoneEvents = db.phoneEvents.filter((r) => !ids.includes(r.id));
        return route.fulfill({ status: 204 });
      }
    }
    if (p === '/rest/v1/shop_sms_outbox') {
      if (!staff(who(req))) return json(200, []);
      return json(200, [...db.outbox.values()].filter((r) => r.key.startsWith('appt-')).map((r) => ({ key: r.key, to_phone: r.to_phone, send_at: r.send_at, status: r.status, meta: r.meta })));
    }
    if (p === '/rest/v1/shop_pay_events') {
      if (!staff(who(req))) return json(200, []);
      if (m === 'GET') return json(200, [...db.payEvents].sort((a, b) => a.id - b.id));
      if (m === 'DELETE') {
        const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').map(Number);
        db.payEvents = db.payEvents.filter((r) => !ids.includes(r.id));
        return route.fulfill({ status: 204 });
      }
    }
    if (p === '/functions/v1/pay-link') {
      const cors = { 'access-control-allow-origin': '*' };
      if (m === 'OPTIONS') return route.fulfill({ status: 200, headers: { ...cors, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST' } });
      const out = (status, data) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(data) });
      const l = db.links.get(m === 'GET' ? url.searchParams.get('id') : body().id);
      if (!l) return out(404, { message: 'This payment link isn’t valid. Please contact the shop.' });
      if (m === 'GET') return out(200, { shop: l.shopName, phone: l.shopPhone, title: l.title, ro: l.roNumber, amount: l.amount, currency: 'usd', status: l.status, paidAt: l.paidAt || null, test: db.pay.mode === 'test', ready: db.pay.configured });
      if (l.status === 'paid') return out(409, { message: 'This invoice has already been paid — thank you!' });
      if (l.status === 'void') return out(410, { message: 'This payment link has been replaced.' });
      db.checkouts.push(l.id);
      return out(200, { url: `${l.url}${l.url.includes('?') ? '&' : '?'}paid=1` });
    }
    if (p === '/functions/v1/shop-pay') {
      const u = who(req);
      if (!staff(u)) return json(403, { message: 'Shop staff only' });
      const b = body();
      const role = u.app_metadata.autoshop_role;
      if (b.action === 'status') return json(200, db.pay.configured ? { configured: true, connected: db.pay.connected, mode: db.pay.mode, account: { name: 'Main Street Auto', chargesEnabled: true }, webhook: 'x' } : { configured: false, connected: false });
      if (!db.pay.configured) return json(412, { message: 'Add your Stripe secret key in Settings → Keys & AI first.' });
      if (b.action === 'connect') {
        if (role !== 'owner') return json(403, { message: 'Only the owner can connect Stripe' });
        db.pay.connected = true;
        return json(200, { ok: true, mode: db.pay.mode });
      }
      if (b.action === 'link') {
        for (const l of db.links.values()) if (l.orderId === b.orderId && l.status === 'open') l.status = 'void';
        const id = `Lnk${String(db.links.size + 1).padStart(9, '0')}`;
        const url = `${b.returnBase.replace(/\/+$/, '')}/${id}${b.returnQuery ? `?${b.returnQuery}` : ''}`;
        db.links.set(id, { id, url, orderId: b.orderId, roNumber: b.roNumber, amount: Math.round(b.amount * 100) / 100, title: b.title, shopName: b.shopName, shopPhone: b.shopPhone, email: b.email, status: 'open' });
        return json(200, { id, url, amount: Math.round(b.amount * 100) / 100, mode: db.pay.mode });
      }
      if (b.action === 'refund') {
        if (!['owner', 'manager'].includes(role)) return json(403, { message: 'Only the owner or a manager can refund' });
        db.refunds.push(b);
        return json(200, { id: `re_${db.refunds.length}`, amount: b.amount, status: 'succeeded' });
      }
      return json(400, { message: 'Unknown action' });
    }
    if (p === '/functions/v1/shop-qbo') {
      const u = who(req);
      if (!staff(u)) return json(403, { message: 'Shop staff only' });
      const role = u.app_metadata.autoshop_role;
      if (!['owner', 'manager'].includes(role)) return json(403, { message: 'Only the owner or a manager can work with QuickBooks' });
      const b = body();
      const q = db.qbo;
      const redirectUri = 'https://huwcrbkplpudpsfczbyg.supabase.co/functions/v1/oauth-callback';
      if (b.action === 'status') return json(200, { configured: q.configured, connected: q.connected, env: q.connected ? q.env : null, company: q.connected && !q.error ? q.company : null, error: q.error, redirectUri });
      if (!q.configured) return json(412, { message: "Add your Intuit app's Client ID and Client secret in Settings → Keys & AI first.", code: 'not_configured' });
      if (b.action === 'authorize') {
        if (role !== 'owner') return json(403, { message: 'Only the owner can connect QuickBooks' });
        q.authorizes.push(b);
        // Stand in for Intuit: approve right away and send them back.
        q.connected = true;
        q.env = b.env === 'production' ? 'production' : 'sandbox';
        const ret = new URL(b.returnUrl);
        ret.searchParams.set('qbo', 'connected');
        return json(200, { url: ret.toString() });
      }
      if (b.action === 'disconnect') {
        q.connected = false;
        return json(200, { ok: true });
      }
      if (!q.connected) return json(412, { message: "QuickBooks isn't connected" });
      if (b.action === 'accounts') return json(200, { accounts: q.accounts });
      if (b.action === 'post') {
        q.posts.push(b);
        const results = [];
        for (const j of b.journals || []) {
          let dr = 0;
          let cr = 0;
          let err = null;
          for (const l of j.lines) {
            if (!b.map?.[l.account]?.id) err = `Choose a QuickBooks account for “${l.account}”`;
            dr += Math.round(l.debit * 100);
            cr += Math.round(l.credit * 100);
          }
          if (!err && dr !== cr) err = `Debits and credits differ by ${((dr - cr) / 100).toFixed(2)}`;
          if (err) {
            results.push({ no: j.no, status: 'error', error: err });
            continue;
          }
          const fp = JSON.stringify([j.date, j.lines.map((l) => [b.map[l.account].id, l.debit, l.credit])]);
          const cur = q.entries.get(j.no);
          if (cur && cur.fp === fp) results.push({ no: j.no, status: 'unchanged', id: cur.id });
          else if (cur) {
            cur.fp = fp;
            results.push({ no: j.no, status: 'updated', id: cur.id });
          } else {
            const idn = String(q.entries.size + 100);
            q.entries.set(j.no, { id: idn, fp, journal: j });
            results.push({ no: j.no, status: 'created', id: idn });
          }
        }
        return json(200, { results });
      }
      return json(400, { message: 'Unknown action' });
    }
    if (p === '/functions/v1/shop-cars') {
      const u = who(req);
      if (!staff(u)) return json(403, { message: 'Shop staff only' });
      const b = body();
      const c = db.cars;
      const view = (r) => ({ vehicleId: r.vehicleId, vin: r.vin, make: r.make, model: r.model, year: r.year, reading: r.reading || null, readAt: r.readAt || null, connectedAt: r.connectedAt });
      if (b.action === 'status') return json(200, { configured: c.configured, redirectUri: 'https://huwcrbkplpudpsfczbyg.supabase.co/functions/v1/oauth-callback', cars: (b.vehicleIds || []).map((x) => c.connected.get(x)).filter(Boolean).map(view) });
      if (!c.configured) return json(412, { message: 'Add your Smartcar Client ID and Client secret in Settings → Keys & AI first.', code: 'not_configured' });
      if (b.action === 'link') {
        c.links.push(b);
        return json(200, { url: `https://huwcrbkplpudpsfczbyg.supabase.co/functions/v1/oauth-callback?go=state${c.links.length}abcdef0123456789`, expiresIn: 604800 });
      }
      const row = c.connected.get(b.vehicleId);
      if (!row) return json(404, { message: 'This vehicle isn’t connected.', code: 'not_connected' });
      if (b.action === 'read') {
        c.reads += 1;
        if (c.failRead) return json(409, { message: c.failRead, code: 'expired' });
        row.reading = c.nextReading || row.reading;
        row.readAt = new Date().toISOString();
        return json(200, view(row));
      }
      if (b.action === 'unlink') {
        c.connected.delete(b.vehicleId);
        return json(200, { ok: true });
      }
      return json(400, { message: 'Unknown action' });
    }
    if (p === '/functions/v1/shop-phone') {
      const u = who(req);
      if (!staff(u)) return json(403, { message: 'Shop staff only' });
      const b = body();
      const ph = db.phone;
      if (b.action === 'status') return json(200, { configured: ph.configured, phone: ph.configured ? ph.number : null, connected: ph.connected, connectedAt: ph.connectedAt || null, webhook: 'https://huwcrbkplpudpsfczbyg.supabase.co/functions/v1/twilio-webhook', aiReady: ph.aiReady, optOuts: ph.optOuts });
      if (!ph.configured) return json(412, { message: 'Add your Twilio Account SID, Auth token and business phone number in Settings → Keys & AI first.', code: 'not_configured' });
      if (b.action === 'connect') {
        if (u.app_metadata.autoshop_role !== 'owner') return json(403, { message: 'Only the owner can connect the business number' });
        ph.connected = true;
        ph.connectedAt = new Date().toISOString();
        return json(200, { ok: true, phone: ph.number, connectedAt: ph.connectedAt });
      }
      const e164 = (x) => { const d = String(x || '').replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length === 11 ? `+${d}` : ''; };
      if (b.action === 'send') {
        const to = e164(b.to);
        if (ph.optOuts.includes(to)) return json(409, { message: 'This customer replied STOP, so texts to them are blocked until they reply START.', code: 'opted_out' });
        if (to === '+15125559999') return json(400, { message: 'That number can’t receive texts — check it’s a mobile number.', code: 'bad_number' });
        const sid = `SM${String(db.sms.length + 1).padStart(4, '0')}`;
        db.sms.push({ sid, to, body: b.body });
        return json(200, { sid, status: 'queued', to, from: ph.number, segments: 1 });
      }
      if (b.action === 'call') {
        const sid = `CAout${db.dials.length + 1}`;
        db.dials.push({ sid, to: e164(b.to), ring: e164(b.ring), name: b.name });
        return json(200, { sid, ring: e164(b.ring), to: e164(b.to) });
      }
      return json(400, { message: 'Unknown action' });
    }
    if (p === '/functions/v1/shop-secrets') {
      const u = who(req);
      if (!staff(u)) return json(403, { error: 'Shop staff only', message: 'Shop staff only' });
      const b = body();
      const role = u.app_metadata.autoshop_role;
      const SETTINGS = ['ai_model', 'ai_monthly_cap', 'twilio_phone'];
      if (b.action === 'list') {
        if (!['owner', 'manager'].includes(role)) return json(403, { message: 'Only the owner or a manager can see integration keys' });
        const keys = [...db.secrets.entries()].filter(([, v]) => v.value).map(([name, v]) => ({ name, set: true, hint: SETTINGS.includes(name) || v.value.length < 8 ? null : v.value.slice(-4), updatedAt: v.at }));
        const settings = Object.fromEntries(SETTINGS.filter((n) => db.secrets.get(n)?.value).map((n) => [n, db.secrets.get(n).value]));
        return json(200, { keys, settings });
      }
      if (b.action === 'set' || b.action === 'clear') {
        if (role !== 'owner') return json(403, { message: 'Only the owner can change integration keys' });
        db.secrets.set(b.name, { value: b.action === 'clear' ? '' : String(b.value || '').trim(), at: new Date().toISOString() });
        return json(200, { ok: true });
      }
      return json(400, { message: 'Unknown action' });
    }
    if (p === '/functions/v1/shop-ai') {
      const u = who(req);
      if (!staff(u)) return json(403, { message: 'Shop staff only' });
      const b = body();
      const key = db.secrets.get('anthropic_api_key')?.value;
      if (b.action === 'status') return json(200, { ready: Boolean(key), usage: db.aiUsage });
      if (!key) return json(412, { message: 'The AI assistant isn’t set up yet — the owner adds an Anthropic API key in Settings → Keys & AI.' });
      db.aiCalls.push(b);
      db.aiUsage += 1;
      const TEXT = {
        explain: 'Hi! Here is what we found on your vehicle. Needs attention now: your front brakes are worn. Can wait: wipers. Questions? Just reply.',
        update: 'Hi there, quick update: your vehicle is being worked on now. — Main Street Auto Service',
        story: 'Cause: Front pads worn to 2 mm, rotors scored.\nCorrection: Replaced front pads and rotors, road tested OK.',
        diagnose: '1) Likely causes…\n2) Test plan…',
        summary: '- Loyal customer since 2024\n- Declined wipers last visit',
        reply: 'Thanks for your message — your car will be ready by 4 PM today.',
        ask: 'Answer: based on the data, check the front brakes first.',
      };
      return json(200, { text: TEXT[b.task] || 'OK', model: db.secrets.get('ai_model')?.value || 'claude-sonnet-5-5', usage: { input_tokens: 500, output_tokens: 80 } });
    }
    if (p === '/functions/v1/shop-admin') {
      const u = who(req);
      if (!staff(u)) return json(403, { error: 'Shop staff only', message: 'Shop staff only' });
      const b = body();
      const owner = u.app_metadata.autoshop_role === 'owner';
      const view = (x) => ({ id: x.id, email: x.email, name: x.user_metadata?.name || '', role: x.app_metadata.autoshop_role, staffId: x.app_metadata.autoshop_staff_id, active: staff(x), lastSignIn: null, mustChange: Boolean(x.user_metadata?.must_change_password) });
      if (b.action === 'list') return json(200, { users: [...db.users.values()].map(view) });
      if (!owner && b.action !== 'prune') return json(403, { message: 'Only the owner can change logins' });
      if (b.action === 'invite') {
        const password = 'Temp-Pass-1234';
        const nu = addUser(b.email, password, { autoshop_staff: true, autoshop_role: b.role, autoshop_staff_id: b.staffId }, { name: b.name, must_change_password: true });
        return json(200, { user: view(nu), password });
      }
      if (b.action === 'reset') {
        const x = db.users.get(b.userId);
        x.password = 'Reset-Pass-5678';
        x.user_metadata.must_change_password = true;
        return json(200, { user: view(x), password: x.password });
      }
      if (b.action === 'remove') {
        const x = db.users.get(b.userId);
        x.banned = true;
        x.app_metadata.autoshop_staff = false;
        return json(200, { user: view(x) });
      }
      if (b.action === 'update') {
        const x = db.users.get(b.userId);
        if (b.role) x.app_metadata.autoshop_role = b.role;
        if (b.staffId !== undefined) x.app_metadata.autoshop_staff_id = b.staffId;
        return json(200, { user: view(x) });
      }
      if (b.action === 'prune') return json(200, { ok: true });
      return json(400, { message: 'Unknown action' });
    }
    return json(404, { message: `fake: no route ${m} ${p}` });
  }

  function addUser(email, password, app_metadata, user_metadata = {}) {
    const u = { id: id(), email, password, app_metadata: { provider: 'email', ...app_metadata }, user_metadata };
    db.users.set(u.id, u);
    return u;
  }

  return { db, handle, addUser, phoneEvent, payEvent, live: () => [...db.records.values()].filter((r) => !r.deleted).length };
}
