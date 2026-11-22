import * as THREE from 'three';
import { World, makeLyingBlade, setLyingBladeLevel, formOf } from './scene.js';
import { Sfx } from './audio.js';
import { SAMPLE_QUESTIONS } from './questions.js';
import { ICONS } from './icons.js';

// ───────── 규칙 데이터 ─────────
const MAX_DAY = 7;
// 원작식 강화: 문제는 망치를 들기 위한 관문일 뿐이고, 결과는 단계별 확률표로만 정해진다.
// 성공 +1, 대성공 +2, 손상 -1. 가치는 1강마다 1.5배. 최대 +100.
const MAX_LV = 100;
const REQ = [1000, 2500, 6000, 15000, 40000, 100000, 250000];
// 상점 가격은 날마다 커지는 수입에 맞춰 함께 오른다
const RELIC_SLOTS = 5;
// 오답 페널티: 틀릴 때마다 검이 식고(CHILL_MAX번이면 화로에 다시 달궈야 두드릴 수 있다), 수업료로 골드가 줄어든다
const CHILL_MAX = 3;
const fineOf = () => Math.round(req() * 0.05 / 10) * 10;
// 골드로 사는 것은 그날 요구 가치에 비례
const priceOf = (k) => Math.max(100, Math.round(REQ[S.day - 1] * ITEMS[k].price / 10) * 10);
// 융합: 짝이 되는 두 유물을 함께 가지면 하나로 합쳐진다(칸 하나가 빈다).
// 첫 번째는 원작 그대로(부러진 성검 + 새벽의 검집 → 여명을 되찾은 성검), 나머지는 지식의 대장간에서 새로 만든 조합.
const FUSIONS = [
  { a: 'quill', b: 'bookmark', into: 'dawnquill', orig: true },
  { a: 'pad', b: 'sharp', into: 'modelnote' },
  { a: 'crack', b: 'redpen', into: 'redrule' },
  { a: 'dict', b: 'sealnote', into: 'encyclo' },
];
const descOf = (k) => {
  let d = ITEMS[k].desc;
  if (k === 'coin') d += ` (오늘은 ${S.day % 2 ? '대성공' : '파괴'})`;
  for (const r of FUSIONS) {
    const other = r.a === k ? r.b : r.b === k ? r.a : null;
    if (other) d += ` ${ITEMS[other].name}과(와) 만나면 ${ITEMS[r.into].name}(으)로 융합한다.`;
  }
  return d;
};
function checkFusion() {
  for (const r of FUSIONS) {
    if (S.relics.has(r.a) && S.relics.has(r.b)) {
      S.relics.delete(r.a); S.relics.delete(r.b); S.relics.add(r.into);
      banner('융합!', `${ITEMS[r.a].name} + ${ITEMS[r.b].name} → ${ITEMS[r.into].name}`);
      sfx.play('milestone'); setTimeout(() => sfx.play('great'), 120);
      world.flashLight(world.merchant.position.clone(), 0xffd27a, 30, 0.8);
      world.spawnSparks(world.merchant.position.clone(), 120, 0xffe08a, { speed: 2.5, up: 2.5, life: 1.2 });
      return true;
    }
  }
  return false;
}
const NAMES = ['녹슨 깃펜칼', '갈아 낸 연필검', '다듬은 잉크검', '공책 철검', '쓸 만한 문법검', '단단한 공식검', '빛나는 개념검', '원리의 장검',
  '통찰의 검', '학자의 대검', '현자의 빛검', '진리의 쌍날검', '만물박사의 검', '별을 읽는 검', '지혜의 성검', '전설의 지식검'];
const BASE_BLANKS = 3;
const FEVER_MS = 6000;
// 원작 ForgeTax 영상에서 읽은 유물·상점 효과를 그대로 옮기고, 이름만 공부 테마로 바꿨다.
// relic: 유물 칸을 차지(검 조각으로 산다) · instant: 사는 즉시 쓰고 칸을 차지하지 않음 · gold: 골드로 사는 것
const ITEMS = {
  pad: { name: '손때 묻은 연습장', short: '성공 확률↑ (유지 확률을 성공으로)', kind: 'relic', cost: 1, icon: '연', desc: '유지 표 2장을 성공 표로 바꾼다.' },
  sharp: { name: '무딘 연필깎이', short: '성공 확률↑ (손상 확률을 성공으로)', kind: 'relic', cost: 1, icon: '깎', desc: '손상 표 1장을 성공 표로 바꾼다.' },
  redpen: { name: '가시 돋친 빨간펜', short: '손상 확률↑ — 손상 유물과 함께 쓰기', kind: 'relic', cost: 2, icon: '펜', desc: '유지 표 2장을 손상 표로 바꾼다. 손상과 엮이는 유물과 함께 쓴다.' },
  sealnote: { name: '봉인된 복습 노트', short: '유지 확률↑ · 두 번 연속 유지하면 +1강', kind: 'relic', cost: 1, icon: '봉', desc: '유지 표 +2장. 유지 2연속마다 +1강.' },
  crack: { name: '금 간 책받침', short: '손상당할수록 파괴 확률↓ (최대 60%)', kind: 'relic', cost: 2, icon: '받', desc: '손상마다 이 검의 파괴 확률 15% 감소, 최대 60%.' },
  echo: { name: '메아리 치는 종', short: '성공하면 30% 확률로 1강 더', kind: 'relic', cost: 2, icon: '종', desc: '성공·대성공마다 30% 확률로 추가 +1강.' },
  worm: { name: '굶주린 책벌레', short: '+4강 이상이 부서지면 다음 검 성공 확률 크게↑', kind: 'relic', cost: 1, icon: '벌', desc: '+4강 이상 검이 파괴되면 다음 +0강 검에 성공 표 +6장. 그 검에 계속 적용.' },
  dict: { name: '묵직한 사전', short: '유지 직후 한 번, 파괴 확률 35%↓', kind: 'relic', cost: 1, icon: '사', desc: '유지하면 다음 타격의 파괴 확률 35% 감소.' },
  sheet: { name: '세 번 고친 답안지', short: '대성공 직후 파괴 확률 40%↓', kind: 'relic', cost: 2, icon: '답', desc: '대성공 후 파괴 확률 40% 감소. 연속 대성공마다 10% 추가 감소, 최대 60%. 다른 결과가 나오면 초기화.' },
  stamp: { name: '패자의 오답 도장', short: '손상당할 때마다 다음 대성공이 1강 더', kind: 'relic', cost: 2, icon: '도', desc: '손상마다 다음 대성공의 추가 강화 +1. 모인 추가 강화가 10 이상이면 이 검의 대성공 표 +4장.' },
  coin: { name: '양면 동전', short: '버리는 순간 다음 타격 결과가 정해짐', kind: 'relic', cost: 1, icon: '동', desc: '이 유물을 버리면 다음 타격이 정해진다. 홀수 날은 대성공, 짝수 날은 파괴.' },
  bellows: { name: '들뜬 풀무', short: '영감(파괴 없는 시간) 25% 길게', kind: 'relic', cost: 2, icon: '풀', desc: '영감 시간 +25%.' },
  ink: { name: '마르지 않는 잉크병', short: '유지 확률↑ · 유지 5번마다 파괴 1번 막아 줌', kind: 'relic', cost: 4, icon: '잉', desc: '유지 표 +2장. 유지 5회마다 다음 파괴 1회를 유지로 바꾸는 보호가 생긴다(이 검에 2회까지 저장).' },
  contract: { name: '평생 학습 계약서', short: '파괴 확률↓ · 서고지기 요구 30%↓', kind: 'relic', cost: 5, icon: '계', desc: '파괴 표 −1장. 서고지기의 요구 가치 30% 감소.' },
  cocoon: { name: '부화 직전의 원석 알', short: '2일 뒤 원석 3개로 부화', kind: 'relic', cost: 1, icon: '알', desc: '2일 뒤 원석 3개를 주고 사라진다.' },
  bookmark: { name: '새벽의 책갈피', short: '부서지면 강화의 40%를 다음 검이 물려받음', kind: 'relic', cost: 3, icon: '갈', desc: '검이 파괴되면 그 강화의 40%를 다음 +0강 검이 물려받고, 영감 4칸이 찬다.' },
  quill: { name: '부러진 깃펜', short: '부서지면 강화의 30%를 다음 검이 물려받음', kind: 'relic', cost: 1, icon: '깃', desc: '검이 파괴되면 그 강화의 30%를 다음 +0강 검이 물려받고, 영감 3칸이 찬다.' },
  weight: { name: '기다림의 추', short: '손상 확률↓ · 유지 확률↑', kind: 'relic', cost: 1, icon: '기', desc: '손상 표 −2장, 유지 표 +3장.' },
  hoop: { name: '튼튼한 책 고리', short: '파괴 확률 크게↓', kind: 'relic', cost: 3, icon: '고', desc: '파괴 표 −2장.' },
  twin: { name: '쌍둥이 도장', short: '검을 완성할 때 2% 확률로 한 자루 더', kind: 'relic', cost: 4, icon: '쌍', desc: '검을 완성해 걸 때 2% 확률로 똑같은 검이 한 자루 더 생긴다.' },
  // 융합으로만 얻는 유물 (상점에 나오지 않는다)
  dawnquill: { name: '새벽을 되찾은 깃펜', short: '부서지면 70%를 물려받고, 물려받은 검은 파괴↓', kind: 'relic', fused: true, cost: 0, icon: '새', desc: '검이 파괴되면 그 강화의 70%를 다음 +0강 검이 물려받고, 영감 7칸이 찬다. 물려받은 검의 파괴 확률은 부서진 검 1강마다 1.5% 줄어든다(최대 50%).' },
  modelnote: { name: '모범 답안 노트', short: '성공·대성공 확률↑ · 유지·손상 확률↓', kind: 'relic', fused: true, cost: 0, icon: '모', desc: '유지 표 2장과 손상 표 1장을 성공 표로 바꾸고, 대성공 표 +1장.' },
  redrule: { name: '빨간 줄 책받침', short: '손상 확률↑ · 손상당할수록 파괴↓ (최대 80%)', kind: 'relic', fused: true, cost: 0, icon: '줄', desc: '유지 표 2장을 손상 표로 바꾼다. 손상마다 이 검의 파괴 확률 20% 감소, 최대 80%.' },
  encyclo: { name: '봉인된 백과사전', short: '유지 확률↑ · 유지 직후 파괴 60%↓ · 2연속 유지 +1강', kind: 'relic', fused: true, cost: 0, icon: '백', desc: '유지 표 +2장. 유지하면 다음 타격의 파괴 확률 60% 감소. 유지 2연속마다 +1강.' },
  glasses: { name: '지혜의 안경', short: '문제마다 틀린 보기 1개를 흐리게', kind: 'relic', cost: 2, icon: '안', desc: '문제마다 오답 보기 하나가 흐려진다.' },
  tape: { name: '운명을 고치는 수정테이프', short: '사자마자 손상 확률↓ (칸 안 차지)', kind: 'instant', cost: 2, icon: '테', desc: '사는 즉시 이번 판의 손상 표 1장을 없앤다. 유물 칸을 차지하지 않는다.' },
  ticket: { name: '합격 추첨표', short: '이번 판 성공 확률↑ · 들를 때마다 1번', kind: 'gold', price: 0.6, icon: '추', desc: '이번 판의 성공 표 +1장. 유물 칸을 차지하지 않는다. 상인 방문마다 한 번만 살 수 있다.' },
  hint: { name: '힌트 두루마리', short: '문제 하나에서 틀린 보기 2개를 지움', kind: 'gold', price: 0.25, icon: '두', desc: '문제 하나에서 오답 보기 2개를 지운다.' },
  candle: { name: '새 양초', short: '꺼진 촛불 1개를 다시 켬', kind: 'gold', price: 1.5, icon: '초', desc: '꺼진 촛불 하나를 다시 켠다.' },

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
// 2022 개정 교육과정 문제 은행 (data/q/{초e·중m}{학년}-{학기}-{과목}.json)
const GRADES = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3'];
const SUBJ = { kor: '국어', math: '수학', soc: '사회', sci: '과학', eng: '영어' };
const subjectsOf = (g) => g.startsWith('중') ? ['soc', 'sci', 'eng'] : (g === '초1' || g === '초2') ? ['kor', 'math'] : ['kor', 'math', 'soc', 'sci', 'eng'];
const bankCode = (g, sem, sub) => `${g.startsWith('중') ? 'm' : 'e'}${g.slice(1)}-${sem}-${sub}`;
const SEL = Object.assign({ grade: '초5', sem: 1, subjs: ['sci'], custom: false }, store.get('jf_sel', {}));
// 예전 저장값(과목 하나)도 이어 쓴다
if (!Array.isArray(SEL.subjs)) SEL.subjs = SEL.subj ? [SEL.subj] : ['sci'];
delete SEL.subj;
const subjLabel = () => SEL.subjs.map((k) => SUBJ[k]).join('·');
let COURSE = '';
let WRONGS = store.get('jf_wrongs', {});
const settings = store.get('jf_settings', { timer: false, reviewOnly: false });

// ───────── 유틸 ─────────
const $ = (s) => document.querySelector(s);
const UNITS = [['해', 1e20], ['경', 1e16], ['조', 1e12], ['억', 1e8]];
const fmt = (n) => {
  for (const [u, v] of UNITS) if (n >= v) { const x = n / v; return (x >= 1e4 ? Math.round(x).toLocaleString('ko-KR') : x >= 100 ? x.toFixed(1) : x.toFixed(2)) + u; }
  return Math.round(n).toLocaleString('ko-KR');
};
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
    tokens: 0, deck: { succ: 0, great: 0, keep: 0, dmg: 0, brk: 0 }, rs: {}, ticketBought: false, feverDur: FEVER_MS,
    stats: { answered: 0, correct: 0, best: 0, broken: 0, made: 0, offered: 0 },
    sessionWrong: new Set(), recent: [], history: {}, mode: 'title', boardMsg: null,
    offers: [], rerollCost: 200,
  };
}
S = freshState();

