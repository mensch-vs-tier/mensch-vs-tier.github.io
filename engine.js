/* Mensch vs. Tier – Berechnungs- und Simulations-Engine (global window.Engine) */
(function (root) {
  'use strict';

  var FIT = { untrainiert: 0.7, durchschnitt: 1, athlet: 1.3, kampfsport: 1.6 };
  var MIND = { panik: 0.6, normal: 1, todesangst: 1.25 };
  var HUMAN_SPEED = { untrainiert: 25, durchschnitt: 28, athlet: 35, kampfsport: 31 };
  var WEAPON_BONUS = {
    klauen: 0.25, reisszaehne: 0.25, gift: 0, masse: 0.15, wuergen: 0.2, hoerner: 0.25,
    tritte: 0.15, schnabel: 0.1, stacheln: 0.1, todesrolle: 0.4, schlaege: 0.2
  };
  var WEAPON_LABEL = {
    klauen: 'Klauen', reisszaehne: 'Reißzähne', gift: 'Gift', masse: 'Masse', wuergen: 'Würgen',
    hoerner: 'Hörner', tritte: 'Tritte', schnabel: 'Schnabel', stacheln: 'Stacheln',
    todesrolle: 'Todesrolle', schlaege: 'Schläge'
  };
  var HUMAN_WEAPON_LABEL = {
    unbewaffnet: 'Unbewaffnet', ast: 'Ast', steine: 'Steine', messer: 'Messer', machete: 'Machete',
    speer: 'Speer', pfefferspray: 'Pfefferspray', kleinkaliber: 'Kleinkaliber', grosskaliber: 'Großkaliber'
  };
  var MAMMALS = ['raubkatzen', 'baeren', 'hundeartige', 'huftiere', 'primaten', 'nagetiere'];

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function rnd(x) { return Math.round(x); }
  function isFirearm(w) { return w === 'kleinkaliber' || w === 'grosskaliber'; }
  function biteFactor(b) { return Math.pow(Math.max(b || 0, 15) / 200, 0.25); }
  function fmtPct(p) {
    if (p < 1) return '<1 %';
    if (p > 99) return '>99 %';
    return (p >= 10 ? String(Math.round(p)) : String(Math.round(p * 10) / 10).replace('.', ',')) + ' %';
  }
  function fmtKg(x) { return (x >= 100 ? String(rnd(x)) : x >= 1 ? String(Math.round(x * 10) / 10).replace('.', ',') : String(x).replace('.', ',')); }

  function sprayBase(a, env, human) {
    if (env === 'wasser') return 0;
    var p;
    if (MAMMALS.indexOf(a.category) >= 0) {
      // Belegt v. a. für Bären (Smith et al. 2008: ~90 % gestoppt) und Hunde/Wölfe;
      // für Großkatzen kaum Daten, bei Dickhäutern trägt der Schwung des Angriffs weiter.
      if (a.category === 'baeren') p = 0.88;
      else if (a.category === 'hundeartige') p = 0.85;
      else if (a.category === 'raubkatzen') p = 0.65;
      else if (a.category === 'primaten') p = 0.75;
      else p = 0.8;
      if (a.category !== 'baeren' && a.weight > 600) p = 0.2;       // Flusspferd, Nashorn, Elefant, Büffel, Walross
      else if (a.category !== 'baeren' && a.weight > 300) p *= 0.6; // Elch, Pferd
    }
    else if (a.category === 'voegel') p = 0.3;
    else p = 0.04; // Reptilien, Insekten, Wassertiere
    if (env === 'wald' || env === 'gebirge') p *= 0.93; else p *= 0.96;
    if (human.mindset === 'panik') p *= 0.88;
    return p;
  }

  /* ---------- Giftkleintiere: Sieg über Biss-Wahrscheinlichkeit x Giftletalität ---------- */
  function computeVenom(hw, a, human, env) {
    var wp = human.weapon || 'unbewaffnet';
    var wf = { unbewaffnet: 1, ast: 0.6, steine: 0.7, messer: 0.85, machete: 0.6, speer: 0.5, pfefferspray: 1.0, kleinkaliber: 0.3, grosskaliber: 0.25 }[wp] || 1;
    var fitF = { untrainiert: 1.15, durchschnitt: 1, athlet: 0.9, kampfsport: 0.8 }[human.fitness] || 1;
    var mindF = { panik: 1.2, normal: 1, todesangst: 0.9 }[human.mindset] || 1;
    var envF = env === 'wasser' ? (a.aquatic > 0.3 ? 1.3 : 0.9) : env === 'savanne' ? 1.1 : env === 'gebirge' ? 1.05 : 1;
    var pBite = (0.2 + a.agility * 0.04) * (1 + a.ambush * 0.3) * wf * fitF * mindF * envF;
    if (a.weight < 0.5) pBite *= 0.8; // winziges Ziel, leicht zu zertreten
    pBite = clamp(pBite, 0.02, 0.9);
    var pAnimal = clamp(pBite * a.venom * 0.95, 0.001, 0.999);
    var pHuman = clamp(1 - pAnimal, 0.001, 0.999);
    var f = [];
    f.push({ text: 'Giftbiss: ' + (a.venom >= 0.5 ? 'tödlich ohne Antiserum' : 'selten tödlich, aber gefährlich') + ' (Letalität ' + rnd(a.venom * 100) + ' %)', impact: '-', w: 9 * a.venom + 1 });
    f.push({ text: 'Biss-/Stichwahrscheinlichkeit ca. ' + rnd(pBite * 100) + ' % pro Begegnung', impact: '-', w: pBite * 8 });
    if (a.weight < 15) f.push({ text: 'Kleines Ziel (' + fmtKg(a.weight) + ' kg): kraftmäßig kein Gegner, jede Waffe reicht', impact: '+', w: 3 });
    if (wf <= 0.6) f.push({ text: HUMAN_WEAPON_LABEL[wp] + ': Reichweite hält das Tier auf Distanz (Bissrisiko ×' + wf + ')', impact: '+', w: 4 });
    else if (wp === 'unbewaffnet') f.push({ text: 'Unbewaffnet: Nahkontakt nötig, volles Bissrisiko', impact: '-', w: 4 });
    if (a.ambush > 0.5) f.push({ text: 'Überraschungsangriff aus der Deckung (Tarnwert ' + rnd(a.ambush * 100) + ' %)', impact: '-', w: 3 });
    if (a.agility >= 8) f.push({ text: 'Blitzschneller Angriff (Beweglichkeit ' + a.agility + '/10)', impact: '-', w: 2.5 });
    if (f.length < 3) f.push({ text: 'Bei Giftkleintieren entscheidet Vorsicht, nicht Kraft (Tempo ' + a.speed + ' km/h)', impact: '-', w: 0.5 });
    if (fitF < 1) f.push({ text: 'Training: bessere Reflexe (Bissrisiko ×' + fitF + ')', impact: '+', w: 2 });
    return finish(pHuman, f, { mode: 'gift', pBite: pBite, venom: a.venom });
  }

  function finish(pHuman, factors, details) {
    pHuman = clamp(pHuman, 0.001, 0.999);
    var h = Math.round(pHuman * 1000) / 10;
    h = clamp(h, 0.1, 99.9);
    factors.sort(function (x, y) { return y.w - x.w; });
    var out = factors.slice(0, 4).map(function (x) { return { text: x.text, impact: x.impact }; });
    details.pHuman = pHuman;
    return { humanPct: h, animalPct: Math.round((100 - h) * 10) / 10, factors: out, details: details };
  }

  /* ---------- Hauptberechnung ---------- */
  function compute(human, animal, env) {
    human = human || {};
    env = env || 'feld';
    var hw = clamp(+human.weight || 80, 50, 130);
    var a = animal;
    if (a.venom > 0 && a.weight < 15) return computeVenom(hw, a, human, env);

    var fit = FIT[human.fitness] || 1;
    var mind = MIND[human.mindset] || 1;
    var wp = human.weapon || 'unbewaffnet';
    var firearm = isFirearm(wp);
    var armor = a.armor || 0;
    var f = [];

    /* Tier-Kampfkraft */
    var wb = 0;
    (a.weapons || []).forEach(function (w) { wb += WEAPON_BONUS[w] || 0; });
    wb = Math.min(wb, 1.2);
    var wTerm = Math.pow(a.weight, 0.75);
    if (firearm && a.weight > 300) wTerm = Math.pow(300, 0.75) * Math.pow(a.weight / 300, 0.35); // Treffer zählt, nicht Masse
    var A = wTerm * (1 + wb) * biteFactor(a.biteForce) * (0.6 + a.aggression / 25) * (0.7 + a.agility / 30);
    if (a.venom > 0) A *= 1 + a.venom * 0.8;
    if (a.weight > hw) A *= Math.pow(a.weight / hw, 0.1);

    var envNote = null;
    if (env === 'savanne') A *= 1 + a.ambush * 0.25;
    if (env === 'wasser') {
      if (a.aquatic >= 0.2) A *= 1 + a.aquatic * 1.8; else A *= 0.85;
    }
    if (env === 'wald' && a.weight > 300) A *= 0.85;
    if (env === 'gebirge' && a.weight > 300) A *= 0.85;

    /* Mensch-Kampfkraft inkl. Waffe */
    var m = 1, W, kind = 'melee', acc = 1, reachNote = null, weaponNote = null;
    var heavyOrVenom = a.weight >= 400 || a.venom > 0.3;
    switch (wp) {
      case 'ast': m = 1.8; if (env === 'wald') m *= 1.15; if (env === 'wasser') m *= 0.8; break;
      case 'steine': m = env === 'gebirge' ? 2.2 : 1.5; if (env === 'wasser') m *= 0.5; break;
      case 'messer': m = 1 + 1.2 * (1 - 0.7 * armor); if (env === 'wasser') m = 1 + (m - 1) * 0.85; break;
      case 'machete': m = 1 + 2 * (1 - 0.5 * armor); if (env === 'wasser') m = 1 + (m - 1) * 0.85; break;
      case 'speer':
        m = 5;
        if (!heavyOrVenom) { m *= 1.2; reachNote = 'Reichweitenvorteil'; } else if (a.weight >= 400) m *= 0.85; else m *= 0.9;
        if (env === 'wald') m *= 1.1;
        if (env === 'wasser') m *= 0.75;
        break;
      case 'pfefferspray': m = 1; kind = 'spray'; break;
      case 'kleinkaliber': kind = 'firearm'; m = 1 + 5 * (1 - 0.6 * armor); break;
      case 'grosskaliber': kind = 'firearm'; m = 1 + 24 * (1 - 0.35 * armor); break;
      default: m = 1;
    }
    var effFit = fit;
    if (kind === 'firearm') {
      acc = clamp(1.15 - a.agility * 0.05 - (a.speed > 55 ? 0.08 : 0), 0.4, 1);
      if (env === 'wasser') acc *= 0.8;
      if (armor >= 0.7 && a.weight > 1000) acc *= 0.45; // Dickhäuter: Treffer müssen exakt sitzen (Schädel, Herz)
      W = m * acc;
      effFit = 1 + (fit - 1) * 0.25;
    } else {
      W = 0.4 * Math.pow(m, 0.65);
    }
    if (env === 'wasser') W *= kind === 'firearm' ? 0.9 : 0.7; // kein Halt im Wasser
    var H = Math.pow(hw, 0.75) * effFit * mind * W;

    /* Gewinnchance Mensch */
    var r = A / H;
    var p = 1 / (1 + Math.pow(r, 2));

    /* Flucht des Tieres */
    var eff = (kind === 'firearm' || m >= 1.7 || a.weight < 0.6 * hw) ? 1 : (a.weight > 2.5 * hw ? 0.08 : 0.35);
    var fleeGain = (1 - p) * (a.fleeTendency || 0) * 0.25 * eff;
    p += fleeGain;

    /* Klettern / Weglaufen als Überleben */
    var escape = 0, climbNote = null;
    if (env === 'wald' && !a.climbs) { escape += 0.12 * (fit >= 1.3 ? 1.15 : 1); climbNote = 'Klettermöglichkeit im Wald'; }
    if (env !== 'wasser') {
      var hs = HUMAN_SPEED[human.fitness] || 28;
      if (a.speed < hs) escape += Math.min(0.3, (hs - a.speed) / hs * 0.5) * (1 - a.ambush * 0.6);
    }
    if (env === 'gebirge' && !a.climbs && a.weight > 100) escape += 0.1;
    escape = clamp(escape, 0, 0.45);
    p += (1 - p) * escape;

    /* Gebirge: Sturzrisiko */
    if (env === 'gebirge') {
      p *= 0.97;
      if (a.weight > 300) p += (1 - p) * 0.03;
    }

    /* Pfefferspray */
    var pSpray = 0;
    if (kind === 'spray') {
      pSpray = sprayBase(a, env, human);
      p = 1 - (1 - p) * (1 - pSpray);
    }

    /* Faktoren */
    var diff = a.weight - hw;
    if (diff > 0.5 * hw) f.push({ text: 'Kritischer Massennachteil (−' + rnd(diff) + ' kg)', impact: '-', w: Math.min(10, 2 + diff / hw * 1.5) });
    else if (diff < -1.5 * hw / 1.5 && a.weight < hw * 0.5) f.push({ text: 'Gewichtsvorteil (+' + rnd(-diff) + ' kg gegenüber dem Tier)', impact: '+', w: Math.min(7, 2 + (-diff) / hw * 3) });
    else if (Math.abs(diff) <= 0.5 * hw) f.push({ text: 'Ähnliche Gewichtsklasse (' + rnd(hw) + ' kg gegen ' + fmtKg(a.weight) + ' kg)', impact: '+', w: 1.2 });

    if (kind === 'melee' && wp === 'unbewaffnet' && a.weight > 0.4 * hw) f.push({ text: 'Fehlende Stoppwirkung ohne Reichweitenwaffe', impact: '-', w: 5.5 });
    if (wp === 'speer') {
      if (reachNote) f.push({ text: 'Speer: Reichweitenvorteil (×' + (Math.round(m * 10) / 10) + ' Kampfwert)', impact: '+', w: 6 });
      else f.push({ text: 'Speer gegen ' + (a.venom > 0.3 ? 'Giftträger' : 'Schwergewicht (' + fmtKg(a.weight) + ' kg)') + ' nur eingeschränkt wirksam', impact: '-', w: 4 });
    }
    if ((wp === 'messer' || wp === 'machete') && armor >= 0.4) f.push({ text: (wp === 'messer' ? 'Messer' : 'Machete') + ' kaum wirksam gegen ' + (a.category === 'baeren' || armor < 0.7 ? 'dicke Fettschicht und Fell' : 'dicke Haut und Panzer') + ' (Panzerung ' + rnd(armor * 100) + ' %)', impact: '-', w: 5 + armor * 2 });
    else if (wp === 'messer' || wp === 'machete') f.push({ text: (wp === 'messer' ? 'Messer' : 'Machete') + ': Nahkampfwaffe, aber Tier bleibt nah genug zum Zubeißen', impact: '+', w: 3 });
    if (wp === 'ast') f.push({ text: 'Ast als Schlagwaffe (Reichweite, aber begrenzte Wirkung)', impact: '+', w: 3 });
    if (wp === 'steine') f.push({ text: env === 'gebirge' ? 'Wurfsteine im Gebirge: reichlich Munition' : 'Steine: Wurfgeschosse mit mäßiger Wirkung', impact: '+', w: env === 'gebirge' ? 4.5 : 2.5 });
    if (kind === 'firearm') {
      var accPct = rnd(acc * 100);
      f.push({ text: HUMAN_WEAPON_LABEL[wp] + ': ' + (armor >= 0.7 ? 'Dicke Haut verlangt präzise Treffer' : 'Hohe Stoppwirkung auf Distanz') + ' (Trefferquote ca. ' + accPct + ' %)', impact: armor >= 0.7 || acc < 0.6 ? '-' : '+', w: 6.5 });
      if (a.speed > 50 || a.agility >= 8) f.push({ text: 'Schnelles, wendiges Ziel erschwert den Treffer (Tempo ' + a.speed + ' km/h)', impact: '-', w: 3.5 });
    }
    if (kind === 'spray') {
      if (pSpray > 0.5) f.push({ text: 'Pfefferspray: stoppt ca. ' + rnd(pSpray * 100) + ' % der Angriffe von Säugetieren', impact: '+', w: 8 });
      else if (env === 'wasser') f.push({ text: 'Pfefferspray im Wasser wirkungslos', impact: '-', w: 7 });
      else f.push({ text: 'Pfefferspray wirkt kaum bei ' + (a.category === 'voegel' ? 'Vögeln' : 'Reptilien, Insekten und Wassertieren'), impact: '-', w: 6 });
    }
    var aw = (a.weapons || []).filter(function (w) { return w !== 'gift'; }).map(function (w) { return WEAPON_LABEL[w]; });
    if (aw.length) f.push({ text: 'Tierwaffen: ' + aw.join(', ') + ' (Bisskraft ' + rnd(a.biteForce) + ' PSI)', impact: '-', w: 2 + wb * 3 + (A / H > 1 ? 1 : 0) });
    if (a.venom > 0) f.push({ text: 'Giftbiss: ' + (a.venom >= 0.5 ? 'tödlich ohne Antiserum' : 'gefährlich, selten tödlich') + ' (Letalität ' + rnd(a.venom * 100) + ' %)', impact: '-', w: 3 + a.venom * 6 });
    if (a.speed > 45 && env !== 'wasser') f.push({ text: 'Tier ist schneller (' + a.speed + ' km/h gegen ' + (HUMAN_SPEED[human.fitness] || 28) + ' km/h): Weglaufen aussichtslos', impact: '-', w: 3.5 });
    else if (a.speed < (HUMAN_SPEED[human.fitness] || 28) && escape > 0.08 && env !== 'wasser') f.push({ text: 'Mensch ist schneller (' + (HUMAN_SPEED[human.fitness] || 28) + ' km/h gegen ' + a.speed + ' km/h): Rückzug möglich', impact: '+', w: 3.5 });
    if (a.fleeTendency >= 0.5 && eff >= 1) f.push({ text: 'Tier meidet Konfrontation (Fluchtneigung ' + rnd(a.fleeTendency * 100) + ' %)', impact: '+', w: 3 + a.fleeTendency * 2 });
    else if (a.fleeTendency >= 0.5) f.push({ text: 'Fluchtneigung des Tieres (' + rnd(a.fleeTendency * 100) + ' %) hilft nur mit wirksamer Abwehr', impact: '-', w: 1.5 });
    if (a.aggression >= 8) f.push({ text: 'Sehr hohe Aggressivität des Tieres (' + a.aggression + '/10)', impact: '-', w: 3 });
    if (env === 'wald' && climbNote) f.push({ text: 'Umgebungsvorteil: ' + climbNote + ' (Tier klettert nicht)', impact: '+', w: 4.5 });
    if (env === 'wald' && a.weight > 300) f.push({ text: 'Wald bremst schwere Tiere (−15 % Kampfkraft)', impact: '+', w: 3 });
    if (env === 'savanne' && a.ambush >= 0.4) f.push({ text: 'Savanne: Tier nutzt Deckung im hohen Gras (Hinterhalt +' + rnd(a.ambush * 25) + ' %)', impact: '-', w: 3 + a.ambush * 2 });
    if (env === 'wasser') {
      if (a.aquatic >= 0.2) f.push({ text: 'Wasser: Heimvorteil des Tieres (Kampfkraft ×' + (Math.round((1 + a.aquatic * 1.8) * 10) / 10) + '), Mensch kaum beweglich', impact: '-', w: 4 + a.aquatic * 5 });
      else f.push({ text: 'Wasser behindert beide, Mensch aber stärker (kein Halt, keine Flucht)', impact: '-', w: 2.5 });
    }
    if (env === 'gebirge') {
      f.push({ text: a.weight > 300 ? 'Gebirge: Schwergewichte rutschen ab, Sturzrisiko für beide' : 'Gebirge: Sturzrisiko für beide, Felsen als Deckung', impact: a.weight > 300 ? '+' : '-', w: 2.5 });
    }
    if (env === 'feld') f.push({ text: 'Offenes Feld: weder Deckung noch Rückzugsweg', impact: '-', w: 1.5 });
    if (fit >= 1.3) f.push({ text: (human.fitness === 'kampfsport' ? 'Kampfsport-Erfahrung' : 'Athletische Verfassung') + ' (×' + fit + ' Kampfkraft)', impact: '+', w: 2.2 });
    else if (fit < 1) f.push({ text: 'Untrainiert (×' + fit + ' Kampfkraft)', impact: '-', w: 2.2 });
    if (mind < 1) f.push({ text: 'Panik: schlechte Entscheidungen (×' + mind + ')', impact: '-', w: 2.6 });
    else if (mind > 1) f.push({ text: 'Todesangst: Adrenalin-Schub (×' + mind + ')', impact: '+', w: 2.2 });
    if (hw >= 110) f.push({ text: 'Hohes Körpergewicht (' + rnd(hw) + ' kg) erhöht die Kampfkraft', impact: '+', w: 1.5 });
    else if (hw <= 60) f.push({ text: 'Geringes Körpergewicht (' + rnd(hw) + ' kg) schwächt die Kampfkraft', impact: '-', w: 1.5 });
    if (f.length < 3) f.push({ text: 'Kampfkraft Tier ' + rnd(A) + ' gegen Mensch ' + rnd(H) + ' (Verhältnis ' + (Math.round(r * 10) / 10) + ')', impact: r > 1 ? '-' : '+', w: 1 });

    return finish(p, f, { mode: kind, A: A, H: H, ratio: r, envNote: envNote, spray: pSpray, escape: escape, fleeGain: fleeGain, mult: m, acc: acc });
  }

  /* ---------- Simulation ---------- */
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function gauss(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  var T = {
    hit: {
      unbewaffnet: ['Ein gezielter Tritt gegen das Knie', 'Ein Handballenstoß auf die empfindliche Nase', 'Ein Fingerstoß in die Augen', 'Ein Hebelgriff mit vollem Körpergewicht', 'Ein Schlag mit der Faust gegen die Schläfe'],
      ast: ['Ein gezielter Schlag mit dem schweren Ast auf die Schnauze', 'Ein weit ausgeholter Hieb mit dem Ast gegen die Flanke', 'Ein Stoß mit dem Ast in die Rippen', 'Ein Schlag mit dem Ast auf die Pfote'],
      steine: ['Ein gut geworfener Stein trifft das Tier am Kopf', 'Eine Salve Wurfsteine trifft die empfindliche Schnauze', 'Ein faustgroßer Stein sitzt genau am Auge', 'Ein Steinwurf trifft das Tier mitten im Anlauf'],
      messer: ['Ein schneller Stich in die Flanke', 'Ein Schnitt quer über die Schnauze', 'Ein Stich in die weiche Stelle am Hals', 'Ein tiefer Stich in die Schulter'],
      machete: ['Ein kräftiger Hieb mit der Machete auf die Schnauze', 'Ein Machetenhieb trennt dem Tier fast die Pfote ab', 'Ein weiter Hieb mit der Machete treibt das Tier zurück', 'Ein Hieb mit der Machete in den Nacken'],
      speer: ['Der Speer trifft das anrennende Tier frontal in die Brust', 'Ein Stoß mit dem Speer hält das Tier auf Abstand und trifft die Schulter', 'Du rammst den Speer in den Boden und lässt das Tier hineinlaufen', 'Ein schneller Speerstoß trifft die Schnauze'],
      pfefferspray: ['Eine Wolke Pfefferspray trifft das Tier mitten im Anlauf', 'Ein Sprühstoß aus fünf Metern erwischt Augen und Nase', 'Du löst das Spray aus – der Nebel hüllt das Tier ein'],
      kleinkaliber: ['Ein Schuss mit dem Kleinkaliber trifft die Schulter', 'Drei schnelle Schüsse sitzen in der Flanke', 'Ein Warnschuss, dann ein Treffer in die Brust'],
      grosskaliber: ['Ein Schuss aus dem Großkaliber trifft das Tier frontal in die Brust', 'Zwei schnelle Schüsse mit dem Großkaliber sitzen tief in der Schulter', 'Ein sauberer Schuss aus dem Großkaliber stoppt den Angriff']
    },
    miss: {
      unbewaffnet: ['Dein Schlag geht ins Leere', 'Dein Tritt wird mühelos abgeblockt', 'Du kannst das Tier nicht einmal richtig festhalten'],
      ast: ['Der Ast splittert beim ersten Treffer', 'Dein Ast prallt wirkungslos ab', 'Du schwingst den Ast zu langsam'],
      steine: ['Dein Steinwurf verfehlt das Ziel', 'Die Steine prallen am Fell ab', 'Du hast nur Zeit für einen einzigen Wurf, und der geht daneben'],
      messer: ['Dein Stich verfehlt knapp', 'Die Klinge bleibt in der dicken Haut stecken', 'Das Messer rutscht ab, ohne Schaden anzurichten'],
      machete: ['Der Hieb mit der Machete prallt ab', 'Die Machete verheddert sich im Gestrüpp', 'Du triffst nur Luft'],
      speer: ['Die Speerspitze rutscht ab', 'Das Tier weicht dem Speerstoß aus und ist plötzlich im Nahbereich', 'Der Speer bricht'],
      pfefferspray: ['Der Wind dreht und die Wolke trifft dich selbst', 'Das Spray klemmt im entscheidenden Moment', 'Die Wolke wirkt nicht, das Tier läuft einfach durch'],
      kleinkaliber: ['Der Schuss geht daneben', 'Die Kugel streift das Tier nur', 'Das Magazin ist zu schnell leer, ohne einen Stopptreffer'],
      grosskaliber: ['Der Schuss geht in der Panik daneben', 'Der Rückstoß verreißt den zweiten Schuss', 'Der Treffer sitzt zu weit hinten und stoppt das Tier nicht']
    },
    kill: ['das Tier bricht zusammen', 'das Tier sackt leblos zu Boden', 'nach wenigen Metern bleibt das Tier reglos liegen'],
    flee: {
      feld: ['das Tier flieht über das offene Feld', 'das Tier macht kehrt und rennt über die Wiese davon'],
      wald: ['das Tier flieht ins Unterholz', 'das Tier verschwindet zwischen den Bäumen'],
      savanne: ['das Tier verschwindet im hohen Gras', 'das Tier flieht über die Ebene'],
      wasser: ['das Tier zieht sich in tieferes Wasser zurück', 'das Tier taucht ab und lässt dich in Ruhe'],
      gebirge: ['das Tier springt über das Geröll davon', 'das Tier flieht den Hang hinab']
    },
    escape: {
      wald: ['Du kletterst rechtzeitig auf einen Baum, das Tier lauert lange, gibt dann aber auf', 'Du erreichst einen kräftigen Ast – unten tobt das Tier, bis es schließlich abzieht'],
      gebirge: ['Du kletterst auf einen Felsvorsprung, den das Tier nicht erreicht, und es zieht ab'],
      other: ['Du weichst Schritt für Schritt zurück und das Tier verliert das Interesse', 'Du bleibst ruhig, machst dich groß und das Tier lässt von dir ab', 'Du erreichst im Laufen eine Deckung, das Tier gibt die Verfolgung auf']
    },
    animalHit: {
      klauen: ['ein Prankenhieb reißt dich zu Boden', 'die Klauen erwischen dich an Schulter und Brust'],
      reisszaehne: ['der Biss packt dich am Arm und lässt nicht mehr los', 'das Tier beißt zu und schüttelt dich wie eine Puppe'],
      gift: ['der Giftbiss sitzt – ohne Antiserum zählt jede Minute'],
      masse: ['die schiere Wucht überrollt dich', 'das Tier wirft sich mit vollem Gewicht auf dich'],
      wuergen: ['das Tier umschlingt dich und zieht die Schlinge zu'],
      hoerner: ['die Hörner erwischen dich in der Seite', 'das Tier spießt dich auf und schleudert dich durch die Luft'],
      tritte: ['ein Huftritt trifft dich an der Brust', 'ein Tritt bricht dir mehrere Rippen'],
      schnabel: ['der Schnabel hackt auf Gesicht und Hände ein'],
      stacheln: ['die Stacheln bohren sich tief in dein Bein'],
      todesrolle: ['es packt zu und reißt dich in einer Todesrolle unter Wasser', 'es dreht sich im Griff um die eigene Achse und zieht dich in die Tiefe'],
      schlaege: ['ein Schlag wirft dich um, ein zweiter beendet den Kampf']
    },
    envLose: {
      gebirge: ['Auf dem losen Geröll rutschst du ab – das Tier ist sofort über dir', 'Du verlierst am Hang den Halt und stürzt, das Tier nutzt den Moment'],
      wasser: ['Im Wasser fehlt dir jeder Halt – das Tier packt zu', 'Die Strömung nimmt dir die Standfestigkeit, das Tier ist im Vorteil'],
      savanne: ['Aus dem hohen Gras kommt der Angriff aus dem Nichts', 'Im hohen Gras bemerkst du das Tier erst, als es schon zu spät ist']
    },
    venomWin: ['Ein Tritt mit dem Stiefel, und das Tier ist erledigt, bevor es zubeißen kann', 'Du weichst rechtzeitig aus und das Tier zieht sich zurück', 'Du erwischst das Tier mit einem schnellen Schlag, bevor es zustoßen kann', 'Du bemerkst das Tier früh genug und gehst weiträumig außen herum'],
    venomLose: ['Du bemerkst das Tier zu spät – ein einziger Biss, und das Gift wirkt', 'Es erwischt deine Hand blitzschnell – der Biss geht durch, ohne Antiserum zählt jede Minute', 'Der Stich sitzt, du schaffst es nicht mehr rechtzeitig ins Krankenhaus'],
    smallWin: ['Das Tier ist {w} schnell erledigt', 'Du erledigst das Tier mühelos', 'Das Tier rennt weg, sobald du dich aufbaust']
  };

  function sentence(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function sampleText(nr, winner, human, a, env, d, rng) {
    var wp = human.weapon || 'unbewaffnet';
    var txt;
    if (d.mode === 'gift') {
      txt = winner === 'mensch' ? pick(rng, T.venomWin) : pick(rng, T.venomLose);
      return 'Kampf #' + nr + ': ' + txt + '.';
    }
    if (winner === 'mensch') {
      var hit = pick(rng, T.hit[wp] || T.hit.unbewaffnet);
      var strong = wp === 'grosskaliber' || wp === 'kleinkaliber' || wp === 'machete' || (wp === 'messer' && a.armor < 0.5) || (wp === 'speer' && rng() < 0.4);
      var roll = rng();
      if (a.weight < 5 && wp === 'unbewaffnet') {
        return 'Kampf #' + nr + ': ' + pick(rng, ['Ein schneller Tritt, und das kleine Tier ergreift die Flucht.', 'Du packst das Tier im Nacken, es lässt sich nicht lange festhalten und flieht.', 'Du richtest dich laut auf, das Tier zieht ab.']);
      }
      var esc = (env === 'wald' && !a.climbs && roll < 0.22) || (env === 'gebirge' && roll < 0.14);
      if (esc) {
        var el = env === 'wald' ? T.escape.wald : T.escape.gebirge;
        return 'Kampf #' + nr + ': ' + pick(rng, el) + '.';
      }
      if (roll < 0.34 && wp === 'unbewaffnet' || roll > 0.88) {
        return 'Kampf #' + nr + ': ' + pick(rng, T.escape.other) + '.';
      }
      var killP = strong ? 0.6 : 0.25;
      var end = rng() < killP * (1 - (a.fleeTendency || 0) * 0.6) ? pick(rng, T.kill) : pick(rng, T.flee[env] || T.flee.feld);
      return 'Kampf #' + nr + ': ' + sentence(hit) + ' – ' + end + '.';
    }
    var open = pick(rng, T.miss[wp] || T.miss.unbewaffnet);
    var aw = (a.weapons || []).filter(function (w) { return T.animalHit[w]; });
    var fin = aw.length ? pick(rng, T.animalHit[pick(rng, aw)]) : 'das Tier erwischt dich mit voller Wucht';
    if (a.venom > 0 && aw.indexOf('gift') >= 0 && rng() < 0.5) fin = pick(rng, T.animalHit.gift);
    if (T.envLose[env] && (env !== 'savanne' || a.ambush > 0.4) && rng() < 0.3 && (env !== 'wasser' || a.aquatic > 0.2 || rng() < 0.3)) {
      return 'Kampf #' + nr + ': ' + pick(rng, T.envLose[env]) + ' – ' + fin + '.';
    }
    return 'Kampf #' + nr + ': ' + open + ' – ' + fin + '.';
  }

  function simulate(human, animal, env, n, seed) {
    var res = compute(human, animal, env);
    var rng = mulberry32(seed != null ? seed : Math.floor(Math.random() * 4294967295));
    var base = res.details.pHuman;
    var logit = Math.log(base / (1 - base));
    var hw = 0, aw = 0, hIdx = [], aIdx = [];
    for (var i = 1; i <= n; i++) {
      var form = gauss(rng) * 0.35;           // Tagesform
      var luck = gauss(rng) * 0.45;           // Glück / Zufallstreffer
      var pi = 1 / (1 + Math.exp(-(logit + form + luck)));
      var winner = rng() < pi ? 'mensch' : 'tier';
      if (winner === 'mensch') { hw++; if (hIdx.length < 300) hIdx.push(i); } else { aw++; if (aIdx.length < 300) aIdx.push(i); }
    }
    function choose(list, k) {
      var out = [], copy = list.slice();
      while (out.length < k && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
      return out;
    }
    var pickH = choose(hIdx, 3), pickA = choose(aIdx, 3);
    var chosen = pickH.map(function (x) { return [x, 'mensch']; }).concat(pickA.map(function (x) { return [x, 'tier']; }));
    chosen.sort(function (x, y) { return x[0] - y[0]; });
    var samples = chosen.map(function (c) {
      return { nr: c[0], winner: c[1], text: sampleText(c[0], c[1], human, animal, env, res.details, rng) };
    });
    return { humanWins: hw, animalWins: aw, samples: samples, base: res.humanPct };
  }

  root.Engine = {
    compute: compute,
    simulate: simulate,
    fmtPct: fmtPct,
    humanSpeed: function (fitness) { return HUMAN_SPEED[fitness] || 28; },
    weaponLabel: WEAPON_LABEL,
    humanWeaponLabel: HUMAN_WEAPON_LABEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
