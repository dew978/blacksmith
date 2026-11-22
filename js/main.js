import * as THREE from 'three';
import { World, makeLyingBlade, setLyingBladeLevel } from './scene.js';
import { Sfx } from './audio.js';
import { SAMPLE_QUESTIONS } from './questions.js';

// ───────── 규칙 데이터 ─────────
const MAX_DAY = 7;
const REQ = [500, 1100, 2000, 3200, 4800, 6800, 9200];
const VAL = [100, 180, 300, 480, 750, 1150, 1700, 2500, 3600, 5100, 7200, 10000, 14000, 19000, 26000, 35000];
const NAMES = ['녹슨 깃펜칼', '갈아 낸 연필검', '다듬은 잉크검', '공책 철검', '쓸 만한 문법검', '단단한 공식검', '빛나는 개념검', '원리의 장검',
  '통찰의 검', '학자의 대검', '현자의 빛검', '진리의 쌍날검', '만물박사의 검', '별을 읽는 검', '지혜의 성검', '전설의 지식검'];
const BASE_BLANKS = 3;
const FEVER_MS = 6000;
const ITEMS = {
  anvil: { name: '단단한 모루', kind: 'relic', price: 2200, icon: '모', desc: '오답일 때 파괴 확률이 35% 줄어든다.' },
  glove: { name: '대장장이의 장갑', kind: 'relic', price: 1800, icon: '장', desc: '정답일 때 대성공 확률 +8%p.' },
  incense: { name: '집중의 향로', kind: 'relic', price: 1600, icon: '향', desc: '정답마다 영감 게이지가 2칸씩 찬다.' },
  whetstone: { name: '오래된 숫돌', kind: 'relic', price: 2600, icon: '숫', desc: '모든 검의 가치 +20%.' },
  glasses: { name: '지혜의 안경', kind: 'relic', price: 1400, icon: '안', desc: '문제마다 오답 보기 하나가 흐려진다.' },
  scrap: { name: '고철 수집함', kind: 'relic', price: 1500, icon: '고', desc: '검이 파괴되면 최고 가치의 30%를 고철로 모아 제단에 바칠 수 있다.' },
  pouch: { name: '원석 주머니', kind: 'relic', price: 2000, icon: '원', desc: '매일 아침 원석을 1개 더 받는다.' },
  charm: { name: '수호 부적', kind: 'item', price: 700, icon: '부', desc: '다음 파괴 1회를 유지로 바꾼다.' },
  hint: { name: '힌트 두루마리', kind: 'item', price: 400, icon: '두', desc: '문제 하나에서 오답 보기 2개를 지운다.' },
  ore: { name: '원석 한 덩이', kind: 'item', price: 450, icon: '석', desc: '다음 날 아침 원석 +1.' },
  candle: { name: '새 양초', kind: 'item', price: 2400, icon: '초', desc: '꺼진 촛불 하나를 다시 켠다.' },
};
const OUT = {
  great: { label: '대성공', color: '#a86bff', hex: 0xc48bff },
  succ: { label: '성공', color: '#4f9cff', hex: 0xffc46b },
  keep: { label: '유지', color: '#49c27a', hex: 0xffb070 },
  dmg: { label: '손상', color: '#ff9a2e', hex: 0xff6a3d },
  brk: { label: '파괴', color: '#ff3b30', hex: 0xff3b2f },
};
// 타격감 수치 (ms, 화면 흔들림은 월드 단위). 약 → 강 → 파괴 순서로 커진다.
const FX = {
  keep: { stop: 40, shake: 0.018, sparks: 14, size: 'mid' },
  succ: { stop: 60, shake: 0.03, sparks: 45, size: 'big' },
  dmg: { stop: 75, shake: 0.045, sparks: 30, size: 'big' },
  great: { stop: 115, shake: 0.065, sparks: 100, size: 'big' },
  brk: { stop: 220, shake: 0.11, sparks: 0, size: 'big' },
  fever: { stop: 25, shake: 0.022, sparks: 40, size: 'mid' },
};

// ───────── 저장소 ─────────
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};
const hashId = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const withIds = (list) => list.map(q => ({ ...q, id: hashId(q.q + '|' + q.c[q.a]) }));
let QUESTIONS = withIds(store.get('jf_questions', null) || SAMPLE_QUESTIONS);
let WRONGS = store.get('jf_wrongs', {});
const settings = store.get('jf_settings', { timer: false, reviewOnly: false });

// ───────── 유틸 ─────────
const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

const world = new World($('#scene'));
const sfx = new Sfx();
world.resize();

// 트윈: 히트 스톱 중에는 멈춘다
const tweens = [];
const wait = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt;
    const k = w.dur > 0 ? Math.min(1, w.t / w.dur) : 1;
    if (w.fn) w.fn(k);
    if (k >= 1) { tweens.splice(i, 1); w.res(); }
  }
}
let hitstopUntil = 0;
const hitstop = (ms) => { hitstopUntil = Math.max(hitstopUntil, performance.now() + ms); };

// ───────── 상태 ─────────
let S;
function freshState() {
  return {
    day: 1, candles: 3, gold: 0, blanks: 0, bonusBlanks: 0, finished: [], scrap: 0, cur: null,
    gauge: 0, feverUntil: 0, feverPending: false, relics: new Set(), items: { charm: 0, hint: 1 },
    stats: { answered: 0, correct: 0, best: 0, broken: 0, made: 0, offered: 0 },
    sessionWrong: new Set(), recent: [], history: {}, mode: 'title', boardMsg: null,
    offers: [], rerollCost: 200,
  };
}
S = freshState();

const feverOn = () => S.feverUntil > performance.now();
const value = (lv) => Math.round(VAL[Math.min(lv, 15)] * (S.relics.has('whetstone') ? 1.2 : 1) / 10) * 10;
const bladeName = (lv) => NAMES[Math.min(lv, 15)];
const req = () => REQ[S.day - 1];

function probs(level, correct, fever) {
  if (fever) return { great: 30, succ: 70, keep: 0, dmg: 0, brk: 0 };
  if (correct) {
    let great = Math.max(5, 14 - level * 0.7);
    if (S.relics.has('glove')) great += 8;
    const keep = Math.min(50, level * 3.5);
    return { great, succ: 100 - great - keep, keep, dmg: 0, brk: 0 };
  }
  if (level === 0) return { great: 0, succ: 0, keep: 100, dmg: 0, brk: 0 };
  let brk = Math.min(78, 6 + level * 6);
  if (S.relics.has('anvil')) brk *= 0.65;
  const dmg = Math.min(100 - brk, 42);
  return { great: 0, succ: 0, keep: 100 - brk - dmg, dmg, brk };
}
function roll(p) {
  let r = Math.random() * 100;
  for (const k of ['brk', 'dmg', 'keep', 'succ', 'great']) { if (r < p[k]) return k; r -= p[k]; }
  return 'keep';
}
const pct = (v) => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + '%';

