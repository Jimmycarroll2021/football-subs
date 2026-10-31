/* Futsal Subs — UI. Depends on rotation.js (window.Rotation). */
(function () {
  'use strict';

  const STORE_KEY = 'futsal-subs-v1';

  const FORMATS = [
    { id: 'futsal5', label: 'Futsal 5-a-side (with goalie)', positions: ['Goalie', 'Defender', 'Right Wing', 'Left Wing', 'Striker'] },
    { id: 'gk4', label: '4-a-side (with goalie)', positions: ['Goalie', 'Defender', 'Midfield', 'Striker'] },
    { id: 'nogk4', label: '4-a-side (no goalie)', positions: ['Defender', 'Left Wing', 'Right Wing', 'Striker'] },
    { id: 'nogk3', label: '3-a-side (no goalie)', positions: ['Defender', 'Midfield', 'Striker'] },
    { id: 'custom', label: 'Custom positions', positions: null },
  ];

  const EXAMPLE_SQUAD = ['Ruby', 'Erin', 'Eva', 'Emily', 'Niya', 'Elly', 'Parker', 'Matilda'];

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((c) => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  };

  let uid = 0;
  const newId = () => `p${Date.now().toString(36)}${(uid++).toString(36)}`;

  function defaultState() {
    return {
      example: true,
      players: EXAMPLE_SQUAD.map((name) => ({ id: newId(), name, here: true, gk: true })),
      format: 'futsal5',
      positions: FORMATS[0].positions.slice(),
      rotations: 5,
      minutes: 4,
      plan: null,
      match: { index: 0, endAt: null, remainingMs: null, sound: true },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) { /* storage unavailable: use defaults */ }
    return null;
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  let state = load();
  const firstRun = !state;
  if (!state) state = defaultState();

  // ---------- helpers ----------
  const present = () => state.players.filter((p) => p.here);
  const rotationMs = () => Math.round(state.minutes * 60000);

  function signature() {
    return JSON.stringify([present().map((p) => [p.name, p.gk]), state.positions, state.rotations]);
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2200);
  }

  function abbrev(pos) {
    if (Rotation.isGoalie(pos)) return 'GK';
    const words = pos.trim().split(/\s+/);
    return (words.length > 1 ? words.map((w) => w[0]).join('') : pos.slice(0, 2)).slice(0, 2).toUpperCase();
  }

  function markChanged() {
    state.example = false;
    save();
  }

  // ---------- squad ----------
  function renderSquad() {
    const list = $('squad-list');
    list.replaceChildren();
    if (!state.players.length) {
      list.append(el('li', {}, el('span', { class: 'hint' }, 'No players yet. Add your first one above.')));
    }
    state.players.forEach((p) => {
      list.append(
        el('li', { class: p.here ? '' : 'away' },
          el('span', { class: 'name' }, p.name),
          el('button', { class: 'chip here', type: 'button', 'aria-pressed': String(p.here), 'aria-label': `${p.name} is here today`,
            onclick: () => { p.here = !p.here; markChanged(); renderAll(); } }, p.here ? 'Here' : 'Away'),
          el('button', { class: 'chip', type: 'button', 'aria-pressed': String(p.gk), 'aria-label': `${p.name} happy to keep goal`,
            onclick: () => { p.gk = !p.gk; markChanged(); renderAll(); } }, 'GK'),
          el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${p.name}`,
            onclick: () => { state.players = state.players.filter((x) => x !== p); markChanged(); renderAll(); } }, '×')
        )
      );
    });

    $('example-banner').hidden = !state.example;

    const fmt = $('format');
    if (!fmt.options.length) FORMATS.forEach((f) => fmt.append(el('option', { value: f.id }, f.label)));
    fmt.value = state.format;
    if (document.activeElement !== $('positions')) $('positions').value = state.positions.join(', ');
    if (document.activeElement !== $('rotations')) $('rotations').value = state.rotations;
    if (document.activeElement !== $('minutes')) $('minutes').value = state.minutes;

    const n = present().length;
    const P = state.positions.length;
    let summary;
    if (n < P) summary = `You need at least ${P} players here today. You have ${n}.`;
    else {
      const slots = P * state.rotations;
      const lo = Math.floor(slots / n);
      const hi = Math.ceil(slots / n);
      const play = lo === hi ? `${lo}` : `${lo} or ${hi}`;
      summary = `${n} here, ${P} on court, ${n - P} on the bench. Each child plays ${play} of ${state.rotations} rotations (about ${+(lo * state.minutes).toFixed(1)}${lo === hi ? '' : `–${+(hi * state.minutes).toFixed(1)}`} minutes).`;
    }
    $('setup-summary').textContent = summary;
    $('team-summary').textContent = `${n} here · ${state.rotations} × ${state.minutes} min`;
  }

  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('add-name');
    const names = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    names.forEach((name) => {
      let unique = name;
      let i = 2;
      while (state.players.some((p) => p.name.toLowerCase() === unique.toLowerCase())) unique = `${name} ${i++}`;
      state.players.push({ id: newId(), name: unique, here: true, gk: true });
    });
    input.value = '';
    input.focus();
    markChanged();
    renderAll();
  });

  $('clear-squad').addEventListener('click', () => {
    state.players = [];
    state.plan = null;
    markChanged();
    renderAll();
    $('add-name').focus();
  });

  $('format').addEventListener('change', (e) => {
    state.format = e.target.value;
    const f = FORMATS.find((x) => x.id === state.format);
    if (f && f.positions) state.positions = f.positions.slice();
    save();
    renderAll();
  });

  $('positions').addEventListener('change', (e) => {
    const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!list.length) return renderAll();
    state.positions = list;
    const match = FORMATS.find((f) => f.positions && f.positions.join('|') === list.join('|'));
    state.format = match ? match.id : 'custom';
    save();
    renderAll();
  });

  $('rotations').addEventListener('change', (e) => {
    state.rotations = Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1));
    save();
    renderAll();
  });

  $('minutes').addEventListener('change', (e) => {
    state.minutes = Math.min(30, Math.max(0.5, parseFloat(e.target.value) || 4));
    state.match.remainingMs = null;
    save();
    renderAll();
  });

  $('go-plan').addEventListener('click', () => {
    if (makePlan()) show('plan');
  });

  // ---------- plan ----------
  let selected = null; // { r, i }

  function makePlan(seed) {
    try {
      const res = Rotation.generate({
        players: present().map((p) => ({ name: p.name, gk: p.gk })),
        positions: state.positions,
        rotations: state.rotations,
        seed: seed == null ? Math.floor(Math.random() * 1e9) : seed,
      });
      state.plan = { cols: res.cols, positions: state.positions.slice(), sig: signature(), seed: res.seed };
      state.match = Object.assign(state.match, { index: 0, endAt: null, remainingMs: null });
      selected = null;
      save();
      renderAll();
      return true;
    } catch (err) {
      $('plan-error-text').textContent = err.message;
      $('plan-error').hidden = false;
      show('plan');
      return false;
    }
  }

  function renderPlan() {
    const plan = state.plan;
    $('plan-error').hidden = true;
    $('plan-card').hidden = !plan;
    $('fair').closest('.card').hidden = !plan;
    $('stale-banner').hidden = !plan || plan.sig === signature();
    if (!plan) {
      $('plan-error-text').textContent = 'No plan yet. Set up your squad, then tap “Make the plan”.';
      $('plan-error').hidden = false;
      return;
    }
    const P = plan.positions.length;
    const rows = Math.max(...plan.cols.map((c) => c.length));
    const selName = selected ? plan.cols[selected.r][selected.i] : null;

    const table = $('grid');
    table.replaceChildren();
    const head = el('tr', {}, el('th', { scope: 'col' }, 'Position'));
    plan.cols.forEach((_, r) => head.append(el('th', { scope: 'col' }, `Rot ${r + 1}`)));
    table.append(el('thead', {}, head));

    const body = el('tbody');
    for (let i = 0; i < rows; i++) {
      const isBench = i >= P;
      const tr = el('tr', { class: [isBench ? 'bench' : '', i === P ? 'first-bench' : ''].join(' ').trim() || null },
        el('th', { scope: 'row' }, isBench ? `Sub ${i - P + 1}` : plan.positions[i]));
      plan.cols.forEach((col, r) => {
        const name = col[i] || '';
        const isSel = selected && selected.r === r && selected.i === i;
        const cls = isSel ? 'sel' : name && name === selName ? 'hl' : null;
        tr.append(
          el('td', { class: r === state.match.index ? 'current' : null },
            el('button', { type: 'button', class: cls, 'aria-pressed': isSel ? 'true' : null,
              onclick: () => tapCell(r, i) }, name || '—'))
        );
      });
      body.append(tr);
    }
    table.append(body);
    renderFairness();
  }

  function tapCell(r, i) {
    const plan = state.plan;
    if (!selected || selected.r !== r) {
      selected = { r, i };
    } else if (selected.i === i) {
      selected = null;
    } else {
      const col = plan.cols[r];
      [col[selected.i], col[i]] = [col[i], col[selected.i]];
      toast(`Swapped ${col[i] || 'empty'} and ${col[selected.i] || 'empty'}`);
      selected = null;
      save();
    }
    renderPlan();
    renderMatch();
  }

  function renderFairness() {
    const plan = state.plan;
    const players = present().map((p) => ({ name: p.name, gk: p.gk }));
    // Include anyone in the plan who has since been marked away, so stats still add up.
    plan.cols.flat().forEach((n) => n && !players.some((p) => p.name === n) && players.push({ name: n, gk: true }));
    const a = Rotation.analyse(plan.cols, plan.positions, players);

    const issues = $('issues');
    issues.replaceChildren(
      a.issues.length
        ? el('ul', { class: 'issues' }, a.issues.map((t) => el('li', {}, t)))
        : el('p', { class: 'allgood' }, '✓ Fair: equal time (give or take one rotation), nobody sits out twice in a row, goal shared out.')
    );

    const maxOn = Math.max(1, ...a.players.map((p) => p.on));
    const table = $('fair');
    table.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', {}, 'Player'), el('th', {}, 'Playing'), el('th', { class: 'num' }, 'Subs'), el('th', { class: 'num' }, 'GK'), el('th', {}, 'Positions'))),
      el('tbody', {}, a.players.map((p) =>
        el('tr', {},
          el('td', {}, el('strong', {}, p.name)),
          el('td', { style: 'white-space:nowrap' },
            el('span', { class: 'bar', style: `width:${Math.round((p.on / maxOn) * 24)}px` }),
            `${p.on} · ${+(p.on * state.minutes).toFixed(1)}m`),
          el('td', { class: 'num' }, String(p.off)),
          el('td', { class: 'num' }, String(p.gk)),
          el('td', { class: 'hint' }, Object.keys(p.positions).filter((k) => !Rotation.isGoalie(k)).map((k) => abbrev(k) + (p.positions[k] > 1 ? `×${p.positions[k]}` : '')).join(', ') || '—')
        )
      ))
    );
  }

  function planText() {
    const plan = state.plan;
    const P = plan.positions.length;
    return plan.cols.map((col, r) => {
      const lines = [`Rotation ${r + 1} (${state.minutes} min)`];
      plan.positions.forEach((pos, i) => lines.push(`  ${pos}: ${col[i]}`));
      const bench = col.slice(P).filter(Boolean);
      if (bench.length) lines.push(`  Subs: ${bench.join(', ')}`);
      return lines.join('\n');
    }).join('\n\n');
  }

  $('copy-plan').addEventListener('click', () => {
    const text = planText();
    const fallback = () => {
      const ta = el('textarea', { style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
      ta.remove();
      toast(ok ? 'Plan copied. Paste it into the team chat.' : 'Could not copy on this device.');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Plan copied. Paste it into the team chat.'), fallback);
    } else fallback();
  });

  const inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  $('print-plan').hidden = inFrame;
  $('print-plan').addEventListener('click', () => window.print());
  $('shuffle').addEventListener('click', () => { makePlan(); toast('New plan made'); });
  $('regen-stale').addEventListener('click', () => { makePlan(); toast('New plan made'); });

  // ---------- match ----------
  let tickTimer = null;
  let audioCtx = null;
  let wakeLock = null;
  let buzzed = false;

  function remaining() {
    const m = state.match;
    if (m.endAt) return Math.max(0, m.endAt - Date.now());
    return m.remainingMs == null ? rotationMs() : m.remainingMs;
  }

  function fmt(ms) {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function beep() {
    if (!state.match.sound || !audioCtx) return;
    const t0 = audioCtx.currentTime;
    [0, 0.35, 0.7].forEach((d) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.28);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.3);
    });
  }

  async function keepAwake(on) {
    try {
      if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
      if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }

  function tick() {
    const ms = remaining();
    const t = $('timer');
    t.textContent = fmt(ms);
    t.classList.toggle('ending', ms > 0 && ms <= 30000);
    t.classList.toggle('done', ms === 0);
    if (ms === 0 && state.match.endAt && !buzzed) {
      buzzed = true;
      beep();
      try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); } catch (e) { /* ignore */ }
      $('start-stop').textContent = 'Time up';
    }
  }

  function startTicking() {
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 250);
    tick();
  }

  function setIndex(i) {
    const n = state.plan ? state.plan.cols.length : 0;
    state.match.index = Math.max(0, Math.min(n - 1, i));
    state.match.endAt = null;
    state.match.remainingMs = null;
    buzzed = false;
    clearInterval(tickTimer);
    keepAwake(false);
    save();
    renderPlan();
    renderMatch();
  }

  $('start-stop').addEventListener('click', () => {
    const m = state.match;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (m.endAt && remaining() === 0) {
      // Time's up: tapping moves to the next rotation.
      if (state.plan && m.index < state.plan.cols.length - 1) setIndex(m.index + 1);
      else setIndex(m.index);
      return;
    }
    if (m.endAt) {
      m.remainingMs = remaining();
      m.endAt = null;
      clearInterval(tickTimer);
      keepAwake(false);
    } else {
      m.endAt = Date.now() + remaining();
      buzzed = false;
      startTicking();
      keepAwake(true);
    }
    save();
    renderMatch();
  });

  $('prev-rot').addEventListener('click', () => setIndex(state.match.index - 1));
  $('next-rot').addEventListener('click', () => setIndex(state.match.index + 1));
  $('reset-timer').addEventListener('click', () => setIndex(state.match.index));
  $('sound-toggle').addEventListener('click', () => {
    state.match.sound = !state.match.sound;
    save();
    renderMatch();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.match.endAt) keepAwake(true);
  });

  // Court spots: attacking upwards, goal at the bottom.
  function spotsFor(positions) {
    const used = {};
    return positions.map((pos, i) => {
      let x = 50;
      let y;
      const p = pos.toLowerCase();
      if (Rotation.isGoalie(pos)) y = 88;
      else if (/left/.test(p)) { x = 22; y = 50; }
      else if (/right/.test(p)) { x = 78; y = 50; }
      else if (/def|back/.test(p)) y = 70;
      else if (/strik|pivot|forward|attack|wing/.test(p)) y = 24;
      else if (/mid|cent/.test(p)) y = 48;
      else y = 20 + (60 * i) / Math.max(1, positions.length - 1);
      const key = `${x},${Math.round(y)}`;
      if (used[key]) x = Math.min(85, Math.max(15, x + (used[key] % 2 ? 26 : -26)));
      used[key] = (used[key] || 0) + 1;
      return { x, y };
    });
  }

  const COURT_SVG =
    '<svg viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden="true">' +
    '<g fill="none" stroke="var(--court-line)" stroke-width="2.5">' +
    '<rect x="10" y="10" width="280" height="380" rx="4"/>' +
    '<line x1="10" y1="200" x2="290" y2="200"/>' +
    '<circle cx="150" cy="200" r="36"/>' +
    '<path d="M95 10 v20 a55 55 0 0 0 110 0 v-20"/>' +
    '<path d="M95 390 v-20 a55 55 0 0 1 110 0 v20"/>' +
    '<rect x="125" y="2" width="50" height="8"/><rect x="125" y="390" width="50" height="8"/>' +
    '</g><circle cx="150" cy="200" r="3" fill="var(--court-line)"/></svg>';

  function renderMatch() {
    const plan = state.plan;
    $('match-empty').hidden = !!plan;
    ['match-card', 'next-card'].forEach((id) => ($(id).hidden = !plan));
    $('court').closest('.card').hidden = !plan;
    if (!plan) return;

    const n = plan.cols.length;
    const r = Math.min(state.match.index, n - 1);
    const P = plan.positions.length;
    const cur = plan.cols[r];
    const prev = r > 0 ? plan.cols[r - 1] : null;
    const next = r < n - 1 ? plan.cols[r + 1] : null;

    $('rot-label').textContent = `Rotation ${r + 1}`;
    $('rot-of').textContent = `of ${n} · ${state.minutes} min each`;
    $('prev-rot').disabled = r === 0;
    $('next-rot').disabled = r === n - 1;
    const m = state.match;
    $('start-stop').textContent = m.endAt ? (remaining() === 0 ? (next ? 'Next rotation' : 'Finished') : 'Pause') : (m.remainingMs != null && m.remainingMs < rotationMs() ? 'Resume' : 'Start');
    $('sound-toggle').textContent = m.sound ? 'Buzzer on' : 'Buzzer off';
    $('sound-toggle').setAttribute('aria-pressed', String(m.sound));
    if (m.endAt) startTicking(); else tick();

    const court = $('court');
    court.innerHTML = COURT_SVG;
    spotsFor(plan.positions).forEach((s, i) => {
      const changed = prev && prev[i] !== cur[i];
      court.append(
        el('div', { class: ['spot', Rotation.isGoalie(plan.positions[i]) ? 'gk' : '', changed ? 'changed' : ''].join(' '), style: `left:${s.x}%;top:${s.y}%` },
          el('span', { class: 'dot' }, abbrev(plan.positions[i])),
          el('span', { class: 'pname' }, cur[i] || '—'),
          el('span', { class: 'ppos' }, plan.positions[i]))
      );
    });
    const bench = cur.slice(P).filter(Boolean);
    $('bench-now').replaceChildren(bench.length ? el('span', {}, 'Bench: ', el('strong', {}, bench.join(', '))) : 'No subs this rotation.');

    $('next-title').textContent = next ? `Changes for rotation ${r + 2}` : 'Last rotation';
    $('changes').replaceChildren(...changeList(cur, next, plan.positions));
  }

  function changeList(cur, next, positions) {
    if (!next) return [el('li', {}, 'Final rotation. Well played, everyone!')];
    const P = positions.length;
    const onNow = new Set(cur.slice(0, P));
    const onNext = new Set(next.slice(0, P));
    const items = [];
    const reportedOff = new Set();
    positions.forEach((pos, i) => {
      const inc = next[i];
      if (!inc) return;
      if (!onNow.has(inc)) {
        const out = cur[i];
        if (out && !onNext.has(out)) {
          reportedOff.add(out);
          items.push(el('li', {}, el('span', { class: 'tag on' }, 'On'), el('strong', {}, inc), ` for ${out} · ${pos}`));
        } else {
          items.push(el('li', {}, el('span', { class: 'tag on' }, 'On'), el('strong', {}, inc), ` · ${pos}`));
        }
      } else if (cur.indexOf(inc) !== i) {
        items.push(el('li', {}, el('span', { class: 'tag move' }, 'Move'), el('strong', {}, inc), ` ${positions[cur.indexOf(inc)]} → ${pos}`));
      }
    });
    cur.slice(0, P).forEach((n) => {
      if (n && !onNext.has(n) && !reportedOff.has(n)) items.push(el('li', {}, el('span', { class: 'tag off' }, 'Off'), el('strong', {}, n)));
    });
    return items.length ? items : [el('li', {}, 'No changes.')];
  }

  // ---------- tabs ----------
  const VIEWS = ['squad', 'plan', 'match'];
  let current = 'squad';

  function show(view) {
    if (!VIEWS.includes(view)) view = 'squad';
    current = view;
    VIEWS.forEach((v) => {
      $(`view-${v}`).hidden = v !== view;
      $(`tab-${v}`).setAttribute('aria-selected', String(v === view));
    });
    if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));

  function renderAll() {
    renderSquad();
    renderPlan();
    renderMatch();
  }

  // ---------- boot ----------
  if (firstRun) makePlan(20261031);
  renderAll();
  show(location.hash ? location.hash.slice(1) : firstRun || state.plan ? 'plan' : 'squad');

  if ('serviceWorker' in navigator && location.protocol === 'https:' && !inFrame) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
