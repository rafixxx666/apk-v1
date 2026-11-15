(() => {
'use strict';

/* ============ Util ============ */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEY = 'tumbuh.v1';

const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  calc: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'
};
const ic = (n, s = 24) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

const fmt = n => Math.round(n).toLocaleString('id-ID');
const rp = n => (n < 0 ? '-' : '') + 'Rp' + fmt(Math.abs(n));
const short = n => {
  const a = Math.abs(n), f = (v, u) => 'Rp' + (Math.round(v * 10) / 10).toString().replace('.', ',') + ' ' + u;
  return a >= 1e9 ? f(a / 1e9, 'M') : a >= 1e6 ? f(a / 1e6, 'jt') : a >= 1e3 ? f(a / 1e3, 'rb') : 'Rp' + Math.round(a);
};
const num = v => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const D = 864e5;
const dayKey = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dayLabel = k => {
  const t = dayKey(Date.now());
  if (k === t) return 'Hari ini';
  if (k === t - D) return 'Kemarin';
  return new Date(k).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
};
const timeStr = ts => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

/* ============ Data ============ */
let S = { tx: [], goals: [] };
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(S, JSON.parse(raw)); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

const CAT = {
  out: [['Makan', '🍜'], ['Transport', '🚌'], ['Belanja', '🛍️'], ['Tagihan', '💡'], ['Hiburan', '🎬'], ['Kesehatan', '💊'], ['Lainnya', '✨']],
  in: [['Gaji', '💼'], ['Bonus', '🎁'], ['Usaha', '🏪'], ['Investasi', '📈'], ['Lainnya', '✨']]
};
const emojiOf = t => t.type === 'save' ? '🐷' : ((CAT[t.type] || []).find(x => x[0] === t.cat) || [0, '✨'])[1];
const GOAL_EMOJI = ['🎯', '🛡️', '🏠', '🚗', '✈️', '📱', '🎓', '💍'];

function totals() {
  const d = new Date(), m0 = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  let inc = 0, out = 0, sv = 0, mi = 0, mo = 0, ms = 0;
  for (const t of S.tx) {
    const cur = t.ts >= m0;
    if (t.type === 'in') { inc += t.amount; if (cur) mi += t.amount; }
    else if (t.type === 'out') { out += t.amount; if (cur) mo += t.amount; }
    else { sv += t.amount; if (cur) ms += t.amount; }
  }
  return { balance: inc - out - sv, mi, mo, ms, saved: S.goals.reduce((a, g) => a + g.saved, 0) };
}

/* ============ Kalkulator (murni) ============ */
const monthlyRate = r => Math.pow(1 + r / 100, 1 / 12) - 1;
function grow(init, mo, rate, years) {
  const rm = monthlyRate(rate); let b = init, dep = init; const bal = [b], dp = [dep];
  for (let y = 1; y <= years; y++) { for (let m = 0; m < 12; m++) { b = b * (1 + rm) + mo; dep += mo; } bal.push(b); dp.push(dep); }
  return { bal, dp };
}
function need(target, cur, months, rate) {
  const rm = monthlyRate(rate);
  if (!rm) return Math.max(0, (target - cur) / months);
  const f = (Math.pow(1 + rm, months) - 1) / rm;
  return Math.max(0, (target - cur * Math.pow(1 + rm, months)) / f);
}
function monthsToGoal(goal, cur, mo, rate) {
  const rm = monthlyRate(rate); let b = cur, m = 0;
  while (b < goal && m < 1200) { b = b * (1 + rm) + mo; m++; }
  return m >= 1200 ? null : m;
}

/* ============ Efek ============ */
const fx = $('#fx'), ctx = fx.getContext('2d');
let parts = [], raf = 0;
const sizeFx = () => { fx.width = innerWidth; fx.height = innerHeight; };
addEventListener('resize', sizeFx); sizeFx();
function burst(x = innerWidth / 2, y = innerHeight * .62, n = 48) {
  if (reduce) return;
  const cols = ['#fbbf24', '#34d399', '#2dd4bf', '#fde68a', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 7;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, r: 4 + Math.random() * 5, c: cols[i % cols.length], spin: Math.random() * 6, vs: .2 + Math.random() * .3, life: 1, coin: Math.random() < .6 });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  ctx.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.life > 0 && p.y < fx.height + 20);
  for (const p of parts) {
    p.vy += .28; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.spin += p.vs; p.life -= .011;
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6)); ctx.fillStyle = p.c; ctx.beginPath();
    if (p.coin) ctx.ellipse(p.x, p.y, Math.abs(Math.cos(p.spin)) * p.r + .8, p.r, 0, 0, 7);
    else ctx.rect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r * 1.6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
  if (!raf) ctx.clearRect(0, 0, fx.width, fx.height);
}
function countUp(el, to, dur = 900) {
  if (reduce || dur === 0) { el.textContent = rp(to); return; }
  const t0 = performance.now();
  const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = rp(to * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const runCounts = (root, anim = true) => $$('[data-count]', root).forEach(el => countUp(el, +el.dataset.count, anim ? 900 : 0));
let tt;
function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600);
}
document.addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.btn,.chip');
  if (!b || reduce) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement('span');
  s.className = 'ripple';
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 650);
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.classList && el.classList.contains('money')) { const n = num(el.value); el.value = n ? fmt(n) : ''; }
});
const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); if (navigator.vibrate) navigator.vibrate(40); };

