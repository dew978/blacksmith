// 수학 문제 생성기 (2022 개정 교육과정, 초1~초6 학기별 단원)
// generateMath('e5-1', 150) → [{ t, q, c: [4], a, e, std }]
// 템플릿마다 검사용 데이터 k를 함께 만들고, tools/check-mathgen.js가 이를 따로 다시 계산해 정답을 확인한다.
// 표기: 분수 "4분의 3", 대분수 "1과 4분의 3"(5·6학년은 기약분수), 소수 "0.75", 단위 "26 cm", "90°", "40%", "8개".

export const MATH_UNITS = {
  'e1-1': ['9까지의 수', '여러 가지 모양', '덧셈과 뺄셈', '비교하기', '50까지의 수'],
  'e1-2': ['100까지의 수', '덧셈과 뺄셈(1)', '모양과 시각', '덧셈과 뺄셈(2)', '규칙 찾기', '덧셈과 뺄셈(3)'],
  'e2-1': ['세 자리 수', '여러 가지 도형', '덧셈과 뺄셈', '길이 재기', '분류하기', '곱셈'],
  'e2-2': ['네 자리 수', '곱셈구구', '길이 재기', '시각과 시간', '표와 그래프', '규칙 찾기'],
  'e3-1': ['덧셈과 뺄셈', '평면도형', '나눗셈', '곱셈', '길이와 시간', '분수와 소수'],
  'e3-2': ['곱셈', '나눗셈', '원', '분수와 소수', '들이와 무게', '그림그래프'],
  'e4-1': ['큰 수', '각도', '곱셈과 나눗셈', '삼각형', '막대그래프', '관계와 규칙'],
  'e4-2': ['분수의 덧셈과 뺄셈', '사각형', '소수의 덧셈과 뺄셈', '다각형', '꺾은선그래프', '평면도형의 이동'],
  'e5-1': ['자연수의 혼합 계산', '약수와 배수', '대응 관계', '약분과 통분', '분수의 덧셈과 뺄셈', '다각형의 둘레와 넓이'],
  'e5-2': ['수의 범위와 올림, 버림, 반올림', '분수의 곱셈', '합동과 대칭', '소수의 곱셈', '직육면체와 정육면체', '평균과 가능성'],
  'e6-1': ['분수의 나눗셈', '각기둥과 각뿔', '소수의 나눗셈', '비와 비율', '여러 가지 그래프', '직육면체의 겉넓이와 부피'],
  'e6-2': ['분수의 나눗셈', '공간과 입체', '소수의 나눗셈', '비례식과 비례배분', '원의 둘레와 넓이', '원기둥, 원뿔, 구'],
};
// 문제의 t (12자 이하). 고정 문제 은행과 같은 이름을 쓴다.
const TLABEL = Object.fromEntries(Object.entries(MATH_UNITS).map(([k, v]) => [k, v.slice()]));
TLABEL['e5-2'][0] = '수의 범위와 어림';
TLABEL['e6-1'][5] = '겉넓이와 부피';

// ---------- 난수 ----------
export function seeded(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mkR(rnd) {
  const R = {
    int: (a, b) => a + Math.floor(rnd() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    chance: (p) => rnd() < p,
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  };
  R.sample = (arr, k) => R.shuffle(arr).slice(0, k);
  R.distinct = (k, a, b, ok = () => true) => { const s = new Set(); let g = 0; while (s.size < k && g++ < 500) { const v = R.int(a, b); if (ok(v)) s.add(v); } return [...s]; };
  return R;
}

// ---------- 수와 글자 ----------
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => (a / gcd(a, b)) * b;
const D = (x) => String(Math.round(x * 1e6) / 1e6); // 소수 표기
const sp = (u) => (u && /^[A-Za-z]/.test(u) ? ' ' : '');
const U = (x, u = '') => (typeof x === 'number' ? D(x) : x) + sp(u) + u;
const Us = (arr, u) => arr.filter((x) => x !== null && x !== undefined && !(typeof x === 'number' && (x < 0 || !isFinite(x)))).map((x) => U(x, u));
const Q = (n, d = 1) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
const FR = (n, d) => `${d}분의 ${n}`; // 약분하지 않은 분수
const MR = (n, d) => { // 약분하지 않은 대분수(가분수면 대분수로)
  if (n % d === 0) return String(n / d);
  if (n < d) return FR(n, d);
  const w = Math.floor(n / d);
  return `${wa(String(w))} ${FR(n % d, d)}`;
};
const FM = (n, d) => { const [a, b] = Q(n, d); return MR(a, b); }; // 기약분수, 대분수
// 받침 여부 (한글, 숫자 읽기, 단위 읽기)
function bat(s) {
  s = String(s).trim();
  const ch = s[s.length - 1];
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (/\d/.test(ch)) {
    const m = s.match(/(\d+)$/)[1];
    const d = +m[m.length - 1];
    if (d !== 0) return [0, 1, 0, 1, 0, 0, 1, 1, 1, 0][d] === 1;
    return true; // 영, 십, 백, 천, 만
  }
  if (c >= 0x3131 && c <= 0x314e) return true; // ㄱ(기역)·ㄴ(니은)…은 받침으로 끝난다
  return { g: true, t: true }[ch] || false; // m(미터)·L(리터)·°(도)·%(퍼센트)·²³ 는 받침 없음
}
const ida = (s) => s + (bat(s) ? '이에요' : '예요');
const eun = (s) => s + (bat(s) ? '은' : '는');
const iga = (s) => s + (bat(s) ? '이' : '가');
const eul = (s) => s + (bat(s) ? '을' : '를');
const wa = (s) => s + (bat(s) ? '과' : '와');
const ro = (s) => {
  const c = String(s).trim(), ch = c.charCodeAt(c.length - 1);
  let ok; // 받침 없음 또는 ㄹ 받침이면 '로'
  if (ch >= 0xac00 && ch <= 0xd7a3) { const r = (ch - 0xac00) % 28; ok = r === 0 || r === 8; }
  else if (/\d$/.test(c)) { const d = +c[c.length - 1]; ok = d !== 0 && d !== 3 && d !== 6; }
  else ok = !bat(c);
  return c + (ok ? '로' : '으로');
};
// 큰 수: 1억 이상은 "3억 5000만" 꼴
function kor(n) {
  if (n < 1e8 && n % 10000 !== 0) return String(n);
  if (n < 10000) return String(n);
  const jo = Math.floor(n / 1e12), eok = Math.floor(n / 1e8) % 10000, man = Math.floor(n / 1e4) % 10000, il = n % 10000;
  const p = [];
  if (jo) p.push(jo + '조');
  if (eok) p.push(eok + '억');
  if (man) p.push(man + '만');
  if (il) p.push(String(il));
  return p.join(' ');
}
const digitsR = (n) => String(n).split('').reverse().map(Number);
function naiveAdd(a, b) { const A = digitsR(a), B = digitsR(b); let r = 0; for (let i = 0; i < Math.max(A.length, B.length); i++) r += (((A[i] || 0) + (B[i] || 0)) % 10) * 10 ** i; return r; }
function naiveSub(a, b) { const A = digitsR(a), B = digitsR(b); let r = 0; for (let i = 0; i < A.length; i++) r += Math.abs(A[i] - (B[i] || 0)) * 10 ** i; return r; }
function naiveMul(a, m) { const A = digitsR(a); let r = 0; A.forEach((x, i) => { r += ((x * m) % 10) * 10 ** i; }); return r; }
function clock(sec) { // 시각 표기 (12시간제)
  sec = ((sec % 43200) + 43200) % 43200;
  let h = Math.floor(sec / 3600); const m = Math.floor(sec / 60) % 60, s = sec % 60;
  if (h === 0) h = 12;
  return `${h}시` + (m || s ? ` ${m}분` : '') + (s ? ` ${s}초` : '');
}
function dur(sec, big = false) { // 시간 길이 표기
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
  const p = [];
  if (big && h) p.push(h + '시간');
  const mm = big ? m : Math.floor(sec / 60);
  if (mm) p.push(mm + '분');
  if (s) p.push(s + '초');
  return p.join(' ') || '0초';
}
const lenMC = (cm) => (cm >= 100 ? `${Math.floor(cm / 100)} m` + (cm % 100 ? ` ${cm % 100} cm` : '') : `${cm} cm`);
const lenKM = (m) => (m >= 1000 ? `${Math.floor(m / 1000)} km` + (m % 1000 ? ` ${m % 1000} m` : '') : `${m} m`);
const lenCMM = (mm) => (mm >= 10 ? `${Math.floor(mm / 10)} cm` + (mm % 10 ? ` ${mm % 10} mm` : '') : `${mm} mm`);
const volL = (ml) => (ml >= 1000 ? `${Math.floor(ml / 1000)} L` + (ml % 1000 ? ` ${ml % 1000} mL` : '') : `${ml} mL`);
const wtKG = (g) => (g >= 1000 ? `${Math.floor(g / 1000)} kg` + (g % 1000 ? ` ${g % 1000} g` : '') : `${g} g`);
const near = (x, ds = [1, -1, 2, -2, 10, -10]) => ds.map((d) => x + d).filter((v) => v >= 0);

// 보기 비교용 값 열쇠 (같은 값을 다른 꼴로 쓴 오답을 거른다)
const FAM = { mm: ['L', 1], cm: ['L', 10], m: ['L', 1000], km: ['L', 1e6], g: ['W', 1], kg: ['W', 1000], t: ['W', 1e6], mL: ['V', 1], L: ['V', 1000], 초: ['T', 1], 분: ['T', 60], 시간: ['T', 3600], 일: ['T', 86400], 주일: ['T', 604800], 'cm²': ['A', 1], 'm²': ['A', 1e4], 'cm³': ['C', 1], 'm³': ['C', 1e6] };
const MULT = { 만: 1e4, 억: 1e8, 조: 1e12 };
function canon(s) {
  s = String(s).trim();
  let m = s.match(/^(?:오전 |오후 )?(\d+)시(?: (\d+)분)?(?: (\d+)초)?$/);
  if (m) return 'T' + ((+m[1] * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0)) % 43200);
  const re = /^(?:(\d+)(?:과|와) (\d+)분의 (\d+)|(\d+)분의 (\d+)|(\d+(?:\.\d+)?)(조|억|만)?)\s*([A-Za-z°%²³가-힣]*)\s*/;
  let rest = s, toks = [];
  while (rest.length) {
    m = rest.match(re);
    if (!m || !m[0].length) return 'S' + s;
    let v;
    if (m[1]) v = +m[1] + +m[3] / +m[2];
    else if (m[4]) v = +m[5] / +m[4];
    else v = +m[6] * (m[7] ? MULT[m[7]] : 1);
    toks.push([v, m[8]]);
    rest = rest.slice(m[0].length);
  }
  const r = (x) => Math.round(x * 1e9) / 1e9;
  if (toks.every((t) => t[1] === '')) return 'N' + r(toks.reduce((a, t) => a + t[0], 0));
  if (toks.every((t) => FAM[t[1]]) && new Set(toks.map((t) => FAM[t[1]][0])).size === 1) return 'F' + FAM[toks[0][1]][0] + r(toks.reduce((a, t) => a + t[0] * FAM[t[1]][1], 0));
  if (toks.length === 1) return 'U' + toks[0][1] + r(toks[0][0]);
  return 'S' + s;
}

// ---------- 템플릿 등록 ----------
const TPL = {};
function T(code, u, std, gen) { (TPL[code] = TPL[code] || []).push({ u, std, gen }); }
// 사실 문제 묶음: [문제, 정답, 오답 후보, 해설, (성취기준)]
function F(code, u, std, items) {
  T(code, u, std, (R) => { const [q, a, pool, e, s] = R.pick(items); return { q, a, w: R.shuffle(pool), e, k: { k: 'fact' }, std: s || std }; });
}
// 가장 큰/작은 수 고르기
function extQ(R, vals, fmt, big, e) {
  const sorted = vals.slice().sort((x, y) => x - y);
  const ans = big ? sorted[sorted.length - 1] : sorted[0];
  return { q: `다음 중 가장 ${big ? '큰' : '작은'} 수는?`, a: fmt(ans), w: vals.filter((v) => v !== ans).map(fmt), e, k: { k: big ? 'max' : 'min' } };
}
const fx = (f, v, u = '') => ({ k: 'f', f, v, u });

// =====================================================================
// 1학년 1학기
// =====================================================================
const K1 = ['영', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
const K10 = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const ORD = ['첫째', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째', '여덟째', '아홉째'];
const kword = (n) => K10[Math.floor(n / 10)] + (n % 10 ? K1[n % 10] : '');

T('e1-1', 0, '[2수01-01]', (R) => {
  const up = R.chance(0.5), n = up ? R.int(0, 8) : R.int(1, 9), a = up ? n + 1 : n - 1;
  return { q: `${n}보다 1 ${up ? '큰' : '작은'} 수는?`, a, w: [n, up ? n - 1 : n + 1, up ? n + 2 : n - 2, a + 1, a - 1].filter((v) => v >= 0), e: `${n} 바로 ${up ? '다음' : '앞의'} 수는 ${ida(String(a))}`, k: fx('n+d', { n, d: up ? 1 : -1 }) };
});
T('e1-1', 0, '[2수01-03]', (R) => { const big = R.chance(0.5); return extQ(R, R.distinct(4, 0, 9), String, big, `수를 세는 순서에서 ${big ? '뒤에' : '앞에'} 있을수록 ${big ? '커요' : '작아요'}.`); });
T('e1-1', 0, '[2수01-01]', (R) => {
  const n = R.int(1, 9);
  if (R.chance(0.5)) return { q: `${eul(K1[n])} 수로 쓰면?`, a: n, w: R.shuffle(near(n, [1, -1, 2, -2, 3])).filter((v) => v > 0 && v < 10), e: `${eun(K1[n])} ${ro(String(n))} 써요.`, k: { k: 'kword', n, dir: 0 } };
  return { q: `${eul(String(n))} 세어서 바르게 읽은 것은?`, a: K1[n], w: R.shuffle(near(n, [1, -1, 2, -2, 3]).filter((v) => v > 0 && v < 10)).map((v) => K1[v]), e: `${n}은(는) ${K1[n]}(이)라고 세요.`.replace('은(는)', bat(String(n)) ? '은' : '는').replace('(이)라고', bat(K1[n]) ? '이라고' : '라고'), k: { k: 'kword', n, dir: 1 } };
});
T('e1-1', 0, '[2수01-01]', (R) => {
  if (R.chance(0.5)) {
    const p = R.int(2, 9);
    return { q: `줄의 앞에서 ${ORD[p - 1]}에 선 친구 앞에는 몇 명이 있나요?`, a: `${p - 1}명`, w: Us([p, p + 1, p - 2, p - 3].filter((v) => v >= 0), '명'), e: `${ORD[p - 1]} 앞에는 ${p - 1}명이 있어요.`, k: fx('p-1', { p }, '명') };
  }
  const x = R.int(1, 5), y = R.int(1, 5);
  if (x + y - 1 > 9 || x + y - 1 < 2) return null;
  return { q: `앞에서 ${ORD[x - 1]}, 뒤에서 ${ORD[y - 1]}에 선 친구가 있어요. 줄에 선 친구는 모두 몇 명?`, a: `${x + y - 1}명`, w: Us([x + y, x + y - 2, x + y + 1], '명'), e: `${x} + ${y}에서 그 친구를 두 번 세었으니 1을 빼요.`, k: fx('x+y-1', { x, y }, '명') };
});

const SH3 = { '상자 모양': ['주사위', '휴지 상자', '책', '냉장고', '선물 상자', '벽돌'], '둥근기둥 모양': ['음료수 캔', '풀', '두루마리 휴지', '북', '통조림', '분유통'], '공 모양': ['축구공', '구슬', '수박', '지구본', '야구공', '농구공'] };
const SH3N = Object.keys(SH3);
const shapeOf = (o) => SH3N.find((k) => SH3[k].includes(o));
T('e1-1', 1, '[2수03-01]', (R) => {
  const y = R.pick(SH3N), obj = R.pick(SH3[y]);
  const same = R.pick(SH3[y].filter((o) => o !== obj));
  const others = R.sample(SH3N.filter((k) => k !== y).flatMap((k) => SH3[k]), 3);
  return { q: `${wa(obj)} 같은 모양인 물건은?`, a: same, w: others, e: `${eun(obj)} ${y}, ${same}도 ${ida(y)}`, k: { k: 'shape3same', obj } };
});
T('e1-1', 1, '[2수03-01]', (R) => {
  const y = R.pick(SH3N), ans = R.pick(SH3[y]);
  const others = R.sample(SH3N.filter((k) => k !== y).flatMap((k) => SH3[k]), 3);
  return { q: `다음 중 ${y}인 물건은?`, a: ans, w: others, e: `${eun(ans)} ${ida(y)}`, k: { k: 'shape3pick', y } };
});
T('e1-1', 1, '[2수03-01]', (R) => {
  const all = SH3N.flatMap((k) => SH3[k]);
  const objs = R.sample(all, R.int(4, 5)), y = R.pick(SH3N);
  const c = objs.filter((o) => shapeOf(o) === y).length;
  if (c === 0) return null;
  return { q: `${objs.join(', ')} 중에서 ${y}은 몇 개인가요?`, a: `${c}개`, w: Us(near(c, [1, -1, 2, 3]).filter((v) => v <= objs.length), '개'), e: `${y}: ${objs.filter((o) => shapeOf(o) === y).join(', ')}`, k: { k: 'shape3count', objs, y } };
});
F('e1-1', 1, '[2수03-01]', [
  ['평평한 부분과 둥근 부분이 모두 있는 모양은?', '둥근기둥 모양', ['상자 모양', '공 모양', '없어요'], '둥근기둥 모양은 위아래가 평평하고 옆이 둥글어요.'],
  ['평평한 부분만 있는 모양은?', '상자 모양', ['둥근기둥 모양', '공 모양', '없어요'], '상자 모양은 평평한 면만 있어요.'],
  ['평평한 부분이 없는 모양은?', '공 모양', ['상자 모양', '둥근기둥 모양', '없어요'], '공 모양은 모든 부분이 둥글어요.'],
  ['어느 쪽으로 굴려도 잘 굴러가는 모양은?', '공 모양', ['상자 모양', '둥근기둥 모양', '없어요'], '공 모양은 모든 쪽이 둥글어 잘 굴러가요.'],
  ['잘 굴러가지 않고 쌓기 쉬운 모양은?', '상자 모양', ['둥근기둥 모양', '공 모양', '없어요'], '상자 모양은 평평한 면만 있어 잘 쌓여요.'],
  ['눕히면 잘 굴러가고 세우면 쌓을 수 있는 모양은?', '둥근기둥 모양', ['상자 모양', '공 모양', '없어요'], '둥근기둥 모양은 옆이 둥글고 위아래가 평평해요.'],
]);
const ITEMS = ['사탕', '구슬', '딱지', '쿠키', '색종이', '스티커', '단추'];
T('e1-1', 2, '[2수01-04]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(1, 8), b = R.int(1, 9 - a), s = a + b;
    return { q: `${wa(String(a))} ${eul(String(b))} 모으면 얼마인가요?`, a: s, w: [s + 1, s - 1, Math.abs(a - b), s + 2].filter((v) => v >= 0), e: `${wa(String(a))} ${eul(String(b))} 모으면 ${ida(String(s))}`, k: fx('a+b', { a, b }) };
  }
  const n = R.int(2, 9), a = R.int(1, n - 1), r = n - a;
  return { q: `${eun(String(n))} ${wa(String(a))} 몇으로 가를 수 있나요?`, a: r, w: [r + 1, r - 1, n + a, r + 2, n].filter((v) => v > 0), e: `${wa(String(a))} ${eul(String(r))} 모으면 ${n}이니까 ${ida(String(r))}`, k: fx('n-a', { n, a }) };
});
T('e1-1', 2, '[2수01-05]', (R) => {
  const it = R.pick(ITEMS);
  if (R.chance(0.5)) {
    const a = R.int(1, 8), b = R.int(1, 9 - a), s = a + b;
    return { q: `${it} ${a}개에 ${b}개를 더 받았어요. 모두 몇 개?`, a: `${s}개`, w: Us([s - 1, s + 1, Math.abs(a - b), s + 2], '개'), e: `${a} + ${b} = ${s}`, k: fx('a+b', { a, b }, '개') };
  }
  const a = R.int(3, 9), b = R.int(1, a - 1), r = a - b;
  return { q: `${it} ${a}개 중에서 ${b}개를 동생에게 주었어요. 남은 것은 몇 개?`, a: `${r}개`, w: Us([r + 1, r - 1, a + b, b], '개'), e: `${a} − ${b} = ${r}`, k: fx('a-b', { a, b }, '개') };
});
T('e1-1', 2, '[2수01-06]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(0, 9), b = R.int(0, 9 - a), s = a + b;
    return { q: `${a} + ${b} = ?`, a: s, w: [s + 1, s - 1, Math.abs(a - b), s + 2].filter((v) => v >= 0), e: b === 0 ? '어떤 수에 0을 더하면 그대로예요.' : `${a}에서 ${b}만큼 이어 세면 ${ida(String(s))}`, k: { k: 'qx' } };
  }
  const a = R.int(1, 9), b = R.int(0, a), r = a - b;
  return { q: `${a} − ${b} = ?`, a: r, w: [r + 1, r - 1, a + b, r + 2].filter((v) => v >= 0), e: b === 0 ? '어떤 수에서 0을 빼면 그대로예요.' : `${a}에서 ${b}만큼 거꾸로 세면 ${ida(String(r))}`, k: { k: 'qx' } };
});
const CHAIN = {
  무게: [['깃털', '지우개', '사과', '수박', '자동차'], '더 무거운', '더 가벼운'],
  길이: [['개미', '클립', '연필', '우산', '기차'], '더 긴', '더 짧은'],
  키: [['병아리', '고양이', '어린이', '기린'], '키가 더 큰', '키가 더 작은'],
  넓이: [['우표', '공책', '책상', '교실', '운동장'], '더 넓은', '더 좁은'],
  들이: [['숟가락', '컵', '주전자', '양동이', '욕조'], '더 많이 담을 수 있는', '더 적게 담기는'],
};
T('e1-1', 3, '[2수03-06]', (R) => {
  const dim = R.pick(Object.keys(CHAIN)), [ch, more, less] = CHAIN[dim];
  const [i, j] = R.sample([...ch.keys()], 2), A = ch[i], B = ch[j], isMore = R.chance(0.5);
  const ans = (isMore ? i > j : i < j) ? A : B;
  return { q: `${wa(A)} ${B} 중 ${isMore ? more : less} 것은?`, a: ans, w: [ans === A ? B : A, '둘이 같아요', '알 수 없어요'], e: `${ans}${bat(ans) ? '이' : '가'} ${isMore ? more : less} 쪽이에요.`, k: { k: 'cmpfact', dim, more: isMore, a: A, b: B } };
});
T('e1-1', 3, '[2수03-06]', (R) => {
  const x = R.int(2, 9), y = R.chance(0.15) ? x : R.int(2, 9);
  const kind = R.pick([['빨간 끈', '파란 끈', '클립', ' 길이예요. 더 긴 것은?'], ['주전자', '물병', '컵', '만큼 물이 들어가요. 더 많이 담기는 것은?']]);
  const [A, B, unit, tail] = kind;
  const ans = x === y ? '둘이 같아요' : x > y ? A : B;
  return { q: `${eun(A)} ${unit} ${x}개, ${eun(B)} ${unit} ${y}개${tail}`, a: ans, w: [A, B, '둘이 같아요', '알 수 없어요'].filter((s) => s !== ans), e: x === y ? '같은 수만큼이니 둘이 같아요.' : `${unit} 수가 더 많은 ${ans}${bat(ans) ? '이에요' : '예요'}.`, k: { k: 'cmpn', x, y, A, B } };
});
F('e1-1', 3, '[2수03-06]', [
  ['길이를 비교할 때 쓰는 말은?', '길다, 짧다', ['무겁다, 가볍다', '많다, 적다', '넓다, 좁다'], '길이는 길다, 짧다로 비교해요.'],
  ['무게를 비교할 때 쓰는 말은?', '무겁다, 가볍다', ['길다, 짧다', '많다, 적다', '넓다, 좁다'], '무게는 무겁다, 가볍다로 비교해요.'],
  ['넓이를 비교할 때 쓰는 말은?', '넓다, 좁다', ['길다, 짧다', '많다, 적다', '무겁다, 가볍다'], '넓이는 넓다, 좁다로 비교해요.'],
  ['담긴 양을 비교할 때 쓰는 말은?', '많다, 적다', ['길다, 짧다', '넓다, 좁다', '무겁다, 가볍다'], '담긴 양은 많다, 적다로 비교해요.'],
]);
T('e1-1', 4, '[2수01-02]', (R) => {
  const t = R.int(1, 5), o = t === 5 ? 0 : R.int(0, 9), n = 10 * t + o;
  return { q: `10개씩 묶음 ${t}개와 낱개 ${o}개는?`, a: n, w: R.shuffle([o > 0 ? 10 * o + t : null, t + o, n + 10, n - 10, n + 1].filter((v) => v !== null && v > 0)), e: `10개씩 ${t}묶음은 ${10 * t}, 낱개 ${o}개를 더해 ${n}`, k: fx('10*t+o', { t, o }) };
});
T('e1-1', 4, '[2수01-02]', (R) => {
  const t = R.int(1, 4), o = R.int(1, 9), n = 10 * t + o;
  const f = (a, b) => `묶음 ${a}개, 낱개 ${b}개`;
  return { q: `${eun(String(n))} 10개씩 묶음 몇 개와 낱개 몇 개인가요?`, a: f(t, o), w: R.shuffle([f(o, t), f(t + 1, o), f(t, o + 1 > 9 ? o - 1 : o + 1), f(t - 1, o)].filter((s) => !/ 0개, 낱/.test(s))), e: `${n}은(는) 10개씩 ${t}묶음과 낱개 ${o}개예요.`.replace('은(는)', bat(String(n)) ? '은' : '는'), k: { k: 'tens', n } };
});
T('e1-1', 4, '[2수01-03]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const big = R.chance(0.5); return extQ(R, R.distinct(4, 10, 50), String, big, '10개씩 묶음의 수를 먼저 비교해요.'); }
  if (r === 2) {
    const up = R.chance(0.5), n = up ? R.int(10, 49) : R.int(11, 50), a = up ? n + 1 : n - 1;
    return { q: up ? `${n}보다 1 큰 수는?` : `${n} 바로 앞의 수는?`, a, w: R.shuffle([n, up ? n - 1 : n + 1, a + 10, a - 10]).filter((v) => v > 0), e: `${n}보다 1 ${up ? '큰' : '작은'} 수는 ${ida(String(a))}`, k: fx('n+d', { n, d: up ? 1 : -1 }) };
  }
  const n = R.int(10, 47);
  return { q: `${wa(String(n))} ${n + 2} 사이에 있는 수는?`, a: n + 1, w: [n, n + 2, n + 3, n - 1], e: `${n} 다음 수는 ${n + 1}, 그다음이 ${n + 2}`, k: fx('n+1', { n }) };
});
T('e1-1', 4, '[2수01-04]', (R) => {
  const a = R.int(1, 9), r = 10 - a;
  return { q: `10은 ${wa(String(a))} 몇으로 가를 수 있나요?`, a: r, w: [r + 1, r - 1, a, 10 + a, r + 2].filter((v) => v > 0), e: `${wa(String(a))} ${eul(String(r))} 모으면 ${ida('10')}`, k: fx('10-a', { a }) };
});

