// 상점·유물 칸에 쓰는 그림 아이콘 (24칸 격자 위 선 그림)
// 기본 선 색은 currentColor, 포인트 색은 R(빨강)·B(잉크 파랑)·G(금)
const R = '#ff7a62', B = '#7cc7ff', G = '#f2c45c';
const svg = (body) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  // 손때 묻은 연습장: 스프링 공책
  pad: svg(`<rect x="6" y="3.5" width="13" height="17" rx="1.5"/><path d="M4 7h3M4 11h3M4 15h3M4 19h3"/><path d="M10 8h6M10 11.5h6M10 15h4"/><circle cx="16.5" cy="17.5" r="1.3" fill="${G}" stroke="none"/>`),
  // 무딘 연필깎이: 깎이 상자와 연필 끝
  sharp: svg(`<rect x="3.5" y="9" width="10" height="9" rx="1.5"/><circle cx="8.5" cy="13.5" r="2"/><path d="M13.5 13.5h3l4-2.5v5l-4-2.5" /><path d="M18.5 12.3v2.4" stroke="${G}"/>`),
  // 가시 돋친 빨간펜
  redpen: svg(`<path d="M5 19l2-5L16 5l3 3-9 9z" stroke="${R}"/><path d="M5 19l2.6-1" stroke="${R}"/><path d="M10 8.5l-1.5-1.5M13 7l-.3-2M14.8 11.2l2 .4M12 13.8l1.5 1.5" /><path d="M14 7l3 3" stroke="${R}"/>`),
  // 봉인된 복습 노트: 책과 밀랍 봉인
  sealnote: svg(`<path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11"/><circle cx="12" cy="10" r="3" fill="${R}" stroke="${R}"/><path d="M12 8.6v2.8M10.6 10h2.8" stroke="#3a1a12" stroke-width="1.2"/>`),
  // 금 간 책받침
  crack: svg(`<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M11 3.5l1.5 4-2.5 3 3 3.5-1.5 3 1 3.5" stroke="${B}"/>`),
  // 메아리 치는 종
  echo: svg(`<path d="M7 16V11a5 5 0 0 1 10 0v5l1.5 2h-13z"/><path d="M10.5 20a1.6 1.6 0 0 0 3 0"/><path d="M3.5 9.5a8 8 0 0 1 2-4M20.5 9.5a8 8 0 0 0-2-4" stroke="${G}"/><path d="M2 13a10 10 0 0 1 .6-4M22 13a10 10 0 0 0-.6-4" stroke="${G}"/>`),
  // 굶주린 책벌레: 책을 뚫고 나온 벌레
  worm: svg(`<path d="M3.5 6.5h8v13h-8z"/><path d="M11.5 6.5h0"/><path d="M8 13c2.5 0 3-3 5.5-3s3 3 5.5 3c1.2 0 1.8-.8 2-1.6" stroke="${G}"/><circle cx="20.4" cy="10" r="0.8" fill="currentColor"/><circle cx="8" cy="13" r="1.4" fill="#1a0f08"/>`),
  // 묵직한 사전: 두꺼운 책
  dict: svg(`<path d="M4 7.5l8-3 8 3v10l-8 3-8-3z"/><path d="M12 4.5v16"/><path d="M4 7.5l8 3 8-3"/><path d="M14.5 13.5l3-1.1M14.5 16l3-1.1" stroke="${G}"/>`),
  // 세 번 고친 답안지
  sheet: svg(`<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5"/><path d="M8.5 11h4M8.5 14h6" /><path d="M8 11.2l5 0" stroke="${R}"/><path d="M9 17.5l1.5 1.5 3.5-3.5" stroke="${G}"/>`),
  // 패자의 오답 도장
  stamp: svg(`<path d="M9.5 3.5h5v5l3 3v2h-11v-2l3-3z"/><path d="M5 16.5h14v3H5z"/><path d="M10 9.5l4 3M14 9.5l-4 3" stroke="${R}" stroke-width="1.4"/>`),
  // 양면 동전: 반은 빛, 반은 그림자
  coin: svg(`<circle cx="12" cy="12" r="8" stroke="${G}"/><path d="M12 4a8 8 0 0 0 0 16z" fill="${G}" stroke="none" opacity=".85"/><path d="M8 12l1.5 1.5L11 10" stroke="#3a2410"/><path d="M14 10l3 3M17 10l-3 3" stroke="${R}"/>`),
  // 들뜬 풀무
  bellows: svg(`<path d="M4 9l9-3 4 6-4 6-9-3z"/><path d="M8 7.8v8.4M11 6.8v10.4"/><path d="M17 12h2.5"/><path d="M20.5 8.5c1 1 1 2-.2 3M20.5 15.5c1-1 1-2-.2-3" stroke="${R}"/>`),
  // 마르지 않는 잉크병
  ink: svg(`<path d="M9 3.5h6v3h-6z"/><path d="M8 6.5h8l2 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-8z"/><path d="M6.4 13h11.2V18.5a2 2 0 0 1-2 2H8.4a2 2 0 0 1-2-2z" fill="${B}" stroke="none" opacity=".75"/><path d="M12 15c-1 1.2-1.2 2.4 0 2.6 1.2-.2 1-1.4 0-2.6z" fill="#0d2230" stroke="none"/>`),
  // 평생 학습 계약서: 두루마리와 서명
  contract: svg(`<path d="M7 4h11v14a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1 0-5h1z"/><path d="M7 15.5V4a2 2 0 0 0-3 0v11.5"/><path d="M10 7.5h5M10 10h5"/><path d="M9.5 14c1-1.5 2-1.5 2 0s1.5 1.5 3-1" stroke="${R}"/>`),
  // 부화 직전의 원석 알
  cocoon: svg(`<path d="M12 3.5c3.6 0 6.5 5 6.5 9.5a6.5 6.5 0 0 1-13 0c0-4.5 2.9-9.5 6.5-9.5z"/><path d="M8 11l2 1.5 1.5-2 2 2.5 2-1.5" stroke="${G}"/><path d="M11 16l1-1.2 1 1.2-1 1.2z" fill="${B}" stroke="${B}"/>`),
  // 새벽의 책갈피: 리본과 떠오르는 해
  bookmark: svg(`<path d="M7 3.5h10v17l-5-3.5-5 3.5z"/><circle cx="12" cy="10" r="2.2" fill="${G}" stroke="${G}"/><path d="M12 5.8v.8M8.6 10h.8M14.6 10h.8M9.6 7.6l.6.6M14.4 7.6l-.6.6" stroke="${G}"/>`),
  // 부러진 깃펜
  quill: svg(`<path d="M19.5 4.5C13 5 9 9 8 14l2 1c5-1 8.5-5 9.5-10.5z"/><path d="M8 14l-1.5 1.5"/><path d="M5.5 16.5l-1.5 1.5 1 1" /><path d="M6.5 15.5l-1 1" stroke="${R}"/><path d="M11 12l4-4" />`),
  // 기다림의 추
  weight: svg(`<path d="M12 3v4"/><circle cx="12" cy="8.5" r="1.5"/><path d="M8.5 10h7l2.5 10h-12z"/><path d="M10 14h4" stroke="${G}"/>`),
  // 튼튼한 책 고리
  hoop: svg(`<path d="M5 6.5h9v14H5z"/><circle cx="15.5" cy="9" r="3.2" stroke="${G}" stroke-width="2"/><circle cx="15.5" cy="16" r="3.2" stroke="${G}" stroke-width="2"/>`),
  // 쌍둥이 도장
  twin: svg(`<path d="M5 6h4v3l2 2v1.5H3V11l2-2z"/><path d="M15 6h4v3l2 2v1.5h-8V11l2-2z"/><path d="M3 15h8v3H3zM13 15h8v3h-8z" stroke="${G}"/>`),
  // 새벽을 되찾은 깃펜 (융합)
  dawnquill: svg(`<path d="M19.5 4.5C13 5 9 9 8 14l2 1c5-1 8.5-5 9.5-10.5z" stroke="${G}"/><path d="M8 14l-3.5 3.5"/><path d="M11 12l4-4" stroke="${G}"/><path d="M3 9.5h2.2M4.2 5.4l1.5 1.5M8.5 3.2v2" stroke="${G}"/>`),
  // 모범 답안 노트 (융합): 공책과 별
  modelnote: svg(`<rect x="6" y="3.5" width="13" height="17" rx="1.5"/><path d="M4 7h3M4 11h3M4 15h3M4 19h3"/><path d="M12.5 7.5l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" fill="${G}" stroke="${G}" stroke-width="1"/>`),
  // 빨간 줄 책받침 (융합)
  redrule: svg(`<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M4 12h16" stroke="${R}" stroke-width="2.2"/><path d="M8 3.5v3M12 3.5v2M16 3.5v3"/>`),
  // 봉인된 백과사전 (융합): 책더미와 자물쇠
  encyclo: svg(`<path d="M4 16.5h16v3.5H4zM5 12.5h14v4H5zM6 8.5h12v4H6z"/><rect x="10" y="4.5" width="4" height="3.5" rx=".6" fill="${G}" stroke="${G}"/><path d="M10.8 4.5V3.6a1.2 1.2 0 0 1 2.4 0v.9" stroke="${G}"/>`),
  // 지혜의 안경
  glasses: svg(`<circle cx="7" cy="14" r="3.5"/><circle cx="17" cy="14" r="3.5"/><path d="M10.5 14c.9-.8 2.1-.8 3 0M3.5 14L2.5 9M20.5 14l1-5"/><path d="M5.5 12.5l1.5-1" stroke="${B}"/><path d="M15.5 12.5l1.5-1" stroke="${B}"/>`),
  // 운명을 고치는 수정테이프
  tape: svg(`<path d="M4 8h11l4 4-4 4H4z"/><circle cx="9" cy="12" r="2.4"/><path d="M19 12h2.5" /><path d="M16 18.5h6" stroke="#fff6e0" stroke-width="2.2"/>`),
  // 합격 추첨표
  ticket: svg(`<path d="M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4z"/><path d="M15 7v10" stroke-dasharray="1.5 1.5"/><path d="M9 9.5l.9 1.8 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="${G}" stroke="${G}" stroke-width="1"/>`),
  // 힌트 두루마리
  hint: svg(`<path d="M7 5h12v12.5a2.5 2.5 0 0 1-2.5 2.5H5.5"/><path d="M7 5a2 2 0 0 0-4 0v1.5h4"/><path d="M5.5 20A2.5 2.5 0 0 0 8 17.5V5"/><path d="M11 9h5M11 12h5" /><path d="M13.5 15.5h0" stroke="${G}" stroke-width="2.4"/>`),
  // 새 양초
  candle: svg(`<path d="M9 11h6v9.5H9z"/><path d="M12 11V9.5"/><path d="M12 3.5c1.8 2 2 3.6 0 5.5-2-1.9-1.8-3.5 0-5.5z" fill="${G}" stroke="${G}"/><path d="M7 20.5h10"/>`),
};
