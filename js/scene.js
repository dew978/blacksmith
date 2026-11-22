import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;

// ───────── 절차적 텍스처 ─────────
function canvasTexture(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function speckle(g, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, rand(1, 3), rand(1, 3));
  }
}
function brickTexture(repeat, tint = [58, 50, 44]) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#1a1512'; g.fillRect(0, 0, w, h);
    const bh = 64, bw = 128;
    for (let row = 0; row < h / bh; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const s = rand(0.7, 1.15);
        g.fillStyle = `rgb(${tint[0] * s | 0},${tint[1] * s | 0},${tint[2] * s | 0})`;
        const r = 6;
        g.beginPath();
        g.roundRect(x + off + 4, row * bh + 4, bw - 8, bh - 8, r);
        g.fill();
        // 모서리 마모
        g.fillStyle = 'rgba(0,0,0,.18)';
        g.fillRect(x + off + 4, row * bh + bh - 14, bw - 8, 10);
      }
    }
    speckle(g, w, h, 9000, 0.22);
  }, { repeat });
}
function flagstoneTexture(repeat) {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#120e0b'; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = rand(0.75, 1.1);
      g.fillStyle = `rgb(${52 * k | 0},${44 * k | 0},${38 * k | 0})`;
      g.beginPath(); g.roundRect(x * s + 5, y * s + 5, s - 10, s - 10, 10); g.fill();
    }
    speckle(g, w, h, 12000, 0.2);
  }, { repeat });
}
function woodTexture(repeat, base = [92, 62, 38]) {
  return canvasTexture(256, 256, (g, w, h) => {
    for (let x = 0; x < w; x += 64) {
      const k = rand(0.8, 1.1);
      g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      g.fillRect(x, 0, 64, h);
      g.strokeStyle = 'rgba(0,0,0,.25)';
      for (let i = 0; i < 9; i++) {
        g.beginPath(); const xx = x + rand(4, 60);
        g.moveTo(xx, 0); g.bezierCurveTo(xx + rand(-6, 6), h * .3, xx + rand(-6, 6), h * .7, xx + rand(-4, 4), h); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, 2, h);
    }
    speckle(g, w, h, 1500, 0.12);
  }, { repeat });
}
function softDot(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,.35)') {
  return canvasTexture(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, inner); gr.addColorStop(0.35, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}
function fireTexture() {
  return canvasTexture(256, 192, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h * 0.85, 4, w / 2, h * 0.7, w * 0.6);
    gr.addColorStop(0, '#fff4c0'); gr.addColorStop(0.25, '#ffb03a'); gr.addColorStop(0.6, '#c3360c'); gr.addColorStop(1, '#2a0602');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { // 숯
      g.fillStyle = `rgba(${rand(40, 90) | 0},10,0,${rand(.4, .9)})`;
      g.beginPath(); g.ellipse(rand(10, w - 10), rand(h * .78, h), rand(8, 22), rand(4, 9), 0, 0, Math.PI * 2); g.fill();
    }
  });
}

// ───────── 검 외형: 강화 단계마다 다른 모양 ─────────
// 금속이 반사할 주변 환경 (World가 만들 때 채운다). 없으면 금·강철이 갈색으로 죽어 보인다.
let BLADE_ENV = null;
const mstd = (color, rough = 0.4, metal = 0.9, emissive = 0x000000, ei = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, envMap: BLADE_ENV, envMapIntensity: 0.15 });
const mglow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
function bladeMat(color, rough, metal, glow = 0x000000, gi = 0) {
  const m = mstd(color, rough, metal, glow, gi);
  m.userData.baseEmissive = new THREE.Color(glow); m.userData.baseEI = gi;
  return m;
}
// 오른쪽 윤곽(밑동→끝)을 주면 좌우 대칭 모양을 만든다. 끝점 x가 0이면 뾰족한 끝.
function sym(pts, holes = []) {
  const s = new THREE.Shape();
  s.moveTo(-pts[0][0], pts[0][1]);
  for (const [x, y] of pts) s.lineTo(x, y);
  for (let i = pts.length - 1; i >= 1; i--) {
    if (i === pts.length - 1 && pts[i][0] === 0) continue;
    s.lineTo(-pts[i][0], pts[i][1]);
  }
  s.closePath();
  for (const h of holes) s.holes.push(h);
  return s;
}
function shapeOf(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); s.closePath(); return s; }
function flat(shape, mat, depth = 0.008, bev = 0.006) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 12 });
  g.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
function part(root, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; root.add(m); return m; }
const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const FACE = 0.0103; // 칼날 표면 높이 (앞뒤)
function bothFaces(root, geo, mat, x, y) { part(root, geo, mat, x, y, FACE); part(root, geo, mat, x, y, -FACE); }
// 손잡이: 아래 끝 y를 돌려준다
function hilt(root, { len = 0.16, r = 0.018, color = 0x3a2214, wraps = 0, wrapMat } = {}) {
  part(root, new THREE.CylinderGeometry(r, r * 1.1, len, 10), mstd(color, 0.85, 0.05), 0, -0.034 - len / 2, 0);
  for (let i = 0; i < wraps; i++) {
    const t = part(root, new THREE.TorusGeometry(r * 1.06, 0.0035, 5, 14), wrapMat || mstd(0x1a0f08, 0.8, 0.2), 0, -0.034 - len * (i + 0.5) / wraps, 0);
    t.rotation.x = Math.PI / 2;
  }
  return -0.034 - len;
}
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

