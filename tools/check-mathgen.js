// 수학 문제 생성기 검사: node tools/check-mathgen.js
// 학기마다 여러 시드로 300문제씩 만들어 형식, 보기 중복, 단원 포함, 문제 중복을 보고,
// 문제 글이나 검사용 데이터(k)에서 정답을 따로 다시 계산해 보기 중 정확히 하나만 맞는지 확인한다.
const path = require('path');
const { pathToFileURL } = require('url');

// ---------- 유리수 (BigInt) ----------
const bg = (x) => BigInt(x);
const babs = (x) => (x < 0n ? -x : x);
const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; };
function rat(n, d = 1n) { n = bg(n); d = bg(d); if (d === 0n) throw new Error('0으로 나눔'); if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d) || 1n; return [n / g, d / g]; }
const add = (a, b) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const sub = (a, b) => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const mul = (a, b) => rat(a[0] * b[0], a[1] * b[1]);
const div = (a, b) => rat(a[0] * b[1], a[1] * b[0]);
const cmp = (a, b) => { const x = a[0] * b[1] - b[0] * a[1]; return x < 0n ? -1 : x > 0n ? 1 : 0; };
const rs = (r) => `${r[0]}/${r[1]}`;
function fromDec(s) { s = String(s); const m = s.match(/^(\d+)(?:\.(\d+))?$/); if (!m) throw new Error('수 아님 ' + s); const f = m[2] || ''; return rat(bg(m[1] + f), 10n ** bg(f.length)); }
const isInt = (r) => r[1] === 1n;
const floorR = (r) => { let q = r[0] / r[1]; if (r[0] < 0n && r[0] % r[1] !== 0n) q -= 1n; return rat(q); };
const ceilR = (r) => { const f = floorR(r); return cmp(f, r) === 0 ? f : add(f, rat(1)); };

// ---------- 보기 읽기 ----------
const UNIT = { mm: ['길이', 1], cm: ['길이', 10], m: ['길이', 1000], km: ['길이', 1000000], g: ['무게', 1], kg: ['무게', 1000], t: ['무게', 1000000], mL: ['들이', 1], L: ['들이', 1000], 초: ['시간', 1], 분: ['시간', 60], 시간: ['시간', 3600], 일: ['시간', 86400], 'cm²': ['넓이', 1], 'm²': ['넓이', 10000], 'cm³': ['부피', 1], 'm³': ['부피', 1000000] };
const BIG = { 만: 10000n, 억: 100000000n, 조: 1000000000000n };
const TOK = /^(?:(\d+)(?:과|와) (\d+)분의 (\d+)|(\d+)분의 (\d+)|(\d+(?:\.\d+)?)(조|억|만)?) ?([A-Za-z°%²³가-힣]*)(?: |$)/;
function parseNumTokens(s) {
  let rest = s, out = [];
  while (rest.length) {
    const m = rest.match(TOK);
    if (!m || !m[0].length) return null;
    let v;
    if (m[1]) { if (m[2] === '0') return null; v = add(rat(m[1]), rat(m[3], m[2])); }
    else if (m[4]) { if (m[4] === '0') return null; v = rat(m[5], m[4]); }
    else v = mul(fromDec(m[6]), rat(m[7] ? BIG[m[7]] : 1n));
    out.push([v, m[8]]);
    rest = rest.slice(m[0].length);
  }
  return out;
}
function keyOf(v, unit = '') {
  if (!unit) return 'N:' + rs(v);
  if (UNIT[unit]) return 'F:' + UNIT[unit][0] + ':' + rs(mul(v, rat(UNIT[unit][1])));
  return 'U:' + unit + ':' + rs(v);
}
function parseChoice(s) {
  s = s.trim();
  let m;
  if ((m = s.match(/^몫 (\d+), 나머지 (\d+)$/)) || (m = s.match(/^(\d+)(?:봉지|상자), (\d+)개 남아요$/))) return `QR:${+m[1]},${+m[2]}`;
  if ((m = s.match(/^(\d+)시(?: (\d+)분)?(?: (\d+)초)?$/))) return 'TOD:' + ((+m[1] * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0)) % 43200);
  const t = parseNumTokens(s);
  if (t && t.length) {
    if (t.every((x) => x[1] === '')) return keyOf(t.reduce((a, x) => add(a, x[0]), rat(0)));
    const fams = new Set(t.map((x) => (UNIT[x[1]] ? UNIT[x[1]][0] : '?' + x[1])));
    if (fams.size === 1 && UNIT[t[0][1]]) return 'F:' + UNIT[t[0][1]][0] + ':' + rs(t.reduce((a, x) => add(a, mul(x[0], rat(UNIT[x[1]][1]))), rat(0)));
    if (t.length === 1) return keyOf(t[0][0], t[0][1]);
  }
  return 'S:' + s;
}
const numOf = (s) => { const k = parseChoice(s); const m = k.match(/^N:(-?\d+)\/(\d+)$/); return m ? rat(m[1], m[2]) : null; };

