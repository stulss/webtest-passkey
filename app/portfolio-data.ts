// 과제 1(webtest)의 js/models/PortfolioData.js 를 그대로 옮긴 공개 소개 콘텐츠.
// 이 페이지에 나오는 내용은 학습·연습용으로 지어낸(fabricated) 것이며, 실제 연락처·주소·
// 신분증 번호 같은 개인정보는 넣지 않는다. privateItems 는 "무엇을 공개하지 않는지" 항목명만 둔다.

export type Strength = {
  id: string;
  title: string;
  situation: string;
  action: string;
  result: string;
  evidenceLabel: string | null;
  evidenceUrl: string | null;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  techUsed: string[];
  link: { label: string; url: string } | null;
  troubleshooting: {
    id: string;
    problem: string;
    attempt: string;
    comparison: string;
    lesson: string;
  }[];
};

export const PROFILE = {
  name: "홍주형",
  targetSentence:
    "공조냉동설비기사를 준비하며 Python과 MySQL을 독학하고, 그 배움을 이 포트폴리오 웹사이트로 직접 기획·제작했습니다.",
  publicItems: [
    "최근 공부한 내용: Python, MySQL",
    "취미: 게임, 야구",
    "관심 분야: IT",
  ],
  heroSummaryItems: ["최근 공부한 내용", "취미", "관심 분야"],
  privateItems: ["집 주소", "전화번호", "이메일 주소"],
  evidence: { label: "GitHub에서 근거 보기", url: "https://github.com/stulss" },
};

export const STRENGTHS: Strength[] = [
  {
    id: "study",
    title: "강점 1. 새로운 분야에 도전하는 실행력",
    situation:
      "2026년 5월부터 새로운 방향을 준비하며 공조냉동설비기사 자격증 취득을 목표로 공부를 시작했습니다.",
    action:
      "이론 학습과 문제풀이를 꾸준히 병행하며, 시험 범위를 스스로 계획하고 정리해 나갔습니다.",
    result:
      "정해준 사람 없이도 낯선 분야를 스스로 계획을 세워 공부해나가는 힘을 확인했습니다.",
    evidenceLabel: null,
    evidenceUrl: null,
  },
  {
    id: "hobby",
    title: "강점 2. 몰입해서 나를 채우는 힘",
    situation:
      "쉬는 날이면 좋아하는 게임을 하거나, 기아타이거즈 경기를 직접 보러 야구장을 찾았습니다.",
    action:
      "혼자 몰입할 수 있는 게임과, 기아타이거즈를 응원하며 현장 분위기를 직접 느낄 수 있는 야구 직관을 번갈아 즐기며 제 나름의 휴식 리듬을 만들었습니다.",
    result:
      "좋아하는 것에 정기적으로 몰입하는 시간을 스스로 챙길 수 있게 되었고, 그 에너지가 새로운 도전을 준비하는 데에도 도움이 되었습니다.",
    evidenceLabel: null,
    evidenceUrl: null,
  },
  {
    id: "interest",
    title: "강점 3. 관심 있는 것을 직접 파고드는 힘",
    situation:
      "평소 IT기기에 관심이 많아 관련 소식을 즐겨 찾아보다가, 직접 배워보고 싶어 파이썬 입문과 MySQL을 공부했습니다.",
    action:
      "배운 것을 그대로 두지 않고, 이 포트폴리오 페이지를 AI 도구와 함께 직접 기획하고 코드로 만들어봤습니다.",
    result:
      "관심 있는 분야는 실제로 만들어보면서 확인하는 편이라는 것을 알게 됐고, 그 결과물을 GitHub에 공개했습니다.",
    evidenceLabel: "GitHub에서 코드 보기 ↗",
    evidenceUrl: "https://github.com/stulss",
  },
];

