/* Mensch vs. Tier – Entscheidungs-Kampfspiel "Überlebenskampf" (global window.Game)
   Teil 1: Spiellogik (ohne DOM, testbar)  ·  Teil 2: UI (nur wenn document existiert) */
(function (root) {
  'use strict';

  var E = root.Engine;
  function R() { return Math.random(); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function num(x, d) { x = +x; return isFinite(x) ? x : d; }
  function pick(arr) { return arr[Math.floor(R() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function animals() { return root.ANIMALS || []; }
  function items() { return root.ITEMS || []; }
  function itemById(id) { var L = items(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }

  /* ---------- Konstanten (zum Kalibrieren) ---------- */
  var C = {
    humanHP: 100,
    maxRounds: 6,
    animalHpBase: 12, animalHpLog: 28,          // HP = base + log * log10(Gewicht + 1)
    tierDmg: [0, 4, 9, 19, 28, 40],             // Grundschaden des Tiers nach dangerTier
    humanDmgBase: 7, humanDmgPerAtk: 1.8,
    hitFloor: 0.2, hitSpan: 0.62,              // Trefferchance = floor + span * sqrt(Engine-Chance)
    mm: { strong: 1.5, weak: 0.5 }
  };
  var RARITY_W = { gewoehnlich: 10, selten: 5, episch: 2, legendaer: 0.6 };
  var RARITY_ORDER = { gewoehnlich: 0, selten: 1, episch: 2, legendaer: 3 };

  /* ---------- Kampforte ---------- */
  var PLACES = [
    { id: 'feld', name: 'Offenes Feld', emoji: '🌾', real: true, env: 'feld', text: 'Weit und breit nichts, wohinter man sich verstecken könnte.', mods: {} },
    { id: 'wald', name: 'Dichter Wald', emoji: '🌲', real: true, env: 'wald', text: 'Viele Bäume, wenig Netz.', mods: {} },
    { id: 'savanne', name: 'Savanne', emoji: '🦒', real: true, env: 'savanne', text: 'Hohes Gras, in dem sich alles Mögliche verstecken kann.', mods: {} },
    { id: 'fluss', name: 'Flussufer', emoji: '🌊', real: true, env: 'wasser', text: 'Matschig, rutschig, nass.', mods: {} },
    { id: 'geroell', name: 'Geröllhang', emoji: '⛰️', real: true, env: 'gebirge', text: 'Steine gibt es hier im Überfluss, Halt eher nicht.', mods: {} },
    { id: 'ikea', name: 'IKEA-Möbelhaus', emoji: '🛋️', env: 'feld', text: 'Das Tier verirrt sich im Pfeilsystem. Du übrigens auch.', mods: { animalFlee: 0.15, escape: 0.25 } },
    { id: 'ubahn', name: 'Münchner U-Bahn zur Rush Hour', emoji: '🚇', env: 'feld', text: 'Die Pendler ignorieren das Tier. Und dich. Man ist hier Kummer gewohnt.', mods: { animalHit: 0.75, humanHit: 0.9, escape: 0.1 } },
    { id: 'bierzelt', name: 'Oktoberfest-Bierzelt', emoji: '🍺', env: 'feld', text: 'Die Blaskapelle spielt, die Maß ist schwer, der Lärm ist enorm.', mods: { scare: 0.25, humanHit: 0.95 } },
    { id: 'huepfburg', name: 'Hüpfburg', emoji: '🏰', env: 'feld', text: 'Alle Treffer federn ab. Niemand kann hier richtig stehen.', mods: { dmg: 0.5 } },
    { id: 'freibad', name: 'Freibad-Nichtschwimmerbecken', emoji: '🏊', env: 'wasser', text: 'Hüfthoch, gechlort, mit Bademeister, der nur beim Rutschen pfeift.', mods: { escape: 0.1 } },
    { id: 'kuehlregal', name: 'Supermarkt-Kühlregal', emoji: '🧊', env: 'feld', text: 'Überall Essen. Das Tier hat plötzlich andere Prioritäten.', mods: { distract: 0.3 } },
    { id: 'wertstoff', name: 'Wertstoffhof', emoji: '♻️', env: 'gebirge', text: 'Schrott, Steine, Sperrmüll. Alles Waffen, wenn man will.', mods: { humanHit: 1.1, humanDmg: 1.15 } }
  ];
  function modOf(place, key, neutral) { var v = place && place.mods ? place.mods[key] : undefined; return v == null ? neutral : v; }

  /* ---------- Witzige Aktionen ---------- */
  var FUNNY = [
    { id: 'totstellen', emoji: '💀', label: 'Tot stellen', effect: 'leave', base: 0.12, ids: { grizzly: 0.6, schwarzbaer: 0.08, eisbaer: -1, lippenbaer: 0.3 },
      ok: 'Du fällst um und stellst dich tot. Das Tier verliert das Interesse und zieht ab.', fail: 'Du liegst im Dreck und stellst dich tot. Das Tier findet das nur mäßig überzeugend.' },
    { id: 'mietpreise', emoji: '🏠', label: 'Über Mietpreise in München diskutieren', effect: 'distract', base: 0.1, cat: { primaten: 0.2 },
      ok: 'Du erwähnst 24 Euro pro Quadratmeter. Das Tier starrt ins Leere und braucht einen Moment.', fail: 'Das Tier kann sich Miete in München auch nicht leisten, aber es interessiert sich trotzdem nicht dafür.' },
    { id: 'servus', emoji: '📣', label: 'Laut "Servus" rufen', effect: 'scare', base: 0.18, cat: { huftiere: 0.1, voegel: 0.1 },
      ok: 'Dein "SERVUS!" hallt durch die Gegend. Das Tier sucht das Weite.', fail: 'Das Tier versteht kein Bairisch. Es versteht aber, dass du laut bist.' },
    { id: 'tiktok', emoji: '🕺', label: 'TikTok-Tanz', effect: 'distract', base: 0.14, cat: { primaten: 0.25, voegel: 0.1 },
      ok: 'Du tanzt. Das Tier schaut zu, wie man einem Unfall zuschaut, und vergisst kurz, was es wollte.', fail: 'Dein Tanz endet mit einer Zerrung. Das Tier hat keine Wertung abgegeben.' },
    { id: 'steuer', emoji: '📞', label: 'Steuerberater anrufen', effect: 'scare', base: 0.1,
      ok: 'Du sagst laut "Nachzahlung". Das Tier erschrickt sichtlich und läuft davon.', fail: 'Der Steuerberater hebt nicht ab. Wie immer im Quartalsabschluss.' },
    { id: 'bairisch', emoji: '🤬', label: 'Bayerisch schimpfen', effect: 'scare', base: 0.22, cat: { hundeartige: 0.1, huftiere: 0.1 },
      ok: 'Du schimpfst in vollem Dialekt, das Tier versteht kein Wort, aber den Ton, und flüchtet.', fail: 'Du schimpfst, bis dir die Luft ausgeht. Das Tier hört geduldig zu.' },
    { id: 'groesser', emoji: '🙆', label: 'Sich größer machen', effect: 'scare', base: 0.28, cat: { baeren: 0.15, raubkatzen: 0.1 }, heavyPenalty: 0.2,
      ok: 'Du streckst die Arme in die Höhe und siehst kurz aus wie zwei Menschen. Das Tier wählt die Vernunft.', fail: 'Du machst dich größer. Das Tier ist trotzdem noch größer.' },
    { id: 'brotzeit', emoji: '🥨', label: 'Brotzeit anbieten', effect: 'distract', base: 0.28, cat: { hundeartige: 0.25, baeren: 0.1, nagetiere: 0.15, voegel: 0.1 },
      ok: 'Du wirfst eine Leberkässemmel. Das Tier hat ab sofort andere Pläne.', fail: 'Das Tier verschmäht die Brotzeit. Wahrscheinlich Veganer.' },
    { id: 'zureden', emoji: '🗣️', label: 'Ruhig zureden', effect: 'stun', base: 0.22, aggr: true,
      ok: 'Du redest sanft auf das Tier ein. Es beruhigt sich kurz und gähnt.', fail: 'Du sagst "Ganz ruhig". Das Tier hört "Mittagessen".' },
    { id: 'rueckwaerts', emoji: '🚶', label: 'Langsam rückwärts gehen', effect: 'escape', base: 0.3, speedPenalty: true, onFail: 'enrage',
      ok: 'Du gehst Schritt für Schritt rückwärts. Das Tier lässt dich ziehen.', fail: 'Rückwärtsgehen und Stolpern ist nahezu dasselbe. Das Tier nimmt das als Einladung.' },
    { id: 'handy', emoji: '📱', label: 'Ins Handy schauen', effect: 'distract', base: 0.06,
      ok: 'Du scrollst demonstrativ durch Mails. Das Tier fühlt sich übergangen und wendet sich ab.', fail: 'Kein Empfang. Das Tier schon.' },
    { id: 'formular', emoji: '📝', label: 'Formular in dreifacher Ausfertigung', effect: 'stun', base: 0.15,
      ok: 'Du reichst ein Formular zum Ausfüllen. Das Tier erstarrt vor Bürokratie.', fail: 'Das Tier legt das Formular ungelesen zu den Akten.' },
    { id: 'tourist', emoji: '📷', label: 'Als Tourist ausgeben', effect: 'distract', base: 0.13,
      ok: 'Du sagst "Hello, where is Marienplatz?". Das Tier ist irritiert und schaut zur Seite.', fail: 'Das Tier erkennt Touristen sofort. Es liebt Touristen.' },
    { id: 'kiai', emoji: '🥋', label: 'Karate-Schrei', effect: 'scare', base: 0.16, small: 0.2, heavyPenalty: 0.1,
      ok: 'Du brüllst "HAAIIYAA". Das Tier hält dich für gefährlicher, als du bist.', fail: 'Du brüllst, ziehst dir dabei aber einen Muskel. Das Tier hebt eine Augenbraue.' },
    { id: 'wlan', emoji: '📶', label: 'Nach dem WLAN-Passwort fragen', effect: 'nothing', base: 0.0,
      ok: '', fail: 'Das Tier kennt das Passwort nicht. Es sieht dich an, als ob es dich fressen will.' },
    { id: 'blickkontakt', emoji: '🙈', label: 'Blickkontakt meiden', effect: 'stun', base: 0.2, cat: { raubkatzen: -0.1 },
      ok: 'Du schaust demonstrativ in die Landschaft. Das Tier fühlt sich nicht gemeint und zögert.', fail: 'Du schaust weg, das Tier schaut nicht weg.' }
  ];
  function funnyChance(f, a) {
    if (f.ids && f.ids[a.id] != null) return f.ids[a.id];
    var p = f.base;
    if (f.cat && f.cat[a.category]) p += f.cat[a.category];
    if (f.small && a.weight < 30) p += f.small;
    if (f.heavyPenalty && a.weight > 300) p -= f.heavyPenalty;
    if (f.speedPenalty) p -= num(a.speed, 30) / 400;
    if (f.aggr) p -= num(a.aggression, 5) * 0.015;
    return clamp(p, 0, 0.85);
  }

  /* ---------- Textbausteine ---------- */
  var ANIMAL_VERB = {
    klauen: ['schlägt mit den Krallen nach dir', 'kratzt dich quer über den Arm'],
    reisszaehne: ['schnappt nach dir', 'beißt in deine Jacke und in das, was darunter ist'],
    wuergen: ['packt dich im Würgegriff', 'drückt dich bedenklich fest zusammen'],
    hoerner: ['nimmt dich auf die Hörner', 'rammt dich mit gesenktem Kopf'],
    tritte: ['tritt dich mit beiden Hinterbeinen', 'verpasst dir einen Huftritt'],
    schnabel: ['hackt mit dem Schnabel nach dir', 'pickt dich unangenehm'],
    stacheln: ['pikst dich mit den Stacheln', 'rammt dir ein paar Stacheln in die Kleidung'],
    masse: ['walzt einfach über dich drüber', 'schubst dich mit seinem Gewicht um'],
    todesrolle: ['reißt dich in einer Drehung zu Boden', 'dreht dich einmal komplett durch'],
    schlaege: ['haut dir eine runter', 'verpasst dir einen Schlag'],
    gift: ['erwischt dich mit einem giftigen Stich', 'beißt zu, und es brennt bedenklich']
  };
  var T = {
    hitIntro: ['Du triffst', 'Dein Hieb sitzt', 'Treffer', 'Das saß'],
    hitTail: ['Das Tier sieht überrascht aus.', 'Das Tier schüttelt sich verärgert.', 'Das Tier hat damit nicht gerechnet.', 'Das Tier wirft dir einen strengen Blick zu.'],
    miss: ['Du verfehlst das Tier um Haaresbreite.', 'Dein Schlag trifft nur Luft.', 'Du rutschst aus. Gut für das Selbstbewusstsein des Tieres.', 'Das Tier weicht aus und wirkt amüsiert.'],
    dodge: ['Du hechtest zur Seite.', 'Du machst einen eleganten Schritt nach hinten.', 'Du duckst dich weg und siehst dabei erstaunlich geübt aus.'],
    aHit: ['Das Tier {verb}.', 'Dein Gegner {verb}.', 'Zack: Das Tier {verb}.'],
    aMiss: ['Das Tier verfehlt dich knapp.', 'Der Angriff geht ins Leere.', 'Das Tier stolpert über die eigenen Füße.', 'Du bist einen Moment lang schneller als dein Gegner.'],
    stunned: ['Das Tier ist noch benommen und setzt aus.', 'Das Tier braucht kurz, um sich zu sortieren.'],
    dodged: ['Das Tier greift an, aber du bist nicht mehr da.', 'Der Angriff geht ins Leere.', 'Das Tier erwischt nur noch deinen Schatten.'],
    animalFlees: ['Das Tier hat genug und verschwindet.', 'Das Tier dreht sich um und trollt sich.', 'Das Tier verlässt das Gelände mit erhobenem Schwanz oder was davon übrig ist.'],
    bored: ['Das Tier verliert die Lust.', 'Das Tier gähnt und schaut auf die Uhr, die es nicht trägt.']
  };
  function fill(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] != null ? o[k] : m; }); }
  function animalVerb(a) {
    var ws = (a.weapons || []).filter(function (w) { return ANIMAL_VERB[w]; });
    if (!ws.length) return 'greift dich an';
    return pick(ANIMAL_VERB[pick(ws)]);
  }

  var END_TEXT = {
    kill: ['Dein Gegner ist k.o. und wird später vom Förster abgeholt. Du hast gewonnen.', 'Dein Gegner gibt auf. Du stehst noch, das zählt.'],
    flee: ['Das Tier hat genug von dir und macht sich aus dem Staub. Das zählt als Sieg.', 'Dein Gegner flüchtet. Du bist, rein formal, der Sieger.'],
    giveup: ['Das Tier gibt auf und schaut beleidigt weg. Du hast gewonnen, nach Punkten.', 'Nach sechs Runden hat das Tier die Nase voll. Punktsieg.'],
    escape: ['Du bist entkommen. Du erzählst es später lieber anders.', 'Geschafft: Du bist weg, bevor jemand merkt, dass du je da warst.'],
    bored: ['Das Tier verliert das Interesse. Du auch. Man geht getrennte Wege.', 'Nach sechs Runden gähnt das Tier und geht. Unentschieden, aber du lebst.'],
    lose: ['Du wachst im Krankenhaus Rechts der Isar auf. Neben dir: ein Obstkorb und ein Formular in dreifacher Ausfertigung.', 'Du wachst in der Notaufnahme auf. Die Wartezeit war länger als der Kampf.', 'Du wachst im Klinikum Großhadern auf. Die Schwester sagt: "Schon wieder ein Tier?"']
  };

  /* ---------- Würfeln: Gegner, Orte, Gegenstände ---------- */
  function rollOpponents() {
    var all = animals();
    var easy = all.filter(function (a) { return a.dangerTier <= 1; });
    var hard = all.filter(function (a) { return a.dangerTier >= 5 && a.weight >= 150; });
    var mid = all.filter(function (a) { return a.dangerTier >= 2 && a.dangerTier <= 4; });
    var out = [];
    function add(list) {
      var l = list.filter(function (a) { return out.indexOf(a) < 0; });
      if (!l.length) l = all.filter(function (a) { return out.indexOf(a) < 0; });
      if (l.length) out.push(pick(l));
    }
    add(easy); add(hard); add(mid);
    return shuffle(out);
  }
  function rollPlaces() { return shuffle(PLACES).slice(0, 3); }

  function weightedPick(list) {
    var tot = 0, i;
    for (i = 0; i < list.length; i++) tot += RARITY_W[list[i].rarity] || 1;
    var r = R() * tot;
    for (i = 0; i < list.length; i++) { r -= RARITY_W[list[i].rarity] || 1; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function wTake(list, n, exclude) {
    var pool = list.filter(function (x) { return exclude.indexOf(x) < 0; }), out = [];
    while (out.length < n && pool.length) { var it = weightedPick(pool); out.push(it); pool.splice(pool.indexOf(it), 1); }
    return out;
  }
  /* unlockedIds: Array. Ergebnis: [{item, loan}] mit 3 Einträgen (bei genug Daten) */
  function rollItems(unlockedIds) {
    var all = items();
    var un = all.filter(function (x) { return unlockedIds.indexOf(x.id) >= 0; });
    var locked = all.filter(function (x) { return unlockedIds.indexOf(x.id) < 0; });
    var chosen = wTake(un, 3, []).map(function (x) { return { item: x, loan: false }; });
    // 1 gesperrter als Leihgabe (30 %), oder wenn zu wenig freigeschaltet
    if (locked.length && (R() < 0.3 || chosen.length < 3)) {
      var chosenItems = chosen.map(function (c) { return c.item; });
      var loan = wTake(locked, 1, chosenItems)[0];
      if (loan) { if (chosen.length >= 3) chosen.splice(Math.floor(R() * chosen.length), 1); chosen.push({ item: loan, loan: true }); }
    }
    // mindestens 1 witziger
    if (!chosen.some(function (c) { return c.item.funny; })) {
      var used = chosen.map(function (c) { return c.item; });
      var f = wTake(un.filter(function (x) { return x.funny; }), 1, used)[0], isLoan = false;
      if (!f) { f = wTake(locked.filter(function (x) { return x.funny; }), 1, used)[0]; isLoan = true; }
      if (f) { if (chosen.length >= 3) chosen.splice(Math.floor(R() * chosen.length), 1); chosen.push({ item: f, loan: isLoan }); }
    }
    return shuffle(chosen);
  }

  /* ---------- Kampf ---------- */
  function animalHP(a) { return Math.round(C.animalHpBase + C.animalHpLog * Math.log(num(a.weight, 1) + 1) / Math.LN10); }
  function mmFor(item, a) {
    if (item.strongVs && item.strongVs.indexOf(a.category) >= 0) return C.mm.strong;
    if (item.weakVs && item.weakVs.indexOf(a.category) >= 0) return C.mm.weak;
    return 1;
  }
  function baseChance(item, a, place) {
    var w = item.baseWeapon || 'unbewaffnet';
    var r;
    try { r = E.compute({ weight: 80, fitness: 'durchschnitt', mindset: 'normal', weapon: w }, a, place.env); } catch (e) { r = null; }
    var p = r ? num(r.humanPct, 5) / 100 : 0.05;
    return clamp(p, 0.005, 0.995);
  }
  function startBattle(animal, place, item, loan) {
    var it = {
      id: item.id, name: item.name, emoji: item.emoji, funny: !!item.funny,
      attack: clamp(num(item.attack, 0), 0, 10), defense: clamp(num(item.defense, 0), 0, 10),
      usesLeft: clamp(Math.floor(num(item.uses, 1)), 0, 3), special: item.special || null, src: item
    };
    var ahp = animalHP(animal);
    return {
      animal: animal, place: place, item: it, loan: !!loan,
      round: 0, maxRounds: C.maxRounds, hp: C.humanHP, hpMax: C.humanHP, ahp: ahp, ahpMax: ahp,
      base: baseChance(item, animal, place), mm: mmFor(item, animal),
      stun: 0, enraged: false, dodging: false, funnyWins: 0, funnyUsed: 0,
      log: [], over: false, outcome: null, reason: null, endText: null,
      dmgToAnimal: 0, dmgToHuman: 0
    };
  }
  function roundActions(b) {
    var out = [
      { id: 'attack', emoji: '⚔️', label: 'Angreifen', sub: 'Trefferchance ' + Math.round(hitChance(b) * 100) + ' %' },
      { id: 'dodge', emoji: '🤸', label: 'Ausweichen', sub: 'Gegenangriff schwerer' }
    ];
    var funnies = shuffle(FUNNY);
    if (b.item.special && b.item.usesLeft > 0) {
      out.push({ id: 'special', emoji: b.item.emoji, label: b.item.special.label || 'Spezial', sub: b.item.name + ' · noch ' + b.item.usesLeft + 'x', special: true });
    } else {
      var f2 = funnies.shift(); out.push({ id: 'f:' + f2.id, emoji: f2.emoji, label: f2.label, sub: 'Witzige Aktion', funny: true });
    }
    var f = funnies.shift();
    out.push({ id: 'f:' + f.id, emoji: f.emoji, label: f.label, sub: 'Witzige Aktion', funny: true });
    return shuffle(out);
  }
  function hitChance(b) {
    var p = clamp(b.base * (1 + (b.mm - 1) * 0.5), 0.005, 0.995);
    return clamp((C.hitFloor + C.hitSpan * Math.sqrt(p)) * modOf(b.place, 'humanHit', 1), 0.1, 0.92);
  }
  function humanDamage(b, bonusMult) {
    var d = (C.humanDmgBase + b.item.attack * C.humanDmgPerAtk) * (0.8 + 0.4 * R()) * b.mm;
    // Schusswaffen: ein sitzender Treffer wirkt ungleich stärker als jeder Schlag
    var fw = { grosskaliber: 2.2, kleinkaliber: 1.3 }[b.item.src.baseWeapon];
    if (fw) d *= fw;
    d *= (1 - 0.4 * num(b.animal.armor, 0));
    d *= modOf(b.place, 'dmg', 1) * modOf(b.place, 'humanDmg', 1) * (bonusMult || 1);
    return Math.max(1, Math.round(d));
  }
  function animalDamage(b) {
    var a = b.animal;
    var d = C.tierDmg[clamp(a.dangerTier, 1, 5)] * (0.75 + 0.5 * R());
    var dm = 1 - clamp(b.item.defense * 0.035 * (b.mm > 1 ? 1.3 : b.mm < 1 ? 0.6 : 1), 0, 0.5);
    d *= dm * modOf(b.place, 'dmg', 1) * modOf(b.place, 'animalDmg', 1);
    return Math.max(1, Math.round(d));
  }
  function animalHitChance(b) {
    var a = b.animal;
    var p = 0.38 + num(a.aggression, 5) * 0.04 + num(a.agility, 5) * 0.01 - b.item.defense * 0.012;
    p *= modOf(b.place, 'animalHit', 1);
    if (b.enraged) p *= 1.3;
    if (b.dodging) p *= clamp(0.55 - (num(a.agility, 5) - 5) * 0.03 - b.item.defense * 0.015, 0.2, 0.8);
    return clamp(p, 0.08, 0.92);
  }
  function escapeChance(b, power) {
    var a = b.animal;
    return clamp(0.25 + power * 0.5 - num(a.speed, 30) / 220 - (a.climbs ? 0.08 : 0) + modOf(b.place, 'escape', 0), 0.05, 0.92);
  }

  function finishBattle(b, outcome, reason, text) { b.over = true; b.outcome = outcome; b.reason = reason; b.endText = text; }

  /* Spieleraktion ausführen; liefert {lines:[...], dmgA, dmgH, over} */
  function act(b, actionId) {
    if (b.over) return { lines: [], dmgA: 0, dmgH: 0, over: true };
    var a = b.animal, lines = [], hpBefore = b.hp, aBefore = b.ahp;
    b.round++;
    b.dodging = false;
    var res = { leave: false };
    var itemName = b.item.name;

    if (actionId === 'attack') {
      if (R() < hitChance(b)) {
        var d = humanDamage(b);
        b.ahp = Math.max(0, b.ahp - d);
        lines.push(pick(T.hitIntro) + ' mit ' + itemName + ': ' + d + ' Schaden. ' + pick(T.hitTail));
      } else lines.push(pick(T.miss));
    } else if (actionId === 'dodge') {
      b.dodging = true;
      lines.push(pick(T.dodge));
    } else if (actionId === 'special') {
      doSpecial(b, lines, res);
    } else if (actionId.indexOf('f:') === 0) {
      doFunny(b, actionId.slice(2), lines, res);
    }

    /* Ausgang prüfen */
    if (b.ahp <= 0) {
      finishBattle(b, 'sieg', 'kill', pick(END_TEXT.kill));
    } else if (res.leave === 'animal') {
      finishBattle(b, 'sieg', 'flee', pick(END_TEXT.flee));
    } else if (res.leave === 'human') {
      finishBattle(b, 'geflohen', 'escape', pick(END_TEXT.escape));
    }

    /* Tier flieht bei niedriger HP */
    if (!b.over && b.ahp / b.ahpMax < (a.dangerTier <= 2 ? 0.6 : 0.4) && R() < num(a.fleeTendency, 0.3) * 0.55 + modOf(b.place, 'animalFlee', 0)) {
      lines.push(pick(T.animalFlees));
      finishBattle(b, 'sieg', 'flee', pick(END_TEXT.flee));
    }
    /* Tier flieht durch Ortseffekt (z.B. IKEA) */
    if (!b.over && modOf(b.place, 'animalFlee', 0) > 0 && R() < modOf(b.place, 'animalFlee', 0) * 0.35) {
      lines.push('Das Tier hat sich im Ort verlaufen und ist weg.');
      finishBattle(b, 'sieg', 'flee', pick(END_TEXT.flee));
    }

    /* Gegenangriff */
    if (!b.over) {
      if (b.stun > 0) { b.stun--; lines.push(pick(T.stunned)); }
      else {
        if (R() < animalHitChance(b)) {
          var dd = animalDamage(b);
          b.hp = Math.max(0, b.hp - dd);
          lines.push(fill(pick(T.aHit), { verb: animalVerb(a) }).replace('Dein Gegner ' + 'Dein', 'Dein') + ' (−' + dd + ' HP)');
        } else lines.push(b.dodging ? pick(T.dodged) : pick(T.aMiss));
      }
      b.enraged = false;
      if (b.hp <= 0) finishBattle(b, 'verloren', 'ko', pick(END_TEXT.lose));
    }
    /* Zeitlimit */
    if (!b.over && b.round >= b.maxRounds) {
      lines.push(pick(T.bored));
      if (b.ahp / b.ahpMax < Math.min(0.5 + (5 - clamp(a.dangerTier, 1, 5)) * 0.12, b.hp / b.hpMax + (a.dangerTier <= 2 ? 0.25 : 0))) finishBattle(b, 'sieg', 'giveup', pick(END_TEXT.giveup));
      else finishBattle(b, 'geflohen', 'bored', pick(END_TEXT.bored));
    }
    b.dmgToAnimal = aBefore - b.ahp; b.dmgToHuman = hpBefore - b.hp;
    b.log.push({ round: b.round, lines: lines });
    return { lines: lines, dmgA: aBefore - b.ahp, dmgH: hpBefore - b.hp, over: b.over };
  }

  function doSpecial(b, lines, res) {
    var a = b.animal, sp = b.item.special || {}, eff = sp.effect || 'nothing', pw = clamp(num(sp.power, 0.5), 0, 1), mm = b.mm;
    var intro = sp.text || (b.item.name + ' kommt zum Einsatz.');
    b.item.usesLeft--;
    var ok;
    switch (eff) {
      case 'stun':
        ok = R() < clamp((0.3 + pw * 0.55) * mm - num(a.agility, 5) * 0.015, 0.08, 0.92);
        if (ok) { b.stun = 1; lines.push(intro + ' Das Tier ist benommen.'); } else lines.push(intro + ' Das Tier lässt sich davon nicht beeindrucken.');
        break;
      case 'scare':
        ok = R() < clamp((0.15 + pw * 0.5 + num(a.fleeTendency, 0.3) * 0.5 + modOf(b.place, 'scare', 0)) * mm - num(a.aggression, 5) * 0.03, 0.05, 0.9);
        if (ok) { res.leave = 'animal'; lines.push(intro + ' Das Tier ergreift die Flucht.'); } else lines.push(intro + ' Das Tier zuckt nur kurz mit den Ohren.');
        break;
      case 'distract':
        ok = R() < clamp((0.25 + pw * 0.45 + num(a.fleeTendency, 0.3) * 0.2 + modOf(b.place, 'distract', 0)) * mm, 0.05, 0.9);
        if (ok) {
          if (R() < 0.3 + 0.5 * num(a.fleeTendency, 0.3)) { res.leave = 'animal'; lines.push(intro + ' Das Tier verliert das Interesse an dir und geht seiner Wege.'); }
          else { b.stun = 1; lines.push(intro + ' Das Tier ist abgelenkt.'); }
        } else lines.push(intro + ' Das Tier ignoriert es und bleibt bei dir.');
        break;
      case 'heal': {
        var amt = Math.max(8, Math.round(pw * 50 * (1 + modOf(b.place, 'heal', 0))));
        var before = b.hp; b.hp = Math.min(b.hpMax, b.hp + amt);
        lines.push(intro + ' (+' + (b.hp - before) + ' HP)');
        break;
      }
      case 'escape':
        ok = R() < clamp(escapeChance(b, pw) * (1 + (mm - 1) * 0.5), 0.05, 0.92);
        if (ok) { res.leave = 'human'; lines.push(intro + ' Du bist weg.'); } else lines.push(intro + ' Das Tier ist schneller, als du dachtest.');
        break;
      case 'damage':
        if (R() < clamp(0.55 + pw * 0.3, 0.3, 0.92) * modOf(b.place, 'humanHit', 1)) {
          var d = Math.max(3, Math.round(pw * 40 * mm * (1 - 0.3 * num(a.armor, 0)) * modOf(b.place, 'dmg', 1)));
          b.ahp = Math.max(0, b.ahp - d);
          lines.push(intro + ' ' + d + ' Schaden.');
        } else lines.push(intro + ' Leider daneben.');
        break;
      default:
        lines.push(intro + ' Es passiert: nichts.');
    }
  }

  function doFunny(b, fid, lines, res) {
    var f = null, i;
    for (i = 0; i < FUNNY.length; i++) if (FUNNY[i].id === fid) f = FUNNY[i];
    if (!f) { lines.push('Du stehst unschlüssig herum.'); return; }
    var a = b.animal, p = funnyChance(f, a);
    b.funnyUsed++;
    var ok = p > 0 && R() < p;
    if (ok) {
      b.funnyWins++;
      lines.push(f.ok);
      if (f.effect === 'leave' || f.effect === 'scare') res.leave = 'animal';
      else if (f.effect === 'distract') { if (R() < 0.25 + 0.5 * num(a.fleeTendency, 0.3)) { res.leave = 'animal'; lines.push('Das Tier geht seiner Wege.'); } else b.stun = 1; }
      else if (f.effect === 'stun') b.stun = 1;
      else if (f.effect === 'escape') res.leave = 'human';
    } else {
      lines.push(f.fail);
      if (f.onFail === 'enrage' || p < 0) b.enraged = true;
      if (p === -1 || (f.ids && f.ids[a.id] === -1)) { b.enraged = true; lines.push('Das Tier mag es gar nicht, wenn man sich tot stellt: Für den Eisbär wirkst du wie Abendessen.'); }
    }
  }

  /* ---------- Punkte & Freischaltung ---------- */
  function score(b) {
    var tier = clamp(b.animal.dangerTier, 1, 5);
    var bonus = 1 + (b.item.funny ? 0.5 : 0) + 0.1 * b.funnyWins;
    var mult = b.outcome === 'sieg' ? 1 : b.outcome === 'geflohen' ? 0.4 : 0;
    var base = b.outcome === 'verloren' ? tier * 5 : tier * Math.max(b.hp, 1) * mult;
    return Math.round(base * bonus);
  }
  function pickUnlock(b, unlockedIds) {
    var locked = items().filter(function (x) { return unlockedIds.indexOf(x.id) < 0; });
    if (!locked.length) return null;
    if (b.outcome === 'sieg' && b.animal.dangerTier >= 4 && R() < 0.5) {
      var top = locked.filter(function (x) { return x.rarity === 'episch' || x.rarity === 'legendaer'; });
      if (top.length) return pick(top);
    }
    return weightedPick(locked.map(function (x) { return x; }).sort(function () { return R() - 0.5; })) || pick(locked);
  }
  function firstUnlocked() {
    var idx = [];
    items().forEach(function (x, i) { if (x.rarity === 'gewoehnlich') idx.push(x.id); });
    return idx.slice(0, 6);
  }

  /* ---------- Speicher ---------- */
  var KEY = 'mensch-vs-tier:game:v1';
  var store = { unlocked: null, highscore: 0, wins: 0, losses: 0, fled: 0, games: 0 };
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') Object.keys(store).forEach(function (k) { if (s[k] != null) store[k] = s[k]; });
    } catch (e) { /* ohne Speicher */ }
    if (!Array.isArray(store.unlocked)) store.unlocked = firstUnlocked();
    store.unlocked = store.unlocked.filter(function (id) { return !!itemById(id); });
    if (!store.unlocked.length) store.unlocked = firstUnlocked();
  }
  function saveStore() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignorieren */ } }

  /* Ergebnis verbuchen: gibt {score, newHigh, unlocked(Item|null)} zurück */
  function record(b) {
    var sc = score(b);
    var res = { score: sc, newHigh: false, unlocked: null };
    store.games++;
    if (b.outcome === 'sieg') store.wins++; else if (b.outcome === 'verloren') store.losses++; else store.fled++;
    if (sc > store.highscore) { store.highscore = sc; res.newHigh = sc > 0; }
    var u = pickUnlock(b, store.unlocked);
    if (u) { store.unlocked.push(u.id); res.unlocked = u; }
    saveStore();
    return res;
  }

  /* ---------- Öffentliche Logik-API ---------- */
  var Game = {
    PLACES: PLACES, FUNNY: FUNNY, C: C,
    rollOpponents: rollOpponents, rollPlaces: rollPlaces, rollItems: rollItems,
    startBattle: startBattle, roundActions: roundActions, act: act, score: score, pickUnlock: pickUnlock,
    animalHP: animalHP, hitChance: hitChance, firstUnlocked: firstUnlocked, funnyChance: funnyChance,
    record: record, store: store, loadStore: loadStore, saveStore: saveStore
  };
  root.Game = Game;

  if (typeof document === 'undefined') return;

  /* =====================================================================
     UI
     ===================================================================== */
  var CAT_LABEL = {
    raubkatzen: 'Raubkatzen', baeren: 'Bären', hundeartige: 'Hundeartige', huftiere: 'Huftiere', primaten: 'Primaten',
    reptilien: 'Reptilien', voegel: 'Vögel', wasser: 'Wassertiere', insekten: 'Insekten & Spinnen', nagetiere: 'Nagetiere'
  };
  var TYPE_LABEL = { waffe: 'Waffe', schutz: 'Schutz', ablenkung: 'Ablenkung', flucht: 'Flucht', witzig: 'Witzig' };
  var RARITY_LABEL = { gewoehnlich: 'Gewöhnlich', selten: 'Selten', episch: 'Episch', legendaer: 'Legendär' };
  var EFFECT_LABEL = { stun: 'Betäubt', scare: 'Verscheucht', distract: 'Lenkt ab', heal: 'Heilt', escape: 'Flucht', damage: 'Extraschaden', nothing: 'Wirkt nicht' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function skulls(t) { var s = ''; for (var i = 1; i <= 5; i++) s += '<span class="' + (i <= t ? '' : 'off') + '">💀</span>'; return '<span class="skulls" aria-label="Gefährlichkeit ' + t + ' von 5">' + s + '</span>'; }
  function fmtKg(n) { n = +n; return (n >= 1 ? Math.round(n * 10) / 10 + ' kg' : Math.round(n * 1000) + ' g').replace('.', ','); }

  var G = { tab: 'play', step: 'opp', opts: null, opp: null, place: null, pick: null, battle: null, result: null, libFilter: 'alle', libSort: 'asc', prevHp: 100, prevAhp: 100, acts: null };
  var inited = false;

  function init() {
    if (inited) return; inited = true;
    loadStore();
    saveStore();
    $('gameTabs').addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      G.tab = b.getAttribute('data-tab'); render();
    });
  }
  function reset() { G.step = 'opp'; G.opp = G.place = G.pick = G.battle = G.result = null; G.opts = { opp: rollOpponents(), place: rollPlaces(), item: null }; }

  function show() {
    init();
    if (!G.opts) reset();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    var tabs = $('gameTabs').children;
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === G.tab);
    $('gamePlay').hidden = G.tab !== 'play';
    $('gameLib').hidden = G.tab !== 'lib';
    if (G.tab === 'play') renderPlay(); else renderLib();
  }

  /* ---------- Spielen ---------- */
  function stepper() {
    var steps = [['opp', 'Gegner'], ['place', 'Ort'], ['item', 'Gegenstand'], ['battle', 'Kampf']];
    var idx = G.step === 'end' ? 4 : steps.map(function (s) { return s[0]; }).indexOf(G.step);
    return '<ol class="g-steps">' + steps.map(function (s, i) { return '<li class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '">' + s[1] + '</li>'; }).join('') + '</ol>';
  }
  function renderPlay() {
    if (!window.ITEMS || !window.ITEMS.length) { $('gamePlay').innerHTML = '<div class="card"><h2>Gegenstände fehlen</h2><p class="muted">items.js konnte nicht geladen werden.</p></div>'; return; }
    var h = '';
    if (G.step === 'opp') h = stepper() + viewOpp();
    else if (G.step === 'place') h = stepper() + viewPlace();
    else if (G.step === 'item') h = stepper() + viewItem();
    else if (G.step === 'battle') h = stepper() + viewBattle();
    else h = viewEnd();
    $('gamePlay').innerHTML = h;
    bindPlay();
    if (G.step === 'battle') afterBattleRender();
  }

  function viewOpp() {
    return '<h2 class="g-h">Wähle deinen Gegner</h2><div class="g-cards">' + G.opts.opp.map(function (a, i) {
      return '<button type="button" class="gcard animal" data-opp="' + i + '"><span class="gc-emoji">' + esc(a.emoji) + '</span><span class="gc-body"><span class="gc-name">' + esc(a.name) + '</span>' +
        '<span class="gc-meta">' + esc(CAT_LABEL[a.category] || a.category) + ' · ' + fmtKg(a.weight) + ' · ' + a.speed + ' km/h</span>' + skulls(a.dangerTier) + '</span></button>';
    }).join('') + '</div><button type="button" class="btn g-rand" data-act="rand-opp">🎲 Überrasch mich</button>' + gameStats();
  }
  function viewPlace() {
    return '<h2 class="g-h">Wo soll gekämpft werden?</h2><div class="g-cards">' + G.opts.place.map(function (p, i) {
      return '<button type="button" class="gcard place' + (p.real ? '' : ' funny') + '" data-place="' + i + '"><span class="gc-emoji">' + esc(p.emoji) + '</span><span class="gc-body"><span class="gc-name">' + esc(p.name) + '</span>' +
        '<span class="gc-meta">' + esc(p.text) + '</span>' + (p.real ? '' : '<span class="tag">Witziger Ort</span>') + '</span></button>';
    }).join('') + '</div><button type="button" class="btn" data-act="back-opp">‹ Anderer Gegner</button>';
  }
  function itemCardMini(it, loan) {
    return '<span class="gc-emoji">' + esc(it.emoji) + '</span><span class="gc-body"><span class="gc-name">' + esc(it.name) + '</span>' +
      '<span class="rar r-' + esc(it.rarity) + '">' + esc(RARITY_LABEL[it.rarity] || it.rarity) + '</span>' + (it.funny ? ' <span class="tag">Witzig</span>' : '') + (loan ? ' <span class="tag loan">Leihgabe</span>' : '') +
      '<span class="gc-meta">' + (it.special ? esc(it.special.label) + ' · ' : '') + 'Angriff ' + it.attack + ' · Verteidigung ' + it.defense + '</span></span>';
  }
  function viewItem() {
    return '<h2 class="g-h">Was nimmst du mit?</h2><div class="g-cards">' + G.opts.item.map(function (c, i) {
      return '<button type="button" class="gcard item r-' + esc(c.item.rarity) + '" data-item="' + i + '">' + itemCardMini(c.item, c.loan) + '</button>';
    }).join('') + '</div><button type="button" class="btn" data-act="back-place">‹ Anderer Ort</button>';
  }

  function bar(cls, pct) { return '<div class="hpbar ' + cls + '"><div class="hpfill" style="width:' + pct + '%" data-to="' + pct + '"></div></div>'; }
  function viewBattle() {
    var b = G.battle;
    var hpPct = Math.round(b.hp / b.hpMax * 100), aPct = Math.round(b.ahp / b.ahpMax * 100);
    var prevH = Math.round(G.prevHp / b.hpMax * 100), prevA = Math.round(G.prevAhp / b.ahpMax * 100);
    var head = '<div class="card arena">' +
      '<div class="ar-top"><span>' + esc(b.place.emoji) + ' ' + esc(b.place.name) + '</span><span>Runde ' + Math.min(b.round + (b.over ? 0 : 1), b.maxRounds) + '/' + b.maxRounds + '</span></div>' +
      '<div class="ar-fighters">' +
      '<div class="fighter human' + (b.dmgToHuman > 0 ? ' hit' : '') + '"><span class="f-emoji">🧍</span><span class="f-name">Du</span>' + bar('h', prevH).replace('data-to="' + prevH + '"', 'data-to="' + hpPct + '"') + '<span class="f-hp">' + b.hp + ' HP</span></div>' +
      '<div class="ar-vs">VS</div>' +
      '<div class="fighter animal' + (b.dmgToAnimal > 0 ? ' hit' : '') + '"><span class="f-emoji">' + esc(b.animal.emoji) + '</span><span class="f-name">' + esc(b.animal.name) + '</span>' + bar('a', prevA).replace('data-to="' + prevA + '"', 'data-to="' + aPct + '"') + '<span class="f-hp">' + b.ahp + ' HP</span></div>' +
      '</div><div class="ar-item">' + esc(b.item.emoji) + ' ' + esc(b.item.name) + (b.item.special ? ' · ' + esc(b.item.special.label) + ' ' + b.item.usesLeft + 'x' : '') + (b.stun ? ' · 💫 Tier benommen' : '') + '</div></div>';
    var acts = '';
    if (!b.over) {
      if (!G.acts) G.acts = roundActions(b);
      acts = '<div class="g-actions">' + G.acts.map(function (a) {
        return '<button type="button" class="gact' + (a.special ? ' special' : '') + (a.funny ? ' funny' : '') + '" data-action="' + esc(a.id) + '"><span class="ga-emoji">' + esc(a.emoji) + '</span><span class="ga-label">' + esc(a.label) + '</span><span class="ga-sub">' + esc(a.sub) + '</span></button>';
      }).join('') + '</div>';
    } else {
      acts = '<button type="button" class="btn fight g-next" data-act="to-end">Ergebnis ansehen ›</button>';
    }
    var logHtml = '<div class="card g-log"><h2>Kampf-Log</h2>' + (b.log.length ? b.log.slice().reverse().map(function (l, i) {
      return '<div class="log-entry' + (i === 0 ? ' new' : '') + '"><span class="log-r">R' + l.round + '</span><span class="log-t">' + l.lines.map(esc).join(' ') + '</span></div>';
    }).join('') : '<p class="muted small">Dein Gegner ' + esc('(' + b.animal.name + ')') + ' mustert dich. ' + esc(b.place.text) + '</p>') + '</div>';
    return head + acts + logHtml;
  }
  function afterBattleRender() {
    var fills = document.querySelectorAll('#gamePlay .hpfill');
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      for (var i = 0; i < fills.length; i++) fills[i].style.width = fills[i].getAttribute('data-to') + '%';
    }); });
    if (G.battle) { G.prevHp = G.battle.hp; G.prevAhp = G.battle.ahp; }
  }

  function viewEnd() {
    var b = G.battle, r = G.result;
    var meta = {
      sieg: ['🏆', 'Gesiegt', 'win'], geflohen: ['💨', 'Geflohen', 'fled'], verloren: ['🏥', 'Verloren', 'lose']
    }[b.outcome];
    var unl = r.unlocked ? '<div class="card g-unlock"><h2>Neu freigeschaltet</h2><div class="gcard item r-' + esc(r.unlocked.rarity) + '" style="cursor:default">' + itemCardMini(r.unlocked, false) + '</div></div>' : '';
    return '<div class="card g-end ' + meta[2] + '"><div class="ge-emoji">' + meta[0] + '</div><div class="ge-title">' + meta[1] + '</div>' +
      '<p class="ge-text">' + esc(b.endText) + '</p>' +
      '<div class="ge-score"><span>' + r.score + '</span> Punkte' + (r.newHigh ? ' <b class="newhigh">Neuer Highscore!</b>' : '') + '</div>' +
      '<div class="muted small">' + esc(b.animal.name) + ' · ' + esc(b.place.name) + ' · ' + esc(b.item.name) + ' · ' + b.hp + ' HP übrig' + '</div></div>' + unl +
      gameStats() +
      '<div class="g-endbtns"><button type="button" class="btn primary" data-act="again">Nochmal</button><button type="button" class="btn" data-act="lib">Gegenstände ansehen</button></div>';
  }
  function gameStats() {
    var s = store;
    return '<div class="card g-stats"><div><b>' + s.highscore + '</b><span>Highscore</span></div><div><b>' + s.wins + '</b><span>Siege</span></div><div><b>' + s.losses + '</b><span>Niederlagen</span></div><div><b>' + s.fled + '</b><span>Geflohen</span></div></div>';
  }

  function startFight() {
    var it = G.pick;
    G.battle = startBattle(G.opp, G.place, it.item, it.loan);
    G.prevHp = G.battle.hp; G.prevAhp = G.battle.ahp; G.acts = null;
    G.step = 'battle'; renderPlay(); window.scrollTo(0, 0);
  }
  var busy = false;
  function bindPlay() {
    var root = $('gamePlay');
    root.onclick = function (ev) {
      var t = ev.target.closest('button'); if (!t || busy) return;
      var v;
      if ((v = t.getAttribute('data-opp')) != null) { G.opp = G.opts.opp[+v]; G.step = 'place'; renderPlay(); window.scrollTo(0, 0); }
      else if ((v = t.getAttribute('data-place')) != null) { G.place = G.opts.place[+v]; G.opts.item = rollItems(store.unlocked); G.step = 'item'; renderPlay(); window.scrollTo(0, 0); }
      else if ((v = t.getAttribute('data-item')) != null) { G.pick = G.opts.item[+v]; startFight(); }
      else if ((v = t.getAttribute('data-action')) != null) {
        var b = G.battle; if (!b || b.over) return;
        busy = true;
        act(b, v); G.acts = null;
        if (b.over) { G.result = record(b); }
        renderPlay();
        setTimeout(function () { busy = false; }, 250);
      } else if ((v = t.getAttribute('data-act')) != null) {
        if (v === 'rand-opp') { G.opp = pick(animals()); G.step = 'place'; renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'back-opp') { G.step = 'opp'; renderPlay(); }
        else if (v === 'back-place') { G.step = 'place'; renderPlay(); }
        else if (v === 'to-end') { G.step = 'end'; renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'again') { reset(); renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'lib') { G.tab = 'lib'; render(); window.scrollTo(0, 0); }
      }
    };
  }

  /* ---------- Gegenstände-Bibliothek ---------- */
  var FILTERS = [['alle', 'Alle'], ['witzig', '😂 Witzig'], ['waffe', 'Waffe'], ['schutz', 'Schutz'], ['ablenkung', 'Ablenkung'], ['flucht', 'Flucht']];
  function renderLib() {
    var all = items();
    var un = store.unlocked || [];
    var list = all.filter(function (x) {
      if (G.libFilter === 'alle') return true;
      if (G.libFilter === 'witzig') return !!x.funny;
      return x.type === G.libFilter;
    });
    list = list.slice().sort(function (a, b) {
      var ua = un.indexOf(a.id) >= 0 ? 0 : 1, ub = un.indexOf(b.id) >= 0 ? 0 : 1;
      if (ua !== ub) return ua - ub; // freigeschaltete zuerst
      var d = (RARITY_ORDER[a.rarity] || 0) - (RARITY_ORDER[b.rarity] || 0);
      if (G.libSort === 'desc') d = -d;
      return d || String(a.name).localeCompare(String(b.name), 'de');
    });
    var h = '<div class="g-libhead"><b>' + un.length + '/' + all.length + '</b> freigeschaltet</div>' +
      '<div class="chips scroll" id="libChips">' + FILTERS.map(function (f) { return '<button type="button" class="chip' + (G.libFilter === f[0] ? ' on' : '') + '" data-filter="' + f[0] + '">' + f[1] + '</button>'; }).join('') +
      '<button type="button" class="chip" data-sort="1">Seltenheit ' + (G.libSort === 'asc' ? '↑' : '↓') + '</button></div>' +
      '<div class="lib-grid">' + list.map(function (x) { return libCard(x, un.indexOf(x.id) >= 0); }).join('') + '</div>';
    $('gameLib').innerHTML = h;
    $('gameLib').onclick = function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-filter')) { G.libFilter = t.getAttribute('data-filter'); renderLib(); }
      else if (t.hasAttribute('data-sort')) { G.libSort = G.libSort === 'asc' ? 'desc' : 'asc'; renderLib(); }
    };
  }
  function meter(label, v) {
    return '<div class="meter"><span>' + label + '</span><div class="mbar"><i style="width:' + clamp(v * 10, 0, 100) + '%"></i></div><b>' + v + '</b></div>';
  }
  function catList(arr) { return (arr && arr.length) ? arr.map(function (c) { return CAT_LABEL[c] || c; }).join(', ') : '–'; }
  function libCard(x, open) {
    if (!open) {
      return '<div class="lcard locked r-' + esc(x.rarity) + '"><div class="lc-emoji">?</div><div class="lc-name">???</div><span class="rar r-' + esc(x.rarity) + '">' + esc(RARITY_LABEL[x.rarity] || x.rarity) + '</span><p class="lc-hint">🔒 ' + 'Wird nach einem Kampf zufällig freigeschaltet – gefährlichere Gegner bringen seltenere Beute.' + '</p></div>';
    }
    var sp = x.special || {};
    return '<div class="lcard r-' + esc(x.rarity) + '"><div class="lc-emoji">' + esc(x.emoji) + '</div><div class="lc-name">' + esc(x.name) + '</div>' +
      '<div><span class="rar r-' + esc(x.rarity) + '">' + esc(RARITY_LABEL[x.rarity] || x.rarity) + '</span> <span class="tag">' + esc(TYPE_LABEL[x.type] || x.type) + '</span>' + (x.funny ? ' <span class="tag">Witzig</span>' : '') + '</div>' +
      meter('Angriff', x.attack) + meter('Verteidigung', x.defense) +
      '<div class="lc-sp"><b>' + esc(sp.label || '–') + '</b> <span class="muted">(' + esc(EFFECT_LABEL[sp.effect] || sp.effect || '–') + ', ' + (x.uses || 1) + 'x)</span></div>' +
      '<div class="lc-vs small"><span class="plus">Stark gegen:</span> ' + esc(catList(x.strongVs)) + '<br><span class="minus">Schwach gegen:</span> ' + esc(catList(x.weakVs)) + '</div>' +
      '<p class="lc-desc small muted">' + esc(x.description) + '</p>' +
      (x.realism ? '<div class="lc-real small"><b>Realitäts-Check:</b> ' + esc(x.realism) + '</div>' : '') + '</div>';
  }

  Game.show = show;
  Game._state = G;
})(typeof window !== 'undefined' ? window : globalThis);
