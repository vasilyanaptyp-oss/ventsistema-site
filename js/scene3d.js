/* Ventsistema · rekuperatorius 3D. Kraunamas tik po puslapio užkrovimo (main.js). Be WebGL lieka SVG schema.
   Scena gyva: dalelės teka dviem srautais per šilumokaitį, ventiliatoriai sukasi, kamera lėtai plaukia.
   Ciklas sustoja, kai scena nematoma arba skirtukas paslėptas; telefone ne daugiau 30 kadrų per sekundę. */
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/three/RoomEnvironment.js';

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const rad = THREE.MathUtils.degToRad;

function spriteTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,.7)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function init(box, opts = {}) {
  const mobile = !!opts.mobile;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  box.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.debug.checkShaderErrors = false; /* be sinchroninių šeiderių žurnalo užklausų: greičiau ir be triukšmo konsolėje */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 40);

  /* ---- medžiagos: stiklinis korpusas su aqua briaunomis, plokštelės, metalas ---- */
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1f5f6c, roughness: 0.28, metalness: 0.05, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x3fd9c2, transparent: true, opacity: 0.9 });
  const edgeSoft = new THREE.LineBasicMaterial({ color: 0x3fd9c2, transparent: true, opacity: 0.22 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xc9eaec, roughness: 0.3, metalness: 0.75, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const metal = new THREE.MeshStandardMaterial({ color: 0xa7bfc4, roughness: 0.35, metalness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17383f, roughness: 0.55, metalness: 0.3 });

  const unit = new THREE.Group(); scene.add(unit);
  const W = 1.0, H = 0.56, D = 0.42;
  const boxGeo = new THREE.BoxGeometry(W, H, D);
  unit.add(new THREE.Mesh(boxGeo, glass));
  unit.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat));
  unit.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W - 0.05, H - 0.05, D - 0.05)), edgeSoft));
  /* šilumokaitis: rombas iš plokštelių, per kurias kertasi du srautai */
  const N = 15;
  const plates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 0.004), plateMat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 4)), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < N; i++) { m4.compose(new THREE.Vector3(0, 0, -0.16 + i * (0.32 / (N - 1))), q, one); plates.setMatrixAt(i, m4); }
  unit.add(plates);
  const core = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.31, 0.31, 0.34)), new THREE.LineBasicMaterial({ color: 0xdff7f3, transparent: true, opacity: 0.55 }));
  core.rotation.z = Math.PI / 4; unit.add(core);
  /* keturi ortakių atvamzdžiai: lauko oras įeina kairėje viršuje ir po šilumokaičio išeina dešinėje apačioje (į kambarius);
     panaudotas oras įeina dešinėje viršuje ir išeina kairėje apačioje (lauk). Srautai kryžiuojasi rombe 90° kampu. */
  const portGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.14, 24); portGeo.rotateZ(Math.PI / 2);
  [[-W / 2 - 0.06, 0.15], [W / 2 + 0.06, -0.15], [W / 2 + 0.06, 0.15], [-W / 2 - 0.06, -0.15]].forEach(([x, y]) => {
    const p = new THREE.Mesh(portGeo, metal); p.position.set(x, y, 0); unit.add(p);
  });
  /* du ventiliatoriai po šilumokaičio: tiekimo (dešinėje apačioje) ir ištraukimo (kairėje apačioje) */
  const fans = [];
  const mkFan = (x, y) => {
    const g = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), dark); hub.rotation.z = Math.PI / 2; g.add(hub);
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group(); pivot.rotation.x = i * Math.PI / 3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.075, 0.03), metal); b.position.y = 0.058; b.rotation.y = 0.55; pivot.add(b); g.add(pivot);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 36), dark); ring.rotation.y = Math.PI / 2; g.add(ring);
    g.position.set(x, y, 0); unit.add(g); fans.push(g);
  };
  mkFan(0.36, -0.15); mkFan(-0.36, -0.15);

  /* ---- du oro srautai: kelias per šilumokaitį, spalva keičiasi jį praėjus ---- */
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  /* šviežias: kairė viršus → per rombą įstrižai žemyn → dešinė apačia; panaudotas: dešinė viršus → įstrižai žemyn → kairė apačia.
     Šilumokaityje kryžiuojasi 90° kampu, kiekvienas srautas savo plokštelių tarpuose (z sluoksniai), todėl nesimaišo. */
  const curveA = new THREE.CatmullRomCurve3([v(-1.55, 0.16, 0), v(-0.62, 0.15, 0), v(-0.3, 0.145, 0), v(-0.13, 0.12, 0), v(0.13, -0.12, 0), v(0.3, -0.145, 0), v(0.62, -0.15, 0), v(1.55, -0.16, 0)]);
  const curveB = new THREE.CatmullRomCurve3([v(1.55, 0.16, 0), v(0.62, 0.15, 0), v(0.3, 0.145, 0), v(0.13, 0.12, 0), v(-0.13, -0.12, 0), v(-0.3, -0.145, 0), v(-0.62, -0.15, 0), v(-1.55, -0.16, 0)]);
  const sprite = spriteTexture();
  const streams = [];
  const gap = 0.32 / (N - 1);
  const mkStream = (curve, n, c1, c2, odd) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), t = new Float32Array(n), sp = new Float32Array(n), off = new Float32Array(n * 3), zl = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      t[i] = Math.random(); sp[i] = 0.09 + Math.random() * 0.1;
      off[i * 3] = (Math.random() - 0.5) * 0.08; off[i * 3 + 1] = (Math.random() - 0.5) * 0.08; off[i * 3 + 2] = (Math.random() - 0.5) * 0.006;
      /* savas plokštelių tarpas: šviežias oras lyginiuose, panaudotas nelyginiuose */
      const g = 2 * Math.floor(Math.random() * 7) + (odd ? 1 : 0);
      zl[i] = -0.16 + (g + 0.5) * gap;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: mobile ? 0.04 : 0.032, map: sprite, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
    const tmp = new THREE.Vector3(), cA = new THREE.Color(c1), cB = new THREE.Color(c2), cc = new THREE.Color();
    const step = (dt) => {
      for (let i = 0; i < n; i++) {
        t[i] += sp[i] * dt; if (t[i] > 1) t[i] -= 1;
        const u = t[i];
        curve.getPointAt(u, tmp);
        /* šilumokaityje srautas pasklinda per visą rombo plotį ir išsidėsto savo plokštelių tarpuose; ortakyje vėl susitraukia */
        const ax = Math.abs(tmp.x);
        const k = 1 + 1.1 * clamp01((0.3 - ax) / 0.12), s = 0.3 + 0.7 * clamp01((0.38 - ax) / 0.16);
        pos[i * 3] = tmp.x + off[i * 3] * k; pos[i * 3 + 1] = tmp.y + off[i * 3 + 1] * k; pos[i * 3 + 2] = zl[i] * s + off[i * 3 + 2];
        cc.copy(cA).lerp(cB, clamp01((u - 0.42) / 0.16));
        /* srautų galai išblunka, kad prie drobės krašto nebūtų nupjautų taškų */
        const fade = 1 - clamp01((Math.abs(tmp.x) - 0.95) / 0.5);
        col[i * 3] = cc.r * fade; col[i * 3 + 1] = cc.g * fade; col[i * 3 + 2] = cc.b * fade;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    };
    step(0);
    streams.push({ step, pos });
  };
  const n = mobile ? 320 : 520;
  mkStream(curveA, n, 0x5ee6d0, 0xffc98a, false);   /* šviežias: šaltas aqua → sušildytas šiltas */
  mkStream(curveB, n, 0xff7a59, 0x8fb3bd, true);    /* panaudotas: šiltas koralas → atvėsęs pilkšvas */

  /* ---- šviesa ---- */
  scene.add(new THREE.HemisphereLight(0xdff7f3, 0x0f2e36, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x3fd9c2, 0.9); rim.position.set(-3, 1.5, -2); scene.add(rim);

  /* ---- kamera, ciklas, matomumas ---- */
  let time = 0, aspect = 1, baseDist = 4, tiltX = 0, tiltY = 0, tX = 0, tY = 0;
  const place = () => {
    const az = 0.5 + 0.1 * Math.sin(time * 0.21) + tiltX, el = 0.27 + 0.04 * Math.sin(time * 0.13) + tiltY, d = baseDist;
    camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    camera.lookAt(0, 0, 0);
  };
  const resize = () => {
    const w = box.clientWidth || 1, h = box.clientHeight || 1;
    aspect = w / h; camera.aspect = aspect;
    const f = Math.tan(rad(camera.fov / 2)) * 2;
    baseDist = Math.max(1.25 / f, (mobile ? 2.05 : 2.4) / (f * aspect));
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    place();
  };
  if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    box.addEventListener('pointermove', ev => { const r = box.getBoundingClientRect(); tX = ((ev.clientX - r.left) / r.width - 0.5) * 0.16; tY = ((ev.clientY - r.top) / r.height - 0.5) * 0.08; });
    box.addEventListener('pointerleave', () => { tX = 0; tY = 0; });
  }
  new ResizeObserver(resize).observe(box);
  let running = false, visible = true, raf = 0, last = 0, frames = 0;
  const minMs = mobile ? 1000 / 30 - 2 : 0;
  const frame = (now) => {
    raf = 0; if (!running) return;
    const ms = now - last;
    if (ms < minMs) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, ms / 1000) || 0.016; last = now; time += dt; frames++;
    tiltX += (tX - tiltX) * 0.06; tiltY += (tY - tiltY) * 0.06;
    for (const s of streams) s.step(dt);
    fans[0].rotation.x -= dt * 9; fans[1].rotation.x += dt * 9;
    place();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !document.hidden) start(); else stop(); }, { threshold: 0.05 }).observe(box);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (visible) start(); });
  /* grįžus mygtuku „atgal“ (bfcache) ciklas paleidžiamas iš naujo, jei scena matoma */
  window.addEventListener('pageshow', (e) => { if (e.persisted && visible && !document.hidden) start(); });
  window.addEventListener('pagehide', () => stop());
  canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); stop(); box.classList.remove('is3d'); });

  resize();
  renderer.render(scene, camera);
  start();
  return {
    mode: '3d', ready: true,
    get running() { return running; },
    get frames() { return frames; },
    sample() { const p = streams[0].pos; return [p[0], p[1], p[2]]; },
    /* testams: abiejų srautų padėtys ir vieno žingsnio kaina */
    debug() { return { a: Array.from(streams[0].pos), b: Array.from(streams[1].pos) }; },
    bench(k) { const t0 = performance.now(); for (let i = 0; i < (k || 60); i++) for (const s of streams) s.step(1 / 60); return (performance.now() - t0) / (k || 60); }
  };
}
