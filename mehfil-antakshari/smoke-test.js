// Quick check: request a bot, it accepts, play a whole game against it until someone wins.
const { io } = require('socket.io-client');
const URL = 'http://localhost:5090';
const wait = ms => new Promise(r => setTimeout(r, ms));
const once = (s, ev) => new Promise(r => s.once(ev, r));

(async () => {
  const a = io(URL);
  let room = null, users = [];
  a.on('room', r => room = r);
  a.on('users', u => users = u);
  a.on('toast', m => console.log('  toast:', m));
  a.emit('join', { name: 'Vineet', avatar: '🦚' });
  const { id: me } = await once(a, 'me');
  await wait(200);
  const bots = users.filter(u => u.bot);
  console.log(`${bots.length} bots online, e.g. @${bots[0].handle} (${bots[0].city}) followers ${bots[0].followers}`);
  a.emit('invite', { to: bots[0].id });
  a.emit('invite', { to: bots[1].id });
  await wait(3000);
  console.log('room:', room.players.map(p => p.name).join(', '));
  a.emit('room:start');
  const start = Date.now();
  let lastTrail = 0;
  while (room.state !== 'over' && Date.now() - start < 120000) {
    if (room.state === 'playing' && room.turnId === me) a.emit('turn:pass');
    await wait(300);
    if (room.trail.length !== lastTrail) {
      room.trail.slice(lastTrail).forEach(t => console.log('  ', t.system ? t.text : `${room.players.find(p => p.id === t.by)?.name}: "${t.song}" ${t.from}→${t.next} +${t.points}`));
      lastTrail = room.trail.length;
    }
  }
  console.log('state', room.state, '| winner', room.players.find(p => p.id === room.winnerId)?.name);
  a.emit('room:leave'); await wait(200);
  console.log('bots free again:', users.filter(u => u.bot).every(u => u.status === 'free'));
  a.close(); process.exit(0);
})();