// ---------- 식 계산 (문제 글의 식, 보기의 등식) ----------
function tokExpr(s) {
  const toks = []; let rest = s.trim();
  while (rest.length) {
    let m;
    if ((m = rest.match(/^\s+/))) { rest = rest.slice(m[0].length); continue; }
    if ((m = rest.match(/^(\d+)(?:과|와) (\d+)분의 (\d+)/))) { toks.push(add(rat(m[1]), rat(m[3], m[2]))); }
    else if ((m = rest.match(/^(\d+)분의 (\d+)/))) { toks.push(rat(m[2], m[1])); }
    else if ((m = rest.match(/^\d+(?:\.\d+)?/))) { toks.push(fromDec(m[0])); }
    else if ((m = rest.match(/^[+\-−×÷*/()]/))) { toks.push({ '−': '-', '×': '*', '÷': '/' }[m[0]] || m[0]); }
    else throw new Error('식 해석 실패: ' + s);
    rest = rest.slice(m[0].length);
  }
  return toks;
}
function evalToks(toks) {
  let i = 0;
  const peek = () => toks[i];
  function prim() { const t = toks[i++]; if (t === '(') { const v = expr(); if (toks[i++] !== ')') throw new Error('괄호'); return v; } if (Array.isArray(t)) return t; throw new Error('식 오류'); }
  function term() { let v = prim(); while (peek() === '*' || peek() === '/') { const op = toks[i++]; const w = prim(); v = op === '*' ? mul(v, w) : div(v, w); } return v; }
  function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const op = toks[i++]; const w = term(); v = op === '+' ? add(v, w) : sub(v, w); } return v; }
  const v = expr();
  if (i !== toks.length) throw new Error('식 끝 오류');
  return v;
}
const evalExpr = (s) => evalToks(tokExpr(s));
// 검사용 공식 (변수, gcd/lcm/floor/ceil)
function evalFormula(f, vars) {
  const toks = f.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[+\-*/(),]/g);
  let i = 0;
  const val = (x) => (Array.isArray(x) ? x : x < 0 ? sub(rat(0), fromDec(String(-x))) : fromDec(String(x)));
  function prim() {
    const t = toks[i++];
    if (t === '(') { const v = expr(); i++; return v; }
    if (/^\d/.test(t)) return fromDec(t);
    if (['gcd', 'lcm', 'floor', 'ceil'].includes(t)) {
      i++; const args = [expr()]; while (toks[i] === ',') { i++; args.push(expr()); } i++;
      if (t === 'floor') return floorR(args[0]);
      if (t === 'ceil') return ceilR(args[0]);
      const g = bgcd(args[0][0], args[1][0]);
      return t === 'gcd' ? rat(g) : rat((args[0][0] / g) * args[1][0]);
    }
    if (!(t in vars)) throw new Error('변수 없음 ' + t);
    return val(vars[t]);
  }
  function unary() { if (toks[i] === '-') { i++; return sub(rat(0), unary()); } return prim(); }
  function term() { let v = unary(); while (toks[i] === '*' || toks[i] === '/') { const op = toks[i++]; const w = unary(); v = op === '*' ? mul(v, w) : div(v, w); } return v; }
  function expr() { let v = term(); while (toks[i] === '+' || toks[i] === '-') { const op = toks[i++]; const w = term(); v = op === '+' ? add(v, w) : sub(v, w); } return v; }
  return expr();
}
function eqTrue(s) { const p = s.split('='); if (p.length !== 2) return false; try { return cmp(evalExpr(p[0]), evalExpr(p[1])) === 0; } catch (e) { return false; } }