// =====================================================================
// 1학년 2학기
// =====================================================================
T('e1-2', 0, '[2수01-02]', (R) => {
  const t = R.int(5, 9), o = R.int(0, 9), n = 10 * t + o;
  return { q: `10개씩 묶음 ${t}개와 낱개 ${o}개는?`, a: n, w: R.shuffle([o > 0 ? 10 * o + t : 100 * t, t + o, n + 10, n - 10, n + 1].filter((v) => v > 0)), e: `${10 * t} + ${o} = ${n}`, k: fx('10*t+o', { t, o }) };
});
T('e1-2', 0, '[2수01-01]', (R) => {
  const n = R.int(5, 9) * 10 + (R.chance(0.3) ? 0 : R.int(1, 9));
  return { q: `${eul(kword(n))} 수로 쓰면?`, a: n, w: R.shuffle([n + 10, n - 10, (n % 10) * 10 + Math.floor(n / 10), n + 1, n - 1].filter((v) => v > 0 && v < 100)), e: `${K10[Math.floor(n / 10)]}은(는) ${Math.floor(n / 10) * 10}`.replace('은(는)', bat(K10[Math.floor(n / 10)]) ? '은' : '는') + (n % 10 ? `, ${K1[n % 10]}은(는) ${n % 10}`.replace('은(는)', bat(K1[n % 10]) ? '은' : '는') : ''), k: { k: 'kword', n, dir: 0 } };
});
T('e1-2', 0, '[2수01-03]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const big = R.chance(0.5); return extQ(R, R.distinct(4, 50, 100), String, big, '10개씩 묶음의 수가 클수록 큰 수예요.'); }
  if (r === 2) {
    const up = R.chance(0.5), n = up ? R.int(50, 99) : R.int(51, 100), a = up ? n + 1 : n - 1;
    return { q: up ? `${n}보다 1 큰 수는?` : `${n}보다 1 작은 수는?`, a, w: R.shuffle([n, up ? n - 1 : n + 1, a + 10, a - 10]).filter((v) => v > 0 && v <= 110), e: `${n} 바로 ${up ? '다음' : '앞의'} 수는 ${ida(String(a))}`, k: fx('n+d', { n, d: up ? 1 : -1 }) };
  }
  const even = R.chance(0.5);
  const good = R.int(5, 49) * 2 + (even ? 0 : 1);
  const bad = R.distinct(3, 11, 99, (v) => (v % 2 === 0) !== even && v !== good);
  return { q: `다음 중 ${even ? '짝수' : '홀수'}는?`, a: good, w: bad, e: `일의 자리가 ${even ? '0, 2, 4, 6, 8' : '1, 3, 5, 7, 9'}이면 ${even ? '짝수' : '홀수'}예요.`, k: { k: 'pick', p: even ? 'even' : 'odd' } };
});
T('e1-2', 1, '[2수01-06]', (R) => {
  const add = R.chance(0.5), two = R.chance(0.5);
  if (add) {
    const a = R.int(1, 8) * 10 + R.int(0, 8);
    const b = two ? R.int(1, 9 - Math.floor(a / 10)) * 10 + R.int(0, 9 - (a % 10)) : R.int(1, 9 - (a % 10));
    if (b <= 0 || (a % 10) + (b % 10) > 9) return null;
    const s = a + b;
    return { q: `${a} + ${b} = ?`, a: s, w: R.shuffle([two ? s - 10 : a + 10 * b, s + 1, s - 1, s + 10].filter((v) => v > 0 && v < 200)), e: two ? `십의 자리끼리, 일의 자리끼리 더해 ${s}` : `낱개끼리 ${a % 10} + ${b} = ${(a % 10) + b}, 그래서 ${s}`, k: { k: 'qx' } };
  }
  const a = R.int(2, 9) * 10 + R.int(1, 9);
  const b = two ? R.int(1, Math.floor(a / 10) - 1) * 10 + R.int(0, a % 10) : R.int(1, a % 10);
  const r = a - b;
  return { q: `${a} − ${b} = ?`, a: r, w: R.shuffle([two ? r + 10 : a - 10 * b, r + 1, r - 1, a + b <= 99 ? a + b : r + 2].filter((v) => v >= 0)), e: two ? `십의 자리끼리, 일의 자리끼리 빼서 ${r}` : `낱개끼리 ${a % 10} − ${b} = ${(a % 10) - b}, 그래서 ${r}`, k: { k: 'qx' } };
});
T('e1-2', 1, '[2수01-06]', (R) => {
  const it = R.pick(ITEMS);
  const a = R.int(2, 7) * 10 + R.int(1, 5), b = R.int(1, 2) * 10 + R.int(0, 4);
  if (R.chance(0.5)) { const s = a + b; return { q: `${it} ${a}개가 있었는데 ${b}개를 더 샀어요. 모두 몇 개?`, a: `${s}개`, w: Us([s - 10, s + 10, a - b, s + 1], '개'), e: `${a} + ${b} = ${s}`, k: fx('a+b', { a, b }, '개') }; }
  const r = a - b;
  return { q: `${it} ${a}개 중에서 ${b}개를 친구에게 주었어요. 남은 것은 몇 개?`, a: `${r}개`, w: Us([r + 10, r - 10, a + b, r + 1], '개'), e: `${a} − ${b} = ${r}`, k: fx('a-b', { a, b }, '개') };
});
F('e1-2', 2, '[2수03-03]', [
  ['뾰족한 곳이 3군데 있는 모양은?', '세모 모양', ['네모 모양', '동그라미 모양', '별 모양'], '세모 모양은 뾰족한 곳이 3군데예요.'],
  ['뾰족한 곳이 4군데 있는 모양은?', '네모 모양', ['세모 모양', '동그라미 모양', '별 모양'], '네모 모양은 뾰족한 곳이 4군데예요.'],
  ['뾰족한 곳이 하나도 없는 모양은?', '동그라미 모양', ['세모 모양', '네모 모양', '별 모양'], '동그라미 모양은 둥글어서 뾰족한 곳이 없어요.'],
  ['곧은 선이 없고 둥근 선만 있는 모양은?', '동그라미 모양', ['세모 모양', '네모 모양', '별 모양'], '동그라미 모양은 둥근 선으로만 되어 있어요.'],
  ['동전이나 접시를 본떠 그리면 나오는 모양은?', '동그라미 모양', ['세모 모양', '네모 모양', '별 모양'], '동전과 접시의 바닥은 둥글어요.'],
  ['공책이나 액자를 본떠 그리면 나오는 모양은?', '네모 모양', ['세모 모양', '동그라미 모양', '별 모양'], '공책과 액자는 뾰족한 곳이 4군데예요.'],
]);
T('e1-2', 2, '[2수03-03]', (R) => {
  const a = R.int(1, 3), b = R.int(1, 2), s = 3 * a + 4 * b;
  return { q: `세모 모양 ${a}개와 네모 모양 ${b}개의 뾰족한 곳은 모두 몇 군데?`, a: `${s}군데`, w: Us([s + 1, s - 1, 4 * a + 3 * b, a + b], '군데'), e: `세모는 3군데, 네모는 4군데씩 세어 더해요.`, k: { k: 'polysum', names: [...Array(a).fill('삼각형'), ...Array(b).fill('사각형')], u: '군데' } };
});
T('e1-2', 2, '[2수03-07]', (R) => {
  const h = R.int(1, 12), half = R.chance(0.5), nh = (h % 12) + 1;
  if (!half) return { q: `짧은바늘이 ${h}, 긴바늘이 12를 가리키면 몇 시?`, a: `${h}시`, w: R.shuffle([`${h}시 30분`, `12시 ${h * 5 < 60 ? h * 5 : 30}분`, `${nh}시`, `12시`]), e: `긴바늘이 12면 정각, 짧은바늘이 ${h}이니 ${ida(h + '시')}`, k: { k: 'clock', h, m: 0 } };
  return { q: `짧은바늘이 ${h}와(과) ${nh} 사이, 긴바늘이 6을 가리키면?`.replace('와(과)', bat(String(h)) ? '과' : '와'), a: `${h}시 30분`, w: R.shuffle([`${nh}시 30분`, `${h}시 6분`, `6시 ${h * 5}분`, `${h}시`]), e: `긴바늘이 6이면 30분, 짧은바늘은 ${eul(String(h))} 지났어요.`, k: { k: 'clock', h, m: 30 } };
});
T('e1-2', 2, '[2수03-07]', (R) => {
  const h = R.int(1, 12), half = R.chance(0.6);
  if (half) return { q: `${h}시 30분일 때 긴바늘이 가리키는 숫자는?`, a: '6', w: R.shuffle(['12', '3', String(h), '9'].filter((s) => s !== '6')), e: '30분일 때 긴바늘은 6을 가리켜요.', k: { k: 'clockhand', h, m: 30, hand: 'long' } };
  return { q: `${h}시 정각일 때 짧은바늘이 가리키는 숫자는?`, a: String(h), w: R.shuffle(['12', '6', String((h % 12) + 1), String(h === 1 ? 12 : h - 1)]), e: `정각일 때 짧은바늘은 ${eul(String(h))} 가리켜요.`, k: { k: 'clockhand', h, m: 0, hand: 'short' } };
});
T('e1-2', 3, '[2수01-04]', (R) => {
  const a = R.int(1, 9), r = 10 - a;
  return { q: `${a}에 얼마를 더하면 10이 될까요?`, a: r, w: [r + 1, r - 1, 10 + a, r + 2].filter((v) => v > 0), e: `${wa(String(a))} ${eul(String(r))} 모으면 ${ida('10')}`, k: fx('10-a', { a }) };
});
T('e1-2', 3, '[2수01-08]', (R) => {
  const p = R.int(1, 4);
  if (p === 1) { const a = R.int(1, 9), b = 10 - a, c = R.int(1, 9), s = 10 + c; return { q: `${a} + ${b} + ${c} = ?`, a: s, w: [s - 1, s + 1, 10, s + 10], e: `${a} + ${b} = 10을 먼저 하고 ${eul(String(c))} 더해 ${s}`, k: { k: 'qx' } }; }
  if (p === 2) { const a = R.int(1, 9), b = R.int(1, 9), c = 10 - b, s = a + 10; return { q: `${a} + ${b} + ${c} = ?`, a: s, w: [s - 1, s + 1, 10, a + b], e: `${b} + ${c} = 10을 먼저 하면 ${a} + 10 = ${s}`, k: { k: 'qx' } }; }
  if (p === 3) { const a = R.int(5, 9), b = R.int(1, a - 2), c = R.int(1, a - b - 1), r = a - b - c; return { q: `${a} − ${b} − ${c} = ?`, a: r, w: [r + 1, a - b + c, r + 2, Math.max(0, r - 1)].filter((v) => v >= 0), e: `앞에서부터 ${a} − ${b} = ${a - b}, ${a - b} − ${c} = ${r}`, k: { k: 'qx' } }; }
  const a = R.int(1, 9), r = 10 - a;
  return { q: `10 − ${a} = ?`, a: r, w: [r + 1, r - 1, 10 + a, a].filter((v) => v >= 0), e: `${wa(String(r))} ${eul(String(a))} 모으면 10이니 ${ida(String(r))}`, k: { k: 'qx' } };
});
T('e1-2', 3, '[2수01-08]', (R) => {
  const it = R.pick(ITEMS), a = R.int(2, 8), b = 10 - a, c = R.int(1, 9);
  return { q: `${it}${bat(it) ? '을' : '를'} 오빠는 ${a}개, 나는 ${b}개, 동생은 ${c}개 가졌어요. 모두 몇 개?`, a: `${10 + c}개`, w: Us([9 + c, 11 + c, 10, a + b + c + 10], '개'), e: `${a} + ${b} = 10, 10 + ${c} = ${10 + c}`, k: fx('a+b+c', { a, b, c }, '개') };
});
const COLORS = ['빨강', '파랑', '노랑', '초록', '보라'];
const FRUITS = ['사과', '배', '귤', '포도', '딸기'];
function patQ(R, pool) {
  const kind = R.pick(['AB', 'AAB', 'ABB', 'ABC', 'AABB']);
  const items = R.sample(pool, 4);
  const unit = kind.split('').map((ch) => items[ch.charCodeAt(0) - 65]);
  const p = unit.length, len = R.int(2 * p + 1, 2 * p + 2);
  const seq = Array.from({ length: len }, (_, i) => unit[i % p]);
  const ans = unit[len % p];
  return { q: `${seq.join(', ')} 다음에 올 것은?`, a: ans, w: items.filter((x) => x !== ans), e: `${unit.join(', ')}이(가) 되풀이돼요.`.replace('이(가)', bat(unit[p - 1]) ? '이' : '가'), k: { k: 'pat' } };
}
T('e1-2', 4, '[2수02-01]', (R) => patQ(R, R.chance(0.5) ? COLORS : FRUITS));
function seqQ(R, start, step, len, geo = false) {
  const s = Array.from({ length: len }, (_, i) => (geo ? start * step ** i : start + step * i));
  const nx = geo ? s[len - 1] * step : s[len - 1] + step;
  const w = geo ? [s[len - 1] + (s[len - 1] - s[len - 2]), nx + step, s[len - 1] * (step + 1), nx * step] : [nx + 1, nx - 1, nx + step, s[len - 1] + 1, nx + 10];
  return { q: `${s.join(', ')} 다음에 올 수는?`, a: nx, w: R.shuffle(w.filter((v) => v > 0 && v !== nx)), e: geo ? `${step}씩 곱하는 규칙이라 ${s[len - 1]} × ${step} = ${nx}` : `${step}씩 커지는 규칙이라 ${s[len - 1]} + ${step} = ${nx}`, k: { k: 'seq' } };
}
function seqGapQ(R, start, step, len) {
  const s = Array.from({ length: len }, (_, i) => start + step * i);
  const gi = R.int(1, len - 2), ans = s[gi];
  const shown = s.map((v, i) => (i === gi ? '□' : v));
  return { q: `${shown.join(', ')}에서 □에 알맞은 수는?`, a: ans, w: R.shuffle([ans + 1, ans - 1, ans + step, s[gi - 1] + 1, ans + 10].filter((v) => v > 0 && v !== ans)), e: `${step}씩 커지므로 ${s[gi - 1]} + ${step} = ${ans}`, k: { k: 'seqgap' } };
}
T('e1-2', 4, '[2수02-01]', (R) => {
  const step = R.pick([1, 2, 3, 5, 10]), len = R.int(4, 5), start = R.int(1, 30);
  if (start + step * len > 100) return null;
  return R.chance(0.6) ? seqQ(R, start, step, len) : seqGapQ(R, start, step, len);
});
T('e1-2', 4, '[2수02-01]', (R) => {
  const n = R.int(11, 89), down = R.chance(0.6);
  const a = down ? n + 10 : n - 10;
  return { q: `1부터 100까지의 수 배열표에서 ${n} 바로 ${down ? '아래' : '위'} 칸의 수는?`, a, w: R.shuffle([down ? n + 1 : n - 1, down ? n + 11 : n - 11, down ? n + 9 : n - 9, down ? n - 10 : n + 10]), e: `한 줄에 10개씩이라 ${down ? '아래' : '위'} 칸은 10 ${down ? '커요' : '작아요'}.`, k: fx(down ? 'n+10' : 'n-10', { n }) };
});
T('e1-2', 5, '[2수01-06]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(2, 9), b = R.int(Math.max(2, 11 - a), 9), s = a + b;
    return { q: `${a} + ${b} = ?`, a: s, w: R.shuffle([s - 10, s + 1, s - 1, s + 10]), e: `${a}에 ${10 - a}을(를) 더해 10, 남은 ${b - (10 - a)}을(를) 더해 ${s}`.replace(/(\d+)을\(를\)/g, (m, d) => eul(d)), k: { k: 'qx' } };
  }
  const o = R.int(1, 8), a = 10 + o, b = R.int(o + 1, 9), r = a - b;
  return { q: `${a} − ${b} = ?`, a: r, w: R.shuffle([b - o, r + 1, r - 1, r + 10].filter((v) => v >= 0)), e: `${a}에서 ${o}을(를) 빼 10, ${b - o}을(를) 더 빼 ${r}`.replace(/(\d+)을\(를\)/g, (m, d) => eul(d)), k: { k: 'qx' } };
});
T('e1-2', 5, '[2수01-06]', (R) => {
  const it = R.pick(ITEMS);
  if (R.chance(0.5)) { const a = R.int(3, 9), b = R.int(Math.max(2, 11 - a), 9), s = a + b; return { q: `${it} ${a}개와 ${b}개를 합하면 모두 몇 개?`, a: `${s}개`, w: Us([s - 10, s + 1, s - 1, s + 10], '개'), e: `${a} + ${b} = ${s}`, k: fx('a+b', { a, b }, '개') }; }
  const o = R.int(1, 8), a = 10 + o, b = R.int(o + 1, 9), r = a - b;
  return { q: `${it} ${a}개 중 ${b}개를 친구에게 주었어요. 남은 것은 몇 개?`, a: `${r}개`, w: Us([b - o, r + 1, r - 1, a + b], '개'), e: `${a} − ${b} = ${r}`, k: fx('a-b', { a, b }, '개') };
});

// =====================================================================
// 2학년 1학기
// =====================================================================
function placeT(code, lo, hi, nd) {
  // 자릿값 모으기
  T(code, 0, '[2수01-02]', (R) => {
    const ds = [R.int(1, 9), ...Array.from({ length: nd - 1 }, () => (R.chance(0.25) ? 0 : R.int(0, 9)))];
    const n = +ds.join('');
    const names = ['1000', '100', '10', '1'].slice(4 - nd);
    const parts = ds.map((d, i) => (d ? `${names[i]}이 ${d}개` : null)).filter(Boolean);
    const nz = +ds.filter((d) => d).join('');
    const rev = +ds.slice().reverse().join('');
    return { q: `${parts.join(', ')}인 수는?`, a: n, w: R.shuffle([nz !== n ? nz : null, rev !== n && rev >= lo ? rev : null, n + 10 ** (nd - 2), n - 10 ** (nd - 2), n * 10].filter((v) => v !== null && v > 0)), e: ds.map((d, i) => d * 10 ** (nd - 1 - i)).filter((x) => x).join(' + ') + ` = ${n}`, k: { k: 'compose', parts: ds.map((d, i) => [10 ** (nd - 1 - i), d]) } };
  });
  // 숫자가 나타내는 값
  T(code, 0, '[2수01-02]', (R) => {
    const ds = R.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], nd);
    const n = +ds.join(''), pi = R.int(0, nd - 1), d = ds[pi], v = d * 10 ** (nd - 1 - pi);
    const pname = ['일', '십', '백', '천'][nd - 1 - pi];
    return { q: `${n}에서 ${iga(String(d))} 나타내는 값은?`, a: v, w: R.shuffle([0, 1, 2, 3].slice(0, nd + 1).map((p) => d * 10 ** p).filter((x) => x !== v)), e: `${d}은(는) ${pname}의 자리 숫자라서 ${ida(String(v))}`.replace('은(는)', bat(String(d)) ? '은' : '는'), k: { k: 'pv', n, d } };
  });
  // 뛰어 세기, 1 큰 수
  T(code, 0, '[2수01-03]', (R) => {
    if (R.chance(0.4)) {
      const up = R.chance(0.5);
      const n = R.chance(0.5) ? R.int(lo / 100, hi / 100 - 1) * 100 + 99 - (nd === 4 && R.chance(0.5) ? 0 : 0) : R.int(lo, hi - 1);
      const n2 = up ? n : n + 1, a = up ? n2 + 1 : n2 - 1;
      return { q: up ? `${n2}보다 1 큰 수는?` : `${n2}보다 1 작은 수는?`, a, w: R.shuffle([n2, up ? n2 - 1 : n2 + 1, a + 10, a - 10, a + 100]).filter((v) => v > 0), e: `${n2} 바로 ${up ? '다음' : '앞의'} 수는 ${ida(String(a))}`, k: fx('n+d', { n: n2, d: up ? 1 : -1 }) };
    }
    const s = R.pick(nd === 3 ? [10, 100] : [10, 100, 1000]), k = R.int(2, 4);
    const n = R.int(lo, hi - s * k);
    const a = n + s * k;
    return { q: `${n}에서 ${s}씩 ${k}번 뛰어 센 수는?`, a, w: R.shuffle([n + s * (k - 1), n + s * (k + 1), n + (s === 10 ? 100 : s / 10) * k, n + s * 10 * k > 9999 ? null : n + s * 10 * k].filter((v) => v !== null && v !== a)), e: `${s}씩 ${k}번: ${n} → ${a}`, k: fx('n+s*k', { n, s, k }) };
  });
  T(code, 0, '[2수01-03]', (R) => {
    const base = R.int(lo, hi - 200), big = R.chance(0.5);
    const vals = R.distinct(4, base, base + (nd === 3 ? 120 : 1200));
    return extQ(R, vals, String, big, nd === 3 ? '백의 자리, 십의 자리 순서로 비교해요.' : '천의 자리부터 차례로 비교해요.');
  });
}
placeT('e2-1', 100, 999, 3);
const POLY = { 3: '삼각형', 4: '사각형', 5: '오각형', 6: '육각형', 7: '칠각형', 8: '팔각형', 9: '구각형', 10: '십각형' };
const POLYN = Object.fromEntries(Object.entries(POLY).map(([k, v]) => [v, +k]));
T('e2-1', 1, '[2수03-05]', (R) => {
  const n = R.int(3, 6), name = POLY[n], what = R.pick(['변', '꼭짓점']);
  if (R.chance(0.5)) return { q: `${name}의 ${eun(what)} 몇 개인가요?`, a: `${n}개`, w: Us([n + 1, n - 1, n + 2, 0].filter((v) => v !== n), '개'), e: `${eun(name)} ${what}이 ${n}개예요.`.replace(`${what}이`, iga(what)), k: { k: 'polyside', name } };
  return { q: `${what}이 ${n}개인 도형은?`.replace(`${what}이`, iga(what)), a: name, w: R.shuffle([3, 4, 5, 6].filter((v) => v !== n).map((v) => POLY[v]).concat(['원'])).slice(0, 3), e: `${what}이 ${n}개인 도형은 ${ida(name)}`.replace(`${what}이`, iga(what)), k: { k: 'polyname', n } };
});
T('e2-1', 1, '[2수03-05]', (R) => {
  const [x, y] = R.sample([3, 4, 5, 6], 2), cx = R.int(1, 2), cy = R.int(1, 2);
  const names = [...Array(cx).fill(POLY[x]), ...Array(cy).fill(POLY[y])], s = cx * x + cy * y, what = R.pick(['변', '꼭짓점']);
  return { q: `${POLY[x]} ${cx}개와 ${POLY[y]} ${cy}개의 ${eun(what)} 모두 몇 개인가요?`, a: `${s}개`, w: Us([s + 1, s - 1, x + y, cx * y + cy * x !== s ? cx * y + cy * x : s + 2], '개'), e: `${Array(cx).fill(x).concat(Array(cy).fill(y)).join(' + ')} = ${s}`, k: { k: 'polysum', names, u: '개' } };
});
F('e2-1', 1, '[2수03-04]', [
  ['원에 대한 설명으로 옳은 것은?', '곧은 선이 없어요', ['꼭짓점이 1개 있어요', '변이 4개예요', '뾰족한 곳이 있어요'], '원은 굽은 선으로만 되어 있어요.'],
  ['곧은 선 3개로 둘러싸인 도형은?', '삼각형', ['사각형', '원', '오각형'], '곧은 선 3개로 둘러싸이면 삼각형이에요.', '[2수03-05]'],
  ['도형에서 곧은 선을 무엇이라 하나요?', '변', ['꼭짓점', '원', '면'], '도형의 곧은 선을 변이라 해요.', '[2수03-05]'],
  ['도형에서 두 곧은 선이 만나는 점은?', '꼭짓점', ['변', '중심', '면'], '두 변이 만나는 점이 꼭짓점이에요.', '[2수03-05]'],
  ['변과 꼭짓점이 없는 도형은?', '원', ['삼각형', '사각형', '육각형'], '원은 굽은 선으로만 되어 있어요.'],
]);
T('e2-1', 2, '[2수01-06]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(1, 8) * 10 + R.int(2, 9), b = R.int(1, 8) * 10 + R.int(10 - (a % 10), 9);
    const s = a + b;
    return { q: `${a} + ${b} = ?`, a: s, w: R.shuffle([s - 10, Number(`${Math.floor(a / 10) + Math.floor(b / 10)}${(a % 10) + (b % 10)}`), s + 10, s + 1]), e: `일의 자리 ${(a % 10) + (b % 10)}에서 받아올림해 ${s}`, k: { k: 'qx' } };
  }
  const a = R.int(3, 9) * 10 + R.int(0, 8), b = R.int(1, Math.floor(a / 10) - 1) * 10 + R.int((a % 10) + 1, 9), r = a - b;
  return { q: `${a} − ${b} = ?`, a: r, w: R.shuffle([naiveSub(a, b), r + 10, r - 1, a + b].filter((v) => v >= 0 && v !== r)), e: `십의 자리에서 받아내려 일의 자리를 계산하면 ${r}`, k: { k: 'qx' } };
});
T('e2-1', 2, '[2수01-09]', (R) => {
  const x = R.int(12, 59), b = R.int(12, 39), c = x + b;
  if (R.chance(0.5)) return { q: `□ + ${b} = ${c}일 때 □는?`, a: x, w: R.shuffle([c + b, x + 10, x - 10, x + 1].filter((v) => v > 0)), e: `□ = ${c} − ${b} = ${x}`, k: fx('c-b', { c, b }) };
  return { q: `${c} − □ = ${x}일 때 □는?`, a: b, w: R.shuffle([c + x, b + 10, b - 10, b + 1].filter((v) => v > 0)), e: `□ = ${c} − ${x} = ${b}`, k: fx('c-x', { c, x }) };
});
T('e2-1', 2, '[2수01-07]', (R) => {
  const a = R.int(15, 49), b = R.int(12, 49);
  if (a === b) return null;
  const c = a + b;
  const good = R.chance(0.5) ? `${c} − ${b} = ${a}` : `${c} − ${a} = ${b}`;
  return { q: `${a} + ${b} = ${eul(String(c))} 뺄셈식으로 바르게 쓴 것은?`, a: good, w: R.shuffle([`${a} − ${b} = ${c}`, `${c} − ${a} = ${a}`, `${c} + ${b} = ${a}`, `${b} − ${a} = ${c}`]), e: `전체 ${c}에서 한 부분을 빼면 다른 부분이 돼요.`, k: { k: 'eqtrue' } };
});
T('e2-1', 3, '[2수03-10]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(0, 6), b = R.int(a + 2, 15), l = b - a;
    return { q: `자의 ${a} cm 눈금부터 ${b} cm 눈금까지 놓인 끈의 길이는?`, a: `${l} cm`, w: Us([b, l + 1, l - 1, a + b].filter((v) => v !== l && v > 0), 'cm'), e: `1 cm가 ${b} − ${a} = ${l}번이에요.`, k: fx('b-a', { a, b }, 'cm') };
  }
  const n = R.int(3, 19);
  return { q: `1 cm가 ${n}번인 길이는 몇 cm인가요?`, a: `${n} cm`, w: Us([n + 1, n - 1, n * 10, 1], 'cm'), e: `1 cm가 ${n}번이면 ${n} cm예요.`, k: fx('n', { n }, 'cm') };
});
T('e2-1', 3, '[2수03-10]', (R) => {
  const a = R.int(5, 40), b = R.int(5, 40), s = a + b;
  if (R.chance(0.5)) return { q: `${a} cm인 막대와 ${b} cm인 막대를 겹치지 않게 이으면 몇 cm?`, a: `${s} cm`, w: Us([s + 1, s - 10, Math.abs(a - b), s + 10].filter((v) => v > 0 && v !== s), 'cm'), e: `${a} + ${b} = ${s}`, k: fx('a+b', { a, b }, 'cm') };
  const [x, y] = a > b ? [a, b] : [b, a];
  if (x === y) return null;
  return { q: `${x} cm인 끈은 ${y} cm인 끈보다 몇 cm 더 긴가요?`, a: `${x - y} cm`, w: Us([x + y, x - y + 1, x - y + 10, x - y - 1].filter((v) => v > 0), 'cm'), e: `${x} − ${y} = ${x - y}`, k: fx('x-y', { x, y }, 'cm') };
});
F('e2-1', 3, '[2수03-12]', [
  ['길이가 약 15 cm에 가장 가까운 것은?', '연필', ['교실 문의 높이', '운동장 둘레', '개미의 몸길이'], '연필 한 자루는 15 cm 정도예요.'],
  ['길이가 약 1 cm에 가장 가까운 것은?', '엄지손톱의 너비', ['연필', '책상의 길이', '버스의 길이'], '엄지손톱의 너비가 1 cm 정도예요.'],
  ['1 cm를 바르게 읽은 것은?', '1 센티미터', ['1 미터', '1 밀리미터', '1 킬로미터'], 'cm는 센티미터라고 읽어요.', '[2수03-10]'],
  ['자로 길이를 잴 때 물건의 한쪽 끝을 맞추는 눈금은?', '0', ['1', '5', '10'], '0에 맞추면 끝 눈금이 바로 길이예요.', '[2수03-10]'],
  ['어림한 길이를 말할 때 숫자 앞에 붙이는 말은?', '약', ['꼭', '더', '안'], '어림한 길이는 "약 몇 cm"라고 말해요.'],
]);
const CATS = { 과일: ['사과', '바나나', '포도', '귤', '딸기', '수박', '복숭아'], 채소: ['당근', '오이', '배추', '양파', '감자', '시금치', '무'], 동물: ['토끼', '사자', '고양이', '호랑이', '코끼리', '강아지'], 탈것: ['버스', '자전거', '기차', '비행기', '배', '트럭'] };
T('e2-1', 4, '[2수04-01]', (R) => {
  const [c1, c2] = R.sample(Object.keys(CATS), 2);
  const ans = R.pick(CATS[c1]);
  return { q: `다음 중 ${eun(c1)} 어느 것인가요?`, a: ans, w: R.sample(CATS[c2], 3), e: `${eun(ans)} ${c1}, 나머지는 ${ida(c2)}`, k: { k: 'catpick', cat: c1 } };
});
const COL3 = ['빨간색', '파란색', '노란색', '초록색'];
T('e2-1', 4, '[2수04-01]', (R) => {
  const cs = R.sample(COL3, 3), v = R.distinct(3, 2, 9), thing = R.pick(['공', '블록', '구슬', '풍선']);
  const desc = cs.map((c, i) => `${c.replace('색', '')} ${thing} ${v[i]}개`).join(', ');
  const r = R.int(1, 3);
  if (r === 1) {
    const big = R.chance(0.5), idx = v.indexOf(big ? Math.max(...v) : Math.min(...v));
    return { q: `${desc}. 가장 ${big ? '많은' : '적은'} 색은?`, a: cs[idx], w: [...cs.filter((_, i) => i !== idx), '모두 같아요'], e: `${v[idx]}개로 가장 ${big ? '많은' : '적은'} ${ida(cs[idx])}`, k: { k: 'argmax', names: cs, vals: v, max: big } };
  }
  if (r === 2) { const s = v[0] + v[1] + v[2]; return { q: `${desc}. 모두 몇 개인가요?`, a: `${s}개`, w: Us([s + 1, s - 1, s + 10, v[0] + v[1]], '개'), e: `${v.join(' + ')} = ${s}`, k: fx('a+b+c', { a: v[0], b: v[1], c: v[2] }, '개') }; }
  const [i, j] = v[0] > v[1] ? [0, 1] : [1, 0];
  return { q: `${desc}. ${cs[i]}은 ${cs[j]}보다 몇 개 더 많나요?`, a: `${v[i] - v[j]}개`, w: Us([v[i] + v[j], v[i] - v[j] + 1, v[i], v[i] - v[j] + 2], '개'), e: `${v[i]} − ${v[j]} = ${v[i] - v[j]}`, k: fx('x-y', { x: v[i], y: v[j] }, '개') };
});
F('e2-1', 4, '[2수04-01]', [
  ['분류하는 기준으로 알맞은 것은?', '색깔', ['예쁜 것', '좋아하는 것', '멋진 것'], '누가 분류해도 결과가 같은 기준이어야 해요.'],
  ['분류하는 기준으로 알맞지 않은 것은?', '귀여운 것', ['색깔', '모양', '다리의 수'], '귀여운지는 사람마다 달라서 기준이 될 수 없어요.'],
  ['다리의 수로 분류할 때 닭과 같은 무리는?', '오리', ['강아지', '고양이', '소'], '닭과 오리는 다리가 2개예요.'],
]);
T('e2-1', 5, '[2수01-10]', (R) => {
  const a = R.int(2, 9), b = R.int(2, 9), p = a * b, r = R.int(1, 3);
  if (r === 1) return { q: `${a}씩 ${b}묶음은 모두 몇 개인가요?`, a: p, w: R.shuffle([a + b, a * (b + 1), a * (b - 1), p + 1].filter((v) => v !== p)), e: `${a} × ${b} = ${p}`, k: fx('a*b', { a, b }) };
  if (r === 2) return { q: `${a}의 ${b}배는?`, a: p, w: R.shuffle([a + b, a * (b + 1), Number(`${a}${b}`), p - a].filter((v) => v !== p && v > 0)), e: `${a} × ${b} = ${p}`, k: fx('a*b', { a, b }) };
  if (a + b === p) return null;
  return { q: `${eul(Array(b).fill(a).join(' + '))} 곱셈식으로 쓰면?`, a: `${a} × ${b}`, w: R.shuffle([`${a} + ${b}`, `${a} × ${b + 1}`, `${b + 1} × ${b + 1}`, `${a} × ${a + 1}`]), e: `${eul(String(a))} ${b}번 더했으니 ${a} × ${ida(String(b))}`, k: { k: 'exprval', target: p } };
});
T('e2-1', 5, '[2수01-10]', (R) => {
  const a = R.int(2, 9), b = R.int(2, 5), it = R.pick([['접시', '사과', '개'], ['상자', '공', '개'], ['봉지', '사탕', '개'], ['꽃병', '꽃', '송이']]);
  const p = a * b;
  return { q: `${it[0]} ${b}개에 ${it[1]}이(가) ${a}${it[2]}씩 있어요. 모두 몇 ${it[2]}?`.replace('이(가)', bat(it[1]) ? '이' : '가'), a: `${p}${it[2]}`, w: Us([a + b, p + a, p - a, p + 1].filter((v) => v !== p), it[2]), e: `${a}씩 ${b}묶음: ${a} × ${b} = ${p}`, k: fx('a*b', { a, b }, it[2]) };
});

