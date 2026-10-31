// All In — salon chair availability demo. No dependencies: `node server.js`
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 5050;
const DATA = path.join(__dirname, 'data.json');
const PUB = path.join(__dirname, 'public');
const GRACE = Number(process.env.GRACE_MS) || 5 * 60e3; // customer must arrive within 5 min of the chair freeing up

function defaults() {
  const now = Date.now();
  return {
    pin: '1234',
    owner: {
      salon: 'Raju Hair Studio',
      name: 'Raju Sharma',
      experience: 12,
      phone: '+91 98765 43210',
      address: 'Shop 4, MG Road, Nashik',
      about: 'Classic cuts, fades and beard styling. Clean tools for every customer.',
      photo: '',
      services: [
        { name: 'Haircut', price: 150, min: 20 },
        { name: 'Beard trim', price: 80, min: 15 },
        { name: 'Haircut + Beard', price: 200, min: 35 },
        { name: 'Hair colour', price: 400, min: 45 },
        { name: 'Face massage', price: 250, min: 30 },
      ],
    },
    chairs: [
      { id: 1, busy: true, startedAt: now - 10 * 60e3, endsAt: now + 9 * 60e3 + 40e3, service: 'Haircut', freeSince: 0 },
      { id: 2, busy: true, startedAt: now - 48 * 60e3, endsAt: now + 42 * 60e3, service: 'Haircut + Beard + Colour', freeSince: 0 },
      { id: 3, busy: false, endsAt: 0, service: '', freeSince: now },
    ],
    bookings: [],
    seq: 1,
  };
}

let state;
try { state = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch { state = defaults(); }
const save = () => fs.writeFile(DATA, JSON.stringify(state), () => {});

const active = (b) => b.status === 'waiting' || b.status === 'confirmed';

// Free chairs whose timer ran out, and cancel bookings whose holder didn't turn up in time.
function sweep() {
  const now = Date.now();
  let changed = false;
  for (const c of state.chairs) {
    if (c.busy && c.endsAt <= now) { c.busy = false; c.freeSince = c.endsAt; changed = true; }
    if (c.busy) continue;
    for (;;) {
      const head = state.bookings.filter((b) => b.chairId === c.id && active(b)).sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!head) break;
      const holdUntil = Math.max(c.freeSince, head.createdAt) + GRACE;
      if (now <= holdUntil) break;
      head.status = 'cancelled'; head.reason = 'Did not arrive in time';
      c.freeSince = holdUntil; // next in line gets a fresh 5 minutes
      changed = true;
    }
  }
  if (changed) save();
}

function view(isOwner) {
  sweep();
  const chairs = state.chairs.map((c) => {
    const queue = state.bookings
      .filter((b) => b.chairId === c.id && active(b))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((b, i) => ({
        id: b.id, status: b.status, createdAt: b.createdAt, pos: i + 1,
        name: isOwner ? b.name : b.name.split(' ')[0],
        ...(isOwner ? { phone: b.phone } : {}),
        holdUntil: i === 0 && !c.busy ? Math.max(c.freeSince, b.createdAt) + GRACE : null,
      }));
    return { ...c, queue };
  });
  const bookings = isOwner
    ? state.bookings.slice(-40).reverse()
    : state.bookings.map(({ id, chairId, status, reason }) => ({ id, chairId, status, reason }));
  return { now: Date.now(), grace: GRACE, owner: state.owner, chairs, bookings };
}

function act(a, isOwner) {
  const chair = (id) => state.chairs.find((c) => c.id === Number(id));
  const booking = (id) => state.bookings.find((b) => b.id === Number(id));
  const now = Date.now();
  switch (a.type) {
    case 'book': {
      const c = chair(a.chairId);
      const name = String(a.name || '').trim().slice(0, 40);
      const phone = String(a.phone || '').trim().slice(0, 20);
      if (!c || !name) throw new Error('Name and chair are required');
      if (state.bookings.filter((b) => b.chairId === c.id && active(b)).length >= 3) throw new Error('This chair already has 3 people waiting');
      const b = { id: state.seq++, chairId: c.id, name, phone, status: 'waiting', createdAt: now };
      state.bookings.push(b);
      return { id: b.id };
    }
    case 'cancel': { const b = booking(a.id); if (b && active(b)) { b.status = 'cancelled'; b.reason = 'Cancelled by customer'; } return {}; }
  }
  if (!isOwner) throw new Error('Owner PIN needed');
  switch (a.type) {
    case 'start': {
      const c = chair(a.chairId); const m = Number(a.minutes);
      if (!c || !(m > 0)) throw new Error('Pick a time');
      Object.assign(c, { busy: true, startedAt: now, endsAt: now + m * 60e3, service: String(a.service || '').slice(0, 60) });
      return {};
    }
    case 'extend': { const c = chair(a.chairId); if (c && c.busy) c.endsAt += Number(a.minutes) * 60e3; return {}; }
    case 'free': { const c = chair(a.chairId); if (c) Object.assign(c, { busy: false, endsAt: 0, service: '', freeSince: now }); return {}; }
    case 'chairs': {
      const n = Math.max(1, Math.min(8, Number(a.count) || 1));
      while (state.chairs.length < n) state.chairs.push({ id: state.chairs.length + 1, busy: false, endsAt: 0, service: '', freeSince: now });
      state.chairs.length = n;
      return {};
    }
    case 'confirm': { const b = booking(a.id); if (b && active(b)) b.status = 'confirmed'; return {}; }
    case 'reject': { const b = booking(a.id); if (b && active(b)) { b.status = 'cancelled'; b.reason = 'Declined by salon'; } return {}; }
    case 'arrived': { const b = booking(a.id); if (b) { b.status = 'arrived'; const c = chair(b.chairId); if (c && !c.busy) c.freeSince = now; } return {}; }
    case 'profile': { state.owner = { ...state.owner, ...a.owner }; return {}; }
    case 'pin': { if (!/^\d{4}$/.test(a.pin)) throw new Error('PIN must be 4 digits'); state.pin = a.pin; return {}; }
    case 'reset': { state = defaults(); return {}; }
  }
  throw new Error('Unknown action');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const ROUTES = { '/': 'index.html', '/owner': 'owner.html', '/whatsapp': 'whatsapp.html' };

function send(res, code, body) { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); }

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const isOwner = req.headers['x-pin'] === state.pin;
  if (url.pathname === '/api/state') return send(res, 200, view(isOwner));
  if (url.pathname === '/api/login') return send(res, isOwner ? 200 : 401, { ok: isOwner });
  if (url.pathname === '/api/action' && req.method === 'POST') {
    let body = '';
    req.on('data', (d) => { body += d; if (body.length > 3e6) req.destroy(); });
    req.on('end', () => {
      try { const out = act(JSON.parse(body || '{}'), isOwner); save(); send(res, 200, { ok: true, ...out, state: view(isOwner) }); }
      catch (e) { send(res, 400, { ok: false, error: e.message }); }
    });
    return;
  }
  const file = path.join(PUB, ROUTES[url.pathname] || path.normalize(url.pathname).replace(/^[\\/]+/, ''));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  console.log(`All In running:\n  Customer  http://localhost:${PORT}/\n  Owner     http://localhost:${PORT}/owner  (PIN 1234)\n  WhatsApp  http://localhost:${PORT}/whatsapp`);
  if (lan) console.log(`  On your phone (same Wi-Fi): http://${lan.address}:${PORT}/`);
});