/* ============ Bottom sheet ============ */
let sheetOpen = false;
function sheet(html, mount) {
  const r = $('#sheet-root');
  r.innerHTML = `<div class="scrim"></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
  if (!sheetOpen) { history.pushState({ s: 1 }, ''); sheetOpen = true; }
  requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('open')));
  $('.scrim', r).onclick = () => closeSheet();
  if (mount) mount($('.sheet', r));
}
function closeSheet(fromPop) {
  const r = $('#sheet-root'); r.classList.remove('open');
  if (sheetOpen) { sheetOpen = false; if (!fromPop) history.back(); }
  setTimeout(() => { if (!r.classList.contains('open')) r.innerHTML = ''; }, 380);
}
addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });

/* ============ Komponen tampilan ============ */
function txRow(t, withDate) {
  const sign = t.type === 'in' ? '+' : t.type === 'out' ? '-' : '';
  const label = t.type === 'save' ? 'Tabungan' : t.cat;
  return `<button class="tx" data-tx="${t.id}"><span class="em">${emojiOf(t)}</span>
    <span class="tx-main"><b>${esc(t.note || label)}</b><small>${esc(label)} · ${withDate ? dayLabel(dayKey(t.ts)) + ', ' : ''}${timeStr(t.ts)}</small></span>
    <span class="amt ${t.type}">${sign}${rp(t.amount)}</span></button>`;
}
const sorted = () => [...S.tx].sort((a, b) => b.ts - a.ts);
const ring = (p, label) => `<div class="ring" style="--p:${p}"><svg width="76" height="76" viewBox="0 0 76 76"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#fbbf24"/></linearGradient></defs><circle class="t" cx="38" cy="38" r="32"/><circle class="v" cx="38" cy="38" r="32"/></svg><b>${label}</b></div>`;
const monthsLeft = g => Math.max(1, Math.ceil((g.deadline - Date.now()) / (30.44 * D)));
const goalPct = g => Math.min(1, g.target ? g.saved / g.target : 0);

/* ============ Halaman ============ */
function vHome() {
  const T = totals(), h = new Date().getHours();
  const greet = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
  const vals = days.map(d => { const a = d.getTime(), b = a + D; return S.tx.filter(t => t.type === 'out' && t.ts >= a && t.ts < b).reduce((s, t) => s + t.amount, 0); });
  const mx = Math.max(...vals, 1);
  const bars = vals.map((v, i) => `<div class="bar"><i class="${v ? '' : 'zero'}" style="--h:${Math.max(6, v / mx * 100)}%;--d:${i * 70}ms"></i><span>${'MSSRKJS'[days[i].getDay()]}</span></div>`).join('');
  const open = S.goals.filter(g => g.saved < g.target).sort((a, b) => goalPct(b) - goalPct(a))[0] || S.goals[0];
  const recent = sorted().slice(0, 5);
  return `
  <div class="top"><div><small>${greet} 👋</small><h1>Tumbuh</h1></div>
    <button class="round" data-act="gear" aria-label="Pengaturan">${ic('sliders', 20)}</button></div>
  <div class="card hero"><div class="lbl">Saldo tersedia</div>
    <div class="big" data-count="${T.balance}">${rp(T.balance)}</div>
    <div class="lbl" style="font-size:12px;margin-bottom:6px;position:relative;z-index:1">Ringkasan bulan ini</div>
    <div class="row">
      <div class="pill"><small>Masuk</small><b>+${short(T.mi)}</b></div>
      <div class="pill"><small>Keluar</small><b>-${short(T.mo)}</b></div>
      <div class="pill"><small>Ditabung</small><b>${short(T.ms)}</b></div>
    </div></div>
  ${S.tx.length || S.goals.length ? '' : `<div class="card empty"><div class="big">🌱</div><p>Mulai catat uang masuk dan keluar,<br>lalu pantau tabunganmu tumbuh.</p>
    <button class="btn primary" data-act="add">Catat transaksi pertama</button>
    <p style="margin:12px 0 0"><button class="btn small" data-act="demo">Coba dengan data contoh</button></p></div>`}
  <div class="card"><h2>7 hari terakhir <em>pengeluaran</em></h2><div class="bars">${bars}</div></div>
  ${open ? `<div class="card"><h2>Target tabungan <em><button data-act="to-goals" style="color:var(--em)">Lihat semua</button></em></h2>
    <div class="goalrow">${ring(goalPct(open), Math.round(goalPct(open) * 100) + '%')}
    <div class="info"><b>${open.emoji} ${esc(open.name)}</b><small>${rp(open.saved)} dari ${rp(open.target)}</small></div></div></div>` : ''}
  ${recent.length ? `<div class="card"><h2>Transaksi terbaru <em><button data-act="to-history" style="color:var(--em)">Semua</button></em></h2>${recent.map(t => txRow(t)).join('')}</div>` : ''}`;
}

function vHistory() {
  const list = sorted();
  if (!list.length) return `<div class="top"><div><small>Semua catatan</small><h1>Riwayat</h1></div></div>
    <div class="card empty"><div class="big">🧾</div><p>Belum ada transaksi.</p><button class="btn primary" data-act="add">Catat sekarang</button></div>`;
  let html = '', last = null;
  for (const t of list) {
    const k = dayKey(t.ts);
    if (k !== last) { if (last !== null) html += '</div>'; html += `<div class="day">${dayLabel(k)}</div><div class="card" style="padding:6px 12px">`; last = k; }
    html += txRow(t);
  }
  return `<div class="top"><div><small>${list.length} catatan</small><h1>Riwayat</h1></div></div>${html}</div>`;
}

function vGoals() {
  const T = totals();
  const cards = S.goals.map(g => {
    const p = goalPct(g), done = g.saved >= g.target;
    let tip = '';
    if (done) tip = '<div class="tip">🎉 Target tercapai! Kerja bagus.</div>';
    else if (g.deadline) tip = g.deadline < Date.now()
      ? '<div class="tip">Tenggat sudah lewat. Atur ulang targetmu atau lanjutkan menabung.</div>'
      : `<div class="tip">Setor sekitar <b>${rp((g.target - g.saved) / monthsLeft(g))}</b> per bulan agar tepat waktu.</div>`;
    return `<button class="card goal" data-goal="${g.id}">
      <div class="head"><span class="em">${g.emoji}</span><div><b>${esc(g.name)}</b><small>${g.deadline ? 'Tenggat ' + new Date(g.deadline).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : 'Tanpa tenggat'}</small></div><span class="pct">${Math.round(p * 100)}%</span></div>
      <div class="prog"><i style="--w:${p * 100}%"></i></div>
      <div class="meta"><span><b>${rp(g.saved)}</b> terkumpul</span><span>${rp(g.target)}</span></div>${tip}</button>`;
  }).join('');
  return `<div class="top"><div><small>Wujudkan impianmu</small><h1>Target</h1></div>
    <button class="btn primary small" data-act="new-goal">+ Target baru</button></div>
    <div class="card"><h2>Total tabungan di target</h2><div style="font-size:28px;font-weight:800;letter-spacing:-.02em" data-count="${T.saved}">${rp(T.saved)}</div></div>
    ${cards || `<div class="card empty"><div class="big">🎯</div><p>Belum ada target. Buat satu, misalnya dana darurat<br>atau liburan impian.</p><button class="btn primary" data-act="new-goal">Buat target</button></div>`}`;
}

/* ---- Kalkulator ---- */
const resultBlock = (label, value, subs = []) => `<div class="result"><small>${label}</small><div class="v" data-count="${value}">${rp(value)}</div>
  ${subs.length ? `<div class="sub">${subs.map(s => `<div><small>${s[0]}</small><b data-count="${s[1]}">${rp(s[1])}</b></div>`).join('')}</div>` : ''}</div>`;

function chart(bal, dp, years) {
  const W = 320, H = 168, L = 6, R = 6, T = 10, B = 24, max = Math.max(...bal, 1);
  const X = i => L + (W - L - R) * (i / years), Y = v => T + (H - T - B) * (1 - v / max);
  const pts = a => a.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const line = pts(bal), base = Y(0);
  const mid = Math.round(years / 2);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik pertumbuhan investasi">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34d399" stop-opacity=".45"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>
    ${[0, .5, 1].map(f => `<line class="grid" x1="${L}" x2="${W - R}" y1="${(T + (H - T - B) * f).toFixed(1)}" y2="${(T + (H - T - B) * f).toFixed(1)}"/>`).join('')}
    <path class="a1" d="${line}L${X(years).toFixed(1)},${base}L${X(0).toFixed(1)},${base}Z"/>
    <path class="l2" d="${pts(dp)}"/>
    <path class="l1" pathLength="1" d="${line}"/>
    <text x="${L}" y="${H - 6}">Mulai</text><text x="${X(mid).toFixed(1)}" y="${H - 6}" text-anchor="middle">${mid} th</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${years} th</text></svg>
    <div class="legend"><span><i style="background:var(--em)"></i>Nilai investasi</span><span><i style="background:var(--gold)"></i>Total modal</span></div>`;
}

const CALCS = {
  invest: {
    label: 'Investasi',
    fields: [['init', 'Modal awal', 'money', 1000000], ['mo', 'Setoran per bulan', 'money', 500000], ['rate', 'Imbal hasil per tahun', 'pct', 10], ['yrs', 'Lama investasi', 'yr', 10]],
    chips: [['Deposito 5%', 5], ['Obligasi 7%', 7], ['Saham 12%', 12]],
    run(v) {
      const yrs = Math.min(60, Math.max(1, Math.round(v.yrs || 1))), g = grow(v.init, v.mo, v.rate, yrs);
      const fin = g.bal[g.bal.length - 1], dep = g.dp[g.dp.length - 1];
      return resultBlock('Nilai investasimu nanti', fin, [['Total modal disetor', dep], ['Keuntungan', fin - dep]]) + chart(g.bal, g.dp, yrs) +
        '<p class="note">Simulasi bunga majemuk bulanan. Bukan jaminan hasil investasi.</p>';
    }
  },
  save: {
    label: 'Tabungan',
    fields: [['target', 'Target dana', 'money', 50000000], ['cur', 'Sudah terkumpul', 'money', 5000000], ['mon', 'Jangka waktu', 'mon', 24], ['rate', 'Imbal hasil per tahun (opsional)', 'pct', 0]],
    run(v) {
      const n = Math.max(1, Math.round(v.mon || 1)), per = need(v.target, v.cur, n, v.rate || 0);
      return resultBlock('Tabung per bulan', per, [['Target', v.target], ['Sudah terkumpul', v.cur]]) +
        `<p class="note">Selama ${n} bulan${v.rate ? ` dengan imbal ${String(v.rate).replace('.', ',')}% per tahun` : ' tanpa imbal hasil'}.</p>`;
    }
  },
  emergency: {
    label: 'Darurat',
    fields: [['exp', 'Pengeluaran bulanan', 'money', 5000000], ['st', 'Kondisi kamu', 'sel', 0]],
    opts: [['Lajang (3–6 bulan)', 3, 6], ['Menikah, belum punya anak (6–9 bulan)', 6, 9], ['Menikah dan punya anak (9–12 bulan)', 9, 12], ['Penghasilan tidak tetap (12 bulan)', 12, 12]],
    run(v) {
      const o = this.opts[v.st] || this.opts[0], ideal = v.exp * o[2];
      return resultBlock('Dana darurat ideal', ideal, [['Batas minimal (' + o[1] + ' bln)', v.exp * o[1]], ['Kumpulkan per bulan (12 bln)', ideal / 12]]) +
        '<p class="note">Simpan di tempat yang aman dan mudah dicairkan, misalnya tabungan atau reksa dana pasar uang.</p>';
    }
  },
  free: {
    label: 'Bebas Finansial',
    fields: [['exp', 'Pengeluaran bulanan', 'money', 5000000], ['cur', 'Aset/investasi saat ini', 'money', 10000000], ['mo', 'Investasi per bulan', 'money', 2000000], ['rate', 'Imbal hasil per tahun', 'pct', 8]],
    run(v) {
      const goal = v.exp * 12 * 25, m = monthsToGoal(goal, v.cur, v.mo, v.rate || 0);
      const txt = m === null ? 'Lebih dari 100 th' : m === 0 ? 'Sudah tercapai 🎉' : `${Math.floor(m / 12)} th ${m % 12} bln`;
      return `<div class="result"><small>Dana kebebasan finansial (25× pengeluaran setahun)</small><div class="v" data-count="${goal}">${rp(goal)}</div>
        <div class="sub"><div><small>Estimasi tercapai</small><b>${txt}</b></div><div><small>Kekurangan saat ini</small><b data-count="${Math.max(0, goal - v.cur)}">${rp(Math.max(0, goal - v.cur))}</b></div></div></div>
        <p class="note">Aturan 4%: dana ini bisa menopang pengeluaranmu seumur hidup. Estimasi kasar.</p>`;
    }
  }
};
const calcVals = {};
let calcTab = 'invest';

function fieldHtml(f, val, c) {
  const [id, label, type] = f;
  if (type === 'sel') return `<label class="field"><span>${label}</span><select data-k="${id}">${c.opts.map((o, i) => `<option value="${i}" ${i === val ? 'selected' : ''}>${o[0]}</option>`).join('')}</select></label>`;
  const money = type === 'money', unit = money ? 'Rp' : { pct: '%', yr: 'tahun', mon: 'bulan' }[type];
  return `<label class="field"><span>${label}</span><div class="${money ? 'pre' : 'suf'}"><b>${unit}</b><input class="inp ${money ? 'money' : ''}" data-k="${id}" inputmode="${money ? 'numeric' : 'decimal'}" value="${money ? fmt(val) : String(val).replace('.', ',')}" autocomplete="off"></div></label>`;
}
function vCalc() {
  return `<div class="top"><div><small>Simulasi cepat</small><h1>Hitung</h1></div></div>
    <div class="seg" id="ctabs">${Object.entries(CALCS).map(([k, c]) => `<button data-c="${k}" class="${k === calcTab ? 'on' : ''}">${c.label}</button>`).join('')}</div>
    <div class="card" id="calc-body"></div>`;
}
function mountCalc() {
  const c = CALCS[calcTab], vals = calcVals[calcTab] || (calcVals[calcTab] = Object.fromEntries(c.fields.map(f => [f[0], f[3]])));
  const body = $('#calc-body');
  body.innerHTML = c.fields.map(f => fieldHtml(f, vals[f[0]], c)).join('') +
    (c.chips ? `<div class="chips">${c.chips.map(x => `<button class="chip" data-rate="${x[1]}">${x[0]}</button>`).join('')}</div>` : '') + '<div id="res"></div>';
  const update = anim => {
    c.fields.forEach(f => {
      const el = $(`[data-k="${f[0]}"]`, body);
      vals[f[0]] = f[2] === 'money' ? num(el.value) : f[2] === 'sel' ? +el.value : (parseFloat(el.value.replace(',', '.')) || 0);
    });
    const res = $('#res', body);
    res.className = anim ? '' : 'nofx';
    res.innerHTML = c.run(vals);
    runCounts(res, anim);
  };
  $$('input,select', body).forEach(el => el.addEventListener('input', () => update(false)));
  $$('[data-rate]', body).forEach(b => b.onclick = () => {
    const el = $('[data-k="rate"]', body); el.value = String(b.dataset.rate).replace('.', ',');
    $$('[data-rate]', body).forEach(x => x.classList.toggle('on', x === b)); update(false);
  });
  update(true);
  $$('#ctabs button').forEach(b => b.onclick = () => { calcTab = b.dataset.c; $$('#ctabs button').forEach(x => x.classList.toggle('on', x === b)); mountCalc(); });
}

/* ============ Render & navigasi ============ */
let tab = 'home';
const view = $('#view');
const acts = {
  gear: () => openSettings(), demo: () => loadDemo(), add: () => openAdd('out'),
  'new-goal': () => openNewGoal(), 'to-goals': () => go('goals'), 'to-history': () => go('history')
};
function render(animate = true) {
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  view.className = 'wrap' + (animate ? ' enter' : '');
  view.innerHTML = ({ home: vHome, history: vHistory, goals: vGoals, calc: vCalc })[tab]();
  runCounts(view);
  $$('[data-tx]', view).forEach(b => b.onclick = () => openTx(b.dataset.tx));
  $$('[data-goal]', view).forEach(b => b.onclick = () => openGoal(b.dataset.goal));
  $$('[data-act]', view).forEach(b => b.onclick = () => acts[b.dataset.act] && acts[b.dataset.act]());
  if (tab === 'calc') mountCalc();
}
function go(t) { tab = t; render(true); scrollTo(0, 0); }

/* ============ Sheet: transaksi ============ */
function openAdd(type = 'out') {
  const cur = { type, cat: CAT[type][0][0] };
  sheet(`<h3>Catat transaksi</h3>
    <div class="seg" id="tsel"><button data-t="out">Pengeluaran</button><button data-t="in">Pemasukan</button></div>
    <label class="big-in"><span>Rp</span><input id="a-amt" class="money" inputmode="numeric" placeholder="0" autocomplete="off"></label>
    <div class="quick">${[10000, 50000, 100000, 500000].map(n => `<button class="chip" data-q="${n}">+${fmt(n / 1000)}rb</button>`).join('')}</div>
    <div class="chips" id="cats"></div>
    <label class="field"><input id="a-note" class="inp" placeholder="Catatan (opsional)" maxlength="60"></label>
    <button class="btn primary wide" id="a-save">Simpan</button>`, sh => {
    const amt = $('#a-amt', sh), draw = () => {
      $$('#tsel button', sh).forEach(b => b.classList.toggle('on', b.dataset.t === cur.type));
      $('#cats', sh).innerHTML = CAT[cur.type].map(c => `<button class="chip ${c[0] === cur.cat ? 'on' : ''}" data-c="${c[0]}">${c[1]} ${c[0]}</button>`).join('');
      $$('#cats .chip', sh).forEach(b => b.onclick = () => { cur.cat = b.dataset.c; draw(); });
    };
    $$('#tsel button', sh).forEach(b => b.onclick = () => { cur.type = b.dataset.t; cur.cat = CAT[cur.type][0][0]; draw(); });
    $$('[data-q]', sh).forEach(b => b.onclick = () => { amt.value = fmt(num(amt.value) + +b.dataset.q); });
    $('#a-save', sh).onclick = () => {
      const n = num(amt.value);
      if (!n) { shake(amt.parentElement); amt.focus(); return; }
      S.tx.push({ id: uid(), type: cur.type, cat: cur.cat, note: $('#a-note', sh).value.trim(), amount: n, ts: Date.now() });
      save(); closeSheet(); render(false);
      if (cur.type === 'in') { burst(); toast('Pemasukan dicatat 💰'); } else toast('Pengeluaran dicatat ✅');
    };
    draw(); setTimeout(() => amt.focus(), 380);
  });
}
function confirmBtn(btn, label, fn) {
  let armed = false;
  btn.onclick = () => {
    if (!armed) { armed = true; btn.textContent = label; setTimeout(() => { armed = false; btn.textContent = btn.dataset.t0; }, 3000); }
    else fn();
  };
  btn.dataset.t0 = btn.textContent;
}
function openTx(id) {
  const t = S.tx.find(x => x.id === id); if (!t) return;
  sheet(`<h3>Detail transaksi</h3>
    <div style="text-align:center;margin:6px 0 16px"><div class="em" style="margin:0 auto 8px;width:56px;height:56px;font-size:28px">${emojiOf(t)}</div>
    <div style="font-size:30px;font-weight:800" class="amt ${t.type}">${t.type === 'in' ? '+' : t.type === 'out' ? '-' : ''}${rp(t.amount)}</div>
    <div style="color:var(--muted)">${esc(t.note || (t.type === 'save' ? 'Tabungan' : t.cat))}</div>
    <div style="color:var(--faint);font-size:13px;margin-top:4px">${esc(t.type === 'save' ? 'Tabungan' : t.cat)} · ${dayLabel(dayKey(t.ts))}, ${timeStr(t.ts)}</div></div>
    <button class="btn danger wide" id="t-del">Hapus transaksi</button>`, sh => {
    confirmBtn($('#t-del', sh), 'Ketuk lagi untuk menghapus', () => {
      if (t.goalId) { const g = S.goals.find(x => x.id === t.goalId); if (g) g.saved = Math.max(0, g.saved - t.amount); }
      S.tx = S.tx.filter(x => x.id !== id); save(); closeSheet(); render(false); toast('Transaksi dihapus');
    });
  });
}

/* ============ Sheet: target ============ */
function openNewGoal() {
  let emoji = GOAL_EMOJI[0];
  sheet(`<h3>Target baru</h3>
    <div class="chips" id="emo">${GOAL_EMOJI.map(e => `<button class="chip" data-e="${e}" style="font-size:18px">${e}</button>`).join('')}</div>
    <label class="field"><span>Nama target</span><input id="g-name" class="inp" placeholder="Contoh: Dana darurat" maxlength="30"></label>
    <label class="field"><span>Jumlah target</span><div class="pre"><b>Rp</b><input id="g-target" class="inp money" inputmode="numeric" placeholder="0" autocomplete="off"></div></label>
    <label class="field"><span>Tenggat (opsional)</span><input id="g-date" type="date" class="inp"></label>
    <button class="btn primary wide" id="g-save">Buat target</button>`, sh => {
    const draw = () => $$('#emo .chip', sh).forEach(b => b.classList.toggle('on', b.dataset.e === emoji));
    $$('#emo .chip', sh).forEach(b => b.onclick = () => { emoji = b.dataset.e; draw(); }); draw();
    $('#g-save', sh).onclick = () => {
      const name = $('#g-name', sh).value.trim(), target = num($('#g-target', sh).value), d = $('#g-date', sh).value;
      if (!name) { shake($('#g-name', sh)); return; }
      if (!target) { shake($('#g-target', sh).parentElement); return; }
      S.goals.push({ id: uid(), name, emoji, target, saved: 0, deadline: d ? new Date(d + 'T23:59:59').getTime() : 0 });
      save(); closeSheet(); tab = 'goals'; render(false); toast('Target dibuat 🎯');
    };
  });
}
function openGoal(id) {
  const g = S.goals.find(x => x.id === id); if (!g) return;
  const p = goalPct(g);
  sheet(`<h3>${g.emoji} ${esc(g.name)}</h3>
    <div class="goalrow" style="margin-bottom:16px">${ring(p, Math.round(p * 100) + '%')}
    <div class="info"><b>${rp(g.saved)}</b><small>dari ${rp(g.target)}<br>Sisa ${rp(Math.max(0, g.target - g.saved))}</small></div></div>
    <label class="field"><span>Setor ke target ini</span><div class="pre"><b>Rp</b><input id="s-amt" class="inp money" inputmode="numeric" placeholder="0" autocomplete="off"></div></label>
    <button class="btn primary wide" id="s-go" style="margin-bottom:10px">Setor sekarang</button>
    <button class="btn danger wide" id="s-del">Hapus target</button>`, sh => {
    $('#s-go', sh).onclick = () => {
      const amt = num($('#s-amt', sh).value);
      if (!amt) { shake($('#s-amt', sh).parentElement); return; }
      const was = g.saved >= g.target; g.saved += amt;
      S.tx.push({ id: uid(), type: 'save', cat: g.name, note: 'Setoran: ' + g.name, amount: amt, ts: Date.now(), goalId: g.id });
      save(); closeSheet(); render(false);
      const done = !was && g.saved >= g.target;
      burst();
      if (done) { setTimeout(() => burst(innerWidth * .25, innerHeight * .5), 220); setTimeout(() => burst(innerWidth * .75, innerHeight * .5), 420); }
      toast(done ? 'Target tercapai! 🎉' : 'Berhasil menabung ' + rp(amt) + ' 🐷');
    };
    confirmBtn($('#s-del', sh), 'Ketuk lagi untuk menghapus', () => {
      S.tx = S.tx.filter(t => t.goalId !== g.id); S.goals = S.goals.filter(x => x.id !== g.id);
      save(); closeSheet(); render(false); toast('Target dihapus, dana kembali ke saldo');
    });
  });
}

/* ============ Pengaturan & data contoh ============ */
function loadDemo() {
  const start = dayKey(Date.now()), now = Date.now();
  const mk = (d, h, type, cat, note, amount, extra = {}) => ({ id: uid(), type, cat, note, amount, ts: Math.min(now - 6e4, start - d * D + h * 36e5), ...extra });
  S.tx = [
    mk(13, 9, 'in', 'Gaji', 'Gaji bulanan', 12000000), mk(12, 12, 'out', 'Tagihan', 'Listrik & internet', 650000),
    mk(11, 13, 'out', 'Makan', 'Makan siang', 35000), mk(10, 19, 'out', 'Hiburan', 'Nonton bioskop', 90000),
    mk(9, 8, 'out', 'Transport', 'Bensin', 120000), mk(8, 14, 'out', 'Belanja', 'Belanja bulanan', 480000),
    mk(7, 12, 'out', 'Makan', 'Bakso', 28000), mk(6, 10, 'in', 'Usaha', 'Proyek freelance', 2500000),
    mk(5, 13, 'out', 'Makan', 'Makan siang', 42000), mk(4, 20, 'out', 'Kesehatan', 'Vitamin', 150000),
    mk(3, 9, 'out', 'Transport', 'Ojek online', 56000), mk(2, 12, 'out', 'Makan', 'Kopi & roti', 47000),
    mk(1, 18, 'out', 'Belanja', 'Baju kerja', 260000), mk(0, 8, 'out', 'Makan', 'Sarapan', 25000)
  ];
  const mo = n => Date.now() + n * 30.44 * D;
  const g1 = { id: uid(), name: 'Dana Darurat', emoji: '🛡️', target: 30000000, saved: 4500000, deadline: mo(10) };
  const g2 = { id: uid(), name: 'Liburan Bali', emoji: '✈️', target: 8000000, saved: 3200000, deadline: mo(5) };
  S.goals = [g1, g2];
  S.tx.push(mk(10, 8, 'save', g1.name, 'Setoran: ' + g1.name, g1.saved, { goalId: g1.id }), mk(9, 8, 'save', g2.name, 'Setoran: ' + g2.name, g2.saved, { goalId: g2.id }));
  save(); render(true); burst(innerWidth / 2, innerHeight * .4, 30);
}
function openSettings() {
  sheet(`<h3>Pengaturan</h3>
    <button class="btn wide" id="p-exp" style="margin-bottom:10px">Ekspor transaksi (CSV)</button>
    <button class="btn wide" id="p-demo" style="margin-bottom:10px">Isi dengan data contoh</button>
    <button class="btn danger wide" id="p-reset">Hapus semua data</button>
    <p class="note" style="margin-top:16px">Semua data tersimpan di perangkatmu saja dan tidak dikirim ke mana pun.<br>Tumbuh v1.0</p>`, sh => {
    $('#p-exp', sh).onclick = () => {
      const rows = [['Tanggal', 'Jenis', 'Kategori', 'Catatan', 'Jumlah']].concat(sorted().map(t => [new Date(t.ts).toISOString(), { in: 'Pemasukan', out: 'Pengeluaran', save: 'Tabungan' }[t.type], t.cat, t.note || '', t.amount]));
      const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'tumbuh-transaksi.csv'; a.click();
      toast('Ekspor dimulai');
    };
    $('#p-demo', sh).onclick = () => { closeSheet(); loadDemo(); };
    confirmBtn($('#p-reset', sh), 'Ketuk lagi untuk menghapus semua', () => { S = { tx: [], goals: [] }; save(); closeSheet(); render(true); toast('Semua data dihapus'); });
  });
}

/* ============ Mulai ============ */
$$('.tab').forEach(b => { b.innerHTML = ic({ home: 'home', history: 'list', goals: 'target', calc: 'calc' }[b.dataset.tab]); b.onclick = () => go(b.dataset.tab); });
$('#fab').innerHTML = ic('plus', 28);
$('#fab').onclick = () => openAdd('out');
render(true);
if ('serviceWorker' in navigator && !window.Capacitor && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
