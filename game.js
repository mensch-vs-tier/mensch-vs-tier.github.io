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
    mm: { strong: 1.5, weak: 0.5 },
    /* Erfahrung & Level */
    maxLevel: 20, xpBase: 100, xpGrow: 1.25,                     // XP Level n -> n+1 = round(xpBase * xpGrow^(n-1))
    xp: { perDmg: 1, perRound: 10, win: 25, left: 15, escaped: 5, funnyItem: 10 },  // win/left/escaped werden mit dangerTier multipliziert
    /* Fähigkeiten (Werte aller Perks) */
    perk: {
      todesangstHp: 0.3, todesangstDmg: 0.35, todesangstHit: 0.10,
      adrenalinHit: 0.20, zaehHp: 15, ausweich: 0.15, kampfDmg: 0.10,
      aid: 25, kletter: 0.15, dick: 0.20, dickKg: 50, influencer: 1.5, fluesterer: 0.15,
      gluecksDmg: 0.20, gluecksHp: -10, vorsichtHp: 10, vorsichtDmg: -0.05,
      schatzBoost: { gewoehnlich: 1, selten: 1.6, episch: 2.4, legendaer: 3 },
      fundBoost: { gewoehnlich: 1, selten: 3, episch: 4, legendaer: 3 },
      extraChoices: 1                                              // Fährtenleser / Ortskenntnis / Schatzsucher: 3 -> 4
    }
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
  /* ---------- Fähigkeiten (Perks) ---------- */
  var PK = C.perk;
  function pct(x) { return Math.round(x * 100) + ' %'; }
  var PERKS = [
    { id: 'todesangst', name: 'Todesangst', emoji: '😱', max: 1, kind: 'Fähigkeit',
      text: function () { return 'Unter ' + pct(PK.todesangstHp) + ' HP: +' + pct(PK.todesangstDmg) + ' Schaden und +' + pct(PK.todesangstHit) + ' Trefferchance.'; } },
    { id: 'adrenalin', name: 'Adrenalin', emoji: '💉', max: 1, kind: 'Fähigkeit',
      text: function () { return 'In der ersten Runde: +' + pct(PK.adrenalinHit) + ' Trefferchance.'; } },
    { id: 'zaeh', name: 'Zäh wie Leder', emoji: '🥾', max: 3, kind: 'Fähigkeit',
      text: function (l) { return '+' + PK.zaehHp * l + ' maximale HP.'; } },
    { id: 'ausweich', name: 'Ausweichprofi', emoji: '🤸', max: 1, kind: 'Fähigkeit',
      text: function () { return 'Ausweichen senkt die Trefferchance des Tiers zusätzlich um ' + pct(PK.ausweich) + '.'; } },
    { id: 'kampf', name: 'Kampfsport-Kurs', emoji: '🥋', max: 3, kind: 'Fähigkeit',
      text: function (l) { return '+' + pct(PK.kampfDmg * l) + ' Schaden; Grundtrefferchance wie ein ' + (l >= 2 ? 'Kampfsportler' : 'Athlet') + '.'; } },
    { id: 'faehrte', name: 'Fährtenleser', emoji: '🐾', max: 1, kind: 'Fähigkeit',
      text: function () { return 'Bei der Gegnerwahl 4 statt 3 Karten.'; } },
    { id: 'ortskenntnis', name: 'Ortskenntnis', emoji: '🗺️', max: 1, kind: 'Fähigkeit',
      text: function () { return '4 statt 3 Orte zur Wahl.'; } },
    { id: 'schatz', name: 'Schatzsucher', emoji: '💎', max: 1, kind: 'Fund',
      text: function () { return '4 statt 3 Gegenstände zur Wahl, seltene Gegenstände tauchen häufiger auf.'; } },
    { id: 'fund', name: 'Gegenstand finden', emoji: '🎁', max: 99, instant: true, kind: 'Fund',
      text: function () { return 'Sofort: ein zufälliger gesperrter Gegenstand wird freigeschaltet, gern ein seltener.'; } },
    { id: 'zweiter', name: 'Zweiter Gegenstand', emoji: '🎒', max: 1, kind: 'Fund',
      text: function () { return 'Du nimmst einen zweiten Gegenstand mit in den Kampf. Sein Spezialeffekt wird ein zusätzlicher Knopf.'; } },
    { id: 'hilfe', name: 'Erste Hilfe', emoji: '⛑️', max: 1, kind: 'Fähigkeit',
      text: function () { return 'Einmal pro Kampf: Heil-Aktion mit +' + PK.aid + ' HP.'; } },
    { id: 'kletter', name: 'Klettermaxe', emoji: '🧗', max: 1, kind: 'Fähigkeit',
      text: function () { return 'Fluchtversuche gelingen ' + pct(PK.kletter) + ' häufiger.'; } },
    { id: 'dick', name: 'Bayerischer Dickschädel', emoji: '🥨', max: 1, kind: 'Witzig',
      text: function () { return 'Tiere unter ' + PK.dickKg + ' kg richten ' + pct(PK.dick) + ' weniger Schaden an. Du erträgst alles.'; } },
    { id: 'influencer', name: 'Influencer', emoji: '📱', max: 1, kind: 'Witzig',
      text: function () { return 'Witzige Aktionen (und Spezialeffekte witziger Gegenstände) wirken ' + pct(PK.influencer - 1) + ' besser.'; } },
    { id: 'fluesterer', name: 'Tierflüsterer', emoji: '🧘', max: 1, kind: 'Fähigkeit',
      text: function () { return 'Verscheuchen und Ablenken gelingen ' + pct(PK.fluesterer) + ' häufiger.'; } },
    { id: 'risiko', name: 'Risiko oder Sicherheit', emoji: '🎲', max: 1, kind: 'Entscheidung', choice: true,
      text: function () {
        if (store.riskChoice === 'gluecks') return 'Glücksritter: +' + pct(PK.gluecksDmg) + ' Schaden, ' + PK.gluecksHp + ' max. HP.';
        if (store.riskChoice === 'vorsicht') return 'Vorsichtig: +' + PK.vorsichtHp + ' max. HP, ' + pct(PK.vorsichtDmg).replace('-', '−') + ' Schaden.';
        return 'Dauerhafte Wahl: Glücksritter (+' + pct(PK.gluecksDmg) + ' Schaden, ' + PK.gluecksHp + ' max. HP) oder Vorsichtig (+' + PK.vorsichtHp + ' max. HP, −5 % Schaden).'; },
      options: [{ id: 'gluecks', label: 'Glücksritter', sub: '+20 % Schaden, −10 max. HP' }, { id: 'vorsicht', label: 'Vorsichtig', sub: '+10 max. HP, −5 % Schaden' }] }
  ];
  function perkDef(id) { for (var i = 0; i < PERKS.length; i++) if (PERKS[i].id === id) return PERKS[i]; return null; }
  function pLevel(id) { var d = perkDef(id); return d ? clamp(Math.floor(num(store.perks && store.perks[id], 0)), 0, d.max) : 0; }
  function snapPerks() {
    var o = {};
    PERKS.forEach(function (d) { if (!d.instant) o[d.id] = pLevel(d.id); });
    o.risk = store.riskChoice || null;
    return o;
  }
  function pv(b, id) { return (b.pk && b.pk[id]) | 0; }
  function maxHpFor(pk) {
    var h = C.humanHP + PK.zaehHp * (pk.zaeh | 0);
    if (pk.risk === 'gluecks') h += PK.gluecksHp; else if (pk.risk === 'vorsicht') h += PK.vorsichtHp;
    return h;
  }
  function fitnessFor(pk) { var l = pk.kampf | 0; return l >= 2 ? 'kampfsport' : l === 1 ? 'athlet' : 'durchschnitt'; }
  function lowHp(b) { return b.hp / b.hpMax < PK.todesangstHp; }
  function dmgMult(b) {
    var m = 1 + PK.kampfDmg * pv(b, 'kampf');
    if (pv(b, 'todesangst') && lowHp(b)) m += PK.todesangstDmg;
    if (b.pk.risk === 'gluecks') m += PK.gluecksDmg; else if (b.pk.risk === 'vorsicht') m += PK.vorsichtDmg;
    return m;
  }

  function funnyChance(f, a, b) {
    var p;
    if (f.ids && f.ids[a.id] != null) { p = f.ids[a.id]; if (p < 0) return p; }
    else {
      p = f.base;
      if (f.cat && f.cat[a.category]) p += f.cat[a.category];
      if (f.small && a.weight < 30) p += f.small;
      if (f.heavyPenalty && a.weight > 300) p -= f.heavyPenalty;
      if (f.speedPenalty) p -= num(a.speed, 30) / 400;
      if (f.aggr) p -= num(a.aggression, 5) * 0.015;
    }
    if (b && b.pk) {
      if (pv(b, 'fluesterer') && (f.effect === 'scare' || f.effect === 'distract')) p += PK.fluesterer;
      if (pv(b, 'kletter') && f.effect === 'escape') p += PK.kletter;
      if (pv(b, 'influencer')) p *= PK.influencer;
    }
    return clamp(p, 0, b && b.pk ? 0.95 : 0.85);
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
    if (pLevel('faehrte')) add(all);
    return shuffle(out);
  }
  function rollPlaces() { return shuffle(PLACES).slice(0, 3 + (pLevel('ortskenntnis') ? PK.extraChoices : 0)); }

  function weightedPick(list, boost) {
    var tot = 0, i;
    function w(x) { return (RARITY_W[x.rarity] || 1) * (boost && boost[x.rarity] ? boost[x.rarity] : 1); }
    for (i = 0; i < list.length; i++) tot += w(list[i]);
    var r = R() * tot;
    for (i = 0; i < list.length; i++) { r -= w(list[i]); if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }
  function wTake(list, n, exclude, boost) {
    var pool = list.filter(function (x) { return exclude.indexOf(x) < 0; }), out = [];
    while (out.length < n && pool.length) { var it = weightedPick(pool, boost); out.push(it); pool.splice(pool.indexOf(it), 1); }
    return out;
  }
  /* unlockedIds: Array. Ergebnis: [{item, loan}] mit 3 Einträgen (4 mit Schatzsucher) */
  function rollItems(unlockedIds) {
    var all = items(), n = 3 + (pLevel('schatz') ? PK.extraChoices : 0), boost = pLevel('schatz') ? PK.schatzBoost : null;
    var un = all.filter(function (x) { return unlockedIds.indexOf(x.id) >= 0; });
    var locked = all.filter(function (x) { return unlockedIds.indexOf(x.id) < 0; });
    var chosen = wTake(un, n, [], boost).map(function (x) { return { item: x, loan: false }; });
    // 1 gesperrter als Leihgabe (30 %), oder wenn zu wenig freigeschaltet
    if (locked.length && (R() < 0.3 || chosen.length < n)) {
      var chosenItems = chosen.map(function (c) { return c.item; });
      var loan = wTake(locked, 1, chosenItems, boost)[0];
      if (loan) { if (chosen.length >= n) chosen.splice(Math.floor(R() * chosen.length), 1); chosen.push({ item: loan, loan: true }); }
    }
    // mindestens 1 witziger
    if (!chosen.some(function (c) { return c.item.funny; })) {
      var used = chosen.map(function (c) { return c.item; });
      var f = wTake(un.filter(function (x) { return x.funny; }), 1, used)[0], isLoan = false;
      if (!f) { f = wTake(locked.filter(function (x) { return x.funny; }), 1, used)[0]; isLoan = true; }
      if (f) { if (chosen.length >= n) chosen.splice(Math.floor(R() * chosen.length), 1); chosen.push({ item: f, loan: isLoan }); }
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
  function baseChance(item, a, place, fitness) {
    var w = item.baseWeapon || 'unbewaffnet';
    var r;
    try { r = E.compute({ weight: 80, fitness: fitness || 'durchschnitt', mindset: 'normal', weapon: w }, a, place.env); } catch (e) { r = null; }
    var p = r ? num(r.humanPct, 5) / 100 : 0.05;
    return clamp(p, 0.005, 0.995);
  }
  function mkItem(item) {
    return {
      id: item.id, name: item.name, emoji: item.emoji, funny: !!item.funny,
      attack: clamp(num(item.attack, 0), 0, 10), defense: clamp(num(item.defense, 0), 0, 10),
      usesLeft: clamp(Math.floor(num(item.uses, 1)), 0, 3), special: item.special || null, src: item
    };
  }
  /* item2 (optional): zweiter Gegenstand, nur mit Fähigkeit "Zweiter Gegenstand" */
  function startBattle(animal, place, item, loan, item2, loan2) {
    var pk = snapPerks();
    if (!pk.zweiter) item2 = null;
    var hpMax = maxHpFor(pk);
    var ahp = animalHP(animal);
    return {
      animal: animal, place: place, item: mkItem(item), loan: !!loan, item2: item2 ? mkItem(item2) : null, loan2: !!loan2, pk: pk,
      round: 0, maxRounds: C.maxRounds, hp: hpMax, hpMax: hpMax, ahp: ahp, ahpMax: ahp,
      base: baseChance(item, animal, place, fitnessFor(pk)), mm: mmFor(item, animal),
      stun: 0, enraged: false, dodging: false, funnyWins: 0, funnyUsed: 0, aid: pk.hilfe ? 1 : 0, acting: false,
      dmgTotal: 0, funnyItemUsed: false,
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
    if (b.item2 && b.item2.special && b.item2.usesLeft > 0) {
      out.push({ id: 'special2', emoji: b.item2.emoji, label: b.item2.special.label || 'Spezial', sub: b.item2.name + ' · noch ' + b.item2.usesLeft + 'x', special: true });
    }
    if (b.aid > 0 && b.hp < b.hpMax) out.push({ id: 'aid', emoji: '⛑️', label: 'Erste Hilfe', sub: '+' + PK.aid + ' HP · 1x pro Kampf', aid: true });
    return shuffle(out);
  }
  /* In act() ist b.round schon hochgezählt, in der Vorschau noch nicht */
  function firstRound(b) { return (b.acting ? b.round : b.round + 1) === 1; }
  function hitChance(b) {
    var p = clamp(b.base * (1 + (b.mm - 1) * 0.5), 0.005, 0.995);
    var h = (C.hitFloor + C.hitSpan * Math.sqrt(p)) * modOf(b.place, 'humanHit', 1);
    if (pv(b, 'todesangst') && lowHp(b)) h += PK.todesangstHit;
    if (pv(b, 'adrenalin') && firstRound(b)) h += PK.adrenalinHit;
    return clamp(h, 0.1, 0.92);
  }
  function humanDamage(b, bonusMult) {
    var d = (C.humanDmgBase + b.item.attack * C.humanDmgPerAtk) * (0.8 + 0.4 * R()) * b.mm;
    // Schusswaffen: ein sitzender Treffer wirkt ungleich stärker als jeder Schlag
    var fw = { grosskaliber: 2.2, kleinkaliber: 1.3 }[b.item.src.baseWeapon];
    if (fw) d *= fw;
    d *= (1 - 0.4 * num(b.animal.armor, 0));
    d *= modOf(b.place, 'dmg', 1) * modOf(b.place, 'humanDmg', 1) * (bonusMult || 1) * dmgMult(b);
    return Math.max(1, Math.round(d));
  }
  function animalDamage(b) {
    var a = b.animal;
    var d = C.tierDmg[clamp(a.dangerTier, 1, 5)] * (0.75 + 0.5 * R());
    var dm = 1 - clamp(b.item.defense * 0.035 * (b.mm > 1 ? 1.3 : b.mm < 1 ? 0.6 : 1), 0, 0.5);
    d *= dm * modOf(b.place, 'dmg', 1) * modOf(b.place, 'animalDmg', 1);
    if (pv(b, 'dick') && num(a.weight, 100) < PK.dickKg) d *= 1 - PK.dick;
    return Math.max(1, Math.round(d));
  }
  function animalHitChance(b) {
    var a = b.animal;
    var p = 0.38 + num(a.aggression, 5) * 0.04 + num(a.agility, 5) * 0.01 - b.item.defense * 0.012;
    p *= modOf(b.place, 'animalHit', 1);
    if (b.enraged) p *= 1.3;
    if (b.dodging) {
      p *= clamp(0.55 - (num(a.agility, 5) - 5) * 0.03 - b.item.defense * 0.015, 0.2, 0.8);
      if (pv(b, 'ausweich')) p *= 1 - PK.ausweich;
    }
    return clamp(p, 0.08, 0.92);
  }
  function escapeChance(b, power) {
    var a = b.animal;
    return clamp(0.25 + power * 0.5 - num(a.speed, 30) / 220 - (a.climbs ? 0.08 : 0) + modOf(b.place, 'escape', 0) + (pv(b, 'kletter') ? PK.kletter : 0), 0.05, 0.92);
  }

  function finishBattle(b, outcome, reason, text) { b.over = true; b.outcome = outcome; b.reason = reason; b.endText = text; }

  /* Spieleraktion ausführen; liefert {lines:[...], dmgA, dmgH, over, ev}
     ev = Ereignis-Beschreibung für die Animation (die Logik ändert sich dadurch nicht) */
  function act(b, actionId) {
    if (b.over) return { lines: [], dmgA: 0, dmgH: 0, over: true, ev: { kind: 'none' } };
    var a = b.animal, lines = [], hpBefore = b.hp, aBefore = b.ahp;
    var ev = { kind: 'none', eff: null, ok: null, hit: null, fid: null, feff: null, dmg: 0, heal: 0, animal: 'none', dmgH: 0, evaded: false, slot: 1 };
    b.round++;
    b.acting = true;
    b.dodging = false;
    var res = { leave: false };
    var itemName = b.item.name;

    if (actionId === 'attack') {
      ev.kind = 'attack';
      if (b.item.funny) b.funnyItemUsed = true;
      if (R() < hitChance(b)) {
        var d = humanDamage(b);
        b.ahp = Math.max(0, b.ahp - d);
        ev.hit = true; ev.dmg = d;
        lines.push(pick(T.hitIntro) + ' mit ' + itemName + ': ' + d + ' Schaden. ' + pick(T.hitTail));
      } else { ev.hit = false; lines.push(pick(T.miss)); }
    } else if (actionId === 'dodge') {
      ev.kind = 'dodge';
      b.dodging = true;
      lines.push(pick(T.dodge));
    } else if (actionId === 'special') {
      ev.kind = 'special'; ev.item = b.item;
      doSpecial(b, lines, res, b.item, ev);
    } else if (actionId === 'special2' && b.item2) {
      ev.kind = 'special'; ev.slot = 2; ev.item = b.item2;
      doSpecial(b, lines, res, b.item2, ev);
    } else if (actionId === 'aid' && b.aid > 0) {
      ev.kind = 'heal'; b.aid--;
      var h0 = b.hp; b.hp = Math.min(b.hpMax, b.hp + PK.aid);
      ev.heal = b.hp - h0; ev.ok = true;
      lines.push('Du verarztest dich notdürftig. (+' + ev.heal + ' HP)');
    } else if (actionId.indexOf('f:') === 0) {
      ev.kind = 'funny';
      doFunny(b, actionId.slice(2), lines, res, ev);
    }
    ev.leave = res.leave;
    ev.dmgA = aBefore - b.ahp;

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
      if (b.stun > 0) { b.stun--; ev.animal = 'stunned'; lines.push(pick(T.stunned)); }
      else {
        if (R() < animalHitChance(b)) {
          var dd = animalDamage(b);
          b.hp = Math.max(0, b.hp - dd);
          ev.animal = 'hit'; ev.dmgH = dd;
          lines.push(fill(pick(T.aHit), { verb: animalVerb(a) }).replace('Dein Gegner ' + 'Dein', 'Dein') + ' (−' + dd + ' HP)');
        } else { ev.animal = 'miss'; ev.evaded = b.dodging; lines.push(b.dodging ? pick(T.dodged) : pick(T.aMiss)); }
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
    b.acting = false;
    b.dmgToAnimal = aBefore - b.ahp; b.dmgToHuman = hpBefore - b.hp;
    b.dmgTotal += aBefore - b.ahp;
    b.log.push({ round: b.round, lines: lines });
    return { lines: lines, dmgA: aBefore - b.ahp, dmgH: hpBefore - b.hp, over: b.over, ev: ev };
  }

  function spChance(b, it, eff, c) {
    if (eff === 'scare' || eff === 'distract') { if (pv(b, 'fluesterer')) c += PK.fluesterer; }
    if (it.funny && pv(b, 'influencer')) c *= PK.influencer;
    return c;
  }
  function doSpecial(b, lines, res, it, ev) {
    it = it || b.item; ev = ev || {};
    var a = b.animal, sp = it.special || {}, eff = sp.effect || 'nothing', pw = clamp(num(sp.power, 0.5), 0, 1), mm = mmFor(it.src, a);
    var intro = sp.text || (it.name + ' kommt zum Einsatz.');
    it.usesLeft--;
    if (it.funny) b.funnyItemUsed = true;
    var ok;
    ev.eff = eff;
    switch (eff) {
      case 'stun':
        ok = R() < clamp(spChance(b, it, eff, (0.3 + pw * 0.55) * mm - num(a.agility, 5) * 0.015), 0.08, 0.92);
        if (ok) { b.stun = 1; lines.push(intro + ' Das Tier ist benommen.'); } else lines.push(intro + ' Das Tier lässt sich davon nicht beeindrucken.');
        break;
      case 'scare':
        ok = R() < clamp(spChance(b, it, eff, (0.15 + pw * 0.5 + num(a.fleeTendency, 0.3) * 0.5 + modOf(b.place, 'scare', 0)) * mm - num(a.aggression, 5) * 0.03), 0.05, 0.9);
        if (ok) { res.leave = 'animal'; lines.push(intro + ' Das Tier ergreift die Flucht.'); } else lines.push(intro + ' Das Tier zuckt nur kurz mit den Ohren.');
        break;
      case 'distract':
        ok = R() < clamp(spChance(b, it, eff, (0.25 + pw * 0.45 + num(a.fleeTendency, 0.3) * 0.2 + modOf(b.place, 'distract', 0)) * mm), 0.05, 0.9);
        if (ok) {
          if (R() < 0.3 + 0.5 * num(a.fleeTendency, 0.3)) { res.leave = 'animal'; lines.push(intro + ' Das Tier verliert das Interesse an dir und geht seiner Wege.'); }
          else { b.stun = 1; lines.push(intro + ' Das Tier ist abgelenkt.'); }
        } else lines.push(intro + ' Das Tier ignoriert es und bleibt bei dir.');
        break;
      case 'heal': {
        var amt = Math.max(8, Math.round(pw * 50 * (1 + modOf(b.place, 'heal', 0))));
        var before = b.hp; b.hp = Math.min(b.hpMax, b.hp + amt);
        ev.heal = b.hp - before; ok = true;
        lines.push(intro + ' (+' + (b.hp - before) + ' HP)');
        break;
      }
      case 'escape':
        ok = R() < clamp(escapeChance(b, pw) * (1 + (mm - 1) * 0.5), 0.05, 0.92);
        if (ok) { res.leave = 'human'; lines.push(intro + ' Du bist weg.'); } else lines.push(intro + ' Das Tier ist schneller, als du dachtest.');
        break;
      case 'damage':
        ok = R() < clamp(0.55 + pw * 0.3, 0.3, 0.92) * modOf(b.place, 'humanHit', 1);
        if (ok) {
          var d = Math.max(3, Math.round(pw * 40 * mm * (1 - 0.3 * num(a.armor, 0)) * modOf(b.place, 'dmg', 1) * dmgMult(b)));
          b.ahp = Math.max(0, b.ahp - d);
          ev.dmg = d;
          lines.push(intro + ' ' + d + ' Schaden.');
        } else lines.push(intro + ' Leider daneben.');
        break;
      default:
        ok = false;
        lines.push(intro + ' Es passiert: nichts.');
    }
    ev.ok = !!ok;
  }

  function doFunny(b, fid, lines, res, ev) {
    var f = null, i;
    ev = ev || {};
    for (i = 0; i < FUNNY.length; i++) if (FUNNY[i].id === fid) f = FUNNY[i];
    if (!f) { lines.push('Du stehst unschlüssig herum.'); return; }
    var a = b.animal, p = funnyChance(f, a, b);
    b.funnyUsed++;
    ev.fid = f.id; ev.feff = f.effect;
    var ok = p > 0 && R() < p;
    ev.ok = ok;
    if (ok) {
      b.funnyWins++;
      lines.push(f.ok);
      if (f.effect === 'leave' || f.effect === 'scare') res.leave = 'animal';
      else if (f.effect === 'distract') { if (R() < 0.25 + 0.5 * num(a.fleeTendency, 0.3)) { res.leave = 'animal'; lines.push('Das Tier geht seiner Wege.'); } else { b.stun = 1; ev.softStun = true; } }
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
  var DEFAULTS = function () {
    return { unlocked: null, highscore: 0, wins: 0, losses: 0, fled: 0, games: 0,
      xp: 0, level: 1, xpTotal: 0, pending: 0, perks: {}, riskChoice: null, found: 0, dmgTotal: 0 };
  };
  var store = DEFAULTS();
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && typeof s === 'object') Object.keys(store).forEach(function (k) { if (s[k] != null) store[k] = s[k]; });
    } catch (e) { /* ohne Speicher */ }
    if (!Array.isArray(store.unlocked)) store.unlocked = firstUnlocked();
    store.unlocked = store.unlocked.filter(function (id) { return !!itemById(id); });
    if (!store.unlocked.length) store.unlocked = firstUnlocked();
    sanitizeProgress();
  }
  /* alte Spielstände ohne XP/Perks und kaputte Werte auffangen */
  function sanitizeProgress() {
    store.level = clamp(Math.floor(num(store.level, 1)), 1, C.maxLevel);
    store.xp = Math.max(0, Math.floor(num(store.xp, 0)));
    if (store.level >= C.maxLevel) store.xp = 0; else if (store.xp >= xpNeed(store.level)) store.xp = xpNeed(store.level) - 1;
    store.xpTotal = Math.max(0, Math.floor(num(store.xpTotal, 0)));
    store.pending = clamp(Math.floor(num(store.pending, 0)), 0, C.maxLevel);
    store.found = Math.max(0, Math.floor(num(store.found, 0)));
    store.dmgTotal = Math.max(0, Math.floor(num(store.dmgTotal, 0)));
    var pr = {};
    PERKS.forEach(function (d) {
      if (d.instant) return;
      var l = clamp(Math.floor(num(store.perks && store.perks[d.id], 0)), 0, d.max);
      if (l > 0) pr[d.id] = l;
    });
    store.perks = pr;
    if (store.riskChoice !== 'gluecks' && store.riskChoice !== 'vorsicht') store.riskChoice = null;
    if (store.riskChoice) store.perks.risiko = 1; else delete store.perks.risiko;
  }
  function saveStore() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignorieren */ } }

  /* ---------- XP & Level ---------- */
  function xpNeed(level) { return level >= C.maxLevel ? Infinity : Math.round(C.xpBase * Math.pow(C.xpGrow, level - 1)); }
  /* XP-Aufschlüsselung eines beendeten Kampfes */
  function xpBreakdown(b) {
    var X = C.xp, tier = clamp(b.animal.dangerTier, 1, 5);
    var survived = b.outcome === 'verloren' ? Math.max(0, b.round - 1) : b.round;
    var outcome = 0;
    if (b.outcome === 'sieg') outcome = (b.reason === 'kill' ? X.win : X.left) * tier;
    else if (b.outcome === 'geflohen') outcome = X.escaped * tier;
    var o = {
      damage: Math.round(b.dmgTotal * X.perDmg), rounds: survived * X.perRound, outcome: outcome,
      bonus: b.funnyItemUsed ? X.funnyItem : 0
    };
    o.total = o.damage + o.rounds + o.outcome + o.bonus;
    return o;
  }
  /* XP gutschreiben; Level-Aufstiege erhöhen store.pending (offene Fähigkeitswahlen) */
  function addXp(n) {
    n = Math.max(0, Math.round(n));
    var info = { startLevel: store.level, startXp: store.xp, levels: 0 };
    store.xpTotal += n;
    if (store.level < C.maxLevel) {
      store.xp += n;
      while (store.level < C.maxLevel && store.xp >= xpNeed(store.level)) {
        store.xp -= xpNeed(store.level); store.level++; store.pending++; info.levels++;
      }
      if (store.level >= C.maxLevel) store.xp = 0;
    }
    info.endLevel = store.level; info.endXp = store.xp;
    return info;
  }

  /* ---------- Level-Up: Kartenwahl ---------- */
  function perkOffers() {
    return PERKS.filter(function (d) {
      if (d.instant) return items().some(function (x) { return store.unlocked.indexOf(x.id) < 0; });
      return pLevel(d.id) < d.max;
    });
  }
  /* 3 zufällige Karten (IDs) */
  function levelUpCards() { return shuffle(perkOffers()).slice(0, 3).map(function (d) { return d.id; }); }
  function pickFund() {
    var locked = items().filter(function (x) { return store.unlocked.indexOf(x.id) < 0; });
    return locked.length ? weightedPick(locked, PK.fundBoost) : null;
  }
  /* Karte wählen; sub nur für Entscheidungskarten. Liefert {perk, item, level} oder null bei ungültig */
  function choosePerk(id, sub) {
    var d = perkDef(id);
    if (!d || store.pending <= 0) return null;
    var out = { perk: d, item: null, level: 0 };
    if (d.instant) {
      var it = pickFund();
      if (!it) return null;
      store.unlocked.push(it.id); store.found++; out.item = it;
    } else {
      if (pLevel(id) >= d.max) return null;
      if (d.choice) {
        if (sub !== 'gluecks' && sub !== 'vorsicht') return null;
        store.riskChoice = sub;
      }
      store.perks[id] = pLevel(id) + 1;
      out.level = store.perks[id];
    }
    store.pending--;
    sanitizeProgress();
    saveStore();
    return out;
  }
  /* Nicht wählbare Wahl (Pool leer): offene Wahlen verfallen */
  function dropPending() { store.pending = 0; saveStore(); }
  function resetProgress() {
    var keep = { unlocked: store.unlocked, highscore: store.highscore, wins: store.wins, losses: store.losses, fled: store.fled, games: store.games };
    var d = DEFAULTS();
    Object.keys(d).forEach(function (k) { store[k] = keep.hasOwnProperty(k) ? keep[k] : d[k]; });
    saveStore();
  }

  /* Ergebnis verbuchen: gibt {score, newHigh, unlocked(Item|null), xp{...}} zurück */
  function record(b) {
    var sc = score(b);
    var res = { score: sc, newHigh: false, unlocked: null, xp: null };
    store.games++;
    store.dmgTotal += Math.round(b.dmgTotal || 0);
    if (b.outcome === 'sieg') store.wins++; else if (b.outcome === 'verloren') store.losses++; else store.fled++;
    if (sc > store.highscore) { store.highscore = sc; res.newHigh = sc > 0; }
    var u = pickUnlock(b, store.unlocked);
    if (u) { store.unlocked.push(u.id); res.unlocked = u; }
    var xb = xpBreakdown(b);
    var info = addXp(xb.total);
    res.xp = { damage: xb.damage, rounds: xb.rounds, outcome: xb.outcome, bonus: xb.bonus, total: xb.total,
      startLevel: info.startLevel, startXp: info.startXp, endLevel: info.endLevel, endXp: info.endXp, levels: info.levels };
    saveStore();
    return res;
  }

  /* ---------- Öffentliche Logik-API ---------- */
  var Game = {
    PLACES: PLACES, FUNNY: FUNNY, C: C, PERKS: PERKS,
    rollOpponents: rollOpponents, rollPlaces: rollPlaces, rollItems: rollItems,
    startBattle: startBattle, roundActions: roundActions, act: act, score: score, pickUnlock: pickUnlock,
    animalHP: animalHP, hitChance: hitChance, firstUnlocked: firstUnlocked, funnyChance: funnyChance,
    xpNeed: xpNeed, xpBreakdown: xpBreakdown, addXp: addXp, perkLevel: pLevel, levelUpCards: levelUpCards, choosePerk: choosePerk,
    dropPending: dropPending, resetProgress: resetProgress, sanitizeProgress: sanitizeProgress, perkOffers: perkOffers,
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

  var G = { tab: 'play', step: 'opp', opts: null, opp: null, place: null, pick: null, pick2: null, battle: null, result: null, lvl: null,
    libFilter: 'alle', libSort: 'asc', acts: null, bannerRound: -1, xpPlayed: false, confirmReset: false };
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
  function reset() {
    G.step = store.pending > 0 ? 'levelup' : 'opp';
    G.opp = G.place = G.pick = G.pick2 = G.battle = G.result = G.lvl = null;
    G.xpPlayed = false; G.bannerRound = -1;
    G.opts = { opp: rollOpponents(), place: rollPlaces(), item: null };
  }

  function show() {
    init();
    if (!G.opts) reset();
    render();
    window.scrollTo(0, 0);
  }

  var TABS = ['play', 'lib', 'profile'];
  function render() {
    cancelAnim();
    var tabs = $('gameTabs').children;
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === G.tab);
    $('gamePlay').hidden = G.tab !== 'play';
    $('gameLib').hidden = G.tab !== 'lib';
    $('gameProfile').hidden = G.tab !== 'profile';
    renderXp();
    if (G.tab === 'play') renderPlay(); else if (G.tab === 'lib') renderLib(); else renderProfile();
  }

  /* ---------- XP-Leiste (oben) ---------- */
  function xpLabel(level, xp) { return level >= C.maxLevel ? 'Level ' + level + ' · MAX' : 'Level ' + level + ' · ' + xp + '/' + xpNeed(level) + ' XP'; }
  function xpPct(level, xp) { return level >= C.maxLevel ? 100 : clamp(Math.round(xp / xpNeed(level) * 100), 0, 100); }
  function renderXp() {
    var el = $('gameXp'); if (!el) return;
    el.innerHTML = '<div class="xp-line"><span class="xp-lv">' + esc(xpLabel(store.level, store.xp)) + '</span>' +
      (store.pending > 0 ? '<span class="xp-open">⭐ ' + store.pending + ' Fähigkeit' + (store.pending > 1 ? 'en' : '') + ' offen</span>' : '') + '</div>' +
      '<div class="xpbar"><div class="xpfill" style="width:' + xpPct(store.level, store.xp) + '%"></div></div>';
  }

  /* ---------- Spielen ---------- */
  function stepper() {
    var steps = [['opp', 'Gegner'], ['place', 'Ort'], ['item', 'Gegenstand'], ['battle', 'Kampf']];
    var cur = G.step === 'item2' ? 'item' : G.step;
    var idx = G.step === 'end' ? 4 : steps.map(function (s) { return s[0]; }).indexOf(cur);
    return '<ol class="g-steps">' + steps.map(function (s, i) { return '<li class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '">' + s[1] + '</li>'; }).join('') + '</ol>';
  }
  function renderPlay() {
    setTimeout(renderXp, 0); // nach dem Rendern: Leiste oben immer aktuell (auch nach XP-Vergabe im Ergebnis)
    if (!window.ITEMS || !window.ITEMS.length) { $('gamePlay').innerHTML = '<div class="card"><h2>Gegenstände fehlen</h2><p class="muted">items.js konnte nicht geladen werden.</p></div>'; return; }
    var h = '';
    if (G.step === 'levelup') h = viewLevelUp();
    else if (G.step === 'opp') h = stepper() + viewOpp();
    else if (G.step === 'place') h = stepper() + viewPlace();
    else if (G.step === 'item' || G.step === 'item2') h = stepper() + viewItem();
    else if (G.step === 'battle') h = stepper() + viewBattle();
    else h = viewEnd();
    $('gamePlay').innerHTML = h;
    bindPlay();
    if (G.step === 'battle') afterBattleRender();
    else if (G.step === 'end') afterEndRender();
  }

  function viewOpp() {
    var know = true; // Gefährlichkeit immer sichtbar
    return '<h2 class="g-h">Wähle deinen Gegner</h2><div class="g-cards">' + G.opts.opp.map(function (a, i) {
      return '<button type="button" class="gcard animal" data-opp="' + i + '"><span class="gc-emoji">' + esc(a.emoji) + '</span><span class="gc-body"><span class="gc-name">' + esc(a.name) + '</span>' +
        '<span class="gc-meta">' + esc(CAT_LABEL[a.category] || a.category) + ' · ' + fmtKg(a.weight) + ' · ' + a.speed + ' km/h</span>' +
        (know ? skulls(a.dangerTier) : '<span class="gc-meta unk">Gefährlichkeit: unbekannt ❓</span>') + '</span></button>';
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
    var second = G.step === 'item2';
    var cards = G.opts.item.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return !second || x.c !== G.pick; });
    return '<h2 class="g-h">' + (second ? '🎒 Und was noch? Zweiter Gegenstand' : 'Was nimmst du mit?') + '</h2>' +
      (second ? '<p class="muted small g-sub">Sein Spezialeffekt wird ein zusätzlicher Knopf im Kampf. Angriff und Verteidigung kommen vom ersten Gegenstand.</p>' : '') +
      '<div class="g-cards">' + cards.map(function (x) {
        return '<button type="button" class="gcard item r-' + esc(x.c.item.rarity) + '" data-item="' + x.i + '">' + itemCardMini(x.c.item, x.c.loan) + '</button>';
      }).join('') + '</div>' +
      (second ? '<button type="button" class="btn" data-act="skip-item2">Ohne zweiten Gegenstand losziehen</button>' : '<button type="button" class="btn" data-act="back-place">‹ Anderer Ort</button>');
  }

  /* ---------- Arena (Bühne + Animationen) ---------- */
  var DECOR = {
    feld: [['☁️', 8, 64, 30], ['☁️', 62, 70, 24], ['🌾', 34, 24, 26], ['🌾', 50, 21, 22], ['🌾', 88, 25, 26]],
    wald: [['🌲', 3, 27, 52], ['🌲', 20, 29, 42], ['🌲', 62, 29, 46], ['🌲', 84, 27, 54], ['🍄', 45, 15, 20]],
    savanne: [['☀️', 74, 62, 40], ['🌳', 28, 28, 42], ['🌾', 8, 22, 28], ['🌾', 42, 19, 24], ['🌾', 56, 23, 30], ['🌾', 90, 21, 26]],
    fluss: [['🌤️', 12, 64, 30], ['🪨', 52, 27, 26], ['🌿', 88, 29, 26], ['🌊', 4, 6, 34], ['🌊', 36, 4, 30], ['🌊', 68, 7, 34]],
    geroell: [['⛰️', 1, 28, 66], ['⛰️', 60, 26, 58], ['🪨', 36, 19, 24], ['🪨', 47, 17, 20], ['🪨', 90, 21, 24]],
    ikea: [['🛋️', 5, 27, 42], ['🛋️', 70, 27, 42], ['🪴', 46, 27, 28], ['🕯️', 90, 28, 22], ['➡️', 33, 8, 20]],
    ubahn: [['pole', 18], ['pole', 50], ['pole', 82], ['🚇', 30, 38, 62], ['🚉', 80, 58, 26]],
    bierzelt: [['bench', 22], ['bench', 62], ['🎉', 8, 64, 26], ['🎉', 48, 68, 26], ['🎉', 86, 64, 26], ['🍺', 14, 30, 30], ['🍺', 78, 30, 30], ['🎺', 46, 56, 26], ['🥨', 58, 22, 20]],
    huepfburg: [['🏰', 34, 26, 74, 'bounce'], ['🎈', 6, 54, 28, 'sway'], ['🎈', 84, 52, 30, 'sway'], ['🎈', 70, 66, 22, 'sway']],
    freibad: [['☀️', 80, 64, 34], ['🌴', 4, 29, 36], ['🏊', 30, 18, 28, 'bob'], ['🛟', 62, 22, 26, 'bob']],
    kuehlregal: [['shelf', 36], ['shelf', 58], ['🧊', 8, 30, 34], ['🧊', 40, 26, 30], ['🧊', 80, 30, 34], ['🥶', 62, 60, 24], ['🥛', 24, 56, 24]],
    wertstoff: [['♻️', 8, 34, 36], ['♻️', 76, 32, 40], ['🗑️', 40, 27, 30], ['🔩', 56, 17, 20], ['🛞', 90, 21, 26]]
  };
  function decorHtml(placeId) {
    return (DECOR[placeId] || []).map(function (d) {
      if (d[0] === 'pole') return '<i class="pole" style="left:' + d[1] + '%"></i>';
      if (d[0] === 'bench') return '<i class="bench" style="left:' + d[1] + '%"></i>';
      if (d[0] === 'shelf') return '<i class="shelf" style="bottom:' + d[1] + '%"></i>';
      return '<span class="dec' + (d[4] ? ' ' + d[4] : '') + '" style="left:' + d[1] + '%;bottom:' + d[2] + '%;font-size:' + d[3] + 'px">' + d[0] + '</span>';
    }).join('');
  }
  function perkIcons(b) {
    var out = [];
    PERKS.forEach(function (d) {
      if (d.instant) return;
      var l = b.pk[d.id] | 0; if (!l) return;
      out.push('<span class="pk-ico" title="' + esc(d.name + (d.max > 1 ? ' (Stufe ' + l + ')' : '')) + '">' + esc(d.emoji) + (d.max > 1 ? '<sup>' + l + '</sup>' : '') + '</span>');
    });
    if (b.aid > 0) out.push('<span class="pk-ico aid" title="Erste Hilfe bereit">⛑️</span>');
    return out.length ? '<div class="ar-perks" aria-label="Aktive Fähigkeiten">' + out.join('') + '</div>' : '';
  }
  function stageClasses(b) {
    var c = 'stage p-' + b.place.id;
    if (b.stun > 0) c += ' stunned';
    if (b.over) {
      c += ' over end-' + b.outcome;
      if (b.reason === 'kill') c += ' r-kill'; else if (b.reason === 'flee' || b.reason === 'giveup' || b.reason === 'bored') c += ' r-gone'; else if (b.reason === 'escape') c += ' r-escaped';
    }
    return c;
  }
  function fighterBar(kind, name, val, max) {
    var pct = Math.round(val / max * 100);
    return '<div class="fb ' + kind + '"><div class="fb-top"><span class="f-name">' + esc(name) + '</span><span class="f-hp" id="hp-' + kind + '">' + val + ' HP</span></div>' +
      '<div class="hpbar ' + kind + '"><div class="hpfill" id="bar-' + kind + '" style="width:' + pct + '%"></div></div></div>';
  }
  function viewBattle() {
    var b = G.battle;
    var head = '<div class="card arena">' +
      '<div class="ar-top"><span>' + esc(b.place.emoji) + ' ' + esc(b.place.name) + '</span><span>Runde ' + Math.min(b.round + (b.over ? 0 : 1), b.maxRounds) + '/' + b.maxRounds + '</span></div>' +
      '<div class="' + stageClasses(b) + '" id="stage" aria-label="Kampfarena">' +
      '<div class="st-deco">' + decorHtml(b.place.id) + '</div><div class="st-ground"></div>' +
      '<div class="actor human" id="aH"><div class="sprite"><span class="flip">🧍</span></div></div>' +
      '<div class="actor animal" id="aA"><div class="sprite"><span class="flip">' + esc(b.animal.emoji) + '</span></div><div class="stars" aria-hidden="true">💫</div></div>' +
      '<div class="fx" id="fx"></div><div class="trophy" aria-hidden="true">🏆</div></div>' +
      '<div class="ar-bars">' + fighterBar('h', 'Du', b.hp, b.hpMax) + fighterBar('a', b.animal.name, b.ahp, b.ahpMax) + '</div>' +
      '<div class="ar-item">' + esc(b.item.emoji) + ' ' + esc(b.item.name) + (b.item.special ? ' · ' + esc(b.item.special.label) + ' ' + b.item.usesLeft + 'x' : '') +
      (b.item2 ? ' &nbsp;+&nbsp; ' + esc(b.item2.emoji) + ' ' + esc(b.item2.name) + (b.item2.special ? ' · ' + esc(b.item2.special.label) + ' ' + b.item2.usesLeft + 'x' : '') : '') +
      (b.stun ? ' · 💫 Tier benommen' : '') + '</div>' + perkIcons(b) + '</div>';
    var acts = '';
    if (!b.over) {
      if (!G.acts) G.acts = roundActions(b);
      acts = '<div class="g-actions" id="gActions">' + G.acts.map(function (a) {
        return '<button type="button" class="gact' + (a.special ? ' special' : '') + (a.funny ? ' funny' : '') + (a.aid ? ' aid' : '') + '" data-action="' + esc(a.id) + '"><span class="ga-emoji">' + esc(a.emoji) + '</span><span class="ga-label">' + esc(a.label) + '</span><span class="ga-sub">' + esc(a.sub) + '</span></button>';
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
    var b = G.battle;
    if (b && !b.over && G.bannerRound !== b.round) { G.bannerRound = b.round; showBanner('Runde ' + (b.round + 1)); }
  }

  /* --- Animations-Werkzeuge --- */
  var anim = { token: 0, timers: [] };
  function reduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function later(fn, ms) {
    var tk = anim.token;
    var id = setTimeout(function () { if (tk === anim.token) fn(); }, ms);
    anim.timers.push(id);
  }
  function cancelAnim() { anim.token++; anim.timers.forEach(clearTimeout); anim.timers = []; busy = false; }
  function flash(el, cls, ms) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    later(function () { el.classList.remove(cls); }, ms);
  }
  function fxEl() { return $('fx'); }
  function spawn(html, cls, style, ms) {
    var fx = fxEl(); if (!fx) return null;
    var s = document.createElement('span'); s.className = cls; s.innerHTML = html;
    if (style) for (var k in style) { if (k.indexOf('--') === 0) s.style.setProperty(k, style[k]); else s.style[k] = style[k]; }
    fx.appendChild(s);
    later(function () { if (s.parentNode) s.parentNode.removeChild(s); }, ms || 1100);
    return s;
  }
  function floatTxt(side, text, kind, big) { return spawn(esc(text), 'flt ' + (kind || '') + (big ? ' big' : '') + ' at-' + side, null, 1200); }
  function boom(side, big) { return spawn('💥', 'boom at-' + side + (big ? ' big' : ''), null, 700); }
  function stageW() { var st = $('stage'); return st ? st.clientWidth : 320; }
  function proj(emoji, dir) {
    var d = Math.round(stageW() * 0.58);
    return spawn(esc(emoji), 'proj ' + (dir || 'r'), { '--dx': d + 'px' }, 800);
  }
  function setBarVal(kind, val, max) {
    var f = $('bar-' + kind), t = $('hp-' + kind);
    if (f) f.style.width = Math.round(clamp(val, 0, max) / max * 100) + '%';
    if (t) t.textContent = Math.max(0, Math.round(val)) + ' HP';
  }
  function showBanner(text) {
    var st = $('stage'); if (!st || reduced()) return;
    var el = document.createElement('div'); el.className = 'banner'; el.textContent = text;
    st.appendChild(el);
    later(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
  }
  function say(text) {
    return spawn(esc(text), 'bubble', null, 1300);
  }

  /* Aktionswirkung am Tier abspielen (Betäubung, Scheuchen, Ablenken, Treffer) – t = Startzeit */
  function effectAnim(eff, ok, t, A) {
    if (eff === 'stun') {
      if (ok) { later(function () { flash(A, 'stunfx', 1000); floatTxt('a', 'Benommen!', 'info'); }, t); }
      else later(function () { floatTxt('a', 'Wirkungslos', 'gray'); }, t);
    } else if (eff === 'scare' || eff === 'leave') {
      if (ok) { later(function () { flash(A, 'scared', 900); floatTxt('a', '❗', 'info big'); }, t); }
      else later(function () { flash(A, 'twitch', 500); floatTxt('a', 'Kalt gelassen', 'gray'); }, t);
    } else if (eff === 'distract') {
      if (ok) { later(function () { flash(A, 'lookaway', 1000); floatTxt('a', '👀', 'info big'); }, t); }
      else later(function () { floatTxt('a', 'Ignoriert', 'gray'); }, t);
    } else if (eff === 'escape') {
      if (ok) later(function () { $('aH').classList.add('runout'); }, t);
      else later(function () { flash($('aH'), 'stumble', 700); floatTxt('h', 'Zu langsam!', 'gray'); }, t);
    } else if (!ok) { later(function () { floatTxt('a', '…', 'gray'); }, t); }
  }

  var FUNNY_ANIM = {
    totstellen: ['faint', '💤'], tiktok: ['dance', '🎵'], servus: ['say', 'SERVUS!'], bairisch: ['say', 'Himmelherrgott!'],
    mietpreise: ['say', '24 € pro m²!'], steuer: ['say', 'Nachzahlung!'], groesser: ['grow', ''], brotzeit: ['throw', '🥨'],
    zureden: ['say', 'Ganz ruhig …'], rueckwaerts: ['back', ''], handy: ['prop', '📱'], formular: ['throw', '📝'],
    tourist: ['say', 'Where is Marienplatz?'], kiai: ['say', 'HAAIIYAA!'], wlan: ['say', 'WLAN-Passwort?'], blickkontakt: ['prop', '🙈']
  };

  /* Spieler-Phase: schedule ab t; gibt Dauer zurück */
  function playerPhase(b, ev, before, t) {
    var H = $('aH'), A = $('aA');
    if (ev.kind === 'attack') {
      later(function () { flash(H, 'lunge-r', 560); proj(b.item.emoji, 'r'); }, t);
      if (ev.hit) {
        later(function () { flash(A, 'hurt', 520); boom('a'); floatTxt('a', '−' + ev.dmg, 'dmg'); setBarVal('a', b.ahp, b.ahpMax); }, t + 330);
      } else {
        later(function () { flash(A, 'hop', 450); floatTxt('a', 'Daneben!', 'gray'); }, t + 330);
      }
      return 760;
    }
    if (ev.kind === 'dodge') {
      later(function () { flash(H, 'roll', 620); }, t);
      return 640;
    }
    if (ev.kind === 'heal') {
      later(function () { flash(H, 'glow', 900); floatTxt('h', '+' + ev.heal, 'heal'); spawn('✨', 'spark at-h', null, 900); setBarVal('h', Math.min(b.hpMax, before.hp + ev.heal), b.hpMax); }, t);
      return 860;
    }
    if (ev.kind === 'special') {
      var emo = ev.item.emoji, eff = ev.eff;
      if (eff === 'heal') {
        later(function () { flash(H, 'glow', 900); floatTxt('h', '+' + ev.heal, 'heal'); spawn('✨', 'spark at-h', null, 900); setBarVal('h', Math.min(b.hpMax, before.hp + ev.heal), b.hpMax); }, t);
        return 860;
      }
      if (eff === 'escape') {
        later(function () { proj(emo, 'up'); }, t);
        effectAnim('escape', ev.ok, t + 250, A);
        return 1000;
      }
      if (eff === 'damage') {
        later(function () { flash(H, 'lunge-r', 560); proj(emo, 'r'); }, t);
        if (ev.ok) later(function () { flash(A, 'hurt', 650); boom('a', true); flash($('stage'), 'shake', 400); floatTxt('a', '−' + ev.dmg, 'dmg', true); setBarVal('a', b.ahp, b.ahpMax); }, t + 340);
        else later(function () { flash(A, 'hop', 450); floatTxt('a', 'Daneben!', 'gray'); }, t + 340);
        return 820;
      }
      later(function () { flash(H, 'lunge-r', 460); proj(emo, eff === 'distract' ? 'up' : 'r'); }, t);
      effectAnim(eff, ev.ok, t + 380, A);
      return 940;
    }
    if (ev.kind === 'funny') {
      var fa = FUNNY_ANIM[ev.fid] || ['say', '…'];
      var kind = fa[0];
      if (kind === 'say') later(function () { say(fa[1]); flash(H, ev.fid === 'kiai' ? 'shakeH' : 'hop', 500); }, t);
      else if (kind === 'faint') later(function () { flash(H, 'faint', 1100); floatTxt('h', '💤', 'big'); }, t);
      else if (kind === 'dance') later(function () { flash(H, 'dance', 1000); floatTxt('h', '🎵', 'big'); spawn('🎶', 'note at-h', null, 1000); }, t);
      else if (kind === 'grow') later(function () { flash(H, 'grow', 900); floatTxt('h', '🙆', 'big'); }, t);
      else if (kind === 'back') later(function () { flash(H, 'backstep', 900); }, t);
      else if (kind === 'throw') later(function () { flash(H, 'lunge-r', 460); proj(fa[1], 'r'); }, t);
      else if (kind === 'prop') later(function () { flash(H, 'hop', 500); floatTxt('h', fa[1], 'big'); }, t);
      effectAnim(ev.feff, ev.ok, t + 650, A);
      return 1100;
    }
    return 0;
  }

  /* Tier-Phase */
  function animalPhase(b, ev, before, t) {
    var H = $('aH'), A = $('aA');
    if (ev.animal === 'none') return 0;
    if (ev.animal === 'stunned') {
      later(function () { flash(A, 'wobble', 700); floatTxt('a', '💫 setzt aus', 'info'); }, t);
      return 720;
    }
    var dist = Math.round(stageW() * 0.52);
    later(function () { if (A) A.style.setProperty('--dist', dist + 'px'); flash(A, 'lunge-l', 640); }, t);
    if (ev.animal === 'hit') {
      later(function () {
        spawn('<b></b><b></b><b></b>', 'claws at-h', null, 600); boom('h');
        flash($('stage'), 'shake', 420); flash(H, 'blink', 700);
        floatTxt('h', '−' + ev.dmgH, 'dmg'); setBarVal('h', b.hp, b.hpMax);
      }, t + 300);
    } else {
      later(function () {
        if (ev.evaded) { flash(H, 'sidestep', 520); floatTxt('h', 'Ausgewichen!', 'good'); }
        else floatTxt('h', 'Verfehlt', 'gray');
      }, t + 300);
    }
    return 700;
  }

  /* Kampfende */
  function confetti() {
    var cols = ['#f43f5e', '#22d3ee', '#fbbf24', '#34d399', '#a78bfa', '#fb923c'], h = '';
    for (var i = 0; i < 34; i++) {
      h += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (Math.random() * 0.5).toFixed(2) + 's;animation-duration:' + (1.3 + Math.random() * 0.9).toFixed(2) + 's;--rx:' + Math.round(Math.random() * 60 - 30) + 'px"></i>';
    }
    spawn(h, 'confetti', null, 2600);
  }
  function endPhase(b, t) {
    var st = $('stage'), H = $('aH'), A = $('aA');
    if (b.outcome === 'sieg') {
      if (b.reason === 'kill') later(function () { A.classList.add('fall'); }, t);
      else later(function () { A.classList.add(b.reason === 'giveup' ? 'walkoff' : 'runoff'); }, t);
      later(function () { confetti(); if (st) st.classList.add('trophy-on'); }, t + 450);
      return 1900;
    }
    if (b.outcome === 'geflohen') {
      if (b.reason === 'bored') later(function () { A.classList.add('walkoff'); }, t);
      return b.reason === 'bored' ? 1200 : 300;
    }
    // verloren
    later(function () { if (st) st.classList.add('to-gray'); H.classList.add('down'); }, t);
    later(function () { spawn('🚑', 'ambu', null, 1800); }, t + 400);
    return 2000;
  }

  /* Eine Runde animiert abspielen; danach vollständig neu rendern */
  function playTurn(b, ev, before) {
    var done = function () { busy = false; renderPlay(); };
    if (reduced() || !$('stage')) { setBarVal('a', b.ahp, b.ahpMax); setBarVal('h', b.hp, b.hpMax); later(done, 150); return; }
    var stg = $('stage'); stg.style.setProperty('--dist', Math.round(stageW() * 0.52) + 'px');
    var t = 60;
    t += playerPhase(b, ev, before, t);
    t += 120;
    t += animalPhase(b, ev, before, t);
    if (b.over) { t += 150; t += endPhase(b, t); }
    t += 200;
    // Sicherheit: Leisten zum Schluss auf den echten Stand setzen
    later(function () { setBarVal('a', b.ahp, b.ahpMax); setBarVal('h', b.hp, b.hpMax); }, t - 100);
    later(done, t);
  }

  /* ---------- Ergebnis ---------- */
  function xpRows(x, b) {
    var tier = clamp(b.animal.dangerTier, 1, 5);
    var outLabel = b.outcome === 'sieg' ? (b.reason === 'kill' ? 'Sieg (×' + tier + ' Gefährlichkeit)' : 'Tier geflohen/aufgegeben (×' + tier + ')') : b.outcome === 'geflohen' ? 'Selbst geflohen (×' + tier + ')' : 'Niederlage';
    var rows = [['Schaden am Tier', x.damage], ['Überlebte Runden', x.rounds], [outLabel, x.outcome], ['Witziger Gegenstand genutzt', x.bonus]];
    return rows.map(function (r) { return '<div class="xp-row' + (r[1] ? '' : ' zero') + '"><span>' + esc(r[0]) + '</span><b>+' + r[1] + '</b></div>'; }).join('') +
      '<div class="xp-row tot"><span>Gesamt</span><b>+' + x.total + ' XP</b></div>';
  }
  function viewEnd() {
    var b = G.battle, r = G.result, x = r.xp;
    var meta = {
      sieg: ['🏆', 'Gesiegt', 'win'], geflohen: ['💨', 'Geflohen', 'fled'], verloren: ['🏥', 'Verloren', 'lose']
    }[b.outcome];
    var unl = r.unlocked ? '<div class="card g-unlock"><h2>Neu freigeschaltet</h2><div class="gcard item r-' + esc(r.unlocked.rarity) + '" style="cursor:default">' + itemCardMini(r.unlocked, false) + '</div></div>' : '';
    var startPct = G.xpPlayed ? xpPct(x.endLevel, x.endXp) : xpPct(x.startLevel, x.startXp);
    var cap = G.xpPlayed ? xpLabel(x.endLevel, x.endXp) : xpLabel(x.startLevel, x.startXp);
    var xpCard = '<div class="card g-xp"><h2>Erfahrung</h2>' + xpRows(x, b) +
      '<div class="xpbar big"><div class="xpfill" id="endXpFill" style="width:' + startPct + '%"></div></div><div class="xp-cap" id="endXpCap">' + esc(cap) + '</div>' +
      (x.levels > 0 ? '<div class="xp-lvup">🎉 ' + (x.levels > 1 ? x.levels + ' Level-Aufstiege' : 'Level-Aufstieg') + '!</div>' : '') + '</div>';
    var btns = store.pending > 0
      ? '<button type="button" class="btn primary pulse" data-act="levelup">⭐ Level Up! Fähigkeit wählen</button>'
      : '<button type="button" class="btn primary" data-act="again">Nochmal</button>';
    return '<div class="card g-end ' + meta[2] + '"><div class="ge-emoji">' + meta[0] + '</div><div class="ge-title">' + meta[1] + '</div>' +
      '<p class="ge-text">' + esc(b.endText) + '</p>' +
      '<div class="ge-score"><span>' + r.score + '</span> Punkte' + (r.newHigh ? ' <b class="newhigh">Neuer Highscore!</b>' : '') + '</div>' +
      '<div class="muted small">' + esc(b.animal.name) + ' · ' + esc(b.place.name) + ' · ' + esc(b.item.name) + ' · ' + b.hp + ' HP übrig' + '</div></div>' + xpCard + unl +
      gameStats() +
      '<div class="g-endbtns">' + btns + '<button type="button" class="btn" data-act="lib">Gegenstände ansehen</button></div>';
  }
  function afterEndRender() {
    var x = G.result && G.result.xp;
    if (!x || G.xpPlayed) return;
    G.xpPlayed = true;
    var fill = $('endXpFill'), cap = $('endXpCap');
    if (!fill) return;
    if (reduced()) { fill.style.width = xpPct(x.endLevel, x.endXp) + '%'; if (cap) cap.textContent = xpLabel(x.endLevel, x.endXp); return; }
    var t = 450, lv = x.startLevel, i;
    for (i = 0; i < x.levels; i++) {
      (function (lvl) {
        later(function () { fill.style.width = '100%'; }, t);
        later(function () {
          fill.classList.add('nt'); fill.style.width = '0%'; void fill.offsetWidth; fill.classList.remove('nt');
          if (cap) cap.textContent = xpLabel(lvl + 1, 0);
        }, t + 750);
      })(lv);
      lv++; t += 900;
    }
    later(function () { fill.style.width = xpPct(x.endLevel, x.endXp) + '%'; if (cap) cap.textContent = xpLabel(x.endLevel, x.endXp); }, t);
  }
  function gameStats() {
    var s = store;
    return '<div class="card g-stats"><div><b>' + s.highscore + '</b><span>Highscore</span></div><div><b>' + s.wins + '</b><span>Siege</span></div><div><b>' + s.losses + '</b><span>Niederlagen</span></div><div><b>' + s.fled + '</b><span>Geflohen</span></div></div>';
  }

  /* ---------- Level-Up ---------- */
  function viewLevelUp() {
    if (!G.lvl) G.lvl = { cards: levelUpCards(), done: null };
    var lv = G.lvl;
    if (!lv.done && !lv.cards.length) { dropPending(); setTimeout(function () { reset(); renderXp(); renderPlay(); }, 0); return '<div class="card"><p class="muted">Alle Fähigkeiten gelernt.</p></div>'; }
    var curLevel = Math.max(2, store.level - store.pending + 1);
    var head = '<div class="lvl-burst"><div class="lvl-rays"></div><div class="lvl-star">⭐</div><div class="lvl-title">Level Up!</div><div class="lvl-num">Level ' + (lv.done ? lv.level : curLevel) + '</div></div>';
    if (lv.done) {
      var d = lv.done, p = d.perk;
      var body = '<div class="card lvl-done"><div class="ld-emoji">' + esc(p.emoji) + '</div><div class="ld-name">' + esc(p.name) + (p.max > 1 && !p.instant ? ' · Stufe ' + d.level : '') + '</div>' +
        '<p class="ld-text">' + esc(p.text(d.level || 1)) + '</p>' +
        (d.item ? '<div class="gcard item r-' + esc(d.item.rarity) + '" style="cursor:default">' + itemCardMini(d.item, false) + '</div>' : '') + '</div>';
      var more = store.pending > 0;
      return head + body + '<button type="button" class="btn primary" data-act="lvl-next">' + (more ? 'Nächste Wahl (noch ' + store.pending + ')' : 'Weiter zum nächsten Kampf') + '</button>';
    }
    var cards = lv.cards.map(function (id, i) {
      var p = perkDef(id), l = pLevel(id), next = l + 1;
      var tag = p.instant ? 'Fund' : p.kind;
      var lvlTxt = p.instant ? '' : (p.max > 1 ? '<span class="pc-lv">Stufe ' + next + '/' + p.max + '</span>' : '');
      var inner = '<span class="pc-emoji">' + esc(p.emoji) + '</span><span class="pc-body"><span class="pc-name">' + esc(p.name) + '</span>' +
        '<span class="pc-tags"><span class="tag">' + esc(tag) + '</span>' + lvlTxt + '</span><span class="pc-text">' + esc(p.text(next)) + '</span></span>';
      if (p.choice) {
        return '<div class="pcard choice" style="animation-delay:' + (0.15 + i * 0.12) + 's">' + inner +
          '<span class="pc-opts">' + p.options.map(function (o) { return '<button type="button" class="pc-opt" data-perk="' + esc(id) + '" data-sub="' + esc(o.id) + '"><b>' + esc(o.label) + '</b><span>' + esc(o.sub) + '</span></button>'; }).join('') + '</span></div>';
      }
      return '<button type="button" class="pcard" data-perk="' + esc(id) + '" style="animation-delay:' + (0.15 + i * 0.12) + 's">' + inner + '</button>';
    }).join('');
    return head + '<p class="muted small center lvl-hint">Wähle eine Fähigkeit' + (store.pending > 1 ? ' (noch ' + store.pending + ' Wahlen offen)' : '') + '.</p><div class="g-cards perk-cards">' + cards + '</div>';
  }

  /* ---------- Profil ---------- */
  function renderProfile() {
    var s = store;
    var perks = PERKS.filter(function (d) { return !d.instant && pLevel(d.id) > 0; });
    var list = perks.length ? perks.map(function (d) {
      var l = pLevel(d.id);
      return '<div class="pf-perk"><span class="pf-ico">' + esc(d.emoji) + '</span><div><b>' + esc(d.name) + '</b>' + (d.max > 1 ? ' <span class="tag">Stufe ' + l + '/' + d.max + '</span>' : '') + '<div class="small muted">' + esc(d.text(l)) + '</div></div></div>';
    }).join('') : '<p class="muted small">Noch keine Fähigkeiten. Mit jedem Level-Aufstieg wählst du eine von drei Karten.</p>';
    var h = '<div class="card pf-head"><div class="pf-lvl">Level ' + s.level + '</div><div class="xpbar big"><div class="xpfill" style="width:' + xpPct(s.level, s.xp) + '%"></div></div><div class="xp-cap">' + esc(xpLabel(s.level, s.xp)) + (s.level < C.maxLevel ? ' · ' + (xpNeed(s.level) - s.xp) + ' XP bis Level ' + (s.level + 1) : '') + '</div>' +
      (s.pending > 0 ? '<button type="button" class="btn primary pulse" data-pf="levelup">⭐ ' + s.pending + ' Fähigkeit' + (s.pending > 1 ? 'en' : '') + ' wählen</button>' : '') + '</div>' +
      '<div class="card g-stats pf-stats"><div><b>' + s.games + '</b><span>Kämpfe</span></div><div><b>' + s.wins + '</b><span>Siege</span></div><div><b>' + s.losses + '</b><span>Niederlagen</span></div><div><b>' + s.fled + '</b><span>Geflohen</span></div>' +
      '<div><b>' + s.highscore + '</b><span>Highscore</span></div><div><b>' + s.xpTotal + '</b><span>XP gesamt</span></div><div><b>' + s.dmgTotal + '</b><span>Schaden</span></div><div><b>' + (store.unlocked || []).length + '/' + items().length + '</b><span>Gegenstände</span></div></div>' +
      '<div class="card"><h2>Fähigkeiten</h2>' + list + '</div>' +
      '<button type="button" class="btn danger" data-pf="reset">Fortschritt zurücksetzen</button>' +
      '<p class="muted small center pf-note">Setzt Level, XP und Fähigkeiten zurück. Statistik und freigeschaltete Gegenstände bleiben.</p>' +
      (G.confirmReset ? '<div class="g-modal" role="dialog" aria-modal="true" aria-label="Fortschritt zurücksetzen"><div class="gm-box"><h2>Wirklich zurücksetzen?</h2><p>Level, XP und alle Fähigkeiten gehen verloren. Das lässt sich nicht rückgängig machen.</p>' +
        '<div class="gm-btns"><button type="button" class="btn" data-pf="cancel">Abbrechen</button><button type="button" class="btn danger" data-pf="confirm">Ja, zurücksetzen</button></div></div></div>' : '');
    var el = $('gameProfile');
    el.innerHTML = h;
    el.onclick = function (ev) {
      var t = ev.target.closest('button'); if (!t) return;
      var v = t.getAttribute('data-pf');
      if (v === 'reset') { G.confirmReset = true; renderProfile(); }
      else if (v === 'cancel') { G.confirmReset = false; renderProfile(); }
      else if (v === 'confirm') { G.confirmReset = false; resetProgress(); reset(); render(); window.scrollTo(0, 0); }
      else if (v === 'levelup') { G.tab = 'play'; G.step = 'levelup'; G.lvl = null; render(); window.scrollTo(0, 0); }
    };
  }

  function startFight() {
    var it = G.pick, it2 = G.pick2;
    G.battle = startBattle(G.opp, G.place, it.item, it.loan, it2 && it2.item, it2 && it2.loan);
    G.acts = null; G.bannerRound = -1;
    G.step = 'battle'; renderPlay(); window.scrollTo(0, 0);
  }
  var busy = false;
  function bindPlay() {
    var root = $('gamePlay');
    root.onclick = function (ev) {
      var t = ev.target.closest('button'); if (!t || busy) return;
      var v;
      if ((v = t.getAttribute('data-opp')) != null) { G.opp = G.opts.opp[+v]; G.step = 'place'; renderPlay(); window.scrollTo(0, 0); }
      else if ((v = t.getAttribute('data-place')) != null) { G.place = G.opts.place[+v]; G.opts.item = rollItems(store.unlocked); G.pick2 = null; G.step = 'item'; renderPlay(); window.scrollTo(0, 0); }
      else if ((v = t.getAttribute('data-item')) != null) {
        if (G.step === 'item2') { G.pick2 = G.opts.item[+v]; startFight(); }
        else { G.pick = G.opts.item[+v]; G.pick2 = null; if (pLevel('zweiter') && G.opts.item.length > 1) { G.step = 'item2'; renderPlay(); window.scrollTo(0, 0); } else startFight(); }
      }
      else if ((v = t.getAttribute('data-action')) != null) {
        var b = G.battle; if (!b || b.over) return;
        busy = true;
        var ac = $('gActions'); if (ac) ac.classList.add('locked');
        var before = { hp: b.hp, ahp: b.ahp };
        var res = act(b, v); G.acts = null;
        if (b.over) { G.result = record(b); G.xpPlayed = false; }
        playTurn(b, res.ev, before);
      }
      else if ((v = t.getAttribute('data-perk')) != null) { chooseCard(v, t.getAttribute('data-sub')); }
      else if ((v = t.getAttribute('data-act')) != null) {
        if (v === 'rand-opp') { G.opp = pick(animals()); G.step = 'place'; renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'back-opp') { G.step = 'opp'; renderPlay(); }
        else if (v === 'back-place') { G.step = 'place'; renderPlay(); }
        else if (v === 'skip-item2') { G.pick2 = null; startFight(); }
        else if (v === 'to-end') { G.step = 'end'; renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'again') { reset(); renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'levelup') { G.step = 'levelup'; G.lvl = null; renderPlay(); window.scrollTo(0, 0); }
        else if (v === 'lvl-next') {
          if (store.pending > 0) { G.lvl = null; renderXp(); renderPlay(); }
          else { reset(); renderXp(); renderPlay(); }
          window.scrollTo(0, 0);
        }
        else if (v === 'lib') { G.tab = 'lib'; render(); window.scrollTo(0, 0); }
      }
    };
  }
  function chooseCard(id, sub) {
    if (!G.lvl || G.lvl.done) return;
    var out = choosePerk(id, sub);
    if (!out) return;
    G.lvl.done = { perk: out.perk, item: out.item, level: out.level };
    G.lvl.level = Math.max(2, store.level - store.pending);
    renderXp(); renderPlay(); window.scrollTo(0, 0);
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
