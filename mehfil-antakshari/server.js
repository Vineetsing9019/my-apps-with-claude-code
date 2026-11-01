// Antakshari: lobby, invites, turn-based rooms (Socket.IO) + WebRTC signalling for voices.
const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');
const { Server } = require('socket.io');
const { makeBots, SONGS } = require('./bots');

const PORT = 5090;        // http://localhost:5090  (this computer)
const SECURE_PORT = 5443; // https://<lan-ip>:5443  (phones / other laptops on the same Wi-Fi)
const TURN_MS = 60000;
const LIVES = 3;
const MAX_PLAYERS = 6;
const INVITE_MS = 20000;
const START_LETTERS = 'ABCDEGHJKMNPRST'.split('');
const REACTIONS = ['👏', '🔥', '🎶', '😂', '❤️', '🙌'];

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const httpServer = http.createServer(app);
const pems = selfsigned.generate([{ name: 'commonName', value: 'antakshari.local' }], { days: 365, keySize: 2048 });
const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);

const io = new Server({ maxHttpBufferSize: 8e6 }); // room for a profile photo + a few posts
io.attach(httpServer);
io.attach(httpsServer);

const users = new Map();   // socketId -> { id, name, avatar, roomId }
const rooms = new Map();   // roomId -> room
const invites = new Map(); // `${from}>${to}` -> timeout

makeBots().forEach(b => users.set(b.id, b));

/* ---------- profiles: uploaded photos live in memory and are served by URL ---------- */
const MAX_POSTS = 9;
const MAX_IMAGE_BYTES = 900 * 1024;
const DEFAULT_SEEDS = ['Mehfil', 'Sargam', 'Taal', 'Raag', 'Dhun', 'Geet', 'Sur', 'Lehar', 'Jhankaar', 'Tarana', 'Ghazal', 'Qawwali'];
const defaultPhoto = seed => `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4`;

function parseImage(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  return buf.length && buf.length <= MAX_IMAGE_BYTES ? { type: m[1], buf } : null;
}

function uniqueHandle(want, id) {
  let base = clean(want, 24).toLowerCase().replace(/[^a-z0-9._]+/g, '').replace(/^[._]+|[._]+$/g, '') || 'singer';
  let h = base, n = 1;
  while ([...users.values()].some(u => u.id !== id && u.handle === h)) h = `${base}${++n}`;
  return h;
}

// Applies a profile sent by the browser. Photo: an uploaded image, else the chosen default avatar.
function applyProfile(u, p) {
  u.name = clean(p.name, 20);
  u.handle = uniqueHandle(p.handle || u.name, u.id);
  u.city = clean(p.city, 30);
  u.bio = clean(p.bio, 120);
  u.ver = (u.ver || 0) + 1;
  const img = p.photo && parseImage(p.photo);
  u.photoImg = img || null;
  u.photo = img ? `/photo/${u.id}?v=${u.ver}` : defaultPhoto(DEFAULT_SEEDS.includes(p.defaultSeed) ? p.defaultSeed : DEFAULT_SEEDS[0]);
  u.postImgs = (Array.isArray(p.posts) ? p.posts : []).slice(0, MAX_POSTS).map(parseImage).filter(Boolean);
  u.sung = u.sung || 0;
  u.wins = u.wins || 0;
}

app.get('/photo/:id', (req, res) => {
  const img = users.get(req.params.id)?.photoImg;
  if (!img) return res.sendStatus(404);
  res.type(img.type).set('Cache-Control', 'max-age=86400').send(img.buf);
});
app.get('/post/:id/:i', (req, res) => {
  const img = users.get(req.params.id)?.postImgs?.[Number(req.params.i)];
  if (!img) return res.sendStatus(404);
  res.type(img.type).set('Cache-Control', 'max-age=86400').send(img.buf);
});

let roomSeq = 1;
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const firstLetter = s => (String(s).match(/[a-z]/i) || [''])[0].toUpperCase();
const lastLetter = s => (String(s).match(/[a-z](?=[^a-z]*$)/i) || [''])[0].toUpperCase();