const feverOn = () => S.feverUntil > performance.now();
const value = (lv) => Math.round(100 * Math.pow(1.5, Math.min(lv, MAX_LV)) / 10) * 10;
const bladeName = (lv) => NAMES[formOf(lv)];
const req = () => Math.round(REQ[S.day - 1] * (S.relics.has('contract') ? 0.7 : 1) / 10) * 10;

// 원작 영상에서 읽은 값: +2 파괴 4.1·손상 3.7·성공 55.3·대성공 7.4 / +3 7.0·3.4·55.1·6.9 / +4 14.1·3.2·50.9·6.4
// +6 21.3·3.0·45.4·6.1 / +21 파괴 14.7 / +28 11.5 / +76 6.8 / +218 6.5. 손상은 +10 이후 15% 안팎, 유지는 25% 안팎.
// 원작은 결과를 '표' 더미에서 뽑는다. 기본 더미는 위 확률이 나오도록 정했다(성공 15·대성공 2·유지 7·손상 1·파괴 단계별).
const ZERO = { great: 0, succ: 0, keep: 0, dmg: 0, brk: 0 };
function deckOf(level, fever, c) {
  const lv = level;
  const d = {
    brk: lv <= 6 ? [0, 1, 1, 2, 4, 5, 6][lv] : Math.max(2, 6 - Math.floor((lv - 6) / 8)),
    dmg: lv === 0 ? 0 : lv <= 6 ? 1 : lv <= 9 ? [2, 3, 3][lv - 7] : 5,
    keep: 7, succ: 15,
    great: lv <= 6 ? 2 : lv <= 40 ? 4 : lv <= 70 ? 3 : 2,
  };
  const move = (from, to, n) => { const m = Math.min(n, d[from]); d[from] -= m; d[to] += m; };
  const R = (k) => S.relics.has(k);
  if (R('pad')) move('keep', 'succ', 2);
  if (R('sharp')) move('dmg', 'succ', 1);
  if (R('modelnote')) { move('keep', 'succ', 2); move('dmg', 'succ', 1); d.great += 1; }
  if (R('redpen') || R('redrule')) move('keep', 'dmg', 2);
  if (R('sealnote') || R('encyclo')) d.keep += 2;
  if (R('weight')) { d.dmg = Math.max(0, d.dmg - 2); d.keep += 3; }
  if (R('hoop')) d.brk = Math.max(0, d.brk - 2);
  if (R('ink')) d.keep += 2;
  if (R('contract')) d.brk = Math.max(0, d.brk - 1);
  for (const k in S.deck) d[k] = Math.max(0, d[k] + S.deck[k]);   // 이번 판 표
  if (c && c.deck) for (const k in c.deck) d[k] = Math.max(0, d[k] + c.deck[k]); // 이 검 표
  if (lv === 0) { d.keep += d.dmg; d.dmg = 0; }
  if (fever) d.brk = 0; // 영감(원작의 신들림): 파괴 없음
  return d;
}
// 파괴 확률을 비율로 줄이는 효과 (줄어든 몫은 유지로)
function brkCut(c) {
  if (!c) return 0;
  let k = 1;
  if (c.crack) k *= 1 - c.crack;
  if (c.dictNext) k *= 1 - c.dictNext;
  if (c.crown) k *= 1 - c.crown;
  if (c.inheritCut) k *= 1 - c.inheritCut;
  return 1 - k;
}
function probs(level, fever, c = S.cur) {
  if (level >= MAX_LV) return { ...ZERO, keep: 100 };
  if (c && c.forced) return { ...ZERO, [c.forced]: 100 };
  const d = deckOf(level, fever, c), tot = d.brk + d.dmg + d.keep + d.succ + d.great;
  const p = {}; for (const k in d) p[k] = d[k] / tot * 100;
  const cut = p.brk * brkCut(c); p.brk -= cut; p.keep += cut;
  return p;
}
function roll(p) {
  let r = Math.random() * 100;
  for (const k of ['brk', 'dmg', 'keep', 'succ', 'great']) { if (r < p[k]) return k; r -= p[k]; }
  return 'keep';
}
const pct = (v) => (v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)) + '%';

