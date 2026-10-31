// Shared helpers for All In pages
const AllIn = (() => {
  let offset = 0; // server clock minus device clock
  const now = () => Date.now() + offset;

  async function api(path, body, pin) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', ...(pin ? { 'x-pin': pin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    const st = data.state || (data.chairs ? data : null);
    if (st) offset = st.now - Date.now();
    if (data.ok === false) throw new Error(data.error || 'Something went wrong');
    return data;
  }

  function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (n) => String(n || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  // Barber chair drawn in SVG; colour shows busy (red) or free (green)
  function chairSVG(id, busy) {
    const g = `c${id}${busy ? 'b' : 'f'}`;
    const [hi, lo] = busy ? ['#FF5A5F', '#B3141B'] : ['#3DDC84', '#0B7A3E'];
    return `<svg viewBox="0 0 140 170" class="chair-svg" aria-hidden="true">
  <defs>
    <linearGradient id="${g}u" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <linearGradient id="${g}m" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A9099"/><stop offset=".45" stop-color="#F4F6F8"/><stop offset="1" stop-color="#6B7178"/></linearGradient>
  </defs>
  <ellipse cx="70" cy="160" rx="46" ry="7" fill="#000" opacity=".12"/>
  <ellipse cx="70" cy="152" rx="40" ry="8" fill="url(#${g}m)"/>
  <rect x="62" y="104" width="16" height="48" rx="4" fill="url(#${g}m)"/>
  <rect x="60" y="120" width="20" height="6" rx="3" fill="#5B6168"/>
  <path d="M84 120 l18 8" stroke="#5B6168" stroke-width="4" stroke-linecap="round"/>
  <rect x="50" y="18" width="40" height="15" rx="7.5" fill="url(#${g}u)"/>
  <rect x="66" y="32" width="8" height="10" fill="url(#${g}m)"/>
  <rect x="38" y="40" width="64" height="56" rx="14" fill="url(#${g}u)"/>
  <rect x="45" y="47" width="50" height="42" rx="9" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" stroke-dasharray="3 3"/>
  <path d="M44 46 q6 -2 12 0 v40 q-6 2 -12 0z" fill="#fff" opacity=".18"/>
  <rect x="22" y="70" width="20" height="9" rx="4.5" fill="#2B2F36"/>
  <rect x="98" y="70" width="20" height="9" rx="4.5" fill="#2B2F36"/>
  <rect x="28" y="78" width="6" height="22" rx="3" fill="url(#${g}m)"/>
  <rect x="106" y="78" width="6" height="22" rx="3" fill="url(#${g}m)"/>
  <rect x="28" y="92" width="84" height="18" rx="9" fill="url(#${g}u)"/>
  <path d="M34 96 h72" stroke="#fff" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>
  <path d="M70 110 v20" stroke="#5B6168" stroke-width="3"/>
  <rect x="50" y="128" width="40" height="6" rx="3" fill="#2B2F36"/>
</svg>`;
  }

  // Tricolour wordmark with a small chakra
  const logo = `<span class="logo"><span class="logo-all">All</span><svg viewBox="0 0 24 24" class="chakra" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="#000080" stroke-width="1.6"/><circle cx="12" cy="12" r="2" fill="#000080"/>${Array.from({ length: 24 }, (_, i) => `<line x1="12" y1="12" x2="${12 + 9.5 * Math.cos((i * Math.PI) / 12)}" y2="${12 + 9.5 * Math.sin((i * Math.PI) / 12)}" stroke="#000080" stroke-width=".7"/>`).join('')}</svg><span class="logo-in">In</span></span>`;

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
  }

  return { api, now, clock, esc, initials, chairSVG, logo, toast };
})();