function publicUsers() {
  return [...users.values()].map(u => {
    const r = u.roomId && rooms.get(u.roomId);
    return {
      id: u.id, name: u.name, avatar: u.avatar, photo: u.photo, bot: !!u.bot,
      handle: u.handle || u.name.toLowerCase().replace(/[^a-z0-9]+/g, '.'),
      city: u.city, bio: u.bio || 'Singing on Antakshari 🎶', verified: !!u.verified,
      followers: u.followers || '0', sung: u.sung || 0, wins: u.wins || 0,
      posts: (u.postImgs || []).map((_, i) => `/post/${u.id}/${i}?v=${u.ver}`),
      status: !r ? 'free' : r.state === 'playing' ? 'playing' : 'room',
    };
  });
}
const pushUsers = () => io.emit('users', publicUsers());

function roomView(r) {
  return {
    id: r.id, hostId: r.hostId, state: r.state, letter: r.letter,
    turnId: r.state === 'playing' ? r.players[r.turnIdx] : null,
    turnEndsAt: r.turnEndsAt, now: Date.now(), turnMs: TURN_MS,
    winnerId: r.winnerId || null, botSong: r.botSong || null,
    players: r.players.map(id => {
      const u = users.get(id) || {};
      return { id, name: u.name, avatar: u.avatar, photo: u.photo, bot: !!u.bot, lives: r.lives[id] ?? LIVES, score: r.scores[id] || 0 };
    }),
    trail: r.trail.slice(-40),
  };
}
const pushRoom = r => io.to(r.id).emit('room', roomView(r));
const alive = r => r.players.filter(id => r.lives[id] > 0);
const nameOf = id => users.get(id)?.name || 'Someone';

function startTurn(r) {
  clearTimeout(r.timer);
  clearTimeout(r.botTimer);
  r.botSong = null;
  r.turnEndsAt = Date.now() + TURN_MS;
  const turnId = r.players[r.turnIdx];
  r.timer = setTimeout(() => loseLife(r, turnId, 'ran out of time'), TURN_MS);
  if (users.get(turnId)?.bot) botTurn(r, turnId);
  pushRoom(r);
}

// A bot "sings" for a few seconds, then submits a real song for the letter, or gets stuck now and then.
function botTurn(r, id) {
  const used = new Set(r.trail.filter(t => t.song).map(t => t.song.toLowerCase()));
  const options = (SONGS[r.letter] || []).filter(s => !used.has(s.toLowerCase()));
  const song = options.length && Math.random() < 0.9 ? options[Math.floor(Math.random() * options.length)] : null;
  r.botSong = song;
  const ms = song ? 5000 + Math.random() * 6000 : 6000 + Math.random() * 4000;
  r.botTimer = setTimeout(() => {
    if (r.state !== 'playing' || r.players[r.turnIdx] !== id) return;
    if (song) submitSong(r, id, song, song.split(' ').pop());
    else loseLife(r, id, "couldn't think of a song");
  }, ms);
}

function botReactions(r, singerId) {
  r.players.filter(id => id !== singerId && users.get(id)?.bot).forEach(id => {
    if (Math.random() < 0.6) setTimeout(() => {
      if (rooms.has(r.id)) io.to(r.id).emit('react', { from: id, emoji: REACTIONS[Math.floor(Math.random() * 4)] });
    }, 600 + Math.random() * 1800);
  });
}

// Returns an error message, or null when the song was accepted.
function submitSong(r, id, song, lastWord) {
  song = clean(song, 80);
  lastWord = clean(lastWord, 30);
  if (song.length < 2) return 'Type the song you sang';
  if (firstLetter(song) !== r.letter) return `The song has to start with "${r.letter}"`;
  if (r.trail.some(t => t.song && t.song.toLowerCase() === song.toLowerCase())) return 'That song has already been sung, pick another';
  const next = lastLetter(lastWord);
  if (!next) return 'Type the last word you sang';
  const fast = r.turnEndsAt - Date.now() > TURN_MS * 2 / 3;
  const points = 10 + (fast ? 5 : 0);
  r.scores[id] = (r.scores[id] || 0) + points;
  const singer = users.get(id);
  if (singer && !singer.bot) singer.sung++;
  r.trail.push({ by: id, song, lastWord, from: r.letter, next, points });
  r.letter = next;
  botReactions(r, id);
  nextTurn(r);
  return null;
}

function checkOver(r) {
  const left = alive(r);
  const humansLeft = left.some(id => !users.get(id)?.bot);
  if (left.length > 1 && humansLeft) return false; // bots alone don't play on
  clearTimeout(r.timer);
  clearTimeout(r.botTimer);
  r.botSong = null;
  r.state = 'over';
  r.turnEndsAt = null;
  const byScore = ids => [...ids].sort((a, b) => (r.scores[b] || 0) - (r.scores[a] || 0));
  r.winnerId = byScore(left.length ? left : r.players)[0] || null;
  const winner = users.get(r.winnerId);
  if (winner && !winner.bot) winner.wins++;
  pushRoom(r);
  pushUsers();
  return true;
}