const BLADES = [
  // 0 녹슨 깃펜칼: 펜촉 모양, 이 빠진 날, 깃털 손잡이
  (root) => {
    const mat = bladeMat(0x6e4a32, 0.85, 0.3);
    const hole = new THREE.Path(); hole.absarc(0, 0.29, 0.009, 0, Math.PI * 2, true);
    root.add(flat(sym([[0.034, 0], [0.038, 0.1], [0.03, 0.15], [0.039, 0.19], [0.035, 0.27], [0.026, 0.35], [0.014, 0.42], [0, 0.47]], [hole]), mat));
    part(root, Box(0.003, 0.13, 0.026), mstd(0x150c06, 1, 0), 0, 0.37, 0);
    part(root, Box(0.11, 0.03, 0.045), mstd(0x4a3626, 0.9, 0.1), 0, -0.017, 0);
    const b = hilt(root, { len: 0.13, color: 0x5a3e28 });
    const f = flat(sym([[0.008, 0], [0.026, 0.05], [0.024, 0.1], [0.012, 0.14], [0, 0.17]]), mstd(0xd8cbb0, 0.9, 0), 0.003, 0.002);
    f.rotation.z = Math.PI + 0.22; f.position.y = b + 0.01; root.add(f);
    return { mat, tip: 0.47 };
  },
  // 1 갈아 낸 연필검: 육각 몸통, 깎은 나무, 흑연 끝, 지우개 손잡이
  (root) => {
    const mat = bladeMat(0x9a958c, 0.45, 0.7);
    part(root, new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), mat, 0, 0.2, 0);
    part(root, new THREE.CylinderGeometry(0.0095, 0.03, 0.12, 6), mstd(0xd9b48a, 0.8, 0), 0, 0.46, 0);
    part(root, new THREE.ConeGeometry(0.0095, 0.04, 6), mstd(0x26262a, 0.3, 0.6), 0, 0.54, 0);
    part(root, new THREE.CylinderGeometry(0.031, 0.031, 0.012, 6), mstd(0xd9a640, 0.3, 1), 0, 0.06, 0);
    const fer = mstd(0xc8ccd0, 0.25, 1);
    part(root, new THREE.CylinderGeometry(0.036, 0.036, 0.05, 16), fer, 0, -0.01, 0);
    for (const y of [-0.0, -0.02]) { const t = part(root, new THREE.TorusGeometry(0.036, 0.003, 5, 16), mstd(0x8a8e92, 0.3, 1), 0, y, 0); t.rotation.x = Math.PI / 2; }
    const b = hilt(root, { len: 0.12, r: 0.024, color: 0xd9a13a });
    part(root, new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), mstd(0xe8899a, 0.9, 0), 0, b - 0.022, 0);
    return { mat, tip: 0.56 };
  },
  // 2 다듬은 잉크검: 잎사귀 날, 처진 가드, 잉크 방울
  (root) => {
    const mat = bladeMat(0x1e2a48, 0.3, 0.6, 0x0a1838, 0.45); mat.envMapIntensity = 0.08;
    root.add(flat(sym([[0.03, 0], [0.034, 0.15], [0.045, 0.36], [0.048, 0.44], [0.036, 0.53], [0.016, 0.6], [0, 0.64]]), mat));
    const gm = mstd(0x2a3248, 0.35, 0.9);
    for (const sx of [-1, 1]) { const a = part(root, Box(0.07, 0.022, 0.04), gm, sx * 0.04, -0.024, 0); a.rotation.z = -sx * 0.35; }
    for (const z of [-0.022, 0.022]) part(root, new THREE.SphereGeometry(0.013, 12, 10), mglow(0.5, 0.9, 2.6), 0, -0.02, z);
    const b = hilt(root, { len: 0.14, color: 0x1e1a24 });
    part(root, new THREE.SphereGeometry(0.024, 14, 12), gm, 0, b - 0.018, 0);
    const c = part(root, new THREE.ConeGeometry(0.02, 0.04, 14), gm, 0, b - 0.045, 0); c.rotation.z = Math.PI;
    return { mat, tip: 0.64 };
  },
  // 3 공책 철검: 넓은 날, 스프링 제본 고리, 줄 노트
  (root) => {
    const mat = bladeMat(0x8f8e88, 0.5, 0.75);
    root.add(flat(shapeOf([[-0.045, 0], [0.045, 0], [0.045, 0.58], [-0.045, 0.66]]), mat));
    const ring = mstd(0x2c2e33, 0.4, 0.9);
    for (let i = 0; i < 8; i++) { const t = part(root, new THREE.TorusGeometry(0.013, 0.0028, 5, 14), ring, -0.05, 0.05 + i * 0.07, 0); t.rotation.x = Math.PI / 2; }
    const line = mstd(0x3d5c9e, 0.8, 0.1);
    for (let i = 0; i < 6; i++) bothFaces(root, Box(0.07, 0.0025, 0.001), line, 0.01, 0.08 + i * 0.08);
    bothFaces(root, Box(0.0025, 0.52, 0.001), mstd(0x9e3a3a, 0.8, 0.1), -0.025, 0.29);
    part(root, Box(0.17, 0.03, 0.05), mstd(0x3a3c40, 0.4, 0.9), 0, -0.017, 0);
    const b = hilt(root, { len: 0.15, color: 0x2a2a2e });
    const p = part(root, Box(0.04, 0.04, 0.04), mstd(0x3a3c40, 0.4, 0.9), 0, b - 0.02, 0); p.rotation.set(0.6, 0.6, 0);
    return { mat, tip: 0.66 };
  },
  // 4 쓸 만한 문법검: 외날 펄션, S자 가드
  (root) => {
    const mat = bladeMat(0xa9aba8, 0.38, 0.85);
    root.add(flat(shapeOf([[-0.034, 0], [0.036, 0], [0.05, 0.25], [0.062, 0.5], [0.05, 0.63], [-0.02, 0.72], [-0.034, 0.62]]), mat));
    bothFaces(root, Box(0.009, 0.5, 0.001), mstd(0x6a6c6a, 0.4, 0.9), -0.016, 0.3);
    const gm = mstd(0x7a5a2a, 0.35, 0.9);
    part(root, Box(0.14, 0.026, 0.045), gm, 0, -0.017, 0);
    part(root, new THREE.SphereGeometry(0.016, 10, 8), gm, 0.072, -0.002, 0);
    part(root, new THREE.SphereGeometry(0.016, 10, 8), gm, -0.072, -0.032, 0);
    const b = hilt(root, { len: 0.15, wraps: 3, wrapMat: gm });
    const d = part(root, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 18), gm, 0, b - 0.02, 0); d.rotation.x = Math.PI / 2;
    return { mat, tip: 0.72 };
  },
  // 5 단단한 공식검: 무장검, 등호 장식, 삼각 가드
  (root) => {
    const mat = bladeMat(0xbcc5cc, 0.3, 0.9);
    root.add(flat(sym([[0.038, 0], [0.036, 0.52], [0.03, 0.62], [0.014, 0.7], [0, 0.74]]), mat));
    bothFaces(root, Box(0.012, 0.48, 0.001), mstd(0x707880, 0.3, 0.9), 0, 0.3);
    const gold = mstd(0xd9a640, 0.25, 1);
    part(root, Box(0.05, 0.008, 0.024), gold, 0, 0.085, 0); part(root, Box(0.05, 0.008, 0.024), gold, 0, 0.11, 0);
    const gm = mstd(0x5a6068, 0.3, 0.95);
    part(root, Box(0.19, 0.028, 0.045), gm, 0, -0.017, 0);
    for (const sx of [-1, 1]) { const c = part(root, new THREE.ConeGeometry(0.024, 0.045, 3), gm, sx * 0.115, -0.017, 0); c.rotation.z = -sx * Math.PI / 2; }
    const b = hilt(root, { len: 0.16, wraps: 4 });
    part(root, new THREE.OctahedronGeometry(0.03), gm, 0, b - 0.024, 0);
    return { mat, tip: 0.74 };
  },
  // 6 빛나는 개념검: 잎날, 빛나는 중심선, 초승달 가드, 전구 손잡이
  (root) => {
    const mat = bladeMat(0xd3dce4, 0.2, 0.95, 0x224466, 0.25);
    root.add(flat(sym([[0.036, 0], [0.04, 0.2], [0.054, 0.48], [0.05, 0.6], [0.03, 0.71], [0, 0.79]]), mat));
    bothFaces(root, Box(0.006, 0.56, 0.001), mglow(0.6, 1.5, 2.4), 0, 0.32);
    const g = part(root, new THREE.TorusGeometry(0.075, 0.012, 8, 24, Math.PI), mstd(0xc9b07a, 0.3, 1), 0, 0.045, 0); g.rotation.z = Math.PI;
    const b = hilt(root, { len: 0.15, wraps: 3, wrapMat: mstd(0xc9b07a, 0.3, 1) });
    part(root, new THREE.CylinderGeometry(0.018, 0.022, 0.02, 12), mstd(0x9a9ea2, 0.3, 1), 0, b - 0.008, 0);
    part(root, new THREE.SphereGeometry(0.03, 16, 12), mglow(3, 2.4, 1.1), 0, b - 0.04, 0);
    return { mat, tip: 0.79 };
  },
  // 7 원리의 장검: 길고 곧은 날, 긴 가드, 바퀴 모양 손잡이 끝
  (root) => {
    const mat = bladeMat(0xd0d8df, 0.22, 0.95);
    root.add(flat(sym([[0.035, 0], [0.033, 0.7], [0.026, 0.82], [0.012, 0.9], [0, 0.94]]), mat));
    bothFaces(root, Box(0.01, 0.66, 0.001), mstd(0x7a828a, 0.3, 0.9), 0, 0.37);
    const gm = mstd(0x4a4e56, 0.3, 0.95);
    part(root, Box(0.3, 0.024, 0.04), gm, 0, -0.017, 0);
    for (const sx of [-1, 1]) part(root, new THREE.SphereGeometry(0.019, 10, 8), gm, sx * 0.15, -0.017, 0);
    const b = hilt(root, { len: 0.22, wraps: 6 });
    const w = part(root, new THREE.CylinderGeometry(0.036, 0.036, 0.024, 20), gm, 0, b - 0.03, 0); w.rotation.x = Math.PI / 2;
    part(root, new THREE.SphereGeometry(0.012, 10, 8), mstd(0xc9a24a, 0.3, 1), 0, b - 0.03, 0.014);
    return { mat, tip: 0.94 };
  },
  // 8 통찰의 검: 눈 모양 구멍 속 보석, 날개 가드
  (root) => {
    const mat = bladeMat(0xdde2ea, 0.2, 0.95, 0x221a40, 0.2);
    const hole = new THREE.Path(); hole.absellipse(0, 0.16, 0.022, 0.05, 0, Math.PI * 2, true);
    root.add(flat(sym([[0.048, 0], [0.05, 0.62], [0.038, 0.78], [0.018, 0.87], [0, 0.92]], [hole]), mat));
    const gem = part(root, new THREE.OctahedronGeometry(0.018), mglow(1.6, 0.8, 3.4), 0, 0.16, 0); gem.scale.y = 1.7;
    const gold = mstd(0xd9b860, 0.25, 1);
    const eye = part(root, new THREE.TorusGeometry(0.03, 0.004, 6, 28), gold, 0, 0.16, 0); eye.scale.y = 1.9;
    const wing = shapeOf([[0, 0], [0.12, 0.025], [0.15, 0.075], [0.09, 0.045], [0.02, 0.03]]);
    for (const sx of [-1, 1]) { const m = flat(wing, gold, 0.014, 0.004); m.scale.x = sx; m.position.y = -0.04; root.add(m); }
    const b = hilt(root, { len: 0.18, wraps: 4, wrapMat: gold });
    part(root, new THREE.SphereGeometry(0.026, 14, 12), mglow(1.4, 0.7, 3), 0, b - 0.024, 0);
    return { mat, tip: 0.92 };
  },
  // 9 학자의 대검: 넓은 대검, 책 모양 가드
  (root) => {
    const mat = bladeMat(0xe6cf8a, 0.22, 1.0, 0x332200, 0.2);
    root.add(flat(sym([[0.058, 0], [0.056, 0.78], [0.045, 0.9], [0.02, 0.98], [0, 1.0]]), mat));
    bothFaces(root, Box(0.016, 0.7, 0.001), mstd(0x9a7a3a, 0.3, 1), 0, 0.38);
    const cover = mstd(0x6b2b1a, 0.7, 0.1);
    for (const z of [-0.036, 0.036]) part(root, Box(0.22, 0.062, 0.008), cover, 0, -0.033, z);
    part(root, Box(0.008, 0.062, 0.08), cover, -0.11, -0.033, 0);
    part(root, Box(0.21, 0.054, 0.064), mstd(0xeee0c0, 0.9, 0), 0.004, -0.033, 0);
    const gold = mstd(0xe0b040, 0.25, 1);
    const b = hilt(root, { len: 0.24, wraps: 5, wrapMat: gold, color: 0x2a140c });
    part(root, new THREE.SphereGeometry(0.034, 16, 12), gold, 0, b - 0.026, 0);
    return { mat, tip: 1.0 };
  },
  // 10 현자의 빛검: 물결 날(플랑베르주), 태양 가드
  (root) => {
    const mat = bladeMat(0xf1c862, 0.2, 1.0, 0x553300, 0.4);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const y = i / 24 * 0.86; pts.push([0.042 + 0.009 * Math.sin(y * 38) * Math.min(1, y / 0.08), y]); }
    pts.push([0.035, 0.92], [0.016, 0.99], [0, 1.03]);
    root.add(flat(sym(pts), mat));
    const gold = mstd(0xe8b84a, 0.2, 1, 0x442200, 0.3);
    const disc = part(root, new THREE.CylinderGeometry(0.05, 0.05, 0.022, 28), gold, 0, -0.03, 0); disc.rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + Math.PI / 10 + i * (Math.PI * 2 - Math.PI / 5) / 9;
      const r = part(root, new THREE.ConeGeometry(0.009, 0.045, 6), gold, Math.cos(a) * 0.072, -0.03 + Math.sin(a) * 0.072, 0); r.rotation.z = a - Math.PI / 2;
    }
    for (const z of [-0.013, 0.013]) part(root, new THREE.SphereGeometry(0.016, 12, 10), mglow(3.5, 1, 0.4), 0, -0.03, z);
    const b = hilt(root, { len: 0.2, wraps: 4, wrapMat: gold });
    part(root, new THREE.SphereGeometry(0.026, 14, 12), mglow(3, 2, 0.8), 0, b - 0.022, 0);
    return { mat, tip: 1.03 };
  },
  // 11 진리의 쌍날검: 끝이 두 갈래, 겹 가드
  (root) => {
    const mat = bladeMat(0xeae4c0, 0.18, 1.0, 0x2a5560, 0.5);
    root.add(flat(sym([[0.052, 0], [0.055, 0.5], [0.062, 0.72], [0.052, 0.9], [0.034, 1.02], [0.02, 0.9], [0.008, 0.82], [0, 0.8]]), mat));
    bothFaces(root, Box(0.006, 0.7, 0.001), mglow(0.8, 2.6, 3), 0, 0.4);
    const gm = mstd(0xcdb46a, 0.22, 1);
    part(root, Box(0.26, 0.016, 0.04), gm, 0, -0.008, 0);
    part(root, Box(0.22, 0.016, 0.04), gm, 0, -0.036, 0);
    for (const sx of [-1, 1]) part(root, new THREE.OctahedronGeometry(0.014), mglow(1, 3, 3.6), sx * 0.07, -0.022, 0);
    const b = hilt(root, { len: 0.22, wraps: 5, wrapMat: gm });
    for (const sx of [-1, 1]) part(root, new THREE.SphereGeometry(0.02, 12, 10), gm, sx * 0.018, b - 0.018, 0);
    return { mat, tip: 1.02 };
  },
  // 12 만물박사의 검: 톱니 가드, 세 빛깔 보석, 나침반 손잡이 끝
  (root) => {
    const mat = bladeMat(0xbfe6e6, 0.18, 0.95, 0x1a6a80, 0.4);
    root.add(flat(sym([[0.058, 0], [0.06, 0.8], [0.05, 0.94], [0.024, 1.03], [0, 1.07]]), mat));
    [[0.2, [4, 1, 0.8]], [0.35, [1, 3.5, 1]], [0.5, [1, 1.6, 4.5]]].forEach(([y, c]) => part(root, new THREE.OctahedronGeometry(0.014), mglow(...c), 0, y, 0));
    const bronze = mstd(0xb08a4a, 0.3, 1);
    part(root, new THREE.TorusGeometry(0.075, 0.012, 8, 36), bronze, 0, -0.03, 0);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const t = part(root, Box(0.022, 0.018, 0.022), bronze, Math.cos(a) * 0.09, -0.03 + Math.sin(a) * 0.09, 0); t.rotation.z = a; }
    const b = hilt(root, { len: 0.22, wraps: 5, wrapMat: bronze });
    const c = part(root, new THREE.CylinderGeometry(0.034, 0.034, 0.02, 24), mstd(0xd9b860, 0.25, 1), 0, b - 0.03, 0); c.rotation.x = Math.PI / 2;
    const n = part(root, Box(0.006, 0.05, 0.004), mglow(3.5, 0.6, 0.4), 0, b - 0.03, 0.012); n.rotation.z = 0.5;
    return { mat, tip: 1.07 };
  },
  // 13 별을 읽는 검: 밤하늘 날에 박힌 별, 초승달 가드
  (root) => {
    const mat = bladeMat(0x1c2c5c, 0.18, 0.9, 0x1a2a77, 0.7);
    root.add(flat(sym([[0.044, 0], [0.047, 0.6], [0.042, 0.86], [0.022, 1.02], [0, 1.1]]), mat));
    const rnd = seeded(1313), star = mglow(4, 4, 5);
    for (let i = 0; i < 14; i++) {
      const y = 0.06 + rnd() * 0.9, half = y < 0.86 ? 0.036 : 0.036 * (1.1 - y) / 0.24;
      bothFaces(root, new THREE.SphereGeometry(0.0035 + rnd() * 0.004, 6, 5), star, (rnd() * 2 - 1) * half, y);
    }
    const moon = mstd(0xf0e0a0, 0.25, 1, 0x553a10, 0.5);
    const arc = Math.PI * 1.3;
    const m = part(root, new THREE.TorusGeometry(0.075, 0.014, 8, 28, arc), moon, 0, 0.045, 0); m.rotation.z = -Math.PI / 2 - arc / 2;
    const b = hilt(root, { len: 0.22, wraps: 5, wrapMat: moon, color: 0x101a38 });
    part(root, new THREE.OctahedronGeometry(0.03), mglow(3.5, 3.5, 4.5), 0, b - 0.026, 0);
    return { mat, tip: 1.1 };
  },
  // 14 지혜의 성검: 흰 금빛 날, 날개 가드, 후광
  (root) => {
    const mat = bladeMat(0xf6f1e2, 0.18, 1.0, 0x664422, 0.35);
    root.add(flat(sym([[0.06, 0], [0.062, 0.4], [0.058, 0.8], [0.045, 0.98], [0.02, 1.08], [0, 1.12]]), mat));
    bothFaces(root, Box(0.012, 0.85, 0.001), mstd(0xe8c060, 0.2, 1, 0x664400, 0.6), 0, 0.46);
    const gold = mstd(0xf2d27a, 0.2, 1, 0x553311, 0.4);
    const wing = shapeOf([[0, -0.01], [0.17, 0.04], [0.19, 0.11], [0.15, 0.07], [0.155, 0.1], [0.11, 0.055], [0.11, 0.08], [0.05, 0.03], [0, 0.02]]);
    for (const sx of [-1, 1]) { const w = flat(wing, gold, 0.014, 0.004); w.scale.x = sx; w.position.y = -0.04; root.add(w); }
    part(root, new THREE.TorusGeometry(0.06, 0.005, 6, 36), mglow(3, 2.6, 1.4), 0, 0.07, 0);
    const b = hilt(root, { len: 0.24, wraps: 5, wrapMat: gold, color: 0xeee6d0 });
    part(root, new THREE.OctahedronGeometry(0.034), mglow(3.5, 2.5, 1), 0, b - 0.03, 0);
    return { mat, tip: 1.12 };
  },
  // 15 전설의 지식검: 빛나는 수정 날, 펼친 책 가드, 룬 고리
  (root) => {
    const mat = bladeMat(0x4fb8d4, 0.12, 0.6, 0x2aa6c8, 0.25);
    root.add(flat(sym([[0.06, 0], [0.066, 0.3], [0.07, 0.7], [0.055, 0.95], [0.03, 1.12], [0, 1.2]]), mat));
    root.add(flat(sym([[0.012, 0.04], [0.016, 0.7], [0, 1.05]]), mglow(0.25, 0.6, 0.75), 0.023, 0));
    const rune = mglow(0.5, 1.3, 1.6);
    part(root, new THREE.TorusGeometry(0.11, 0.004, 6, 48), rune, 0, 0.35, 0);
    part(root, new THREE.TorusGeometry(0.09, 0.004, 6, 48), rune, 0, 0.8, 0);
    const page = mstd(0xfff3d6, 0.6, 0, 0xffd890, 0.7), gold = mstd(0xf2d27a, 0.2, 1);
    for (const sx of [-1, 1]) { const p = part(root, Box(0.13, 0.008, 0.07), page, sx * 0.062, -0.012, 0); p.rotation.z = sx * 0.35; }
    part(root, Box(0.03, 0.03, 0.075), gold, 0, -0.03, 0);
    const b = hilt(root, { len: 0.26, wraps: 6, wrapMat: rune, color: 0x14283a });
    part(root, new THREE.SphereGeometry(0.036, 18, 14), mglow(1.4, 3.4, 4), 0, b - 0.03, 0);
    return { mat, tip: 1.2 };
  },
];