export const TECH_STACK = [
  {
    name: "HTML / CSS",
    status: "이 사이트에 사용",
    reason:
      "프레임워크 없이 기본기를 확실히 다지고 싶어서, 이 포트폴리오 전체를 직접 구조화했습니다.",
  },
  {
    name: "JavaScript / React (Next.js)",
    status: "이 사이트에 사용",
    reason:
      "과제 1의 바닐라 MVC 포트폴리오를, 패스키 인증을 붙이기 위해 Next.js(App Router)로 다시 옮겼습니다.",
  },
  {
    name: "WebAuthn / 패스키",
    status: "이 사이트에 사용",
    reason:
      "비밀번호 없이 비공개 영역을 잠그기 위해 @simplewebauthn 으로 등록·로그인 ceremony 를 붙였습니다.",
  },
  {
    name: "Python",
    status: "학습 중",
    reason: "IT 전반에 대한 이해를 넓히려고 첫 프로그래밍 언어로 독학을 시작했습니다.",
  },
  {
    name: "MySQL",
    status: "학습 중",
    reason: "데이터를 구조적으로 다루는 감각을 익히려고 함께 학습했습니다.",
  },
];

export const PROJECTS: Project[] = [
  {
    id: "portfolio-site",
    name: "이 포트폴리오 웹사이트",
    description:
      "학습한 것을 실제로 적용해보고 싶어서 AI 도구와 함께 기획하고 만든 개인 포트폴리오입니다. 과제 1은 프레임워크 없이 객체지향 MVC 패턴으로 직접 구조화했고, 과제 8에서 Next.js로 옮기며 패스키로 잠근 비공개 영역을 더했습니다.",
    techUsed: ["HTML", "CSS", "JavaScript", "Next.js", "WebAuthn"],
    link: { label: "GitHub에서 코드 보기", url: "https://github.com/stulss" },
    troubleshooting: [
      {
        id: "contrast",
        problem: "강점 카드 라벨 색상이 배경과 명암비 4.02:1로 접근성 기준 미달",
        attempt:
          "회색 후보 5개(#7c8592, #828a97, #88909c, #8b93a0, #9098a5)의 명암비를 상대휘도 공식으로 직접 계산했습니다.",
        comparison:
          "각각 5.21 / 5.59 / 6.04 / 6.28 / 6.69로 나왔고, WCAG AA 기준(4.5:1)보다 여유 있게 통과하는 값을 선택했습니다.",
        lesson:
          "색은 눈대중이 아니라 공식으로 검증해야 한다는 것, 기준선에 딱 맞추기보다 여유를 두는 게 안전하다는 것을 배웠습니다.",
      },
      {
        id: "focus-ring",
        problem: "강점 카드가 Tab으로 선택돼도 포커스 표시가 안 보임",
        attempt:
          "개발자도구로 원인을 추적한 결과, 부모 요소의 overflow:hidden이 바깥쪽으로 그려지는 포커스 링을 잘라내고 있었습니다.",
        comparison:
          "포커스 링을 바깥쪽(기본값)으로 둘지, 카드 안쪽(inset)으로 그리도록 바꿀지 비교했습니다.",
        lesson:
          "접근성 결함은 눈으로만 봐서는 안 보이고, 실제로 키보드로 조작해봐야 드러난다는 것을 배웠습니다.",
      },
      {
        id: "passkey-rpid",
        problem: "과제 8에서 Vercel 프리뷰 배포에서 만든 패스키가 프로덕션에서 안 통함",
        attempt:
          "패스키는 정확한 도메인(rpID)에 묶인다는 것을 확인하고, WEBAUTHN_RP_ID/ORIGIN 을 프로덕션 도메인으로 고정한 뒤 재배포했습니다.",
        comparison:
          "프리뷰마다 바뀌는 서브도메인에 맞추는 방법과, 프로덕션 도메인 하나로 고정하는 방법을 비교해 후자를 택했습니다.",
        lesson:
          "패스키의 도메인 바인딩은 편의가 아니라 보안 장치이고, 배포 환경을 먼저 정하고 붙여야 한다는 것을 배웠습니다.",
      },
    ],
  },
];