function nextTurn(r) {
  if (checkOver(r)) return;
  let i = r.turnIdx;
  do { i = (i + 1) % r.players.length; } while (r.lives[r.players[i]] <= 0);
  r.turnIdx = i;
  startTurn(r);
}

function loseLife(r, id, why) {
  if (r.state !== 'playing' || r.players[r.turnIdx] !== id) return;
  r.lives[id] = Math.max(0, (r.lives[id] ?? LIVES) - 1);
  r.trail.push({ system: true, by: id, text: `${nameOf(id)} ${why} and lost a ❤${r.lives[id] === 0 ? ' — out of the game' : ''}` });
  nextTurn(r); // the letter passes on to the next singer
}

function joinRoom(r, id) {
  const u = users.get(id);
  if (!u || r.players.includes(id)) return;
  r.players.push(id);
  r.lives[id] = LIVES;
  r.scores[id] = 0;
  u.roomId = r.id;
  io.sockets.sockets.get(id)?.join(r.id);
}

function leaveRoom(id) {
  const u = users.get(id);
  const r = u?.roomId && rooms.get(u.roomId);
  if (!r) return;
  u.roomId = null;
  io.sockets.sockets.get(id)?.leave(r.id);
  io.to(r.id).emit('peer:left', id);
  const idx = r.players.indexOf(id);
  r.players.splice(idx, 1);
  const humans = r.players.filter(p => !users.get(p)?.bot);
  if (!humans.length) {
    // no people left: bots go back to the lobby
    clearTimeout(r.timer); clearTimeout(r.botTimer);
    r.players.forEach(p => { const b = users.get(p); if (b) b.roomId = null; });
    rooms.delete(r.id); pushUsers(); return;
  }
  if (r.hostId === id) r.hostId = humans[0];
  r.trail.push({ system: true, by: id, text: `${u.name} left the room` });
  if (r.state === 'playing') {
    const wasTurn = idx === r.turnIdx;
    if (idx < r.turnIdx) r.turnIdx--;
    if (!checkOver(r)) {
      if (wasTurn) { r.turnIdx = idx - 1; nextTurn(r); } else pushRoom(r);
    }
  } else pushRoom(r);
  pushUsers();
}

function dropInvites(id) {
  for (const [key, t] of invites) {
    const [from, to] = key.split('>');
    if (from === id || to === id) {
      clearTimeout(t);
      invites.delete(key);
      io.to(from === id ? to : from).emit('invite:gone', { fromId: from, toId: to });
    }
  }
}