// =====================================================================
// 2학년 2학기
// =====================================================================
placeT('e2-2', 1000, 9999, 4);
T('e2-2', 0, '[2수01-02]', (R) => {
  const [m, a] = R.pick([[100, 10], [10, 100], [1, 1000], [900, 100], [990, 10], [999, 1], [500, 500], [800, 200]]);
  if (m === 100 || m === 10 || m === 1) return { q: `1000은 ${iga(String(m))} 몇 개인 수인가요?`, a: `${a}개`, w: Us([a * 10, a / 10 >= 1 ? a / 10 : 1000, a + 1, 1].filter((v) => v !== a), '개'), e: `${m} × ${a} = 1000`, k: fx('1000/m', { m }, '개') };
  return { q: `1000은 ${m}보다 몇 큰 수인가요?`, a, w: R.shuffle([a * 10, a + 1, a - 1 || 1000, 1000 + m].filter((v) => v !== a && v > 0)), e: `${m} + ${a} = 1000`, k: fx('1000-m', { m }) };
});
T('e2-2', 1, '[2수01-11]', (R) => {
  const a = R.int(2, 9), b = R.chance(0.1) ? R.int(0, 1) : R.int(2, 9), p = a * b;
  if (R.chance(0.5)) return { q: `${a} × ${b} = ?`, a: p, w: R.shuffle([a * (b + 1), a * Math.abs(b - 1), (a + 1) * b, a + b, p + 1].filter((v) => v !== p)), e: b === 0 ? '어떤 수에 0을 곱하면 0이에요.' : b === 1 ? '어떤 수에 1을 곱하면 그대로예요.' : `${a}단: ${a} × ${b} = ${p}`, k: { k: 'qx' } };
  if (b < 2) return null;
  return { q: `□ × ${a} = ${p}일 때 □는?`, a: b, w: R.shuffle([b + 1, b - 1, p - a, a].filter((v) => v !== b && v > 0)), e: `${a}단에서 ${p}이(가) 나오는 수: ${b} × ${a} = ${p}`.replace('이(가)', bat(String(p)) ? '이' : '가'), k: fx('p/a', { p, a }) };
});
T('e2-2', 1, '[2수01-11]', (R) => {
  const a = R.int(2, 9), b = R.int(2, 9), p = a * b;
  const s = R.pick([[`한 상자에 ${a}개씩 ${b}상자`, '개'], [`한 모둠에 ${a}명씩 ${b}모둠`, '명'], [`세발자전거 ${b}대의 바퀴`, '개', 3], [`문어 ${b}마리의 다리`, '개', 8], [`강아지 ${b}마리의 다리`, '개', 4]]);
  const A = s[2] || a, P = A * b;
  return { q: `${s[0]}는 모두 몇 ${s[1]}인가요?`.replace('바퀴는', '바퀴는').replace('다리는', '다리는'), a: `${P}${s[1]}`, w: Us([A + b, A * (b + 1), A * (b - 1), P + 1], s[1]), e: `${A} × ${b} = ${P}`, k: fx('a*b', { a: A, b }, s[1]) };
});
T('e2-2', 2, '[2수03-11]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) {
    const cm = R.int(1, 9) * 100 + R.int(1, 99);
    const m = Math.floor(cm / 100), c = cm % 100;
    return { q: `${cm} cm는 몇 m 몇 cm인가요?`, a: lenMC(cm), w: R.shuffle([`${Math.floor(cm / 10)} m ${cm % 10} cm`, c >= 10 ? `${m} m ${Number(String(c).split('').reverse().join(''))} cm` : `${m} m ${c * 10} cm`, `${cm} m`, `${m + 1} m ${c} cm`]), e: `100 cm = 1 m이니 ${lenMC(cm)}`, k: fx('n', { n: cm }, 'cm') };
  }
  if (r === 2) {
    const m = R.int(1, 9), c = R.int(1, 99), cm = 100 * m + c;
    return { q: `${m} m ${c} cm는 몇 cm인가요?`, a: `${cm} cm`, w: Us([Number(`${m}${c}`), 10 * m + c, cm + 100, 1000 * m + c].filter((v) => v !== cm), 'cm'), e: `${m} m = ${100 * m} cm, 더하면 ${cm} cm`, k: fx('100*m+c', { m, c }, 'cm') };
  }
  const m = R.int(1, 9);
  return { q: `${m} m는 몇 cm인가요?`, a: `${100 * m} cm`, w: Us([10 * m, 1000 * m, m, 100 * m + 100], 'cm'), e: `1 m = 100 cm이니 ${100 * m} cm`, k: fx('100*m', { m }, 'cm') };
});
T('e2-2', 2, '[2수03-13]', (R) => {
  const a = R.int(1, 6), b = R.int(5, 60), c = R.int(1, 3), d = R.int(5, 95 - b);
  if (R.chance(0.5)) {
    const s = 100 * (a + c) + b + d;
    return { q: `${a} m ${b} cm + ${c} m ${d} cm = ?`, a: lenMC(s), w: R.shuffle([lenMC(s + 100), lenMC(s - 100), lenMC(100 * (a + c) + Math.abs(b - d)), lenMC(s + 10)]), e: `m끼리 ${a + c} m, cm끼리 ${b + d} cm`, k: fx('100*(a+c)+b+d', { a, b, c, d }, 'cm') };
  }
  const A = a + c, B = b + d;
  if (B >= 100) return null;
  const s = 100 * (A - c) + B - d;
  return { q: `${A} m ${B} cm − ${c} m ${d} cm = ?`, a: lenMC(s), w: R.shuffle([lenMC(s + 100), lenMC(100 * (A + c) + B - d), lenMC(s - 10 > 0 ? s - 10 : s + 20), lenMC(100 * (A - c) + B + d)]), e: `m끼리 ${A - c} m, cm끼리 ${B - d} cm`, k: fx('100*(A-c)+B-d', { A, B, c, d }, 'cm') };
});
T('e2-2', 3, '[2수03-07]', (R) => {
  const n = R.int(1, 11);
  return { q: `긴바늘이 ${n}을(를) 가리키면 몇 분인가요?`.replace('을(를)', bat(String(n)) ? '을' : '를'), a: `${5 * n}분`, w: Us([n, 10 * n, 5 * n + 5, 5 * n - 5].filter((v) => v > 0 && v !== 5 * n), '분'), e: `숫자 한 칸이 5분이라 ${n} × 5 = ${5 * n}분`, k: fx('5*n', { n }, '분') };
});
T('e2-2', 3, '[2수03-08]', (R) => {
  const h = R.int(1, 12), m = R.int(0, 11) * 5, k = R.int(2, 10) * 5;
  const t0 = h * 3600 + m * 60, t1 = t0 + k * 60;
  const H = Math.floor(t1 / 3600), M = Math.floor(t1 / 60) % 60;
  const w = [clock(t1 + 3600), clock(t1 - 3600), clock(t1 + 600), clock(t1 - 300)];
  if (M + 0 < m) w.unshift(clock(h * 3600 + M * 60)); // 받아올림을 잊은 시각
  return { q: `${clock(t0)}에서 ${k}분이 지나면 몇 시 몇 분인가요?`.replace('몇 시 몇 분인가요?', '몇 시 몇 분?'), a: clock(t1), w, e: `${m} + ${k} = ${m + k}분` + (m + k >= 60 ? ` = 1시간 ${m + k - 60}분` : ''), k: { k: 'tod', t0, add: k * 60 } };
});
T('e2-2', 3, '[2수03-08]', (R) => {
  if (R.chance(0.5)) {
    const x = R.int(1, 3), y = R.int(1, 11) * 5, mm = 60 * x + y;
    return { q: `${x}시간 ${y}분은 몇 분인가요?`, a: `${mm}분`, w: Us([100 * x + y, x + y, mm + 60, mm - 10], '분'), e: `1시간 = 60분이니 ${60 * x} + ${y} = ${mm}분`, k: fx('60*x+y', { x, y }, '분') };
  }
  const n = R.int(61, 179);
  if (n % 60 === 0) return null;
  return { q: `${n}분은 몇 시간 몇 분인가요?`, a: dur(n * 60, true), w: R.shuffle([`${Math.floor(n / 100)}시간 ${n % 100}분`, dur((n - 60) * 60 + 7200, true), dur(n * 60 + 600, true), dur((n - 10) * 60, true), dur((n + 5) * 60, true)].filter((s) => !/^0시간/.test(s))), e: `60분 = 1시간이에요.`, k: fx('n', { n }, '분') };
});
T('e2-2', 3, '[2수03-09]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const a = R.int(1, 4), b = R.int(1, 6), d = 7 * a + b; return { q: `${a}주일 ${b}일은 며칠인가요?`, a: `${d}일`, w: Us([10 * a + b, a + b, d + 7, d - 1], '일'), e: `1주일 = 7일이니 ${7 * a} + ${b} = ${d}일`, k: fx('7*a+b', { a, b }, '일') }; }
  if (r === 2) { const x = R.int(1, 3); return { q: `${x}일은 몇 시간인가요?`, a: `${24 * x}시간`, w: Us([12 * x, 60 * x, 24 * x + 24, 10 * x], '시간'), e: `하루는 24시간이니 24 × ${x} = ${24 * x}시간`, k: fx('24*x', { x }, '시간') }; }
  const n = R.int(1, 23), dayN = R.pick(['월요일', '화요일', '수요일', '목요일', '금요일']);
  return { q: `어느 달 ${n}일이 ${ida(dayN)}. 다음 주 ${dayN}은 며칠인가요?`.replace(`${dayN}이에요.`, `${dayN}이에요.`), a: `${n + 7}일`, w: Us([n + 1, n + 6, n + 8, n + 10], '일'), e: `같은 요일은 7일마다 돌아와요: ${n} + 7 = ${n + 7}`, k: fx('n+7', { n }, '일') };
});
const FAV = ['사과', '포도', '귤', '딸기', '수박', '바나나'];
T('e2-2', 4, '[2수04-02]', (R) => {
  const ns = R.sample(FAV, 4), v = R.distinct(4, 2, 9), desc = ns.map((x, i) => `${x} ${v[i]}명`).join(', ');
  const r = R.int(1, 3);
  if (r === 1) { const s = v.reduce((a, b) => a + b, 0); return { q: `좋아하는 과일 조사: ${desc}. 조사한 학생은 모두 몇 명?`, a: `${s}명`, w: Us([s + 1, s - 1, s + 10, s - v[3]], '명'), e: `${v.join(' + ')} = ${s}`, k: fx('a+b+c+d', { a: v[0], b: v[1], c: v[2], d: v[3] }, '명') }; }
  if (r === 2) { const big = R.chance(0.5), idx = v.indexOf(big ? Math.max(...v) : Math.min(...v)); return { q: `좋아하는 과일 조사: ${desc}. 가장 ${big ? '많은' : '적은'} 학생이 좋아하는 과일은?`, a: ns[idx], w: ns.filter((_, i) => i !== idx), e: `${v[idx]}명으로 가장 ${big ? '많아요' : '적어요'}.`, k: { k: 'argmax', names: ns, vals: v, max: big } }; }
  const [i, j] = v[0] > v[1] ? [0, 1] : [1, 0];
  return { q: `○ 그래프에서 ${ns[i]}은(는) ○ ${v[i]}개, ${ns[j]}은(는) ○ ${v[j]}개예요. ${eun(ns[i])} 몇 명 더 많나요?`.replace(/(\S+)은\(는\)/g, (m, w) => eun(w)), a: `${v[i] - v[j]}명`, w: Us([v[i] + v[j], v[i] - v[j] + 1, v[i], v[i] - v[j] + 2], '명'), e: `○ 하나가 1명이니 ${v[i]} − ${v[j]} = ${v[i] - v[j]}`, k: fx('x-y', { x: v[i], y: v[j] }, '명'), std: '[2수04-03]' };
});
F('e2-2', 4, '[2수04-02]', [
  ['자료를 표로 나타내면 좋은 점은?', '항목별 수를 알기 쉬워요', ['누가 골랐는지 알 수 있어요', '자료가 늘어나요', '그림이 예뻐져요'], '표는 항목별 수와 합계를 한눈에 보여 줘요.'],
  ['그래프로 나타내면 좋은 점은?', '가장 많은 것을 한눈에 알 수 있어요', ['누가 골랐는지 알 수 있어요', '조사한 날짜를 알 수 있어요', '자료가 늘어나요'], '그래프는 많고 적음을 한눈에 비교하게 해 줘요.', '[2수04-03]'],
  ['○ 그래프에서 ○를 채우는 방법으로 옳은 것은?', '한 칸에 하나씩 빈칸 없이 채워요', ['칸을 건너뛰며 채워요', '위에서부터 아무렇게나 채워요', '한 칸에 두 개씩 채워요'], '아래에서부터 한 칸에 하나씩 채워요.', '[2수04-03]'],
]);
T('e2-2', 5, '[2수02-01]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const step = R.pick([2, 3, 4, 5, 9, 10, 100]), start = R.int(1, step === 100 ? 900 : 50); return R.chance(0.6) ? seqQ(R, start, step, R.int(4, 5)) : seqGapQ(R, start, step, 5); }
  if (r === 2) { const a = R.int(2, 9); return { q: `곱셈표에서 ${a}단의 수는 몇씩 커지나요?`, a: `${a}씩`, w: Us([a + 1, a - 1 || 10, 2 * a, 1].filter((v) => v !== a), '씩'), e: `${a}단은 ${a}, ${2 * a}, ${3 * a}, …로 ${a}씩 커져요.`, k: fx('a', { a }, '씩') }; }
  if (r === 3) { const n = R.int(8, 24), up = R.chance(0.4), a = up ? n - 7 : n + 7; return { q: `달력에서 ${n}일 바로 ${up ? '위' : '아래'} 칸의 날짜는?`, a: `${a}일`, w: Us([up ? n - 1 : n + 1, up ? n - 6 : n + 6, up ? n - 10 : n + 10, up ? n + 7 : n - 7], '일'), e: `한 줄이 7일이라 ${up ? '위' : '아래'} 칸은 7 ${up ? '작아요' : '커요'}.`, k: fx(up ? 'n-7' : 'n+7', { n }, '일') }; }
  return patQ(R, ['○', '△', '□', '☆']);
});
F('e2-2', 5, '[2수02-01]', [
  ['덧셈표에서 오른쪽으로 한 칸 갈 때마다 수는 얼마씩 커지나요?', '1씩', ['2씩', '10씩', '0씩'], '더하는 수가 1씩 커지니 합도 1씩 커져요.'],
  ['곱셈표에서 5단의 수는 일의 자리 숫자가 어떻게 되풀이되나요?', '5, 0', ['1, 2', '2, 4', '5, 5'], '5, 10, 15, 20, …으로 5와 0이 번갈아 나와요.'],
  ['곱셈표에서 2단, 4단, 6단, 8단의 수는 모두 어떤 수인가요?', '짝수', ['홀수', '10의 배수', '5의 배수'], '짝수 단의 곱은 모두 짝수예요.'],
  ['달력에서 같은 요일의 날짜는 며칠마다 돌아오나요?', '7일', ['5일', '10일', '30일'], '1주일은 7일이에요.'],
]);

// =====================================================================
// 3학년 1학기
// =====================================================================
T('e3-1', 0, '[4수01-03]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(120, 699), b = R.int(105, 899 - a + 100);
    const s = a + b;
    if (s > 1500 || naiveAdd(a, b) === s) return null;
    return { q: `${a} + ${b} = ?`, a: s, w: R.shuffle([naiveAdd(a, b), s - 10, s + 100, s - 100, s + 10].filter((v) => v !== s && v > 0)), e: `일, 십의 자리에서 받아올림하면 ${s}`, k: { k: 'qx' } };
  }
  const a = R.int(300, 999), b = R.int(102, a - 50), r = a - b;
  if (naiveSub(a, b) === r) return null;
  return { q: `${a} − ${b} = ?`, a: r, w: R.shuffle([naiveSub(a, b), r + 10, r + 100, r - 10].filter((v) => v > 0 && v !== r)), e: `받아내림에 주의하면 ${a} − ${b} = ${r}`, k: { k: 'qx' } };
});
T('e3-1', 0, '[4수01-08]', (R) => {
  const A = R.int(2, 6) * 100 + R.pick([-3, -2, -1, 1, 2, 3, 4, -4]) * R.int(1, 5), B = R.int(1, 3) * 100 + R.pick([-1, 1]) * R.int(1, 15);
  const add = R.chance(0.6), ra = Math.round(A / 100) * 100, rb = Math.round(B / 100) * 100;
  const est = add ? ra + rb : ra - rb;
  if (est <= 0) return null;
  return { q: `${A} ${add ? '+' : '−'} ${B}를 어림하면 약 얼마인가요?`.replace(/(\d+)를/, (m, d) => eul(d)), a: est, w: R.shuffle([est + 100, est - 100, est + 200].filter((v) => v > 0)), e: `약 ${ra} ${add ? '+' : '−'} 약 ${rb} = 약 ${est}`, k: { k: 'estsum', a: A, b: B, op: add ? '+' : '-' } };
});
T('e3-1', 0, '[4수01-03]', (R) => {
  const a = R.int(150, 600), b = R.int(120, 400);
  if (R.chance(0.5)) return { q: `도서관에 동화책 ${a}권, 위인전 ${b}권이 있어요. 모두 몇 권?`, a: `${a + b}권`, w: Us([naiveAdd(a, b), a + b + 100, a + b - 10, Math.abs(a - b)], '권'), e: `${a} + ${b} = ${a + b}`, k: fx('a+b', { a, b }, '권') };
  const [x, y] = a > b ? [a, b] : [b, a];
  if (x === y) return null;
  return { q: `줄넘기를 형은 ${x}번, 동생은 ${y}번 했어요. 형은 몇 번 더 했나요?`, a: `${x - y}번`, w: Us([naiveSub(x, y), x + y, x - y + 10, x - y + 100], '번'), e: `${x} − ${y} = ${x - y}`, k: fx('x-y', { x, y }, '번') };
});
F('e3-1', 1, '[4수03-01]', [
  ['두 점을 곧게 이은 선은?', '선분', ['직선', '반직선', '곡선'], '두 점을 곧게 이은 선이 선분이에요.'],
  ['선분을 양쪽으로 끝없이 늘인 곧은 선은?', '직선', ['선분', '반직선', '곡선'], '양쪽으로 끝없이 늘이면 직선이에요.'],
  ['한 점에서 한쪽으로 끝없이 늘인 곧은 선은?', '반직선', ['선분', '직선', '곡선'], '한쪽으로만 끝없이 늘이면 반직선이에요.'],
  ['한 점에서 그은 두 반직선으로 이루어진 도형은?', '각', ['선분', '원', '직선'], '한 점에서 그은 두 반직선이 각을 이뤄요.'],
  ['종이를 반듯하게 두 번 접었을 때 생기는 각은?', '직각', ['예각', '둔각', '평각'], '반듯하게 두 번 접으면 직각이 생겨요.'],
  ['한 각이 직각인 삼각형은?', '직각삼각형', ['정사각형', '직사각형', '원'], '한 각이 직각이면 직각삼각형이에요.', '[4수03-09]'],
  ['네 각이 모두 직각인 사각형은?', '직사각형', ['직각삼각형', '삼각형', '원'], '네 각이 직각인 사각형이 직사각형이에요.', '[4수03-10]'],
  ['네 각이 직각이고 네 변의 길이가 같은 사각형은?', '정사각형', ['직각삼각형', '삼각형', '원'], '정사각형은 네 각과 네 변이 같아요.', '[4수03-10]'],
]);
T('e3-1', 1, '[4수03-10]', (R) => {
  const shapes = { 직사각형: 4, 정사각형: 4, 직각삼각형: 1 };
  const [x, y] = R.sample(Object.keys(shapes), 2), cx = R.int(1, 3), cy = R.int(1, 3), s = cx * shapes[x] + cy * shapes[y];
  return { q: `${x} ${cx}개와 ${y} ${cy}개에 있는 직각은 모두 몇 개?`, a: `${s}개`, w: Us([cx + cy, s + 1, s - 1, 4 * (cx + cy)].filter((v) => v !== s), '개'), e: `직사각형·정사각형은 4개, 직각삼각형은 1개씩이에요.`, k: { k: 'rightangles', x, cx, y, cy } };
});
T('e3-1', 1, '[4수03-10]', (R) => {
  if (R.chance(0.5)) { const a = R.int(3, 25); return { q: `한 변이 ${a} cm인 정사각형의 네 변의 길이의 합은?`, a: `${4 * a} cm`, w: Us([2 * a, a * a, 4 * a + 4, 3 * a].filter((v) => v !== 4 * a), 'cm'), e: `네 변이 같으니 ${a} × 4 = ${4 * a} cm`, k: fx('4*a', { a }, 'cm') }; }
  const a = R.int(4, 20), b = R.int(2, a - 1), s = 2 * (a + b);
  return { q: `가로 ${a} cm, 세로 ${b} cm인 직사각형의 네 변의 길이의 합은?`, a: `${s} cm`, w: Us([a + b, a * b, s + 2, 2 * a + b].filter((v) => v !== s), 'cm'), e: `(${a} + ${b}) × 2 = ${s} cm`, k: fx('2*(a+b)', { a, b }, 'cm') };
});
T('e3-1', 2, '[4수01-06]', (R) => {
  const b = R.int(2, 9), q = R.int(2, 9), a = b * q;
  return { q: `${a} ÷ ${b} = ?`, a: q, w: R.shuffle([q + 1, q - 1, a - b, b * 2 === q ? q + 2 : b].filter((v) => v > 0 && v !== q)), e: `${b} × ${q} = ${a}이므로 몫은 ${ida(String(q))}`.replace(`${a}이므로`, `${a}${bat(String(a)) ? '이므로' : '이므로'}`), k: { k: 'qx' } };
});
T('e3-1', 2, '[4수01-05]', (R) => {
  const b = R.int(2, 9), q = R.int(2, 9), a = b * q, it = R.pick(ITEMS);
  if (R.chance(0.5)) return { q: `${it} ${a}개를 ${b}명에게 똑같이 나누어 주면 한 명에게 몇 개?`, a: `${q}개`, w: Us([q + 1, q - 1, a - b, a + b].filter((v) => v !== q), '개'), e: `${a} ÷ ${b} = ${q}`, k: fx('a/b', { a, b }, '개') };
  return { q: `${it} ${a}개를 ${b}개씩 봉지에 담으면 몇 봉지가 되나요?`, a: `${q}봉지`, w: Us([q + 1, q - 1, a - b, b].filter((v) => v !== q), '봉지'), e: `${a} ÷ ${b} = ${q}`, k: fx('a/b', { a, b }, '봉지') };
});
T('e3-1', 2, '[4수01-05]', (R) => {
  const b = R.int(2, 9), q = R.int(2, 9), a = b * q;
  if (b === q) return null;
  return { q: `${b} × ${q} = ${eul(String(a))} 나눗셈식으로 바르게 쓴 것은?`, a: R.chance(0.5) ? `${a} ÷ ${b} = ${q}` : `${a} ÷ ${q} = ${b}`, w: R.shuffle([`${q} ÷ ${b} = ${a}`, `${b} ÷ ${a} = ${q}`, `${a} ÷ ${b} = ${b}`, `${a} − ${b} = ${q}`]), e: `곱 ${eul(String(a))} 한 수로 나누면 다른 수가 돼요.`, k: { k: 'eqtrue' } };
});
T('e3-1', 3, '[4수01-04]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const a = R.int(1, 9) * 10, m = R.int(2, 9), p = a * m; return { q: `${a} × ${m} = ?`, a: p, w: R.shuffle([p / 10, p * 10, a + m, p + 10]), e: `${a / 10} × ${m} = ${p / 10}에 0을 붙여 ${p}`, k: { k: 'qx' } }; }
  const a = R.int(12, 49), m = R.int(2, 9), p = a * m;
  if (r === 2 && (a % 10) * m < 10) return { q: `${a} × ${m} = ?`, a: p, w: R.shuffle([p + 10, p - 10, a + m, p + m]), e: `${Math.floor(a / 10) * 10} × ${m} = ${Math.floor(a / 10) * 10 * m}, ${a % 10} × ${m} = ${(a % 10) * m}`, k: { k: 'qx' } };
  if ((a % 10) * m < 10) return null;
  return { q: `${a} × ${m} = ?`, a: p, w: R.shuffle([naiveMul(a, m), Number(`${Math.floor(a / 10) * m}${(a % 10) * m}`), p + 10, p - 10].filter((v) => v !== p)), e: `${a % 10} × ${m} = ${(a % 10) * m}에서 받아올림해 ${p}`, k: { k: 'qx' } };
});
T('e3-1', 3, '[4수01-04]', (R) => {
  const a = R.int(12, 39), m = R.int(3, 9), p = a * m;
  const s = R.pick([[`한 상자에 연필이 ${a}자루씩 ${m}상자`, '자루'], [`한 줄에 ${a}명씩 ${m}줄`, '명'], [`하루에 ${a}쪽씩 ${m}일 동안 읽은 책`, '쪽']]);
  return { q: `${s[0]}는 모두 몇 ${s[1]}인가요?`, a: `${p}${s[1]}`, w: Us([naiveMul(a, m), a + m, p + a, p - 10].filter((v) => v !== p), s[1]), e: `${a} × ${m} = ${p}`, k: fx('a*m', { a, m }, s[1]) };
});
T('e3-1', 4, '[4수03-16]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const a = R.int(1, 20), b = R.int(1, 9); return { q: `${a} cm ${b} mm는 몇 mm인가요?`, a: `${10 * a + b} mm`, w: Us([100 * a + b, a + b, 10 * a + b + 10, 10 * b + a].filter((v) => v !== 10 * a + b), 'mm'), e: `1 cm = 10 mm이니 ${10 * a} + ${b} = ${10 * a + b} mm`, k: fx('10*a+b', { a, b }, 'mm') }; }
  if (r === 2) { const n = R.int(11, 199); if (n % 10 === 0) return null; return { q: `${n} mm는 몇 cm 몇 mm인가요?`, a: lenCMM(n), w: R.shuffle([lenCMM(n + 10), `${Math.floor(n / 100)} cm ${n % 100} mm`, lenCMM(n - 10 > 0 ? n - 10 : n + 20), `${n % 10} cm ${Math.floor(n / 10)} mm`].filter((s) => !/^0 cm/.test(s))), e: `10 mm = 1 cm이에요.`, k: fx('n', { n }, 'mm') }; }
  if (r === 3) { const a = R.int(1, 9), b = R.pick([R.int(1, 9) * 100, R.int(1, 99) * 10, R.int(1, 99)]); return { q: `${a} km ${b} m는 몇 m인가요?`, a: `${1000 * a + b} m`, w: Us([Number(`${a}${b}`), 100 * a + b, 1000 * a + b + 1000, 10000 * a + b].filter((v) => v !== 1000 * a + b), 'm'), e: `1 km = 1000 m이니 ${1000 * a} + ${b} = ${1000 * a + b} m`, k: fx('1000*a+b', { a, b }, 'm') }; }
  const n = R.int(1001, 9999); if (n % 1000 === 0) return null;
  return { q: `${n} m는 몇 km 몇 m인가요?`, a: lenKM(n), w: R.shuffle([`${Math.floor(n / 100)} km ${n % 100} m`, lenKM(n + 1000), `${Math.floor(n / 1000)} km ${(n % 1000) * 10} m`, lenKM(n - 1000 + 1)].filter((s) => !/^0 km/.test(s))), e: `1000 m = 1 km이에요.`, k: fx('n', { n }, 'm') };
});
T('e3-1', 4, '[4수03-14]', (R) => {
  const h = R.int(1, 11), m = R.int(5, 55), s = R.int(5, 55), x = R.int(5, 40), y = R.int(5, 55);
  const t0 = h * 3600 + m * 60 + s, t1 = t0 + x * 60 + y;
  const sM = Math.floor(t1 / 60) % 60;
  return { q: `${clock(t0)}에서 ${x}분 ${y}초 후의 시각은?`, a: clock(t1), w: R.shuffle([clock(t1 - 60), clock(t1 + 60), clock(t1 + 3600), clock(t1 - 3600 + 60 * (sM < m ? 0 : 1))]), e: `초끼리, 분끼리 더하고 60이 넘으면 받아올려요.`, k: { k: 'tod', t0, add: x * 60 + y } };
});
T('e3-1', 4, '[4수03-13]', (R) => {
  if (R.chance(0.5)) { const a = R.int(1, 9), b = R.int(1, 59); return { q: `${a}분 ${b}초는 몇 초인가요?`, a: `${60 * a + b}초`, w: Us([100 * a + b, a + b, 60 * a + b + 60, 10 * a + b].filter((v) => v !== 60 * a + b), '초'), e: `1분 = 60초이니 ${60 * a} + ${b} = ${60 * a + b}초`, k: fx('60*a+b', { a, b }, '초') }; }
  const a = R.int(3, 9), b = R.int(0, 50), c = R.int(1, a - 1), d = R.int(10, 59);
  const t = (60 * a + b) - (60 * c + d);
  if (t <= 0 || b >= d) return null;
  return { q: `${dur(60 * a + b)} − ${dur(60 * c + d)} = ?`, a: dur(t), w: R.shuffle([dur(t + 60), dur((a - c) * 60 + (d - b)), dur(t - 60 > 0 ? t - 60 : t + 120), dur(t + 40)]), e: `1분을 60초로 받아내려 계산해요.`, k: fx('60*a+b-60*c-d', { a, b, c, d }, '초') };
});
T('e3-1', 5, '[4수01-09]', (R) => {
  const n = R.int(3, 12), k = R.int(1, n - 1);
  const food = R.pick(['피자', '케이크', '색종이', '초콜릿']);
  return { q: `똑같이 ${n}조각으로 나눈 ${food}의 ${k}조각은 전체의 얼마?`, a: FR(k, n), w: R.shuffle([k > 1 ? FR(n, k) : `${n}`, FR(n - k, n), FR(k, n + 1), FR(k, n - 1 > k ? n - 1 : n + 2)].filter((s) => s !== FR(n - k, n) || n - k !== k)), e: `전체 ${n}조각 중 ${k}조각이라 ${ida(FR(k, n))}`, k: fx('k/n', { k, n }) };
});
T('e3-1', 5, '[4수01-11]', (R) => {
  const big = R.chance(0.5);
  if (R.chance(0.5)) { const ds = R.distinct(4, 2, 12); return { ...extQ(R, ds, (d) => FR(1, d), !big, ''), k: { k: big ? 'max' : 'min' }, q: `다음 중 가장 ${big ? '큰' : '작은'} 분수는?`, e: '단위분수는 분모가 작을수록 커요.' }; }
  const d = R.int(5, 12), ns = R.distinct(4, 1, d - 1);
  const r = extQ(R, ns, (n) => FR(n, d), big, '');
  return { ...r, k: { k: big ? 'max' : 'min' }, q: `다음 중 가장 ${big ? '큰' : '작은'} 분수는?`, e: '분모가 같으면 분자가 클수록 커요.' };
});
T('e3-1', 5, '[4수01-12]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const k = R.int(1, 9); return { q: `10분의 ${eul(String(k))} 소수로 나타내면?`, a: D(k / 10), w: R.shuffle([`${k}.0`, D(k / 100), D(1 + k / 10), String(k * 10)]), e: `10분의 1이 0.1이니 10분의 ${eun(String(k))} ${ida(D(k / 10))}`, k: fx('k/10', { k }) }; }
  if (r === 2) { const k = R.int(11, 49); if (k % 10 === 0) return null; return { q: `0.1이 ${k}개인 수는?`, a: D(k / 10), w: R.shuffle([String(k), D(k / 100), D(k / 10 + 1), D((k % 10) + Math.floor(k / 10) / 10)].filter((s) => s !== D(k / 10))), e: `0.1이 10개면 1이니 ${k}개는 ${ida(D(k / 10))}`, k: fx('k/10', { k }) }; }
  const a = R.int(1, 15), b = R.int(1, 9);
  return { q: `${a} cm ${b} mm는 몇 cm인가요?`, a: `${D(a + b / 10)} cm`, w: Us([`${a}${b}`, D(a + b / 100), D(b + a / 10), D(a + 1 + b / 10)].map(Number), 'cm'), e: `${b} mm = 0.${b} cm이니 ${a + b / 10} cm`, k: fx('a+b/10', { a, b }, 'cm') };
});
T('e3-1', 5, '[4수01-12]', (R) => {
  const big = R.chance(0.5), vals = R.distinct(4, 1, 39, (v) => v % 10 !== 0);
  return extQ(R, vals.map((v) => v / 10), D, big, '자연수 부분, 소수 첫째 자리 순서로 비교해요.');
});