// ---------- 다시 세운 지식 ----------
const SHAPE = { 주사위: '상자', '휴지 상자': '상자', 책: '상자', 냉장고: '상자', '선물 상자': '상자', 벽돌: '상자', '음료수 캔': '둥근기둥', 풀: '둥근기둥', '두루마리 휴지': '둥근기둥', 북: '둥근기둥', 통조림: '둥근기둥', 분유통: '둥근기둥', 축구공: '공', 구슬: '공', 수박: '공', 지구본: '공', 야구공: '공', 농구공: '공' };
const ORDER = { 무게: ['깃털', '지우개', '사과', '수박', '자동차'], 길이: ['개미', '클립', '연필', '우산', '기차'], 키: ['병아리', '고양이', '어린이', '기린'], 넓이: ['우표', '공책', '책상', '교실', '운동장'], 들이: ['숟가락', '컵', '주전자', '양동이', '욕조'] };
const NATIVE1 = { 하나: 1, 둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 아홉: 9 };
const NATIVE10 = { 열: 10, 스물: 20, 서른: 30, 마흔: 40, 쉰: 50, 예순: 60, 일흔: 70, 여든: 80, 아흔: 90 };
const SIDES = { 삼각형: 3, 사각형: 4, 오각형: 5, 육각형: 6, 칠각형: 7, 팔각형: 8, 구각형: 9, 십각형: 10 };
const NAME_OF = Object.fromEntries(Object.entries(SIDES).map(([k, v]) => [v, k]));
const CAT = { 과일: '사과 바나나 포도 귤 딸기 수박 복숭아', 채소: '당근 오이 배추 양파 감자 시금치 무', 동물: '토끼 사자 고양이 호랑이 코끼리 강아지', 탈것: '버스 자전거 기차 비행기 배 트럭' };
const PFX = { 삼각: 3, 사각: 4, 오각: 5, 육각: 6, 칠각: 7, 팔각: 8, 구각: 9, 십각: 10 };
const solid = (ty, n, what) => (ty === '기둥' ? { 면: n + 2, 모서리: n * 3, 꼭짓점: n * 2 } : { 면: n + 1, 모서리: n * 2, 꼭짓점: n + 1 })[what];
const PLACEV = { 1000: 1000n, 100: 100n, 10: 10n, 1: 1n, 만: 10000n, 천: 1000n, 백: 100n, 십: 10n, 일: 1n, '1억': 100000000n, '1만': 10000n };
const FACT = {
  '평평한 부분과 둥근 부분이 모두 있는 모양은?': '둥근기둥 모양', '평평한 부분만 있는 모양은?': '상자 모양', '평평한 부분이 없는 모양은?': '공 모양',
  '어느 쪽으로 굴려도 잘 굴러가는 모양은?': '공 모양', '잘 굴러가지 않고 쌓기 쉬운 모양은?': '상자 모양', '눕히면 잘 굴러가고 세우면 쌓을 수 있는 모양은?': '둥근기둥 모양',
  '길이를 비교할 때 쓰는 말은?': '길다, 짧다', '무게를 비교할 때 쓰는 말은?': '무겁다, 가볍다', '넓이를 비교할 때 쓰는 말은?': '넓다, 좁다', '담긴 양을 비교할 때 쓰는 말은?': '많다, 적다',
  '뾰족한 곳이 3군데 있는 모양은?': '세모 모양', '뾰족한 곳이 4군데 있는 모양은?': '네모 모양', '뾰족한 곳이 하나도 없는 모양은?': '동그라미 모양', '곧은 선이 없고 둥근 선만 있는 모양은?': '동그라미 모양',
  '동전이나 접시를 본떠 그리면 나오는 모양은?': '동그라미 모양', '공책이나 액자를 본떠 그리면 나오는 모양은?': '네모 모양',
  '원에 대한 설명으로 옳은 것은?': '곧은 선이 없어요', '곧은 선 3개로 둘러싸인 도형은?': '삼각형', '도형에서 곧은 선을 무엇이라 하나요?': '변', '도형에서 두 곧은 선이 만나는 점은?': '꼭짓점', '변과 꼭짓점이 없는 도형은?': '원',
  '길이가 약 15 cm에 가장 가까운 것은?': '연필', '길이가 약 1 cm에 가장 가까운 것은?': '엄지손톱의 너비', '1 cm를 바르게 읽은 것은?': '1 센티미터', '자로 길이를 잴 때 물건의 한쪽 끝을 맞추는 눈금은?': '0', '어림한 길이를 말할 때 숫자 앞에 붙이는 말은?': '약',
  '분류하는 기준으로 알맞은 것은?': '색깔', '분류하는 기준으로 알맞지 않은 것은?': '귀여운 것', '다리의 수로 분류할 때 닭과 같은 무리는?': '오리',
  '자료를 표로 나타내면 좋은 점은?': '항목별 수를 알기 쉬워요', '그래프로 나타내면 좋은 점은?': '가장 많은 것을 한눈에 알 수 있어요', '○ 그래프에서 ○를 채우는 방법으로 옳은 것은?': '한 칸에 하나씩 빈칸 없이 채워요',
  '덧셈표에서 오른쪽으로 한 칸 갈 때마다 수는 얼마씩 커지나요?': '1씩', '곱셈표에서 5단의 수는 일의 자리 숫자가 어떻게 되풀이되나요?': '5, 0', '곱셈표에서 2단, 4단, 6단, 8단의 수는 모두 어떤 수인가요?': '짝수', '달력에서 같은 요일의 날짜는 며칠마다 돌아오나요?': '7일',
  '두 점을 곧게 이은 선은?': '선분', '선분을 양쪽으로 끝없이 늘인 곧은 선은?': '직선', '한 점에서 한쪽으로 끝없이 늘인 곧은 선은?': '반직선', '한 점에서 그은 두 반직선으로 이루어진 도형은?': '각',
  '종이를 반듯하게 두 번 접었을 때 생기는 각은?': '직각', '한 각이 직각인 삼각형은?': '직각삼각형', '네 각이 모두 직각인 사각형은?': '직사각형', '네 각이 직각이고 네 변의 길이가 같은 사각형은?': '정사각형',
  '한 원에서 지름은 반지름의 몇 배인가요?': '2배', '원 위의 두 점을 이은 선분 중 가장 긴 것은?': '지름', '컴퍼스로 원을 그릴 때 침을 꽂는 점은?': '원의 중심', '원의 중심과 원 위의 한 점을 이은 선분은?': '반지름', '컴퍼스를 벌린 길이는 원의 무엇과 같나요?': '반지름',
  '그림그래프의 좋은 점은?': '그림으로 많고 적음을 한눈에 알 수 있어요', '그림그래프에서 큰 그림이 나타내는 수는 작은 그림보다?': '커요',
  '정삼각형의 한 각의 크기는?': '60°', '두 변의 길이가 같은 삼각형은?': '이등변삼각형', '세 변의 길이가 같은 삼각형은?': '정삼각형', '한 각이 둔각인 삼각형은?': '둔각삼각형', '세 각이 모두 예각인 삼각형은?': '예각삼각형',
  '막대그래프에서 막대의 길이가 나타내는 것은?': '각 항목의 수량', '막대그래프의 좋은 점은?': '항목별 크기를 한눈에 비교해요',
  '마주 보는 두 쌍의 변이 서로 평행한 사각형은?': '평행사변형', '평행한 변이 한 쌍이라도 있는 사각형은?': '사다리꼴', '네 변의 길이가 모두 같은 사각형은?': '마름모',
  '두 직선이 만나서 이루는 각이 직각일 때 두 직선의 관계는?': '서로 수직', '서로 만나지 않는 두 직선의 관계는?': '서로 평행', '평행선 사이의 수직인 선분의 길이를 무엇이라 하나요?': '평행선 사이의 거리', '마름모에서 마주 보는 두 각의 크기는?': '서로 같아요',
  '변의 길이와 각의 크기가 모두 같은 다각형은?': '정다각형', '선분으로만 둘러싸인 도형은?': '다각형', '이웃하지 않은 두 꼭짓점을 이은 선분은?': '대각선', '삼각형에 그을 수 있는 대각선의 수는?': '0개',
  '하루 동안의 기온 변화를 나타내기 가장 알맞은 그래프는?': '꺾은선그래프', '꺾은선그래프에서 선이 가장 많이 기울어진 곳은?': '변화가 가장 큰 곳', '꺾은선그래프에서 필요 없는 부분을 줄여 나타낼 때 쓰는 것은?': '물결선', '꺾은선그래프로 나타내기 알맞은 것은?': '내 키의 해마다 변화',
  '도형을 밀면 무엇이 바뀌나요?': '위치', '도형을 시계 방향으로 90°씩 4번 돌리면?': '처음 도형과 같아요', '도형을 시계 방향으로 180° 돌린 것과 같은 것은?': '시계 반대 방향으로 180° 돌리기', '도형을 위쪽으로 뒤집으면 어떻게 되나요?': '위쪽과 아래쪽이 바뀌어요',
  '합동인 두 도형을 포개었을 때 완전히 겹치는 변은?': '대응변', '합동인 두 도형에서 대응각의 크기는?': '서로 같아요', '선대칭도형을 대칭축으로 접으면?': '완전히 겹쳐요', '점대칭도형은 대칭의 중심으로 몇 도 돌리면 처음과 겹치나요?': '180°',
  '정사각형의 대칭축은 몇 개인가요?': '4개', '정삼각형의 대칭축은 몇 개인가요?': '3개', '원의 대칭축은 몇 개인가요?': '셀 수 없이 많아요',
  '직육면체에서 서로 평행한 면은 몇 쌍인가요?': '3쌍', '직육면체의 겨냥도에서 보이지 않는 모서리는 몇 개인가요?': '3개', '직육면체의 겨냥도에서 보이는 면은 몇 개인가요?': '3개', '직육면체의 한 면과 수직인 면은 몇 개인가요?': '4개', '정육면체의 면은 어떤 모양인가요?': '정사각형', '직육면체의 전개도에서 면은 몇 개인가요?': '6개',
  '각기둥에서 서로 평행하고 합동인 두 면은?': '밑면', '각기둥의 옆면은 어떤 모양인가요?': '직사각형', '각뿔의 옆면은 어떤 모양인가요?': '삼각형', '각뿔에서 옆면이 모두 만나는 점은?': '각뿔의 꼭짓점', '각뿔의 밑면은 몇 개인가요?': '1개', '각기둥의 밑면은 몇 개인가요?': '2개',
  '전체에 대한 부분의 비율을 띠 모양에 나타낸 그래프는?': '띠그래프', '전체에 대한 부분의 비율을 원 모양에 나타낸 그래프는?': '원그래프', '원그래프에서 모든 항목 비율의 합은?': '100%', '띠그래프나 원그래프로 나타내기 알맞은 것은?': '반 학생들이 좋아하는 계절의 비율',
  '쌓기나무를 위에서 본 모양으로 알 수 있는 것은?': '1층에 놓인 자리', '위에서 본 모양의 각 칸에 수를 쓰는 까닭은?': '그 자리에 쌓은 개수를 나타내려고', '쌓기나무로 만든 모양을 층별로 나타낼 때 1층 모양과 같은 것은?': '위에서 본 모양',
  '비례식에서 외항의 곱은 무엇과 같나요?': '내항의 곱', '비의 전항과 후항에 0이 아닌 같은 수를 곱하면 비율은?': '같아요', '비례식 3 : 4 = 6 : 8에서 내항은?': '4와 6',
  '원주는 지름의 약 몇 배인가요?': '약 3.14배', '원의 지름에 대한 원주의 비율을 무엇이라 하나요?': '원주율', '원의 크기가 달라질 때 원주율은?': '항상 같아요', '원의 넓이를 구하는 식은?': '반지름 × 반지름 × 원주율',
  '원기둥의 밑면은 몇 개인가요?': '2개', '원뿔의 꼭짓점과 밑면 둘레의 한 점을 이은 선분은?': '모선', '원기둥, 원뿔, 구 중 뾰족한 꼭짓점이 있는 것은?': '원뿔', '구를 어느 방향에서 보아도 보이는 모양은?': '원',
  '원기둥을 앞에서 본 모양은?': '직사각형', '원뿔을 앞에서 본 모양은?': '삼각형', '원기둥의 전개도에서 옆면의 모양은?': '직사각형', '구의 중심에서 구의 겉면의 한 점을 이은 선분은?': '구의 반지름',
};
const CHANCE_W = ['불가능하다', '~아닐 것 같다', '반반이다', '~일 것 같다', '확실하다'];
const nums = (s) => (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
const listBefore = (q, mark) => q.slice(0, q.indexOf(mark)).split(', ').map((x) => x.trim());

// 정답 판정: { key } 기대값 열쇠, 또는 { pred(보기) }
function solve(q) {
  const k = q.k, Q = q.q;
  const K = (v, u) => ({ key: keyOf(v, u) });
  let m;
  switch (k.k) {
    case 'qx': return K(evalExpr(Q.replace(/ = \?$/, '')));
    case 'f': return K(evalFormula(k.f, k.v), k.u);
    case 'max': case 'min': {
      const vs = q.c.map(numOf);
      if (vs.some((v) => !v)) throw new Error('수가 아닌 보기');
      let best = 0; vs.forEach((v, i) => { if (cmp(v, vs[best]) * (k.k === 'max' ? 1 : -1) > 0) best = i; });
      return { pred: (c) => cmp(numOf(c), vs[best]) === 0 };
    }
    case 'pick': {
      const P = { even: (v) => v % 2 === 0, odd: (v) => v % 2 === 1, mult: (v) => v % k.n === 0, notdiv: (v) => k.n % v !== 0 };
      if (k.p === 'range') { m = Q.match(/(\d+) (이상|초과) (\d+) (이하|미만)/); const a = +m[1], b = +m[3]; return { pred: (c) => { const v = +c; return (m[2] === '이상' ? v >= a : v > a) && (m[4] === '이하' ? v <= b : v < b); } }; }
      return { pred: (c) => /^\d+$/.test(c) && P[k.p](+c) };
    }
    case 'fact': if (!(Q in FACT)) throw new Error('사실 표에 없는 문제'); return { key: parseChoice(FACT[Q]) };
    case 'kword': {
      if ((m = Q.match(/^(\S+?)[을를] 수로 쓰면\?$/))) { const w = m[1]; const t = Object.keys(NATIVE10).find((x) => w.startsWith(x)); const rest = t ? w.slice(t.length) : w; return K(rat((t ? NATIVE10[t] : 0) + (rest ? NATIVE1[rest] : 0))); }
      m = Q.match(/^(\d+)[을를] 세어서/); const n = +m[1]; return { key: parseChoice(Object.keys(NATIVE1).find((x) => NATIVE1[x] === n)) };
    }
    case 'shape3same': { m = Q.match(/^(.+?)[과와] 같은 모양/); const s0 = SHAPE[m[1]]; return { pred: (c) => c !== m[1] && SHAPE[c] === s0 }; }
    case 'shape3pick': { m = Q.match(/^다음 중 (\S+) 모양인 물건은\?$/); return { pred: (c) => SHAPE[c] === m[1] }; }
    case 'shape3count': { m = Q.match(/^(.+) 중에서 (\S+) 모양은 몇 개/); return K(rat(m[1].split(', ').filter((o) => SHAPE[o] === m[2]).length), '개'); }
    case 'cmpfact': {
      m = Q.match(/^(.+?)[과와] (.+?) 중 (.+) 것은\?$/);
      const A = m[1], B = m[2], rel = m[3];
      const dim = Object.keys(ORDER).find((d) => ORDER[d].includes(A) && ORDER[d].includes(B));
      const more = /무거운|긴$|큰$|넓은|많이/.test(rel);
      const ia = ORDER[dim].indexOf(A), ib = ORDER[dim].indexOf(B);
      return { key: parseChoice((ia > ib) === more ? A : B) };
    }
    case 'cmpn': { m = Q.match(/^(.+?)[은는] \S+ (\d+)개, (.+?)[은는] \S+ (\d+)개/); const x = +m[2], y = +m[4]; return { key: parseChoice(x === y ? '둘이 같아요' : x > y ? m[1] : m[3]) }; }
    case 'tens': { const n = nums(Q)[0]; return { key: parseChoice(`묶음 ${Math.floor(n / 10)}개, 낱개 ${n % 10}개`) }; }
    case 'clock': {
      if ((m = Q.match(/짧은바늘이 (\d+), 긴바늘이 12/))) return { key: 'TOD:' + ((+m[1] * 3600) % 43200) };
      m = Q.match(/짧은바늘이 (\d+)[과와] (\d+) 사이, 긴바늘이 6/); return { key: 'TOD:' + ((+m[1] * 3600 + 1800) % 43200) };
    }
    case 'clockhand': {
      if ((m = Q.match(/^(\d+)시 30분일 때 긴바늘/))) return { key: parseChoice('6') };
      m = Q.match(/^(\d+)시 정각일 때 짧은바늘/); return { key: parseChoice(m[1]) };
    }
    case 'polysum': return K(rat(k.names.reduce((a, n) => a + SIDES[n], 0)), k.u);
    case 'polyside': { m = Q.match(/^(\S+)의 (변|꼭짓점)[은는] 몇 개/); return K(rat(SIDES[m[1]]), '개'); }
    case 'polyname': { m = Q.match(/(?:변|꼭짓점)이 (\d+)개인/); return { key: parseChoice(NAME_OF[+m[1]]) }; }
    case 'seq': {
      const s = listBefore(Q, ' 다음에').map(Number);
      const d = s[1] - s[0];
      if (s.every((x, i) => i === 0 || x - s[i - 1] === d)) return K(rat(s[s.length - 1] + d));
      const r = s[1] / s[0];
      if (s.every((x, i) => i === 0 || x === s[i - 1] * r)) return K(rat(s[s.length - 1] * r));
      throw new Error('규칙 못 찾음');
    }
    case 'seqgap': {
      const s = listBefore(Q, '에서 □').map((x) => (x === '□' ? null : Number(x)));
      const i0 = s.findIndex((x, i) => x !== null && s[i + 1] !== null && i + 1 < s.length);
      const d = s[i0 + 1] - s[i0];
      const gi = s.indexOf(null);
      return K(rat(s[0] + d * gi));
    }
    case 'pat': {
      const s = listBefore(Q, ' 다음에');
      for (let p = 1; p < s.length; p++) if (s.length >= 2 * p && s.every((x, i) => i < p || x === s[i - p])) return { key: parseChoice(s[s.length - p]) };
      throw new Error('되풀이 못 찾음');
    }
    case 'pv': {
      m = Q.match(/^(\d+)에서 (?:숫자 )?(\d)[이가] 나타내는/);
      const str = m[1], d = m[2];
      if (str.split(d).length !== 2) throw new Error('숫자가 여러 번');
      return K(rat(bg(d) * 10n ** bg(str.length - 1 - str.indexOf(d))));
    }
    case 'compose': {
      const parts = [...Q.matchAll(/(1억|1만|\d+|[만천백십일])이 (\d+)개/g)];
      return K(parts.reduce((a, p) => add(a, rat(PLACEV[p[1]] * bg(p[2]))), rat(0)));
    }
    case 'eqtrue': return { pred: eqTrue };
    case 'exprval': { m = Q.match(/^(.+?)[을를] 곱셈식으로/); const t = evalExpr(m[1]); return { pred: (c) => { try { return cmp(evalExpr(c), t) === 0; } catch (e) { return false; } } }; }
    case 'argmax': { let bi = 0; k.vals.forEach((v, i) => { if ((k.max ? v > k.vals[bi] : v < k.vals[bi])) bi = i; }); return { key: parseChoice(k.names[bi]) }; }
    case 'catpick': { m = Q.match(/^다음 중 (\S+)[은는] 어느/); return { pred: (c) => CAT[m[1]].split(' ').includes(c) }; }
    case 'tod': {
      m = Q.match(/^(.+?)에서 (.+?)(?:이 지나면| 후의)/);
      const t0 = parseChoice(m[1]), d = parseChoice(m[2]);
      const s0 = +t0.slice(4), ds = d.match(/^F:시간:(\d+)\/1$/)[1];
      return { key: 'TOD:' + ((s0 + +ds) % 43200) };
    }
    case 'qr': { const [a, b] = nums(Q); return { key: `QR:${Math.floor(a / b)},${a % b}` }; }
    case 'estsum': { m = Q.match(/^(\d+) ([+−]) (\d+)/); const r = (x) => Math.round(x / 100) * 100; return K(rat(m[2] === '+' ? r(+m[1]) + r(+m[3]) : r(+m[1]) - r(+m[3]))); }
    case 'rightangles': { const RA = { 직사각형: 4, 정사각형: 4, 직각삼각형: 1 }; m = Q.match(/^(\S+) (\d+)개와 (\S+) (\d+)개/); return K(rat(RA[m[1]] * +m[2] + RA[m[3]] * +m[4]), '개'); }
    case 'angcls': { const a = nums(Q)[0]; return { key: parseChoice(a < 90 ? '예각' : a === 90 ? '직각' : '둔각') }; }
    case 'tricls': { const as = nums(Q); if (as.reduce((x, y) => x + y, 0) !== 180) throw new Error('세 각의 합'); const mx = Math.max(...as); return { key: parseChoice(mx < 90 ? '예각삼각형' : mx === 90 ? '직각삼각형' : '둔각삼각형') }; }
    case 'calcpat': {
      const lines = Q.replace(/ 다음에 올 식은\?$/, '').split(', ').map((l) => l.split(/[+=]/).map(Number));
      const da = lines[1][0] - lines[0][0], db = lines[1][1] - lines[0][1];
      const a = lines[2][0] + da, b = lines[2][1] + db;
      return { key: parseChoice(`${a}+${b}=${a + b}`) };
    }
    case 'linerise': {
      const ts = [...Q.matchAll(/(\d+)시 (\d+)°C/g)].map((x) => [+x[1], +x[2]]);
      let bi = 0; for (let i = 1; i < ts.length - 1; i++) if (ts[i + 1][1] - ts[i][1] > ts[bi + 1][1] - ts[bi][1]) bi = i;
      return { key: parseChoice(`${ts[bi][0]}시~${ts[bi + 1][0]}시`) };
    }
    case 'rot': { m = Q.match(/90°씩 (\d+)번/); return K(rat((90 * +m[1]) % 360), '°'); }
    case 'flip': { m = Q.match(/^도형을 (\S+?)(?:으로|로) (\d+)번 뒤집으면/); const n = +m[2]; return { key: parseChoice(n % 2 === 0 ? '처음 도형과 같아요' : /오른|왼/.test(m[1]) ? '왼쪽과 오른쪽이 바뀌어요' : '위쪽과 아래쪽이 바뀌어요') }; }
    case 'slide': { const [a, b] = nums(Q); return { key: parseChoice(a > b ? `오른쪽으로 ${a - b} cm` : `왼쪽으로 ${b - a} cm`) }; }
    case 'rel': return {
      pred: (c) => {
        const mm = c.match(/^([□△]) = ([□△]) ([+−×]) (\d+)$/);
        if (!mm) return false;
        return k.pairs.every(([x, y]) => { const env = { '□': x, '△': y }; const r = env[mm[2]], n = +mm[4]; const v = mm[3] === '+' ? r + n : mm[3] === '−' ? r - n : r * n; return v === env[mm[1]]; });
      },
    };
    case 'tongbun': {
      m = Q.match(/^(\d+)분의 (\d+)[과와] (\d+)분의 (\d+)[을를]/);
      const a = +m[1], b = +m[2], c = +m[3], d = +m[4];
      const g = Number(bgcd(bg(a), bg(c))), L = (a / g) * c;
      return { key: parseChoice(`${L}분의 ${(b * L) / a}, ${L}분의 ${(d * L) / c}`) };
    }
    case 'range': {
      m = Q.match(/^(\d+) (이상|초과) (\d+) (이하|미만)인 자연수/); const a = +m[1], b = +m[3];
      let n = 0; for (let x = 1; x <= b + 1; x++) if ((m[2] === '이상' ? x >= a : x > a) && (m[4] === '이하' ? x <= b : x < b)) n++;
      return K(rat(n), '개');
    }
    case 'round': {
      m = Q.match(/^(\d+)[을를] (올림|버림|반올림)하여 (십|백|천)의 자리까지/);
      const n = bg(m[1]), P = { 십: 10n, 백: 100n, 천: 1000n }[m[3]];
      const lo = (n / P) * P;
      const v = m[2] === '버림' ? lo : m[2] === '올림' ? (lo === n ? n : lo + P) : (n - lo) * 2n >= P ? lo + P : lo;
      return K(rat(v));
    }
    case 'cong': {
      m = Q.match(/변 ㄱㄴ (\d+) cm, 변 ㄴㄷ (\d+) cm, 변 ㄷㄱ (\d+) cm일 때 변 (\S\S)/);
      const map = { ㄹ: 'ㄱ', ㅁ: 'ㄴ', ㅂ: 'ㄷ' }, side = m[4].split('').map((x) => map[x]).sort().join('');
      const len = { [['ㄱ', 'ㄴ'].sort().join('')]: +m[1], [['ㄴ', 'ㄷ'].sort().join('')]: +m[2], [['ㄷ', 'ㄱ'].sort().join('')]: +m[3] };
      return K(rat(len[side]), 'cm');
    }
    case 'ndiv': { const n = nums(Q)[0]; let c = 0; for (let d = 1; d <= n; d++) if (n % d === 0) c++; return K(rat(c), '개'); }
    case 'cuboid': { m = Q.match(/의 (면|모서리|꼭짓점)[은는] 몇 개/); return K(rat({ 면: 6, 모서리: 12, 꼭짓점: 8 }[m[1]]), '개'); }
    case 'chance': {
      const asked = Q.match(/때 (.+?)일 가능성/)[1];
      let a, b;
      if ((m = Q.match(/^(.+?)만 (\d+)개/))) { a = m[1] === asked ? 1 : 0; b = m[1] === asked ? 0 : 1; }
      else { m = Q.match(/^(.+?) (\d+)개, (.+?) (\d+)개/); a = m[1] === asked ? +m[2] : +m[4]; b = m[1] === asked ? +m[4] : +m[2]; }
      if (k.num) return { key: parseChoice(b === 0 ? '1' : a === 0 ? '0' : a === b ? '2분의 1' : '?') };
      return { key: parseChoice(a === 0 ? CHANCE_W[0] : b === 0 ? CHANCE_W[4] : a === b ? CHANCE_W[2] : a > b ? CHANCE_W[3] : CHANCE_W[1]) };
    }
    case 'poly3': { m = Q.match(/^(\S\S)(기둥|뿔)의 (면|모서리|꼭짓점)/); return K(rat(solid(m[2], PFX[m[1]], m[3])), '개'); }
    case 'poly3name': { m = Q.match(/^(면|모서리|꼭짓점)[이가] (\d+)개인 각(기둥|뿔)/); const n = Object.values(PFX).filter((x) => solid(m[3], x, m[1]) === +m[2]); if (n.length !== 1) throw new Error('이름이 하나로 정해지지 않음'); return { key: parseChoice(Object.keys(PFX).find((p) => PFX[p] === n[0]) + m[3]) }; }
    case 'ratio': { m = Q.match(/^(\d+) : (\d+)에서 (기준량|비교하는 양)/); return K(rat(m[3] === '기준량' ? m[2] : m[1])); }
    case 'ratiostr': {
      if ((m = Q.match(/^(\d+)[과와] (\d+)의 비는\?$/))) return { key: parseChoice(`${m[1]} : ${m[2]}`) };
      if ((m = Q.match(/^(\d+)에 대한 (\d+)의 비는\?$/))) return { key: parseChoice(`${m[2]} : ${m[1]}`) };
      m = Q.match(/^(\d+)의 (\d+)에 대한 비는\?$/); return { key: parseChoice(`${m[1]} : ${m[2]}`) };
    }
    case 'simpratio': {
      m = Q.match(/^(.+?) : (.+?)[을를] 가장 간단한/);
      const r = div(evalExpr(m[1]), evalExpr(m[2]));
      return { key: parseChoice(`${r[0]} : ${r[1]}`) };
    }
    case 'prop': {
      m = Q.match(/^(\S+) : (\S+) = (\S+) : (\S+)에서/);
      const t = [m[1], m[2], m[3], m[4]], i = t.indexOf('□'), v = t.map((x) => (x === '□' ? null : rat(x)));
      // a : b = c : d  →  a × d = b × c
      const res = i === 0 ? div(mul(v[1], v[2]), v[3]) : i === 3 ? div(mul(v[1], v[2]), v[0]) : i === 1 ? div(mul(v[0], v[3]), v[2]) : div(mul(v[0], v[3]), v[1]);
      return K(res);
    }
    case 'divround': {
      m = Q.match(/^(\S+) ÷ (\d+)의 몫을 반올림하여 소수 첫째/);
      const x = div(fromDec(m[1]), rat(m[2]));
      const t = mul(x, rat(10));
      const fl = floorR(t), frac = sub(t, fl);
      const r = cmp(frac, rat(1, 2)) >= 0 ? add(fl, rat(1)) : fl;
      return K(div(r, rat(10)));
    }
    default: throw new Error('모르는 검사 종류 ' + k.k);
  }
}

(async () => {
  const m = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'mathgen.js')).href);
  const codes = Object.keys(m.MATH_UNITS);
  const SEEDS = [1, 2, 3, 42, 2026];
  const N = 300;
  let fails = 0, total = 0, tplTotal = 0;
  const kinds = new Set();
  for (const code of codes) {
    const errs = [];
    const unitCnt = m.MATH_UNITS[code].map(() => 0);
    for (const seed of SEEDS) {
      const qs = m.generateMath(code, N, m.seeded(seed), { withCheck: true });
      if (qs.length !== N) errs.push(`시드 ${seed}: ${qs.length}문제 (${N}개 필요)`);
      const plain = m.generateMath(code, 5, m.seeded(seed));
      if (plain.some((q) => 'k' in q)) errs.push('검사용 데이터가 일반 결과에 섞임');
      const seen = new Set();
      for (const q of qs) {
        total++;
        const tag = `[${seed}] ${q.q}`;
        const bad = (msg) => errs.push(`${tag} → ${msg} | ${q.c.join(' / ')} | a=${q.a}`);
        const txt = [q.t, q.q, q.e, q.std, ...q.c].join(' ');
        if (/NaN|undefined|Infinity|null|\[object/.test(txt)) bad('이상한 값');
        if (!Array.isArray(q.c) || q.c.length !== 4 || q.c.some((c) => typeof c !== 'string' || !c.trim())) { bad('보기 형식'); continue; }
        if (new Set(q.c.map((c) => c.trim())).size !== 4) bad('보기 중복');
        if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) bad('정답 번호');
        if (!q.t || q.t.length > 12) bad('t 길이');
        if (!q.e || q.e.length > 60) bad(`e 길이 ${q.e && q.e.length}`);
        const band = String(Math.ceil(+code[1] / 2) * 2);
        if (!new RegExp(`^\\[${band}수0[1-4]-\\d\\d\\]$`).test(q.std)) bad('성취기준 ' + q.std);
        if (/[^\d.]-\d|^-\d/.test(q.c.join(' '))) bad('음수');
        const key = q.q.replace(/\s+/g, '') + '|' + q.c[q.a];
        if (seen.has(key)) bad('중복 문제');
        seen.add(key);
        unitCnt[q.u]++;
        kinds.add(q.k.k);
        // 정답 다시 계산
        try {
          const s = solve(q);
          const hits = q.c.map((c, i) => (s.pred ? s.pred(c) : parseChoice(c) === s.key) ? i : -1).filter((i) => i >= 0);
          if (hits.length !== 1) bad(`정답 후보 ${hits.length}개 (기대 ${s.key || '조건'})`);
          else if (hits[0] !== q.a) bad(`표시 정답 ${q.a}, 계산 정답 ${hits[0]}`);
          // 같은 값을 다른 꼴로 쓴 보기
          const ks = q.c.map(parseChoice);
          if (new Set(ks).size !== 4) bad('값이 같은 보기');
        } catch (e) { bad('검사 실패: ' + e.message); }
      }
    }
    const missing = m.MATH_UNITS[code].filter((_, i) => unitCnt[i] === 0);
    if (missing.length) errs.push('나오지 않은 단원: ' + missing.join(', '));
    tplTotal += m.TEMPLATE_COUNT[code];
    fails += errs.length;
    const dist = m.MATH_UNITS[code].map((u, i) => `${u.slice(0, 6)} ${unitCnt[i]}`).join(' · ');
    console.log(`${errs.length ? '실패' : 'ok  '}  ${code}  템플릿 ${m.TEMPLATE_COUNT[code]}  문제 ${N}×${SEEDS.length}  ${dist}`);
    errs.slice(0, 12).forEach((x) => console.log('      ' + x));
    if (errs.length > 12) console.log(`      … 외 ${errs.length - 12}건`);
  }
  console.log(`\n학기 ${codes.length}개, 템플릿 ${tplTotal}개, 검사 종류 ${kinds.size}개, 문제 ${total}개, 지적 ${fails}건`);
  process.exit(fails ? 1 : 0);
})();