// ───────── 전광판 / 달력 ─────────
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
// 전광판 둘째 줄: 검의 열기
function chillNote(c) {
  const ch = c.chill || 0;
  if (ch >= CHILL_MAX) return '검이 식음 · R 다시 달구기';
  return `열기 ${'●'.repeat(CHILL_MAX - ch)}${'○'.repeat(ch)}`;
}
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
  const delta = (k) => k === 'succ' ? ' +1' : k === 'great' ? ' +2' : k === 'dmg' ? ' −1' : '';
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
        g.fillText(`${OUT[k].label}${delta(k)} ${pct(p[k])}`, x + w / 2, y + 44);
      } else if (w > 56) {
        g.fillStyle = '#0b0806'; g.textAlign = 'center'; g.font = '900 24px "Noto Sans KR", sans-serif';
        g.fillText(pct(p[k]), x + w / 2, y + 42);
      }
      x += w;
    }
    g.restore();
  };
  const maxed = c.level >= MAX_LV;
  row('확률', probs(c.level, fever), ['brk', 'dmg', 'keep', 'succ', 'great'], 262, maxed ? '최대 강화 · 더는 오르지 않는다' : null);
  row('', null, [], 362, maxed ? '검 완성(F)으로 걸어 두자' : fever ? '영감! 문제 없이 연타 · 파괴 0%' : chillNote(c));
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
    // 칸이 좁으니 만 단위로 짧게 (계약서 유물이 있으면 줄어든 값)
    const rq = Math.round(REQ[d - 1] * (S.relics.has('contract') ? 0.7 : 1) / 10) * 10;
    const short = rq >= 10000 ? `${+(rq / 10000).toFixed(1)}만` : rq.toLocaleString('ko-KR');
    g.font = '700 26px "Noto Sans KR", sans-serif'; g.fillStyle = '#5a3a20'; g.fillText(short, x + cw / 2, y0 + 176);
    g.font = '500 18px "Noto Sans KR", sans-serif'; g.fillText('G', x + cw / 2, y0 + 200);
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
  queueSave();
  $('#hud-day').textContent = S.day; $('#hud-maxday').textContent = MAX_DAY;
  // 오늘의 요구: 걸어 둔 검(+고철)으로 얼마나 채웠는지
  const need = req(), have = S.finished.reduce((t, b) => t + value(b.level), 0) + (S.scrap || 0), full = have >= need;
  $('#hud-req').textContent = `${fmt(need)} G`;
  $('#hud-reqbar').style.width = Math.min(100, have / need * 100) + '%';
  $('#hud-reqsub').textContent = full ? `걸어 둔 검 ${fmt(have)} G · 채웠다! 제단으로` : `걸어 둔 검 ${fmt(have)} G · ${fmt(need - have)} G 더`;
  if (full && !$('#reqbox').classList.contains('full')) { $('#reqbox').classList.add('full'); }
  else if (!full) $('#reqbox').classList.remove('full');
  // 걸어 다닐 때는 위 가운데에 크게, 모루 앞(전광판이 위 가운데를 씀)에서는 왼쪽 위 패널 아래에 작게 붙인다
  const inPlay = ['idle', 'anvil', 'menu', 'question', 'striking', 'moving', 'paused'].includes(S.mode);
  $('#reqbox').classList.toggle('hidden', !inPlay);
  $('#reqbox').classList.toggle('dock', view !== 'walk');
  // 왼쪽 위 패널 높이가 상황마다 달라서 그 바로 아래에 붙인다
  const tlEl = document.querySelector('.hud-tl');
  $('#reqbox').style.top = view !== 'walk' && tlEl ? (tlEl.getBoundingClientRect().bottom + 8) + 'px' : '';
  $('#hud-candles').innerHTML = [0, 1, 2].map(i => `<div class="candle-ico ${i < S.candles ? '' : 'out'}"></div>`).join('');
  $('#hud-gold').textContent = fmt(S.gold);
  $('#hud-blanks').textContent = S.blanks;
  $('#hud-fin').textContent = S.finished.length;
  $('#hud-acc').textContent = S.stats.answered ? Math.round(S.stats.correct / S.stats.answered * 100) + '%' : '-';
  // 유물/소모품
  const rel = [...S.relics].map(k => badge(k));
  if (S.items.hint > 0) rel.push(badge('hint', S.items.hint));
  if (S.deck.succ || S.deck.dmg) rel.push(`<div class="relic item">표<div class="tip"><b>이번 판 표</b>${S.deck.succ ? `성공 표 +${S.deck.succ}장 ` : ''}${S.deck.dmg ? `손상 표 ${S.deck.dmg}장` : ''}</div></div>`);
  if (S.scrap > 0) rel.push(`<div class="relic item">철<span class="cnt">${fmt(S.scrap)}</span><div class="tip"><b>모아 둔 고철</b>제단에 함께 바칠 수 있다.</div></div>`);
  $('#hud-relics').innerHTML = rel.join('');
  document.querySelectorAll('#hud-relics [data-relic]').forEach(el => el.onclick = () => discardRelic(el.dataset.relic));
  // 행동 버튼
  const m = S.mode, canAct = m === 'idle' || m === 'anvil';
  const atAnvil = view === 'anvil' && m === 'anvil' && !!S.cur, walk = view === 'walk' && canAct;
  $('#actions').classList.toggle('hidden', !atAnvil);
  $('#act-strike').innerHTML = feverOn() ? '<kbd>Space</kbd>연타!' : '<kbd>Space</kbd>망치질';
  let hint = '';
  if (walk) {
    const goal = S.cur ? '모루에 벼리던 검이 있어요' : S.blanks > 0 ? '원석 상자에서 원석을 꺼내세요' : '원석을 다 썼어요 · 검을 제단에 바치세요';
    hint = (IS_TOUCH ? '조이스틱 이동 · 끌어서 둘러보기 · 톡 상호작용' : 'WASD 이동 · 마우스로 둘러보기 · E/클릭 상호작용') + ` — ${goal}`;
  } else if (atAnvil) hint = feverOn() ? '영감! 문제 없이 마구 두드리세요' : (S.cur.chill || 0) >= CHILL_MAX ? '검이 식었어요 · R로 화로에 다시 달구세요' : '맞히면 한 번 두드립니다 · 틀리면 검이 식고 수업료를 냅니다';
  $('#act-reheat').classList.toggle('hidden', !(atAnvil && (S.cur.chill || 0) > 0));
  $('#act-strike').classList.toggle('dimmed', !!(atAnvil && (S.cur.chill || 0) >= CHILL_MAX && !feverOn()));
  $('#hud-hint').textContent = hint;
  $('#hud-hint').classList.toggle('hidden', !(walk || atAnvil));
  $('#crosshair').classList.toggle('hidden', !walk);
  $('#joy').classList.toggle('hidden', !(walk && IS_TOUCH));
  if (!walk) $('#prompt').classList.add('hidden');
  world.setOreCount(Math.min(8, S.blanks));
}
function badge(k, cnt) {
  const it = ITEMS[k], relic = it.kind === 'relic';
  return `<div class="relic ${relic ? '' : 'item'}" ${relic ? `data-relic="${k}"` : ''}>${ICONS[k] || it.icon}${cnt ? `<span class="cnt">${cnt}</span>` : ''}<div class="tip"><b>${it.name}</b>${descOf(k)}${relic ? '<br><small>눌러서 버리기</small>' : ''}</div></div>`;
}
function discardRelic(k) {
  if (!S.relics.has(k) || !(S.mode === 'idle' || S.mode === 'anvil' || S.mode === 'shop')) return;
  if (!confirm(`${ITEMS[k].name}을(를) 버릴까요?${k === 'coin' ? ` 다음 타격이 ${S.day % 2 ? '대성공' : '파괴'}으로 정해집니다.` : ''}`)) return;
  S.relics.delete(k); sfx.play('ui');
  if (k === 'coin') { const r = S.day % 2 ? 'great' : 'brk'; if (S.cur) S.cur.forced = r; else S.rs.forced = r; }
  drawBoard(); refresh(); if (S.mode === 'shop') renderShop();
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
  const p = probs(S.cur.level, false);
  $('#q-risk').innerHTML = `+${S.cur.level} · 파괴 <b>${pct(p.brk)}</b> · 성공 <b>${pct(p.succ + p.great)}</b>`;
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
    S.gauge = Math.min(10, S.gauge + 1);
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
    const fine = Math.min(S.gold, fineOf());
    if (fine > 0) { S.gold -= fine; setTimeout(() => popup(`수업료 −${fmt(fine)} G`, world.toScreen(world.impactPoint.clone().add(new THREE.Vector3(0, 0.55, 0))), 'sm gold'), 200); }
    let chillMsg = '';
    if (S.cur) {
      S.cur.chill = Math.min(CHILL_MAX, (S.cur.chill || 0) + 1);
      chillMsg = S.cur.chill >= CHILL_MAX ? '<span class="warn">검이 식음 · R 다시 달구기</span>' : `<span>열기 ${'●'.repeat(CHILL_MAX - S.cur.chill)}${'○'.repeat(S.cur.chill)}</span>`;
    }
    sfx.play('wrong');
    ex.className = 'q-explain';
    ex.innerHTML = `${i < 0 ? '<b>시간 초과!</b> ' : ''}정답은 <b>${esc(q.c[q.a])}</b>${q.e ? ` — ${esc(q.e)}` : ''}<div class="pills" style="margin-top:8px"><span>헛손질</span>${fine > 0 ? `<span>수업료 −${fmt(fine)} G</span>` : ''}${chillMsg}<span>오답 노트 +1</span></div>`;
    $('#q-go').classList.remove('hidden');
    Q.pendingWrong = true;
    drawBoard(); refresh();
  }
}
function confirmWrong() {
  if (!Q.pendingWrong) return;
  Q.pendingWrong = false; closeCard();
  S.mode = 'anvil'; refresh(); drawBoard();
  popup('헛손질', world.impactPoint.clone().add(new THREE.Vector3(0, 0.35, 0)), 'mid keep');
}
function closeCard() { $('#qcard').classList.add('hidden'); }

// ───────── 대장간 흐름 ─────────
async function takeBlank() {
  if (S.mode !== 'idle' || S.cur || S.blanks <= 0) return;
  sfx.init(); S.blanks--; S.mode = 'moving'; view = 'cine'; refresh();
  const startLv = Math.min(MAX_LV, S.rs.inherit || 0);
  const holder = makeLyingBlade(startLv);
  const car = new THREE.Group(); car.add(holder); car.position.copy(world.cratePos);
  world.scene.add(car);
  S.cur = { level: startLv, holder, car, heat: 0, flash: 0, maxValue: value(startLv), deck: { ...ZERO } };
  if (S.rs.worm) { S.cur.deck.succ += 6; S.rs.worm = false; banner('굶주린 책벌레', '이 검의 성공 표 +6장'); }
  if (S.rs.inherit) {
    S.gauge = Math.min(10, S.gauge + (S.rs.inheritBars || 4)); if (S.gauge >= 10) S.feverPending = true;
    if (S.rs.inheritCut) S.cur.inheritCut = S.rs.inheritCut;
    banner(ITEMS[S.rs.inheritFrom || 'bookmark'].name, `부서진 검의 강화를 물려받아 +${startLv}에서 시작${S.rs.inheritCut ? ` · 파괴 확률 −${Math.round(S.rs.inheritCut * 100)}%` : ''}`);
    S.rs.inherit = 0; S.rs.inheritCut = 0;
  }
  if (S.rs.forced) { S.cur.forced = S.rs.forced; S.rs.forced = null; }
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
  if (S.feverPending) { S.feverPending = false; startFever(); }
}