// =====================================================================
// 3학년 2학기
// =====================================================================
T('e3-2', 0, '[4수01-04]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const a = R.int(102, 499), m = R.int(2, 9), p = a * m; return { q: `${a} × ${m} = ?`, a: p, w: R.shuffle([naiveMul(a, m), p + 10, p - 100, p + 100].filter((v) => v !== p && v > 0)), e: `${Math.floor(a / 100) * 100} × ${m} + ${a % 100} × ${m} = ${p}`, k: { k: 'qx' } }; }
  if (r === 2) { const a = R.int(2, 9) * 10, b = R.int(2, 9) * 10, p = a * b; return { q: `${a} × ${b} = ?`, a: p, w: R.shuffle([p / 10, p * 10, a + b, p / 100 + p / 10]), e: `${a / 10} × ${b / 10} = ${p / 100}에 0을 두 개 붙여 ${p}`, k: { k: 'qx' } }; }
  const a = R.int(12, 59), b = R.int(12, 39), p = a * b, t = Math.floor(b / 10), o = b % 10;
  if (o === 0) return null;
  return { q: `${a} × ${b} = ?`, a: p, w: R.shuffle([a * t + a * o, a * o + a * t * 10 + 10, p + 10, p - 10].filter((v) => v !== p)), e: `${a} × ${t * 10} = ${a * t * 10}, ${a} × ${o} = ${a * o}, 합은 ${p}`, k: { k: 'qx' } };
});
T('e3-2', 0, '[4수01-04]', (R) => {
  const a = R.int(12, 45), b = R.int(12, 30), p = a * b;
  const s = R.pick([[`한 봉지에 귤이 ${a}개씩 ${b}봉지`, '개'], [`버스 ${b}대에 ${a}명씩 탔을 때 사람`, '명'], [`하루에 ${a}쪽씩 ${b}일 동안 푼 문제집`, '쪽']]);
  return { q: `${s[0]}는 모두 몇 ${s[1]}인가요?`, a: `${p}${s[1]}`, w: Us([a * Math.floor(b / 10) + a * (b % 10), a + b, p + 10, p - a], s[1]), e: `${a} × ${b} = ${p}`, k: fx('a*b', { a, b }, s[1]) };
});
const qrS = (q, r) => `몫 ${q}, 나머지 ${r}`;
T('e3-2', 1, '[4수01-06]', (R) => {
  const b = R.int(3, 9), q = R.int(5, 32), r = R.int(1, b - 1), a = b * q + r;
  if (a > 299) return null;
  return { q: `${a} ÷ ${b}의 몫과 나머지는?`, a: qrS(q, r), w: R.shuffle([qrS(q - 1, r + b), qrS(q + 1, r), qrS(q, r + 1 < b ? r + 1 : r - 1 || b + 1), qrS(q - 1, b - r)]), e: `${b} × ${q} = ${b * q}, ${a} − ${b * q} = ${r}`, k: { k: 'qr', a, b } };
});
T('e3-2', 1, '[4수01-06]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const b = R.int(2, 9), q = R.int(11, 99), a = b * q; if (a > 999) return null; return { q: `${a} ÷ ${b} = ?`, a: q, w: R.shuffle([q + 1, q - 1, q + 10, q * 10].filter((v) => v !== q)), e: `${b} × ${q} = ${a}이므로 몫은 ${ida(String(q))}`, k: { k: 'qx' } }; }
  if (r === 2) { const b = R.int(3, 9), q = R.int(3, 15), rr = R.int(1, b - 1), n = b * q + rr; return { q: `어떤 수를 ${b}로 나누면 몫이 ${q}, 나머지가 ${rr}예요. 어떤 수는?`.replace(`${b}로`, ro(String(b))).replace(`${rr}예요`, ida(String(rr))), a: n, w: R.shuffle([b * q, b * q - rr, b * (q + rr), n + b]), e: `${b} × ${q} + ${rr} = ${n}`, k: fx('b*q+r', { b, q, r: rr }) }; }
  const b = R.int(3, 9), q = R.int(4, 15), rr = R.int(1, b - 1), a = b * q + rr, box = R.pick(['봉지', '상자']);
  const s = (x, y) => `${x}${box}, ${y}개 남아요`;
  return { q: `구슬 ${a}개를 한 ${box}에 ${b}개씩 담으면 몇 ${box}가 되고 몇 개가 남나요?`, a: s(q, rr), w: R.shuffle([s(q + 1, rr), s(q - 1, rr + b), s(q, b - rr === rr ? rr + 1 : b - rr), s(rr, q)].filter((x) => x !== s(q, rr))), e: `${a} ÷ ${b} = ${q} … ${rr}`, k: { k: 'qr', a, b } };
});
T('e3-2', 2, '[4수03-06]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const d = R.int(2, 20) * 2; return { q: `지름이 ${d} cm인 원의 반지름은?`, a: `${d / 2} cm`, w: Us([d, d * 2, d / 2 + 1, d / 4 === Math.floor(d / 4) ? d / 4 : d / 2 + 2].filter((v) => v !== d / 2), 'cm'), e: `반지름은 지름의 반이라 ${d / 2} cm`, k: fx('d/2', { d }, 'cm') }; }
  if (r === 2) { const rr = R.int(2, 25); return { q: `반지름이 ${rr} cm인 원의 지름은?`, a: `${2 * rr} cm`, w: Us([rr, 4 * rr, 2 * rr + 1, rr + 2].filter((v) => v !== 2 * rr), 'cm'), e: `지름 = 반지름 × 2 = ${2 * rr} cm`, k: fx('2*r', { r: rr }, 'cm') }; }
  if (r === 3) { const rr = R.int(2, 9), n = R.int(2, 5), L = 2 * rr * n; return { q: `반지름이 ${rr} cm인 원 ${n}개를 한 줄로 맞닿게 그렸어요. 양 끝 사이의 거리는?`, a: `${L} cm`, w: Us([rr * n, L + 2 * rr, L - rr, 2 * rr + n].filter((v) => v !== L), 'cm'), e: `지름 ${2 * rr} cm가 ${n}개: ${2 * rr} × ${n} = ${L}`, k: fx('2*r*n', { r: rr, n }, 'cm') }; }
  const a = R.int(2, 15) * 2;
  return { q: `한 변이 ${a} cm인 정사각형 안에 꼭 맞게 그린 원의 반지름은?`, a: `${a / 2} cm`, w: Us([a, 2 * a, a / 2 + 1, a / 2 - 1].filter((v) => v !== a / 2), 'cm'), e: `원의 지름이 ${a} cm이니 반지름은 ${a / 2} cm`, k: fx('a/2', { a }, 'cm') };
});
F('e3-2', 2, '[4수03-06]', [
  ['한 원에서 지름은 반지름의 몇 배인가요?', '2배', ['3배', '4배', '같아요'], '지름 = 반지름 × 2예요.'],
  ['원 위의 두 점을 이은 선분 중 가장 긴 것은?', '지름', ['반지름', '원의 중심', '선분 하나로 정할 수 없어요'], '원의 중심을 지나는 선분인 지름이 가장 길어요.'],
  ['컴퍼스로 원을 그릴 때 침을 꽂는 점은?', '원의 중심', ['꼭짓점', '지름', '반지름'], '침을 꽂은 점이 원의 중심이 돼요.', '[4수03-07]'],
  ['원의 중심과 원 위의 한 점을 이은 선분은?', '반지름', ['지름', '대각선', '변'], '중심에서 원 위의 점까지가 반지름이에요.'],
  ['컴퍼스를 벌린 길이는 원의 무엇과 같나요?', '반지름', ['지름', '둘레', '넓이'], '컴퍼스를 벌린 만큼이 반지름이 돼요.', '[4수03-07]'],
]);
T('e3-2', 3, '[4수01-10]', (R) => {
  const d = R.int(2, 9), w = R.int(1, 4), r = R.int(1, d - 1), n = w * d + r;
  if (R.chance(0.5)) return { q: `${d}분의 ${eul(String(n))} 대분수로 나타내면?`, a: MR(n, d), w: R.shuffle([`${wa(String(r))} ${FR(w, d)}`, `${wa(String(w))} ${FR(d, n)}`, `${wa(String(w + 1))} ${FR(r, d)}`, r > 1 ? `${wa(String(w))} ${FR(r - 1, d)}` : `${wa(String(w))} ${FR(r + 1, d)}`]), e: `${n} ÷ ${d} = ${w} … ${r}이라 ${ida(MR(n, d))}`, k: fx('n/d', { n, d }) };
  return { q: `${eul(MR(n, d))} 가분수로 나타내면?`, a: FR(n, d), w: R.shuffle([FR(w * d, d), FR(w + r, d), FR(n, d + 1), FR(n + 1, d)].filter((s) => s !== FR(n, d))), e: `${w} = ${FR(w * d, d)}, 더하면 ${ida(FR(n, d))}`, k: fx('n/d', { n, d }) };
});
T('e3-2', 3, '[4수01-09]', (R) => {
  const d = R.int(2, 6), m = R.int(1, d - 1), a = d * R.int(2, 8);
  const v = (a / d) * m;
  return { q: `${a}의 ${d}분의 ${eun(String(m))} 얼마인가요?`, a: v, w: R.shuffle([a / d, a * m, a - v, v + m].filter((x) => x !== v && x > 0)), e: `${eul(String(a))} ${d}묶음으로 나눈 ${m}묶음: ${a / d} × ${m} = ${v}`, k: fx('a/d*m', { a, d, m }) };
});
T('e3-2', 3, '[4수01-10]', (R) => {
  const d = R.int(3, 9), ns = R.distinct(4, 1, 3 * d, (n) => n % d !== 0), big = R.chance(0.5);
  const asMixed = R.chance(0.5);
  return { ...extQ(R, ns, (n) => (asMixed ? MR(n, d) : FR(n, d)), big, ''), q: `다음 중 가장 ${big ? '큰' : '작은'} 분수는?`, e: asMixed ? '자연수 부분이 클수록, 같으면 분자가 클수록 커요.' : '분모가 같으면 분자가 클수록 커요.' };
});
T('e3-2', 3, '[4수01-12]', (R) => {
  const k = R.int(11, 99);
  if (k % 10 === 0) return null;
  return { q: `0.1이 ${k}개인 수는?`, a: D(k / 10), w: R.shuffle([String(k), D(k / 100), D(k / 10 + 1), D(k / 10 - 1)]), e: `0.1이 10개면 1이니 ${k}개는 ${ida(D(k / 10))}`, k: fx('k/10', { k }) };
});
T('e3-2', 4, '[4수03-18]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const a = R.int(1, 9), b = R.pick([R.int(1, 9) * 100, R.int(1, 19) * 50, R.int(1, 9) * 10]); return { q: `${a} L ${b} mL는 몇 mL인가요?`, a: `${1000 * a + b} mL`, w: Us([Number(`${a}${b}`), 100 * a + b, 1000 * a + b + 1000, 10000 * a + b].filter((v) => v !== 1000 * a + b), 'mL'), e: `1 L = 1000 mL이니 ${1000 * a} + ${b} = ${1000 * a + b} mL`, k: fx('1000*a+b', { a, b }, 'mL') }; }
  if (r === 2) { const n = R.int(1001, 9999); if (n % 1000 === 0) return null; return { q: `${n} mL는 몇 L 몇 mL인가요?`, a: volL(n), w: R.shuffle([`${Math.floor(n / 100)} L ${n % 100} mL`, volL(n + 1000), `${Math.floor(n / 1000)} L ${(n % 1000) * 10} mL`, volL(n > 2000 ? n - 1000 : n + 2000)]), e: `1000 mL = 1 L이에요.`, k: fx('n', { n }, 'mL') }; }
  const a = R.int(1, 5), b = R.int(1, 9) * 100, c = R.int(1, 4), d = R.int(1, 9) * 100, add = R.chance(0.6);
  if (add) { const s = 1000 * (a + c) + b + d; return { q: `${a} L ${b} mL + ${c} L ${d} mL = ?`, a: volL(s), w: R.shuffle([volL(s - 1000), volL(s + 1000), volL(s + 100), volL(s - 100)]), e: b + d >= 1000 ? 'mL끼리 더해 1000 mL가 넘으면 1 L로 받아올려요.' : 'L끼리, mL끼리 더해요.', k: fx('1000*(a+c)+b+d', { a, b, c, d }, 'mL') }; }
  const A = a + c + 1, s = 1000 * (A - c) + b - d;
  return { q: `${A} L ${b} mL − ${c} L ${d} mL = ?`, a: volL(s), w: R.shuffle([volL(s + 1000), volL(1000 * (A - c) + Math.abs(b - d)), volL(s - 1000), volL(s + 100)]), e: b < d ? '1 L를 1000 mL로 받아내려 계산해요.' : 'L끼리, mL끼리 빼요.', k: fx('1000*(A-c)+b-d', { A, b, c, d }, 'mL') };
});
T('e3-2', 4, '[4수03-21]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const a = R.int(1, 9), b = R.pick([R.int(1, 9) * 100, R.int(1, 99) * 10, R.int(1, 9)]); return { q: `${a} kg ${b} g은 몇 g인가요?`, a: `${1000 * a + b} g`, w: Us([Number(`${a}${b}`), 100 * a + b, 10000 * a + b, 1000 * a + b + 1000].filter((v) => v !== 1000 * a + b), 'g'), e: `1 kg = 1000 g이니 ${1000 * a} + ${b} = ${1000 * a + b} g`, k: fx('1000*a+b', { a, b }, 'g') }; }
  if (r === 2) { const a = R.int(1, 5), b = R.int(1, 9) * 100, c = R.int(1, 4), d = R.int(1, 9) * 100, s = 1000 * (a + c) + b + d; return { q: `${a} kg ${b} g + ${c} kg ${d} g = ?`, a: wtKG(s), w: R.shuffle([wtKG(s - 1000), wtKG(s + 1000), wtKG(s + 100), wtKG(s - 100)]), e: `kg끼리, g끼리 더하고 1000 g은 1 kg으로 받아올려요.`, k: fx('1000*(a+c)+b+d', { a, b, c, d }, 'g'), std: '[4수03-22]' }; }
  if (r === 3) { const t = R.int(1, 9); return { q: `${t} t은 몇 kg인가요?`, a: `${1000 * t} kg`, w: Us([100 * t, 10000 * t, 10 * t, 1000 * t + 1000], 'kg'), e: `1 t = 1000 kg이에요.`, k: fx('1000*t', { t }, 'kg'), std: '[4수03-22]' }; }
  const a = R.int(3, 9), b = R.int(1, 8) * 100, c = R.int(1, a - 1), d = R.int(b / 100 + 1, 9) * 100, s = 1000 * (a - c) + b - d;
  return { q: `${a} kg ${b} g − ${c} kg ${d} g = ?`, a: wtKG(s), w: R.shuffle([wtKG(1000 * (a - c) + d - b), wtKG(s + 1000), wtKG(s - 100 > 0 ? s - 100 : s + 200), wtKG(s + 100)]), e: '1 kg을 1000 g으로 받아내려 계산해요.', k: fx('1000*(a-c)+b-d', { a, b, c, d }, 'g'), std: '[4수03-22]' };
});
T('e3-2', 5, '[4수04-01]', (R) => {
  const [B, S, u] = R.pick([[10, 1, '명'], [100, 10, '상자'], [10, 1, '그루'], [100, 10, '권']]), a = R.int(1, 9), b = R.int(1, 9);
  const v = B * a + S * b;
  if (R.chance(0.6)) return { q: `큰 그림은 ${B}${u}, 작은 그림은 ${S}${u}이에요. 큰 그림 ${a}개, 작은 그림 ${b}개는?`.replace(`${S}${u}이에요`, ida(`${S}${u}`)), a: `${v}${u}`, w: Us([a + b, B * b + S * a, v + B, v - S].filter((x) => x !== v), u), e: `${B} × ${a} + ${S} × ${b} = ${v}`, k: fx('B*a+S*b', { B, S, a, b }, u) };
  const c = R.int(1, 9), d = R.int(1, 9), v2 = B * c + S * d;
  if (v === v2) return null;
  const [x, y] = v > v2 ? [v, v2] : [v2, v];
  return { q: `그림그래프에서 가 마을은 ${x}${u}, 나 마을은 ${y}${u}이에요. 두 마을의 차는?`.replace(`${y}${u}이에요`, ida(`${y}${u}`)), a: `${x - y}${u}`, w: Us([x + y, x - y + B, x - y + S, Math.abs(x - y - S)].filter((z) => z !== x - y && z > 0), u), e: `${x} − ${y} = ${x - y}`, k: fx('x-y', { x, y }, u) };
});
F('e3-2', 5, '[4수04-01]', [
  ['그림그래프의 좋은 점은?', '그림으로 많고 적음을 한눈에 알 수 있어요', ['정확한 날짜를 알 수 있어요', '조사한 사람의 이름을 알 수 있어요', '자료가 늘어나요'], '그림의 크기와 개수로 수량을 쉽게 비교해요.'],
  ['그림그래프에서 큰 그림이 나타내는 수는 작은 그림보다?', '커요', ['작아요', '같아요', '알 수 없어요'], '큰 그림은 더 큰 수를 나타내요.'],
]);

