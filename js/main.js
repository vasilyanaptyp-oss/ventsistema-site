/* Ventsistema. Svetainė. Be JS viskas matoma: schema, visi šeši žingsniai, skaičiuoklės pradinės reikšmės, nuotraukos atsidaro kaip failai. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var desktop = function () { return window.innerWidth >= 900; };
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var $ = function (id) { return document.getElementById(id); };
  var hdrPx = function () { var hd = document.querySelector('.hdr'); return hd ? Math.round(hd.getBoundingClientRect().height) : 0; };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var me = (document.currentScript && document.currentScript.src) || '';
  var dir = me.slice(0, me.lastIndexOf('/') + 1);
  var safe = function (name, fn) { try { fn(); } catch (err) { if (window.console) console.warn('Ventsistema: ' + name, err); } };
  /* ar lankytojas pats jau judino puslapį (tada inkaro nebetaisome) */
  var touched = false;
  var markTouched = function () { touched = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (ev) { window.addEventListener(ev, markTouched, { passive: true }); });

  /* ---------- 1. Atsiskleidimas slenkant. Patikimai: IntersectionObserver + slinkimo patikra kartą per kadrą +
     patikra pasikeitus puslapio aukščiui (3D, šriftai, GSAP), grįžus „atgal“ ir atėjus per inkarą.
     Kas jau ekrane ar virš jo, visada matoma. Paleidžiama pirma, kad klaida kitur neužblokuotų turinio. ---------- */
  safe('reveal', function () {
    var pending = Array.prototype.slice.call(document.querySelectorAll('.rv'));
    if (!pending.length) { window.VSRV = { left: 0 }; return; }
    if (reduce) { pending.forEach(function (el) { el.classList.add('in'); }); window.VSRV = { left: 0 }; return; }
    /* paslėpta būsena turi būti apskaičiuota prieš pridedant .in, kitaip perėjimas kartais praleidžiamas */
    void window.getComputedStyle(pending[0]).opacity;
    var io = null;
    var reveal = function (el) { el.classList.add('in'); if (io) io.unobserve(el); };
    var sweep = function () {
      if (!pending.length) return;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter(function (el) {
        if (el.getBoundingClientRect().top < vh) { reveal(el); return false; }
        return true;
      });
    };
    var ticking = false, idleT = 0;
    var onScroll = function () {
      if (!pending.length) return;
      /* atsarginė patikra laikmačiu: jei kadrai vėluoja (silpnas įrenginys, fone), turinys vis tiek atsiskleidžia sustojus slinkti */
      clearTimeout(idleT); idleT = setTimeout(sweep, 140);
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () { ticking = false; sweep(); });
    };
    window.addEventListener('scrollend', sweep);
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (es) {
        for (var i = 0; i < es.length; i++) { if (es[i].isIntersecting || es[i].boundingClientRect.top < 0) { sweep(); return; } }
      });
      pending.forEach(function (el) { io.observe(el); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', sweep);
    window.addEventListener('pageshow', sweep);
    if ('ResizeObserver' in window) new ResizeObserver(onScroll).observe(document.body);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sweep);
    window.requestAnimationFrame(function () { window.requestAnimationFrame(sweep); });
    [400, 1200, 3000].forEach(function (ms) { setTimeout(sweep, ms); });
    window.VSRV = { sweep: sweep, get left() { return pending.length; } };
  });

  /* ---------- 2. Pirmas ekranas: gyvas 3D rekuperatorius (WebGL2) tik kompiuteryje, kuris jį patemps.
     Telefone, planšetėje ir silpname įrenginyje lieka lengva SVG schema su tekančiu oru.
     three.js (~250 KB) kraunamas tik po puslapio įkėlimo ir tik kai scena matoma. ---------- */
  safe('3d', function () {
    var box = $('stage-box');
    if (!box) return;
    /* jei 3D nuotrauka nepasikrovė, rodoma SVG schema */
    var still = box.querySelector('.still');
    var noStill = function () { box.classList.remove('has-still'); };
    if (still) { if (still.complete && !still.naturalWidth) noStill(); else still.addEventListener('error', noStill); }
    var nav = navigator, conn = nav.connection || {};
    var bigScreen = window.matchMedia('(min-width: 900px) and (any-pointer: fine)').matches;
    var strong = !(nav.deviceMemory && nav.deviceMemory < 4) && !(nav.hardwareConcurrency && nav.hardwareConcurrency < 4);
    var slowNet = !!conn.saveData || /(^|-)(2g|3g)$/.test(conn.effectiveType || '');
    /* bandomasis kontekstas iškart atlaisvinamas, kad neliktų antro WebGL konteksto šalia scenos */
    var webgl2 = function () {
      try {
        if (!window.WebGL2RenderingContext) return false;
        var g = document.createElement('canvas').getContext('webgl2');
        if (!g) return false;
        var x = g.getExtension('WEBGL_lose_context'); if (x) x.loseContext();
        return true;
      } catch (e) { return false; }
    };
    var want3d = !reduce && bigScreen && strong && !slowNet && webgl2();
    window.VSMODE = want3d ? '3d' : 'svg';
    if (!want3d) return;
    var dynImport = function (u) { return new Function('u', 'return import(u)')(u); };
    var started = false;
    var load3d = function () {
      if (started) return; started = true;
      dynImport(dir + 'scene3d.js').then(function (m) { return m.init(box, { mobile: !desktop() }); }).then(function (api) {
        window.VS3D = api; box.classList.add('is3d');
      }).catch(function (err) { window.VSMODE = 'svg'; if (window.console) console.warn('3D nepasiekiamas, lieka schema', err && err.message); });
    };
    var whenVisible = function () {
      if (!('IntersectionObserver' in window)) { load3d(); return; }
      var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); load3d(); } });
      o.observe(box);
    };
    if (document.readyState === 'complete') setTimeout(whenVisible, 60); else window.addEventListener('load', function () { setTimeout(whenVisible, 60); });
  });

  /* ---------- 3. Kelionė: oro paketas keliauja ortakiais pagal slinkimą ---------- */
  var pa = $('p-supply'), pb = $('p-extract'), da = $('dot-a'), db = $('dot-b'), jwrap = $('jwrap');
  if (hasGsap && !reduce && pa && pb && jwrap) safe('kelione', function () {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    root.classList.add('gs');
    var la = pa.getTotalLength(), lb0 = pb.getTotalLength();
    pa.style.strokeDasharray = la; pb.style.strokeDasharray = lb0;
    var steps = Array.prototype.slice.call(document.querySelectorAll('#jsteps .jstep'));
    var zones = ['z0', 'z1', 'z2', 'z3', 'z4', 'z5'].map($);
    var S = [[0, 0.17], [0.17, 0.33], [0.33, 0.5], [0.5, 0.68], [0.68, 0.85], [0.85, 1.01]];
    var fill = $('jfill');
    var lastIdx = -1;
    var setJ = function (p) {
      var qa = clamp01(p / 0.66), qb = clamp01((p - 0.6) / 0.4);
      pa.style.strokeDashoffset = la * (1 - qa);
      var A = pa.getPointAtLength(la * qa); da.setAttribute('transform', 'translate(' + A.x.toFixed(1) + ' ' + A.y.toFixed(1) + ')');
      pb.style.strokeDashoffset = lb0 * (1 - qb);
      var B = pb.getPointAtLength(lb0 * qb); db.setAttribute('transform', 'translate(' + B.x.toFixed(1) + ' ' + B.y.toFixed(1) + ')');
      db.style.opacity = qb > 0.001 ? 1 : 0;
      var idx = 0; for (var i = 0; i < S.length; i++) { if (p >= S[i][0] && p < S[i][1]) { idx = i; break; } }
      if (p >= 1) idx = 5;
      if (idx !== lastIdx) {
        lastIdx = idx;
        for (var j = 0; j < steps.length; j++) steps[j].classList.toggle('on', j === idx);
        for (var k = 0; k < zones.length; k++) if (zones[k]) zones[k].classList.toggle('lit', k === idx);
      }
      if (fill) fill.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    };
    /* Prisegama ekrano viduryje (po antrašte), kad nebūtų tuščios pusės ekrano.
       Telefone, jei telpa, prisegamas visas skyrius su antrašte; jei netelpa – tik schema; jei ir ji netelpa – viršuje. */
    var kaip = $('kaip');
    var st = null, pinEl = null, lastW = window.innerWidth;
    /* tikras bloko aukštis: be prisegimo tarpo, kurį GSAP prideda aplink prisegtą schemą */
    var natural = function (el) {
      var h = el.offsetHeight, sp = jwrap.parentNode;
      if (el === kaip && st && pinEl === jwrap && sp && sp.classList.contains('pin-spacer')) h -= sp.offsetHeight - jwrap.offsetHeight;
      return h;
    };
    var fits = function (el) { return !!el && natural(el) <= window.innerHeight - hdrPx(); };
    var choose = function () { return (!desktop() && fits(kaip)) ? kaip : jwrap; };
    var startPos = function () {
      var hd = hdrPx(), vh = window.innerHeight;
      if (!fits(pinEl)) return 'top ' + hd + 'px';
      return 'center ' + Math.round(hd + (vh - hd) / 2) + 'px';
    };
    var build = function () {
      if (st) { st.kill(); st = null; }
      pinEl = choose();
      st = ScrollTrigger.create({
        trigger: pinEl, start: startPos, end: '+=140%', pin: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: function (s) { setJ(s.progress); },
        onRefresh: function (s) { setJ(s.progress); }
      });
      window.VSJ = { set: setJ, st: st, pin: pinEl.id };
    };
    build();
    /* pasukus telefoną ar pakeitus lango plotį prisegamas tinkamas blokas */
    var rt = 0;
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      remember();
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (choose() === pinEl) return;
        var p = st && st.isActive ? st.progress : null;
        build(); ScrollTrigger.refresh();
        if (p !== null) { window.scrollTo({ top: st.start + p * (st.end - st.start), behavior: 'instant' }); st.update(); }
      }, 250);
    });
    /* keičiant lango dydį istorija neatšoka atgal: išsaugome, kur buvome, ir grąžiname */
    var keep = null;
    var keepT = 0;
    var remember = function () {
      if (keep !== null || !st || !st.isActive) return;
      keep = st.progress;
      clearTimeout(keepT); keepT = setTimeout(function () { keep = null; }, 1500);
    };
    /* resize įvykis ateina prieš slinkimo pataisą po persitvarkymo, todėl čia progresas dar tikras */
    window.addEventListener('resize', remember);
    ScrollTrigger.addEventListener('refreshInit', remember);
    ScrollTrigger.addEventListener('refresh', function () {
      if (keep === null || !st) return;
      var y = st.start + keep * (st.end - st.start); keep = null;
      window.scrollTo({ top: y, behavior: 'instant' }); st.update();
    });
    setJ(0);

    /* Atėjus per inkarą (#paslaugos ir pan.) naršyklė nuslenka anksčiau, nei GSAP įterpia prisegimo tarpą.
       Po galutinio perskaičiavimo (įkėlus puslapį ir šriftus) nuslenkame į tikrą vietą, jei lankytojas dar nejudino puslapio. */
    var fixAnchor = function () {
      if (touched || !location.hash || location.hash.length < 2) return;
      var t = null; try { t = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { return; }
      if (!t) return;
      var want = parseFloat(window.getComputedStyle(t).scrollMarginTop) || 0;
      if (Math.abs(t.getBoundingClientRect().top - want) > 2) t.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    var settle = function () { ScrollTrigger.refresh(); fixAnchor(); if (window.VSRV && window.VSRV.sweep) window.VSRV.sweep(); };
    if (document.readyState === 'complete') settle(); else window.addEventListener('load', function () { window.requestAnimationFrame(settle); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (document.readyState === 'complete') settle(); });
  });

  /* ---------- 4. Skaičiuoklė: oro kiekis pagal tūrį ir žmones, užklausa su skaičiais ---------- */
  var form = $('calc');
  if (form) {
    var area = $('area'), hgt = $('height'), ppl = $('people');
    var fmt = function (n) { return String(n).replace('.', ','); };
    var setFill = function (inp) { var min = +inp.min, max = +inp.max, v = +inp.value; inp.style.setProperty('--p', ((v - min) / (max - min) * 100).toFixed(1) + '%'); };
    var klass = function (f) {
      if (f <= 150) return 'apie 150 m³/h';
      if (f <= 200) return 'apie 200 m³/h';
      if (f <= 250) return 'apie 250 m³/h';
      if (f <= 350) return 'apie 300–350 m³/h';
      if (f <= 500) return 'apie 400–500 m³/h';
      return '500 m³/h ir daugiau';
    };
    var calc = function () {
      var A = +area.value, H = +hgt.value, P = +ppl.value;
      var vol = A * H * 0.5, per = P * 30;
      var flow = Math.ceil(Math.max(vol, per) / 10) * 10;
      $('o-area').value = A; $('o-h').value = fmt(H.toFixed(1)); $('o-ppl').value = P;
      $('r-vol').textContent = Math.round(vol); $('r-ppl').textContent = per; $('r-flow').textContent = flow; $('r-class').textContent = klass(flow);
      [area, hgt, ppl].forEach(setFill);
      var body = 'Laba diena!\nNorėčiau pasiūlymo dėl vėdinimo (rekuperacijos).\nPlotas: ' + A + ' m², lubų aukštis: ' + fmt(H.toFixed(1)) + ' m, gyventojai: ' + P + '.\nOrientacinis oro kiekis: apie ' + flow + ' m³/h (' + klass(flow) + ').\nAdresas / miestas: \n[Vardas ir telefonas]';
      $('mail-link').href = 'mailto:uzelo.viktor@gmail.com?subject=' + encodeURIComponent('Vėdinimo pasiūlymo užklausa: ' + A + ' m²') + '&body=' + encodeURIComponent(body);
      $('sms-link').href = 'sms:+37060600670?&body=' + encodeURIComponent('Laba diena! Norėčiau vėdinimo pasiūlymo. Plotas ' + A + ' m², lubos ' + fmt(H.toFixed(1)) + ' m, gyventojai ' + P + '. Orientacinis oro kiekis apie ' + flow + ' m³/h. [Vardas]');
    };
    form.addEventListener('input', calc);
    form.addEventListener('change', calc);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    calc();
    window.VSCALC = calc;
  }

  /* ---------- 5. Objektų nuotraukos: peržiūra visame ekrane (be JS nuoroda atidaro failą) ---------- */
  var lb = $('lb');
  var links = Array.prototype.slice.call(document.querySelectorAll('.gal-link'));
  if (lb && links.length && typeof lb.showModal === 'function') {
    var img = $('lb-img'), cap = $('lb-cap'), cnt = $('lb-count'), full = $('lb-full'), cur = 0;
    /* didelė nuotrauka WebP formatu (apie 40 % lengvesnė), jei naršyklė ją rodo; kitaip JPG */
    var webp = !!document.querySelector('.gal-link source[type="image/webp"]') && (function () { try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } })();
    var big = function (a) { var h = a.getAttribute('href'); return webp ? h.replace(/\.jpg$/, '.webp') : h; };
    var show = function (i) {
      cur = (i + links.length) % links.length;
      var a = links[cur], im = a.querySelector('img');
      img.src = big(a); img.alt = im ? im.alt : '';
      cap.textContent = a.getAttribute('data-cap') || (im ? im.alt : '');
      cnt.textContent = (cur + 1) + ' / ' + links.length;
      var nx = links[(cur + 1) % links.length]; if (nx) { var pre = new Image(); pre.src = big(nx); }
    };
    var open = function (i) { show(i); if (!lb.open) lb.showModal(); };
    links.forEach(function (a, i) { a.addEventListener('click', function (e) { e.preventDefault(); open(i); }); });
    $('lb-prev').addEventListener('click', function () { show(cur - 1); });
    $('lb-next').addEventListener('click', function () { show(cur + 1); });
    $('lb-close').addEventListener('click', function () { lb.close(); });
    if (!lb.requestFullscreen) full.hidden = true;
    else full.addEventListener('click', function () { if (document.fullscreenElement) document.exitFullscreen(); else lb.requestFullscreen().catch(function () {}); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1); }
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-fig')) lb.close(); });
    lb.addEventListener('close', function () { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); img.removeAttribute('src'); });
    var sx = 0, sy = 0;
    lb.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; }, { passive: true });
    lb.addEventListener('pointerup', function (e) { var dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) show(dx < 0 ? cur + 1 : cur - 1); }, { passive: true });
    window.VSLB = { open: open, show: show, close: function () { lb.close(); }, get index() { return cur; }, total: links.length };
  }
})();