function strike() {
  if (S.mode !== 'anvil' || !S.cur) return;
  sfx.init();
  if (S.cur.level >= MAX_LV) { popup('최대 강화! 검 완성(F)', world.impactPoint.clone().add(new THREE.Vector3(0, 0.4, 0)), 'mid gold'); sfx.play('ui'); return; }
  if ((S.cur.chill || 0) >= CHILL_MAX && !feverOn()) { popup('검이 식었다! 다시 달구기(R)', world.impactPoint.clone().add(new THREE.Vector3(0, 0.4, 0)), 'mid keep'); sfx.play('dull'); return; }
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
  let out = roll(probs(c.level, fever));
  c.forced = null; c.dictNext = false;
  let charm = false; const notes = [];
  if (out === 'brk' && c.guard > 0) { c.guard--; out = 'keep'; charm = true; }
  if (out === 'brk' && S.items.charm > 0) { S.items.charm--; out = 'keep'; charm = true; }
  const before = c.level, beforeVal = value(before);
  const R = (k) => S.relics.has(k);
  let extra = 0;
  if (out === 'great' && c.loser) { extra += c.loser; notes.push(`오답 도장 +${c.loser}`); c.loser = 0; }
  if ((out === 'succ' || out === 'great') && R('echo') && Math.random() < 0.3) { extra += 1; notes.push('메아리 +1'); }
  if (out === 'great') c.level = Math.min(MAX_LV, c.level + 2 + extra);
  else if (out === 'succ') c.level = Math.min(MAX_LV, c.level + 1 + extra);
  else if (out === 'dmg') c.level = Math.max(0, c.level - 1);
  if (out === 'keep') {
    c.keepRun = (c.keepRun || 0) + 1;
    if ((R('sealnote') || R('encyclo')) && c.keepRun % 2 === 0 && c.level < MAX_LV) { c.level++; notes.push('복습 노트 +1'); }
    if (R('encyclo')) c.dictNext = 0.6; else if (R('dict')) c.dictNext = 0.35;
    if (R('ink')) { c.inkKeeps = (c.inkKeeps || 0) + 1; if (c.inkKeeps % 5 === 0 && (c.guard || 0) < 2) { c.guard = (c.guard || 0) + 1; notes.push('보호 +1'); } }
  } else c.keepRun = 0;
  if (R('sheet')) c.crown = out === 'great' ? (c.crown ? Math.min(0.6, c.crown + 0.1) : 0.4) : 0;
  if (out === 'dmg') {
    if (R('redrule')) c.crack = Math.min(0.8, (c.crack || 0) + 0.2);
    else if (R('crack')) c.crack = Math.min(0.6, (c.crack || 0) + 0.15);
    if (R('stamp')) { c.loser = (c.loser || 0) + 1; if (c.loser >= 10 && !c.stampDone) { c.stampDone = true; c.deck.great += 4; notes.push('대성공 표 +4'); } }
  }
  if (out === 'brk') {
    if (R('worm') && before >= 4) { S.rs.worm = true; notes.push('책벌레가 다음 검을 기다린다'); }
    // 계승: 가진 것 중 가장 센 것 하나
    const inh = R('dawnquill') ? [0.7, 7, 'dawnquill'] : R('bookmark') ? [0.4, 4, 'bookmark'] : R('quill') ? [0.3, 3, 'quill'] : null;
    if (inh && before > 0) {
      S.rs.inherit = Math.floor(before * inh[0]); S.rs.inheritBars = inh[1]; S.rs.inheritFrom = inh[2];
      S.rs.inheritCut = inh[2] === 'dawnquill' ? Math.min(0.5, before * 0.015) : 0;
      notes.push(`${ITEMS[inh[2]].name}: 다음 검 +${S.rs.inherit}`);
    }
  }
  if (notes.length) setTimeout(() => popup(notes.join(' · '), world.toScreen(world.impactPoint.clone().add(new THREE.Vector3(0, -0.18, 0))), 'sm cyan'), 260);
  const ip = world.impactPoint, fx = fever ? FX.fever : FX[out];
  hitstop(fx.stop);
  world.shake(fx.shake);
  sfx.play(fever ? 'feverHit' : out === 'succ' ? 'clang' : out === 'great' ? 'great' : out === 'keep' ? 'dull' : out === 'dmg' ? 'crack' : 'shatter');
  const above = ip.clone().add(new THREE.Vector3(0, 0.32, 0));
  if (out === 'brk') {
    world.spawnShards(c.holder, OUT.brk.hex);
    world.scene.remove(c.car);
    const lost = Math.max(c.maxValue, beforeVal);
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
      // 돌파: +100은 최종, +25·50·75를 넘으면 번개, 모양이 바뀌면 금빛
      const tier = !up ? 0 : c.level >= MAX_LV ? 3 : Math.floor(c.level / 25) > Math.floor(before / 25) ? 2 : formOf(c.level) !== formOf(before) ? 1 : 0;
      if (tier) breakthrough(c.level, tier, formOf(c.level) !== formOf(before));
      else if (up) {
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
    const label = charm ? '보호가 막았다!' : OUT[out].label + (out === 'succ' || out === 'great' ? ` +${c.level - before}` : out === 'dmg' && before > 0 ? ` −${before - c.level}` : '');
    popup(fever ? `+${c.level - before}` : label, above, `${fever ? 'mid' : fx.size} ${charm ? 'cyan' : out}`);
    const dv = value(c.level) - beforeVal;
    if (dv !== 0) {
      const sp = world.toScreen(above);
      setTimeout(() => popup(`${dv > 0 ? '+' : '−'}${fmt(Math.abs(dv))} G`, { x: sp.x + 150, y: sp.y + 30 }, 'sm gold'), 90);
    }
  }
  drawBoard(); refresh();
}

// 화면 전체를 한 번 번쩍인다
function screenFlash(bg, dur, delay = 0) {
  setTimeout(() => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:14;background:${bg}`;
    document.body.appendChild(d);
    d.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => d.remove();
  }, delay);
}
// 돌파 연출. tier 1: 모양이 바뀔 때 금빛 기둥과 충격파, 2: +25·50·75 번개, 3: +100 최종
function breakthrough(lv, tier, newForm) {
  const ip = world.impactPoint, top = world.anvilTop.clone();
  const main = tier === 1 ? 0xffc85a : 0x8fe0ff;
  if (tier >= 2) {
    world.dim = 1;
    world.lightning(ip.clone().add(new THREE.Vector3(0, 0.05, 0)), { flicks: tier === 3 ? 6 : 4, life: tier === 3 ? 1.0 : 0.7, branches: tier === 3 ? 5 : 3 });
    world.flashLight(ip.clone().add(new THREE.Vector3(0, 1.4, 0.4)), 0xa8d4ff, tier === 3 ? 110 : 80, 0.75);
    screenFlash('radial-gradient(ellipse at 50% 60%, rgba(240,248,255,.98), rgba(150,200,255,.75))', 380);
    screenFlash('rgba(200,230,255,.6)', 260, 150);
    if (tier === 3) screenFlash('rgba(255,250,235,.7)', 500, 420);
    sfx.play('thunder');
    world.shake(tier === 3 ? 0.2 : 0.15);
    setTimeout(() => world.shake(0.07), 200);
    world.spawnSparks(ip, 160, 0xa8e8ff, { speed: 5.5, up: 3.2, life: 1.1, mul: 5 });
  } else {
    world.flashLight(ip.clone().add(new THREE.Vector3(0, 1.0, 0.4)), 0xffc870, 45, 0.8);
    screenFlash('radial-gradient(ellipse at 50% 62%, rgba(255,236,170,.85), rgba(255,170,60,.35))', 500);
  }
  hitstop(tier === 1 ? 210 : tier === 2 ? 300 : 380);
  world.shake(0.1);
  world.shockRing(top.clone().add(new THREE.Vector3(0, 0.02, 0)), main, 1.9, 0.75);
  world.shockRing(new THREE.Vector3(top.x, 0.03, top.z), tier === 1 ? 0xffe2a0 : 0xd8f4ff, 3.4, 1.1, 0.05);
  if (tier >= 2) setTimeout(() => world.shockRing(new THREE.Vector3(top.x, 0.03, top.z), 0x6fc8ff, 4.2, 1.2, 0.04), 160);
  world.lightPillar(new THREE.Vector3(top.x, 0.9, top.z), main, tier === 3 ? 1.8 : 1.3, tier === 3 ? 0.2 : 0.14);
  world.spawnSparks(ip, 180, 0xffe08a, { speed: 4.5, up: 4.2, life: 1.4, mul: 4 });
  world.spawnSparks(ip, 60, 0xffffff, { speed: 2.2, up: 5, life: 1.6, mul: 5, spread: 0.4 });
  sfx.play('milestone'); setTimeout(() => sfx.play('great'), 120);
  banner(tier === 3 ? '+100 완성!' : newForm ? bladeName(lv) : `+${lv} 돌파!`, tier === 3 ? bladeName(lv) + ' · 더는 오를 곳이 없다' : newForm ? `+${lv} · 새로운 모양` : bladeName(lv));
}

function startFever() {
  S.gauge = 0;
  S.feverDur = FEVER_MS * (S.relics.has('bellows') ? 1.25 : 1);
  S.feverUntil = performance.now() + S.feverDur;
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
  S.finished.push(hungState(c));
  if (S.relics.has('twin') && Math.random() < 0.02 && S.finished.length < 8) { S.finished.push(hungState(c)); setTimeout(() => banner('쌍둥이 도장', `${bladeName(c.level)} +${c.level}이(가) 한 자루 더!`), 400); }
  if (!c.wasHung) S.stats.made++;
  S.cur = null;
  world.setRack(S.finished); sfx.play('place');
  await wait(0.5);
  S.mode = 'idle'; drawBoard();
  placePlayer(2.4, 0.2, -Math.PI / 2, 0.12); enterWalk(); // 검걸이 앞에서 걸어 둔 검을 바라본다
}

// 검걸이에 걸 때 이 검의 표·유물 누적 효과도 함께 보관한다 (다시 가져와 이어서 벼릴 수 있게)
const KEEP_FIELDS = ['deck', 'crack', 'guard', 'loser', 'stampDone', 'keepRun', 'inkKeeps', 'crown', 'inheritCut'];
function hungState(c) {
  const o = { level: c.level };
  for (const k of KEEP_FIELDS) if (c[k] !== undefined) o[k] = k === 'deck' ? { ...c[k] } : c[k];
  return o;
}
// 걸어 둔 검을 다시 모루로
function openRackPicker() {
  if (S.mode !== 'idle' || S.cur || !S.finished.length) return;
  S.mode = 'menu'; refresh();
  openPanel(`<h2>걸어 둔 검</h2><div class="pills"><span>이어서 강화</span><span>쌓인 효과 유지</span><span class="warn">부서질 수 있음</span></div>
    <div class="offer-list">${S.finished.map((b, i) => `<div class="offer"><span class="nm">${esc(bladeName(b.level))} <b>+${b.level}</b><small>${fmt(value(b.level))} G</small></span><button class="primary small" data-take="${i}">모루로</button></div>`).join('')}</div>
    <div class="btnrow"><button id="rk-close" class="ghost">닫기</button></div>`, true);
  document.querySelectorAll('[data-take]').forEach(b => b.onclick = () => { closeModal(); takeFromRack(+b.dataset.take); });
  $('#rk-close').onclick = () => { closeModal(); S.mode = 'idle'; refresh(); };
}
async function takeFromRack(i) {
  const b = S.finished[i]; if (!b || S.cur) { S.mode = 'idle'; refresh(); return; }
  S.finished.splice(i, 1); world.setRack(S.finished);
  sfx.init(); S.mode = 'moving'; view = 'cine'; refresh();
  const holder = makeLyingBlade(b.level);
  const car = new THREE.Group(); car.add(holder);
  const slot = world.rackSlots[Math.min(i, 7)];
  car.position.set(slot.x - 0.3, 2.3, slot.z); car.rotation.z = 0.8;
  world.scene.add(car);
  S.cur = { ...b, deck: b.deck ? { ...b.deck } : { ...ZERO }, holder, car, heat: 0.5, flash: 0, maxValue: value(b.level), wasHung: true };
  drawBoard();
  world.goStation('anvil', 2.6); sfx.play('whoosh');
  const a = car.position.clone(), c = world.anvilTop.clone();
  await wait(0.9, k => { const e = easeInOut(k); car.position.lerpVectors(a, c, e); car.position.y += Math.sin(k * Math.PI) * 0.5; car.rotation.z = 0.8 * (1 - e); });
  sfx.play('place'); world.shake(0.012); world.spawnSparks(c, 12, 0xff9a40, { speed: 1.4, up: 1 });
  popup(`${bladeName(S.cur.level)} +${S.cur.level} · 다시 벼린다`, world.impactPoint.clone().add(new THREE.Vector3(0, 0.45, 0)), 'mid gold');
  S.mode = 'anvil'; view = 'anvil'; drawBoard(); refresh();
}

// ───────── 제단 ─────────
function openAltar() {
  if (S.mode !== 'idle' && S.mode !== 'anvil') return;
  sfx.init(); S.feverUntil = 0;
  S.mode = 'altar'; refresh();
  world.goStation('altar', 2.4);
  // 기본 선택: 요구를 채우는 가장 값싼 조합만 고른다 (모두 골라 두면 큰 검까지 실수로 바치기 쉽다)
  const pickNeeded = () => {
    const vals = S.finished.map((b) => value(b.level)), need = req(), n = vals.length;
    const scrap = S.scrap || 0;
    let best = null;
    if (n <= 14) {
      for (let m = 0; m < (1 << n); m++) {
        for (const sc of scrap ? [0, 1] : [0]) {
          let t = sc ? scrap : 0;
          for (let i = 0; i < n; i++) if (m & (1 << i)) t += vals[i];
          if (t >= need && (!best || t < best.t)) best = { m, sc, t };
        }
      }
    } else { // 검이 아주 많으면 싼 것부터 채운다
      const order = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]); let t = scrap, m = 0;
      for (const [v, i] of order) { if (t >= need) break; t += v; m |= 1 << i; }
      if (t >= need) best = { m, sc: scrap ? 1 : 0, t };
    }
    if (!best) return { set: new Set(vals.map((_, i) => i)), scrap: scrap > 0 }; // 다 바쳐도 모자라면 전부
    return { set: new Set(vals.map((_, i) => i).filter((i) => best.m & (1 << i))), scrap: !!best.sc };
  };
  const auto = pickNeeded();
  const sel = auto.set;
  let useScrap = auto.scrap;
  const render = () => {
    const total = [...sel].reduce((s, i) => s + value(S.finished[i].level), 0) + (useScrap ? S.scrap : 0);
    const ok = total >= req();
    const warn = [];
    if (S.cur) warn.push(`모루 위 +${S.cur.level} 미완성`);
    if (S.blanks > 0) warn.push(`원석 ${S.blanks} → 내일로`);
    // 빼도 요구를 채우는 검이 골라져 있으면 넘치게 바치는 것
    if (ok) {
      const spare = [...sel].filter((i) => total - value(S.finished[i].level) >= req());
      if (spare.length) warn.push(`필요보다 ${fmt(total - req())} G 더 바침`);
    }
    openPanel(`
      <h2>서고지기의 제단</h2>
      <div class="pills"><span>${S.day}일째</span><span>요구 <b>${fmt(req())} G</b></span></div>
      <div class="offer-list">
        ${S.finished.length || S.scrap ? '' : '<div class="empty">바칠 검 없음 · 울리면 촛불 −1</div>'}
        ${S.finished.map((b, i) => `<label class="offer ${sel.has(i) ? 'on' : ''}" data-i="${i}"><input type="checkbox" ${sel.has(i) ? 'checked' : ''}><span class="nm">${esc(bladeName(b.level))} <b>+${b.level}</b></span><span class="val">${fmt(value(b.level))} G</span></label>`).join('')}
        ${S.scrap > 0 ? `<label class="offer ${useScrap ? 'on' : ''}" data-scrap="1"><input type="checkbox" ${useScrap ? 'checked' : ''}><span class="nm">고철 더미</span><span class="val">${fmt(S.scrap)} G</span></label>` : ''}
      </div>
      <div class="meter"><div class="line"><span>바칠 가치</span><b style="color:${ok ? 'var(--green)' : 'var(--red)'}">${fmt(total)} / ${fmt(req())} G</b></div>
        <div class="bar"><div class="${ok ? 'ok' : ''}" style="width:${Math.min(100, total / req() * 100)}%"></div></div>
        <div class="pills" style="margin-top:8px"><span>바친 만큼 골드</span><span>남긴 검 → 내일·상점</span>${warn.map(w => `<span class="warn">${esc(w)}</span>`).join('')}</div></div>
      <div class="btnrow"><button id="al-back" class="ghost">돌아가기</button><button id="al-auto" class="ghost">필요한 만큼만</button><button id="al-ring" class="primary">${ok ? '바치기 🔔' : '부족해도 울리기 🔔'}</button></div>`, true);
    $('#al-auto').onclick = () => { const a = pickNeeded(); sel.clear(); a.set.forEach((i) => sel.add(i)); useScrap = a.scrap; sfx.play('ui'); render(); };
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
  const ok = total >= req(), M = world.maw;
  world.goStation('ritual', 1.6);
  await wait(0.7);
  sfx.play('bell'); world.shake(0.02);
  world.spawnSparks(world.offerSpot, 40, 0x86e6ff, { speed: 1.2, up: 2.5, life: 1.4 });
  await wait(0.6);
  // 1) 땅이 울리고 철창이 천천히 올라간다
  sfx.play('thunder', { rate: 0.55, gain: 0.8 }); sfx.play('gateGrind');
  await wait(1.5, (k) => { M.gate = easeInOut(k); M.eyes = k * 0.5; world.dim = 0.25 + k * 0.35; world.shake(0.012); });
  // 2) 어둠 속 눈들이 뜨고 촉수가 기어 나온다
  sfx.play('maw'); sfx.play('spirit', { rate: 0.7, gain: 0.5 }); world.setSpiritMood(ok ? 'happy' : 'angry');
  await wait(0.9, (k) => { M.eyes = 0.5 + k * 0.5; M.tent = easeInOut(k); world.dim = 0.6; });
  // 3) 거대한 손이 뻗어 나와 제단을 덮는다
  sfx.play('thunder', { rate: 0.8, gain: 0.6 });
  await wait(0.9, (k) => { M.reach = k; world.dim = 0.6; });
  world.shake(0.05); sfx.play('dull', { rate: 0.6 });
  await wait(0.25, () => { world.dim = 0.6; });
  // 4) 움켜쥔다
  await wait(0.3, (k) => { M.grip = easeInOut(k); world.dim = 0.6; });
  sfx.play('crack', { rate: 0.7 }); world.shake(0.04);
  const grab = world.mawGrip(), offs = cars.map((c) => c.position.clone().sub(grab));
  const follow = () => { const g = world.mawGrip(); cars.forEach((c, i) => { c.position.copy(g).add(offs[i]); c.scale.setScalar(0.85); }); };
  // 모자라면 분노해 제단을 내려친다
  if (!ok) {
    await wait(0.35, (k) => { M.lift = easeInOut(k); follow(); world.dim = 0.6; });
    await wait(0.12, (k) => { M.lift = 1 - k; follow(); });
    sfx.play('doorSlam'); sfx.play('thunder', { rate: 0.7 }); world.shake(0.14); flashRed();
    world.spawnSparks(world.offerSpot, 50, 0xff5533, { speed: 2.4, up: 2.2, life: 1.0 });
    await wait(0.3, () => { follow(); world.dim = 0.6; });
  }
  // 5) 어둠 속으로 끌고 들어간다
  await wait(1.0, (k) => { M.reach = 1 - k * k; M.lift = Math.sin(k * Math.PI) * 0.25; M.tent = 1 - k * 0.8; follow(); world.dim = 0.6; });
  cars.forEach(c => world.scene.remove(c));
  M.reach = 0; M.grip = 0; M.lift = 0;
  await wait(0.3, (k) => { M.tent = 0.2 * (1 - k); M.eyes = 1 - k * 0.6; world.dim = 0.6 - k * 0.2; });
  // 6) 철창이 쾅 내려온다
  await wait(0.18, (k) => { M.gate = 1 - k * k; });
  M.gate = 0; M.tent = 0;
  sfx.play('doorSlam'); world.shake(0.1);
  world.spawnSparks(new THREE.Vector3(0, 0.1, -5.0), 30, 0xffa060, { speed: 1.6, up: 1.2, life: 0.7 });
  await wait(0.5, (k) => { M.eyes = 0.4 * (1 - k); });
  M.eyes = 0;
  world.goStation('altar', 2.2);
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
  const fusedHave = (k) => FUSIONS.some(r => (r.a === k || r.b === k) && S.relics.has(r.into));
  const pool = shuffle(Object.keys(ITEMS).filter(k => (ITEMS[k].kind === 'relic' && !ITEMS[k].fused && !S.relics.has(k) && !fusedHave(k)) || ITEMS[k].kind === 'instant'));
  S.offers = pool.slice(0, 3).map(k => ({ k, sold: false }));
}
function openShop() {
  S.mode = 'shop'; refresh();
  world.goStation('shop', 2.4);
  S.rerollCost = Math.max(100, Math.round(req() * 0.3 / 10) * 10); S.ticketBought = false; rollOffers();
  renderShop();
}
function renderShop() {
  const used = S.relics.size;
  // 융합 짝 표시: 가진 유물 중 짝이 있으면 강조
  const fuseTag = (k) => {
    const r = FUSIONS.find((x) => x.a === k || x.b === k); if (!r) return '';
    const other = r.a === k ? r.b : r.a, have = S.relics.has(other);
    return `<span class="tag ${have ? 'hot' : ''}" title="${esc(ITEMS[other].name)}과(와) 융합 → ${esc(ITEMS[r.into].name)}">융합 · ${esc(ITEMS[other].name)}</span>`;
  };
  const row = (k, price, btn, dis, sold) => {
    const it = ITEMS[k];
    return `<div class="srow ${sold ? 'sold' : ''}" title="${esc(descOf(k))}">
      <div class="ico">${ICONS[k] || it.icon}</div>
      <div class="txt"><b>${it.name}</b><span>${it.short}${k === 'coin' ? ` — 오늘은 ${S.day % 2 ? '대성공' : '파괴'}` : ''}</span>${fuseTag(k)}</div>
      <button class="${sold ? 'ghost' : 'primary'} small" ${btn} ${dis || sold ? 'disabled' : ''}>${sold ? '✓' : price}</button></div>`;
  };
  const relics = S.offers.map((o, i) => {
    const it = ITEMS[o.k], full = it.kind === 'relic' && used >= RELIC_SLOTS && !fusesWith(o.k);
    return row(o.k, full ? '칸 부족' : `조각 ${it.cost}개`, `data-buy="${i}"`, S.tokens < it.cost || full, o.sold);
  }).join('');
  const golds = ['ticket', 'hint', 'candle'].filter((k) => !(k === 'candle' && S.candles >= 3))
    .map((k) => row(k, `${fmt(priceOf(k))} G`, `data-gold="${k}"`, S.gold < priceOf(k), k === 'ticket' && S.ticketBought)).join('');
  const feed = S.finished.length
    ? `<div class="sec">완성한 검 녹이기 <small>1자루 → 검 조각 1개</small></div><div class="chips">${S.finished.map((b, i) => `<button class="chip" data-feed="${i}" title="${esc(bladeName(b.level))}">+${b.level} · ${fmt(value(b.level))} G</button>`).join('')}</div>`
    : '';
  openPanel(`
    <h2>떠돌이 사서 등불</h2>
    <div class="stats"><span>💰 <b>${fmt(S.gold)}</b> G</span><span>🗡 조각 <b>${S.tokens}</b></span><span>유물 <b>${used}/${RELIC_SLOTS}</b></span></div>
    ${feed}
    <div class="sec">유물 <small>검 조각으로 산다 · 계속 효과</small></div>
    <div class="slist">${relics}</div>
    <div class="sec">소모품 <small>골드로 산다</small></div>
    <div class="slist">${golds}</div>
    <div class="btnrow"><button id="sh-reroll" class="ghost small" ${S.gold < S.rerollCost ? 'disabled' : ''}>↻ 새로 진열 ${fmt(S.rerollCost)} G</button>
    <button id="sh-next" class="primary">다음 날 →</button></div>`, true);
  $('#panel').classList.add('shop2');
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buy(+b.dataset.buy));
  document.querySelectorAll('[data-gold]').forEach(b => b.onclick = () => buyGold(b.dataset.gold));
  document.querySelectorAll('[data-feed]').forEach(b => b.onclick = () => feedSword(+b.dataset.feed));
  $('#sh-reroll').onclick = () => { if (S.gold < S.rerollCost) return; S.gold -= S.rerollCost; S.rerollCost = Math.round(S.rerollCost * 1.5 / 10) * 10; rollOffers(); sfx.play('coin'); refresh(); renderShop(); };
  $('#sh-next').onclick = () => { closeModal(); S.day++; startDay(); };
}
function feedSword(i) {
  const b = S.finished[i]; if (!b) return;
  if (!confirm(`${bladeName(b.level)} +${b.level} (${fmt(value(b.level))} G)을(를) 녹여 검 조각 1개로 바꿀까요? 되돌릴 수 없습니다.`)) return;
  S.finished.splice(i, 1); S.tokens++; world.setRack(S.finished); sfx.play('place');
  refresh(); renderShop();
}
function buy(i) {
  const o = S.offers[i], it = ITEMS[o.k];
  if (o.sold || S.tokens < it.cost) return;
  if (it.kind === 'relic' && S.relics.size >= RELIC_SLOTS && !fusesWith(o.k)) return;
  S.tokens -= it.cost; o.sold = true; sfx.play('coin');
  if (it.kind === 'relic') { S.relics.add(o.k); if (o.k === 'cocoon') S.rs.cocoonDay = S.day + 2; checkFusion(); }
  else if (o.k === 'tape') S.deck.dmg -= 1;
  refresh(); renderShop();
}
const fusesWith = (k) => FUSIONS.some(r => (r.a === k && S.relics.has(r.b)) || (r.b === k && S.relics.has(r.a)));
function buyGold(k) {
  const p = priceOf(k);
  if (S.gold < p || (k === 'ticket' && S.ticketBought)) return;
  S.gold -= p; sfx.play('coin');
  if (k === 'ticket') { S.deck.succ += 1; S.ticketBought = true; }
  else if (k === 'hint') S.items.hint++;
  else if (k === 'candle' && S.candles < 3) { world.setCandle(S.candles, true); S.candles++; }
  refresh(); renderShop();
}

// ───────── 하루 / 판 ─────────
function newGame() {
  clearSave();
  world.setTitleStage(false);
  if (S.cur) world.scene.remove(S.cur.car);
  $('#fever-frame').classList.remove('on'); $('#fever-bar').classList.remove('on');
  S = freshState();
  sfx.music('music');
  world.darkness = 0; world.setSpiritMood('calm');
  world.candles.forEach((_, i) => world.setCandle(i, true));
  world.setRack([]);
  startDay();
}
function startDay() {
  S.blanks += BASE_BLANKS + S.bonusBlanks;
  S.bonusBlanks = 0;
  let hatch = '';
  if (S.relics.has('cocoon') && S.day >= (S.rs.cocoonDay || 0)) { S.relics.delete('cocoon'); S.blanks += 3; hatch = ' · 원석 알이 깨어 원석 +3'; }
  S.mode = S.cur ? 'anvil' : 'idle';
  placePlayer(0, 3.4, 0, -0.12); enterWalk();
  drawCalendar(); drawBoard(); refresh();
  banner(`${S.day}일째`, `서고지기의 요구 · ${fmt(req())} G${hatch}`);
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
  clearSave();
  S.mode = 'over'; refresh(); $('#hud').classList.add('hidden');
  sfx.music(null); sfx.play('doom'); world.goStation('altar', 1.2);
  await wait(2.2, k => { world.darkness = k * 0.8; });
  openPanel(`<h2>망각에 삼켜졌다</h2><p class="sub">마지막 촛불이 꺼지자 서고지기의 눈빛만이 어둠 속에 남았다. 하지만 틀린 문제는 오답 노트에 남아 있다. 다시 익히고 돌아오자.</p>
    ${summaryHTML()}<div class="btnrow"><button id="end-notes" class="ghost">오답 노트</button><button id="end-retry" class="primary">다시 도전</button></div>`);
  bindEnd();
}
async function victory() {
  clearSave();
  S.mode = 'over'; refresh(); $('#hud').classList.add('hidden');
  world.setSpiritMood('happy'); sfx.play('great'); sfx.play('bell');
  world.goStation('overview', 1.2);
  openPanel(`<h2>계약 완수</h2><p class="sub">7일째 종소리가 울리자 서고지기가 고개를 숙였다. "이 검들에 담긴 것만큼은, 다시는 잊지 마라." 잠겼던 문이 열리고 눈부신 빛이 쏟아졌다. 눈을 뜨니 도서관 책상 위, 시험 날 아침이었다. 문제집 여백에 처음 보는 검 그림이 그려져 있었다.</p>
    ${summaryHTML()}<div class="btnrow"><button id="end-notes" class="ghost">오답 노트</button><button id="end-retry" class="primary">새 계약 시작</button></div>`);
  bindEnd();
}
function bindEnd() {
  $('#end-retry').onclick = () => { closeModal(); $('#hud').classList.remove('hidden'); newGame(); };
  $('#end-notes').onclick = () => openNotes(() => (S.candles <= 0 ? gameOver : victory)());
}

// ───────── 패널 ─────────
let panelBack = null;
function openPanel(html, side = false) { $('#panel').classList.remove('shop2'); $('#panel').innerHTML = html; $('#modal').classList.toggle('side', side); $('#modal').classList.remove('hidden'); $('#panel').scrollTop = 0; }
function closeModal() { $('#modal').classList.add('hidden'); panelBack = null; }
function openNotes(back) {
  const list = Object.entries(WRONGS).sort((a, b) => b[1].count - a[1].count);
  openPanel(`<h2>오답 노트</h2><div class="pills"><span>더 자주 출제</span><span>연속 정답 → 졸업</span></div>
    <label class="opt" style="margin-bottom:12px"><input type="checkbox" id="nt-review" ${settings.reviewOnly ? 'checked' : ''}> 오답만 복습 (3개 이상)</label>
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
  openPanel(`<h2>문제 세트</h2><p class="sub">한 줄에 한 문제 · <b>[분류] 문제 | 보기… | 정답번호 | 해설</b></p><div class="pills"><span>보기 2~6개</span><span>해설 생략 가능</span><span>시트 붙여넣기 OK</span></div>
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
  const K = (k, t) => `<span class="key"><kbd>${k}</kbd>${t}</span>`;
  const R = (ico, h, t) => `<li><i>${ico}</i><b>${h}</b><span>${t}</span></li>`;
  openPanel(`<h2>플레이 방법</h2>
    <div class="keys">${K('WASD', '이동')}${K('마우스', '시점')}${K('E', '상호작용')}${K('Space', '망치질')}${K('F', '완성')}${K('R', '다시 달구기')}${K('Esc', '자리 뜨기')}${K('P', '일시정지')}</div>
    <ul class="howto2">
      ${R('🔨', '망치질', '맞히면 1번 두드림 · 결과는 확률표대로 (파괴 · 손상 −1 · 유지 · 성공 +1 · 대성공 +2)')}
      ${R('❌', '오답', '헛손질 · 검이 식음 (3번 → R) · 수업료 5% · 영감 −3')}
      ${R('✨', '영감', '정답 10번 → 6초 연타 · 파괴 0%')}
      ${R('⚔️', '완성', 'F로 걸이에 · 걸이에서 다시 가져와 이어 강화')}
      ${R('🕯️', '제단', '요구 가치 채우면 골드 · 부족하면 촛불 −1 · 0개면 끝 · 7일 버티면 승리')}
      ${R('🏮', '상인', '남은 검 → 조각 → 유물 (5칸) · 골드 → 추첨표·힌트·양초')}
      ${R('🔗', '융합', '짝 유물 2개 → 강한 유물 1개')}
      ${R('📒', '오답 노트', '틀린 문제가 더 자주 나옴')}
      ${R('📈', '강화', '최대 +100 · 가치 1강마다 ×1.5 · +25·50·75 번개')}
    </ul>
    <div class="btnrow"><button id="ht-close" class="primary">알겠다</button></div>`);
  $('#ht-close').onclick = () => { closeModal(); if (back) back(); };
}
function updateQInfo() {
  const nw = Object.keys(WRONGS).length;
  $('#qinfo').textContent = nw ? `오답 노트에 ${nw}문제${settings.reviewOnly ? ' · 오답만 복습' : ''}` : '';
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
      if (!S.finished.length) return { label: '아직 걸어 둔 검이 없다' };
      if (S.cur || S.mode !== 'idle') return { label: `완성한 검 ${S.finished.length}자루 · 합계 ${fmt(tot)} G · 모루를 비우면 다시 가져갈 수 있다` };
      return { label: `걸어 둔 검 다시 벼리기 (${S.finished.length}자루 · 합계 ${fmt(tot)} G)`, act: openRackPicker };
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
$('#btn-pause').onclick = () => openPause();
// ───────── 일시정지 ─────────
let pauseFrom = null, pausedAt = 0;
function openPause() {
  if (S.mode !== 'idle' && S.mode !== 'anvil') return;
  pauseFrom = S.mode; pausedAt = performance.now();
  S.mode = 'paused'; keys.clear();
  if (pointerLocked()) document.exitPointerLock();
  refresh(); sfx.play('ui');
  const fsOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
  openPanel(`<h2>일시정지</h2>
    <div class="pills"><span>${S.day}일째</span><span>${esc(COURSE || '내 문제')}</span><span>요구 <b>${fmt(req())} G</b></span></div>
    <div class="pause-menu">
      <button id="pz-resume" class="forge-btn">계속하기</button>
      <button id="pz-howto" class="ghost">플레이 방법</button>
      <button id="pz-notes" class="ghost">오답 노트</button>
      <button id="pz-sound" class="ghost">소리 ${sfx.muted ? '켜기' : '끄기'}</button>
      ${(document.fullscreenEnabled || document.webkitFullscreenEnabled) ? `<button id="pz-fs" class="ghost">${fsOn ? '창 모드로' : '전체화면'}</button>` : ''}
      <button id="pz-title" class="ghost danger">처음 화면으로</button>
    </div>
    <p class="sub" style="margin-top:12px">Esc 또는 P로 계속</p>`);
  $('#pz-resume').onclick = resumeGame;
  $('#pz-howto').onclick = () => openHowTo(() => { S.mode = 'paused'; openPause.reopen(); });
  $('#pz-notes').onclick = () => openNotes(() => { openPause.reopen(); });
  $('#pz-sound').onclick = () => { $('#btn-sound').onclick(); openPause.reopen(); };
  const fz = $('#pz-fs'); if (fz) fz.onclick = () => { $('#btn-fs').click(); setTimeout(openPause.reopen, 150); };
  $('#pz-title').onclick = () => { if (confirm('지금 판을 그만두고 처음 화면으로 갈까요? 지금까지의 진행은 자동 저장되어, 처음 화면의 「이어하기」로 돌아올 수 있습니다.')) goTitle(); };
}
// 일시정지 화면을 다시 그린다 (하위 메뉴에서 돌아올 때)
openPause.reopen = () => { const from = pauseFrom, at = pausedAt; S.mode = from; openPause(); pausedAt = at; };
function resumeGame() {
  if (S.mode !== 'paused') return;
  closeModal();
  // 일시정지한 동안 영감 시간이 흐르지 않게
  if (S.feverUntil > pausedAt) S.feverUntil += performance.now() - pausedAt;
  S.mode = pauseFrom || 'idle'; pauseFrom = null;
  refresh(); drawBoard();
  if (view === 'walk') tryLock();
}
function goTitle() {
  closeModal();
  if (S.cur) world.scene.remove(S.cur.car);
  $('#fever-frame').classList.remove('on'); $('#fever-bar').classList.remove('on');
  S = freshState(); pauseFrom = null;
  world.darkness = 0; world.setSpiritMood('calm');
  world.candles.forEach((_, i) => world.setCandle(i, true));
  world.setRack([]); view = 'walk';
  $('#hud').classList.add('hidden');
  $('#title-select').classList.add('hidden'); $('#title-home').classList.remove('hidden');
  $('#title-screen').classList.remove('hidden');
  refresh();
}
$('#act-reheat').onclick = reheat;
// 식은 검을 화로에 다시 달군다 (시간만 든다)
async function reheat() {
  if (S.mode !== 'anvil' || !S.cur || !(S.cur.chill > 0)) return;
  const c = S.cur, car = c.car; S.mode = 'moving'; view = 'cine'; refresh();
  world.goStation('furnace', 3.2); sfx.play('whoosh');
  const a = car.position.clone(), b = new THREE.Vector3(-2.78, 0.74, -2.4);
  await wait(0.7, k => { const e = easeInOut(k); car.position.lerpVectors(a, b, e); car.position.y += Math.sin(k * Math.PI) * 0.45; car.rotation.y = Math.PI * e; });
  sfx.play('heat');
  await wait(1.1, k => { c.heat = k * 1.4; car.position.x = b.x + Math.sin(k * 30) * 0.006; if (Math.random() < 0.3) world.spawnSparks(b, 1, 0xff8a3d, { speed: 1, up: 1.5, life: 0.6 }); });
  c.chill = 0;
  world.goStation('anvil', 2.8);
  await wait(0.75, k => { const e = easeInOut(k); car.position.lerpVectors(b, a, e); car.position.y += Math.sin(k * Math.PI) * 0.4; car.rotation.y = Math.PI * (1 - e); });
  sfx.play('place'); world.spawnSparks(a, 12, 0xff9a40, { speed: 1.4, up: 1 });
  S.mode = 'anvil'; view = 'anvil'; drawBoard(); refresh();
}

// 마우스: 클릭하면 포인터 잠금, 잠기지 않는 환경에서는 끌어서 둘러보기
let dragging = null;
function look(dx, dy, s) {
  P.yaw -= dx * s; P.pitch = Math.max(-1.25, Math.min(1.2, P.pitch - dy * s));
}
document.addEventListener('pointerlockchange', () => {
  // 걸어 다니는 중에 잠금이 풀렸다면 사용자가 Esc를 누른 것이다 (게임이 일부러 풀 때는 이미 다른 모드로 바뀐 뒤)
  if (!pointerLocked() && walkActive() && !IS_TOUCH) openPause();
  refresh();
});
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
$('#btn-start').onclick = () => { sfx.init(); sfx.play('ui'); showSelect(); };
$('#btn-back').onclick = () => { sfx.play('ui'); $('#title-select').classList.add('hidden'); $('#title-home').classList.remove('hidden'); };
$('#btn-go').onclick = async () => {
  const sv = loadSave();
  if (sv && !confirm(`저장된 판(${sv.s.day}일째 · ${sv.course || ''})이 지워지고 새로 시작합니다. 괜찮을까요?`)) return;
  sfx.init();
  const ok = await loadBank();
  if (!ok) return;
  if (!store.get('jf_intro', 0)) { playIntro(); return; }
  sfx.play('bell');
  $('#title-screen').classList.add('hidden'); $('#hud').classList.remove('hidden');
  newGame();
};
// 학년·학기·과목 고르기
function showSelect() {
  $('#title-home').classList.add('hidden');
  const sel = $('#title-select'); sel.classList.add('hidden'); void sel.offsetWidth; sel.classList.remove('hidden');
  renderSelect();
}
function renderSelect() {
  // 학년에 없는 과목은 빼고, 하나도 안 남으면 첫 과목
  const avail = subjectsOf(SEL.grade);
  SEL.subjs = SEL.subjs.filter((k) => avail.includes(k));
  if (!SEL.subjs.length) SEL.subjs = [avail[0]];
  $('#sel-grade').innerHTML = GRADES.map((g) => `${g === '중1' ? '<span class="br"></span>' : ''}<button data-g="${g}" class="${g === SEL.grade && !SEL.custom ? 'on' : ''}">${g}</button>`).join('');
  $('#sel-sem').innerHTML = [1, 2].map((n) => `<button data-s="${n}" class="${n === SEL.sem && !SEL.custom ? 'on' : ''}">${n}학기</button>`).join('');
  $('#sel-subj').innerHTML = subjectsOf(SEL.grade).map((k) => `<button data-k="${k}" aria-pressed="${SEL.subjs.includes(k) && !SEL.custom}" class="${SEL.subjs.includes(k) && !SEL.custom ? 'on' : ''}">${SUBJ[k]}</button>`).join('')
    + `<button data-k="custom" class="gap ${SEL.custom ? 'on' : ''}">내 문제</button>`;
  document.querySelectorAll('#sel-grade [data-g]').forEach((b) => b.onclick = () => { SEL.grade = b.dataset.g; SEL.custom = false; sfx.play('ui'); renderSelect(); });
  document.querySelectorAll('#sel-sem [data-s]').forEach((b) => b.onclick = () => { SEL.sem = +b.dataset.s; SEL.custom = false; sfx.play('ui'); renderSelect(); });
  // 과목은 여러 개 고를 수 있다(누를 때마다 넣고 뺌, 하나는 남김). '내 문제'는 따로.
  document.querySelectorAll('#sel-subj [data-k]').forEach((b) => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'custom') SEL.custom = !SEL.custom;
    else if (SEL.custom) { SEL.custom = false; SEL.subjs = [k]; }
    else if (SEL.subjs.includes(k)) { if (SEL.subjs.length > 1) SEL.subjs = SEL.subjs.filter((x) => x !== k); }
    else SEL.subjs = subjectsOf(SEL.grade).filter((x) => x === k || SEL.subjs.includes(x));
    sfx.play('ui'); renderSelect();
  });
  store.set('jf_sel', SEL);
  previewBank();
}
const BANK_CACHE = {};
// 수학 문제 생성기 (js/mathgen.js). 없거나 실패하면 고정 문제만 쓴다.
async function mathExtra(code, n) {
  try {
    const m = await import('./mathgen.js');
    return m.generateMath(code, n).map((q) => ({ t: q.t, q: q.q, c: q.c, a: q.a, e: q.e }));
  } catch (e) { return []; }
}
async function fetchBank(code) {
  if (BANK_CACHE[code]) return BANK_CACHE[code];
  const r = await fetch(`data/q/${code}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error('no bank');
  return (BANK_CACHE[code] = await r.json());
}
async function previewBank() {
  const info = $('#sel-info');
  if (SEL.custom) {
    const n = (store.get('jf_questions', null) || SAMPLE_QUESTIONS).length;
    info.innerHTML = `<b>내 문제 세트</b> · ${n}문제 · "내 문제 세트"에서 붙여 넣어 바꿀 수 있다`; return;
  }
  const key = SEL.grade + SEL.sem + SEL.subjs.join();
  info.textContent = '불러오는 중…';
  try {
    const banks = await Promise.all(SEL.subjs.map((k) => fetchBank(bankCode(SEL.grade, SEL.sem, k))));
    if (SEL.grade + SEL.sem + SEL.subjs.join() !== key) return;
    const fixed = banks.reduce((t, b) => t + b.questions.length, 0), hasMath = SEL.subjs.includes('math');
    const head = `<b>${SEL.grade} ${SEL.sem}학기 ${subjLabel()}</b> · ${hasMath ? '문제 생성기 + ' : ''}${fixed}문제 · 2022 개정`;
    // 과목이 하나면 단원 목록, 여러 개면 과목별 문제 수
    const detail = banks.length === 1 ? (banks[0].units || []).slice(0, 6).map(esc).join(' · ')
      : SEL.subjs.map((k, i) => `${SUBJ[k]} ${k === 'math' ? '생성기+' : ''}${banks[i].questions.length}`).join(' · ');
    info.innerHTML = `${head}<br>${detail}`;
  } catch (e) {
    if (SEL.grade + SEL.sem + SEL.subjs.join() === key) info.innerHTML = '<span class="err">고른 과목 중 아직 준비 중인 문제가 있다</span>';
  }
}
async function loadBank() {
  if (SEL.custom) {
    QUESTIONS = withIds(store.get('jf_questions', null) || SAMPLE_QUESTIONS); COURSE = '내 문제';
  } else {
    try {
      // 데이터에 문자 그대로의 "\n"(역슬래시+n)이 남아 있어도 실제 줄바꿈으로 보여 준다
      const nl = (x) => String(x).replace(/\\+n/g, '\n');
      const multi = SEL.subjs.length > 1;
      let list = [];
      for (const k of SEL.subjs) {
        const code = bankCode(SEL.grade, SEL.sem, k);
        const b = await fetchBank(code);
        // 여러 과목을 섞으면 문제 머리에 과목 이름을 붙인다
        const tag = (t) => multi ? `${SUBJ[k]} · ${t}` : t;
        list = list.concat(b.questions.map((q) => ({ t: tag(q.t), q: nl(q.q), c: q.c, a: q.a, e: nl(q.e) })));
        // 수학은 문제 생성기로 판마다 새 문제를 섞는다 (다른 과목과 섞을 땐 비슷한 양으로)
        if (k === 'math') list = list.concat((await mathExtra(code.replace(/-math$/, ''), multi ? 90 : 150)).map((q) => ({ ...q, t: tag(q.t) })));
      }
      QUESTIONS = withIds(list);
      COURSE = `${SEL.grade} ${SEL.sem}학기 ${subjLabel()}`;
    } catch (e) { $('#sel-info').innerHTML = '<span class="err">이 과목 문제는 아직 준비 중이다</span>'; return false; }
  }
  $('#hud-course').textContent = COURSE;
  return true;
}
// 전체화면
const fsEl = $('#btn-fs');
if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) fsEl.classList.add('hidden');
fsEl.onclick = (e) => {
  e.stopPropagation();
  const d = document, on = d.fullscreenElement || d.webkitFullscreenElement;
  if (on) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; const p = (el.requestFullscreen || el.webkitRequestFullscreen).call(el); if (p && p.catch) p.catch(() => {}); }
};
const fsSync = () => { fsEl.textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? '⛶ 창 모드' : '⛶ 전체화면'; setTimeout(() => world.resize(), 60); };
document.addEventListener('fullscreenchange', fsSync); document.addEventListener('webkitfullscreenchange', fsSync);
$('#btn-intro').onclick = () => { sfx.init(); playIntro(); };

// ───────── 프롤로그 컷씬 ─────────
// 시험 전날 도서관에서 잠들었다가 망각의 서고의 대장간에서 깨어나는 이야기. 클릭·Space로 넘기고 Esc로 건너뛴다.
const CS = { on: false, skip: false, next: null };
const csSleep = (ms) => new Promise((res) => {
  if (CS.skip) return res();
  const t = setTimeout(res, ms);
  CS.next = () => { clearTimeout(t); res(); };
});
function csShot(pos, look, speed = 1.2) { world.tgtPos.set(...pos); world.tgtLook.set(...look); world.camSpeed = speed; }
function csCut(pos, look) { csShot(pos, look, 1e4); world.camPos.set(...pos); world.camLook.set(...look); }
async function csFade(to, ms) {
  const f = $('#cs-fade'); f.style.transition = `opacity ${ms}ms ease`; f.style.opacity = to;
  await csSleep(ms);
}
async function csDark(a, b, ms) {
  const t0 = performance.now();
  while (!CS.skip) {
    const k = Math.min(1, (performance.now() - t0) / ms);
    world.darkness = a + (b - a) * k;
    if (k >= 1) break;
    await new Promise((r) => setTimeout(r, 16));
  }
}
async function csLine(who, text, hold) {
  if (CS.skip) return;
  const box = $('#cs-sub'), body = $('#cs-text');
  box.className = who ? 'speak' : 'narr'; $('#cs-name').textContent = who || ''; body.textContent = '';
  void box.offsetWidth; box.classList.add('show');
  if (who) sfx.play('ui');
  let i = 0, typing = true;
  await new Promise((res) => {
    CS.next = () => { typing = false; };
    const tick = () => {
      if (CS.skip || !typing) { body.textContent = text; return res(); }
      body.textContent = text.slice(0, ++i);
      if (i >= text.length) return res();
      setTimeout(tick, 34);
    };
    tick();
  });
  await csSleep(hold ?? Math.max(1800, text.length * 60));
  box.classList.remove('show');
  await csSleep(280);
}
async function playIntro() {
  if (CS.on) return;
  world.setTitleStage(false);
  CS.on = true; CS.skip = false;
  if (S.cur) { world.scene.remove(S.cur.car); S.cur = null; }
  S.mode = 'cutscene'; view = 'cine'; refresh();
  $('#title-screen').classList.add('hidden'); $('#hud').classList.add('hidden'); closeModal();
  $('#cutscene').classList.remove('hidden');
  const fade = $('#cs-fade'); fade.style.transition = 'none'; fade.style.opacity = 1;
  world.darkness = 0.85; world.setRack([]); world.setSpiritMood('sleep');
  world.candles.forEach((_, i) => world.setCandle(i, false));
  csCut([0, 1.62, 4.05], [0, 1.35, 0]);
  sfx.music('intro_drone');
  await csSleep(700);
  await csLine('', '시험 전날 밤, 도서관 맨 구석 자리.');
  await csLine('', '펼쳐 둔 문제집 위로, 고개가 천천히 떨어졌다.');
  sfx.play('whoosh');
  await csFade(0, 2200);
  await csLine('', '눈을 뜨니 낯선 대장간이었다. 화로의 불은 거의 꺼져 있었다.');
  // 철창 너머에서 눈이 뜨인다
  csShot([0.35, 1.7, -1.5], [0, 2.6, -7], 0.9);
  await csSleep(1800);
  world.setSpiritMood('happy'); sfx.play('spirit'); world.shake(0.015);
  await csSleep(700);
  await csLine('망각의 서고지기', '…또 하나 굴러들어왔구나.');
  world.setSpiritMood('calm');
  await csLine('망각의 서고지기', '여기는 망각의 서고. 외우다 만 것, 대충 넘긴 것, 시험이 끝나자마자 흘려버린 것들이 가라앉는 곳이지.');
  await csLine('망각의 서고지기', '네가 잊어버린 것들도, 전부 여기 있다.');
  // 화로가 살아난다
  csShot([-0.9, 1.7, 0.6], [-3.3, 0.9, -2.4], 1.3);
  sfx.play('heat');
  await csDark(0.85, 0.3, 1800);
  await csLine('망각의 서고지기', '꺼져 가던 이 대장간에 불씨를 빌려주마. 잊힌 지식을 다시 두드려 검으로 벼려라.');
  // 모루와 망치
  csShot([0, 2.1, 2.2], [0, 1.2, -0.3], 1.3);
  await csSleep(1100);
  await csLine('망각의 서고지기', '문제를 맞혀야 망치를 들 수 있다. 검이 버틸지 부서질지는… 네 운에 달렸지.');
  // 제단에 촛불이 켜진다
  csShot([0, 1.75, -1.75], [0, 1.2, -4.4], 1.2);
  await csSleep(1300);
  for (let i = 0; i < 3 && !CS.skip; i++) { world.setCandle(i, true); sfx.play('place'); await csSleep(500); }
  await csDark(0.3, 0, 900);
  await csLine('망각의 서고지기', '대가는 7일. 날마다 정해진 가치만큼의 검을 이 제단에 바쳐라.');
  world.setSpiritMood('angry'); world.shake(0.035); sfx.play('blowout');
  await csLine('망각의 서고지기', '모자라면 촛불이 하나씩 꺼진다. 셋이 모두 꺼지면… 너 역시 이곳에 잊힌다.');
  world.setSpiritMood('calm');
  // 등 뒤에서 문이 잠긴다
  csShot([0, 1.62, 1.6], [0, 1.4, 4.5], 2.2);
  await csSleep(1200);
  if (!CS.skip) { sfx.play('doorSlam'); world.shake(0.1); }
  await csLine('', '쿵. 등 뒤에서 문이 잠겼다.');
  await csLine('', '돌아가려면, 7일을 버텨야 한다.');
  endIntro();
}
function endIntro() {
  if (!CS.on) return;
  CS.on = false; CS.skip = false; CS.next = null;
  $('#cutscene').classList.add('hidden'); $('#cs-sub').classList.remove('show');
  world.darkness = 0; world.setSpiritMood('calm');
  store.set('jf_intro', 1);
  sfx.play('bell');
  $('#hud').classList.remove('hidden');
  newGame();
}
function skipIntro() { if (!CS.on) return; CS.skip = true; if (CS.next) CS.next(); }
$('#cs-skip').onclick = (e) => { e.stopPropagation(); skipIntro(); };
$('#cutscene').onclick = () => { if (CS.next) CS.next(); };

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (CS.on) {
    if (k === 'Escape') skipIntro();
    else if (k === ' ' || k === 'Enter') { if (CS.next) CS.next(); }
    e.preventDefault(); return;
  }
  if (S.mode === 'paused') {
    if (k === 'Escape' || k.toLowerCase() === 'p') { resumeGame(); e.preventDefault(); }
    return;
  }
  if (k.toLowerCase() === 'p' && (S.mode === 'idle' || S.mode === 'anvil')) { openPause(); e.preventDefault(); return; }
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
    else if (k === 'Escape') openPause();
    return;
  }
  if (view === 'anvil') {
    if (k === ' ') { strike(); e.preventDefault(); }
    else if (kl === 'f') finishBlade();
    else if (k === 'Escape' || kl === 'e') leaveAnvil();
    else if (kl === 'r') reheat();
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
    const left = (S.feverUntil - now) / S.feverDur;
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
    // 화로 불을 등진 검을 낮은 각도에서 올려다보며 천천히 흔들린다
    const t = now / 1000;
    if (!world.titleOn) world.setTitleStage(true);
    world.camSpeed = 1.2;
    world.tgtPos.set(-0.5 + Math.sin(t * 0.13) * 0.1, 0.86 + Math.sin(t * 0.17) * 0.03, -0.25);
    // 세로 화면에서는 검을 가운데 위쪽에, 가로 화면에서는 오른쪽 3분의 1에 둔다
    if (innerWidth / innerHeight < 0.9) world.tgtLook.set(-2.3, 1.02, -1.95); else world.tgtLook.set(-2.8, 1.36, -1.6);
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
  P, keys, interact, breakthrough, sfx, get view() { return view; }, get focus() { return focusInfo; },
};

