// ============================================================
// COPE AESTHETIC CUSTOMS — MOCK BACKEND (mock-backend.js)
// ============================================================
// This file intercepts every fetch() call to /api/* and returns
// realistic responses from the MOCK object in core.js, persisted
// to localStorage so actions (updates, status changes) stick during
// a browsing session.
//
// This is the ONLY change from the real Flask-backed app —
// every page keeps working exactly the same because it still calls
// apiFetch('/api/...') and still gets back { ok, status, data }.
//
// Load order in every HTML file:
//   <script src="core.js"></script>        ← MOCK data + apiFetch()
//   <script src="mock-backend.js"></script> ← fetch interceptor (this file)
// ============================================================


// ------------------------------------------------------------
// DEMO BANNER — shown at the top of every page
// ------------------------------------------------------------
(function injectDemoBanner() {
  // Don't inject twice
  if (document.getElementById('demo-banner')) return;

  function addBanner() {
    const bar = document.createElement('div');
    bar.id = 'demo-banner';
    bar.innerHTML = `
      <span class="demo-banner-pill">DEMO</span>
      <span class="demo-banner-text">
        You're viewing a portfolio demo of Custom Flow — a capstone project for Cope Aesthetic Customs.
        Data resets when you clear your browser.
      </span>
      <a href="#" class="demo-banner-home" id="demo-reset-link" onclick="if(confirm('Reset all demo data back to the starting state?'))window.resetDemoData();return false;">↻ Reset</a>
      <a href="landing.html" class="demo-banner-home">← Home</a>
    `;
    document.body.insertBefore(bar, document.body.firstChild);
    document.documentElement.classList.add('has-demo-banner');
  }

  if (document.body) addBanner();
  else document.addEventListener('DOMContentLoaded', addBanner);
})();


// ------------------------------------------------------------
// DATA STORE — persists MOCK to localStorage so updates stick
// ------------------------------------------------------------
// First page load seeds from core.js's MOCK. Every subsequent request
// reads from localStorage so edits Buffy makes in one tab carry over.
const DB = (function() {
  const KEY = 'cope_demo_db_v1';

  function seed() {
    // Deep clone MOCK so our mutations don't affect core.js's original
    return JSON.parse(JSON.stringify(MOCK));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        const fresh = seed();
        localStorage.setItem(KEY, JSON.stringify(fresh));
        return fresh;
      }
      return JSON.parse(raw);
    } catch(e) {
      const fresh = seed();
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return fresh;
    }
  }

  function save(db) {
    localStorage.setItem(KEY, JSON.stringify(db));
  }

  function reset() {
    localStorage.removeItem(KEY);
    return load();
  }

  return { load, save, reset, KEY };
})();

// Expose a reset helper for debugging and for the demo banner
window.resetDemoData = function() {
  DB.reset();
  showToast && showToast('Demo data reset!');
  setTimeout(() => location.reload(), 500);
};


// ------------------------------------------------------------
// RESPONSE HELPERS
// ------------------------------------------------------------
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
function errorResponse(msg, status = 400) {
  return jsonResponse({ error: msg }, status);
}

// Decode our fake JWTs — they're just base64-encoded JSON with an exp claim,
// mimicking the real Flask JWT shape enough for the frontend to accept them
function decodeToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch(e) { return null; }
}

function extractToken(request) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return decodeToken(auth.slice(7));
}

function makeToken(user) {
  // header.payload.signature — signature is fake; the frontend never verifies it
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    user_id: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  }));
  return `${header}.${payload}.demo-signature`;
}


// ------------------------------------------------------------
// ROUTE MATCHING HELPERS
// ------------------------------------------------------------
// Simple path matcher — returns { match, params } for patterns like
// '/api/orders/:id' matched against '/api/orders/1047'
function matchPath(pattern, path) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}


