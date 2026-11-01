// Bot singers so the game can be tried alone. Profiles are made up; songs are real Hindi film song titles.
const PROFILES = [
  { name: 'Riya Sharma', handle: 'riya.sings', city: 'Mumbai', bio: 'Arijit on loop 🎧 Bathroom singer with stage dreams', verified: true },
  { name: 'Aarav Mehta', handle: 'aarav_melody', city: 'Delhi', bio: 'Kishore da forever 🎤 Road-trip DJ' },
  { name: 'Sneha Iyer', handle: 'sneha.sur', city: 'Chennai', bio: 'Carnatic by day, Bollywood by night 🌙' },
  { name: 'Kabir Malhotra', handle: 'kabir.tunes', city: 'Chandigarh', bio: 'Punjabi beats & dhol 🥁 Balle balle!' },
  { name: 'Ananya Rao', handle: 'ananya_raagini', city: 'Bengaluru', bio: 'Lata ji fan girl ✨ Sings to her plants', verified: true },
  { name: 'Rohan Desai', handle: 'rohan.rafi', city: 'Pune', bio: 'Old is gold 📻 Rafi saab devotee' },
  { name: 'Meera Kapoor', handle: 'meeraa.music', city: 'Jaipur', bio: 'Sufi soul 🕊 Chai + ghazals' },
  { name: 'Arjun Nair', handle: 'arjun.antakshari', city: 'Kochi', bio: '3x college antakshari champ 🏆 Try me', verified: true },
  { name: 'Ishita Verma', handle: 'ishita.hums', city: 'Lucknow', bio: 'Hum lo, gungunao 🎶 Tehzeeb wali singer' },
  { name: 'Vikram Joshi', handle: 'vikky.vibes', city: 'Ahmedabad', bio: 'Garba king, mic hogger 😎' },
  { name: 'Pooja Patel', handle: 'pooja.pitchperfect', city: 'Surat', bio: 'Pitch perfect… mostly 😅' },
  { name: 'Dev Malik', handle: 'dev.dhun', city: 'Hyderabad', bio: 'Shreya Ghoshal stan 💜 Biryani & ballads' },
];

const SONGS = {
  A: ['Aaj Phir Jeene Ki Tamanna Hai', 'Agar Tum Saath Ho', 'Apna Bana Le', 'Abhi Na Jao Chhod Kar', 'Aankhon Mein Teri', 'Ae Mere Humsafar'],
  B: ['Badtameez Dil', 'Bole Chudiyan', 'Baahon Ke Darmiyan', 'Bachna Ae Haseeno', 'Banjaara', 'Bekhayali'],
  C: ['Chaiyya Chaiyya', 'Channa Mereya', 'Chura Liya Hai Tumne', 'Chand Sifarish', 'Chak De India', 'Chammak Challo'],
  D: ['Dil To Pagal Hai', 'Desi Girl', 'Dilbar', 'Dekha Ek Khwab', 'Dum Maro Dum', 'Dhoom Machale'],
  E: ['Ek Ladki Ko Dekha', 'Ek Do Teen', 'Ehsaan Tera Hoga Mujh Par', 'Ek Pyaar Ka Nagma Hai', 'Ek Ajnabee Haseena Se'],
  F: ['Falak Tak', 'Fitoor', 'Phir Le Aaya Dil'],
  G: ['Gerua', 'Galliyan', 'Gulabi Aankhen', 'Ghar More Pardesiya', 'Gali Gali Mein'],
  H: ['Humma Humma', 'Hawayein', 'Hamari Adhuri Kahani', 'Hothon Se Chhu Lo Tum', 'Hum Tum'],
  I: ['Ishq Wala Love', 'Ilahi', 'Ik Vaari Aa', 'Inkaar', 'Ishq Bina'],
  J: ['Jai Ho', 'Jeene Laga Hoon', 'Jab Koi Baat Bigad Jaye', 'Jag Ghoomeya', 'Jiya Jale'],
  K: ['Kal Ho Naa Ho', 'Kabira', 'Kesariya', 'Kun Faya Kun', 'Kajra Re', 'Khairiyat'],
  L: ['Lag Ja Gale', 'Lungi Dance', 'Lambiyaan Si Judaiyaan', 'Laal Ishq', 'Ladki Badi Anjani Hai'],
  M: ['Mere Sapno Ki Rani', 'Mast Magan', 'Main Hoon Na', 'Mitwa', 'Masakali', 'Mere Rashke Qamar'],
  N: ['Nagada Sang Dhol', 'Nazm Nazm', 'Naina', 'Nashe Si Chadh Gayi', 'Na Jaane Kahan Se Aaya Hai'],
  O: ['O Saathi', 'Om Shanti Om', 'O Re Piya', 'Oh Hasina Zulfon Wali', 'Ole Ole'],
  P: ['Pehla Nasha', 'Phir Bhi Dil Hai Hindustani', 'Pal Pal Dil Ke Paas', 'Pee Loon', 'Pardesi Pardesi'],
  R: ['Raabta', 'Roop Tera Mastana', 'Rang De Basanti', 'Raataan Lambiyan', 'Radha'],
  S: ['Sooraj Hua Maddham', 'Senorita', 'Suraj Dooba Hain', 'Saans', 'Shayad', 'Subhanallah'],
  T: ['Tum Hi Ho', 'Tujhe Dekha To', 'Tere Bina', 'Tum Se Hi', 'Tera Ban Jaunga', 'Tip Tip Barsa Paani'],
  U: ['Udi Udi Jaye', 'Ude Dil Befikre', 'Uff Teri Adaa', 'Uska Hi Banana'],
  V: ['Vande Mataram', 'Vaaste', 'Veer Zaara'],
  W: ['Woh Lamhe', 'Wada Raha Sanam', 'Woh Kisna Hai'],
  Y: ['Yeh Dosti', 'Yeh Ladka Hai Allah', 'Yeh Shaam Mastani', 'Yaara Teri Yaari', 'Yun Hi Chala Chal'],
  Z: ['Zara Zara', 'Zinda', 'Zihaal-e-Miskin', 'Zara Sa'],
};

const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const fmt = n => n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

function makeBots() {
  return PROFILES.map(p => ({
    ...p,
    id: `bot-${p.handle}`,
    bot: true,
    avatar: '🎤',
    photo: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(p.handle)}&backgroundColor=ffd5dc,ffdfbf,c0aede,d1d4f9,b6e3f4`,
    followers: fmt(rand(800, 25000)),
    sung: rand(40, 900),
    wins: rand(3, 120),
    roomId: null,
  }));
}

module.exports = { makeBots, SONGS };