// =====================================================================
// 4학년 1학기
// =====================================================================
T('e4-1', 0, '[4수01-01]', (R) => {
  const ds = [R.int(1, 9), R.int(0, 9), R.chance(0.4) ? 0 : R.int(1, 9), R.chance(0.4) ? 0 : R.int(1, 9), R.int(0, 9)];
  const names = ['만', '천', '백', '십', '일'];
  const parts = ds.map((d, i) => (d ? `${iga(names[i])} ${d}개` : null)).filter(Boolean);
  const n = +ds.join('');
  const nz = +ds.filter((d) => d).join('');
  return { q: `${parts.join(', ')}인 수는?`, a: n, w: R.shuffle([nz !== n ? nz : null, n * 10, n + 1000, n - 1000, n + 10000].filter((v) => v !== null && v !== n)), e: ds.map((d, i) => d * 10 ** (4 - i)).filter((x) => x).join(' + ') + ` = ${n}`, k: { k: 'compose', parts: ds.map((d, i) => [10 ** (4 - i), d]) } };
});
T('e4-1', 0, '[4수01-01]', (R) => {
  const e = R.int(1, 99), m = R.int(1, 9999);
  const n = e * 1e8 + m * 1e4;
  return { q: `1억이 ${e}개, 1만이 ${m}개인 수는?`, a: kor(n), w: R.shuffle([kor(e * 1e8 + m * 1e3), kor(e * 1e9 + m * 1e4), kor(e * 1e7 + m * 1e4), kor(e * 1e8 + m)].filter((s) => s !== kor(n))), e: `${e}억과 ${m}만을 합해 ${ida(kor(n))}`.replace(`${e}억과`, `${wa(e + '억')}`), k: { k: 'compose', parts: [[1e8, e], [1e4, m]] } };
});
T('e4-1', 0, '[4수01-01]', (R) => {
  const nd = R.int(6, 9), ds = R.sample([1, 2, 3, 4, 5, 6, 7, 8, 9], nd), n = +ds.join('');
  const pi = R.int(0, nd - 1), d = ds[pi], p = nd - 1 - pi, v = d * 10 ** p;
  return { q: `${n}에서 숫자 ${iga(String(d))} 나타내는 값은?`, a: kor(v), w: R.shuffle([p - 1, p + 1, p - 2, p + 2].filter((x) => x >= 0 && x <= 9).map((x) => kor(d * 10 ** x))), e: `${d}은(는) 앞에서 ${pi + 1}번째 자리라 ${ida(kor(v))}`.replace('은(는)', bat(String(d)) ? '은' : '는'), k: { k: 'pv', n, d } };
});
T('e4-1', 0, '[4수01-02]', (R) => {
  if (R.chance(0.5)) {
    const s = R.pick([1e4, 1e5, 1e6, 1e7, 1e8, 1e9]), k = R.int(2, 4), n = R.int(1, 99) * s * 10 / R.pick([1, 10]) + R.int(1, 9) * s;
    const a = n + s * k;
    return { q: `${kor(n)}에서 ${kor(s)}씩 ${k}번 뛰어 센 수는?`, a: kor(a), w: R.shuffle([kor(n + s * 10 * k), kor(n + s * (k + 1)), kor(n + (s / 10) * k), kor(n + s * (k - 1))]), e: `${kor(s)}씩 ${k}번이면 ${kor(s * k)} 커져요.`, k: fx('n+s*k', { n, s, k }) };
  }
  const base = R.int(1, 9) * 1e8, vals = R.distinct(4, 1, 30).map((x) => base + R.pick([1e7, 1e6, 1e5]) * x);
  if (new Set(vals).size < 4) return null;
  return extQ(R, vals, kor, R.chance(0.5), '높은 자리부터 차례로 비교해요.');
});
T('e4-1', 0, '[4수01-01]', (R) => {
  const [x, y] = R.pick([[1e4, 1e3], [1e8, 1e7], [1e8, 1e4], [1e12, 1e8], [1e5, 1e4], [1e7, 1e5], [1e12, 1e11]]);
  const a = x / y;
  return { q: `${eun(kor(x).replace(/^1(?=[만억조])/, '1'))} ${iga(kor(y))} 몇 개인 수인가요?`, a: `${kor(a)}개`, w: Us([a * 10, a / 10 >= 1 ? a / 10 : a * 100, a * 100].filter((v) => v !== a), '개').map((s) => s.replace(/^(\d+)/, (m) => kor(+m))), e: `${kor(y)} × ${kor(a)} = ${kor(x)}`, k: fx('x/y', { x, y }, '개') };
});
T('e4-1', 1, '[4수03-25]', (R) => {
  if (R.chance(0.5)) { const a = R.int(25, 100), b = R.int(20, 150 - a), c = 180 - a - b; return { q: `삼각형의 두 각이 ${a}°, ${b}°일 때 나머지 한 각은?`, a: `${c}°`, w: Us([360 - a - b, a + b, 180 - a, c + 10].filter((v) => v !== c && v > 0), '°'), e: `180° − (${a}° + ${b}°) = ${c}°`, k: fx('180-a-b', { a, b }, '°') }; }
  const a = R.int(60, 120), b = R.int(50, 120), c = R.int(50, 120), d = 360 - a - b - c;
  if (d <= 20 || d >= 180) return null;
  return { q: `사각형의 세 각이 ${a}°, ${b}°, ${c}°일 때 나머지 한 각은?`, a: `${d}°`, w: Us([540 - a - b - c, d + 10, d - 10, 180 - d].filter((v) => v !== d && v > 0 && v < 360), '°'), e: `360° − (${a}° + ${b}° + ${c}°) = ${d}°`, k: fx('360-a-b-c', { a, b, c }, '°') };
});
T('e4-1', 1, '[4수03-24]', (R) => {
  const a = R.int(15, 140), b = R.int(10, 120);
  if (R.chance(0.5)) { if (a + b >= 360) return null; return { q: `${a}° + ${b}° = ?`, a: `${a + b}°`, w: Us([a + b + 10, a + b - 10, Math.abs(a - b), a + b + 1].filter((v) => v !== a + b), '°'), e: `자연수의 덧셈처럼 더해요: ${a + b}°`, k: fx('a+b', { a, b }, '°') }; }
  const [x, y] = a > b ? [a, b] : [b, a];
  if (x === y) return null;
  return { q: `${x}° − ${y}° = ?`, a: `${x - y}°`, w: Us([x + y, x - y + 10, x - y - 10, x - y + 1].filter((v) => v !== x - y && v > 0), '°'), e: `자연수의 뺄셈처럼 빼요: ${x - y}°`, k: fx('x-y', { x, y }, '°') };
});
T('e4-1', 1, '[4수03-02]', (R) => {
  const a = R.pick([R.int(10, 89), R.int(91, 179), 90]);
  return { q: `크기가 ${a}°인 각은 어떤 각인가요?`, a: a < 90 ? '예각' : a === 90 ? '직각' : '둔각', w: ['예각', '직각', '둔각', '평각'].filter((s) => s !== (a < 90 ? '예각' : a === 90 ? '직각' : '둔각')), e: a < 90 ? '0°보다 크고 직각보다 작으면 예각이에요.' : a === 90 ? '90°는 직각이에요.' : '직각보다 크고 180°보다 작으면 둔각이에요.', k: { k: 'angcls', a } };
});
T('e4-1', 1, '[4수03-24]', (R) => {
  const n = R.int(2, 4);
  return { q: `직각 ${n}개를 합한 각의 크기는?`, a: `${90 * n}°`, w: Us([90 * n + 90, 90 * n - 90, 60 * n, 180 * n].filter((v) => v !== 90 * n && v > 0), '°'), e: `90° × ${n} = ${90 * n}°`, k: fx('90*n', { n }, '°') };
});
T('e4-1', 2, '[4수01-04]', (R) => {
  if (R.chance(0.4)) { const a = R.int(101, 499), m = R.int(2, 9) * 10, p = a * m; return { q: `${a} × ${m} = ?`, a: p, w: R.shuffle([p / 10, p * 10, p + 1000, p - 100]), e: `${a} × ${m / 10} = ${p / 10}에 0을 붙여 ${p}`, k: { k: 'qx' } }; }
  const a = R.int(102, 499), b = R.int(12, 49), t = Math.floor(b / 10), o = b % 10, p = a * b;
  if (o === 0) return null;
  return { q: `${a} × ${b} = ?`, a: p, w: R.shuffle([a * t + a * o, p + 100, p - 10, p + 1000].filter((v) => v !== p)), e: `${a} × ${t * 10} = ${a * t * 10}, ${a} × ${o} = ${a * o}, 합은 ${p}`, k: { k: 'qx' } };
});
T('e4-1', 2, '[4수01-07]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const b = R.int(2, 9) * 10, q = R.int(2, 9), a = b * q; return { q: `${a} ÷ ${b} = ?`, a: q, w: R.shuffle([q * 10, q + 1, q - 1, a / 10]).filter((v) => v !== q), e: `${b} × ${q} = ${a}이라 몫은 ${ida(String(q))}`, k: { k: 'qx' } }; }
  const b = R.int(12, 45), q = R.int(r === 2 ? 2 : 11, r === 2 ? 9 : 35), rr = R.int(1, b - 1), a = b * q + rr;
  if (a > 999) return null;
  return { q: `${a} ÷ ${b}의 몫과 나머지는?`, a: qrS(q, rr), w: R.shuffle([qrS(q - 1, rr + b), qrS(q + 1, rr), qrS(q, rr + 1 < b ? rr + 1 : rr - 1), qrS(q * 10 > 99 ? q + 2 : q * 10, rr)]), e: `${b} × ${q} = ${b * q}, ${a} − ${b * q} = ${rr}`, k: { k: 'qr', a, b } };
});
T('e4-1', 3, '[4수03-08]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const a = R.int(20, 85); if (a === 60) return null; return { q: `이등변삼각형에서 크기가 같은 두 각이 ${a}°씩이면 나머지 각은?`, a: `${180 - 2 * a}°`, w: Us([180 - a, 2 * a, 90 - a > 0 ? 90 - a : 360 - 2 * a, 180 - 2 * a + 10].filter((v) => v !== 180 - 2 * a && v > 0), '°'), e: `180° − ${a}° × 2 = ${180 - 2 * a}°`, k: fx('180-2*a', { a }, '°') }; }
  if (r === 2) { const a = R.int(10, 80) * 2; if (a === 60) return null; const b = (180 - a) / 2; return { q: `이등변삼각형에서 크기가 다른 한 각이 ${a}°이면 같은 두 각 중 한 각은?`, a: `${b}°`, w: Us([180 - a, a / 2, b + 10, 2 * b].filter((v) => v !== b && v > 0), '°'), e: `(180° − ${a}°) ÷ 2 = ${b}°`, k: fx('(180-a)/2', { a }, '°') }; }
  if (r === 3) { const a = R.int(3, 25); return { q: `한 변이 ${a} cm인 정삼각형의 세 변의 길이의 합은?`, a: `${3 * a} cm`, w: Us([2 * a, 4 * a, 3 * a + 3, a + 3].filter((v) => v !== 3 * a), 'cm'), e: `세 변이 같으니 ${a} × 3 = ${3 * a} cm`, k: fx('3*a', { a }, 'cm') }; }
  const a = R.int(5, 20), b = R.int(3, 2 * a - 1);
  if (a === b) return null;
  return { q: `길이가 같은 두 변이 ${a} cm, 나머지 한 변이 ${b} cm인 이등변삼각형의 세 변의 합은?`, a: `${2 * a + b} cm`, w: Us([a + b, a + 2 * b, 3 * a, 2 * a + b + 1].filter((v) => v !== 2 * a + b), 'cm'), e: `${a} + ${a} + ${b} = ${2 * a + b} cm`, k: fx('2*a+b', { a, b }, 'cm') };
});
T('e4-1', 3, '[4수03-08]', (R) => {
  const a = R.int(20, 100), b = R.int(20, 150 - a), c = 180 - a - b;
  if (c <= 0 || a === 60 && b === 60) return null;
  const ang = R.shuffle([a, b, c]);
  const m = Math.max(...ang), ans = m < 90 ? '예각삼각형' : m === 90 ? '직각삼각형' : '둔각삼각형';
  return { q: `세 각이 ${ang.join('°, ')}°인 삼각형은?`, a: ans, w: ['예각삼각형', '직각삼각형', '둔각삼각형', '정사각형'].filter((s) => s !== ans), e: `가장 큰 각이 ${m}°라 ${ida(ans)}`, k: { k: 'tricls', ang } };
});
F('e4-1', 3, '[4수03-08]', [
  ['정삼각형의 한 각의 크기는?', '60°', ['90°', '45°', '180°'], '세 각이 같으므로 180° ÷ 3 = 60°예요.'],
  ['두 변의 길이가 같은 삼각형은?', '이등변삼각형', ['정사각형', '직각삼각형', '평행사변형'], '두 변의 길이가 같으면 이등변삼각형이에요.'],
  ['세 변의 길이가 같은 삼각형은?', '정삼각형', ['직각삼각형', '둔각삼각형', '사다리꼴'], '세 변이 같은 삼각형은 정삼각형이에요.'],
  ['한 각이 둔각인 삼각형은?', '둔각삼각형', ['예각삼각형', '직각삼각형', '정삼각형'], '한 각이 둔각이면 둔각삼각형이에요.'],
  ['세 각이 모두 예각인 삼각형은?', '예각삼각형', ['둔각삼각형', '직각삼각형', '직사각형'], '세 각이 모두 예각이면 예각삼각형이에요.'],
]);
T('e4-1', 4, '[4수04-01]', (R) => {
  const c = R.pick([1, 2, 5, 10]), r = R.int(1, 3);
  if (r === 1) { const k = R.int(3, 12); return { q: `막대그래프에서 눈금 한 칸이 ${c}명일 때 막대가 ${k}칸이면 몇 명?`, a: `${c * k}명`, w: Us([k, c + k, c * (k + 1), c * k + 1].filter((v) => v !== c * k), '명'), e: `${c}명 × ${k}칸 = ${c * k}명`, k: fx('c*k', { c, k }, '명') }; }
  if (r === 2) { const a = R.int(3, 12), b = R.int(2, 11); if (a === b) return null; const [x, y] = a > b ? [a, b] : [b, a]; return { q: `눈금 한 칸이 ${c}명인 막대그래프에서 축구는 ${x}칸, 야구는 ${y}칸이에요. 차는 몇 명?`, a: `${(x - y) * c}명`, w: Us([x - y, (x + y) * c, (x - y) * c + c, x * c].filter((v) => v !== (x - y) * c), '명'), e: `(${x} − ${y}) × ${c} = ${(x - y) * c}명`, k: fx('(x-y)*c', { x, y, c }, '명') }; }
  if (c === 1) return null;
  const k = R.int(3, 12), n = c * k;
  return { q: `눈금 한 칸이 ${c}명인 막대그래프에 ${n}명을 나타내려면 막대는 몇 칸?`, a: `${k}칸`, w: Us([n, k + 1, k - 1, n + c].filter((v) => v !== k), '칸'), e: `${n} ÷ ${c} = ${k}칸`, k: fx('n/c', { n, c }, '칸') };
});
F('e4-1', 4, '[4수04-01]', [
  ['막대그래프에서 막대의 길이가 나타내는 것은?', '각 항목의 수량', ['항목의 이름', '조사한 날짜', '그래프의 제목'], '막대가 길수록 그 항목의 수가 많아요.'],
  ['막대그래프의 좋은 점은?', '항목별 크기를 한눈에 비교해요', ['조사한 사람을 알 수 있어요', '변화를 정확히 알 수 있어요', '자료가 늘어나요'], '막대 길이로 크기를 쉽게 비교해요.'],
]);
T('e4-1', 5, '[4수02-01]', (R) => {
  if (R.chance(0.5)) { const step = R.pick([2, 3, 4, 5]), start = R.int(1, 5); return seqQ(R, start, step, R.int(4, 5), true); }
  const step = R.pick([11, 25, 50, 100, 101, 110, 1000, 1100]), start = R.int(100, 3000);
  return R.chance(0.6) ? seqQ(R, start, step, 5) : seqGapQ(R, start, step, 5);
});
T('e4-1', 5, '[4수02-02]', (R) => {
  const a0 = R.int(1, 5) * 100 + R.int(1, 9), b0 = R.int(1, 5) * 100 + R.int(1, 9), da = R.pick([1, 10, 100]), db = R.pick([1, 10, 100]);
  const line = (i) => `${a0 + da * i}+${b0 + db * i}=${a0 + b0 + (da + db) * i}`;
  const ans = line(3);
  return { q: `${line(0)}, ${line(1)}, ${line(2)} 다음에 올 식은?`, a: ans, w: R.shuffle([`${a0 + da * 3}+${b0 + db * 3}=${a0 + b0 + (da + db) * 3 + 1}`, `${a0 + da * 3}+${b0 + db * 2}=${a0 + b0 + da * 3 + db * 2}`, `${a0 + da * 4}+${b0 + db * 4}=${a0 + b0 + (da + db) * 4}`, `${a0 + da * 3}+${b0 + db * 3}=${a0 + b0 + (da + db) * 2}`]), e: `두 수가 ${da}, ${db}씩 커지면 합은 ${da + db}씩 커져요.`, k: { k: 'calcpat', a0, b0, da, db } };
});
T('e4-1', 5, '[4수02-03]', (R) => {
  if (R.chance(0.5)) {
    const a = R.int(5, 40), b = R.int(5, 40), c = R.int(1, a + b - 1);
    return { q: `${a} + ${b} = ${c} + □에서 □는?`, a: a + b - c, w: R.shuffle([a + b, a + b + c, a + b - c + 1, Math.abs(a - c) + 1].filter((v) => v !== a + b - c && v > 0)), e: `${a} + ${b} = ${a + b}이니 □ = ${a + b} − ${c} = ${a + b - c}`, k: fx('a+b-c', { a, b, c }) };
  }
  const x = R.int(2, 9), y = R.int(2, 9), s = x + y, t = R.int(1, s - 1);
  const good = `${x} + ${y} = ${t} + ${s - t}`;
  return { q: '등호(=)를 바르게 사용한 식은?', a: good, w: R.shuffle([`${x} + ${y} = ${s + 1}`, `${x} × ${y} = ${x * y + 1}`, `${x + y + 3} − ${y} = ${x + 2}`, `${x} + ${y} = ${t} + ${s - t + 1}`]), e: '등호 양쪽의 값이 같아야 해요.', k: { k: 'eqtrue' } };
});

// =====================================================================
// 4학년 2학기
// =====================================================================
T('e4-2', 0, '[4수01-15]', (R) => {
  const d = R.int(3, 13), r = R.int(1, 3);
  if (r === 1) { const a = R.int(1, d - 1), b = R.int(1, d - 1), s = a + b; return { q: `${FR(a, d)} + ${FR(b, d)} = ?`, a: MR(s, d), w: R.shuffle([MR(s, 2 * d), MR(s + 1, d), MR(s - 1, d), FR(a * b, d)]), e: `분모는 그대로, 분자끼리 ${a} + ${b} = ${s}`, k: { k: 'qx' } }; }
  if (r === 2) { const a = R.int(2, d - 1), b = R.int(1, a - 1); return { q: `${FR(a, d)} − ${FR(b, d)} = ?`, a: FR(a - b, d), w: R.shuffle([MR(a + b, d), FR(a - b + 1, d), a - b > 1 ? FR(a - b - 1, d) : FR(a, d), `0분의 ${a - b}`]), e: `분모는 그대로, 분자끼리 ${a} − ${b} = ${a - b}`, k: { k: 'qx' } }; }
  const n = R.int(1, 4), b = R.int(1, d - 1);
  return { q: `${n} − ${FR(b, d)} = ?`, a: MR(n * d - b, d), w: R.shuffle([MR((n - 1) * d + b, d) === MR(n * d - b, d) ? FR(b, d) : MR((n - 1) * d + b, d), MR(n * d - b + d, d), MR(n * d - b - 1, d), `${n - 1 > 0 ? wa(String(n - 1)) + ' ' : ''}${FR(b, d)}`.trim()]), e: `${n} = ${ro(FR(n * d, d))} 바꾸어 ${n * d} − ${b} = ${n * d - b}`, k: { k: 'qx' } };
});
T('e4-2', 0, '[4수01-15]', (R) => {
  const d = R.int(3, 11), w1 = R.int(1, 5), w2 = R.int(1, 4), a = R.int(1, d - 1), b = R.int(1, d - 1);
  if (R.chance(0.5)) {
    const s = (w1 + w2) * d + a + b;
    return { q: `${MR(w1 * d + a, d)} + ${MR(w2 * d + b, d)} = ?`, a: MR(s, d), w: R.shuffle([MR(s - d, d), MR(s + d, d), MR((w1 + w2) * 2 * d + a + b, 2 * d), MR(s + 1, d)]), e: `자연수끼리 ${w1 + w2}, 분수끼리 ${FR(a + b, d)}` + (a + b >= d ? ' (받아올림)' : ''), k: { k: 'qx' } };
  }
  const W = w1 + w2, s = W * d + a - (w2 * d + b);
  if (s <= 0) return null;
  return { q: `${MR(W * d + a, d)} − ${MR(w2 * d + b, d)} = ?`, a: MR(s, d), w: R.shuffle([MR(w1 * d + Math.abs(a - b), d), MR(s + d, d), MR(s - 1 > 0 ? s - 1 : s + 2, d), MR(s + 1, d)]), e: a < b ? `자연수에서 1을 받아내려 분수끼리 빼요.` : `자연수끼리, 분수끼리 빼요.`, k: { k: 'qx' } };
});
F('e4-2', 1, '[4수03-10]', [
  ['마주 보는 두 쌍의 변이 서로 평행한 사각형은?', '평행사변형', ['사다리꼴', '삼각형', '오각형'], '두 쌍의 변이 평행하면 평행사변형이에요.'],
  ['평행한 변이 한 쌍이라도 있는 사각형은?', '사다리꼴', ['오각형', '삼각형', '원'], '평행한 변이 한 쌍이라도 있으면 사다리꼴이에요.'],
  ['네 변의 길이가 모두 같은 사각형은?', '마름모', ['사다리꼴', '직사각형', '평행사변형'], '네 변의 길이가 같은 사각형은 마름모예요.'],
  ['두 직선이 만나서 이루는 각이 직각일 때 두 직선의 관계는?', '서로 수직', ['서로 평행', '서로 대칭', '서로 합동'], '직각으로 만나면 서로 수직이에요.', '[4수03-03]'],
  ['서로 만나지 않는 두 직선의 관계는?', '서로 평행', ['서로 수직', '서로 합동', '서로 대칭'], '아무리 늘여도 만나지 않으면 평행해요.', '[4수03-03]'],
  ['평행선 사이의 수직인 선분의 길이를 무엇이라 하나요?', '평행선 사이의 거리', ['대각선', '높이의 합', '둘레'], '평행선에 수직인 선분의 길이가 거리예요.', '[4수03-03]'],
  ['마름모에서 마주 보는 두 각의 크기는?', '서로 같아요', ['합이 90°예요', '항상 직각이에요', '합이 360°예요'], '마름모는 마주 보는 각의 크기가 같아요.'],
]);
T('e4-2', 1, '[4수03-10]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const a = R.int(30, 150); if (a === 90) return null; return { q: `평행사변형의 한 각이 ${a}°이면 이웃한 각은?`, a: `${180 - a}°`, w: Us([a, 360 - a, 90 - a > 0 ? 90 - a : a - 90, 180 - a + 10].filter((v) => v !== 180 - a && v > 0), '°'), e: `이웃한 두 각의 합은 180°라 ${180 - a}°`, k: fx('180-a', { a }, '°') }; }
  if (r === 2) { const a = R.int(3, 20); return { q: `한 변이 ${a} cm인 마름모의 네 변의 길이의 합은?`, a: `${4 * a} cm`, w: Us([2 * a, a * a, 4 * a + 4, 3 * a].filter((v) => v !== 4 * a), 'cm'), e: `네 변이 같으니 ${a} × 4 = ${4 * a} cm`, k: fx('4*a', { a }, 'cm') }; }
  const a = R.int(4, 20), b = R.int(3, 15);
  if (a === b) return null;
  return { q: `이웃한 두 변이 ${a} cm, ${b} cm인 평행사변형의 네 변의 길이의 합은?`, a: `${2 * (a + b)} cm`, w: Us([a + b, a * b, 2 * a + b, 4 * a].filter((v) => v !== 2 * (a + b)), 'cm'), e: `마주 보는 변이 같아 (${a} + ${b}) × 2 = ${2 * (a + b)} cm`, k: fx('2*(a+b)', { a, b }, 'cm') };
});
T('e4-2', 2, '[4수01-16]', (R) => {
  const p1 = R.int(1, 2), p2 = R.int(1, 2), A = R.int(5, 999) , B = R.int(5, 999);
  const x = A / 10 ** p1, y = B / 10 ** p2, add = R.chance(0.5);
  if (x >= 100 || y >= 100) return null;
  if (add) { const s = x + y; return { q: `${D(x)} + ${D(y)} = ?`, a: D(s), w: R.shuffle([D(s * 10), D(s / 10), D(s + 0.1), D(s - 0.01), D(s + 1)].filter((v) => v !== D(s) && +v > 0)), e: `소수점을 맞추어 더하면 ${D(s)}`, k: { k: 'qx' } }; }
  const [u, v] = x > y ? [x, y] : [y, x];
  if (u === v) return null;
  const s = u - v;
  return { q: `${D(u)} − ${D(v)} = ?`, a: D(s), w: R.shuffle([D(s * 10), D(s + 0.1), D(s + 0.01), D(s + 1), D(Math.abs(s - 0.1))].filter((t) => t !== D(s) && +t > 0)), e: `소수점을 맞추어 빼면 ${D(s)}`, k: { k: 'qx' } };
});
T('e4-2', 2, '[4수01-13]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const k = R.int(11, 999); if (k % 10 === 0) return null; return { q: `0.01이 ${k}개인 수는?`, a: D(k / 100), w: R.shuffle([D(k / 10), D(k / 1000), String(k), D(k / 100 + 1)]), e: `0.01이 100개면 1이에요.`, k: fx('k/100', { k }) }; }
  if (r === 2) { const x = R.int(11, 999) / 100, ten = R.chance(0.5); return { q: `${D(x)}의 ${ten ? '10배' : '10분의 1'}는?`, a: D(ten ? x * 10 : x / 10), w: R.shuffle([D(ten ? x / 10 : x * 10), D(ten ? x * 100 : x / 100), D(x + (ten ? 10 : 0.1)), D(x)].filter((s) => s !== D(ten ? x * 10 : x / 10))), e: ten ? '10배 하면 소수점이 오른쪽으로 한 칸 옮겨져요.' : '10분의 1이면 소수점이 왼쪽으로 한 칸 옮겨져요.', k: fx(ten ? 'x*10' : 'x/10', { x }) }; }
  const cm = R.int(101, 999), m = cm / 100;
  return { q: `${D(m)} m는 몇 cm인가요?`, a: `${cm} cm`, w: Us([cm / 10, cm * 10, Math.floor(cm / 100) * 100 + (cm % 100) / 10, cm + 100], 'cm'), e: `1 m = 100 cm이니 ${D(m)} × 100 = ${cm} cm`, k: fx('m*100', { m }, 'cm'), dec: true };
});
T('e4-2', 2, '[4수01-14]', (R) => {
  const big = R.chance(0.5), base = R.int(0, 5), vals = R.distinct(4, 1, 99).map((v) => base + v / (R.chance(0.5) ? 10 : 100));
  if (new Set(vals.map(D)).size < 4 || vals.some((v) => v === 0)) return null;
  return extQ(R, vals, D, big, '자연수 부분부터 소수 첫째, 둘째 자리 순서로 비교해요.');
});
T('e4-2', 3, '[4수03-11]', (R) => {
  const n = R.int(3, 10), r = R.int(1, 3);
  if (r === 1) return { q: `변이 ${n}개인 다각형의 이름은?`, a: POLY[n], w: R.shuffle([n - 1, n + 1, n + 2, n - 2].filter((v) => v >= 3 && v <= 10).map((v) => POLY[v])), e: `변이 ${n}개이면 ${ida(POLY[n])}`, k: { k: 'polyname', n } };
  if (r === 2) return { q: `${POLY[n]}의 꼭짓점은 몇 개인가요?`, a: `${n}개`, w: Us([n + 1, n - 1, 2 * n, n + 2], '개'), e: `${POLY[n]}은 꼭짓점이 ${n}개예요.`.replace('은 꼭', bat(POLY[n]) ? '은 꼭' : '는 꼭'), k: { k: 'polyside', name: POLY[n] } };
  const a = R.int(2, 15);
  return { q: `한 변이 ${a} cm인 정${POLY[n]}의 모든 변의 길이의 합은?`, a: `${n * a} cm`, w: Us([(n - 1) * a, (n + 1) * a, n + a, n * a + n].filter((v) => v !== n * a), 'cm'), e: `변이 ${n}개이므로 ${a} × ${n} = ${n * a} cm`, k: fx('n*a', { n, a }, 'cm') };
});
T('e4-2', 3, '[4수03-11]', (R) => {
  const n = R.int(4, 8), d = (n * (n - 3)) / 2;
  if (R.chance(0.6)) return { q: `${POLY[n]}의 대각선은 모두 몇 개인가요?`, a: `${d}개`, w: Us([n, n - 3, n * (n - 3), d + 1, 2 * n].filter((v) => v !== d && v > 0), '개'), e: `한 꼭짓점에서 ${n - 3}개씩: ${n} × ${n - 3} ÷ 2 = ${d}`, k: fx('n*(n-3)/2', { n }, '개') };
  const a = R.int(2, 12), S = n * a;
  return { q: `모든 변의 길이의 합이 ${S} cm인 정${POLY[n]}의 한 변은 몇 cm?`, a: `${a} cm`, w: Us([S - n, a + 1, S / 2, n].filter((v) => v !== a && v > 0 && Number.isInteger(v)), 'cm'), e: `${S} ÷ ${n} = ${a} cm`, k: fx('S/n', { S, n }, 'cm') };
});
F('e4-2', 3, '[4수03-11]', [
  ['변의 길이와 각의 크기가 모두 같은 다각형은?', '정다각형', ['사다리꼴', '직각삼각형', '평행사변형'], '변과 각이 모두 같으면 정다각형이에요.'],
  ['선분으로만 둘러싸인 도형은?', '다각형', ['원', '곡선', '반직선'], '선분으로만 둘러싸인 도형이 다각형이에요.'],
  ['이웃하지 않은 두 꼭짓점을 이은 선분은?', '대각선', ['변', '높이', '지름'], '이웃하지 않은 꼭짓점을 이으면 대각선이에요.'],
  ['삼각형에 그을 수 있는 대각선의 수는?', '0개', ['1개', '3개', '2개'], '삼각형은 모든 꼭짓점이 서로 이웃해요.'],
]);
T('e4-2', 4, '[4수04-02]', (R) => {
  const t = [R.int(8, 16)];
  const ds = R.distinct(3, 1, 6);
  ds.forEach((d) => t.push(t[t.length - 1] + d));
  const hours = [9, 10, 11, 12];
  const labels = ['9시~10시', '10시~11시', '11시~12시'];
  const desc = hours.map((h, i) => `${h}시 ${t[i]}°C`).join(', ');
  const r = R.int(1, 3);
  if (r === 1) { const i = ds.indexOf(Math.max(...ds)); return { q: `기온: ${desc}. 기온이 가장 많이 오른 때는?`, a: labels[i], w: [...labels.filter((_, j) => j !== i), '변화가 없어요'], e: `${labels[i]}에 ${ds[i]}°C로 가장 많이 올랐어요.`, k: { k: 'linerise', temps: t, labels } }; }
  if (r === 2) { const [i, j] = R.sample([0, 1, 2, 3], 2).sort(); return { q: `기온: ${desc}. ${hours[i]}시와 ${hours[j]}시의 기온 차는?`, a: `${t[j] - t[i]}°C`, w: Us([t[j] + t[i], t[j] - t[i] + 1, t[j], t[j] - t[i] + 2].filter((v) => v !== t[j] - t[i]), '°C'), e: `${t[j]} − ${t[i]} = ${t[j] - t[i]}°C`, k: fx('b-a', { a: t[i], b: t[j] }, '°C') }; }
  const a = R.int(8, 20), b = a + 2 * R.int(1, 4);
  return { q: `10시에 ${a}°C, 11시에 ${b}°C였어요. 10시 30분의 기온은 약 몇 °C일까요?`, a: `${(a + b) / 2}°C`, w: Us([a, b, a + b, (a + b) / 2 + 1].filter((v) => v !== (a + b) / 2), '°C'), e: `두 기온의 가운데: (${a} + ${b}) ÷ 2 = ${(a + b) / 2}`, k: fx('(a+b)/2', { a, b }, '°C') };
});
F('e4-2', 4, '[4수04-02]', [
  ['하루 동안의 기온 변화를 나타내기 가장 알맞은 그래프는?', '꺾은선그래프', ['그림그래프', '막대그래프', '띠그래프'], '시간에 따른 변화는 꺾은선그래프가 잘 보여 줘요.'],
  ['꺾은선그래프에서 선이 가장 많이 기울어진 곳은?', '변화가 가장 큰 곳', ['변화가 없는 곳', '값이 가장 작은 곳', '조사하지 않은 곳'], '기울기가 클수록 변화가 커요.'],
  ['꺾은선그래프에서 필요 없는 부분을 줄여 나타낼 때 쓰는 것은?', '물결선', ['점선', '화살표', '눈금 0'], '물결선으로 필요 없는 부분을 생략해요.'],
  ['꺾은선그래프로 나타내기 알맞은 것은?', '내 키의 해마다 변화', ['반 친구들이 좋아하는 색', '나라별 인구', '모둠별 책 수'], '시간에 따라 변하는 자료가 알맞아요.'],
]);
T('e4-2', 5, '[4수03-04]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const k = R.pick([1, 2, 3, 5, 6, 7]), deg = 90 * (k % 4); return { q: `도형을 시계 방향으로 90°씩 ${k}번 돌린 것은 시계 방향으로 몇 도 돌린 것과 같나요?`, a: `${deg}°`, w: Us([90, 180, 270, 360].filter((v) => v !== deg), '°'), e: `90° × ${k} = ${90 * k}°` + (k > 4 ? `, 360°를 빼면 ${deg}°` : ''), k: { k: 'rot', n: k, cw: true } }; }
  if (r === 2) { const k = R.int(1, 5), dir = R.pick(['오른쪽', '왼쪽', '위쪽', '아래쪽']); const lr = dir === '오른쪽' || dir === '왼쪽'; const ans = k % 2 === 0 ? '처음 도형과 같아요' : lr ? '왼쪽과 오른쪽이 바뀌어요' : '위쪽과 아래쪽이 바뀌어요'; return { q: `도형을 ${ro(dir)} ${k}번 뒤집으면?`, a: ans, w: ['처음 도형과 같아요', '왼쪽과 오른쪽이 바뀌어요', '위쪽과 아래쪽이 바뀌어요', '크기가 커져요'].filter((s) => s !== ans), e: k % 2 === 0 ? '같은 방향으로 2번 뒤집으면 처음과 같아요.' : k === 1 ? (lr ? '왼쪽이나 오른쪽으로 뒤집으면 좌우가 바뀌어요.' : '위나 아래로 뒤집으면 위아래가 바뀌어요.') : `${k}번은 한 번 뒤집은 것과 같아요.`, k: { k: 'flip', dir, n: k } }; }
  const a = R.int(2, 12), b = R.int(1, 12);
  if (a === b) return null;
  const d = a - b, ans = d > 0 ? `오른쪽으로 ${d} cm` : `왼쪽으로 ${-d} cm`;
  return { q: `도형을 오른쪽으로 ${a} cm 민 다음 왼쪽으로 ${b} cm 밀었어요. 처음 자리에서 어디에 있나요?`, a: ans, w: R.shuffle([`오른쪽으로 ${a + b} cm`, d > 0 ? `왼쪽으로 ${d} cm` : `오른쪽으로 ${-d} cm`, `왼쪽으로 ${a + b} cm`, d > 0 ? `오른쪽으로 ${d + 1} cm` : `왼쪽으로 ${-d + 1} cm`]), e: d > 0 ? `${a} − ${b} = ${d}만큼 오른쪽이에요.` : `${b} − ${a} = ${-d}만큼 왼쪽이에요.`, k: { k: 'slide', a, b } };
});
F('e4-2', 5, '[4수03-04]', [
  ['도형을 밀면 무엇이 바뀌나요?', '위치', ['모양', '크기', '방향'], '밀기는 모양과 방향은 그대로, 위치만 바뀌어요.'],
  ['도형을 시계 방향으로 90°씩 4번 돌리면?', '처음 도형과 같아요', ['180° 돌린 것과 같아요', '위아래가 뒤집혀요', '왼쪽으로 뒤집은 것과 같아요'], '90° × 4 = 360°로 한 바퀴예요.'],
  ['도형을 시계 방향으로 180° 돌린 것과 같은 것은?', '시계 반대 방향으로 180° 돌리기', ['시계 방향으로 90° 돌리기', '오른쪽으로 뒤집기', '아래로 밀기'], '180°는 어느 방향으로 돌려도 결과가 같아요.'],
  ['도형을 위쪽으로 뒤집으면 어떻게 되나요?', '위쪽과 아래쪽이 바뀌어요', ['왼쪽과 오른쪽이 바뀌어요', '처음 도형과 같아요', '크기가 작아져요'], '위나 아래로 뒤집으면 위아래가 바뀌어요.'],
]);