// ------------------------------------------------------------
// ROUTE HANDLERS
// ------------------------------------------------------------
// Each handler returns a Response object. They can be async.
// The router below dispatches based on METHOD + path pattern.
async function handleRequest(request) {
  const url = new URL(request.url, location.origin);
  const path = url.pathname;
  const method = request.method;
  let body = {};
  try {
    if (request.body) body = await request.clone().json();
  } catch(e) {}

  const db = DB.load();

  // Artificial delay so loading spinners actually appear
  await new Promise(r => setTimeout(r, 120 + Math.random() * 180));

  // ========== AUTH ==========

  if (method === 'POST' && path === '/api/login') {
    const { email, password } = body;
    const user = db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
    if (!user) return errorResponse('Invalid email or password.', 401);
    // In demo, any password works for seeded users — or 'admin123' / 'customer123' specifically
    // (kept loose so the pre-filled creds are foolproof)
    return jsonResponse({
      token: makeToken(user),
      user: { ...user, password_hash: undefined },
    });
  }

  if (method === 'POST' && path === '/api/register') {
    const { name, email, password, phone, notify_email, customer_type } = body;
    if (!email || !password) return errorResponse('Email and password required.');
    if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return errorResponse('An account with that email already exists.');
    }
    const newUser = {
      id: Math.max(...db.users.map(u => u.id)) + 1,
      name: name || email,
      email,
      role: 'customer',
      phone: phone || '',
      notify_email: notify_email !== false,
      notify_sms: false,
      customer_type: customer_type || 'individual',
      influencer_status: customer_type === 'influencer' ? 'pending' : null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    db.users.push(newUser);
    DB.save(db);
    return jsonResponse({
      token: makeToken(newUser),
      user: newUser,
    });
  }

  // ========== AUTH GUARD for everything below ==========
  const tokenPayload = extractToken(request);
  if (!tokenPayload) return errorResponse('Unauthorized', 401);
  const currentUser = db.users.find(u => u.id === tokenPayload.user_id);
  if (!currentUser) return errorResponse('Unauthorized', 401);
  const isAdmin = currentUser.role === 'owner' || currentUser.role === 'employee';

  // ========== USERS ==========

  if (method === 'GET' && path === '/api/users/me') {
    return jsonResponse(currentUser);
  }

  if (method === 'PATCH' && path === '/api/users/me') {
    Object.assign(currentUser, body);
    DB.save(db);
    return jsonResponse(currentUser);
  }

  if (method === 'GET' && path === '/api/users') {
    if (!isAdmin) return errorResponse('Forbidden', 403);
    return jsonResponse(db.users.map(u => ({ ...u, password_hash: undefined })));
  }

  if (method === 'GET' && path === '/api/users/influencer-pending') {
    if (!isAdmin) return errorResponse('Forbidden', 403);
    return jsonResponse(db.users.filter(u => u.influencer_status === 'pending'));
  }

  {
    const m = matchPath('/api/users/:id', path);
    if (m) {
      const id = parseInt(m.id);
      const target = db.users.find(u => u.id === id);
      if (!target) return errorResponse('User not found', 404);
      if (method === 'GET')  return jsonResponse(target);
      if (method === 'PATCH') { Object.assign(target, body); DB.save(db); return jsonResponse(target); }
      if (method === 'DELETE') { db.users = db.users.filter(u => u.id !== id); DB.save(db); return jsonResponse({ ok: true }); }
    }
  }

  if (method === 'POST' && path === '/api/change-password') {
    // Demo: always succeed
    return jsonResponse({ ok: true });
  }

  // ========== ORDERS ==========

  if (method === 'GET' && path === '/api/orders') {
    const archived = url.searchParams.get('archived') === 'true';
    let orders = db.orders.filter(o => !!o.is_archived === archived);
    if (!isAdmin) orders = orders.filter(o => o.user_id === currentUser.id);
    // Attach customer_name for admin table rows
    const withNames = orders.map(o => {
      const u = db.users.find(x => x.id === o.user_id);
      return { ...o, customer_name: u ? u.name : '—', order_number: o.order_number || String(o.id) };
    });
    withNames.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return jsonResponse(withNames);
  }

  if (method === 'POST' && path === '/api/orders') {
    const newOrder = {
      id: Math.max(...db.orders.map(o => o.id), 1000) + 1,
      user_id: body.user_id || currentUser.id,
      pricing_tier: body.pricing_tier || 'standard',
      item_type: body.item_type || 'Other',
      must_have_by: body.must_have_by || null,
      is_rush: !!body.is_rush,
      rush_approved: false,
      rush_fee: 0,
      booking_fee_paid: false,
      status: 'free_waitlist',
      customer_notes: body.customer_notes || '',
      admin_notes: '',
      inbound_tracking: null,
      outbound_tracking: null,
      outbound_carrier: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.orders.push(newOrder);
    DB.save(db);
    return jsonResponse(newOrder);
  }

  {
    const m = matchPath('/api/orders/:id', path);
    if (m) {
      const id = parseInt(m.id);
      const order = db.orders.find(o => o.id === id);
      if (!order) return errorResponse('Order not found', 404);
      if (!isAdmin && order.user_id !== currentUser.id) return errorResponse('Forbidden', 403);

      if (method === 'GET') {
        const customer = db.users.find(u => u.id === order.user_id);
        return jsonResponse({
          order: { ...order, customer_name: customer ? customer.name : '—' },
          customer: customer || null,
          payments: db.payments.filter(p => p.order_id === id),
          mockups: db.mockups.filter(m => m.order_id === id),
          revisions: db.revisions.filter(r => r.order_id === id),
          order_images: db.order_images.filter(i => i.order_id === id),
          status_history: db.status_history.filter(h => h.order_id === id),
          consult_calls: db.consult_calls.filter(c => c.order_id === id),
          add_ons: db.add_ons.filter(a => a.order_id === id),
          invoices: (db.invoices || []).filter(i => i.order_id === id),
        });
      }
      if (method === 'PATCH') {
        // Log status changes to history
        if (body.status && body.status !== order.status) {
          db.status_history.push({
            id: (db.status_history.length ? Math.max(...db.status_history.map(h => h.id)) : 0) + 1,
            order_id: id,
            from_status: order.status,
            to_status: body.status,
            changed_by: currentUser.id,
            changed_at: new Date().toISOString(),
            note: body.note || '',
          });
        }
        Object.assign(order, body);
        order.updated_at = new Date().toISOString();
        DB.save(db);
        return jsonResponse(order);
      }
    }
  }

  {
    const m = matchPath('/api/orders/:id/archive', path);
    if (m && method === 'POST') {
      const order = db.orders.find(o => o.id === parseInt(m.id));
      if (!order) return errorResponse('Order not found', 404);
      order.is_archived = true;
      order.archived_at = new Date().toISOString();
      DB.save(db);
      return jsonResponse(order);
    }
  }

  {
    const m = matchPath('/api/orders/:id/images', path);
    if (m) {
      const oid = parseInt(m.id);
      if (method === 'GET') return jsonResponse(db.order_images.filter(i => i.order_id === oid));
      if (method === 'POST') {
        const newImg = {
          id: (db.order_images.length ? Math.max(...db.order_images.map(i => i.id)) : 0) + 1,
          order_id: oid,
          url: body.url || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23F217A5"/><text x="100" y="105" text-anchor="middle" fill="white" font-family="sans-serif" font-size="14">Demo Image</text></svg>',
          type: body.type || 'reference',
          uploaded_at: new Date().toISOString(),
        };
        db.order_images.push(newImg);
        DB.save(db);
        return jsonResponse(newImg);
      }
    }
  }

  {
    const m = matchPath('/api/orders/:id/images/:imgId', path);
    if (m && method === 'DELETE') {
      db.order_images = db.order_images.filter(i => i.id !== parseInt(m.imgId));
      DB.save(db);
      return jsonResponse({ ok: true });
    }
  }

  {
    const m = matchPath('/api/orders/:id/invoices', path);
    if (m) {
      const oid = parseInt(m.id);
      if (method === 'GET') return jsonResponse((db.invoices || []).filter(i => i.order_id === oid));
      if (method === 'POST') {
        if (!db.invoices) db.invoices = [];
        const newInv = {
          id: (db.invoices.length ? Math.max(...db.invoices.map(i => i.id)) : 0) + 1,
          order_id: oid,
          doc_type: body.doc_type || 'invoice',
          doc_number: body.doc_number || ('INV-' + Date.now()),
          label: body.label || 'Invoice',
          amount: body.amount || 0,
          subtotal: body.subtotal || body.amount || 0,
          line_items: body.line_items || '[]',
          notes: body.notes || '',
          status: 'draft',
          file_url: null,
          uploaded_at: new Date().toISOString(),
          sent_at: null,
        };
        db.invoices.push(newInv);
        DB.save(db);
        return jsonResponse(newInv);
      }
    }
  }

  {
    const m = matchPath('/api/invoices/:id', path);
    if (m) {
      const invs = db.invoices || [];
      const inv = invs.find(i => i.id === parseInt(m.id));
      if (method === 'PATCH' && inv) { Object.assign(inv, body); DB.save(db); return jsonResponse(inv); }
      if (method === 'DELETE') {
        db.invoices = invs.filter(i => i.id !== parseInt(m.id));
        DB.save(db);
        return jsonResponse({ ok: true });
      }
    }
  }

  {
    const m = matchPath('/api/invoices/:id/send', path);
    if (m && method === 'POST') {
      const inv = (db.invoices || []).find(i => i.id === parseInt(m.id));
      if (inv) { inv.status = 'sent'; inv.sent_at = new Date().toISOString(); DB.save(db); }
      return jsonResponse({ ok: true, email_sent: false, demo_mode: true });
    }
  }

  // ========== PAYMENTS / REVISIONS / ADD-ONS / CONSULTS ==========

  if (method === 'POST' && path === '/api/payments') {
    const newP = {
      id: (db.payments.length ? Math.max(...db.payments.map(p => p.id)) : 0) + 1,
      order_id: body.order_id,
      amount: parseFloat(body.amount) || 0,
      type: body.type || 'custom',
      method: body.method || 'Other',
      status: 'paid',
      recorded_at: new Date().toISOString(),
    };
    db.payments.push(newP);
    // Auto-mark booking_fee_paid
    if (newP.type === 'booking') {
      const order = db.orders.find(o => o.id === newP.order_id);
      if (order) order.booking_fee_paid = true;
    }
    DB.save(db);
    return jsonResponse(newP);
  }

  if (method === 'POST' && path === '/api/revisions') {
    const newR = {
      id: (db.revisions.length ? Math.max(...db.revisions.map(r => r.id)) : 0) + 1,
      order_id: body.order_id,
      mockup_id: body.mockup_id || null,
      revision_number: body.revision_number || (db.revisions.filter(r => r.order_id === body.order_id).length + 1),
      notes: body.notes || '',
      charge_amount: body.charge_amount || 0,
      completed: false,
      created_at: new Date().toISOString(),
    };
    db.revisions.push(newR);
    DB.save(db);
    return jsonResponse(newR);
  }

  {
    const m = matchPath('/api/revisions/:id', path);
    if (m) {
      const rev = db.revisions.find(r => r.id === parseInt(m.id));
      if (method === 'PATCH' && rev) { Object.assign(rev, body); DB.save(db); return jsonResponse(rev); }
      if (method === 'DELETE') { db.revisions = db.revisions.filter(r => r.id !== parseInt(m.id)); DB.save(db); return jsonResponse({ ok: true }); }
    }
  }

  if (method === 'POST' && path === '/api/add_ons') {
    const newA = {
      id: (db.add_ons.length ? Math.max(...db.add_ons.map(a => a.id)) : 0) + 1,
      order_id: body.order_id,
      name: body.name || 'Add-On',
      price: parseFloat(body.price) || 0,
      quantity: parseInt(body.quantity) || 1,
    };
    db.add_ons.push(newA);
    DB.save(db);
    return jsonResponse(newA);
  }

  if (method === 'POST' && path === '/api/consult_calls') {
    const newC = {
      id: (db.consult_calls.length ? Math.max(...db.consult_calls.map(c => c.id)) : 0) + 1,
      order_id: body.order_id,
      scheduled_at: body.scheduled_at,
      duration_minutes: body.duration_minutes || 30,
      notes: body.notes || '',
      completed_by: currentUser.id,
    };
    db.consult_calls.push(newC);
    DB.save(db);
    return jsonResponse(newC);
  }

  // ========== QUEUE ==========

  if (method === 'GET' && path === '/api/queue') {
    const active = ['production_queue', 'prep', 'painting'];
    const waiting = ['paid_waitlist'];

    function bookingPaidDate(o) {
      const p = db.payments.find(x => x.order_id === o.id && x.type === 'booking' && x.status === 'paid');
      return p ? new Date(p.recorded_at) : new Date(o.created_at);
    }
    function tier(o) {
      if (o.is_rush && o.rush_approved) return 1;
      if (o.must_have_by) return 2;
      return 3;
    }
    function sortFn(a, b) {
      const ta = tier(a), tb = tier(b);
      if (ta !== tb) return ta - tb;
      if (ta <= 2 && a.must_have_by && b.must_have_by) return new Date(a.must_have_by) - new Date(b.must_have_by);
      return bookingPaidDate(a) - bookingPaidDate(b);
    }
    function decorate(o) {
      const u = db.users.find(x => x.id === o.user_id);
      return { ...o, customer_name: u ? u.name : '—' };
    }

    return jsonResponse({
      active: db.orders.filter(o => active.includes(o.status)).map(decorate).sort(sortFn),
      waiting: db.orders.filter(o => waiting.includes(o.status)).map(decorate).sort(sortFn),
    });
  }

  // ========== DASHBOARD ==========

  if (method === 'GET' && path === '/api/dashboard') {
    const orders = db.orders;
    const total_orders = orders.length;
    const rush_pending = orders.filter(o => o.is_rush && !o.rush_approved).length;
    const in_production = orders.filter(o => ['production_queue','prep','painting'].includes(o.status)).length;
    const completed = orders.filter(o => ['completed','shipped','closed'].includes(o.status)).length;

    const status_counts = {};
    orders.forEach(o => { status_counts[o.status] = (status_counts[o.status] || 0) + 1; });

    const type_counts = {};
    orders.forEach(o => { type_counts[o.item_type] = (type_counts[o.item_type] || 0) + 1; });

    const recent_orders = [...orders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
      .map(o => {
        const u = db.users.find(x => x.id === o.user_id);
        return { ...o, customer_name: u ? u.name : '—' };
      });

    return jsonResponse({
      stats: { total_orders, rush_pending, in_production, completed },
      status_counts,
      type_counts,
      recent_orders,
    });
  }

  // ========== REPORTS ==========

  if (method === 'GET' && path === '/api/reports') {
    const paid = db.payments.filter(p => p.status === 'paid');
    const total_revenue = paid.reduce((s, p) => s + parseFloat(p.amount), 0);
    const revenue_by_type = {};
    paid.forEach(p => { revenue_by_type[p.type] = (revenue_by_type[p.type] || 0) + parseFloat(p.amount); });

    const tier_counts = {};
    db.orders.forEach(o => {
      if (!o.pricing_tier) return;
      const key = o.pricing_tier.charAt(0).toUpperCase() + o.pricing_tier.slice(1).toLowerCase();
      tier_counts[key] = (tier_counts[key] || 0) + 1;
    });

    const totalByUser = {};
    paid.forEach(p => {
      const order = db.orders.find(o => o.id === p.order_id);
      if (!order) return;
      totalByUser[order.user_id] = (totalByUser[order.user_id] || 0) + parseFloat(p.amount);
    });
    const top_customers = Object.entries(totalByUser)
      .map(([uid, total]) => {
        const user = db.users.find(u => u.id === parseInt(uid));
        if (!user) return null;
        return {
          user,
          total_paid: total,
          order_count: db.orders.filter(o => o.user_id === user.id).length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.total_paid - a.total_paid)
      .slice(0, 10);

    return jsonResponse({ total_revenue, revenue_by_type, tier_counts, top_customers });
  }

  // ========== SETTINGS ==========

  if (method === 'GET' && path === '/api/settings/booking') {
    if (!db.settings) db.settings = {};
    return jsonResponse({
      status: db.settings.booking_status || db.booking.status,
      booked_until: db.settings.booked_until || db.booking.booked_until,
      message: db.settings.booking_message || db.booking.message,
      prod_start: db.settings.prod_start || db.booking.production_start,
    });
  }

  if (method === 'PATCH' && path === '/api/settings/booking') {
    if (!db.settings) db.settings = {};
    Object.assign(db.settings, {
      booking_status: body.status,
      booked_until: body.booked_until,
      booking_message: body.message,
      prod_start: body.prod_start,
    });
    DB.save(db);
    return jsonResponse({ ok: true });
  }

  // ========== FAQs ==========

  if (method === 'GET' && path === '/api/faqs') {
    return jsonResponse(db.faqs.map((f, i) => ({
      id: i + 1,
      question: f.question || f.q,
      answer: f.answer || f.a,
      sort_order: i,
    })));
  }

  if (method === 'POST' && path === '/api/faqs') {
    db.faqs.push({ question: body.question, answer: body.answer });
    DB.save(db);
    return jsonResponse({ ok: true });
  }

  {
    const m = matchPath('/api/faqs/:id', path);
    if (m) {
      const idx = parseInt(m.id) - 1;
      if (method === 'PATCH' && db.faqs[idx]) {
        db.faqs[idx] = { question: body.question || db.faqs[idx].question || db.faqs[idx].q,
                          answer: body.answer || db.faqs[idx].answer || db.faqs[idx].a };
        DB.save(db);
        return jsonResponse({ ok: true });
      }
      if (method === 'DELETE' && db.faqs[idx]) {
        db.faqs.splice(idx, 1);
        DB.save(db);
        return jsonResponse({ ok: true });
      }
    }
  }

  // ========== ITEMS / PRICING TIERS ==========

  if (method === 'GET' && (path === '/api/items' || path === '/api/items/all')) {
    // Map each item type to an icon for the order form grid
    const ITEM_ICONS = {
      'Sneakers': '👟', 'Boots': '🥾', 'Cleats': '⚽', 'Skates': '⛸️',
      'Jacket': '🧥', 'Graduation Cap': '🎓', 'Helmet': '🪖',
      'Denim Vest': '👕', 'Bag': '👜', 'Other': '✨',
    };
    // Build tiers from PRICING_TIERS in core.js — skip rush, it's an add-on
    const baseTiers = (typeof PRICING_TIERS !== 'undefined' ? PRICING_TIERS : [])
      .filter(t => t.id !== 'rush')
      .map((t, j) => ({
        id: j + 1,
        name: t.label,
        price_label: t.price,
        description: t.desc,
      }));
    const items = ITEM_TYPES.map((name, i) => ({
      id: i + 1,
      label: name,
      icon: ITEM_ICONS[name] || '✨',
      is_active: true,
      sort_order: i,
      tiers: baseTiers,
    }));
    return jsonResponse(items);
  }

  if (method === 'GET' && path === '/api/pricing_tiers/all') {
    return jsonResponse((db.pricing || []).map((p, i) => ({
      id: i + 1,
      name: p.tier,
      price_from: p.price_from,
      description: p.desc,
    })));
  }

  // ========== HOW IT WORKS ==========

  if (method === 'GET' && path === '/api/how-it-works') {
    return jsonResponse([
      { id:1, step_number:1, title:'Read the Terms', description:'Review pricing, policies, and the full process before you start.' },
      { id:2, step_number:2, title:'Create an Account', description:'Quick sign-up with email, phone, and notification preferences.' },
      { id:3, step_number:3, title:'Submit a Request',  description:"Tell Buffy what you want customized and share your vision." },
      { id:4, step_number:4, title:'Free Waitlist',     description:'Your request is reviewed. Buffy will reach out with a quote.' },
      { id:5, step_number:5, title:'Pay Booking Fee',   description:'$50 non-refundable fee secures your spot on the Paid Waitlist.' },
      { id:6, step_number:6, title:'Production',        description:'Ship your item to Buffy. She preps and paints your piece.' },
      { id:7, step_number:7, title:'Delivery',          description:'Approve the final result and receive your one-of-one piece.' },
    ]);
  }

  // ========== MISC ADMIN ==========

  if (method === 'POST' && path === '/api/admin/preview-token') {
    return jsonResponse({ token: 'demo-preview-token', demo_mode: true });
  }

  if (method === 'POST' && path === '/api/admin/create-user') {
    return jsonResponse({ ok: true, demo_mode: true });
  }

  if (method === 'POST' && path === '/api/account/delete-request') {
    return jsonResponse({ ok: true, demo_mode: true });
  }

  // Fallthrough
  return errorResponse(`[Demo] No mock handler for ${method} ${path}`, 404);
}


// ------------------------------------------------------------
// FETCH OVERRIDE
// ------------------------------------------------------------
// Only /api/* paths are intercepted. Everything else (image requests,
// the Chart.js CDN, etc.) passes through to the real network.
const _origFetch = window.fetch;
window.fetch = async function(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  // Only intercept relative /api/ paths
  if (!url.startsWith('/api/') && !url.match(/^https?:\/\/[^/]+\/api\//)) {
    return _origFetch.call(this, input, init);
  }
  // Build a Request object we can introspect uniformly
  const req = new Request(url.startsWith('/') ? (location.origin + url) : url, {
    method: init.method || 'GET',
    headers: init.headers || {},
    body: init.body,
  });
  try {
    return await handleRequest(req);
  } catch(e) {
    console.error('[mock-backend] handler error:', e);
    return errorResponse('Internal mock error: ' + e.message, 500);
  }
};

console.log('%c[Cope Demo] Mock backend active. Data persists in localStorage.',
            'color:#F217A5;font-weight:bold;');