// 창 크기가 바뀌면 왼쪽 위 패널 높이도 바뀌므로 요구 가치 상자 위치를 다시 잡는다
window.addEventListener('resize', () => { const tl = document.querySelector('.hud-tl'), rb = document.querySelector('#reqbox'); if (rb.classList.contains('dock') && tl) rb.style.top = (tl.getBoundingClientRect().bottom + 8) + 'px'; });

// ───────── 저장 (브라우저 localStorage) ─────────
// 걷기·모루·상점처럼 멈춰 있는 순간에만 저장한다. 문제를 푸는 중이나 의식 중에 창을 닫으면 그 직전 상태로 돌아온다.
var SAVE_KEY = 'jf_save';
var SAVABLE = ['idle', 'anvil', 'shop'];
var saveTimer = 0;
function queueSave() {
  if (!SAVABLE || !SAVABLE.includes(S.mode) || saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = 0; writeSave(); }, 300);
}
function writeSave() {
  if (!SAVABLE.includes(S.mode)) return;
  const c = S.cur;
  const cur = c ? Object.fromEntries(Object.entries(c).filter(([k]) => k !== 'holder' && k !== 'car')) : null;
  store.set(SAVE_KEY, {
    v: 1, at: Date.now(), sel: { grade: SEL.grade, sem: SEL.sem, subjs: [...SEL.subjs], custom: SEL.custom }, course: COURSE,
    s: { ...S, cur, relics: [...S.relics], sessionWrong: [...S.sessionWrong], feverUntil: 0, feverPending: false, boardMsg: null, mode: S.mode === 'shop' ? 'shop' : 'play' },
  });
  updateContinue();
}
function loadSave() { const sv = store.get(SAVE_KEY, null); return sv && sv.v === 1 && sv.s ? sv : null; }
function clearSave() { clearTimeout(saveTimer); saveTimer = 0; try { localStorage.removeItem(SAVE_KEY); } catch { /* 저장 불가 환경 */ } updateContinue(); }
window.addEventListener('pagehide', () => { if (SAVABLE.includes(S.mode)) writeSave(); });