// ───────── 전광판 / 달력 ─────────
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
function drawBoard() {
  const g = world.boardCtx, W = 1024, H = 512, now = performance.now();
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#120c08'); bg.addColorStop(1, '#070504');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(242,196,92,.35)'; g.lineWidth = 4; g.strokeRect(14, 14, W - 28, H - 28);
  g.textBaseline = 'alphabetic';
  if (S.boardMsg && now < S.boardMsg.until) {
    g.textAlign = 'center'; g.fillStyle = '#ff3b30';
    g.font = '900 150px "Noto Sans KR", sans-serif'; g.fillText('파괴', W / 2, 260);
    g.font = '700 46px "Noto Sans KR", sans-serif'; g.fillStyle = '#ff8a7a'; g.fillText(S.boardMsg.text, W / 2, 360);
    world.boardTex.needsUpdate = true; return;
  }
  if (!S.cur) {
    g.textAlign = 'center'; g.fillStyle = '#a58c6e';
    g.font = '700 64px "Gowun Batang", serif'; g.fillText('모루가 비어 있다', W / 2, 230);
    g.font = '500 36px "Noto Sans KR", sans-serif'; g.fillStyle = '#7d6a54';
    g.fillText(S.blanks > 0 ? '원석을 꺼내 화로에 달구자' : '오늘 쓸 원석을 모두 썼다', W / 2, 300);
    world.boardTex.needsUpdate = true; return;
  }
  const c = S.cur, fever = feverOn();
  g.textAlign = 'left';
  g.font = '700 58px "Gowun Batang", serif';
  if (fever) {
    const rg = g.createLinearGradient(48, 0, 560, 0); const h = (now / 8) % 360;
    for (let i = 0; i <= 4; i++) rg.addColorStop(i / 4, `hsl(${(h + i * 70) % 360},100%,68%)`);
    g.fillStyle = rg;
  } else g.fillStyle = '#f4e7cf';
  g.fillText(bladeName(c.level), 50, 96);
  g.font = '700 42px "Noto Sans KR", sans-serif'; g.fillStyle = '#f2c45c';
  g.fillText(`${fmt(value(c.level))} G`, 50, 152);
  g.textAlign = 'right'; g.font = '900 112px "Noto Sans KR", sans-serif'; g.fillStyle = fever ? '#ffffff' : '#ffcf6a';
  g.fillText(`+${c.level}`, W - 46, 128);
  // 영감 게이지
  g.textAlign = 'left'; g.font = '700 28px "Noto Sans KR", sans-serif'; g.fillStyle = '#86e6ff';
  g.fillText(fever ? '영감!' : '영감', 50, 214);
  const gx = 150, gw = (W - 46 - gx) / 10;
  for (let i = 0; i < 10; i++) {
    const on = fever || i < S.gauge;
    g.fillStyle = on ? (fever ? `hsl(${(now / 5 + i * 36) % 360},100%,62%)` : '#86e6ff') : 'rgba(134,230,255,.12)';
    g.beginPath(); g.roundRect(gx + i * gw + 3, 188, gw - 6, 34, 7); g.fill();
  }
  const row = (label, p, keys, y, note) => {
    g.textAlign = 'left'; g.font = '700 32px "Noto Sans KR", sans-serif'; g.fillStyle = '#d9c7a6'; g.fillText(label, 50, y + 46);
    const x0 = 150, bw = W - 46 - x0, bh = 66;
    g.fillStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.roundRect(x0, y, bw, bh, 12); g.fill();
    if (note) { g.fillStyle = '#86e6ff'; g.font = '700 30px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.fillText(note, x0 + bw / 2, y + 44); return; }
    let x = x0;
    g.save(); g.beginPath(); g.roundRect(x0, y, bw, bh, 12); g.clip();
    for (const k of keys) {
      const w = bw * p[k] / 100; if (w <= 0) continue;
      g.fillStyle = OUT[k].color; g.fillRect(x, y, w, bh);
      if (w > 120) {
        g.fillStyle = '#0b0806'; g.textAlign = 'center'; g.font = '900 28px "Noto Sans KR", sans-serif';
        g.fillText(`${OUT[k].label} ${pct(p[k])}`, x + w / 2, y + 44);
      } else if (w > 56) {
        g.fillStyle = '#0b0806'; g.textAlign = 'center'; g.font = '900 24px "Noto Sans KR", sans-serif';
        g.fillText(pct(p[k]), x + w / 2, y + 42);
      }
      x += w;
    }
    g.restore();
  };
  row('정답', probs(c.level, true, fever), ['great', 'succ', 'keep'], 262);
  row('오답', probs(c.level, false, fever), ['keep', 'dmg', 'brk'], 362, fever ? '영감 중에는 문제 없이 · 파괴 0%' : null);
  world.boardTex.needsUpdate = true;
}

function drawCalendar() {
  const g = world.calCtx, W = 768, H = 512;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#dccba4'); bg.addColorStop(1, '#c2ad84');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,60,30,${Math.random() * 0.08})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.fillStyle = '#3a2414'; g.textAlign = 'center';
  g.font = '700 50px "Gowun Batang", serif'; g.fillText('서고지기와의 계약', W / 2, 74);
  const x0 = 34, cw = (W - 68) / 7, y0 = 120, ch = 210;
  for (let d = 1; d <= MAX_DAY; d++) {
    const x = x0 + (d - 1) * cw;
    g.strokeStyle = 'rgba(58,36,20,.6)'; g.lineWidth = 3; g.strokeRect(x + 4, y0, cw - 8, ch);
    g.fillStyle = '#3a2414'; g.font = '700 40px "Gowun Batang", serif'; g.fillText(`${d}일`, x + cw / 2, y0 + 52);
    g.font = '500 24px "Noto Sans KR", sans-serif'; g.fillStyle = '#5a3a20'; g.fillText(`${fmt(REQ[d - 1])}G`, x + cw / 2, y0 + 190);
    const hst = S.history[d];
    if (hst === 'ok') { g.strokeStyle = '#2f5a2a'; g.lineWidth = 9; g.beginPath(); g.moveTo(x + 24, y0 + 110); g.lineTo(x + cw / 2, y0 + 140); g.lineTo(x + cw - 18, y0 + 80); g.stroke(); }
    else if (hst === 'fail') { g.strokeStyle = '#8a1e14'; g.lineWidth = 9; g.beginPath(); g.moveTo(x + 22, y0 + 76); g.lineTo(x + cw - 22, y0 + 150); g.moveTo(x + cw - 22, y0 + 76); g.lineTo(x + 22, y0 + 150); g.stroke(); }
    else if (d === S.day && S.mode !== 'title') { g.strokeStyle = '#8a1e14'; g.lineWidth = 6; g.beginPath(); g.ellipse(x + cw / 2, y0 + 112, cw / 2 - 14, 44, 0, 0, Math.PI * 2); g.stroke(); }
  }
  g.fillStyle = '#4a2e18'; g.font = '500 28px "Gowun Batang", serif';
  g.fillText('촛불 셋이 모두 꺼지면 계약은 끝난다', W / 2, 420);
  g.fillText('— 망각의 서고지기', W / 2, 466);
  world.calTex.needsUpdate = true;
}

// ───────── HUD ─────────
function popup(text, at, cls) {
  const p = at && at.isVector3 ? world.toScreen(at) : at;
  const d = document.createElement('div');
  d.className = 'pop ' + cls; d.textContent = text;
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
  $('#popups').appendChild(d);
  setTimeout(() => d.remove(), 1300);
}
function banner(title, sub) {
  const b = $('#banner');
  b.querySelector('.b-title').textContent = title; b.querySelector('.b-sub').textContent = sub || '';
  b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
}
function flashRed() {
  const f = $('#flash');
  f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' });
}

function refresh() {
  $('#hud-day').textContent = S.day; $('#hud-maxday').textContent = MAX_DAY;
  $('#hud-req').textContent = `${fmt(req())} G`;
  $('#hud-candles').innerHTML = [0, 1, 2].map(i => `<div class="candle-ico ${i < S.candles ? '' : 'out'}"></div>`).join('');
  $('#hud-gold').textContent = fmt(S.gold);
  $('#hud-blanks').textContent = S.blanks;
  $('#hud-fin').textContent = S.finished.length;
  $('#hud-acc').textContent = S.stats.answered ? Math.round(S.stats.correct / S.stats.answered * 100) + '%' : '-';
  // 유물/소모품
  const rel = [...S.relics].map(k => badge(k));
  for (const k of ['charm', 'hint']) if (S.items[k] > 0) rel.push(badge(k, S.items[k]));
  if (S.scrap > 0) rel.push(`<div class="relic item">철<span class="cnt">${fmt(S.scrap)}</span><div class="tip"><b>모아 둔 고철</b>제단에 함께 바칠 수 있다.</div></div>`);
  $('#hud-relics').innerHTML = rel.join('');
  // 행동 버튼
  const m = S.mode, canAct = m === 'idle' || m === 'anvil';
  const atAnvil = view === 'anvil' && m === 'anvil' && !!S.cur, walk = view === 'walk' && canAct;
  $('#actions').classList.toggle('hidden', !atAnvil);
  $('#act-strike').innerHTML = feverOn() ? '<kbd>Space</kbd>연타!' : '<kbd>Space</kbd>망치질';
  let hint = '';
  if (walk) {
    const goal = S.cur ? '모루에 벼리던 검이 있어요' : S.blanks > 0 ? '원석 상자에서 원석을 꺼내세요' : '원석을 다 썼어요 · 검을 제단에 바치세요';
    hint = (IS_TOUCH ? '조이스틱 이동 · 끌어서 둘러보기 · 톡 상호작용' : 'WASD 이동 · 마우스로 둘러보기 · E/클릭 상호작용') + ` — ${goal}`;
  } else if (atAnvil) hint = feverOn() ? '영감! 문제 없이 마구 두드리세요' : '망치질하면 문제가 나옵니다 · 위험해지면 검 완성으로 멈추세요';
  $('#hud-hint').textContent = hint;
  $('#hud-hint').classList.toggle('hidden', !(walk || atAnvil));
  $('#crosshair').classList.toggle('hidden', !walk);
  $('#joy').classList.toggle('hidden', !(walk && IS_TOUCH));
  if (!walk) $('#prompt').classList.add('hidden');
  world.setOreCount(Math.min(8, S.blanks));
}
function badge(k, cnt) {
  const it = ITEMS[k];
  return `<div class="relic ${it.kind === 'item' ? 'item' : ''}">${it.icon}${cnt ? `<span class="cnt">${cnt}</span>` : ''}<div class="tip"><b>${it.name}</b>${it.desc}</div></div>`;
}

// ───────── 문제 ─────────
const Q = { cur: null, order: [], correct: -1, answered: false, pendingWrong: false, timer: null, hinted: false };
function pickQuestion() {
  let pool = QUESTIONS;
  if (settings.reviewOnly) {
    const w = QUESTIONS.filter(q => WRONGS[q.id]);
    if (w.length >= 3) pool = w;
  }
  const avoid = new Set(S.recent.slice(-Math.min(6, pool.length - 1)));
  const cand = pool.filter(q => !avoid.has(q.id));
  const list = cand.length ? cand : pool;
  const weights = list.map(q => 1 + (WRONGS[q.id] ? Math.min(4, WRONGS[q.id].count) * 1.5 : 0));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) { r -= weights[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
function openQuestion() {
  const q = pickQuestion();
  S.recent.push(q.id); if (S.recent.length > 20) S.recent.shift();
  Q.cur = q; Q.answered = false; Q.pendingWrong = false; Q.hinted = false;
  Q.order = shuffle(q.c.map((_, i) => i));
  Q.correct = Q.order.indexOf(q.a);
  S.mode = 'question'; refresh();
  $('#q-tag').textContent = q.t || '문제';
  const brk = probs(S.cur.level, false, false).brk;
  $('#q-risk').innerHTML = `${esc(bladeName(S.cur.level))} +${S.cur.level} · 틀리면 파괴 <b>${pct(brk)}</b>`;
  $('#q-text').textContent = q.q;
  const box = $('#q-choices'); box.innerHTML = '';
  Q.order.forEach((orig, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<kbd>${i + 1}</kbd>${esc(q.c[orig])}`;
    b.onclick = () => answer(i);
    box.appendChild(b);
  });
  if (S.relics.has('glasses')) dimWrong(1);
  $('#q-explain').classList.add('hidden');
  $('#q-go').classList.add('hidden');
  const hb = $('#q-hint');
  hb.textContent = `힌트 두루마리 (${S.items.hint})`;
  hb.disabled = S.items.hint <= 0; hb.classList.toggle('hidden', S.items.hint <= 0);
  const tm = $('#q-timer');
  clearTimeout(Q.timer);
  if (settings.timer) {
    tm.classList.remove('hidden');
    const bar = tm.firstElementChild; bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth;
    bar.style.transition = 'width 20s linear'; bar.style.width = '0%';
    Q.timer = setTimeout(() => answer(-1), 20000);
  } else tm.classList.add('hidden');
  $('#qcard').classList.remove('hidden');
}
function dimWrong(n) {
  const btns = [...$('#q-choices').children];
  const wrong = shuffle(btns.map((_, i) => i).filter(i => i !== Q.correct && !btns[i].disabled));
  wrong.slice(0, n).forEach(i => { btns[i].classList.add('dim'); btns[i].disabled = true; });
}
function useHint() {
  if (Q.answered || Q.hinted || S.items.hint <= 0) return;
  S.items.hint--; Q.hinted = true; dimWrong(2); sfx.play('ui');
  $('#q-hint').textContent = `힌트 두루마리 (${S.items.hint})`; $('#q-hint').disabled = true; refresh();
}
function answer(i) {
  if (S.mode !== 'question' || Q.answered) return;
  if (i >= 0 && $('#q-choices').children[i]?.disabled) return;
  Q.answered = true; clearTimeout(Q.timer);
  const tb = $('#q-timer').firstElementChild; tb.style.width = getComputedStyle(tb).width; tb.style.transition = 'none';
  const ok = i === Q.correct, q = Q.cur;
  S.stats.answered++;
  const btns = [...$('#q-choices').children];
  btns.forEach(b => { b.disabled = true; });
  btns[Q.correct].classList.add('right');
  const ex = $('#q-explain');
  if (ok) {
    S.stats.correct++;
    if (WRONGS[q.id]) { WRONGS[q.id].streak = (WRONGS[q.id].streak || 0) + 1; store.set('jf_wrongs', WRONGS); }
    S.gauge = Math.min(10, S.gauge + (S.relics.has('incense') ? 2 : 1));
    if (S.gauge >= 10) S.feverPending = true;
    sfx.play('correct');
    if (q.e) { ex.className = 'q-explain ok'; ex.innerHTML = `<b>정답!</b> ${esc(q.e)}`; }
    drawBoard(); refresh();
    setTimeout(() => { closeCard(); doStrike(true, false); }, q.e ? 900 : 500);
  } else {
    if (i >= 0) btns[i].classList.add('bad');
    S.sessionWrong.add(q.id);
    const w = WRONGS[q.id] || { count: 0, q: q.q, ans: q.c[q.a], e: q.e || '', t: q.t || '' };
    w.count++; w.streak = 0; w.last = Date.now(); WRONGS[q.id] = w; store.set('jf_wrongs', WRONGS);
    S.gauge = Math.max(0, S.gauge - 3);
    sfx.play('wrong');
    ex.className = 'q-explain';
    ex.innerHTML = `${i < 0 ? '<b>시간 초과!</b> ' : ''}정답은 <b>${esc(q.c[q.a])}</b>${q.e ? ` — ${esc(q.e)}` : ''}<br><small>오답 노트에 적어 두었다. 금이 간 채로 내리친다…</small>`;
    $('#q-go').classList.remove('hidden');
    Q.pendingWrong = true;
    drawBoard(); refresh();
  }
}
function confirmWrong() {
  if (!Q.pendingWrong) return;
  Q.pendingWrong = false; closeCard(); doStrike(false, false);
}
function closeCard() { $('#qcard').classList.add('hidden'); }

// ───────── 대장간 흐름 ─────────
async function takeBlank() {
  if (S.mode !== 'idle' || S.cur || S.blanks <= 0) return;
  sfx.init(); S.blanks--; S.mode = 'moving'; view = 'cine'; refresh();
  const holder = makeLyingBlade(0);
  const car = new THREE.Group(); car.add(holder); car.position.copy(world.cratePos);
  world.scene.add(car);
  S.cur = { level: 0, holder, car, heat: 0, flash: 0, maxValue: value(0) };
  drawBoard();
  world.goStation('furnace', 3.2);
  sfx.play('whoosh');
  const a = car.position.clone(), b = new THREE.Vector3(-2.78, 0.74, -2.4);
  await wait(0.75, k => { const e = easeInOut(k); car.position.lerpVectors(a, b, e); car.position.y += Math.sin(k * Math.PI) * 0.45; car.rotation.y = Math.PI * e; });
  sfx.play('heat');
  await wait(1.35, k => { S.cur.heat = k * 1.4; car.position.x = b.x + Math.sin(k * 30) * 0.006; if (Math.random() < 0.3) world.spawnSparks(b, 1, 0xff8a3d, { speed: 1, up: 1.5, life: 0.6 }); });
  world.goStation('anvil', 2.8);
  const c = world.anvilTop.clone();
  await wait(0.8, k => { const e = easeInOut(k); car.position.lerpVectors(b, c, e); car.position.y += Math.sin(k * Math.PI) * 0.4; car.rotation.y = Math.PI * (1 - e); });
  sfx.play('place'); world.shake(0.012);
  world.spawnSparks(c, 12, 0xff9a40, { speed: 1.4, up: 1 });
  S.mode = 'anvil'; view = 'anvil'; drawBoard(); refresh();
}

function strike() {
  if (S.mode !== 'anvil' || !S.cur) return;
  sfx.init();
  if (feverOn()) doStrike(true, true);
  else openQuestion();
}

async function doStrike(correct, fever) {
  S.mode = 'striking'; refresh();
  const h = world.hammer, rest = -0.55, up = -1.38;
  sfx.play('whoosh', { fast: fever });
  await wait(fever ? 0.07 : 0.15, k => { h.rotation.z = lerp(rest, up, easeOut(k)); });
  await wait(fever ? 0.045 : 0.075, k => { h.rotation.z = lerp(up, 0, k * k); });
  resolveStrike(correct, fever);
  await wait(fever ? 0.08 : 0.24, k => { h.rotation.z = lerp(0, rest, easeOut(k)); });
  if (S.mode === 'striking') S.mode = S.cur ? 'anvil' : 'idle';
  if (S.feverPending) { S.feverPending = false; if (S.cur) startFever(); }
  refresh();
  // 검이 부서지면 파편이 흩어지는 걸 보여 준 뒤 자유 이동으로 돌아간다
  if (!S.cur && view === 'anvil') setTimeout(() => { if (view === 'anvil' && S.mode === 'idle' && !S.cur) leaveAnvil(); }, 1100);
}

function resolveStrike(correct, fever) {
  const c = S.cur;
  let out = roll(probs(c.level, correct, fever));
  let charm = false;
  if (out === 'brk' && S.items.charm > 0) { S.items.charm--; out = 'keep'; charm = true; }
  const before = c.level, beforeVal = value(before);
  if (out === 'great') c.level = Math.min(15, c.level + 2 + (Math.random() < 0.2 ? 1 : 0));
  else if (out === 'succ') c.level = Math.min(15, c.level + 1);
  else if (out === 'dmg') c.level = Math.max(0, c.level - 1);
  const ip = world.impactPoint, fx = fever ? FX.fever : FX[out];
  hitstop(fx.stop);
  world.shake(fx.shake);
  sfx.play(fever ? 'feverHit' : out === 'succ' ? 'clang' : out === 'great' ? 'great' : out === 'keep' ? 'dull' : out === 'dmg' ? 'crack' : 'shatter');
  const above = ip.clone().add(new THREE.Vector3(0, 0.32, 0));
  if (out === 'brk') {
    world.spawnShards(c.holder, OUT.brk.hex);
    world.scene.remove(c.car);
    const lost = Math.max(c.maxValue, beforeVal);
    if (S.relics.has('scrap')) { const s = Math.round(lost * 0.3 / 10) * 10; S.scrap += s; setTimeout(() => popup(`고철 +${fmt(s)} G`, world.toScreen(above.clone().add(new THREE.Vector3(0, -0.25, 0))), 'sm cyan'), 500); }
    S.stats.broken++;
    S.cur = null; S.feverUntil = 0; S.feverPending = false;
    S.boardMsg = { text: `${bladeName(before)} +${before} · 검 소실`, until: performance.now() + 1700 };
    setTimeout(drawBoard, 1750);
    flashRed();
    popup('파괴', above, 'brk');
  } else {
    if (c.level !== before) {
      // 단계가 바뀌면 검의 모양 자체가 바뀐다: 새 모양이 부풀었다 가라앉으며 이름을 알린다
      setLyingBladeLevel(c.holder, c.level);
      const up = c.level > before, h = c.holder;
      wait(up ? 0.32 : 0.2, k => { const s = 1 + (up ? 0.22 : 0.08) * Math.sin(k * Math.PI) * (1 - k * 0.3); h.scale.setScalar(s); }).then(() => h.scale.setScalar(1));
      if (up) {
        world.spawnSparks(ip.clone().add(new THREE.Vector3(-0.1, 0.03, 0)), 30, 0xfff1c8, { speed: 1.6, up: 0.6, life: 0.7, spread: 0.45 });
        const sp = world.toScreen(ip.clone().add(new THREE.Vector3(0, -0.12, 0)));
        setTimeout(() => popup(`✦ ${bladeName(c.level)}`, sp, 'sm cyan'), 180);
      }
    }
    c.flash = 0.08;
    c.maxValue = Math.max(c.maxValue, value(c.level));
    S.stats.best = Math.max(S.stats.best, c.level);
    // 튀는 반동
    const car = c.car, y0 = world.anvilTop.y;
    wait(0.12, k => { car.position.y = y0 + Math.sin(k * Math.PI) * (out === 'great' ? 0.05 : 0.025); });
    if (fever) {
      world.spawnSparks(ip, fx.sparks, new THREE.Color().setHSL(Math.random(), 1, 0.6), { speed: 3.5, up: 2.4 });
    } else {
      world.spawnSparks(ip, fx.sparks, OUT[out].hex, { speed: out === 'great' ? 4.5 : 3, up: out === 'great' ? 3 : 2 });
    }
    if (out === 'great') world.spawnSparks(ip, 40, 0xffffff, { speed: 2, up: 3.5, life: 1.2, mul: 2 });
    const label = charm ? '부적이 막았다!' : OUT[out].label + (out === 'succ' || out === 'great' ? ` +${c.level - before}` : out === 'dmg' && before > 0 ? ' −1' : '');
    popup(fever ? `+${c.level - before}` : label, above, `${fever ? 'mid' : fx.size} ${charm ? 'cyan' : out}`);
    const dv = value(c.level) - beforeVal;
    if (dv !== 0) {
      const sp = world.toScreen(above);
      setTimeout(() => popup(`${dv > 0 ? '+' : '−'}${fmt(Math.abs(dv))} G`, { x: sp.x + 150, y: sp.y + 30 }, 'sm gold'), 90);
    }
  }
  drawBoard(); refresh();
}

function startFever() {
  S.gauge = 0;
  S.feverUntil = performance.now() + FEVER_MS;
  sfx.play('fever'); world.shake(0.03);
  popup('영감!', world.impactPoint.clone().add(new THREE.Vector3(0, 0.55, 0)), 'big cyan');
  world.spawnSparks(world.impactPoint, 80, 0x86e6ff, { speed: 3, up: 3.5, life: 1.2 });
  $('#fever-frame').classList.add('on'); $('#fever-bar').classList.add('on');
  drawBoard(); refresh();
}

async function finishBlade() {
  if (S.mode !== 'anvil' || !S.cur) return;
  const c = S.cur; S.mode = 'moving'; S.feverUntil = 0; refresh();
  sfx.play('hiss');
  world.spawnSmoke(c.car.position.clone().add(new THREE.Vector3(0, 0.05, 0)), 8);
  popup(`${bladeName(c.level)} +${c.level} 완성!`, world.impactPoint.clone().add(new THREE.Vector3(0, 0.45, 0)), 'mid gold');
  const slot = world.rackSlots[Math.min(S.finished.length, 7)];
  const a = c.car.position.clone(), b = new THREE.Vector3(slot.x - 0.3, 2.3, slot.z);
  world.goStation('overview', 2.6);
  await wait(0.9, k => { const e = easeInOut(k); c.car.position.lerpVectors(a, b, e); c.car.position.y += Math.sin(k * Math.PI) * 0.6; c.car.rotation.z = e * 0.8; });
  world.scene.remove(c.car);
  S.finished.push({ level: c.level });
  S.stats.made++; S.cur = null;
  world.setRack(S.finished); sfx.play('place');
  await wait(0.5);
  S.mode = 'idle'; drawBoard();
  placePlayer(2.4, 0.2, -Math.PI / 2, 0.12); enterWalk(); // 검걸이 앞에서 걸어 둔 검을 바라본다
}

// ───────── 제단 ─────────
function openAltar() {
  if (S.mode !== 'idle' && S.mode !== 'anvil') return;
  sfx.init(); S.feverUntil = 0;
  S.mode = 'altar'; refresh();
  world.goStation('altar', 2.4);
  const sel = new Set(S.finished.map((_, i) => i));
  let useScrap = S.scrap > 0;
  const render = () => {
    const total = [...sel].reduce((s, i) => s + value(S.finished[i].level), 0) + (useScrap ? S.scrap : 0);
    const ok = total >= req();
    const warn = [];
    if (S.cur) warn.push(`모루 위의 ${bladeName(S.cur.level)} +${S.cur.level}은(는) 아직 완성하지 않아 바칠 수 없다.`);
    if (S.blanks > 0) warn.push(`원석 ${S.blanks}개가 남아 있다. 남은 원석은 내일로 넘어간다.`);
    openPanel(`
      <h2>망각의 서고지기</h2>
      <p class="sub">철창 너머에서 푸른 눈이 당신을 내려다본다. "${S.day}일째의 대가를 바쳐라. <b>${fmt(req())} G</b> 이상."</p>
      <div class="offer-list">
        ${S.finished.length || S.scrap ? '' : '<div class="empty">바칠 검이 없다. 이대로 종을 울리면 촛불 하나가 꺼진다.</div>'}
        ${S.finished.map((b, i) => `<label class="offer ${sel.has(i) ? 'on' : ''}" data-i="${i}"><input type="checkbox" ${sel.has(i) ? 'checked' : ''}><span class="nm">${esc(bladeName(b.level))} <b>+${b.level}</b><small>완성한 검</small></span><span class="val">${fmt(value(b.level))} G</span></label>`).join('')}
        ${S.scrap > 0 ? `<label class="offer ${useScrap ? 'on' : ''}" data-scrap="1"><input type="checkbox" ${useScrap ? 'checked' : ''}><span class="nm">고철 더미<small>파괴된 검에서 모은 쇳조각</small></span><span class="val">${fmt(S.scrap)} G</span></label>` : ''}
      </div>
      <div class="meter"><div class="line"><span>바칠 가치</span><b style="color:${ok ? 'var(--green)' : 'var(--red)'}">${fmt(total)} / ${fmt(req())} G</b></div>
        <div class="bar"><div class="${ok ? 'ok' : ''}" style="width:${Math.min(100, total / req() * 100)}%"></div></div>
        <p class="sub" style="margin:8px 0 0">바친 가치만큼 골드를 받는다. 남긴 검은 내일 바칠 수 있다.</p></div>
      ${warn.length ? `<p class="sub" style="margin-top:12px">${warn.map(esc).join('<br>')}</p>` : ''}
      <div class="btnrow"><button id="al-back" class="ghost">대장간으로 돌아가기</button><button id="al-ring" class="primary">${ok ? '바치고 종 울리기' : '부족하지만 종 울리기'}</button></div>`, true);
    document.querySelectorAll('.offer').forEach(el => el.addEventListener('click', (e) => {
      e.preventDefault();
      if (el.dataset.scrap) useScrap = !useScrap;
      else { const i = +el.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); }
      sfx.play('ui'); render();
    }));
    $('#al-back').onclick = () => { closeModal(); S.mode = S.cur ? 'anvil' : 'idle'; enterWalk(); };
    $('#al-ring').onclick = () => {
      if (!ok && !confirm('요구 가치에 못 미칩니다. 촛불 하나가 꺼집니다. 그래도 종을 울릴까요?')) return;
      ring([...sel], useScrap);
    };
  };
  render();
}

async function ring(sel, useScrap) {
  closeModal(); S.mode = 'ritual'; refresh();
  const offered = sel.sort((a, b) => b - a).map(i => S.finished.splice(i, 1)[0]);
  const total = offered.reduce((s, b) => s + value(b.level), 0) + (useScrap ? S.scrap : 0);
  if (useScrap) S.scrap = 0;
  world.setRack(S.finished);
  const cars = offered.slice(0, 6).map((b, i, arr) => {
    const h = makeLyingBlade(b.level), car = new THREE.Group(); car.add(h);
    car.position.copy(world.offerSpot).add(new THREE.Vector3(0, i * 0.03, (i - (arr.length - 1) / 2) * 0.13));
    car.rotation.y = (i - (arr.length - 1) / 2) * 0.12;
    world.scene.add(car); return car;
  });
  if (cars.length) sfx.play('place');
  await wait(0.7);
  sfx.play('bell'); world.shake(0.02);
  world.spawnSparks(world.offerSpot, 40, 0x86e6ff, { speed: 1.2, up: 2.5, life: 1.4 });
  await wait(0.9);
  const starts = cars.map(c => c.position.clone());
  await wait(1.3, k => cars.forEach((car, i) => {
    const e = easeInOut(k);
    car.position.set(starts[i].x, starts[i].y + e * 1.1, starts[i].z - e * 1.6);
    car.scale.setScalar(Math.max(0.01, 1 - e * 0.95));
    const m = car.children[0].userData.mat; m.emissive.setRGB(0.4, 1.6, 2); m.emissiveIntensity = e * 3;
  }));
  cars.forEach(c => world.scene.remove(c));
  const ok = total >= req();
  S.history[S.day] = ok ? 'ok' : 'fail';
  if (ok) {
    S.gold += total; S.stats.offered += total;
    world.setSpiritMood('happy'); sfx.play('spirit'); sfx.play('coin');
    banner('서고지기가 만족했다', `${fmt(total)} G를 받았다`);
  } else {
    world.setSpiritMood('angry'); sfx.play('blowout');
    S.candles--; world.setCandle(S.candles, false);
    world.spawnSmoke(world.candles[S.candles].flame.position.clone(), 10);
    world.shake(0.06); flashRed();
    banner('서고지기가 분노했다', `요구 ${fmt(req())} G · 바친 가치 ${fmt(total)} G — 촛불 하나가 꺼졌다`);
  }
  drawCalendar(); refresh();
  await wait(2.8);
  world.setSpiritMood(S.candles > 0 ? 'calm' : 'doom');
  if (S.candles <= 0) return gameOver();
  if (S.day >= MAX_DAY) return victory();
  openShop();
}

// ───────── 상인 ─────────
function rollOffers() {
  const relics = shuffle(Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'relic' && !S.relics.has(k)));
  const items = shuffle(Object.keys(ITEMS).filter(k => ITEMS[k].kind === 'item' && !(k === 'candle' && S.candles >= 3)));
  const picks = [];
  if (relics.length) picks.push(relics.shift());
  if (relics.length && Math.random() < 0.6) picks.push(relics.shift());
  while (picks.length < 3 && items.length) picks.push(items.shift());
  while (picks.length < 3 && relics.length) picks.push(relics.shift());
  S.offers = shuffle(picks).map(k => ({ k, sold: false }));
}
function openShop() {
  S.mode = 'shop'; refresh();
  world.goStation('shop', 2.4);
  S.rerollCost = 200; rollOffers();
  renderShop();
}
function renderShop() {
  openPanel(`
    <h2>떠돌이 사서 등불</h2>
    <p class="sub">책장 날개를 파닥이는 등불이 진열장을 열어 보인다. "골드만 있다면야, 지식의 도구를 나눠 드리지요."</p>
    <div class="meter" style="margin:0 0 14px"><div class="line"><span>가진 골드</span><b style="color:var(--gold)">${fmt(S.gold)} G</b></div></div>
    <div class="shop-grid">
      ${S.offers.map((o, i) => { const it = ITEMS[o.k]; return `<div class="card ${it.kind === 'item' ? 'item' : ''} ${o.sold ? 'sold' : ''}">
        <div class="ico">${it.icon}</div>
        <div class="body"><div class="kind">${it.kind === 'relic' ? '유물 · 영구' : '소모품'}</div><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div>
        <button class="${o.sold ? 'ghost' : 'primary'} small" data-buy="${i}" ${o.sold || S.gold < it.price ? 'disabled' : ''}>${o.sold ? '구매함' : fmt(it.price) + ' G'}</button></div>`; }).join('')}
    </div>
    <div class="btnrow"><button id="sh-reroll" class="ghost" ${S.gold < S.rerollCost ? 'disabled' : ''}>새로 진열 (${fmt(S.rerollCost)} G)</button>
    <button id="sh-next" class="primary">다음 날 아침으로</button></div>`, true);
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(+b.dataset.buy));
  $('#sh-reroll').onclick = () => { if (S.gold < S.rerollCost) return; S.gold -= S.rerollCost; S.rerollCost += 150; rollOffers(); sfx.play('coin'); refresh(); renderShop(); };
  $('#sh-next').onclick = () => { closeModal(); S.day++; startDay(); };
}
function buy(i) {
  const o = S.offers[i], it = ITEMS[o.k];
  if (o.sold || S.gold < it.price) return;
  S.gold -= it.price; o.sold = true; sfx.play('coin');
  if (it.kind === 'relic') S.relics.add(o.k);
  else if (o.k === 'ore') S.bonusBlanks++;
  else if (o.k === 'candle') { if (S.candles < 3) { world.setCandle(S.candles, true); S.candles++; } }
  else S.items[o.k]++;
  refresh(); renderShop();
}

// ───────── 하루 / 판 ─────────
function newGame() {
  if (S.cur) world.scene.remove(S.cur.car);
  $('#fever-frame').classList.remove('on'); $('#fever-bar').classList.remove('on');
  S = freshState();
  world.darkness = 0; world.setSpiritMood('calm');
  world.candles.forEach((_, i) => world.setCandle(i, true));
  world.setRack([]);
  startDay();
}
function startDay() {
  S.blanks += BASE_BLANKS + (S.relics.has('pouch') ? 1 : 0) + S.bonusBlanks;
  S.bonusBlanks = 0;
  S.mode = S.cur ? 'anvil' : 'idle';
  placePlayer(0, 3.4, 0, -0.12); enterWalk();
  drawCalendar(); drawBoard(); refresh();
  banner(`${S.day}일째`, `서고지기의 요구 · ${fmt(req())} G`);
}
function summaryHTML() {
  const acc = S.stats.answered ? Math.round(S.stats.correct / S.stats.answered * 100) : 0;
  const wrong = QUESTIONS.filter(q => S.sessionWrong.has(q.id));
  return `<div class="summary">
      <div><span>버틴 날</span><b>${S.day} / ${MAX_DAY}</b></div>
      <div><span>정답률</span><b>${acc}%</b></div>
      <div><span>푼 문제</span><b>${S.stats.answered}</b></div>
      <div><span>최고 강화</span><b>+${S.stats.best}</b></div>
      <div><span>완성 / 파괴</span><b>${S.stats.made} / ${S.stats.broken}</b></div>
      <div><span>바친 가치</span><b>${fmt(S.stats.offered)}</b></div></div>
    <h3 style="font-family:var(--serif);margin:6px 0 8px">이번에 틀린 문제 ${wrong.length}개</h3>
    <div class="notes">${wrong.length ? wrong.map(q => `<div class="note"><div class="qq">${esc(q.q)}</div><div class="aa">정답: ${esc(q.c[q.a])}</div>${q.e ? `<div class="ee">${esc(q.e)}</div>` : ''}</div>`).join('') : `<div class="empty">${S.stats.answered ? '틀린 문제가 없다. 완벽한 대장장이!' : '이번 판에는 푼 문제가 없다.'}</div>`}</div>`;
}
async function gameOver() {
  S.mode = 'over'; refresh(); $('#hud').classList.add('hidden');
  sfx.play('doom'); world.goStation('altar', 1.2);
  await wait(2.2, k => { world.darkness = k * 0.8; });
  openPanel(`<h2>망각에 삼켜졌다</h2><p class="sub">마지막 촛불이 꺼지자 서고지기의 눈빛만이 어둠 속에 남았다. 하지만 틀린 문제는 오답 노트에 남아 있다. 다시 익히고 돌아오자.</p>
    ${summaryHTML()}<div class="btnrow"><button id="end-notes" class="ghost">오답 노트</button><button id="end-retry" class="primary">다시 도전</button></div>`);
  bindEnd();
}
async function victory() {
  S.mode = 'over'; refresh(); $('#hud').classList.add('hidden');
  world.setSpiritMood('happy'); sfx.play('great'); sfx.play('bell');
  world.goStation('overview', 1.2);
  openPanel(`<h2>계약 완수</h2><p class="sub">7일째 종소리가 울리자 서고지기가 고개를 숙였다. "그대의 검에는 잊히지 않을 지식이 담겼다." 대장간의 불씨는 이제 당신의 것이다.</p>
    ${summaryHTML()}<div class="btnrow"><button id="end-notes" class="ghost">오답 노트</button><button id="end-retry" class="primary">새 계약 시작</button></div>`);
  bindEnd();
}
function bindEnd() {
  $('#end-retry').onclick = () => { closeModal(); $('#hud').classList.remove('hidden'); newGame(); };
  $('#end-notes').onclick = () => openNotes(() => (S.candles <= 0 ? gameOver : victory)());
}

// ───────── 패널 ─────────
let panelBack = null;
function openPanel(html, side = false) { $('#panel').innerHTML = html; $('#modal').classList.toggle('side', side); $('#modal').classList.remove('hidden'); $('#panel').scrollTop = 0; }
function closeModal() { $('#modal').classList.add('hidden'); panelBack = null; }
function openNotes(back) {
  const list = Object.entries(WRONGS).sort((a, b) => b[1].count - a[1].count);
  openPanel(`<h2>오답 노트</h2><p class="sub">틀린 문제는 여기에 쌓이고, 게임 중에 더 자주 나온다. 같은 문제를 연속으로 맞히면 노트에서 빠진다.</p>
    <label class="opt" style="margin-bottom:12px"><input type="checkbox" id="nt-review" ${settings.reviewOnly ? 'checked' : ''}> 오답만 복습하는 모드 (오답이 3개 이상일 때)</label>
    <div class="notes">${list.length ? list.map(([, w]) => `<div class="note"><span class="cc">${w.count}번 틀림${w.streak ? ` · ${w.streak}연속 정답` : ''}</span><div class="qq">${w.t ? `[${esc(w.t)}] ` : ''}${esc(w.q)}</div><div class="aa">정답: ${esc(w.ans)}</div>${w.e ? `<div class="ee">${esc(w.e)}</div>` : ''}</div>`).join('') : '<div class="empty">아직 틀린 문제가 없다.</div>'}</div>
    <div class="btnrow"><button id="nt-clear" class="ghost">기록 지우기</button><button id="nt-close" class="primary">닫기</button></div>`);
  $('#nt-review').onchange = (e) => { settings.reviewOnly = e.target.checked; store.set('jf_settings', settings); };
  $('#nt-clear').onclick = () => { if (confirm('오답 기록을 모두 지울까요? 되돌릴 수 없습니다.')) { WRONGS = {}; store.set('jf_wrongs', WRONGS); openNotes(back); } };
  $('#nt-close').onclick = () => { closeModal(); if (back) back(); };
}
function serializeQuestions() {
  return QUESTIONS.map(q => `${q.t ? `[${q.t}] ` : ''}${q.q} | ${q.c.join(' | ')} | ${q.a + 1}${q.e ? ` | ${q.e}` : ''}`).join('\n');
}
function parseQuestions(text) {
  const out = [], errs = [];
  text.split(/\r?\n/).forEach((line, n) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const parts = (line.includes('\t') ? line.split('\t') : line.split('|')).map(s => s.trim());
    let ansPos = parts.length - 1, e = '';
    if (!/^\d+$/.test(parts[ansPos])) { e = parts[ansPos]; ansPos--; }
    const a = parseInt(parts[ansPos], 10);
    const c = parts.slice(1, ansPos).filter(Boolean);
    if (!parts[0] || c.length < 2 || c.length > 6 || !(a >= 1 && a <= c.length)) { errs.push(n + 1); return; }
    let q = parts[0], t = '';
    const m = q.match(/^\[(.+?)\]\s*/); if (m) { t = m[1]; q = q.slice(m[0].length); }
    out.push({ t, q, c, a: a - 1, e });
  });
  return { out, errs };
}
function openQSet(back) {
  openPanel(`<h2>문제 세트</h2><p class="sub">한 줄에 한 문제. <b>[분류] 문제 | 보기1 | 보기2 | 보기3 | 보기4 | 정답 번호 | 해설</b><br>보기는 2~6개, 해설은 생략할 수 있다. 구글 시트에서 칸을 복사해 붙여 넣어도 된다(탭 구분).</p>
    <textarea id="qs-text" spellcheck="false">${esc(serializeQuestions())}</textarea>
    <div class="msg" id="qs-msg">현재 ${QUESTIONS.length}문제</div>
    <div class="btnrow"><button id="qs-sample" class="ghost">샘플로 되돌리기</button><button id="qs-cancel" class="ghost">닫기</button><button id="qs-apply" class="primary">적용</button></div>`);
  $('#qs-apply').onclick = () => {
    const { out, errs } = parseQuestions($('#qs-text').value), msg = $('#qs-msg');
    if (out.length < 4) { msg.className = 'msg err'; msg.textContent = `문제가 최소 4개 필요하다 (읽은 문제 ${out.length}개${errs.length ? `, 형식 오류 줄: ${errs.slice(0, 8).join(', ')}` : ''})`; return; }
    QUESTIONS = withIds(out); store.set('jf_questions', out);
    msg.className = 'msg ok'; msg.textContent = `${out.length}문제를 적용했다${errs.length ? ` · 건너뛴 줄: ${errs.slice(0, 8).join(', ')}` : ''}`;
    updateQInfo();
  };
  $('#qs-sample').onclick = () => { $('#qs-text').value = SAMPLE_QUESTIONS.map(q => `[${q.t}] ${q.q} | ${q.c.join(' | ')} | ${q.a + 1} | ${q.e}`).join('\n'); };
  $('#qs-cancel').onclick = () => { closeModal(); if (back) back(); };
}
function openHowTo(back) {
  openPanel(`<h2>플레이 방법</h2><ol class="howto">
    <li><b>걸어 다니기</b> — WASD(또는 방향키)로 걷고, 마우스를 움직이는 만큼 시점이 돈다. Esc로 마우스를 풀 수 있다. Shift는 달리기. 휴대폰은 왼쪽 조이스틱과 화면 끌기.</li>
    <li><b>상호작용 (E)</b> — 원석 상자·화로·모루·제단·책장을 바라보면 안내가 뜬다. E나 클릭(휴대폰은 톡)으로 실행한다.</li>
    <li><b>원석 꺼내기</b> — 상자에서 원석을 꺼내면 화로에 달군 뒤 모루로 옮긴다. 모루 앞에 서면 시점이 고정된다. Esc나 이동 키로 자리를 뜰 수 있다.</li>
    <li><b>망치질 (Space)</b> — 내리칠 때마다 문제가 나온다. <b>맞히면</b> 성공·대성공으로 강해지고, <b>틀리면</b> 유지·손상·파괴 중 하나가 뽑힌다. 강할수록 틀렸을 때 파괴 확률이 높다.</li>
    <li><b>영감</b> — 정답마다 게이지가 찬다. 10칸이 차면 6초 동안 문제 없이 연타할 수 있고 파괴되지 않는다. 틀리면 게이지가 3칸 줄어든다.</li>
    <li><b>검 완성 (F)</b> — 위험해지기 전에 멈추고 걸이에 건다.</li>
    <li><b>제단</b> — 철창 앞 제단으로 걸어가 완성한 검을 바쳐 오늘의 요구 가치를 채우면 골드를 받는다. 모자라면 촛불이 꺼지고, 셋 다 꺼지면 끝.</li>
    <li><b>떠돌이 사서 등불</b> — 매일 밤 골드로 유물과 소모품을 산다.</li>
    <li><b>오답 노트</b> — 틀린 문제와 해설이 저장되고, 다음 판에 더 자주 나온다.</li></ol>
    <div class="btnrow"><button id="ht-close" class="primary">알겠다</button></div>`);
  $('#ht-close').onclick = () => { closeModal(); if (back) back(); };
}
function updateQInfo() {
  const nw = Object.keys(WRONGS).length;
  $('#qinfo').textContent = `문제 ${QUESTIONS.length}개 · 오답 노트 ${nw}개${settings.reviewOnly ? ' · 오답 복습 모드' : ''}`;
}

// ───────── 1인칭 이동 ─────────
// view: 'walk'(걸어 다님) · 'anvil'(모루 앞 고정 시점) · 'cine'(원석 옮기는 연출)
var view = 'walk';
const IS_TOUCH = matchMedia('(pointer: coarse)').matches;
if (IS_TOUCH) document.body.classList.add('touch');
const P = { x: 0, z: 3.4, yaw: 0, pitch: -0.12, vx: 0, vz: 0, bob: 0, stepAt: 0 };
const EYE = 1.62, PR = 0.3, SPEED = 2.5, RUN = 3.9;
// 부딪히는 사물 (x, z, 반지름)
const BLOCKERS = [
  [0, 0, 0.78], [-3.6, -2.4, 1.05], [-1.95, 0.95, 0.58], [-2.2, -0.5, 0.42], [0, -4.3, 0.72],
  [3.75, -3.55, 0.85], [-3.45, -4.72, 0.95], [2.6, 1.2, 0.4], [-4.3, -4.8, 0.3], [4.3, -4.8, 0.3], [-4.3, 2.5, 0.3], [4.3, 2.5, 0.3],
];
// 바라보면 상호작용할 수 있는 곳
const SPOTS = [
  { id: 'crate', x: -1.95, z: 0.95, r: 1.75 },
  { id: 'furnace', x: -3.1, z: -2.4, r: 1.9 },
  { id: 'anvil', x: 0, z: 0, r: 1.85 },
  { id: 'altar', x: 0, z: -4.3, r: 2.0 },
  { id: 'shelf', x: -3.45, z: -4.6, r: 1.9 },
  { id: 'rack', x: 4.35, z: 0.1, r: 2.3 },
  { id: 'merchant', x: 3.0, z: -2.9, r: 2.0 },
  { id: 'calendar', x: -4.45, z: 0.55, r: 2.1 },
  { id: 'door', x: 0, z: 4.45, r: 1.6 },
];
function spotInfo(id) {
  const free = S.mode === 'idle' && !S.cur;
  switch (id) {
    case 'crate': case 'furnace':
      if (S.cur) return { label: '모루에 벼리던 검이 있다' };
      if (S.blanks <= 0) return { label: '원석을 다 썼다 · 검을 제단에 바치자' };
      return free ? { label: id === 'crate' ? `원석 꺼내 달구기 (남은 원석 ${S.blanks})` : '원석을 꺼내 화로에 달구기', act: takeBlank } : null;
    case 'anvil':
      return S.cur ? { label: `모루 앞에 서기 · ${bladeName(S.cur.level)} +${S.cur.level}`, act: enterAnvil } : { label: '원석 상자에서 원석을 가져오자' };
    case 'altar': return { label: `서고지기에게 검 바치기 · 오늘 ${fmt(req())} G`, act: openAltar };
    case 'shelf': return { label: '오답 노트 펼치기', act: () => $('#btn-notes').onclick() };
    case 'rack': {
      const tot = S.finished.reduce((s, b) => s + value(b.level), 0);
      return { label: S.finished.length ? `완성한 검 ${S.finished.length}자루 · 합계 ${fmt(tot)} G` : '아직 걸어 둔 검이 없다' };
    }
    case 'merchant': return { label: '떠돌이 사서 등불 · 제단에 바친 밤에 진열장을 연다' };
    case 'calendar': return { label: `${S.day}일째 / ${MAX_DAY}일 · 촛불 ${S.candles}개 남음` };
    case 'door': return { label: '서고지기와의 계약이 끝날 때까지 나갈 수 없다' };
  }
  return null;
}
function placePlayer(x, z, yaw, pitch) { Object.assign(P, { x, z, yaw, pitch, vx: 0, vz: 0 }); }
let ctrlSince = 0, wasCtrl = false;
function enterWalk() { view = 'walk'; tryLock(); refresh(); }
// 마우스 잠금: OS 가속을 끈 원본 이동량(unadjustedMovement)을 우선 쓰고, 안 되면 일반 잠금.
// 잠금이 거부돼도 캔버스 위 마우스 움직임만으로 둘러볼 수 있다.
function tryLock() {
  if (IS_TOUCH || pointerLocked()) return;
  const plain = () => { try { const q = canvasEl.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (_) {} };
  try { const p = canvasEl.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch (_) { plain(); }
}
const SENS = 0.0022; // 1픽셀당 회전(라디안), 가로·세로 같은 비율
function leaveAnvil() {
  if (view !== 'anvil' || (S.mode !== 'anvil' && S.mode !== 'idle')) return;
  placePlayer(0, 1.55, 0, -0.32); enterWalk();
}
function enterAnvil() {
  if (S.mode !== 'anvil' || !S.cur) return;
  view = 'anvil'; if (pointerLocked()) document.exitPointerLock();
  world.goStation('anvil', 3.2); sfx.play('place'); refresh();
}
const pointerLocked = () => document.pointerLockElement === canvasEl;
const walkActive = () => view === 'walk' && (S.mode === 'idle' || S.mode === 'anvil');
const keys = new Set();
const joy = { x: 0, y: 0, id: null };
let focus = null, focusInfo = null, promptKey = '';

function forward() { return { x: -Math.sin(P.yaw), z: -Math.cos(P.yaw) }; }
function collide() {
  for (const [bx, bz, br] of BLOCKERS) {
    const dx = P.x - bx, dz = P.z - bz, d = Math.hypot(dx, dz), min = br + PR;
    if (d < min && d > 1e-4) { P.x = bx + dx / d * min; P.z = bz + dz / d * min; }
  }
  P.x = Math.max(-4.5 + PR + 0.05, Math.min(4.5 - PR - 0.05, P.x));
  P.z = Math.max(-4.6, Math.min(4.5 - PR - 0.05, P.z));
}
function updateWalk(dt, now) {
  const ctrl = view === 'walk' && (S.mode === 'idle' || S.mode === 'anvil' || S.mode === 'menu');
  world.walking = ctrl;
  if (ctrl && !wasCtrl) ctrlSince = now;
  wasCtrl = ctrl;
  if (!ctrl) { if (pointerLocked()) document.exitPointerLock(); return; }
  const active = walkActive();
  // 이동 입력
  let ix = 0, iz = 0;
  if (active) {
    if (keys.has('w') || keys.has('arrowup')) iz += 1;
    if (keys.has('s') || keys.has('arrowdown')) iz -= 1;
    if (keys.has('d') || keys.has('arrowright')) ix += 1;
    if (keys.has('a') || keys.has('arrowleft')) ix -= 1;
    ix += joy.x; iz -= joy.y;
  }
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  const f = forward(), sp = keys.has('shift') ? RUN : SPEED;
  const tx = (f.x * iz + -f.z * ix) * sp, tz = (f.z * iz + f.x * ix) * sp;
  const a = 1 - Math.exp(-dt * 10);
  P.vx += (tx - P.vx) * a; P.vz += (tz - P.vz) * a;
  P.x += P.vx * dt; P.z += P.vz * dt; collide();
  const v = Math.hypot(P.vx, P.vz);
  P.bob += v * dt * 3.1;
  if (v > 0.6 && P.bob > P.stepAt) { P.stepAt = P.bob + Math.PI; sfx.play('step'); }
  if (v < 0.3) P.stepAt = Math.min(P.stepAt, P.bob + 0.6);
  const bobY = Math.sin(P.bob * 2) * 0.022 * Math.min(1, v / SPEED);
  // 카메라: 들어올 때만 부드럽게 넘어가고 이후에는 바로 따라간다
  const t = (now - ctrlSince) / 1000;
  world.camSpeed = t < 0.7 ? 3 + t * 14 : 1e4;
  const cp = Math.cos(P.pitch);
  world.tgtPos.set(P.x, EYE + bobY, P.z);
  world.tgtLook.set(P.x + f.x * cp * 2, EYE + bobY + Math.sin(P.pitch) * 2, P.z + f.z * cp * 2);
  // 바라보는 대상
  let best = null, bestS = -1;
  if (active) for (const s of SPOTS) {
    const dx = s.x - P.x, dz = s.z - P.z, d = Math.hypot(dx, dz);
    if (d > s.r) continue;
    const c = (dx * f.x + dz * f.z) / Math.max(d, 1e-3);
    const score = c - d * 0.08;
    if (c > 0.72 && score > bestS) { best = s; bestS = score; }
  }
  focus = best; focusInfo = best ? spotInfo(best.id) : null;
  const key = focusInfo ? focusInfo.label + !!focusInfo.act : '';
  if (key !== promptKey) {
    promptKey = key;
    const pr = $('#prompt');
    pr.classList.toggle('hidden', !focusInfo);
    if (focusInfo) { pr.classList.toggle('info', !focusInfo.act); pr.innerHTML = `<kbd>E</kbd>${esc(focusInfo.label)}`; }
    $('#crosshair').classList.toggle('on', !!(focusInfo && focusInfo.act));
  }
}
function interact() {
  if (!walkActive() || !focusInfo || !focusInfo.act) return;
  sfx.init(); keys.clear(); joy.x = joy.y = 0;
  const act = focusInfo.act; promptKey = '__';
  if (pointerLocked() && act !== takeBlank) document.exitPointerLock();
  act();
}
$('#prompt').onclick = (e) => { e.stopPropagation(); interact(); };
$('#act-leave').onclick = leaveAnvil;

// 마우스: 클릭하면 포인터 잠금, 잠기지 않는 환경에서는 끌어서 둘러보기
let dragging = null;
function look(dx, dy, s) {
  P.yaw -= dx * s; P.pitch = Math.max(-1.25, Math.min(1.2, P.pitch - dy * s));
}
document.addEventListener('pointerlockchange', () => refresh());
// 클릭 없이 마우스를 움직이는 만큼 그대로 시점이 돈다 (보간 없음)
document.addEventListener('mousemove', (e) => {
  if (!walkActive() || IS_TOUCH) return;
  if (pointerLocked() || e.target === canvasEl) look(e.movementX, e.movementY, SENS);
});

// 조이스틱 (터치)
const joyEl = $('#joy');
const capture = (el, id) => { try { el.setPointerCapture(id); } catch (_) {} };
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; capture(joyEl, e.pointerId); moveJoy(e); e.preventDefault(); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) moveJoy(e); });
const endJoy = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; joyEl.firstElementChild.style.transform = ''; };
joyEl.addEventListener('pointerup', endJoy); joyEl.addEventListener('pointercancel', endJoy);
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect(), R = r.width / 2 - 10;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; }
  joy.x = dx / R; joy.y = dy / R;
  joyEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
}

// ───────── 입력 ─────────
$('#act-strike').onclick = strike;
$('#act-finish').onclick = finishBlade;
$('#q-hint').onclick = useHint;
$('#q-go').onclick = confirmWrong;
$('#btn-notes').onclick = () => { if (S.mode === 'idle' || S.mode === 'anvil') { const m = S.mode; S.mode = 'menu'; refresh(); openNotes(() => { S.mode = m; refresh(); }); } };
$('#btn-sound').onclick = () => { sfx.init(); sfx.setMuted(!sfx.muted); $('#btn-sound').textContent = sfx.muted ? '소리 끔' : '소리 켬'; };
$('#btn-qset').onclick = () => openQSet();
$('#btn-notes2').onclick = () => openNotes(updateQInfo);
$('#btn-howto').onclick = () => openHowTo();
$('#opt-timer').checked = settings.timer;
$('#opt-timer').onchange = (e) => { settings.timer = e.target.checked; store.set('jf_settings', settings); };
$('#btn-start').onclick = () => {
  sfx.init(); sfx.play('bell');
  $('#title-screen').classList.add('hidden'); $('#hud').classList.remove('hidden');
  newGame();
};

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (S.mode === 'question') {
    if (/^[1-6]$/.test(k)) { answer(+k - 1); e.preventDefault(); }
    else if ((k === 'Enter' || k === ' ') && Q.pendingWrong) { confirmWrong(); e.preventDefault(); }
    else if (k.toLowerCase() === 'h') useHint();
    return;
  }
  if (!$('#modal').classList.contains('hidden')) return;
  const kl = k.toLowerCase();
  const MOVE = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  if (MOVE.includes(kl) || kl === 'shift') {
    keys.add(kl);
    if (kl.startsWith('arrow')) e.preventDefault();
    if (view === 'anvil' && MOVE.includes(kl) && S.mode === 'anvil') leaveAnvil();
    return;
  }
  if (view === 'walk') {
    if (kl === 'e' || k === 'Enter' || k === ' ') { interact(); e.preventDefault(); }
    return;
  }
  if (view === 'anvil') {
    if (k === ' ') { strike(); e.preventDefault(); }
    else if (kl === 'f') finishBlade();
    else if (k === 'Escape' || kl === 'e') leaveAnvil();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
const canvasEl = $('#scene');
canvasEl.addEventListener('pointerdown', (e) => {
  if (view === 'walk') {
    if (!walkActive()) return;
    if (e.pointerType === 'mouse') { tryLock(); interact(); return; }
    dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    capture(canvasEl, e.pointerId);
    return;
  }
  if (view === 'anvil' && S.mode === 'anvil' && world.pick(e.clientX, e.clientY) === 'anvil') strike();
});
canvasEl.addEventListener('pointermove', (e) => {
  if (dragging && e.pointerId === dragging.id) {
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    dragging.x = e.clientX; dragging.y = e.clientY; dragging.moved += Math.abs(dx) + Math.abs(dy);
    if (walkActive() && !pointerLocked()) look(dx, dy, e.pointerType === 'mouse' ? 0.004 : 0.006);
    return;
  }
  if (view === 'anvil') canvasEl.style.cursor = world.pick(e.clientX, e.clientY) === 'anvil' ? 'pointer' : 'default';
  else canvasEl.style.cursor = walkActive() ? 'none' : 'default';
});
const endDrag = (e) => {
  if (!dragging || e.pointerId !== dragging.id) return;
  // 터치로 짧게 톡 치면 바라보는 대상과 상호작용
  if (e.pointerType !== 'mouse' && dragging.moved < 10 && performance.now() - dragging.t < 300) interact();
  dragging = null;
};
canvasEl.addEventListener('pointerup', endDrag); canvasEl.addEventListener('pointercancel', endDrag);

// ───────── 루프 ─────────
let last = performance.now(), lastBoard = 0, feverWas = false, msgWas = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const gdt = now < hitstopUntil ? 0 : dt;
  updateTweens(gdt);
  // 영감
  const f = feverOn();
  if (f) {
    const left = (S.feverUntil - now) / FEVER_MS;
    $('#fever-bar .fill').style.width = (left * 100) + '%';
    document.documentElement.style.setProperty('--hue', String((now / 6) % 360 | 0));
    if (now - lastBoard > 110) { drawBoard(); lastBoard = now; }
  }
  if (feverWas && !f) { $('#fever-frame').classList.remove('on'); $('#fever-bar').classList.remove('on'); drawBoard(); refresh(); }
  feverWas = f;
  const msg = !!(S.boardMsg && now < S.boardMsg.until);
  if (msgWas && !msg) drawBoard();
  msgWas = msg;
  // 검 발광 (달군 열기, 타격 번쩍임, 영감 무지개)
  const c = S.cur;
  if (c) {
    const m = c.holder.userData.mat;
    c.heat = Math.max(0, c.heat - dt * 0.22); c.flash = Math.max(0, c.flash - gdt);
    const col = m.userData.baseEmissive.clone(); let ei = m.userData.baseEI;
    if (c.heat > 0) { col.lerp(new THREE.Color(1, 0.32, 0.05), Math.min(1, c.heat)); ei = Math.max(ei, c.heat * 2.2); }
    if (f) { col.setHSL((now / 700) % 1, 1, 0.55); ei = 2.4; }
    if (c.flash > 0 || now < hitstopUntil) { col.setRGB(1, 0.95, 0.85); ei = 3.5; }
    m.emissive.copy(col); m.emissiveIntensity = ei;
  }
  if (S.mode === 'title') {
    const t = now / 1000;
    world.tgtPos.set(2.4 + Math.sin(t * 0.1) * 0.8, 2.35, 3.9);
  }
  updateWalk(dt, now);
  world.update(dt, gdt);
  requestAnimationFrame(frame);
}
drawBoard(); drawCalendar(); updateQInfo();
fontsReady.then(() => { drawBoard(); drawCalendar(); });
requestAnimationFrame((t) => { last = t; frame(t); setTimeout(() => { const l = $('#loading'); if (!l) return; l.style.opacity = 0; setTimeout(() => l.remove(), 700); }, 300); });

// 디버그·검증용 (콘솔에서 상태 확인)
window.__forge = {
  get S() { return S; }, world, probs, value, Q,
  // 창이 숨겨져 프레임이 멈출 때 검증용으로 시간을 직접 흘린다
  tick(sec) { for (let i = 0; i < sec * 60; i++) { hitstopUntil = 0; updateTweens(1 / 60); updateWalk(1 / 60, performance.now() + 5000); world.update(1 / 60, 1 / 60); } },
  P, keys, interact, get view() { return view; }, get focus() { return focusInfo; },
};