// =====================================================================
// 5학년 1학기
// =====================================================================
T('e5-1', 0, '[6수01-01]', (R) => {
  const p = R.int(1, 7);
  let s, a, w = [], e;
  if (p === 1) { const b = R.int(2, 9), c = R.int(2, 9), x = b * c + R.int(1, 40); s = `${x} − ${b} × ${c}`; a = x - b * c; w = [(x - b) * c]; e = `곱셈 먼저: ${b} × ${c} = ${b * c}, ${x} − ${b * c} = ${a}`; }
  else if (p === 2) { const c = R.int(2, 9), q = R.int(3, 12), sum = c * q, x = R.int(2, sum - 2), y = sum - x; s = `(${x} + ${y}) ÷ ${c}`; a = q; if (y % c === 0) w.push(x + y / c); w.push(sum); e = `( ) 안 먼저: ${sum} ÷ ${c} = ${q}`; }
  else if (p === 3) { const b = R.int(2, 9), q = R.int(2, 9), x = b * q, c = R.int(2, 9), d = R.int(2, 9); s = `${x} ÷ ${b} + ${c} × ${d}`; a = q + c * d; w = [(q + c) * d, q + c + d]; e = `${x} ÷ ${b} = ${q}, ${c} × ${d} = ${c * d}, 더하면 ${a}`; }
  else if (p === 4) { const x = R.int(5, 40), b = R.int(2, 9), c = R.int(2, 9), d = R.int(1, x + b * c - 1); s = `${x} + ${b} × ${c} − ${d}`; a = x + b * c - d; w = [(x + b) * c - d, c > d ? x + b * (c - d) : null]; e = `곱셈 먼저: ${x} + ${b * c} − ${d} = ${a}`; }
  else if (p === 5) { const x = R.int(2, 9), b = R.int(5, 20), c = R.int(1, b - 1); s = `${x} × (${b} − ${c})`; a = x * (b - c); w = [x * b - c, x * b + c]; e = `( ) 안 먼저: ${b - c}, ${x} × ${b - c} = ${a}`; }
  else if (p === 6) { const x = R.int(10, 30), b = R.int(1, x - 2), c = R.int(2, 6), d = R.int(1, 20); s = `(${x} − ${b}) × ${c} + ${d}`; a = (x - b) * c + d; w = [(x - b) * (c + d), x - b * c + d]; e = `${x - b} × ${c} = ${(x - b) * c}, 더하기 ${d}는 ${a}`; }
  else { const d = R.int(2, 9), q = R.int(2, 9), b = R.int(1, d * q - 1), c = d * q - b, x = q + R.int(1, 40); s = `${x} − (${b} + ${c}) ÷ ${d}`; a = x - q; if (c % d === 0 && x - b + c / d >= 0) w.push(x - b + c / d); w.push((x - b - c) / d); e = `( ) 안 먼저 ${b + c}, ${b + c} ÷ ${d} = ${q}, ${x} − ${q} = ${a}`; }
  w = w.filter((v) => v !== null && Number.isInteger(v) && v >= 0 && v !== a).concat(R.shuffle([a + 1, a - 1, a + 2, a + 10, a - 10]).filter((v) => v >= 0));
  return { q: `${s} = ?`, a, w, e, k: { k: 'qx' } };
});
T('e5-1', 0, '[6수01-01]', (R) => {
  const p = R.int(1, 3);
  if (p === 1) { const price = R.int(3, 9) * 100, n = R.int(2, 5), pay = Math.ceil((price * n + 100) / 1000) * 1000; const a = pay - price * n; return { q: `${price}원짜리 공책 ${n}권을 사고 ${pay}원을 냈어요. 거스름돈은?`, a: `${a}원`, w: Us([pay - price, a + price, a + 100, pay - price - n].filter((v) => v !== a && v >= 0), '원'), e: `${pay} − ${price} × ${n} = ${a}`, k: fx('pay-price*n', { pay, price, n }, '원') }; }
  if (p === 2) { const m = R.int(2, 6), per = R.int(3, 9), x = R.int(1, m * per - 1), y = m * per - x; return { q: `사과 ${x}개와 배 ${y}개를 ${m}명에게 똑같이 나누어 주면 한 명이 받는 과일은 몇 개?`, a: `${per}개`, w: Us([y % m === 0 ? x + y / m : null, x % m === 0 ? x / m + y : null, per + 1, per - 1, x + y].filter((v) => v !== null && v !== per && v > 0), '개'), e: `(${x} + ${y}) ÷ ${m} = ${per}`, k: fx('(x+y)/m', { x, y, m }, '개') }; }
  const a = R.int(10, 30), b = R.int(2, 9), c = R.int(2, 5);
  return { q: `구슬을 ${a}개 가지고 있었는데 ${b}개씩 ${c}봉지를 더 받았어요. 모두 몇 개?`, a: `${a + b * c}개`, w: Us([(a + b) * c, a + b + c, a + b * c + b, a * c + b].filter((v) => v !== a + b * c), '개'), e: `${a} + ${b} × ${c} = ${a + b * c}`, k: fx('a+b*c', { a, b, c }, '개') };
});
T('e5-1', 1, '[6수01-04]', (R) => {
  const g = R.int(2, 12), [x, y] = R.pick([[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [2, 7], [3, 7], [4, 7], [5, 7], [3, 8]]), a = g * x, b = g * y;
  if (b > 100) return null;
  const divs = []; for (let i = 1; i < g; i++) if (g % i === 0) divs.push(i);
  return { q: `${wa(String(a))} ${b}의 최대공약수는?`, a: g, w: R.shuffle([lcm(a, b), ...divs.filter((d) => d > 1), g * 2, a]).filter((v) => v !== g).concat([1]), e: `${a} = ${g} × ${x}, ${b} = ${g} × ${y}${bat(String(y)) ? '이라' : '라'} 최대공약수는 ${ida(String(g))}`, k: fx('gcd(a,b)', { a, b }) };
});
T('e5-1', 1, '[6수01-05]', (R) => {
  const [a, b] = R.sample([2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20], 2);
  const L = lcm(a, b);
  if (R.chance(0.3)) return { q: `버스 두 대가 ${a}분, ${b}분마다 출발해요. 함께 출발한 뒤 다시 함께 출발하는 것은 몇 분 후?`, a: `${L}분`, w: Us([a * b !== L ? a * b : L * 2, a + b, gcd(a, b), L * 2].filter((v) => v !== L), '분'), e: `${wa(String(a))} ${b}의 최소공배수 ${L}분 후예요.`, k: fx('lcm(a,b)', { a, b }, '분') };
  return { q: `${wa(String(a))} ${b}의 최소공배수는?`, a: L, w: R.shuffle([a * b !== L ? a * b : L * 3, gcd(a, b), L * 2, a + b].filter((v) => v !== L)).concat([L + a]), e: `${a}의 배수와 ${b}의 배수 중 가장 작은 공배수: ${L}`, k: fx('lcm(a,b)', { a, b }) };
});
T('e5-1', 1, '[6수01-04]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) {
    const n = R.int(3, 12), m = n * R.int(3, 9);
    const bad = R.distinct(3, m - 15 > n ? m - 15 : n + 1, m + 15, (v) => v % n !== 0);
    return { q: `다음 중 ${n}의 배수는?`, a: m, w: bad, e: `${n} × ${m / n} = ${m}`, k: { k: 'pick', p: 'mult', n }, std: '[6수01-05]' };
  }
  const n = R.pick([12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 45, 48]);
  const divs = []; for (let i = 2; i < n; i++) if (n % i === 0) divs.push(i);
  if (r === 2) { const cnt = divs.length + 2; return { q: `${n}의 약수는 모두 몇 개인가요?`, a: `${cnt}개`, w: Us([cnt - 1, cnt + 1, cnt - 2, cnt + 2], '개'), e: `1, ${divs.join(', ')}, ${n}`, k: { k: 'ndiv', n } }; }
  const non = R.pick([...Array(n - 2).keys()].map((i) => i + 2).filter((i) => n % i !== 0));
  return { q: `${n}의 약수가 아닌 것은?`, a: non, w: R.sample(divs, 3), e: `${n} ÷ ${non}은(는) 나누어떨어지지 않아요.`.replace('은(는)', bat(String(non)) ? '은' : '는'), k: { k: 'pick', p: 'notdiv', n } };
});
const REL_ITEMS = [['의자', '다리', 4], ['세발자전거', '바퀴', 3], ['오리', '다리', 2], ['문어', '다리', 8], ['자동차', '바퀴', 4], ['삼각형', '꼭짓점', 3], ['오각형', '변', 5]];
T('e5-1', 2, '[6수02-01]', (R) => {
  const mul = R.chance(0.5), k = R.int(2, 9), xs = R.distinct(3, 1, 9).sort((a, b) => a - b);
  const f = (x) => (mul ? x * k : x + k);
  const pairs = xs.map((x) => [x, f(x)]);
  const good = mul ? `△ = □ × ${k}` : `△ = □ + ${k}`;
  const w = mul ? [`△ = □ + ${k}`, `□ = △ × ${k}`, `△ = □ + ${f(xs[0]) - xs[0]}`, `△ = □ × ${k + 1}`] : [`△ = □ × ${k}`, `□ = △ + ${k}`, `△ = □ − ${k}`, `△ = □ + ${k + 1}`];
  return { q: `□가 ${xs.join(', ')}일 때 △가 ${pairs.map((p) => p[1]).join(', ')}예요. 알맞은 식은?`.replace(/(\d+)예요/, (m, d) => ida(d)), a: good, w: R.shuffle(w), e: mul ? `△는 항상 □의 ${k}배예요.` : `△는 항상 □보다 ${k} 커요.`, k: { k: 'rel', pairs } };
});
T('e5-1', 2, '[6수02-01]', (R) => {
  const [it, part, k] = R.pick(REL_ITEMS), n = R.int(5, 30);
  if (R.chance(0.6)) return { q: `${it} 1개에 ${part} ${k}개. ${it} ${n}개의 ${eun(part)} 몇 개?`, a: `${n * k}개`, w: Us([n + k, n * (k + 1), n * k + k, n * (k - 1)].filter((v) => v !== n * k), '개'), e: `${part} 수 = ${it} 수 × ${k} = ${n * k}`, k: fx('n*k', { n, k }, '개') };
  return { q: `${it} 1개에 ${part} ${k}개. ${eun(part)} ${n * k}개이면 ${eun(it)} 몇 개?`, a: `${n}개`, w: Us([n * k - k, n + 1, n * k + k, n - 1].filter((v) => v !== n && v > 0), '개'), e: `${it} 수 = ${part} 수 ÷ ${k} = ${n}`, k: fx('m/k', { m: n * k, k }, '개') };
});
T('e5-1', 2, '[6수02-01]', (R) => {
  const k = R.int(2, 9), r = R.int(1, 2);
  if (r === 1) {
    const ages = R.distinct(3, 3, 12);
    return { q: `형은 동생보다 ${k}살 많아요. 동생을 □살, 형을 △살이라 할 때 알맞은 식은?`, a: `△ = □ + ${k}`, w: R.shuffle([`△ = □ × ${k}`, `□ = △ + ${k}`, `△ = □ − ${k}`]), e: `형의 나이는 동생 나이에 ${eul(String(k))} 더한 값이에요.`, k: { k: 'rel', pairs: ages.map((x) => [x, x + k]) } };
  }
  const x = R.int(2, 20);
  return { q: `△ = □ × ${k}에서 □가 ${x}일 때 △는?`, a: x * k, w: R.shuffle([x + k, x * (k + 1), x * k - 1, x * k + k]), e: `${x} × ${k} = ${x * k}`, k: fx('x*k', { x, k }) };
});
T('e5-1', 3, '[6수01-06]', (R) => {
  const d0 = R.int(2, 9), n0 = R.int(1, d0 - 1), [n, d] = Q(n0, d0), m = R.int(2, 6), N = n * m, Dd = d * m;
  if (d === 1) return null;
  return { q: `${FR(N, Dd)}을(를) 기약분수로 나타내면?`.replace('을(를)', bat(String(N)) ? '을' : '를'), a: FR(n, d), w: R.shuffle([FR(d, n), FR(N / m, Dd), FR(n, Dd / m + 1), FR(n + 1, d)].filter((s) => /분의/.test(s) && !/^1분의|분의 0$/.test(s))), e: `분모와 분자를 최대공약수 ${m}(으)로 나누면 ${ida(FR(n, d))}`.replace('(으)로', ro(String(m)).slice(String(m).length)), k: fx('N/D', { N, D: Dd }), raw: true };
});
T('e5-1', 3, '[6수01-06]', (R) => {
  const [a, c] = R.sample([2, 3, 4, 5, 6, 8, 9, 10, 12], 2), b = R.int(1, a - 1), d = R.int(1, c - 1);
  if (gcd(a, c) === 1 && R.chance(0.6)) return null;
  const L = lcm(a, c), P = a * c;
  const pair = (x, y, dd) => `${FR(x, dd)}, ${FR(y, dd)}`;
  const good = pair((b * L) / a, (d * L) / c, L);
  const w = [pair(b, d, L), pair(b + L / a, d + L / c, L), P !== L ? pair(b * c, d * a, P) : pair((b * L) / a + 1, (d * L) / c, L), pair((b * L) / a, (d * L) / c + 1, L)];
  return { q: `${wa(FR(b, a))} ${eul(FR(d, c))} 분모의 최소공배수로 통분하면?`, a: good, w: R.shuffle(w), e: `분모 ${wa(String(a))} ${c}의 최소공배수 ${ro(String(L))} 통분해요.`, k: { k: 'tongbun', b, a, d, c } };
});
T('e5-1', 3, '[6수01-07]', (R) => {
  const vals = [];
  for (let g = 0; vals.length < 4 && g < 50; g++) { const d = R.int(2, 12), n = R.int(1, d - 1); if (gcd(n, d) === 1 && !vals.some((v) => v[0] * d === n * v[1])) vals.push([n, d]); }
  if (vals.length < 4) return null;
  const big = R.chance(0.5);
  const sorted = vals.slice().sort((p, q2) => p[0] * q2[1] - q2[0] * p[1]);
  const ans = big ? sorted[3] : sorted[0];
  return { q: `다음 중 가장 ${big ? '큰' : '작은'} 분수는?`, a: FR(ans[0], ans[1]), w: vals.filter((v) => v !== ans).map((v) => FR(v[0], v[1])), e: '통분하여 분자의 크기를 비교해요.', k: { k: big ? 'max' : 'min' } };
});
T('e5-1', 3, '[6수01-06]', (R) => {
  const d = R.int(2, 9), n = R.int(1, d - 1), m = R.int(2, 5);
  if (gcd(n, d) !== 1) return null;
  return { q: `${FR(n, d)}과(와) 크기가 같은 분수는?`.replace('과(와)', bat(String(n)) ? '과' : '와'), a: FR(n * m, d * m), w: R.shuffle([FR(n + m, d + m), FR(n * m, d + m), FR(n * m + 1, d * m), FR(n * m, d * m + m)].filter((s) => canon(s) !== canon(FR(n, d)))), e: `분모와 분자에 같은 수 ${eul(String(m))} 곱했어요.`, k: fx('n/d', { n, d }) };
});
T('e5-1', 4, '[6수01-08]', (R) => {
  const [a, c] = R.sample([2, 3, 4, 5, 6, 8, 9, 10, 12], 2), b = R.int(1, a - 1), d = R.int(1, c - 1), add = R.chance(0.55);
  const L = lcm(a, c), x = (b * L) / a, y = (d * L) / c;
  if (add) return { q: `${FR(b, a)} + ${FR(d, c)} = ?`, a: FM(x + y, L), w: R.shuffle([FM(b + d, a + c), FM(b + d, L), FM(x + y + 1, L), FM(Math.abs(x - y) || 1, L)]), e: `${FR(x, L)} + ${FR(y, L)} = ${FR(x + y, L)}` + (gcd(x + y, L) > 1 || x + y >= L ? ` = ${FM(x + y, L)}` : ''), k: { k: 'qx' } };
  if (x === y) return null;
  const [p, q2, P, Qd] = x > y ? [b, a, d, c] : [d, c, b, a], X = Math.max(x, y), Y = Math.min(x, y);
  return { q: `${FR(p, q2)} − ${FR(P, Qd)} = ?`, a: FM(X - Y, L), w: R.shuffle([FM(Math.abs(p - P) || 1, Math.abs(q2 - Qd) || 1), FM(X + Y, L), FM(X - Y + 1, L), FM(Math.abs(p - P) || 1, L)]), e: `${FR(X, L)} − ${FR(Y, L)} = ${FR(X - Y, L)}` + (gcd(X - Y, L) > 1 ? ` = ${FM(X - Y, L)}` : ''), k: { k: 'qx' } };
});
T('e5-1', 4, '[6수01-08]', (R) => {
  const [a, c] = R.sample([2, 3, 4, 5, 6, 8, 10, 12], 2), b = R.int(1, a - 1), d = R.int(1, c - 1), w1 = R.int(1, 4), w2 = R.int(1, 3);
  const L = lcm(a, c), x = (b * L) / a, y = (d * L) / c;
  if (R.chance(0.55)) { const s = (w1 + w2) * L + x + y; return { q: `${MR(w1 * a + b, a)} + ${MR(w2 * c + d, c)} = ?`, a: FM(s, L), w: R.shuffle([FM(s - L, L), FM(s + L, L), FM((w1 + w2) * (a + c) + b + d, a + c), FM(s + 1, L)]), e: `자연수끼리 ${w1 + w2}, 분수끼리 ${FR(x, L)} + ${FR(y, L)}`, k: { k: 'qx' } }; }
  const W = w1 + w2, s = W * L + x - (w2 * L + y);
  if (s <= 0) return null;
  return { q: `${MR(W * a + b, a)} − ${MR(w2 * c + d, c)} = ?`, a: FM(s, L), w: R.shuffle([FM(s + L, L), FM(w1 * L + Math.abs(x - y), L) === FM(s, L) ? FM(s + 2, L) : FM(w1 * L + Math.abs(x - y), L), FM(s + 1, L), FM(s > L ? s - L : s + 2 * L, L)]), e: x < y ? '통분한 뒤 자연수에서 1을 받아내려 빼요.' : '통분한 뒤 자연수끼리, 분수끼리 빼요.', k: { k: 'qx' } };
});
T('e5-1', 5, '[6수03-13]', (R) => {
  const r = R.int(1, 4), a = R.int(3, 20), b = R.int(2, 15);
  if (r === 1) { if (a === b) return null; return { q: `가로 ${a} cm, 세로 ${b} cm인 직사각형의 둘레는?`, a: `${2 * (a + b)} cm`, w: Us([a + b, a * b, 2 * a + b, 4 * a].filter((v) => v !== 2 * (a + b)), 'cm'), e: `(${a} + ${b}) × 2 = ${2 * (a + b)} cm`, k: fx('2*(a+b)', { a, b }, 'cm'), std: '[6수03-11]' }; }
  if (r === 2) { if (a === b) return null; return { q: `가로 ${a} cm, 세로 ${b} cm인 직사각형의 넓이는?`, a: `${a * b} cm²`, w: Us([2 * (a + b), a + b, a * b + a, (a * b) / 2].filter((v) => Number.isInteger(v) && v !== a * b), 'cm²'), e: `${a} × ${b} = ${a * b} cm²`, k: fx('a*b', { a, b }, 'cm²') }; }
  if (r === 3) return { q: `한 변이 ${a} cm인 정사각형의 넓이는?`, a: `${a * a} cm²`, w: Us([4 * a, 2 * a, a * a + a, a * (a + 1) + 1].filter((v) => v !== a * a), 'cm²'), e: `${a} × ${a} = ${a * a} cm²`, k: fx('a*a', { a }, 'cm²') };
  const A = a * b;
  return { q: `넓이가 ${A} cm²이고 가로가 ${a} cm인 직사각형의 세로는?`, a: `${b} cm`, w: Us([A - a, b + 1, b * 2, A / 2].filter((v) => v !== b && Number.isInteger(v) && v > 0), 'cm'), e: `${A} ÷ ${a} = ${b} cm`, k: fx('A/a', { A, a }, 'cm') };
});
T('e5-1', 5, '[6수03-14]', (R) => {
  const r = R.int(1, 4), b = R.int(3, 20), h = R.int(2, 15);
  if (r === 1) return { q: `밑변 ${b} cm, 높이 ${h} cm인 평행사변형의 넓이는?`, a: `${b * h} cm²`, w: Us([(b * h) / 2, 2 * (b + h), b + h, b * h + b].filter((v) => Number.isInteger(v) && v !== b * h), 'cm²'), e: `밑변 × 높이 = ${b} × ${h} = ${b * h} cm²`, k: fx('b*h', { b, h }, 'cm²') };
  if (r === 2) { if ((b * h) % 2) return null; return { q: `밑변 ${b} cm, 높이 ${h} cm인 삼각형의 넓이는?`, a: `${(b * h) / 2} cm²`, w: Us([b * h, b + h, (b * h) / 2 + b, 2 * b * h].filter((v) => v !== (b * h) / 2), 'cm²'), e: `${b} × ${h} ÷ 2 = ${(b * h) / 2} cm²`, k: fx('b*h/2', { b, h }, 'cm²') }; }
  if (r === 3) { if ((b * h) % 2) return null; return { q: `두 대각선이 ${b} cm, ${h} cm인 마름모의 넓이는?`, a: `${(b * h) / 2} cm²`, w: Us([b * h, 2 * (b + h), (b * h) / 4, b + h].filter((v) => Number.isInteger(v) && v !== (b * h) / 2), 'cm²'), e: `${b} × ${h} ÷ 2 = ${(b * h) / 2} cm²`, k: fx('b*h/2', { b, h }, 'cm²') }; }
  const t = R.int(2, b), s = b + t;
  if ((s * h) % 2 || t === b) return null;
  return { q: `윗변 ${t} cm, 아랫변 ${b} cm, 높이 ${h} cm인 사다리꼴의 넓이는?`, a: `${(s * h) / 2} cm²`, w: Us([s * h, t * b * h / 2, (b * h) / 2, (s * h) / 2 + h].filter((v) => Number.isInteger(v) && v !== (s * h) / 2), 'cm²'), e: `(${t} + ${b}) × ${h} ÷ 2 = ${(s * h) / 2} cm²`, k: fx('(t+b)*h/2', { t, b, h }, 'cm²') };
});
T('e5-1', 5, '[6수03-12]', (R) => {
  if (R.chance(0.5)) { const a = R.int(2, 9); return { q: `${a} m²는 몇 cm²인가요?`, a: `${a * 10000} cm²`, w: Us([a * 100, a * 1000, a * 100000, a * 10000 + 10000], 'cm²'), e: `1 m² = 10000 cm²예요.`, k: fx('a*10000', { a }, 'cm²') }; }
  const n = R.int(3, 10), a = R.int(2, 15);
  return { q: `한 변이 ${a} cm인 정${POLY[n]}의 둘레는?`, a: `${n * a} cm`, w: Us([(n - 1) * a, (n + 1) * a, a * a, n + a].filter((v) => v !== n * a), 'cm'), e: `${a} × ${n} = ${n * a} cm`, k: fx('n*a', { n, a }, 'cm'), std: '[6수03-11]' };
});