// 처음 화면의 '이어하기' 버튼
function updateContinue() {
  const b = $('#btn-continue'); if (!b) return;
  const sv = loadSave();
  b.classList.toggle('hidden', !sv);
  if (sv) b.innerHTML = `이어하기<small>${sv.s.day}일째 · ${esc(sv.course || '')}</small>`;
}
async function continueGame() {
  const sv = loadSave(); if (!sv) return;
  sfx.init();
  Object.assign(SEL, sv.sel);
  const ok = await loadBank(); if (!ok) return;
  sfx.play('bell');
  $('#title-screen').classList.add('hidden'); $('#hud').classList.remove('hidden');
  world.setTitleStage(false);
  if (S.cur) world.scene.remove(S.cur.car);
  S = Object.assign(freshState(), sv.s, { relics: new Set(sv.s.relics), sessionWrong: new Set(sv.s.sessionWrong), cur: null, feverUntil: 0 });
  sfx.music('music');
  world.darkness = 0; world.setSpiritMood('calm');
  world.candles.forEach((_, i) => world.setCandle(i, i < S.candles));
  world.setRack(S.finished);
  // 모루 위에 있던 검을 다시 올려 둔다
  if (sv.s.cur) {
    const holder = makeLyingBlade(sv.s.cur.level), car = new THREE.Group(); car.add(holder);
    car.position.copy(world.anvilTop); world.scene.add(car);
    S.cur = { ...sv.s.cur, holder, car, heat: 0.3, flash: 0 };
  }
  drawCalendar(); drawBoard();
  if (sv.s.mode === 'shop') {
    S.mode = 'shop'; refresh(); world.goStation('shop', 2.4); renderShop();
  } else {
    S.mode = S.cur ? 'anvil' : 'idle';
    placePlayer(0, 3.4, 0, -0.12); enterWalk(); refresh();
    banner(`${S.day}일째 · 이어서`, `서고지기의 요구 · ${fmt(req())} G`);
  }
}
$('#btn-continue').onclick = () => continueGame();
updateContinue();
