/* =========================================================
   タピオカドリンクの3Dシーン（Three.js）
   画像やモデルファイルは使わず、すべてコードで形を作る。

   使い方:
     const drink = createDrinkScene(container, { quality: 'high' | 'low', drag: true });
     drink.setFlavor({ top, bottom, syrup, stripes });  // 液体の色（なめらかに切り替わる）
     drink.setPose({ x, y, s });     // 画面内の位置（-1〜1）と大きさ
     drink.setScrollRotation(rad);   // スクロールに連動する回転
     drink.setOptions({ sweet, ice, extraPearls, foam, nata }); // カスタマイズ
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---- カップの寸法（単位はだいたい 1 = 4cm） ----
const H = 3.0;            // カップの高さ
const RB = 0.8;           // 底の半径
const RT = 1.03;          // 口の半径
const FILL = 2.5;         // 液体の上面
const BED = 0.84;         // タピオカが沈んでいる層の上端
const PR = 0.125;         // タピオカ粒の半径
const CENTER_Y = 2.12;    // 見た目の中心（ストロー込み）
const rAt = (y) => RB + (RT - RB) * (y / H);

const V2 = THREE.Vector2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) {
    return false;
  }
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.redraw = () => { draw(c.getContext('2d'), w, h); tex.needsUpdate = true; };
  return tex;
}

// 縁ほど不透明になる「ガラスらしさ」を足す（フレネル）
function addFresnel(material, strength = 0.6, power = 2.6) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `#include <opaque_fragment>
       float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), ${power.toFixed(2)});
       gl_FragColor.a = clamp(gl_FragColor.a + fres * ${strength.toFixed(2)}, 0.0, 1.0);
       gl_FragColor.rgb += fres * 0.10;`
    );
  };
  material.customProgramCacheKey = () => `fres-${strength}-${power}`;
  return material;
}

const elasticOut = (t) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

export function createDrinkScene(container, opts = {}) {
  const o = { quality: 'high', drag: false, dark: false, tiltArea: 'window', ...opts };
  const low = o.quality === 'low';
  const SEG = low ? 44 : 72;
  const BASE_PEARLS = low ? 22 : 30;
  const EXTRA_PEARLS = 12;

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({
    antialias: !low || (window.devicePixelRatio || 1) < 2,
    alpha: true,
    powerPreference: low ? 'default' : 'high-performance',
  });
  const maxDpr = low ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = o.dark ? 1.1 : 1.0;
  const canvas = renderer.domElement;
  canvas.className = 'drink-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 1.4, 12);
  camera.lookAt(0, 0, 0);

  // ---------- Lights（ふんわり） ----------
  scene.add(new THREE.HemisphereLight(0xfff4e6, o.dark ? 0x4a3328 : 0xe6d0b6, o.dark ? 0.7 : 0.9));
  const key = new THREE.DirectionalLight(0xfff5ea, 1.7); key.position.set(4, 7, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe8d4, 0.55); fill.position.set(-6, 2, 5); scene.add(fill);
  const rimPink = new THREE.DirectionalLight(0xffbfc8, o.dark ? 2.4 : 1.4); rimPink.position.set(-4, 3.5, -5); scene.add(rimPink);
  const rimWarm = new THREE.DirectionalLight(0xffe2bd, o.dark ? 1.6 : 0.9); rimWarm.position.set(5, 2, -5); scene.add(rimWarm);

  // ---------- Groups ----------
  const root = new THREE.Group(); scene.add(root);     // 位置・大きさ
  const tilt = new THREE.Group(); root.add(tilt);      // マウス・指での傾き
  const spin = new THREE.Group(); tilt.add(spin);      // 回転
  const model = new THREE.Group(); spin.add(model);
  model.position.y = -CENTER_Y;

  // ---------- 足元の柔らかい影 ----------
  const shadowTex = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    const c = o.dark ? '10,5,2' : '92,58,36';
    gr.addColorStop(0, `rgba(${c},0.5)`);
    gr.addColorStop(0.4, `rgba(${c},0.22)`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 3.8),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -CENTER_Y + 0.01;
  shadow.renderOrder = -1;
  root.add(shadow);

  const glassMat = (opacity, side) => addFresnel(new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity, side, depthWrite: false, envMapIntensity: 1.5,
  }), side === THREE.BackSide ? 0.25 : 0.5);

  // ---------- タピオカ粒と、底のシロップ層 ----------
  const rnd = mulberry32(20241113);
  const items = [];
  function place(n, r, type, yMin, yMax, bias = 1.6) {
    let placed = 0, tries = 0;
    while (placed < n && tries < 6000) {
      tries++;
      const y = yMin + Math.pow(rnd(), bias) * (yMax - yMin);
      const maxR = rAt(y) - 0.07 - r;
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * maxR;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      let hit = false;
      for (const p of items) {
        const dx = p.x - x, dy = p.y - y, dz = p.z - z, rr = (p.r + r) * 0.94;
        if (dx * dx + dy * dy + dz * dz < rr * rr) { hit = true; break; }
      }
      if (hit) continue;
      items.push({ x, y, z, r, type, ph: rnd() * Math.PI * 2, sp: 0.7 + rnd() * 0.6, s: 0 });
      placed++;
    }
  }
  place(BASE_PEARLS, PR, 'pearl', 0.07 + PR, BED - 0.04);
  place(EXTRA_PEARLS, PR, 'extra', 0.07 + PR, BED + 0.02, 1);
  place(10, 0.085, 'nata', 0.1, BED - 0.02, 1);

  const pearlList = items.filter((p) => p.type !== 'nata');
  const nataList = items.filter((p) => p.type === 'nata');

  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: 0x24150e, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06,
    envMapIntensity: 1.3, emissive: 0x140804,
  });
  const pearls = new THREE.InstancedMesh(new THREE.SphereGeometry(PR, low ? 14 : 22, low ? 10 : 16), pearlMat, pearlList.length);
  pearls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  model.add(pearls);

  const nataMat = new THREE.MeshPhysicalMaterial({ color: 0xf6f1e2, roughness: 0.12, clearcoat: 1, envMapIntensity: 1.2, emissive: 0x2a2620 });
  const nata = new THREE.InstancedMesh(new RoundedBoxGeometry(0.16, 0.16, 0.16, 2, 0.035), nataMat, nataList.length);
  nata.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  model.add(nata);

  const syrupPts = [new V2(0.001, 0.06), new V2(rAt(0.06) - 0.07, 0.06)];
  for (let i = 0; i <= 5; i++) { const y = 0.09 + (BED + 0.01 - 0.09) * (i / 5); syrupPts.push(new V2(rAt(y) - 0.032, y)); }
  syrupPts.push(new V2(0.001, BED + 0.01));
  const syrupMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2a18, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.45, depthWrite: false });
  const syrup = new THREE.Mesh(new THREE.LatheGeometry(syrupPts, SEG), syrupMat);
  syrup.renderOrder = 2;
  model.add(syrup);

  // ---------- 液体（上から下へグラデーション） ----------
  const liqPts = [new V2(0.001, BED), new V2(rAt(BED) - 0.06, BED), new V2(rAt(BED + 0.03) - 0.042, BED + 0.03)];
  for (let i = 1; i <= 12; i++) { const y = BED + 0.03 + (FILL - 0.04 - BED - 0.03) * (i / 12); liqPts.push(new V2(rAt(y) - 0.042, y)); }
  liqPts.push(new V2(rAt(FILL) - 0.07, FILL));
  liqPts.push(new V2(0.001, FILL + 0.004));
  const liqGeo = new THREE.LatheGeometry(liqPts, SEG);
  const liqColors = new Float32Array(liqGeo.attributes.position.count * 3);
  liqGeo.setAttribute('color', new THREE.BufferAttribute(liqColors, 3));
  const liqMat = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.18,
    sheen: 0.25, sheenColor: new THREE.Color(0xfff3e3), sheenRoughness: 0.6, envMapIntensity: 0.55,
  });
  const liquid = new THREE.Mesh(liqGeo, liqMat);
  model.add(liquid);

  // 黒糖の「虎もよう」
  const stripeRnd = mulberry32(7);
  const stripeTex = canvasTexture(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let k = 0; k < 13; k++) {
      const x0 = (k / 13) * w + stripeRnd() * 18;
      const len = h * (0.55 + stripeRnd() * 0.45);
      const width = 5 + stripeRnd() * 11;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, 'rgba(78,38,14,0.95)');
      grad.addColorStop(0.7, 'rgba(78,38,14,0.55)');
      grad.addColorStop(1, 'rgba(78,38,14,0)');
      g.strokeStyle = grad; g.lineWidth = width; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, 0);
      for (let y = 0; y <= len; y += 8) g.lineTo(x0 + Math.sin(y * 0.035 + k) * 9 + y * 0.06, y);
      g.stroke();
    }
  });
  stripeTex.wrapS = THREE.RepeatWrapping;
  stripeTex.repeat.set(2, 1);
  const stripePts = [];
  for (let i = 0; i <= 8; i++) { const y = BED - 0.05 + (FILL - 0.02 - BED + 0.05) * (i / 8); stripePts.push(new V2(rAt(y) - 0.026, y)); }
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTex, transparent: true, opacity: 0, depthWrite: false, roughness: 0.25 });
  const stripes = new THREE.Mesh(new THREE.LatheGeometry(stripePts, SEG), stripeMat);
  stripes.renderOrder = 3;
  stripes.visible = false;
  model.add(stripes);

  // ---------- チーズフォーム ----------
  const foamPts = [new V2(0.001, -0.02), new V2(rAt(FILL) - 0.045, -0.02)];
  [[0.12, -0.045], [0.22, -0.06], [0.29, -0.13], [0.33, -0.3], [0.345, -0.55], [0.35, -1]].forEach(([dy, dr]) => {
    foamPts.push(new V2(dr === -1 ? 0.001 : rAt(FILL + dy) + dr, dy));
  });
  const foamMat = new THREE.MeshPhysicalMaterial({ color: 0xf8f0e2, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.5 });
  const foam = new THREE.Mesh(new THREE.LatheGeometry(foamPts, SEG), foamMat);
  foam.position.y = FILL;
  foam.scale.y = 0.001;
  foam.visible = false;
  model.add(foam);

  // ---------- 氷 ----------
  const iceMat = addFresnel(new THREE.MeshPhysicalMaterial({
    color: 0xf3fbff, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.42, depthWrite: false, envMapIntensity: 1.8,
  }), 0.5, 2);
  const iceGeo = new RoundedBoxGeometry(0.44, 0.4, 0.42, 3, 0.08);
  const ices = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(iceGeo, iceMat);
    const a = i * 1.07 + rnd() * 0.4;
    const d = 0.22 + rnd() * 0.36;
    m.userData = {
      x: Math.cos(a) * d, z: Math.sin(a) * d, y: FILL + 0.02 + rnd() * 0.08,
      rx: rnd() * 0.8, ry: rnd() * 3, rz: rnd() * 0.8, ph: rnd() * 6.28, s: 0,
    };
    m.renderOrder = 4;
    m.visible = false;
    model.add(m);
    ices.push(m);
  }

  // ---------- カップ（ガラスの外側と内側） ----------
  const cupPts = [new V2(0.001, 0), new V2(RB - 0.1, 0), new V2(RB - 0.025, 0.025), new V2(RB, 0.1)];
  for (let i = 1; i <= 14; i++) { const y = 0.1 + (H - 0.1) * (i / 14); cupPts.push(new V2(rAt(y), y)); }
  const cupGeo = new THREE.LatheGeometry(cupPts, SEG);
  const cupBack = new THREE.Mesh(cupGeo, glassMat(0.1, THREE.BackSide));
  cupBack.renderOrder = 5;
  const cupFront = new THREE.Mesh(cupGeo, glassMat(0.14, THREE.FrontSide));
  cupFront.renderOrder = 9;
  model.add(cupBack, cupFront);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RT + 0.012, 0.03, 10, SEG),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.7, depthWrite: false })
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = H; rim.renderOrder = 10;
  model.add(rim);

  // ---------- 紙のスリーブ（ロゴ入り） ----------
  const sleeveTex = canvasTexture(1024, 136, (g, w, h) => {
    g.fillStyle = '#F4E6D2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#E5CDB0'; g.fillRect(0, 8, w, 3); g.fillRect(0, h - 11, w, 3);
    for (let k = 0; k < 2; k++) {
      const ox = k * (w / 2);
      g.fillStyle = '#7A5038';
      g.textBaseline = 'middle';
      g.font = 'italic 600 58px Fraunces, Georgia, serif';
      g.fillText('Pururu', ox + 70, h / 2 - 4);
      g.font = '700 22px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';
      g.fillText('ぷるる茶房', ox + 300, h / 2 - 14);
      g.font = '500 15px Fraunces, Georgia, serif';
      g.fillText('TEA STAND', ox + 302, h / 2 + 16);
      g.fillStyle = '#D9A3A1';
      [[ox + 34, 0], [ox + 440, -14], [ox + 462, 6], [ox + 444, 22]].forEach(([x, dy], i) => {
        g.beginPath(); g.arc(x, h / 2 + dy, i === 0 ? 9 : 7, 0, Math.PI * 2); g.fill();
      });
    }
  });
  const sleevePts = [];
  for (let i = 0; i <= 6; i++) { const y = 1.16 + 0.68 * (i / 6); sleevePts.push(new V2(rAt(y) + 0.008, y)); }
  const sleeve = new THREE.Mesh(new THREE.LatheGeometry(sleevePts, SEG), new THREE.MeshStandardMaterial({ map: sleeveTex, roughness: 0.75 }));
  sleeve.renderOrder = 8;
  model.add(sleeve);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => sleeveTex.userData.redraw());

  // ---------- ふた（ドーム型） ----------
  const lidPts = [
    new V2(RT + 0.035, H - 0.07), new V2(RT + 0.065, H - 0.03), new V2(RT + 0.065, H + 0.06),
    new V2(RT + 0.01, H + 0.1), new V2(RT * 0.92, H + 0.17), new V2(RT * 0.76, H + 0.27),
    new V2(RT * 0.52, H + 0.34), new V2(0.22, H + 0.37), new V2(0.001, H + 0.375),
  ];
  const lidGeo = new THREE.LatheGeometry(lidPts, SEG);
  const lidBack = new THREE.Mesh(lidGeo, glassMat(0.12, THREE.BackSide)); lidBack.renderOrder = 11;
  const lidFront = new THREE.Mesh(lidGeo, glassMat(0.22, THREE.FrontSide)); lidFront.renderOrder = 12;
  model.add(lidBack, lidFront);

  // ---------- 太いストロー ----------
  const sA = new THREE.Vector3(0.1, 0.16, 0.12);
  const sB = new THREE.Vector3(0.52, H + 1.35, -0.06);
  const sDir = new THREE.Vector3().subVectors(sB, sA);
  const sLen = sDir.length(); sDir.normalize();
  const strawGeo = new THREE.CylinderGeometry(0.135, 0.135, sLen, low ? 20 : 32, 1, true);
  const strawOuter = new THREE.Mesh(strawGeo, new THREE.MeshPhysicalMaterial({ color: 0xd99a9b, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, side: THREE.FrontSide }));
  const strawInner = new THREE.Mesh(strawGeo, new THREE.MeshStandardMaterial({ color: 0x9d5f62, roughness: 0.7, side: THREE.BackSide }));
  const strawG = new THREE.Group();
  strawG.add(strawOuter, strawInner);
  strawG.position.copy(sA).addScaledVector(sDir, sLen / 2);
  strawG.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sDir);
  model.add(strawG);
  const strawRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 8, 32), strawOuter.material);
  strawRing.position.copy(sB);
  strawRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sDir);
  model.add(strawRing);

  // ---------- 状態 ----------
  const pose = { x: 0, y: 0, s: 1 };
  const cur = { x: 0, y: 0, s: 1, rot: 0, drag: 0, tx: 0, ty: 0 };
  let scrollRot = 0, drag = 0, tiltX = 0, tiltY = 0;
  const colTarget = { top: new THREE.Color(), bottom: new THREE.Color(), syrup: new THREE.Color(), stripes: 0 };
  const colCur = { top: new THREE.Color(), bottom: new THREE.Color(), syrup: new THREE.Color(), stripes: 0 };
  const options = { sweet: 1, ice: 2, extraPearls: false, foam: false, nata: false };
  let sweetCur = 1;
  let colorsDirty = true;

  const tmp = new THREE.Color();
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function paintLiquid() {
    const pos = liqGeo.attributes.position;
    const sweetDark = 0.1 + 0.25 * clamp(sweetCur / 1.2, 0, 1);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = clamp((y - BED) / (FILL - BED), 0, 1);
      tmp.copy(colCur.bottom).lerp(colCur.top, smooth(0.0, 0.8, t));
      if (t < 0.18) tmp.lerp(colCur.syrup, ((0.18 - t) / 0.18) * sweetDark);
      liqColors[i * 3] = tmp.r; liqColors[i * 3 + 1] = tmp.g; liqColors[i * 3 + 2] = tmp.b;
    }
    liqGeo.attributes.color.needsUpdate = true;
    syrupMat.color.copy(colCur.syrup);
    syrupMat.opacity = 0.22 + 0.42 * clamp(sweetCur / 1.2, 0, 1);
    stripeMat.opacity = colCur.stripes * 0.6;
    stripes.visible = colCur.stripes > 0.01;
  }

  // ---------- サイズ ----------
  let visW = 1, visH = 1, base = 1;
  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const dist = camera.position.length();
    visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    visW = visH * camera.aspect;
    base = Math.min((visH * 0.74) / 4.7, (visW * 0.92) / 2.5);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // ---------- 入力（傾き・ドラッグ） ----------
  const onMove = (cx, cy) => {
    if (o.tiltArea === 'element') {
      const r = container.getBoundingClientRect();
      tiltX = clamp(((cx - r.left) / r.width) * 2 - 1, -1, 1);
      tiltY = clamp(((cy - r.top) / r.height) * 2 - 1, -1, 1);
    } else {
      tiltX = (cx / window.innerWidth) * 2 - 1;
      tiltY = (cy / window.innerHeight) * 2 - 1;
    }
  };
  const onMouse = (e) => { if (e.pointerType === 'mouse') onMove(e.clientX, e.clientY); };
  const onTouch = (e) => { const t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); };
  const onTouchEnd = () => { tiltX = 0; tiltY = 0; };
  const moveTarget = o.tiltArea === 'element' ? container : window;
  moveTarget.addEventListener('pointermove', onMouse, { passive: true });
  moveTarget.addEventListener('touchmove', onTouch, { passive: true });
  moveTarget.addEventListener('touchstart', onTouch, { passive: true });
  moveTarget.addEventListener('touchend', onTouchEnd, { passive: true });
  if (o.tiltArea === 'element') container.addEventListener('pointerleave', onTouchEnd);

  let dragging = false, lastX = 0, velocity = 0;
  if (o.drag) {
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; velocity = 0;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      drag += dx * 0.012; velocity = dx * 0.012;
    });
    const end = () => { dragging = false; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  // ---------- ループ（画面に見えているときだけ描く） ----------
  let running = false, visible = false, raf = 0, last = 0, time = 0, intro = 0, ready = false, bounceT = 9;
  let perfFrames = 0, perfTime = 0;
  const dummy = new THREE.Object3D();

  function frame(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min((now - (last || now)) / 1000, 0.05);
    last = now;
    time += dt;
    const k = 1 - Math.exp(-dt * 4.5);
    const kc = 1 - Math.exp(-dt * 3);

    // 位置・大きさ・回転
    cur.x += (pose.x - cur.x) * k;
    cur.y += (pose.y - cur.y) * k;
    cur.s += (pose.s - cur.s) * k;
    cur.rot += (scrollRot - cur.rot) * k;
    if (!dragging) { drag += velocity; velocity *= 0.92; }
    cur.drag += (drag - cur.drag) * 0.25;
    cur.tx += (tiltX - cur.tx) * k * 0.8;
    cur.ty += (tiltY - cur.ty) * k * 0.8;
    intro = Math.min(1, intro + dt / 1.6);
    const pop = 0.55 + 0.45 * elasticOut(intro);

    root.position.set((cur.x * visW) / 2, (cur.y * visH) / 2, 0);
    // ぷるん（押したときの弾み）：横に伸びると縦が縮む
    bounceT += dt;
    const wob = bounceT < 1.4 ? 0.075 * Math.sin(bounceT * 17) * Math.exp(-bounceT * 4.2) : 0;
    const sc = base * cur.s * pop;
    root.scale.set(sc * (1 + wob), sc * (1 - wob), sc * (1 + wob));
    spin.rotation.y = time * 0.32 + cur.rot + cur.drag - 0.5;
    tilt.rotation.x = cur.ty * 0.16 + Math.sin(time * 0.9) * 0.025;
    tilt.rotation.z = -cur.tx * 0.14 + Math.sin(time * 0.7) * 0.015;
    tilt.position.y = Math.sin(time * 1.1) * 0.04;

    // 色
    if (colorsDirty) {
      let moving = false;
      for (const n of ['top', 'bottom', 'syrup']) {
        const a = colCur[n], b = colTarget[n];
        a.lerp(b, kc);
        if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 0.002) moving = true;
      }
      colCur.stripes += (colTarget.stripes - colCur.stripes) * kc;
      sweetCur += (options.sweet - sweetCur) * kc;
      if (Math.abs(colCur.stripes - colTarget.stripes) > 0.003 || Math.abs(sweetCur - options.sweet) > 0.003) moving = true;
      paintLiquid();
      if (!moving) colorsDirty = false;
    }

    // タピオカ（ふわふわ浮き沈み）
    const nPearl = BASE_PEARLS + (options.extraPearls ? EXTRA_PEARLS : 0);
    pearlList.forEach((p, i) => {
      const target = (p.type === 'pearl' || (p.type === 'extra' && options.extraPearls)) && i < nPearl ? 1 : 0;
      p.s += (target - p.s) * (target ? 0.14 : 0.2);
      const t = time * p.sp + p.ph;
      dummy.position.set(p.x + Math.cos(t * 0.7) * 0.014, p.y + Math.sin(t) * 0.034, p.z + Math.sin(t * 0.8) * 0.014);
      dummy.rotation.set(0, p.ph, 0);
      dummy.scale.setScalar(Math.max(0.0001, p.s));
      dummy.updateMatrix();
      pearls.setMatrixAt(i, dummy.matrix);
    });
    pearls.instanceMatrix.needsUpdate = true;
    nataList.forEach((p, i) => {
      const target = options.nata ? 1 : 0;
      p.s += (target - p.s) * 0.15;
      const t = time * p.sp + p.ph;
      dummy.position.set(p.x, p.y + Math.sin(t) * 0.03, p.z);
      dummy.rotation.set(p.ph, p.ph * 2 + time * 0.2, p.ph * 0.5);
      dummy.scale.setScalar(Math.max(0.0001, p.s));
      dummy.updateMatrix();
      nata.setMatrixAt(i, dummy.matrix);
    });
    nata.instanceMatrix.needsUpdate = true;

    // 氷
    const iceN = [0, 2, 4, 6][options.ice] ?? 4;
    ices.forEach((m, i) => {
      const d = m.userData;
      const target = i < iceN ? 1 : 0;
      d.s += (target - d.s) * 0.15;
      m.visible = d.s > 0.01;
      m.position.set(d.x, d.y + Math.sin(time * 1.2 + d.ph) * 0.025 + (options.foam ? 0.06 : 0), d.z);
      m.rotation.set(d.rx + Math.sin(time * 0.8 + d.ph) * 0.05, d.ry, d.rz);
      m.scale.setScalar(Math.max(0.0001, d.s));
    });

    // フォーム
    const foamT = options.foam ? 1 : 0;
    foam.scale.y += (foamT - foam.scale.y) * 0.12;
    foam.visible = foam.scale.y > 0.01;

    renderer.render(scene, camera);
    if (!ready) { ready = true; container.classList.add('is-3d'); }

    // 重い端末では解像度を自動で下げる
    perfFrames++; perfTime += dt;
    if (perfFrames >= 90) {
      if (perfTime / perfFrames > 1 / 40 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        renderer.setPixelRatio(dpr);
        resize();
      }
      perfFrames = 0; perfTime = 0;
    }

    raf = requestAnimationFrame(frame);
  }

  function updateRunning() {
    const should = visible && !document.hidden;
    if (should && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  }
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    updateRunning();
  }, { rootMargin: '100px' });
  io.observe(container);
  document.addEventListener('visibilitychange', updateRunning);

  // ---------- API ----------
  return {
    setFlavor(c, immediate = false) {
      // ACES トーンマッピングで色が薄く見えるので、少しだけ濃く・鮮やかにする
      colTarget.top.set(c.top).offsetHSL(0, 0.1, -0.07);
      colTarget.bottom.set(c.bottom).offsetHSL(0, 0.12, -0.06);
      colTarget.syrup.set(c.syrup);
      colTarget.stripes = c.stripes ? 1 : 0;
      if (immediate) {
        colCur.top.copy(colTarget.top); colCur.bottom.copy(colTarget.bottom); colCur.syrup.copy(colTarget.syrup);
        colCur.stripes = colTarget.stripes;
      }
      colorsDirty = true;
    },
    setPose(p, immediate = false) {
      Object.assign(pose, p);
      if (immediate) { cur.x = pose.x; cur.y = pose.y; cur.s = pose.s; }
    },
    setScrollRotation(r) { scrollRot = r; },
    setOptions(p) { Object.assign(options, p); colorsDirty = true; },
    bounce() { bounceT = 0; },
    destroy() {
      running = false; io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', updateRunning);
      renderer.dispose(); canvas.remove();
    },
  };
}
