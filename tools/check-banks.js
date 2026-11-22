// 문제 은행 검사: node tools/check-banks.js
// 형식, 보기 중복, 정답 번호, 성취기준 코드가 학년군과 맞는지, 문제 중복을 본다.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'data', 'q');
const GRADES = { e: [1, 2, 3, 4, 5, 6], m: [1, 2, 3] };
const SUBJ = { kor: '국', math: '수', soc: '사', sci: '과', eng: '영' };
const expected = [];
for (const g of GRADES.e) for (const s of [1, 2]) for (const k of (g <= 2 ? ['kor', 'math'] : ['kor', 'math', 'soc', 'sci', 'eng']))
  expected.push(`e${g}-${s}-${k}`);
for (const g of GRADES.m) for (const s of [1, 2]) for (const k of ['soc', 'sci', 'eng']) expected.push(`m${g}-${s}-${k}`);

// 학년군 접두: 초1-2 → 2, 초3-4 → 4, 초5-6 → 6, 중 → 9
const band = (code) => code[0] === 'm' ? '9' : String(Math.ceil(+code[1] / 2) * 2);
let problems = 0, total = 0;
const seen = new Map();
for (const code of expected) {
  const f = path.join(dir, code + '.json');
  if (!fs.existsSync(f)) { console.log(`없음  ${code}`); problems++; continue; }
  let b;
  try { b = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.log(`JSON 오류 ${code}: ${e.message}`); problems++; continue; }
  const qs = b.questions || [], errs = [];
  // 수학은 문제 생성기(js/mathgen.js)가 채우므로 고정 문제 20개면 되고, 나머지 과목은 100개 이상
  const minQ = code.endsWith('-math') ? 20 : 100;
  if (qs.length < minQ) errs.push(`문제 수 ${qs.length} (최소 ${minQ})`);
  qs.forEach((q, i) => {
    const n = i + 1;
    if (!q.q || !q.e || !q.t) errs.push(`#${n} 빈 칸`);
    if (!Array.isArray(q.c) || q.c.length !== 4) errs.push(`#${n} 보기 ${q.c && q.c.length}개`);
    else if (new Set(q.c.map((x) => String(x).trim())).size !== 4) errs.push(`#${n} 보기 중복`);
    if (!(q.a >= 0 && q.a <= 3 && Number.isInteger(q.a))) errs.push(`#${n} 정답 번호 ${q.a}`);
    const std = String(q.std || '');
    const sub = SUBJ[code.split('-')[2]];
    if (!std.startsWith('[' + band(code)) || !std.includes(sub)) errs.push(`#${n} 성취기준 ${std}`);
    // 한 판에는 파일 하나만 쓰므로 같은 파일 안에서 문제와 정답이 모두 같을 때만 중복으로 본다
    const key = code + '|' + q.q.replace(/\s+/g, '') + '|' + (q.c ? q.c[q.a] : '');
    if (seen.has(key)) errs.push(`#${n} 같은 파일 안 중복 문제`);
    seen.set(key, code);
  });
  total += qs.length;
  if (errs.length) { problems += errs.length; console.log(`${code}: ${errs.slice(0, 8).join(' / ')}${errs.length > 8 ? ` 외 ${errs.length - 8}` : ''}`); }
  else console.log(`ok    ${code} (${qs.length})`);
}
console.log(`\n파일 ${expected.length}개 중 문제 ${total}개, 지적 ${problems}건`);
process.exit(problems ? 1 : 0);