// =====================================================================
// 5학년 2학기
// =====================================================================
const RANGE_W = { 이상: (x, a) => x >= a, 초과: (x, a) => x > a, 이하: (x, b) => x <= b, 미만: (x, b) => x < b };
T('e5-2', 0, '[6수01-02]', (R) => {
  const a = R.int(5, 40), b = a + R.int(3, 9), lo = R.pick(['이상', '초과']), hi = R.pick(['이하', '미만']);
  let c = 0; for (let x = a; x <= b; x++) if (RANGE_W[lo](x, a) && RANGE_W[hi](x, b)) c++;
  return { q: `${a} ${lo} ${b} ${hi}인 자연수는 몇 개인가요?`, a: `${c}개`, w: Us([c + 1, c - 1, c + 2, b - a + 1, b - a].filter((v) => v !== c && v > 0), '개'), e: `${lo === '이상' ? `${a} 포함` : `${a} 미포함`}, ${hi === '이하' ? `${b} 포함` : `${b} 미포함`}`, k: { k: 'range', a, lo, b, hi } };
});
T('e5-2', 0, '[6수01-02]', (R) => {
  const a = R.int(10, 50), b = a + R.int(4, 10), lo = R.pick(['이상', '초과']), hi = R.pick(['이하', '미만']);
  const inR = (x) => RANGE_W[lo](x, a) && RANGE_W[hi](x, b);
  const cand = [a, b, a - 1, b + 1, R.int(a + 1, b - 1), a - R.int(2, 5), b + R.int(2, 5)];
  const good = cand.filter(inR), bad = [...new Set(cand.filter((x) => !inR(x)))];
  if (!good.length || bad.length < 3) return null;
  return { q: `다음 중 ${a} ${lo} ${b} ${hi}인 수는?`, a: R.pick(good), w: R.sample(bad, 3), e: `${lo}·${hi}${hi.endsWith('만') ? '은' : '는'} 경계의 수를 포함하는지 살펴봐요.`, k: { k: 'pick', p: 'range', a, lo, b, hi } };
});
const PLACE = { 10: '십', 100: '백', 1000: '천' };
T('e5-2', 0, '[6수01-03]', (R) => {
  const P = R.pick([10, 100, 1000]), n = R.int(P * 2, P * 99 > 99999 ? 99999 : P * 99);
  if (n % P === 0) return null;
  const mode = R.pick(['올림', '버림', '반올림']);
  const f = { 올림: Math.ceil(n / P) * P, 버림: Math.floor(n / P) * P, 반올림: Math.floor(n / P + 0.5) * P };
  const P2 = P === 1000 ? 100 : P * 10;
  const alt = { 올림: Math.ceil(n / P2) * P2, 버림: Math.floor(n / P2) * P2, 반올림: Math.floor(n / P2 + 0.5) * P2 };
  return { q: `${eul(String(n))} ${mode}하여 ${PLACE[P]}의 자리까지 나타내면?`, a: f[mode], w: R.shuffle([...Object.values(f), alt[mode], f[mode] + P, f[mode] - P].filter((v) => v !== f[mode] && v > 0)), e: mode === '올림' ? `${PLACE[P]}의 자리 아래를 올려 ${f[mode]}` : mode === '버림' ? `${PLACE[P]}의 자리 아래를 버려 ${f[mode]}` : `바로 아래 자리가 ${Math.floor(n / (P / 10)) % 10}이라 ${f[mode]}`, k: { k: 'round', n, mode, P } };
});
T('e5-2', 0, '[6수01-03]', (R) => {
  const n = R.int(21, 399), c = n >= 150 && R.chance(0.4) ? 100 : 10;
  if (n % c === 0) return null;
  if (R.chance(0.5)) return { q: `귤 ${n}개를 한 상자에 ${c}개씩 담아 팔아요. 팔 수 있는 상자는 최대 몇 상자?`, a: `${Math.floor(n / c)}상자`, w: Us([Math.ceil(n / c), Math.floor(n / c) - 1, Math.round(n / c) === Math.floor(n / c) ? Math.ceil(n / c) + 1 : Math.round(n / c) + 1, n % c], '상자'), e: `남는 귤은 팔 수 없으니 버림: ${Math.floor(n / c)}상자`, k: fx('floor(n/c)', { n, c }, '상자') };
  return { q: `학생 ${n}명이 한 대에 ${c}명씩 타는 버스를 타요. 버스는 적어도 몇 대 필요해요?`, a: `${Math.ceil(n / c)}대`, w: Us([Math.floor(n / c), Math.ceil(n / c) + 1, Math.floor(n / c) - 1 > 0 ? Math.floor(n / c) - 1 : Math.ceil(n / c) + 2, n % c], '대'), e: `남는 학생도 타야 하니 올림: ${Math.ceil(n / c)}대`, k: fx('ceil(n/c)', { n, c }, '대') };
});
T('e5-2', 1, '[6수01-09]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const d = R.int(2, 12), n = R.int(1, d - 1), m = R.int(2, 9); return { q: `${FR(n, d)} × ${m} = ?`, a: FM(n * m, d), w: R.shuffle([FM(n, d * m), FM(n * m, d * m), FM(n + m, d), FM(n * m + 1, d)]), e: `분자에 곱해 ${FR(n * m, d)}` + (gcd(n * m, d) > 1 || n * m >= d ? ` = ${FM(n * m, d)}` : ''), k: { k: 'qx' } }; }
  if (r === 2) { const d = R.int(2, 9), n = R.int(1, d - 1), m = d * R.int(1, 5) + (R.chance(0.5) ? 0 : R.int(1, d - 1)); return { q: `${m} × ${FR(n, d)} = ?`, a: FM(m * n, d), w: R.shuffle([FM(n, m * d), FM(m * d, n), FM(m * n + 1, d), FM(m + n, d)]), e: `${m} × ${n} = ${m * n}, ${FR(m * n, d)}` + (gcd(m * n, d) > 1 || m * n >= d ? ` = ${FM(m * n, d)}` : ''), k: { k: 'qx' } }; }
  if (r === 3) { const b = R.int(2, 9), a = R.int(1, b - 1), d = R.int(2, 9), c = R.int(1, d - 1); return { q: `${FR(a, b)} × ${FR(c, d)} = ?`, a: FM(a * c, b * d), w: R.shuffle([FM(a + c, b + d), FM(a * d, b * c), FM(a * c, b + d), FM(a * c + 1, b * d)]), e: `분자끼리, 분모끼리 곱해 ${FR(a * c, b * d)}` + (gcd(a * c, b * d) > 1 ? ` = ${FM(a * c, b * d)}` : ''), k: { k: 'qx' } }; }
  const b = R.int(2, 6), a = R.int(1, b - 1), d = R.int(2, 6), c = R.int(1, d - 1), w1 = R.int(1, 3), w2 = R.int(1, 2);
  const N = (w1 * b + a) * (w2 * d + c), Dd = b * d;
  return { q: `${MR(w1 * b + a, b)} × ${MR(w2 * d + c, d)} = ?`, a: FM(N, Dd), w: R.shuffle([FM(w1 * w2 * Dd + a * c, Dd), FM(N + Dd, Dd), FM(N - 1, Dd), FM(w1 * w2 * Dd + a * c + Dd, Dd)]), e: `가분수로 바꾸어 ${FR(w1 * b + a, b)} × ${FR(w2 * d + c, d)}`, k: { k: 'qx' } };
});
T('e5-2', 1, '[6수01-09]', (R) => {
  const d = R.int(2, 8), n = R.int(1, d - 1), a = d * R.int(2, 12);
  return { q: `${a} m의 ${eun(FR(n, d))} 몇 m인가요?`, a: `${(a / d) * n} m`, w: Us([a / d, a * n, a - (a / d) * n === (a / d) * n ? a : a - (a / d) * n, (a / d) * n + n].filter((v) => v !== (a / d) * n && v > 0), 'm'), e: `${a} × ${FR(n, d)} = ${(a / d) * n}`, k: fx('a*n/d', { a, n, d }, 'm') };
});
const TRI = ['ㄱㄴ', 'ㄴㄷ', 'ㄷㄱ'], TRI2 = ['ㄹㅁ', 'ㅁㅂ', 'ㅂㄹ'];
T('e5-2', 2, '[6수03-01]', (R) => {
  const s = R.distinct(3, 3, 15), i = R.int(0, 2);
  if (R.chance(0.65)) return { q: `삼각형 ㄱㄴㄷ과 삼각형 ㄹㅁㅂ은 서로 합동이에요. 변 ㄱㄴ ${s[0]} cm, 변 ㄴㄷ ${s[1]} cm, 변 ㄷㄱ ${s[2]} cm일 때 변 ${eun(TRI2[i])}?`, a: `${s[i]} cm`, w: Us(s.filter((_, j) => j !== i).concat([s[0] + s[1] + s[2], s[i] + 1]), 'cm'), e: `변 ${TRI2[i]}의 대응변은 변 ${ida(TRI[i])}`, k: { k: 'cong', s, i } };
  const P = s[0] + s[1] + s[2];
  return { q: `세 변이 ${s.join(' cm, ')} cm인 삼각형과 합동인 삼각형의 둘레는?`, a: `${P} cm`, w: Us([P * 2, P - s[0], P + 1, s[0] * s[1]].filter((v) => v !== P), 'cm'), e: `합동이면 대응변의 길이가 같아 둘레도 ${P} cm`, k: fx('a+b+c', { a: s[0], b: s[1], c: s[2] }, 'cm') };
});
T('e5-2', 2, '[6수03-02]', (R) => {
  const a = R.int(2, 15);
  if (R.chance(0.5)) return { q: `선대칭도형에서 대응점끼리 이은 선분이 ${2 * a} cm일 때, 대칭축에서 한 점까지의 거리는?`, a: `${a} cm`, w: Us([2 * a, 4 * a, a + 1, a - 1].filter((v) => v !== a && v > 0), 'cm'), e: `대칭축이 선분을 똑같이 둘로 나눠요: ${2 * a} ÷ 2 = ${a}`, k: fx('L/2', { L: 2 * a }, 'cm') };
  return { q: `점대칭도형에서 대칭의 중심부터 한 점까지가 ${a} cm일 때, 그 점과 대응점 사이의 거리는?`, a: `${2 * a} cm`, w: Us([a, a / 2, 3 * a, 2 * a + 1].filter((v) => v !== 2 * a && Number.isInteger(v)), 'cm'), e: `대칭의 중심이 가운데라 ${a} × 2 = ${2 * a}`, k: fx('2*a', { a }, 'cm') };
});
F('e5-2', 2, '[6수03-02]', [
  ['합동인 두 도형을 포개었을 때 완전히 겹치는 변은?', '대응변', ['대칭축', '대각선', '밑변'], '완전히 겹치는 변을 대응변이라 해요.', '[6수03-01]'],
  ['합동인 두 도형에서 대응각의 크기는?', '서로 같아요', ['합이 180°예요', '항상 직각이에요', '알 수 없어요'], '합동이면 대응각의 크기가 같아요.', '[6수03-01]'],
  ['선대칭도형을 대칭축으로 접으면?', '완전히 겹쳐요', ['겹치지 않아요', '크기가 반이 돼요', '넓이가 2배가 돼요'], '대칭축으로 접으면 양쪽이 완전히 겹쳐요.'],
  ['점대칭도형은 대칭의 중심으로 몇 도 돌리면 처음과 겹치나요?', '180°', ['90°', '45°', '120°'], '점대칭도형은 180° 돌리면 처음과 겹쳐요.'],
  ['정사각형의 대칭축은 몇 개인가요?', '4개', ['2개', '1개', '8개'], '가로, 세로, 두 대각선 방향으로 4개예요.'],
  ['정삼각형의 대칭축은 몇 개인가요?', '3개', ['1개', '6개', '0개'], '각 꼭짓점에서 마주 보는 변의 가운데로 3개예요.'],
  ['원의 대칭축은 몇 개인가요?', '셀 수 없이 많아요', ['1개', '2개', '4개'], '중심을 지나는 모든 직선이 대칭축이에요.'],
]);
T('e5-2', 3, '[6수01-13]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const A = R.int(2, 99), p = R.int(1, 2), m = R.int(2, 9), x = A / 10 ** p, s = x * m; if (A % 10 === 0) return null; return { q: `${D(x)} × ${m} = ?`, a: D(s), w: R.shuffle([D(s * 10), D(s / 10), D(s + 1), D(x + m)].filter((v) => v !== D(s))), e: `${A} × ${m} = ${A * m}에서 소수 ${p}자리라 ${D(s)}`.replace('1자리', '한 자리').replace('2자리', '두 자리'), k: { k: 'qx' } }; }
  if (r === 2) { const A = R.int(11, 59), B = R.int(11, 59), x = A / 10, y = B / 10, s = (A * B) / 100; if (A % 10 === 0 || B % 10 === 0) return null; return { q: `${D(x)} × ${D(y)} = ?`, a: D(s), w: R.shuffle([D(s * 10), D(s / 10), D(x + y), D(s + 0.1)].filter((v) => v !== D(s))), e: `${A} × ${B} = ${A * B}에서 소수 두 자리라 ${D(s)}`, k: { k: 'qx' } }; }
  if (r === 3) { const A = R.int(2, 9), B = R.int(2, 9), x = A / 10, y = B / 10, s = (A * B) / 100; return { q: `${D(x)} × ${D(y)} = ?`, a: D(s), w: R.shuffle([D(s * 10), D(s / 10), D(x + y), String(A * B)].filter((v) => v !== D(s))), e: `${A} × ${B} = ${A * B}에서 소수 두 자리라 ${D(s)}`, k: { k: 'qx' } }; }
  const x = R.int(101, 9999) / 1000, m = R.pick([10, 100, 1000]);
  return { q: `${D(x)} × ${m} = ?`, a: D(x * m), w: R.shuffle([D(x * m * 10), D((x * m) / 10), D(x * m * 100), D(x + m)].filter((v) => v !== D(x * m))), e: `${m}을 곱하면 소수점이 오른쪽으로 ${String(m).length - 1}칸 옮겨져요.`, k: { k: 'qx' } };
});
T('e5-2', 3, '[6수01-13]', (R) => {
  const p = R.int(11, 99) / 10, n = R.int(2, 9);
  if ((p * 10) % 10 === 0) return null;
  return { q: `한 개에 ${D(p)} kg인 상자 ${n}개의 무게는 모두 몇 kg?`, a: `${D(p * n)} kg`, w: Us([p * n * 10, (p * n) / 10, p + n, p * n + 1].map((v) => Math.round(v * 1e6) / 1e6), 'kg'), e: `${D(p)} × ${n} = ${D(p * n)}`, k: fx('p*n', { p, n }, 'kg') };
});
const CUBOID = { 면: 6, 모서리: 12, 꼭짓점: 8 };
T('e5-2', 4, '[6수03-03]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const sh = R.pick(['직육면체', '정육면체']), what = R.pick(Object.keys(CUBOID)); return { q: `${sh}의 ${eun(what)} 몇 개인가요?`, a: `${CUBOID[what]}개`, w: Us([6, 12, 8, 4, 24].filter((v) => v !== CUBOID[what]), '개'), e: '면 6개, 모서리 12개, 꼭짓점 8개예요.', k: { k: 'cuboid', what } }; }
  if (r === 2) { const a = R.int(2, 15); return { q: `한 모서리가 ${a} cm인 정육면체의 모든 모서리 길이의 합은?`, a: `${12 * a} cm`, w: Us([6 * a, 8 * a, 4 * a, a * a * a].filter((v) => v !== 12 * a), 'cm'), e: `모서리 12개: ${a} × 12 = ${12 * a} cm`, k: fx('12*a', { a }, 'cm') }; }
  const a = R.int(3, 12), b = R.int(2, 10), c = R.int(2, 10);
  if (a === b && b === c) return null;
  return { q: `가로 ${a} cm, 세로 ${b} cm, 높이 ${c} cm인 직육면체의 모든 모서리 길이의 합은?`, a: `${4 * (a + b + c)} cm`, w: Us([a + b + c, 2 * (a + b + c), 12 * a, a * b * c].filter((v) => v !== 4 * (a + b + c)), 'cm'), e: `같은 길이가 4개씩: (${a} + ${b} + ${c}) × 4 = ${4 * (a + b + c)}`, k: fx('4*(a+b+c)', { a, b, c }, 'cm') };
});
F('e5-2', 4, '[6수03-03]', [
  ['직육면체에서 서로 평행한 면은 몇 쌍인가요?', '3쌍', ['2쌍', '4쌍', '6쌍'], '마주 보는 면 3쌍이 서로 평행해요.'],
  ['직육면체의 겨냥도에서 보이지 않는 모서리는 몇 개인가요?', '3개', ['2개', '4개', '6개'], '보이지 않는 모서리는 점선 3개로 그려요.'],
  ['직육면체의 겨냥도에서 보이는 면은 몇 개인가요?', '3개', ['2개', '4개', '6개'], '앞, 위, 옆 3개의 면이 보여요.'],
  ['직육면체의 한 면과 수직인 면은 몇 개인가요?', '4개', ['2개', '3개', '5개'], '마주 보는 면을 빼고 이웃한 4개 면이 수직이에요.'],
  ['정육면체의 면은 어떤 모양인가요?', '정사각형', ['직사각형', '정삼각형', '마름모'], '정육면체는 정사각형 6개로 둘러싸여 있어요.'],
  ['직육면체의 전개도에서 면은 몇 개인가요?', '6개', ['4개', '8개', '12개'], '전개도도 면 6개로 이루어져요.'],
]);
T('e5-2', 5, '[6수04-01]', (R) => {
  const n = R.int(3, 5), m = R.int(5, 30) * (R.chance(0.5) ? 1 : 2);
  const xs = Array.from({ length: n }, () => 0);
  let sum = m * n;
  for (let i = 0; i < n - 1; i++) { xs[i] = m + R.int(-4, 4); sum -= xs[i]; }
  xs[n - 1] = sum;
  if (xs.some((x) => x <= 0)) return null;
  const tot = m * n;
  if (R.chance(0.6)) return { q: `${xs.join(', ')}의 평균은?`, a: m, w: R.shuffle([tot, m + 1, m - 1, Math.round(tot / (n + 1)) === m ? m + 2 : Math.round(tot / (n + 1))].filter((v) => v !== m && v > 0)), e: `(${xs.join(' + ')}) ÷ ${n} = ${tot} ÷ ${n} = ${m}`, k: fx('(' + xs.join('+') + `)/${n}`, {}) };
  const known = xs.slice(0, n - 1);
  return { q: `${n}번 기록의 평균이 ${m}이에요. 앞 기록이 ${known.join(', ')}이면 마지막 기록은?`.replace(`${m}이에요`, ida(String(m))).replace(/(\d+)이면/, (x, d) => d + (bat(d) ? '이면' : '이면')), a: xs[n - 1], w: R.shuffle([m, tot, xs[n - 1] + 1, xs[n - 1] - 1, tot - known[0]].filter((v) => v !== xs[n - 1] && v > 0)), e: `합 ${m} × ${n} = ${tot}에서 앞 기록의 합을 빼요.`, k: fx(`m*n-(${known.join('+')})`, { m, n }) };
});
const CHANCE = ['불가능하다', '~아닐 것 같다', '반반이다', '~일 것 같다', '확실하다'];
T('e5-2', 5, '[6수04-04]', (R) => {
  const t = R.int(0, 4);
  let a, b;
  if (t === 0) { a = 0; b = R.int(2, 6); } else if (t === 4) { a = R.int(2, 6); b = 0; } else if (t === 2) { a = b = R.int(1, 5); } else if (t === 1) { a = R.int(1, 2); b = a + R.int(3, 6); } else { b = R.int(1, 2); a = b + R.int(3, 6); }
  const ans = CHANCE[t];
  const bag = a === 0 ? `파란 구슬만 ${b}개` : b === 0 ? `빨간 구슬만 ${a}개` : `빨간 구슬 ${a}개, 파란 구슬 ${b}개가`;
  return { q: `${bag} 든 주머니에서 1개를 꺼낼 때 빨간 구슬일 가능성은?`, a: ans, w: R.sample(CHANCE.filter((s) => s !== ans), 3), e: t === 0 ? '빨간 구슬이 없어 불가능해요.' : t === 4 ? '모두 빨간 구슬이라 확실해요.' : t === 2 ? '빨간 구슬과 파란 구슬 수가 같아요.' : `빨간 구슬이 ${t === 3 ? '훨씬 많아요' : '훨씬 적어요'}.`, k: { k: 'chance', a, b } };
});
T('e5-2', 5, '[6수04-05]', (R) => {
  const t = R.pick([0, 2, 4]);
  const a = t === 0 ? 0 : R.int(1, 5), b = t === 4 ? 0 : t === 2 ? a : R.int(1, 5);
  const ans = t === 0 ? '0' : t === 2 ? '2분의 1' : '1';
  const s = R.pick([['빨간 구슬', '파란 구슬', '빨간 구슬'], ['흰 바둑돌', '검은 바둑돌', '흰 바둑돌']]);
  const bag = a === 0 ? `${s[1]}만 ${b}개` : b === 0 ? `${s[0]}만 ${a}개` : `${s[0]} ${a}개, ${s[1]} ${b}개`;
  return { q: `${bag} 중 1개를 꺼낼 때 ${s[2]}일 가능성을 수로 나타내면?`, a: ans, w: ['0', '2분의 1', '1', '4분의 1'].filter((x) => x !== ans), e: t === 0 ? '불가능하면 0이에요.' : t === 2 ? '반반이면 2분의 1이에요.' : '확실하면 1이에요.', k: { k: 'chance', a, b, num: true } };
});

// =====================================================================
// 6학년 1학기
// =====================================================================
T('e6-1', 0, '[6수01-10]', (R) => {
  const a = R.int(1, 15), b = R.int(2, 9);
  if (a % b === 0) return null;
  return { q: `${a} ÷ ${b}의 몫을 분수로 나타내면?`, a: FM(a, b), w: R.shuffle([FM(b, a), FM(a, b * 2), FM(a + 1, b), FM(a * b, b + 1)].filter((s) => canon(s) !== canon(FM(a, b)))), e: `${a} ÷ ${b} = ${FR(a, b)}` + (gcd(a, b) > 1 || a > b ? ` = ${FM(a, b)}` : ''), k: fx('a/b', { a, b }) };
});
T('e6-1', 0, '[6수01-11]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const m = R.int(2, 6), d = R.int(3, 11), k = R.int(1, Math.floor((d - 1) / m)) , n = k * m; if (n >= d || n === 0) return null; return { q: `${FR(n, d)} ÷ ${m} = ?`, a: FM(k, d), w: R.shuffle([FM(n * m, d), FM(n, d * m) === FM(k, d) ? FM(k + 1, d) : FM(n * m, d * m), FM(d, k), FM(k, d * m)]), e: `분자 ${eul(String(n))} ${ro(String(m))} 나누어 ${ida(FR(k, d))}`, k: { k: 'qx' } }; }
  if (r === 2) { const m = R.int(2, 7), d = R.int(2, 9), n = R.int(1, d - 1); if (n % m === 0) return null; return { q: `${FR(n, d)} ÷ ${m} = ?`, a: FM(n, d * m), w: R.shuffle([FM(n * m, d), FM(n, d + m), FM(d * m, n), FM(n + 1, d * m)]), e: `× ${ro(FR(1, m))} 바꾸어 ${FR(n, d * m)}` + (gcd(n, d * m) > 1 ? ` = ${FM(n, d * m)}` : ''), k: { k: 'qx' } }; }
  const d = R.int(2, 6), w = R.int(1, 3), n = R.int(1, d - 1), m = R.int(2, 6), N = w * d + n;
  return { q: `${MR(N, d)} ÷ ${m} = ?`, a: FM(N, d * m), w: R.shuffle([MR(w * d * m + n, d * m) === FM(N, d * m) ? FM(N * m, d) : MR(w * d * m + n, d * m), FM(N * m, d), FM(N + 1, d * m), FM(w * d + n * m, d * m)]), e: `가분수 ${ro(FR(N, d))} 바꾸어 ${ro(String(m))} 나눠요.`, k: { k: 'qx' } };
});
const PRISM = ['', '', '', '삼각', '사각', '오각', '육각', '칠각', '팔각', '구각', '십각'];
const P3 = { 기둥: { 면: (n) => n + 2, 모서리: (n) => 3 * n, 꼭짓점: (n) => 2 * n }, 뿔: { 면: (n) => n + 1, 모서리: (n) => 2 * n, 꼭짓점: (n) => n + 1 } };
T('e6-1', 1, '[6수03-05]', (R) => {
  const ty = R.pick(['기둥', '뿔']), n = R.int(3, 10), what = R.pick(['면', '모서리', '꼭짓점']), v = P3[ty][what](n);
  const others = ['면', '모서리', '꼭짓점'].filter((x) => x !== what).map((x) => P3[ty][x](n));
  return { q: `${PRISM[n]}${ty}의 ${eun(what)} 몇 개인가요?`, a: `${v}개`, w: Us([...others, P3[ty === '기둥' ? '뿔' : '기둥'][what](n), v + 1, v - 1].filter((x) => x !== v), '개'), e: `${PRISM[n]}${ty}: 면 ${P3[ty].면(n)}개, 모서리 ${P3[ty].모서리(n)}개, 꼭짓점 ${P3[ty].꼭짓점(n)}개`, k: { k: 'poly3', ty, n, what } };
});
T('e6-1', 1, '[6수03-05]', (R) => {
  const ty = R.pick(['기둥', '뿔']), n = R.int(3, 10), what = R.pick(['면', '모서리', '꼭짓점']), v = P3[ty][what](n);
  const cands = [3, 4, 5, 6, 7, 8, 9, 10].filter((m) => m !== n && P3[ty][what](m) !== v).map((m) => PRISM[m] + ty);
  const swap = P3[ty === '기둥' ? '뿔' : '기둥'][what];
  const other = [3, 4, 5, 6, 7, 8, 9, 10].find((m) => swap(m) === v);
  const w = R.shuffle(cands).slice(0, 3);
  if (other) w.unshift(PRISM[other] + (ty === '기둥' ? '뿔' : '기둥'));
  return { q: `${what}이(가) ${v}개인 각${ty}의 이름은?`.replace(`${what}이(가)`, iga(what)), a: PRISM[n] + ty, w, e: `밑면의 변이 ${n}개인 ${PRISM[n]}${ida(ty)}`, k: { k: 'poly3name', ty, what, v } };
});
F('e6-1', 1, '[6수03-05]', [
  ['각기둥에서 서로 평행하고 합동인 두 면은?', '밑면', ['옆면', '모서리', '꼭짓점'], '각기둥의 두 밑면은 평행하고 합동이에요.'],
  ['각기둥의 옆면은 어떤 모양인가요?', '직사각형', ['삼각형', '원', '오각형'], '각기둥의 옆면은 모두 직사각형이에요.'],
  ['각뿔의 옆면은 어떤 모양인가요?', '삼각형', ['직사각형', '원', '사다리꼴'], '각뿔의 옆면은 모두 삼각형이에요.'],
  ['각뿔에서 옆면이 모두 만나는 점은?', '각뿔의 꼭짓점', ['밑면', '모서리', '높이'], '옆면이 모두 만나는 점을 각뿔의 꼭짓점이라 해요.'],
  ['각뿔의 밑면은 몇 개인가요?', '1개', ['2개', '3개', '0개'], '각뿔은 밑면이 1개예요.'],
  ['각기둥의 밑면은 몇 개인가요?', '2개', ['1개', '3개', '4개'], '각기둥은 밑면이 2개예요.'],
]);
T('e6-1', 2, '[6수01-15]', (R) => {
  const m = R.int(2, 9), p = R.int(1, 2), Q2 = R.int(11, 99) * (p === 2 ? 1 : 1), q = Q2 / 10 ** p, a = q * m;
  if (Q2 % 10 === 0) return null;
  return { q: `${D(a)} ÷ ${m} = ?`, a: D(q), w: R.shuffle([D(q * 10), D(q / 10), D(q + 0.1), D(q + 1)].filter((s) => s !== D(q) && +s > 0)), e: `${Math.round(a * 10 ** p)} ÷ ${m} = ${Q2}에서 소수 ${p === 1 ? '한' : '두'} 자리라 ${D(q)}`, k: { k: 'qx' } };
});
T('e6-1', 2, '[6수01-14]', (R) => {
  const b = R.pick([2, 4, 5, 8, 20, 25]), a = R.int(1, 3 * b);
  if (a % b === 0) return null;
  const v = a / b;
  return { q: `${a} ÷ ${b}의 몫을 소수로 나타내면?`, a: D(v), w: R.shuffle([D(v * 10), D(v / 10), b < 10 ? `${a}.${b}` : D(v + 0.1), D(b / a).length < 7 ? D(b / a) : D(v + 1)].filter((s) => s !== D(v))), e: `${a} ÷ ${b} = ${FR(a, b)} = ${D(v)}`, k: fx('a/b', { a, b }) };
});
T('e6-1', 2, '[6수01-15]', (R) => {
  const m = R.int(2, 8), q = R.int(11, 99) / 10, a = Math.round(q * m * 10) / 10;
  return { q: `${D(a)} L의 물을 ${m}병에 똑같이 나누면 한 병에 몇 L?`, a: `${D(q)} L`, w: Us([q * 10, q / 10, q + 1, a - m].map((v) => Math.round(v * 1e6) / 1e6).filter((v) => v > 0), 'L'), e: `${D(a)} ÷ ${m} = ${D(q)}`, k: fx('a/m', { a, m }, 'L') };
});
T('e6-1', 3, '[6수02-02]', (R) => {
  const a = R.int(2, 15), b = R.int(2, 15);
  if (a === b || a + b === 2 * a) return null;
  if (R.chance(0.4)) { const ask = R.pick(['기준량', '비교하는 양']); const ans = ask === '기준량' ? b : a; return { q: `${a} : ${b}에서 ${eun(ask)}?`, a: ans, w: R.shuffle([ask === '기준량' ? a : b, a + b, Math.abs(a - b), a * b].filter((v) => v !== ans && v > 0)), e: `비 ${a} : ${b}에서 ${ask === '기준량' ? '뒤' : '앞'}의 수가 ${ida(ask)}`, k: { k: 'ratio', a, b, ask } }; }
  const form = R.int(1, 3);
  const q = form === 1 ? `${wa(String(a))} ${b}의 비는?` : form === 2 ? `${b}에 대한 ${a}의 비는?` : `${a}의 ${b}에 대한 비는?`;
  return { q, a: `${a} : ${b}`, w: R.shuffle([`${b} : ${a}`, `${a} : ${a + b}`, `${a + b} : ${b}`]), e: form === 1 ? `앞의 수 ${a}, 뒤의 수 ${b}` : `기준량 ${b}이(가) 뒤에 와요.`.replace('이(가)', bat(String(b)) ? '이' : '가'), k: { k: 'ratiostr' } };
});
T('e6-1', 3, '[6수02-03]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const b = R.pick([2, 4, 5, 8, 10, 20, 25, 50]), a = R.int(1, b - 1); return { q: `${b}에 대한 ${a}의 비율을 소수로 나타내면?`, a: D(a / b), w: R.shuffle([D(b / a).length < 7 ? D(b / a) : D(a / b + 1), D((a / b) * 10), D(a / b / 10), D(a / (a + b)).length < 7 ? D(a / (a + b)) : D(a / b + 0.1)].filter((s) => s !== D(a / b))), e: `비율 = ${a} ÷ ${b} = ${D(a / b)}`, k: fx('a/b', { a, b }) }; }
  if (r === 2) { const p = R.int(1, 99), x = p / 100; return { q: `비율 ${D(x)}를 백분율로 나타내면?`.replace(`${D(x)}를`, eul(D(x))), a: `${p}%`, w: Us([p / 10, p * 10, p / 100, p + 10].map((v) => Math.round(v * 1e6) / 1e6), '%'), e: `${D(x)} × 100 = ${p}%`, k: fx('x*100', { x }, '%'), dec: true }; }
  if (r === 3) { const p = R.int(1, 99); return { q: `${p}%를 소수로 나타내면?`, a: D(p / 100), w: R.shuffle([D(p / 10), D(p / 1000), String(p), D(p / 100 + 1)]), e: `${p} ÷ 100 = ${D(p / 100)}`, k: fx('p/100', { p }) }; }
  const n = R.pick([20, 25, 50, 200, 400, 500]), m = R.int(1, n - 1), pc = (m * 100) / n;
  if (!Number.isInteger(pc)) return null;
  return { q: `${n}명 중 ${m}명이 찬성했어요. 찬성한 사람은 전체의 몇 %?`, a: `${pc}%`, w: Us([m, 100 - pc, pc * 10 <= 1000 ? pc * 10 : pc + 20, pc + 5].filter((v) => v !== pc && v > 0), '%'), e: `${m} ÷ ${n} × 100 = ${pc}%`, k: fx('m/n*100', { m, n }, '%') };
});
T('e6-1', 3, '[6수02-03]', (R) => {
  const P = R.int(2, 30) * 1000, x = R.pick([10, 20, 25, 30, 40, 50]), d = (P * x) / 100;
  if (R.chance(0.5)) return { q: `${P}원인 물건을 ${x}% 할인하면 판매 가격은 몇 원?`, a: `${P - d}원`, w: Us([d, P - x, P - d / 10, P - d * 2 > 0 ? P - d * 2 : P + d], '원'), e: `할인 ${P} × ${x / 100 === 0.25 ? '0.25' : D(x / 100)} = ${d}원, ${P} − ${d}`, k: fx('P*(100-x)/100', { P, x }, '원') };
  const s = R.int(2, 10) * 10, t = R.int(1, 5);
  return { q: `${t}시간 동안 ${s * t} km를 달린 자동차는 1시간에 몇 km를 달린 셈인가요?`, a: `${s} km`, w: Us([s * t, s + t, s * t + t, s / 2], 'km'), e: `${s * t} ÷ ${t} = ${s}`, k: fx('d/t', { d: s * t, t }, 'km') };
});
T('e6-1', 4, '[6수04-02]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const N = R.pick([20, 40, 50, 60, 80, 100, 200, 300, 400]), x = R.pick([5, 10, 15, 20, 25, 30, 35, 40, 45, 50]), v = (N * x) / 100; if (!Number.isInteger(v)) return null; return { q: `${N}명 중 ${x}%가 축구를 좋아해요. 축구를 좋아하는 학생은 몇 명?`, a: `${v}명`, w: Us([x, N - v, v * 2, v + 5].filter((y) => y !== v), '명'), e: `${N} × ${D(x / 100)} = ${v}명`, k: fx('N*x/100', { N, x }, '명') }; }
  if (r === 2) { const p = R.distinct(3, 5, 35, (v) => v % 5 === 0); const rest = 100 - p[0] - p[1] - p[2]; if (rest <= 0) return null; const nm = R.sample(FAV, 4); return { q: `띠그래프에서 ${nm[0]} ${p[0]}%, ${nm[1]} ${p[1]}%, ${nm[2]} ${p[2]}%이고 나머지는 ${ida(nm[3])}. ${eun(nm[3])} 몇 %?`, a: `${rest}%`, w: Us([rest + 5, rest - 5, p[0] + p[1] + p[2], 100 - p[0]].filter((v) => v !== rest && v > 0), '%'), e: `100 − (${p.join(' + ')}) = ${rest}%`, k: fx('100-a-b-c', { a: p[0], b: p[1], c: p[2] }, '%') }; }
  const y = R.pick([5, 10, 15, 20]), k = R.int(2, 4), x = y * k;
  if (x >= 100) return null;
  return { q: `원그래프에서 사과는 ${x}%, 배는 ${y}%예요. 사과는 배의 몇 배?`, a: `${k}배`, w: Us([x - y, k + 1, x + y, k * 10].filter((v) => v !== k), '배'), e: `${x} ÷ ${y} = ${k}배`, k: fx('x/y', { x, y }, '배') };
});
F('e6-1', 4, '[6수04-02]', [
  ['전체에 대한 부분의 비율을 띠 모양에 나타낸 그래프는?', '띠그래프', ['꺾은선그래프', '막대그래프', '그림그래프'], '띠 모양으로 비율을 나타내면 띠그래프예요.'],
  ['전체에 대한 부분의 비율을 원 모양에 나타낸 그래프는?', '원그래프', ['꺾은선그래프', '막대그래프', '그림그래프'], '원을 나누어 비율을 나타내면 원그래프예요.'],
  ['원그래프에서 모든 항목 비율의 합은?', '100%', ['50%', '360%', '10%'], '전체를 100%로 보고 나누어 나타내요.'],
  ['띠그래프나 원그래프로 나타내기 알맞은 것은?', '반 학생들이 좋아하는 계절의 비율', ['하루 기온의 변화', '내 키의 변화', '시간별 강수량의 변화'], '전체에 대한 부분의 비율을 볼 때 알맞아요.'],
]);
T('e6-1', 5, '[6수03-19]', (R) => {
  const r = R.int(1, 4), a = R.int(2, 12), b = R.int(2, 10), c = R.int(2, 10);
  if (r === 1) return { q: `가로 ${a} cm, 세로 ${b} cm, 높이 ${c} cm인 직육면체의 부피는?`, a: `${a * b * c} cm³`, w: Us([a + b + c, 2 * (a * b + b * c + c * a), a * b, a * b * c + a * b].filter((v) => v !== a * b * c), 'cm³'), e: `${a} × ${b} × ${c} = ${a * b * c} cm³`, k: fx('a*b*c', { a, b, c }, 'cm³') };
  if (r === 2) return { q: `한 모서리가 ${a} cm인 정육면체의 부피는?`, a: `${a ** 3} cm³`, w: Us([a * a, 3 * a, 6 * a * a, a ** 3 + a].filter((v) => v !== a ** 3), 'cm³'), e: `${a} × ${a} × ${a} = ${a ** 3} cm³`, k: fx('a*a*a', { a }, 'cm³') };
  if (r === 3) { const V = a * b * c; return { q: `부피가 ${V} cm³이고 가로 ${a} cm, 세로 ${b} cm인 직육면체의 높이는?`, a: `${c} cm`, w: Us([V / a, c + 1, c * 2, V - a * b].filter((v) => v !== c && Number.isInteger(v) && v > 0), 'cm'), e: `${V} ÷ (${a} × ${b}) = ${c} cm`, k: fx('V/(a*b)', { V, a, b }, 'cm') }; }
  const m = R.int(1, 9);
  return { q: `${m} m³는 몇 cm³인가요?`, a: `${m * 1e6} cm³`, w: Us([m * 1e3, m * 1e4, m * 1e5, m * 1e7], 'cm³'), e: '1 m³ = 100 × 100 × 100 = 1000000 cm³', k: fx('m*1000000', { m }, 'cm³'), std: '[6수03-18]' };
});
T('e6-1', 5, '[6수03-17]', (R) => {
  const a = R.int(2, 12), b = R.int(2, 10), c = R.int(2, 10);
  if (R.chance(0.6)) { const S = 2 * (a * b + b * c + c * a); return { q: `가로 ${a} cm, 세로 ${b} cm, 높이 ${c} cm인 직육면체의 겉넓이는?`, a: `${S} cm²`, w: Us([a * b + b * c + c * a, a * b * c, 6 * a * b, S + 2 * a * b].filter((v) => v !== S), 'cm²'), e: `(${a * b} + ${b * c} + ${c * a}) × 2 = ${S} cm²`, k: fx('2*(a*b+b*c+c*a)', { a, b, c }, 'cm²') }; }
  return { q: `한 모서리가 ${a} cm인 정육면체의 겉넓이는?`, a: `${6 * a * a} cm²`, w: Us([a * a, 4 * a * a, a ** 3, 6 * a].filter((v) => v !== 6 * a * a), 'cm²'), e: `${a} × ${a} × 6 = ${6 * a * a} cm²`, k: fx('6*a*a', { a }, 'cm²') };
});