io.on('connection', socket => {
  const me = () => users.get(socket.id);
  const myRoom = () => { const u = me(); return u?.roomId && rooms.get(u.roomId); };
  const toast = msg => socket.emit('toast', msg);

  socket.on('join', (p = {}) => {
    if (!clean(p.name, 20)) return toast('Please enter your name');
    const u = me() || { id: socket.id, avatar: '🎤', roomId: null };
    applyProfile(u, p);
    users.set(socket.id, u);
    socket.emit('me', { id: socket.id, handle: u.handle });
    pushUsers();
  });

  socket.on('profile:update', (p = {}) => {
    const u = me();
    if (!u) return;
    if (!clean(p.name, 20)) return toast('Your name can’t be empty');
    applyProfile(u, p);
    socket.emit('profile:saved', { handle: u.handle });
    pushUsers();
    const r = myRoom();
    if (r) pushRoom(r);
  });

  socket.on('invite', ({ to }) => {
    const u = me(), target = users.get(to);
    if (!u || !target || to === socket.id) return;
    const r = myRoom();
    if (r && r.state === 'playing') return toast('Finish this game before inviting');
    if (r && r.players.length >= MAX_PLAYERS) return toast(`A room holds ${MAX_PLAYERS} singers`);
    if (target.roomId) return toast(`${target.name} is already in a room`);
    const key = `${socket.id}>${to}`;
    if (invites.has(key)) return toast(`Already waiting for ${target.name}`);
    invites.set(key, setTimeout(() => {
      invites.delete(key);
      socket.emit('invite:gone', { fromId: socket.id, toId: to });
      io.to(to).emit('invite:gone', { fromId: socket.id, toId: to });
      toast(`${target.name} didn't answer`);
    }, INVITE_MS));
    io.to(to).emit('invite', { fromId: socket.id, name: u.name, avatar: u.avatar, photo: u.photo, players: r ? r.players.length : 1, ms: INVITE_MS });
    socket.emit('invite:sent', { toId: to });
    toast(`Request sent to ${target.name}`);
    if (target.bot) setTimeout(() => respond(to, socket.id, true), 1000 + Math.random() * 1500);
  });

  socket.on('invite:respond', ({ fromId, accept }) => respond(socket.id, fromId, accept));

  socket.on('room:start', () => {
    const r = myRoom();
    if (!r || r.hostId !== socket.id || r.state === 'playing') return;
    if (r.players.length < 2) return toast('You need at least 2 singers');
    r.state = 'playing';
    r.winnerId = null;
    r.trail = [];
    r.players.forEach(id => { r.lives[id] = LIVES; r.scores[id] = 0; });
    r.letter = START_LETTERS[Math.floor(Math.random() * START_LETTERS.length)];
    r.turnIdx = 0;
    r.trail.push({ system: true, text: `Game on! First letter is ${r.letter}` });
    startTurn(r);
    pushUsers();
  });

  socket.on('turn:done', ({ song, lastWord }) => {
    const r = myRoom();
    if (!r || r.state !== 'playing' || r.players[r.turnIdx] !== socket.id) return;
    const err = submitSong(r, socket.id, song, lastWord);
    if (err) toast(err);
  });

  socket.on('turn:pass', () => {
    const r = myRoom();
    if (r) loseLife(r, socket.id, 'passed');
  });

  socket.on('room:leave', () => { leaveRoom(socket.id); socket.emit('room', null); });

  socket.on('react', ({ emoji }) => {
    const r = myRoom();
    if (r && REACTIONS.includes(emoji)) io.to(r.id).emit('react', { from: socket.id, emoji });
  });

  // WebRTC signalling, only between players of the same room
  socket.on('rtc', ({ to, data }) => {
    const u = me(), t = users.get(to);
    if (u && t && u.roomId && u.roomId === t.roomId) io.to(to).emit('rtc', { from: socket.id, data });
  });

  socket.on('disconnect', () => {
    dropInvites(socket.id);
    leaveRoom(socket.id);
    users.delete(socket.id);
    pushUsers();
  });
});

// `toId` answers the invite from `fromId` (a person tapping Accept, or a bot accepting on its own).
function respond(toId, fromId, accept) {
  const key = `${fromId}>${toId}`;
  const tell = msg => io.to(toId).emit('toast', msg);
  if (!invites.has(key)) return tell('That invite has expired');
  clearTimeout(invites.get(key));
  invites.delete(key);
  const u = users.get(toId), from = users.get(fromId);
  io.to(fromId).emit('invite:gone', { fromId, toId });
  if (!u || !from) return tell('That player has gone offline');
  if (!accept) return io.to(fromId).emit('toast', `${u.name} said not now`);
  if (u.roomId) leaveRoom(toId);
  let r = from.roomId && rooms.get(from.roomId);
  if (r && (r.state === 'playing' || r.players.length >= MAX_PLAYERS)) return tell('That room is no longer open');
  if (!r) {
    r = { id: `room-${roomSeq++}`, hostId: fromId, state: 'waiting', players: [], lives: {}, scores: {}, trail: [], turnIdx: 0, letter: null, turnEndsAt: null, timer: null, botTimer: null, botSong: null };
    rooms.set(r.id, r);
    joinRoom(r, fromId);
  }
  joinRoom(r, toId);
  r.trail.push({ system: true, by: toId, text: `${u.name} joined the mehfil` });
  if (u.bot) io.to(fromId).emit('toast', `${u.name} accepted your request 🎉`);
  dropInvites(toId);
  pushRoom(r);
  pushUsers();
}

const lanIps = Object.values(os.networkInterfaces()).flat()
  .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);

httpServer.listen(PORT, () => {
  httpsServer.listen(SECURE_PORT, () => {
    console.log(`\n🎤 Antakshari is live`);
    console.log(`   This computer:   http://localhost:${PORT}`);
    lanIps.forEach(ip => console.log(`   Same Wi-Fi:      https://${ip}:${SECURE_PORT}  (accept the certificate warning)`));
    console.log('');
  });
});