// 모양이 바뀌는 단계: 원작처럼 초반엔 2강마다 바뀌고, +62부터는 최종형으로 굳어 빛만 더 세진다
export const FORM_AT = [0, 2, 4, 6, 8, 10, 12, 14, 17, 20, 24, 28, 33, 40, 50, 62];
export function formOf(level) {
  let f = 0;
  for (let i = 0; i < FORM_AT.length; i++) if (level >= FORM_AT[i]) f = i;
  return f;
}
export function buildBlade(level) {
  const lv = Math.max(0, Math.min(level, 100));
  const form = formOf(lv), last = form === FORM_AT.length - 1;
  const root = new THREE.Group();
  const { mat, tip } = BLADES[form](root);
  // 같은 모양 안에서도 단계가 오를수록 조금씩 커진다
  const into = lv - FORM_AT[form];
  const scale = 1 + Math.min(0.12, into * (last ? 0.005 : 0.025));
  root.scale.setScalar(scale);
  // 최종형은 +100에 가까울수록 더 강하게 빛난다
  if (last) {
    const k = into / (100 - FORM_AT[form]);
    mat.emissiveIntensity = mat.userData.baseEI = mat.userData.baseEI + k * 0.15;
    if (lv >= 100) { mat.emissive.setRGB(0.4, 0.75, 0.9); mat.userData.baseEmissive = mat.emissive.clone(); mat.emissiveIntensity = mat.userData.baseEI = 0.45; }
  }
  root.userData = { mat, length: tip * scale, tip: tip * scale };
  return root;
}