// =====================================================================
// 6학년 2학기
// =====================================================================
T('e6-2', 0, '[6수01-11]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const d = R.int(3, 13), b = R.int(1, d - 1), k = R.int(1, Math.floor((d - 1) / b)), a = b * k; if (a >= d || a === b) return null; return { q: `${FR(a, d)} ÷ ${FR(b, d)} = ?`, a: String(k), w: R.shuffle([FM(b, a), FM(a * b, d * d), FM(a, d * b), String(k + 1)]), e: `분모가 같으면 분자끼리 ${a} ÷ ${b} = ${k}`, k: { k: 'qx' } }; }
  if (r === 2) { const b = R.int(2, 9), a = R.int(1, b - 1), d = R.int(2, 9), c = R.int(1, d - 1); if (a * d === b * c) return null; return { q: `${FR(a, b)} ÷ ${FR(c, d)} = ?`, a: FM(a * d, b * c), w: R.shuffle([FM(a * c, b * d), FM(b * c, a * d), FM(a * d + 1, b * c), FM(a, b * c)].filter((s) => canon(s) !== canon(FM(a * d, b * c)))), e: `${FR(a, b)} × ${FR(d, c)} = ${FR(a * d, b * c)}` + (gcd(a * d, b * c) > 1 || a * d > b * c ? ` = ${FM(a * d, b * c)}` : ''), k: { k: 'qx' } }; }
  if (r === 3) { const n = R.int(2, 9), d = R.int(2, 9), c = R.int(1, d - 1); return { q: `${n} ÷ ${FR(c, d)} = ?`, a: FM(n * d, c), w: R.shuffle([FM(n * c, d), FM(c, n * d), FM(n * d + 1, c), FM(n + d, c)].filter((s) => canon(s) !== canon(FM(n * d, c)))), e: `${n} × ${FR(d, c)} = ${FM(n * d, c)}`, k: { k: 'qx' } }; }
  const b = R.int(2, 6), w = R.int(1, 3), a = R.int(1, b - 1), d = R.int(2, 9), c = R.int(1, d - 1), N = w * b + a;
  return { q: `${MR(N, b)} ÷ ${FR(c, d)} = ?`, a: FM(N * d, b * c), w: R.shuffle([FM(N * c, b * d), FM(w * b * d + a * d, b * c) === FM(N * d, b * c) ? FM(N * d + 1, b * c) : FM(w * c + a * d, b * c), FM(N * d + b, b * c), FM(b * c, N * d)].filter((s) => canon(s) !== canon(FM(N * d, b * c)))), e: `${FR(N, b)} × ${FR(d, c)} = ${FR(N * d, b * c)}`, k: { k: 'qx' } };
});
T('e6-2', 0, '[6수01-11]', (R) => {
  const b = R.int(2, 9), a = R.int(1, b - 1), x = a * R.int(1, 6);
  const v = Q(x * b, a);
  return { q: `어떤 수에 ${eul(FR(a, b))} 곱했더니 ${ida(String(x))}. 어떤 수는?`, a: FM(v[0], v[1]), w: R.shuffle([FM(x * a, b), FM(x + b, a), FM(x * b + 1, a), FM(x * b, a + 1)].filter((s) => canon(s) !== canon(FM(v[0], v[1])))), e: `${x} ÷ ${FR(a, b)} = ${x} × ${FR(b, a)} = ${FM(v[0], v[1])}`, k: fx('x/(a/b)', { x, a, b }) };
});
T('e6-2', 1, '[6수03-09]', (R) => {
  const r = R.int(1, 4);
  if (r === 1) { const a = R.int(4, 9), b = R.int(2, a), c = R.int(1, b); const s = a + b + c; return { q: `쌓기나무를 1층에 ${a}개, 2층에 ${b}개, 3층에 ${c}개 쌓았어요. 모두 몇 개?`, a: `${s}개`, w: Us([a * 3, s + 1, s - 1, a + b].filter((v) => v !== s), '개'), e: `${a} + ${b} + ${c} = ${s}개`, k: fx('a+b+c', { a, b, c }, '개') }; }
  if (r === 2) { const a = R.int(2, 9), b = R.int(2, 5); return { q: `쌓기나무를 한 층에 ${a}개씩 ${b}층으로 쌓으면 모두 몇 개?`, a: `${a * b}개`, w: Us([a + b, a * (b + 1), a * b - 1, a * a].filter((v) => v !== a * b), '개'), e: `${a} × ${b} = ${a * b}개`, k: fx('a*b', { a, b }, '개') }; }
  if (r === 3) { const ns = Array.from({ length: R.int(4, 6) }, () => R.int(1, 3)), s = ns.reduce((x, y) => x + y, 0); return { q: `위에서 본 모양의 각 칸에 쌓은 개수가 ${ns.join(', ')}일 때 쌓기나무는 모두 몇 개?`, a: `${s}개`, w: Us([ns.length, s + 1, s - 1, Math.max(...ns) * ns.length].filter((v) => v !== s), '개'), e: `${ns.join(' + ')} = ${s}개`, k: fx(ns.join('+'), {}, '개') }; }
  const n = R.int(2, 4), m = R.int(n * n, n ** 3 - 1);
  return { q: `쌓기나무 ${m}개로 한 모서리에 ${n}개씩인 정육면체 모양을 만들려면 몇 개 더 필요한가요?`, a: `${n ** 3 - m}개`, w: Us([n ** 3, n * n - (m % (n * n)), n ** 3 - m + 1, n ** 3 - m + n].filter((v) => v !== n ** 3 - m && v > 0), '개'), e: `${n} × ${n} × ${n} = ${n ** 3}개, ${n ** 3} − ${m} = ${n ** 3 - m}`, k: fx('n*n*n-m', { n, m }, '개') };
});
F('e6-2', 1, '[6수03-10]', [
  ['쌓기나무를 위에서 본 모양으로 알 수 있는 것은?', '1층에 놓인 자리', ['전체 높이', '뒷면의 색깔', '쌓기나무의 무게'], '위에서 보면 바닥(1층)의 모양을 알 수 있어요.'],
  ['위에서 본 모양의 각 칸에 수를 쓰는 까닭은?', '그 자리에 쌓은 개수를 나타내려고', ['색깔을 나타내려고', '무게를 나타내려고', '순서를 나타내려고'], '각 칸의 수는 그 자리에 쌓은 개수예요.'],
  ['쌓기나무로 만든 모양을 층별로 나타낼 때 1층 모양과 같은 것은?', '위에서 본 모양', ['앞에서 본 모양', '옆에서 본 모양', '뒤에서 본 모양'], '1층 모양은 위에서 본 모양과 같아요.'],
]);
T('e6-2', 2, '[6수01-15]', (R) => {
  const r = R.int(1, 3);
  if (r === 1) { const dd = R.int(2, 9) / 10, q = R.int(2, 15), a = Math.round(q * dd * 100) / 100; return { q: `${D(a)} ÷ ${D(dd)} = ?`, a: String(q), w: R.shuffle([D(q / 10), D(q * 10), D(q + 1), D(a * dd)].filter((s) => s !== String(q))), e: `${ro(`${Math.round(a * 10)} ÷ ${Math.round(dd * 10)} = ${q}`)} 바꾸어 계산해요.`, k: { k: 'qx' }, dec: true }; }
  if (r === 2) { const dd = R.int(11, 59) / 100, q = R.int(2, 9), a = Math.round(q * dd * 100) / 100; return { q: `${D(a)} ÷ ${D(dd)} = ?`, a: String(q), w: R.shuffle([D(q / 10), D(q * 10), D(q + 1), D(q / 100)]), e: `${ro(`${Math.round(a * 100)} ÷ ${Math.round(dd * 100)} = ${q}`)} 바꾸어 계산해요.`, k: { k: 'qx' }, dec: true }; }
  const n = R.int(2, 12), dd = R.pick([0.2, 0.4, 0.5, 0.8, 1.2, 1.5, 2.5]), q = n / dd;
  if (!Number.isInteger(Math.round(q * 1000) / 1000 * 10)) return null;
  return { q: `${n} ÷ ${D(dd)} = ?`, a: D(q), w: R.shuffle([D(q / 10), D(q * 10), D(n * dd), D(q + 1)].filter((s) => s !== D(q))), e: `${n * 10} ÷ ${ro(String(Math.round(dd * 10)))} 바꾸어 계산하면 ${D(q)}`, k: { k: 'qx' }, dec: true };
});
T('e6-2', 2, '[6수01-15]', (R) => {
  const A = R.int(11, 299), b = R.pick([3, 6, 7, 9, 11, 12]), a = A / 10;
  const x = A / b; // 몫 × 10
  const rounded = Math.floor((2 * A + b) / (2 * b)) / 10, trunc = Math.floor(A / b) / 10;
  if (rounded === trunc || A % b === 0) return null;
  return { q: `${D(a)} ÷ ${b}의 몫을 반올림하여 소수 첫째 자리까지 나타내면?`, a: D(rounded), w: R.shuffle([D(trunc), D(Math.floor((A * 10) / b) / 100), D(rounded + 0.1), D(rounded * 10)].filter((s) => s !== D(rounded))), e: `몫 ${D(Math.floor((A * 100) / b) / 1000)}…에서 둘째 자리를 반올림해요.`, k: { k: 'divround', A, b }, _x: x };
});
T('e6-2', 3, '[6수02-04]', (R) => {
  const a = R.int(1, 9), b = R.int(1, 9), k = R.int(2, 6);
  if (a === b) return null;
  const pos = R.int(0, 3), vals = [a, b, a * k, b * k], ans = vals[pos];
  const shown = vals.map((v, i) => (i === pos ? '□' : v));
  return { q: `${shown[0]} : ${shown[1]} = ${shown[2]} : ${shown[3]}에서 □는?`, a: ans, w: R.shuffle([ans + 1, ans * k === ans ? ans + 2 : ans * k, pos < 2 ? vals[pos ^ 1] * k : vals[pos ^ 1], ans + k, Math.max(1, ans - 1)].filter((v) => v !== ans && v > 0)), e: '외항의 곱 = 내항의 곱을 이용해요.', k: { k: 'prop', s: shown } };
});
T('e6-2', 3, '[6수02-05]', (R) => {
  const a = R.int(1, 7), b = R.int(1, 7);
  if (a === b || gcd(a, b) !== 1) return null;
  const N = (a + b) * R.int(2, 12), small = R.chance(0.5), part = (N * (small ? Math.min(a, b) : Math.max(a, b))) / (a + b);
  const it = R.pick([['사탕', '개'], ['구슬', '개'], ['색종이', '장'], ['돈', '원']]);
  const NN = it[0] === '돈' ? N * 100 : N, P = it[0] === '돈' ? part * 100 : part;
  return { q: `${it[0]} ${NN}${it[1]}을(를) ${a} : ${b}로 나누면 ${small ? '적은' : '많은'} 쪽은 몇 ${it[1]}?`.replace(`${NN}${it[1]}을(를)`, eul(`${NN}${it[1]}`)).replace(`${b}로`, ro(String(b))), a: `${P}${it[1]}`, w: Us([NN - P, NN / Math.max(a, b), P + (it[0] === '돈' ? 100 : 1), NN / (a + b)].filter((v) => v !== P && Number.isInteger(v)), it[1]), e: `${NN} × ${FR(small ? Math.min(a, b) : Math.max(a, b), a + b)} = ${P}`, k: fx('N*p/(a+b)', { N: NN, p: small ? Math.min(a, b) : Math.max(a, b), a, b }, it[1]) };
});
T('e6-2', 3, '[6수02-04]', (R) => {
  const p = R.int(1, 9), q = R.int(1, 9);
  if (p === q || gcd(p, q) !== 1) return null;
  const form = R.int(1, 3);
  let A, B, txt;
  if (form === 1) { const m = R.pick([0.1, 0.2, 0.3]); A = [p * m * 10, 10]; B = [q * m * 10, 10]; txt = `${D(p * m)} : ${D(q * m)}`; }
  else if (form === 2) { const m = R.int(2, 9); A = [p * m, 1]; B = [q * m, 1]; txt = `${p * m} : ${q * m}`; }
  else { const x = R.int(2, 6), y = R.int(2, 6); if (x === y) return null; A = [1, x]; B = [1, y]; const g = gcd(y, x); p === p; txt = `${FR(1, x)} : ${FR(1, y)}`; const P2 = y / g, Q2 = x / g; return { q: `${txt}을(를) 가장 간단한 자연수의 비로 나타내면?`.replace('을(를)', '을'), a: `${P2} : ${Q2}`, w: R.shuffle([`${Q2} : ${P2}`, `${x} : ${y}`, `${P2 + 1} : ${Q2}`].filter((s) => s !== `${P2} : ${Q2}`)), e: `두 분모의 공배수 ${lcm(x, y)}를 곱해요.`.replace(`${lcm(x, y)}를`, eul(String(lcm(x, y)))), k: { k: 'simpratio', A, B } }; }
  return { q: `${txt}을(를) 가장 간단한 자연수의 비로 나타내면?`.replace('을(를)', bat(txt) ? '을' : '를'), a: `${p} : ${q}`, w: R.shuffle([`${q} : ${p}`, form === 2 ? `${p * 2} : ${q * 2}` : `${p * 10} : ${q * 10}`, `${p + 1} : ${q}`, `${p} : ${q + 1}`]), e: form === 1 ? '10을 곱한 뒤 공약수로 나눠요.' : '두 수를 최대공약수로 나눠요.', k: { k: 'simpratio', A, B } };
});
F('e6-2', 3, '[6수02-04]', [
  ['비례식에서 외항의 곱은 무엇과 같나요?', '내항의 곱', ['외항의 합', '내항의 합', '전항의 곱'], '비례식에서 외항의 곱 = 내항의 곱이에요.'],
  ['비의 전항과 후항에 0이 아닌 같은 수를 곱하면 비율은?', '같아요', ['커져요', '작아져요', '0이 돼요'], '비의 성질: 같은 수를 곱하거나 나누어도 비율은 같아요.'],
  ['비례식 3 : 4 = 6 : 8에서 내항은?', '4와 6', ['3과 8', '3과 4', '6과 8'], '안쪽에 있는 두 수가 내항이에요.'],
]);
T('e6-2', 4, '[6수03-16]', (R) => {
  const r = R.int(1, 4), n = R.int(2, 20);
  const pi = (x) => Math.round(x * 314) / 100;
  if (r === 1) return { q: `지름이 ${n} cm인 원의 원주는? (원주율 3.14)`, a: `${D(pi(n))} cm`, w: Us([pi(n / 2), pi(2 * n), pi(n * n / 4), pi(n) + 1].map((v) => Math.round(v * 1e6) / 1e6).filter((v) => D(v) !== D(pi(n))), 'cm'), e: `원주 = 지름 × 원주율 = ${n} × 3.14`, k: fx('d*314/100', { d: n }, 'cm') };
  if (r === 2) return { q: `반지름이 ${n} cm인 원의 원주는? (원주율 3.14)`, a: `${D(pi(2 * n))} cm`, w: Us([pi(n), pi(n * n), pi(4 * n), pi(2 * n) + 2].map((v) => Math.round(v * 1e6) / 1e6).filter((v) => D(v) !== D(pi(2 * n))), 'cm'), e: `${n} × 2 × 3.14 = ${D(pi(2 * n))}`, k: fx('2*r*314/100', { r: n }, 'cm') };
  if (r === 3) return { q: `반지름이 ${n} cm인 원의 넓이는? (원주율 3.14)`, a: `${D(pi(n * n))} cm²`, w: Us([pi(2 * n), pi(4 * n * n), pi(n * n) / 2, pi(n * n) + 1].map((v) => Math.round(v * 1e6) / 1e6).filter((v) => D(v) !== D(pi(n * n))), 'cm²'), e: `${n} × ${n} × 3.14 = ${D(pi(n * n))}`, k: fx('r*r*314/100', { r: n }, 'cm²') };
  return { q: `원주가 ${D(pi(n))} cm인 원의 지름은? (원주율 3.14)`, a: `${n} cm`, w: Us([n / 2, 2 * n, n + 1, n + 2, n - 1].map((v) => Math.round(v * 1e6) / 1e6).filter((v) => v !== n && v > 0), 'cm'), e: `${D(pi(n))} ÷ 3.14 = ${n}`, k: fx('C*100/314', { C: pi(n) }, 'cm') };
});
F('e6-2', 4, '[6수03-15]', [
  ['원주는 지름의 약 몇 배인가요?', '약 3.14배', ['약 2배', '약 4배', '약 1.5배'], '원주율은 약 3.14예요.'],
  ['원의 지름에 대한 원주의 비율을 무엇이라 하나요?', '원주율', ['반지름', '백분율', '넓이'], '원주 ÷ 지름 = 원주율이에요.'],
  ['원의 크기가 달라질 때 원주율은?', '항상 같아요', ['커져요', '작아져요', '원마다 달라요'], '원주율은 원의 크기와 상관없이 일정해요.'],
  ['원의 넓이를 구하는 식은?', '반지름 × 반지름 × 원주율', ['지름 × 원주율', '반지름 × 2 × 원주율', '지름 × 지름'], '원을 잘게 잘라 직사각형처럼 붙이면 알 수 있어요.', '[6수03-16]'],
]);
T('e6-2', 5, '[6수03-07]', (R) => {
  const r = R.int(1, 3), a = R.int(2, 12), b = R.int(2, 15);
  if (r === 1) { if (a === b) return null; return { q: `가로 ${a} cm, 세로 ${b} cm인 직사각형을 세로를 기준으로 한 바퀴 돌려 만든 원기둥의 밑면 지름은?`, a: `${2 * a} cm`, w: Us([a, 2 * b, b, a + b].filter((v) => v !== 2 * a), 'cm'), e: `가로 ${a} cm가 밑면의 반지름이 되어 지름은 ${2 * a} cm`, k: fx('2*a', { a }, 'cm') }; }
  if (r === 2) { if (a === b) return null; return { q: `밑변 ${a} cm, 높이 ${b} cm인 직각삼각형을 높이를 기준으로 돌려 만든 원뿔의 밑면 지름은?`, a: `${2 * a} cm`, w: Us([a, 2 * b, b, a * b].filter((v) => v !== 2 * a), 'cm'), e: `밑변이 밑면의 반지름이라 지름은 ${2 * a} cm`, k: fx('2*a', { a }, 'cm') }; }
  const d = 2 * a;
  return { q: `지름이 ${d} cm인 반원을 지름을 기준으로 한 바퀴 돌려 만든 구의 반지름은?`, a: `${a} cm`, w: Us([d, 2 * d, a + 1, a - 1].filter((v) => v !== a && v > 0), 'cm'), e: `반원의 반지름이 구의 반지름: ${d} ÷ 2 = ${a}`, k: fx('d/2', { d }, 'cm') };
});
T('e6-2', 5, '[6수03-07]', (R) => {
  const rr = R.int(1, 10), h = R.int(2, 20);
  const L = Math.round(2 * rr * 314) / 100;
  if (R.chance(0.6)) return { q: `밑면의 반지름이 ${rr} cm인 원기둥의 전개도에서 옆면의 가로는? (원주율 3.14)`, a: `${D(L)} cm`, w: Us([Math.round(rr * 314) / 100, Math.round(rr * rr * 314) / 100, 2 * rr, Math.round(4 * rr * 314) / 100].filter((v) => D(v) !== D(L)), 'cm'), e: `옆면의 가로 = 밑면의 둘레 = ${2 * rr} × 3.14`, k: fx('2*r*314/100', { r: rr }, 'cm') };
  return { q: `밑면의 반지름이 ${rr} cm, 높이가 ${h} cm인 원기둥의 전개도에서 옆면의 세로는?`, a: `${h} cm`, w: Us([rr, 2 * rr, h + rr, 2 * h].filter((v) => v !== h), 'cm'), e: '옆면의 세로는 원기둥의 높이와 같아요.', k: fx('h', { h }, 'cm') };
});
F('e6-2', 5, '[6수03-07]', [
  ['원기둥의 밑면은 몇 개인가요?', '2개', ['1개', '0개', '3개'], '원기둥은 서로 평행한 두 원이 밑면이에요.'],
  ['원뿔의 꼭짓점과 밑면 둘레의 한 점을 이은 선분은?', '모선', ['높이', '지름', '반지름'], '그 선분을 원뿔의 모선이라 해요.'],
  ['원기둥, 원뿔, 구 중 뾰족한 꼭짓점이 있는 것은?', '원뿔', ['원기둥', '구', '없어요'], '원뿔만 꼭짓점이 있어요.'],
  ['구를 어느 방향에서 보아도 보이는 모양은?', '원', ['삼각형', '직사각형', '사다리꼴'], '구는 어느 방향에서 보아도 원 모양이에요.'],
  ['원기둥을 앞에서 본 모양은?', '직사각형', ['원', '삼각형', '오각형'], '원기둥을 앞에서 보면 직사각형이에요.'],
  ['원뿔을 앞에서 본 모양은?', '삼각형', ['원', '직사각형', '사다리꼴'], '원뿔을 앞에서 보면 삼각형이에요.'],
  ['원기둥의 전개도에서 옆면의 모양은?', '직사각형', ['원', '삼각형', '부채꼴'], '원기둥의 옆면을 펼치면 직사각형이에요.'],
  ['구의 중심에서 구의 겉면의 한 점을 이은 선분은?', '구의 반지름', ['모선', '높이', '밑면'], '구의 중심과 겉면을 이은 선분이 반지름이에요.'],
]);

// ---------- 생성 ----------
function finalize(R, code, tpl, g) {
  const ans = String(g.a);
  if (!ans || /NaN|undefined|Infinity|-/.test(ans)) return null;
  const ak = canon(ans);
  const keys = new Set([ak]), strs = new Set([ans]);
  const ws = [];
  for (const w0 of g.w || []) {
    if (w0 === null || w0 === undefined) continue;
    const w = String(w0).trim();
    if (!w || /NaN|undefined|Infinity|-/.test(w)) continue;
    if (!g.dec && !/\./.test(ans) && /\./.test(w)) continue; // 자연수 답에 소수 오답은 쓰지 않는다 (소수 단원은 g.dec로 허용)
    if (!/분의/.test(ans) && /분의/.test(w) && !/분의|^\d+$/.test(ans)) continue;
    const k = canon(w);
    if (keys.has(k) || strs.has(w)) continue;
    keys.add(k); strs.add(w); ws.push(w);
    if (ws.length === 3) break;
  }
  if (ws.length < 3) return null;
  const c = R.shuffle([ans, ...ws]);
  if (/^e[56]/.test(code) && !g.raw && [...g.q.matchAll(/(\d+)분의 (\d+)/g)].some((m) => gcd(+m[1], +m[2]) > 1)) return null; // 5·6학년 문제의 분수는 기약분수로
  const e = /[가-힣]$/.test(g.e) ? g.e + '.' : g.e;
  const out = { t: TLABEL[code][tpl.u], q: g.q, c, a: c.indexOf(ans), e, std: g.std || tpl.std };
  if (!out.q || !out.e || out.e.length > 60) return null;
  return out;
}

export function generateMath(code, n, rnd = Math.random, opts = {}) {
  const list = TPL[code];
  if (!list) return [];
  const R = mkR(rnd);
  const units = MATH_UNITS[code];
  const byUnit = units.map((_, i) => list.filter((t) => t.u === i));
  const dead = new Set(), miss = units.map(() => 0);
  const out = [], seen = new Set();
  let order = [], guard = 0;
  while (out.length < n && guard++ < n * 400) {
    if (!order.length) { order = R.shuffle(units.map((_, i) => i).filter((i) => !dead.has(i))); if (!order.length) break; }
    const ui = order[order.length - 1];
    const tpl = R.pick(byUnit[ui]);
    let g = null;
    try { g = tpl.gen(R); } catch (e) { g = null; }
    const q = g && finalize(R, code, tpl, g);
    const key = q && q.q.replace(/\s+/g, '') + '|' + q.c[q.a];
    if (!q || seen.has(key)) { if (++miss[ui] > 300) { dead.add(ui); order.pop(); } continue; }
    miss[ui] = 0; order.pop();
    seen.add(key);
    if (opts.withCheck) { q.k = g.k; q.u = ui; }
    out.push(q);
  }
  return R.shuffle(out);
}

// 검사 도구용: 등록된 템플릿 수
export const TEMPLATE_COUNT = Object.fromEntries(Object.entries(TPL).map(([k, v]) => [k, v.length]));
