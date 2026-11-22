/* Mensch vs. Tier – UI */
(function () {
  'use strict';

  var ANIMALS = window.ANIMALS || [];
  var E = window.Engine;
  var STORE_KEY = 'mensch-vs-tier:v1';

  var CAT_LABEL = {
    raubkatzen: 'Raubkatzen', baeren: 'Bären', hundeartige: 'Hundeartige', huftiere: 'Huftiere', primaten: 'Primaten',
    reptilien: 'Reptilien', voegel: 'Vögel', wasser: 'Wassertiere', insekten: 'Insekten & Spinnen', nagetiere: 'Nagetiere'
  };
  var FITNESS = [
    ['untrainiert', 'Untrainiert'], ['durchschnitt', 'Durchschnitt'], ['athlet', 'Athlet'], ['kampfsport', 'Kampfsport-Profi']
  ];
  var MINDSET = [['panik', '😱 Panik'], ['normal', '😐 Normal'], ['todesangst', '🔥 Todesangst']];
  var WEAPON_GROUPS = [
    ['Ohne', [['unbewaffnet', '✊ Unbewaffnet']]],
    ['Improvisiert', [['ast', '🌿 Ast'], ['steine', '🪨 Steine']]],
    ['Klingen & Spieße', [['messer', '🔪 Messer'], ['machete', '🗡️ Machete'], ['speer', '🔱 Speer']]],
    ['Distanz', [['pfefferspray', '🧴 Pfefferspray'], ['kleinkaliber', '🔫 Kleinkaliber'], ['grosskaliber', '💥 Großkaliber']]]
  ];
  var ENVS = [
    ['feld', '🌾', 'Offenes Feld', 'kein Rückzug'], ['wald', '🌲', 'Wald', 'Bäume & Unterholz'],
    ['savanne', '🦒', 'Savanne', 'hohes Gras, Hinterhalt'], ['gebirge', '⛰️', 'Gebirge', 'Geröll & Steine'],
    ['wasser', '🌊', 'Flachwasser', 'kein Halt, Mensch im Nachteil']
  ];
  var ENV_NAME = {}; ENVS.forEach(function (e) { ENV_NAME[e[0]] = e[1] + ' ' + e[2]; });
  var FIT_NAME = {}; FITNESS.forEach(function (f) { FIT_NAME[f[0]] = f[1]; });
  var MIND_NAME = {}; MINDSET.forEach(function (f) { MIND_NAME[f[0]] = f[1]; });
  var WEAPON_NAME = {}; WEAPON_GROUPS.forEach(function (g) { g[1].forEach(function (w) { WEAPON_NAME[w[0]] = w[1]; }); });

  var state = { animalId: 'grizzly', weight: 80, fitness: 'durchschnitt', mindset: 'normal', weapon: 'unbewaffnet', env: 'feld' };
  try {
    var saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (saved && typeof saved === 'object') Object.keys(state).forEach(function (k) { if (saved[k] != null) state[k] = saved[k]; });
  } catch (e) { /* ohne Speicher weiterarbeiten */ }
  state.weight = Math.max(50, Math.min(130, +state.weight || 80));
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ } }

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function byId(id) { for (var i = 0; i < ANIMALS.length; i++) if (ANIMALS[i].id === id) return ANIMALS[i]; return null; }
  function current() { return byId(state.animalId) || ANIMALS[0]; }
  function fmtNum(n) { return Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1 }); }
  function fmtKg(n) { return n >= 100 ? fmtNum(Math.round(n)) + ' kg' : n >= 1 ? fmtNum(n) + ' kg' : n >= 0.001 ? fmtNum(n * 1000) + ' g' : fmtNum(n * 1000000) + ' mg'; }
  function skulls(t) { var s = ''; for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= t ? '' : 'off') + '">💀</span>'; return '<span class="skulls" aria-label="Gefährlichkeit ' + t + ' von 5">' + s + '</span>'; }
  function weaponList(a) { return (a.weapons && a.weapons.length) ? a.weapons.map(function (w) { return E.weaponLabel[w] || w; }).join(', ') : 'keine'; }

  if (!ANIMALS.length) {
    $('main').innerHTML = '<div class="card"><h2>Fehler</h2><p>animals.js konnte nicht geladen werden.</p></div>';
    return;
  }
  if (!byId(state.animalId)) state.animalId = ANIMALS[0].id;

  /* ---------- Navigation ---------- */
  function setView(name) {
    ['setup', 'lexikon', 'sim'].forEach(function (v) { $('view-' + v).classList.toggle('active', v === name); });
    document.querySelectorAll('.bottom-nav button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === name); });
    window.scrollTo(0, 0);
    if (name === 'lexikon') renderLex();
    if (name === 'sim') renderSimSummary();
  }
  document.querySelectorAll('.bottom-nav button').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });

  /* ---------- Setup: Tier-Karte ---------- */
  function renderAnimalCard() {
    var a = current();
    $('animalCard').innerHTML =
      '<span class="emoji">' + esc(a.emoji) + '</span>' +
      '<span class="ac-body"><span class="ac-name">' + esc(a.name) + '</span><br>' +
      '<span class="ac-meta">' + esc(CAT_LABEL[a.category] || a.category) + ' · ' + fmtKg(a.weight) + ' · ' + a.speed + ' km/h</span><br>' + skulls(a.dangerTier) + '</span>' +
      '<span class="ac-change">Wechseln ›</span>';
  }

  /* ---------- Setup: Ergebnis ---------- */
  var shown = { h: 50, a: 50 }, tweenId = 0;
  function tween(toH) {
    var from = shown.h, start = performance.now(), dur = 600, id = ++tweenId;
    $('barHuman').style.width = toH + '%';
    function step(t) {
      if (id !== tweenId) return;
      var k = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - k, 3);
      var h = from + (toH - from) * e;
      $('humanPct').textContent = E.fmtPct(h);
      $('animalPct').textContent = E.fmtPct(100 - h);
      if (k < 1) requestAnimationFrame(step); else shown.h = toH;
    }
    requestAnimationFrame(step);
  }
  var lastRes = null;
  function recompute() {
    var a = current();
    var human = { weight: state.weight, fitness: state.fitness, mindset: state.mindset, weapon: state.weapon };
    var r = E.compute(human, a, state.env);
    lastRes = r;
    tween(r.humanPct);
    $('factors').innerHTML = r.factors.map(function (f) {
      var plus = f.impact === '+';
      return '<li class="' + (plus ? 'plus' : 'minus') + '"><span class="sign">' + (plus ? '+' : '−') + '</span><span>' + esc(f.text) + '</span></li>';
    }).join('');
    renderCompare();
    save();
  }

  /* ---------- Setup: Parameter ---------- */
  function setFill() {
    var el = $('weight');
    el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%');
  }
  function buildSegment(id, items, key) {
    var root = $(id);
    root.innerHTML = items.map(function (it) { return '<button type="button" role="radio" data-v="' + it[0] + '">' + esc(it[1]) + '</button>'; }).join('');
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      state[key] = b.getAttribute('data-v'); markSelected(); recompute();
    });
  }
  function markSelected() {
    [['fitness', 'fitness'], ['mindset', 'mindset']].forEach(function (p) {
      $(p[0]).querySelectorAll('button').forEach(function (b) { var on = b.getAttribute('data-v') === state[p[1]]; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    });
    document.querySelectorAll('#weapon .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === state.weapon); });
    document.querySelectorAll('#env .chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-v') === state.env); });
  }
  function buildParams() {
    buildSegment('fitness', FITNESS, 'fitness');
    buildSegment('mindset', MINDSET, 'mindset');
    $('weapon').innerHTML = WEAPON_GROUPS.map(function (g) {
      return '<div class="wgroup"><div class="wgroup-title">' + g[0] + '</div><div class="chips">' +
        g[1].map(function (w) { return '<button type="button" class="chip" role="radio" data-v="' + w[0] + '">' + esc(w[1]) + '</button>'; }).join('') + '</div></div>';
    }).join('');
    $('weapon').addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      state.weapon = b.getAttribute('data-v'); markSelected(); recompute();
    });
    $('env').innerHTML = ENVS.map(function (e) {
      return '<button type="button" class="chip" role="radio" data-v="' + e[0] + '"><span>' + e[1] + ' ' + e[2] + '</span><span class="sub">' + e[3] + '</span></button>';
    }).join('');
    $('env').addEventListener('click', function (ev) {
      var b = ev.target.closest('.chip'); if (!b) return;
      state.env = b.getAttribute('data-v'); markSelected(); recompute();
    });
    var w = $('weight');
    w.value = state.weight; setFill(); $('weightOut').textContent = state.weight + ' kg';
    w.addEventListener('input', function () {
      state.weight = +w.value; $('weightOut').textContent = state.weight + ' kg'; setFill(); recompute();
    });
    markSelected();
  }

  /* ---------- Direktvergleich ---------- */
  function logPct(v, max) { return Math.max(3, Math.min(100, Math.log(1 + v) / Math.log(1 + max) * 100)); }
  function cmpRow(label, hv, av, hp, ap) {
    return '<div class="cmp-row"><div class="cmp-label">' + label + '</div><div class="cmp-line">' +
      '<div class="cmp-cell"><span class="cmp-val">' + hv + '</span><div class="cmp-track"><div class="cmp-fill h" style="width:' + hp + '%"></div></div></div>' +
      '<div class="cmp-cell r"><span class="cmp-val">' + av + '</span><div class="cmp-track"><div class="cmp-fill a" style="width:' + ap + '%"></div></div></div>' +
      '</div></div>';
  }
  function cmpText(label, ht, at) {
    return '<div class="cmp-row"><div class="cmp-label">' + label + '</div><div class="cmp-line"><div class="cmp-text">' + esc(ht) + '</div><div class="cmp-text" style="text-align:right">' + esc(at) + '</div></div></div>';
  }
  function renderCompare() {
    var a = current(), hs = E.humanSpeed(state.fitness), hb = 160;
    $('cmpName').textContent = a.emoji + ' ' + a.name;
    var mw = Math.max(state.weight, a.weight), mb = Math.max(hb, a.biteForce), ms = Math.max(hs, a.speed);
    var hw = E.humanWeaponLabel[state.weapon];
    $('compare').innerHTML =
      cmpRow('Gewicht', state.weight + ' kg', fmtKg(a.weight), logPct(state.weight, mw), logPct(a.weight, mw)) +
      cmpRow('Bisskraft (PSI)', hb, fmtNum(a.biteForce), logPct(hb, mb), logPct(a.biteForce, mb)) +
      cmpRow('Geschwindigkeit', hs + ' km/h', a.speed + ' km/h', hs / ms * 100, a.speed / ms * 100) +
      cmpText('Waffen', hw, weaponList(a)) +
      '<div class="cmp-row"><div class="cmp-label">Gefährlichkeit</div><div class="cmp-line"><div>' + skulls(state.weapon === 'unbewaffnet' ? 1 : state.weapon === 'grosskaliber' ? 4 : 2) + '</div><div style="text-align:right">' + skulls(a.dangerTier) + '</div></div></div>';
  }

  /* ---------- Tier-Picker ---------- */
  var FILTERS = [
    ['alle', 'Alle', function () { return true; }],
    ['raub', 'Raubtiere', function (a) { return ['raubkatzen', 'baeren', 'hundeartige'].indexOf(a.category) >= 0; }],
    ['schwer', 'Schwergewichte', function (a) { return a.weight >= 300; }],
    ['gift', 'Giftig', function (a) { return a.venom > 0; }],
    ['exot', 'Exoten', function (a) { return ['reptilien', 'wasser', 'insekten', 'voegel'].indexOf(a.category) >= 0; }]
  ];
  var pick = { q: '', filter: 'alle', cat: '' };
  var lex = { q: '', cat: '' };
  function matches(a, q) { return !q || (a.name + ' ' + (CAT_LABEL[a.category] || '')).toLowerCase().indexOf(q.toLowerCase()) >= 0; }
  function chipsHtml(items, active, attr) {
    return items.map(function (it) { return '<button type="button" class="chip' + (it[0] === active ? ' on' : '') + '" ' + attr + '="' + it[0] + '">' + esc(it[1]) + '</button>'; }).join('');
  }
  var catItems = Object.keys(CAT_LABEL).map(function (k) { return [k, CAT_LABEL[k]]; });

  function renderPick() {
    $('pickFilters').innerHTML = chipsHtml(FILTERS.map(function (f) { return [f[0], f[1]]; }), pick.filter, 'data-f');
    $('pickCats').innerHTML = chipsHtml([['', 'Alle Kategorien']].concat(catItems), pick.cat, 'data-c');
    var fn = FILTERS.filter(function (f) { return f[0] === pick.filter; })[0][2];
    var list = ANIMALS.filter(function (a) { return fn(a) && (!pick.cat || a.category === pick.cat) && matches(a, pick.q); });
    $('pickList').innerHTML = list.length ? list.map(function (a) {
      return '<button type="button" class="pick-row' + (a.id === state.animalId ? ' sel' : '') + '" data-id="' + esc(a.id) + '"><span class="emoji">' + esc(a.emoji) + '</span>' +
        '<span class="pr-body"><span class="pr-name">' + esc(a.name) + '</span><br><span class="pr-meta">' + esc(CAT_LABEL[a.category] || '') + ' · ' + fmtKg(a.weight) + ' · ' + a.speed + ' km/h</span></span>' + skulls(a.dangerTier) + '</button>';
    }).join('') : '<div class="empty">Kein Tier gefunden.</div>';
  }
  function openSheet() {
    $('sheetBackdrop').hidden = false; $('sheet').hidden = false;
    document.body.style.overflow = 'hidden';
    renderPick();
  }
  function closeSheet() { $('sheetBackdrop').hidden = true; $('sheet').hidden = true; document.body.style.overflow = ''; }
  function chooseAnimal(id) {
    state.animalId = id; save(); renderAnimalCard(); recompute(); renderSimSummary(); closeSheet();
  }
  $('animalCard').addEventListener('click', openSheet);
  $('sheetBackdrop').addEventListener('click', closeSheet);
  $('sheetClose').addEventListener('click', closeSheet);
  $('pickSearch').addEventListener('input', function (e) { pick.q = e.target.value; renderPick(); });
  $('pickFilters').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) { pick.filter = b.getAttribute('data-f'); renderPick(); } });
  $('pickCats').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) { pick.cat = b.getAttribute('data-c'); renderPick(); } });
  $('pickList').addEventListener('click', function (e) { var b = e.target.closest('[data-id]'); if (b) chooseAnimal(b.getAttribute('data-id')); });

  /* ---------- Lexikon ---------- */
  function renderLex() {
    $('lexCats').innerHTML = chipsHtml([['', 'Alle']].concat(catItems), lex.cat, 'data-c');
    var list = ANIMALS.filter(function (a) { return (!lex.cat || a.category === lex.cat) && matches(a, lex.q); });
    $('lexCount').textContent = list.length + ' von ' + ANIMALS.length + ' Tieren';
    $('lexGrid').innerHTML = list.length ? list.map(function (a) {
      return '<article class="lex-card"><div class="lex-top"><span class="emoji">' + esc(a.emoji) + '</span><div><div class="lex-name">' + esc(a.name) + '</div>' + skulls(a.dangerTier) + '</div></div>' +
        '<div class="lex-stats"><div class="stat"><b>' + fmtKg(a.weight) + '</b><span>Gewicht</span></div><div class="stat"><b>' + fmtNum(a.biteForce) + '</b><span>Biss PSI</span></div><div class="stat"><b>' + a.speed + '</b><span>km/h</span></div></div>' +
        '<p class="lex-desc">' + esc(a.description) + '</p><p class="lex-fact">💡 ' + esc(a.fact) + '</p>' +
        '<button type="button" class="btn fight" data-fight="' + esc(a.id) + '">Gegen dieses Tier kämpfen</button></article>';
    }).join('') : '<div class="empty">Kein Tier gefunden.</div>';
  }
  $('lexSearch').addEventListener('input', function (e) { lex.q = e.target.value; renderLex(); });
  $('lexCats').addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) { lex.cat = b.getAttribute('data-c'); renderLex(); } });
  $('lexGrid').addEventListener('click', function (e) {
    var b = e.target.closest('[data-fight]'); if (!b) return;
    state.animalId = b.getAttribute('data-fight'); save(); renderAnimalCard(); recompute(); setView('setup');
  });

  /* ---------- Simulation ---------- */
  var simBusy = false;
  function renderSimSummary() {
    var a = current(), r = lastRes || E.compute({ weight: state.weight, fitness: state.fitness, mindset: state.mindset, weapon: state.weapon }, a, state.env);
    $('simSummary').innerHTML =
      '<div class="sum-title"><span class="emoji">' + esc(a.emoji) + '</span><span>Du gegen ' + esc(a.name) + '</span></div>' +
      '<div class="sum-line"><b>' + state.weight + ' kg</b> · ' + esc(FIT_NAME[state.fitness]) + ' · ' + esc(MIND_NAME[state.mindset]) + '</div>' +
      '<div class="sum-line">' + esc(WEAPON_NAME[state.weapon]) + ' · ' + esc(ENV_NAME[state.env]) + '</div>' +
      '<div class="sum-line">Berechnete Chance: <b style="color:var(--human)">Mensch ' + E.fmtPct(r.humanPct) + '</b> / <b style="color:var(--animal)">Tier ' + E.fmtPct(r.animalPct) + '</b></div>';
  }
  function runSim(n) {
    if (simBusy) return;
    simBusy = true;
    $('sim100').disabled = $('sim1000').disabled = true;
    $('simEmpty').hidden = true; $('simOut').hidden = false; $('simOut').classList.add('running');
    $('simTitle').textContent = n.toLocaleString('de-DE') + ' Kämpfe laufen …';
    $('samples').innerHTML = ''; $('dotsLegend').textContent = '';
    var dots = $('dots'); dots.innerHTML = '';
    for (var i = 0; i < 100; i++) { var d = document.createElement('span'); d.className = 'dot'; dots.appendChild(d); }
    var tick = setInterval(function () {
      var h = Math.floor(Math.random() * n);
      $('simCounter').innerHTML = counterHtml(h, n - h);
      $('simBarH').style.width = (h / n * 100) + '%';
    }, 70);
    setTimeout(function () {
      clearInterval(tick);
      var human = { weight: state.weight, fitness: state.fitness, mindset: state.mindset, weapon: state.weapon };
      var res = E.simulate(human, current(), state.env, n);
      finishSim(res, n);
    }, n >= 1000 ? 1500 : 1000);
  }
  function counterHtml(h, a) {
    return '<div class="h"><small>Mensch gewinnt</small><strong>' + h.toLocaleString('de-DE') + '</strong></div><div class="a"><small>Tier gewinnt</small><strong>' + a.toLocaleString('de-DE') + '</strong></div>';
  }
  function finishSim(res, n) {
    $('simOut').classList.remove('running');
    $('simTitle').textContent = n.toLocaleString('de-DE') + ' Kämpfe · ' + current().name;
    $('simCounter').innerHTML = counterHtml(res.humanWins, res.animalWins);
    $('simBarH').style.width = (res.humanWins / n * 100) + '%';
    var per = n / 100, hDots = Math.round(res.humanWins / per);
    if (res.humanWins > 0 && hDots === 0) hDots = 1;
    if (res.animalWins > 0 && hDots === 100) hDots = 99;
    var nodes = $('dots').children;
    for (var i = 0; i < 100; i++) {
      nodes[i].className = 'dot ' + (i < hDots ? 'h' : 'a');
      nodes[i].style.transitionDelay = (i * 8) + 'ms';
    }
    requestAnimationFrame(function () { requestAnimationFrame(function () { for (var j = 0; j < 100; j++) nodes[j].classList.add('show'); }); });
    $('dotsLegend').textContent = '1 Punkt = ' + (per === 1 ? '1 Kampf' : per + ' Kämpfe') + ' · türkis: Mensch, orange: Tier';
    var smp = res.samples.slice();
    var majority = res.humanWins >= res.animalWins ? 'mensch' : 'tier';
    var maj = smp.filter(function (s) { return s.winner === majority; }), min = smp.filter(function (s) { return s.winner !== majority; });
    var show = maj.slice(0, 2).concat(min.slice(0, 1));
    if (show.length < 3) show = show.concat(maj.slice(2, 2 + (3 - show.length)));
    show.sort(function (a, b) { return a.nr - b.nr; });
    $('samples').innerHTML = show.map(function (s) {
      return '<li class="' + s.winner + '"><span class="who">' + (s.winner === 'mensch' ? 'Mensch gewinnt' : 'Tier gewinnt') + '</span>' + esc(s.text) + '</li>';
    }).join('');
    simBusy = false;
    $('sim100').disabled = $('sim1000').disabled = false;
  }
  $('sim100').addEventListener('click', function () { runSim(100); });
  $('sim1000').addEventListener('click', function () { runSim(1000); });

  /* ---------- Start ---------- */
  buildParams();
  renderAnimalCard();
  recompute();
  renderSimSummary();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ }); });
  }
})();
