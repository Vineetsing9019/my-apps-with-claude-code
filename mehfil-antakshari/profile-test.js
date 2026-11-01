// Checks profiles: upload photo + posts, default avatar, unique usernames, editing.
const { io } = require('socket.io-client');
const URL = 'http://localhost:5090';
const once = (s, ev) => new Promise(r => s.once(ev, r));
const wait = ms => new Promise(r => setTimeout(r, ms));
// 1x1 jpeg
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

(async () => {
  const a = io(URL), b = io(URL);
  let users = [];
  a.on('users', u => users = u);
  a.emit('join', { name: 'Vineet', handle: 'vineet.sings', city: 'Pune', bio: 'Kishore fan', photo: JPG, posts: [JPG, JPG] });
  const meA = await once(a, 'me');
  b.emit('join', { name: 'Vineet', handle: 'vineet.sings', defaultSeed: 'Raag' });
  const meB = await once(b, 'me');
  await wait(200);
  const ua = users.find(u => u.id === meA.id), ub = users.find(u => u.id === meB.id);
  console.log('A handle', ua.handle, '| photo', ua.photo, '| posts', ua.posts.length, '| city', ua.city);
  console.log('B handle', ub.handle, '(should be vineet.sings2) | default photo', ub.photo.includes('seed=Raag'));
  const ph = await fetch(URL + ua.photo), po = await fetch(URL + ua.posts[1]);
  console.log('photo served', ph.status, ph.headers.get('content-type'), '| post served', po.status);
  a.emit('profile:update', { name: 'Vineet G', handle: 'vineet.sings', bio: 'Rafi too', posts: [] , defaultSeed: 'Taal' });
  const saved = await once(a, 'profile:saved'); await wait(200);
  const ua2 = users.find(u => u.id === meA.id);
  console.log('after edit:', ua2.name, ua2.handle === saved.handle, ua2.bio, '| posts', ua2.posts.length, '| default photo now', ua2.photo.includes('seed=Taal'));
  a.emit('join', { name: 'Bad', photo: 'data:text/html;base64,PHNjcmlwdD4=' }); await once(a, 'me'); await wait(150);
  console.log('non-image upload ignored:', !users.find(u => u.id === meA.id).photo.startsWith('/photo'));
  a.close(); b.close(); process.exit(0);
})();