// 모루 위에 눕힌 검: holder(위치) → orient(방향) → blade
export function makeLyingBlade(level) {
  const holder = new THREE.Group();
  // 납작하게 눕히면 카메라에서 칼등만 보이므로, 칼면이 카메라 쪽을 향하게 비스듬히 세운다
  holder.rotation.x = -Math.PI / 2 + 0.4; // 0.8 근처는 천장 조명을 카메라로 정반사해 하얗게 날아간다
  holder.position.y = 0.035;
  const orient = new THREE.Group(); orient.rotation.z = -Math.PI / 2;
  holder.add(orient);
  holder.userData.orient = orient;
  setLyingBladeLevel(holder, level);
  return holder;
}
export function setLyingBladeLevel(holder, level) {
  const orient = holder.userData.orient;
  while (orient.children.length) {
    const c = orient.children.pop();
    c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  const b = buildBlade(level);
  orient.add(b);
  orient.position.x = -(b.userData.tip - 0.23) / 2;
  holder.userData.mat = b.userData.mat;
  holder.userData.level = level;
}

// ───────── 월드 ─────────
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(window.innerWidth, window.innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.4;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    if (!BLADE_ENV) { const pm = new THREE.PMREMGenerator(r); BLADE_ENV = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
    this.scene.background = new THREE.Color(0x060403);
    this.scene.fog = new THREE.FogExp2(0x120c08, 0.03);
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 60);

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.stations = {
      title: { pos: [2.4, 2.35, 3.9], look: [-0.2, 1.25, -2.2] },
      overview: { pos: [0, 2.75, 4.2], look: [0, 1.3, -1.8] },
      anvil: { pos: [0, 2.15, 2.3], look: [0, 1.45, -0.45] },
      furnace: { pos: [-1.25, 1.65, -0.35], look: [-2.9, 0.85, -2.4] },
      altar: { pos: [0.55, 2.0, -1.15], look: [0.8, 1.6, -5.2] },
      shop: { pos: [1.35, 1.85, -0.75], look: [3.5, 1.3, -2.9] },
    };
    const st = this.stations.title;
    this.camPos = new THREE.Vector3(...st.pos); this.camLook = new THREE.Vector3(...st.look);
    this.tgtPos = this.camPos.clone(); this.tgtLook = this.camLook.clone();
    this.camSpeed = 2.6;
    this.shakeAmt = 0;
    this.pickables = [];
    this.raycaster = new THREE.Raycaster();
    this.spiritMood = { color: new THREE.Color(1.2, 4, 5), target: new THREE.Color(1.2, 4, 5), flare: 0 };
    this.pageSpeed = 0.25;
    this.time = 0;
    this.darkness = 0; // 게임 오버 암전
    this.dotTex = softDot();

    this.build();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  // 세로 화면에서는 시야를 넓혀 주요 사물이 잘리지 않게 하고, 걸어 다닐 때는 더 넓게 본다
  fovTarget() {
    const portrait = window.innerWidth / window.innerHeight < 0.9;
    return this.walking ? (portrait ? 80 : 66) : (portrait ? 68 : 50);
  }

  goStation(name, speed = 2.6) {
    const s = this.stations[name]; if (!s) return;
    this.tgtPos.set(...s.pos); this.tgtLook.set(...s.look); this.camSpeed = speed;
  }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  tag(obj, name) { obj.traverse(o => { if (o.isMesh) { o.userData.pick = name; this.pickables.push(o); } }); }
  pick(x, y) {
    const v = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(v, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.pick : null;
  }
  toScreen(v3) {
    const p = v3.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * window.innerWidth, y: (1 - p.y) / 2 * window.innerHeight };
  }

  // ───────── 장면 구성 ─────────
  build() {
    const S = this.scene;
    const stoneWall = new THREE.MeshStandardMaterial({ map: brickTexture([3, 1.6]), roughness: 0.95, metalness: 0 });
    stoneWall.bumpMap = stoneWall.map; stoneWall.bumpScale = 3;
    const floorMat = new THREE.MeshStandardMaterial({ map: flagstoneTexture([3, 3]), roughness: 0.9 });
    floorMat.bumpMap = floorMat.map; floorMat.bumpScale = 2;
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture([1, 1]), roughness: 0.85 });
    const darkWood = new THREE.MeshStandardMaterial({ map: woodTexture([1, 1], [52, 34, 22]), roughness: 0.85 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.85, roughness: 0.4 });
    this.mats = { stoneWall, wood, darkWood, iron };

    // 바닥과 벽
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9.5), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.z = -0.25; floor.receiveShadow = true; S.add(floor);
    const H = 4.6;
    const wallL = new THREE.Mesh(new THREE.PlaneGeometry(9.5, H), stoneWall);
    wallL.position.set(-4.5, H / 2, -0.25); wallL.rotation.y = Math.PI / 2; wallL.receiveShadow = true; S.add(wallL);
    const wallR = wallL.clone(); wallR.position.x = 4.5; wallR.rotation.y = -Math.PI / 2; S.add(wallR);
    const backMat = stoneWall.clone(); backMat.map = brickTexture([1, 1.6]); backMat.bumpMap = backMat.map;
    for (const [w, h, x, y] of [[3, H, -3, H / 2], [3, H, 3, H / 2], [3, H - 3.3, 0, 3.3 + (H - 3.3) / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), backMat);
      m.position.set(x, y, -5); m.receiveShadow = true; S.add(m);
    }
    // 앞벽과 대장간 문 (자유 이동 중 뒤를 돌아봐도 막혀 있게)
    const wallF = new THREE.Mesh(new THREE.PlaneGeometry(9, H), stoneWall);
    wallF.position.set(0, H / 2, 4.5); wallF.rotation.y = Math.PI; wallF.receiveShadow = true; S.add(wallF);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.08), darkWood); door.position.set(0, 1.2, 4.45); S.add(door);
    for (const y of [0.45, 1.95]) { const band = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.07, 0.1), iron); band.position.set(0, y, 4.42); S.add(band); }
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.2, 0.2), darkWood); doorFrame.position.set(0, 2.5, 4.42); S.add(doorFrame);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), iron); ring.position.set(0.45, 1.15, 4.39); S.add(ring);
    // 문 옆 벽등
    for (const sx of [-1.25, 1.25]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), iron); bracket.position.set(sx, 2.1, 4.38); S.add(bracket);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.2, 0.45) }));
      lamp.position.set(sx, 2.12, 4.27); S.add(lamp);
    }
    const doorLight = new THREE.PointLight(0xffa860, 3.2, 6, 1.6); doorLight.position.set(0, 2.2, 3.95); S.add(doorLight);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(9, 9.5), new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -0.25); S.add(ceil);
    for (let z = -4.2; z <= 3.5; z += 1.9) { // 들보
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, 0.28, 0.3), darkWood); b.position.set(0, H - 0.14, z); S.add(b);
    }
    for (const x of [-4.3, 4.3]) for (const z of [-4.8, 2.5]) { // 기둥
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.32, H, 0.32), darkWood); p.position.set(x, H / 2, z); p.castShadow = true; S.add(p);
    }

    // 조명
    S.add(new THREE.HemisphereLight(0x5a6a88, 0x3a2614, 0.75));
    // 방 전체를 은은하게 채우는 따뜻한 빛 (그림자 없음)
    this.fills = [];
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.0], [2.2, 2.0]]) {
      const fill = new THREE.PointLight(0xffc48a, 2.6, 7.5, 1.3); fill.position.set(x, 3.7, z); S.add(fill); this.fills.push(fill);
    }
    const spot = new THREE.SpotLight(0xffe0b0, 38, 10, 0.6, 0.6, 1.3);
    spot.position.set(0.6, 4.3, 1.4); spot.target.position.set(0, 0.9, 0);
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0004;
    S.add(spot, spot.target);
    this.spot = spot;
    // 모루 위 매달린 등
    const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.8, 1.4), toneMapped: false }));
    lampGlow.position.set(0.6, 3.75, 1.4); S.add(lampGlow);
    const lampCage = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.3, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x1b1b1d, metalness: 0.8, roughness: 0.5, wireframe: true }));
    lampCage.position.copy(lampGlow.position); S.add(lampCage);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75), iron); chain.position.set(0.6, 4.25, 1.4); S.add(chain);

    this.buildAnvil();
    this.buildFurnace();
    this.buildCrate();
    this.buildAltar();
    this.buildSpirit();
    this.buildRack();
    this.buildShop();
    this.buildDecor();
    this.buildBoards();
    this.buildParticles();
    this.buildHammer();
  }

  buildAnvil() {
    const g = new THREE.Group(); const { wood, iron } = this.mats;
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.56, 18), wood); stump.position.y = 0.28;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.02, 6, 24), iron); ring.rotation.x = Math.PI / 2; ring.position.y = 0.45;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.36), iron); base.position.y = 0.62;
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.22), iron); waist.position.y = 0.76;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.13, 0.32), iron); top.position.y = 0.885;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.006, 0.3), new THREE.MeshStandardMaterial({ color: 0x55575c, metalness: 1, roughness: 0.22 })); face.position.y = 0.953;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 16), iron); horn.rotation.z = Math.PI / 2; horn.position.set(-0.66, 0.895, 0); horn.scale.set(1, 1, 0.75);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.2), iron); heel.position.set(0.52, 0.905, 0);
    for (const m of [stump, ring, base, waist, top, face, horn, heel]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    this.scene.add(g); this.anvil = g; this.tag(g, 'anvil');
    this.anvilTop = new THREE.Vector3(0, 0.972, 0);
  }

  buildFurnace() {
    const g = new THREE.Group(); g.position.set(-3.6, 0, -2.4); g.rotation.y = Math.PI / 2;
    const stone = this.mats.stoneWall.clone(); stone.map = brickTexture([1.2, 1], [70, 52, 40]); stone.bumpMap = stone.map;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.3), stone); body.position.y = 0.75; body.castShadow = body.receiveShadow = true;
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.0), stone); hood.position.set(0, 1.8, -0.1);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.6, 0.7), stone); chim.position.set(0, 3.3, -0.2);
    const fireMat = new THREE.MeshBasicMaterial({ map: fireTexture(), toneMapped: false, color: new THREE.Color(2.6, 2.6, 2.6) });
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.6), fireMat); mouth.position.set(0, 0.68, 0.652);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.07, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.9 }));
    arch.position.set(0, 0.95, 0.66);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.9 })); sill.position.set(0, 0.36, 0.75);
    g.add(body, hood, chim, mouth, arch, sill);
    // 불꽃 스프라이트
    this.flames = [];
    const flameTex = softDot('rgba(255,240,200,1)', 'rgba(255,140,40,.55)');
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color(3, 1.3, 0.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.position.set(rand(-0.3, 0.3), 0.55, 0.7); sp.userData.ph = Math.random() * 10; g.add(sp); this.flames.push(sp);
    }
    this.scene.add(g); this.furnace = g; this.tag(body, 'furnace');
    this.fireLight = new THREE.PointLight(0xff6a22, 9, 10, 1.5);
    this.fireLight.position.set(-2.55, 0.95, -2.4); this.scene.add(this.fireLight);
    this.heatSpot = new THREE.Vector3(-2.55, 0.74, -2.4);
    this.embersOrigin = new THREE.Vector3(-2.9, 0.75, -2.4);
  }

  buildCrate() {
    const g = new THREE.Group(); g.position.set(-1.95, 0, 0.95); g.rotation.y = 0.3;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.6), this.mats.wood); box.position.y = 0.225; box.castShadow = box.receiveShadow = true;
    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.02, 0.52), new THREE.MeshStandardMaterial({ color: 0x0d0907 })); inner.position.y = 0.4;
    for (const z of [-0.31, 0.31]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.03), this.mats.iron); s.position.set(0, 0.3, z); g.add(s); }
    g.add(box, inner);
    this.ores = [];
    const oreMat = new THREE.MeshStandardMaterial({ color: 0x5b3a2a, roughness: 0.7, metalness: 0.5, emissive: 0x1a0600 });
    for (let i = 0; i < 8; i++) {
      const o = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.07, 0.1)), oreMat);
      o.position.set(-0.25 + (i % 4) * 0.17, 0.46 + Math.floor(i / 4) * 0.06, -0.1 + Math.floor(i / 4) * 0.18 + rand(-0.03, 0.03));
      o.rotation.set(rand(0, 3), rand(0, 3), 0); o.castShadow = true; g.add(o); this.ores.push(o);
    }
    this.scene.add(g); this.crate = g; this.tag(g, 'crate');
    this.cratePos = new THREE.Vector3(-1.95, 0.55, 0.95);
  }
  setOreCount(n) { this.ores.forEach((o, i) => { o.visible = i < n; }); }

  buildAltar() {
    const g = new THREE.Group(); g.position.set(0, 0, -4.3);
    const stone = this.mats.stoneWall.clone(); stone.map = brickTexture([1.4, 0.6], [62, 58, 60]); stone.bumpMap = stone.map;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.95, 0.9), stone); base.position.y = 0.475;
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.1, 1.05), new THREE.MeshStandardMaterial({ color: 0x3d3a3c, roughness: 0.7 })); top.position.y = 1.0;
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.012, 1.07), new THREE.MeshStandardMaterial({ color: 0x3a1418, roughness: 0.95 })); cloth.position.y = 1.056;
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a1418, roughness: 0.95, side: THREE.DoubleSide })); drape.position.set(0, 0.76, 0.536);
    for (const m of [base, top, cloth]) { m.castShadow = m.receiveShadow = true; }
    g.add(base, top, cloth, drape);
    // 문양
    const rune = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.2, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 1.8), toneMapped: false, transparent: true, opacity: 0.6 }));
    rune.rotation.x = -Math.PI / 2; rune.position.set(0, 1.064, 0.08); g.add(rune); this.altarRune = rune;
    this.scene.add(g); this.tag(g, 'altar');
    this.offerSpot = new THREE.Vector3(0, 1.075, -4.22);

    // 촛불 3개 = 서고지기의 인내심
    this.candles = [];
    const flameTex = softDot('rgba(255,250,220,1)', 'rgba(255,170,60,.5)');
    const wax = new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.6, emissive: 0x2a1a08, emissiveIntensity: 0.3 });
    [[-1.08, -4.18, 0.32], [1.08, -4.18, 0.3], [0, -4.68, 0.4]].forEach(([x, z, h]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, h, 14), wax); c.position.set(x, 1.05 + h / 2, z); c.castShadow = true;
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.025, 16), this.mats.iron); dish.position.set(x, 1.065, z);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: new THREE.Color(3, 1.8, 0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      flame.position.set(x, 1.05 + h + 0.07, z); flame.scale.set(0.09, 0.17, 1);
      const light = new THREE.PointLight(0xffa04a, 1.1, 3.2, 1.6); light.position.copy(flame.position);
      this.scene.add(c, dish, flame, light);
      this.candles.push({ flame, light, lit: true, k: 1, ph: Math.random() * 10 });
    });

    // 철창과 그 너머 벽감
    const alcove = new THREE.Mesh(new THREE.BoxGeometry(3, 3.3, 4.2), new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 1, side: THREE.BackSide }));
    alcove.position.set(0, 1.65, -7.1); this.scene.add(alcove);
    const bars = new THREE.Group(); const { iron } = this.mats;
    for (let x = -1.4; x <= 1.401; x += 0.35) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.3, 8), iron); b.position.set(x, 1.65, -5.02); b.castShadow = true; bars.add(b);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), iron); tip.position.set(x, 0.06, -5.02); tip.rotation.x = Math.PI; bars.add(tip);
    }
    for (const y of [0.9, 2.2, 3.25]) { const h = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 0.06), iron); h.position.set(0, y, -5.02); bars.add(h); }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.22, 0.3), this.mats.darkWood); frame.position.set(0, 3.38, -4.95); bars.add(frame);
    this.scene.add(bars);
  }

  buildSpirit() {
    const g = new THREE.Group(); g.position.set(0, 0, -7.0);
    const pts = [[1.35, 0], [1.2, 0.6], [1.0, 1.4], [0.86, 2.1], [0.74, 2.6], [0.62, 2.95], [0.44, 3.2], [0.2, 3.36], [0.0, 3.4]].map(([x, y]) => new THREE.Vector2(x, y));
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x161a26, roughness: 0.95, emissive: 0x05080f });
    const cloak = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), cloakMat);
    const hoodOpen = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    hoodOpen.scale.set(1, 1.25, 0.6); hoodOpen.position.set(0, 2.72, 0.52);
    g.add(cloak, hoodOpen);
    // 어깨 위 사슬과 열쇠
    const eyeMat = new THREE.MeshBasicMaterial({ color: this.spiritMood.color, toneMapped: false });
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), eyeMat);
      e.position.set(sx * 0.15, 2.8, 0.75); e.scale.set(1.3, 0.75, 0.5); g.add(e); this.eyes.push(e);
    }
    this.eyeMat = eyeMat;
    // 펼쳐진 거대한 책
    const pageTex = canvasTexture(256, 320, (c, w, h) => {
      c.fillStyle = '#d9cfb4'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(60,40,20,.55)';
      for (let y = 30; y < h - 20; y += 16) c.fillRect(20, y, rand(w * .45, w - 40), 4);
      c.strokeStyle = 'rgba(80,50,20,.6)'; c.lineWidth = 3; c.strokeRect(8, 8, w - 16, h - 16);
    });
    const pageMat = new THREE.MeshStandardMaterial({ map: pageTex, emissive: 0x6ad8ff, emissiveIntensity: 0.25, side: THREE.DoubleSide, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), pageMat);
      p.position.set(sx * 0.27, 1.65, 1.05); p.rotation.set(-0.9, sx * -0.25, 0); g.add(p);
    }
    // 떠다니는 책장
    this.pages = [];
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.21), pageMat);
      p.userData = { r: rand(1.0, 1.8), a: Math.random() * Math.PI * 2, y: rand(0.6, 3.2), sp: rand(0.6, 1.3), bob: Math.random() * 6 };
      g.add(p); this.pages.push(p);
    }
    this.scene.add(g); this.spirit = g;
    this.spiritLight = new THREE.PointLight(0x5fd6ff, 4, 7, 1.4); this.spiritLight.position.set(0, 2.6, -5.7); this.scene.add(this.spiritLight);
    const rim = new THREE.PointLight(0x3a6cff, 2, 5, 2); rim.position.set(0, 3.6, -8.6); this.scene.add(rim);
  }
  setSpiritMood(kind) {
    const c = { calm: [1.2, 4, 5], happy: [2.5, 5.5, 5], angry: [6, 0.8, 0.4], doom: [6, 0.3, 0.2], sleep: [0.08, 0.25, 0.3] }[kind];
    this.spiritMood.target.setRGB(...c);
    this.spiritMood.flare = kind === 'calm' ? 0 : 1;
    this.pageSpeed = kind === 'happy' ? 1.4 : kind === 'angry' || kind === 'doom' ? 2.2 : 0.25;
  }
  setCandle(i, lit) { const c = this.candles[i]; if (c) c.lit = lit; }

  buildRack() {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 3.7), this.mats.darkWood); plank.position.set(4.4, 2.78, 0.1); plank.castShadow = true;
    this.scene.add(plank);
    this.rackSlots = [];
    for (let i = 0; i < 8; i++) {
      const z = -1.5 + i * 0.44;
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16), this.mats.iron); peg.rotation.z = Math.PI / 2; peg.position.set(4.3, 2.72, z);
      this.scene.add(peg); this.rackSlots.push(new THREE.Vector3(4.33, 2.5, z));
    }
    this.rackBlades = [];
    // 걸이 아래 작은 표지판
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshStandardMaterial({
      map: canvasTexture(512, 128, (c, w, h) => { c.fillStyle = '#2b1d12'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8c87a'; c.font = 'bold 60px "Gowun Batang", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('완성한 검', w / 2, h / 2 + 4); }), roughness: 0.8 }));
    sign.position.set(4.47, 3.08, 0.1); sign.rotation.y = -Math.PI / 2; this.scene.add(sign);
  }
  setRack(blades) {
    for (const b of this.rackBlades) this.scene.remove(b);
    this.rackBlades = [];
    blades.slice(0, 8).forEach((bl, i) => {
      const holder = new THREE.Group(); holder.rotation.y = -Math.PI / 2;
      const b = buildBlade(bl.level); b.rotation.z = Math.PI; holder.add(b);
      holder.position.copy(this.rackSlots[i]); holder.position.y = 2.68 + 0.205;
      this.scene.add(holder); this.rackBlades.push(holder);
    });
  }

  buildShop() {
    const g = new THREE.Group(); g.position.set(3.75, 0, -3.55); g.rotation.y = -0.8;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.3, 0.55), this.mats.darkWood); body.position.y = 1.15; body.castShadow = true;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.1), new THREE.MeshStandardMaterial({ color: 0x120c08 })); back.position.set(0, 1.15, 0.28);
    g.add(body, back);
    const jarColors = [[0.6, 2.4, 3.2], [3.2, 1.0, 2.6], [3.2, 2.2, 0.5], [0.7, 3.0, 1.2]];
    for (let s = 0; s < 3; s++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.5), this.mats.wood); sh.position.set(0, 0.55 + s * 0.6, 0.32); g.add(sh);
      for (let j = 0; j < 4; j++) {
        const col = jarColors[(s + j) % 4];
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, rand(0.18, 0.28), 12),
          new THREE.MeshStandardMaterial({ color: new THREE.Color(...col).multiplyScalar(0.12), emissive: new THREE.Color(...col).multiplyScalar(0.12), roughness: 0.15, metalness: 0.2 }));
        jar.position.set(-0.42 + j * 0.28, 0.68 + s * 0.6, 0.35); g.add(jar);
      }
    }
    this.scene.add(g); this.tag(g, 'shop');
    // 떠돌이 사서 등불 (상인)
    const m = new THREE.Group(); m.position.set(2.65, 1.75, -2.55);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.15, 0.45), toneMapped: false }));
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.36, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.9, roughness: 0.35, wireframe: true }));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.14, 6), new THREE.MeshStandardMaterial({ color: 0x6a4e2a, metalness: 0.9, roughness: 0.4 })); cap.position.y = 0.25;
    const ringT = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), cap.material); ringT.position.y = 0.36;
    m.add(glow, cage, cap, ringT);
    this.wings = [];
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0xffc070, emissiveIntensity: 0.25, side: THREE.DoubleSide, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(sx * 0.14, 0.05, 0);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), wingMat); w.position.x = sx * 0.15; piv.add(w); piv.userData.sx = sx;
      m.add(piv); this.wings.push(piv);
    }
    const ml = new THREE.PointLight(0xffb060, 1.2, 3.5, 1.6); m.add(ml);
    // 상인에게 작은 눈 두 개
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: 0x1a0d04 })); e.position.set(sx * 0.03, 0.02, 0.075); m.add(e); }
    this.scene.add(m); this.merchant = m; this.merchantBaseY = 1.75;
  }

  buildDecor() {
    // 왼쪽 안쪽 책장
    const g = new THREE.Group(); g.position.set(-3.45, 0, -4.72);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.7, 0.45), this.mats.darkWood); body.position.y = 1.35; g.add(body);
    const bookColors = [0x6a2a22, 0x2a4a3a, 0x3a3060, 0x7a5a2a, 0x203048, 0x5a2a4a, 0x8a6a40];
    for (let s = 0; s < 4; s++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.04, 0.4), this.mats.wood); sh.position.set(0, 0.35 + s * 0.6, 0.05); g.add(sh);
      let x = -0.66;
      while (x < 0.62) {
        const bw = rand(0.04, 0.08), bh = rand(0.3, 0.48);
        const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.28), new THREE.MeshStandardMaterial({ color: bookColors[(Math.random() * bookColors.length) | 0], roughness: 0.85 }));
        b.position.set(x + bw / 2, 0.37 + s * 0.6 + bh / 2, 0.08); if (Math.random() < 0.1) b.rotation.z = 0.25; g.add(b); x += bw + 0.008;
      }
    }
    this.scene.add(g);
    // 물통(담금질)과 공구 걸이
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.5, 20), this.mats.wood); tub.position.set(-2.2, 0.25, -0.5); tub.castShadow = true;
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.31, 20), new THREE.MeshStandardMaterial({ color: 0x0d1c22, metalness: 0.3, roughness: 0.05 }));
    water.rotation.x = -Math.PI / 2; water.position.set(-2.2, 0.47, -0.5);
    this.scene.add(tub, water);
    // 바닥에 흩어진 책과 두루마리
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.2), new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: 0.85 }));
      b.position.set(rand(1.4, 2.6), 0.03 + (i % 2) * 0.06, rand(-1.6, -0.8)); b.rotation.y = rand(0, 3); b.castShadow = true; this.scene.add(b);
    }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 18), this.mats.wood); barrel.position.set(2.6, 0.4, 1.2); barrel.castShadow = true; this.scene.add(barrel);
    for (const y of [0.15, 0.65]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.015, 6, 24), this.mats.iron); hoop.rotation.x = Math.PI / 2; hoop.position.set(2.6, y, 1.2); this.scene.add(hoop); }
  }

  buildBoards() {
    // 모루 위 강화 전광판
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    this.boardCtx = c.getContext('2d');
    this.boardTex = new THREE.CanvasTexture(c); this.boardTex.colorSpace = THREE.SRGBColorSpace; this.boardTex.anisotropy = 8;
    const g = new THREE.Group(); g.position.set(0, 2.15, -0.95);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.98, 0.06), this.mats.darkWood);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.86), new THREE.MeshBasicMaterial({ map: this.boardTex, toneMapped: false, color: new THREE.Color(1.05, 1.05, 1.05) }));
    screen.position.z = 0.032;
    g.add(frame, screen);
    for (const sx of [-0.8, 0.8]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.0), this.mats.iron); ch.position.set(sx, 1.48, 0); g.add(ch); }
    this.scene.add(g);
    // 왼쪽 벽 달력
    const cc = document.createElement('canvas'); cc.width = 768; cc.height = 512;
    this.calCtx = cc.getContext('2d');
    this.calTex = new THREE.CanvasTexture(cc); this.calTex.colorSpace = THREE.SRGBColorSpace;
    const cal = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.9), new THREE.MeshStandardMaterial({ map: this.calTex, roughness: 0.9, emissive: 0xffffff, emissiveMap: this.calTex, emissiveIntensity: 0.12 }));
    cal.position.set(-4.47, 2.45, 0.55); cal.rotation.y = Math.PI / 2; this.scene.add(cal);
    const calFrame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.98, 1.43), this.mats.darkWood); calFrame.position.set(-4.49, 2.45, 0.55); this.scene.add(calFrame);
  }

  buildParticles() {
    // 불꽃(스파크)
    const N = 800;
    this.sparkN = N;
    const geo = new THREE.BufferGeometry();
    this.sp = { pos: new Float32Array(N * 3), col: new Float32Array(N * 3), base: new Float32Array(N * 3), vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), next: 0 };
    for (let i = 0; i < N; i++) this.sp.pos[i * 3 + 1] = -50;
    geo.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.sp.col, 3));
    this.sparks = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.045, map: this.dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparks.frustumCulled = false; this.scene.add(this.sparks);

    // 화로의 불티
    const E = 110; const eg = new THREE.BufferGeometry();
    this.em = { pos: new Float32Array(E * 3), vel: new Float32Array(E * 3), life: new Float32Array(E) };
    for (let i = 0; i < E; i++) this.resetEmber(i, true);
    eg.setAttribute('position', new THREE.BufferAttribute(this.em.pos, 3));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({ size: 0.03, map: this.dotTex, color: new THREE.Color(3, 1.2, 0.3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.embers.frustumCulled = false; this.scene.add(this.embers);

    // 떠도는 먼지
    const D = 300; const dg = new THREE.BufferGeometry(); const dp = new Float32Array(D * 3);
    for (let i = 0; i < D; i++) { dp[i * 3] = rand(-4.3, 4.3); dp[i * 3 + 1] = rand(0.2, 4.2); dp[i * 3 + 2] = rand(-4.8, 3.8); }
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.018, map: this.dotTex, color: 0xffd9a8, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.dust);

    this.shards = []; this.smokes = [];
    this.smokeTex = softDot('rgba(200,200,200,.6)', 'rgba(160,160,160,.25)');
    // 돌파 연출용: 조명 수가 바뀌면 셰이더가 다시 컴파일돼 끊기므로 빛은 미리 하나 둔다
    this.fx = []; this.dim = 0;
    this.fxLight = new THREE.PointLight(0xffffff, 0, 10, 1.2); this.scene.add(this.fxLight);
    this.fxLightPeak = 0; this.fxLightLife = 0; this.fxLightMax = 1;
    // 빛기둥: 가운데가 밝고 양옆·위로 갈수록 사라지는 결
    this.pillarTex = canvasTexture(64, 256, (g, w, h) => {
      const img = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = Math.abs(x / (w - 1) * 2 - 1), v = y / (h - 1);
        const across = Math.pow(Math.max(0, 1 - u), 2.2), core = Math.pow(Math.max(0, 1 - u * 3), 3);
        const a = Math.min(1, (across * 0.75 + core) * Math.pow(v, 1.4));
        const i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
    });
  }

  // ───────── 돌파 연출 (5단계마다) ─────────
  addFx(obj, life, tick) { if (obj) this.scene.add(obj); this.fx.push({ obj, life, max: life, tick }); }
  flashLight(pos, color, peak, life = 0.5) {
    this.fxLight.position.copy(pos); this.fxLight.color.set(color);
    this.fxLightPeak = peak; this.fxLightLife = this.fxLightMax = life;
  }
  shockRing(pos, color, radius = 1.6, life = 0.7, thick = 0.08) {
    const m = new THREE.Mesh(new THREE.RingGeometry(1 - thick, 1, 72), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(pos);
    this.addFx(m, life, k => { const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(0.05 + e * radius); m.material.opacity = 1 - k; });
  }
  lightPillar(pos, color, life = 1.2, r = 0.3) {
    // 카메라 쪽으로 늘 돌아서는 세로 판 (원통보다 부드럽게 보인다)
    const g = new THREE.PlaneGeometry(r * 2 * 2.2, 5); g.translate(0, 2.5, 0);
    const c = new THREE.Color(color).multiplyScalar(2.2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, map: this.pillarTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.copy(pos);
    this.addFx(m, life, k => {
      const grow = Math.min(1, k / 0.12), w = 0.15 + grow * (1.05 - k * 0.75);
      m.scale.set(w, 0.3 + grow * 0.7, 1);
      m.rotation.y = Math.atan2(this.camera.position.x - pos.x, this.camera.position.z - pos.z);
      m.material.opacity = k < 0.12 ? grow : (1 - k) / 0.88;
    });
  }
  // 천장에서 target까지 내리꽂는 번개. 몇 번 모양을 바꾸며 깜빡인다.
  lightning(target, { flicks = 3, life = 0.65, branches = 2 } = {}) {
    const group = new THREE.Group();
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.6, 6), transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5.5, 7), transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending });
    const seg = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), up = new THREE.Vector3(0, 1, 0);
    const addSeg = (a, b, r, mat) => {
      const d = b.clone().sub(a), len = d.length();
      const s = new THREE.Mesh(seg, mat); s.position.copy(a).addScaledVector(d, 0.5);
      s.scale.set(r, len, r); s.quaternion.setFromUnitVectors(up, d.normalize()); group.add(s);
    };
    const bolt = (a, b, n, jit, r) => {
      const pts = [a.clone()]; let prev = a.clone();
      for (let i = 1; i <= n; i++) {
        const t = i / n, p = a.clone().lerp(b, t);
        if (i < n) { const j = jit * Math.sin(t * Math.PI); p.x += rand(-j, j); p.z += rand(-j, j); p.y += rand(-j, j) * 0.3; }
        addSeg(prev, p, r * 3.5, glow); addSeg(prev, p, r, core); pts.push(p); prev = p;
      }
      return pts;
    };
    const regen = () => {
      group.clear();
      const top = target.clone().add(new THREE.Vector3(rand(-0.7, 0.7), 0, rand(-0.7, 0.3))); top.y = 4.55;
      const pts = bolt(top, target, 18, 0.38, 0.009);
      for (let b = 0; b < branches; b++) {
        const s = pts[3 + (Math.random() * 10 | 0)];
        bolt(s, s.clone().add(new THREE.Vector3(rand(-1, 1), -rand(0.5, 1.2), rand(-0.7, 0.7))), 7, 0.2, 0.005);
      }
    };
    let next = 0, n = 0;
    this.addFx(group, life, k => {
      const t = k * life;
      if (t >= next && n < flicks) { regen(); n++; next = t + rand(0.07, 0.15); }
      const o = Math.max(0, 1 - k * 0.85) * (Math.random() < 0.8 ? 1 : 0.25);
      glow.opacity = core.opacity = o;
    });
  }
  resetEmber(i, init) {
    const o = this.embersOrigin, e = this.em;
    e.pos[i * 3] = o.x + rand(-0.1, 0.25); e.pos[i * 3 + 1] = o.y + rand(0, init ? 2.5 : 0.1); e.pos[i * 3 + 2] = o.z + rand(-0.35, 0.35);
    e.vel[i * 3] = rand(0.05, 0.3); e.vel[i * 3 + 1] = rand(0.4, 1.1); e.vel[i * 3 + 2] = rand(-0.15, 0.15);
    e.life[i] = rand(1.2, 3.2);
  }
  spawnSparks(p, n, color, { speed = 3, up = 2.2, spread = 1, life = 0.7, mul = 3 } = {}) {
    const c = new THREE.Color(color), s = this.sp;
    for (let k = 0; k < n; k++) {
      const i = s.next; s.next = (s.next + 1) % this.sparkN;
      s.pos[i * 3] = p.x; s.pos[i * 3 + 1] = p.y; s.pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2, sp = speed * rand(0.3, 1);
      s.vel[i * 3] = Math.cos(a) * sp * spread; s.vel[i * 3 + 1] = rand(0.3, 1) * up * (speed / 3) + 0.5; s.vel[i * 3 + 2] = Math.sin(a) * sp * spread;
      const m = mul * rand(0.6, 1.2);
      s.base[i * 3] = c.r * m; s.base[i * 3 + 1] = c.g * m; s.base[i * 3 + 2] = c.b * m;
      s.max[i] = s.life[i] = life * rand(0.5, 1.2);
    }
  }
  spawnShards(holder, color) {
    const pos = new THREE.Vector3(); holder.getWorldPosition(pos);
    const mat = holder.userData.mat.clone();
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.TetrahedronGeometry(rand(0.025, 0.06)), mat);
      m.position.set(pos.x + rand(-0.35, 0.35), pos.y + 0.02, pos.z + rand(-0.04, 0.04));
      m.castShadow = true;
      m.userData = { v: new THREE.Vector3(rand(-2.2, 2.2), rand(1.6, 3.6), rand(-1.2, 1.8)), w: new THREE.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), life: rand(2, 2.8) };
      this.scene.add(m); this.shards.push(m);
    }
    this.spawnSparks(pos, 120, color, { speed: 4.5, up: 2.6, life: 0.9, mul: 4 });
  }
  spawnSmoke(p, n = 6) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, color: 0x9a9088, transparent: true, depthWrite: false, opacity: 0.5 }));
      s.position.copy(p).add(new THREE.Vector3(rand(-0.03, 0.03), rand(0, 0.05), rand(-0.03, 0.03)));
      s.scale.setScalar(0.08); s.userData = { life: rand(1.2, 2.2), v: rand(0.25, 0.5) };
      this.scene.add(s); this.smokes.push(s);
    }
  }

  buildHammer() {
    const pivot = new THREE.Group(); pivot.position.set(0.8, 1.1, 0.04);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.72, 10), new THREE.MeshStandardMaterial({ map: woodTexture([1, 1], [110, 72, 40]), roughness: 0.8 }));
    handle.rotation.z = Math.PI / 2; handle.position.x = -0.34;
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 1 }));
    wrap.rotation.z = Math.PI / 2; wrap.position.x = -0.06;
    const headMat = new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.9, roughness: 0.35 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.12), headMat); head.position.set(-0.7, 0, 0);
    const faceB = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 16), headMat); faceB.position.set(-0.7, -0.125, 0);
    const faceT = faceB.clone(); faceT.position.y = 0.125;
    for (const m of [handle, wrap, head, faceB, faceT]) { m.castShadow = true; pivot.add(m); }
    pivot.rotation.z = -0.55;
    this.scene.add(pivot); this.hammer = pivot; this.hammerHeadMat = headMat;
    this.impactPoint = new THREE.Vector3(0.1, 0.98, 0.04);
  }

  // ───────── 매 프레임 ─────────
  update(dt, gdt) {
    this.time += dt; const t = this.time;
    // 카메라
    const k = 1 - Math.exp(-dt * this.camSpeed);
    this.camPos.lerp(this.tgtPos, k); this.camLook.lerp(this.tgtLook, k);
    const fov = this.fovTarget();
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov = lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 5)); this.camera.updateProjectionMatrix(); }
    this.shakeAmt *= Math.exp(-dt * 11);
    const sh = this.shakeAmt;
    const sway = 0.012;
    this.camera.position.set(
      this.camPos.x + Math.sin(t * 0.5) * sway + (Math.random() - 0.5) * sh,
      this.camPos.y + Math.sin(t * 0.7) * sway * 0.6 + (Math.random() - 0.5) * sh,
      this.camPos.z + (Math.random() - 0.5) * sh * 0.5);
    this.camera.lookAt(this.camLook.x + (Math.random() - 0.5) * sh * 0.6, this.camLook.y + (Math.random() - 0.5) * sh * 0.6, this.camLook.z);

    // 화로
    const flick = Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.8 + Math.sin(t * 23.1) * 0.4;
    this.fireLight.intensity = (9 + flick * 1.4) * (1 - this.darkness);
    this.flames.forEach((f, i) => {
      const ph = t * 3 + f.userData.ph;
      f.position.y = 0.55 + ((ph % 1)) * 0.28; f.scale.set(0.32 * (1 - (ph % 1) * 0.6), 0.42 * (1 - (ph % 1) * 0.4), 1);
      f.material.opacity = 0.9 * (1 - (ph % 1)) * (1 - this.darkness);
      f.position.x = Math.sin(ph * 2 + i) * 0.22;
    });
    // 촛불
    for (const c of this.candles) {
      c.k = lerp(c.k, c.lit ? 1 : 0, 1 - Math.exp(-dt * 6));
      const fl = 1 + Math.sin(t * 11 + c.ph) * 0.08 + Math.sin(t * 17 + c.ph) * 0.05;
      c.flame.scale.set(0.09 * c.k * fl, 0.17 * c.k * (2 - fl), 1);
      c.light.intensity = 1.1 * c.k * fl;
      c.flame.visible = c.k > 0.02;
    }
    // 서고지기
    const mood = this.spiritMood;
    mood.color.lerp(mood.target, 1 - Math.exp(-dt * 3));
    mood.flare *= Math.exp(-dt * 0.8);
    const blink = (t % 5.3) < 0.13 ? 0.1 : 1;
    this.eyes.forEach(e => { e.scale.y = 0.75 * blink * (1 + mood.flare * 0.4); });
    this.eyeMat.color.copy(mood.color).multiplyScalar(1 + mood.flare);
    this.spiritLight.color.setRGB(mood.color.r / 6, mood.color.g / 6, mood.color.b / 6);
    this.spiritLight.intensity = (4 + mood.flare * 6 + Math.sin(t * 1.3) * 0.6) * (1 - this.darkness * 0.3);
    this.spirit.position.y = Math.sin(t * 0.8) * 0.05;
    for (const p of this.pages) {
      const u = p.userData; u.a += dt * u.sp * this.pageSpeed;
      p.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 1.2 + u.bob) * 0.12, 0.3 + Math.sin(u.a) * u.r * 0.6);
      p.rotation.set(Math.sin(t + u.bob) * 0.6, u.a + Math.PI / 2, Math.cos(t * 0.7 + u.bob) * 0.4);
    }
    this.altarRune.material.opacity = 0.45 + Math.sin(t * 2) * 0.2;
    // 상인 등불
    this.merchant.position.y = this.merchantBaseY + Math.sin(t * 1.6) * 0.06;
    this.merchant.rotation.y = Math.sin(t * 0.5) * 0.4;
    this.wings.forEach(w => { w.rotation.y = w.userData.sx * (0.3 + Math.sin(t * 9) * 0.5); });
    // 암전
    this.scene.fog.density = 0.03 + this.darkness * 0.25;
    // 번개 직전 잠깐 어두워졌다가 돌아온다
    this.dim = Math.max(0, this.dim - dt * 2.2);
    const lit = (1 - this.darkness) * (1 - this.dim * 0.75);
    this.spot.intensity = 38 * lit;
    for (const f of this.fills) f.intensity = 2.6 * lit;
    this.fireLight.intensity *= 1 - this.dim * 0.6;
    // 돌파 연출
    if (this.fxLightLife > 0) {
      this.fxLightLife -= dt;
      const k = Math.max(0, this.fxLightLife / this.fxLightMax);
      this.fxLight.intensity = this.fxLightPeak * k * k * (0.85 + Math.random() * 0.3);
    } else this.fxLight.intensity = 0;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.life -= dt;
      if (f.tick) f.tick(Math.min(1, 1 - f.life / f.max));
      if (f.life <= 0) {
        if (f.obj) { this.scene.remove(f.obj); f.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
        this.fx.splice(i, 1);
      }
    }

    // 스파크 (히트 스톱 동안 멈춘다)
    const s = this.sp;
    for (let i = 0; i < this.sparkN; i++) {
      if (s.life[i] <= 0) continue;
      s.life[i] -= gdt;
      if (s.life[i] <= 0) { s.pos[i * 3 + 1] = -50; continue; }
      s.vel[i * 3 + 1] -= 9.8 * gdt;
      s.pos[i * 3] += s.vel[i * 3] * gdt; s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * gdt; s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * gdt;
      if (s.pos[i * 3 + 1] < 0.01) { s.pos[i * 3 + 1] = 0.01; s.vel[i * 3 + 1] *= -0.35; s.vel[i * 3] *= 0.6; s.vel[i * 3 + 2] *= 0.6; }
      const f = s.life[i] / s.max[i];
      s.col[i * 3] = s.base[i * 3] * f; s.col[i * 3 + 1] = s.base[i * 3 + 1] * f * f; s.col[i * 3 + 2] = s.base[i * 3 + 2] * f * f;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    this.sparks.geometry.attributes.color.needsUpdate = true;
    // 불티
    const e = this.em;
    for (let i = 0; i < e.life.length; i++) {
      e.life[i] -= dt;
      if (e.life[i] <= 0 || e.pos[i * 3 + 1] > 3.6) { this.resetEmber(i); continue; }
      e.pos[i * 3] += (e.vel[i * 3] + Math.sin(t * 2 + i) * 0.15) * dt; e.pos[i * 3 + 1] += e.vel[i * 3 + 1] * dt; e.pos[i * 3 + 2] += e.vel[i * 3 + 2] * dt;
    }
    this.embers.geometry.attributes.position.needsUpdate = true;
    this.dust.rotation.y += dt * 0.004;
    // 파편
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const m = this.shards[i], u = m.userData;
      u.life -= gdt;
      u.v.y -= 9.8 * gdt;
      m.position.addScaledVector(u.v, gdt);
      m.rotation.x += u.w.x * gdt; m.rotation.y += u.w.y * gdt; m.rotation.z += u.w.z * gdt;
      const onAnvil = Math.abs(m.position.x) < 0.46 && Math.abs(m.position.z) < 0.16;
      const floorY = onAnvil ? 0.975 : 0.02;
      if (m.position.y < floorY && u.v.y < 0) { m.position.y = floorY; u.v.y *= -0.38; u.v.x *= 0.6; u.v.z *= 0.6; u.w.multiplyScalar(0.5); }
      if (u.life < 0.6) m.scale.setScalar(Math.max(0.001, u.life / 0.6));
      if (u.life <= 0) { this.scene.remove(m); m.geometry.dispose(); this.shards.splice(i, 1); }
    }
    // 연기
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i], u = sm.userData;
      u.life -= dt; sm.position.y += u.v * dt; sm.scale.setScalar(sm.scale.x + dt * 0.25);
      sm.material.opacity = Math.max(0, u.life / 2) * 0.5;
      if (u.life <= 0) { this.scene.remove(sm); this.smokes.splice(i, 1); }
    }

    this.composer.render();
  }
}
