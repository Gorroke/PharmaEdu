// ─────────────────────────────────────────────
// PharmaEdu Phase 7 — Lesson Metadata Index
// PHASE7_LEARNING_PLAN.md 기반 10개 레슨 메타데이터
// ─────────────────────────────────────────────

export interface LessonMeta {
  slug: string;
  number: number;
  title: string;
  subtitle: string;
  track: '기초' | '중급' | '심화';
  estimatedMinutes: number;
  prerequisites: string[];  // slugs
  objectives: string[];
}

export const LESSONS: LessonMeta[] = [
  {
    slug: 'lesson-01-what-is-yakjaebi',
    number: 1,
    title: '약제비란 무엇인가?',
    subtitle: '약국에서 청구하는 돈, 어떻게 계산될까?',
    track: '기초',
    estimatedMinutes: 15,
    prerequisites: [],
    objectives: [
      '약제비가 약값(약품금액)과 조제료로 구성된다는 것을 설명할 수 있다',
      '건강보험에서 약제비가 환자·공단·국가로 3자 분담된다는 구조를 이해한다',
      '약국이 공단에 청구하는 금액과 환자가 내는 금액의 차이를 구분할 수 있다',
    ],
  },
  {
    slug: 'lesson-02-prescription-components',
    number: 2,
    title: '처방전의 구성요소',
    subtitle: '종이 처방전이 데이터로 바뀌는 순간',
    track: '기초',
    estimatedMinutes: 20,
    prerequisites: ['lesson-01-what-is-yakjaebi'],
    objectives: [
      '처방전에서 계산 엔진이 읽어야 하는 필수 정보 항목을 열거할 수 있다',
      '보험코드가 어떤 역할을 하는지 설명할 수 있다',
      '투약일수·투여횟수·1회투약량이 금액 계산에 미치는 영향을 이해한다',
      '조제일자·조제시간이 가산 판단에 왜 필요한지 설명할 수 있다',
    ],
  },
  {
    slug: 'lesson-03-drug-amount-basics',
    number: 3,
    title: '약품금액 계산 기초',
    subtitle: '단가 × 수량 × 횟수 × 일수, 그리고 반올림',
    track: '기초',
    estimatedMinutes: 20,
    prerequisites: ['lesson-02-prescription-components'],
    objectives: [
      '약품금액 기본 공식(단가 × 1회투약량 × 1일투여횟수 × 총투여일수)을 암기·적용할 수 있다',
      '4사5입(원미만 반올림)이 무엇인지 직접 계산 예제로 확인한다',
      '급여 약품과 비급여 약품의 금액 산정 방식 차이를 구분한다',
      '저가대체장려금·사용장려금이 금액 계산에 어떻게 포함되는지 개념적으로 이해한다',
    ],
  },
  {
    slug: 'lesson-04-dispensing-fees',
    number: 4,
    title: '조제료 이해하기',
    subtitle: '약값 외에 청구되는 \'서비스 요금\', Z코드로 관리한다',
    track: '중급',
    estimatedMinutes: 25,
    prerequisites: ['lesson-03-drug-amount-basics'],
    objectives: [
      '조제료가 기본조제료와 약품조제료로 나뉜다는 구조를 설명할 수 있다',
      'Z코드의 5자리 기본코드 + 3자리 접미사 구조를 이해한다',
      '투약일수에 따라 달라지는 처방조제료 구간을 확인할 수 있다',
      'Z1000·Z2000·Z3000·Z4xxx 등 주요 코드의 역할을 구분한다',
      'Z코드 기반 수가 조회 흐름(suga_fee 테이블)을 설명할 수 있다',
    ],
  },
  {
    slug: 'lesson-05-surcharge-rules',
    number: 5,
    title: '가산 규칙',
    subtitle: '야간에 조제하면 얼마 더 받나? 8종 가산의 모든 것',
    track: '중급',
    estimatedMinutes: 25,
    prerequisites: ['lesson-04-dispensing-fees'],
    objectives: [
      '8종 가산(야간/공휴일/토요일/산제/직접조제/6세미만/65세이상/명절)의 조건을 나열할 수 있다',
      '가산이 중복 적용될 때의 우선순위 규칙을 설명할 수 있다',
      '각 가산이 Z코드 접미사에서 어떻게 표현되는지 예시로 확인한다',
      '야간·공휴일 판단에 필요한 데이터(조제시간, holiday 테이블)를 이해한다',
    ],
  },
  {
    slug: 'lesson-06-copayment',
    number: 6,
    title: '본인부담금 계산',
    subtitle: '환자가 내는 돈은 어떻게 정해지는가',
    track: '중급',
    estimatedMinutes: 25,
    prerequisites: ['lesson-04-dispensing-fees', 'lesson-05-surcharge-rules'],
    objectives: [
      '총약제비 → 요양급여비용총액1(10원 절사) 변환 과정을 설명할 수 있다',
      '정률(%) 방식과 정액(고정금액) 방식의 차이를 구분한다',
      'insu_rate 테이블에서 보험코드별 요율을 조회하는 흐름을 이해한다',
      '산정특례(V252)가 본인부담금에 미치는 영향을 설명할 수 있다',
      '본인부담금 계산 결과를 3자배분(환자/공단/보훈)으로 연결하는 개념을 안다',
    ],
  },
  {
    slug: 'lesson-07-insurance-types',
    number: 7,
    title: '보험 유형별 차이',
    subtitle: '같은 약, 다른 청구 — 보험 종류가 금액을 바꾼다',
    track: '중급',
    estimatedMinutes: 25,
    prerequisites: ['lesson-06-copayment'],
    objectives: [
      '건강보험·의료급여·보훈·자동차보험·산재의 본인부담 방식 차이를 비교표로 설명할 수 있다',
      '의료급여 1·2종의 정액/정률 분기 기준을 이해한다',
      '보훈 감면율(M코드별 0~100%)이 계산에 어떻게 적용되는지 개략적으로 안다',
      '자동차보험·산재 처방이 공단 청구와 다른 점을 나열한다',
    ],
  },
  {
    slug: 'lesson-08-rounding-precision',
    number: 8,
    title: '반올림과 절사의 정밀함',
    subtitle: '1원 차이가 청구 오류를 만든다 — 계산 단계별 정밀 규칙',
    track: '심화',
    estimatedMinutes: 20,
    prerequisites: ['lesson-03-drug-amount-basics', 'lesson-06-copayment'],
    objectives: [
      '계산 파이프라인에서 반올림이 일어나는 위치 5개를 순서대로 말할 수 있다',
      '4사5입 / 10원 절사(Trunc10) / 100원 절사 각각의 수식을 직접 적용할 수 있다',
      '반올림 적용 순서가 틀렸을 때 발생하는 오차를 예제로 확인한다',
      'RoundingHelper 유틸리티가 제공하는 함수 목록을 개념적으로 이해한다',
    ],
  },
  {
    slug: 'lesson-09-special-cases',
    number: 9,
    title: '특수 케이스',
    subtitle: '일반 규칙이 통하지 않는 상황들 — 보훈·산정특례·특수약품',
    track: '심화',
    estimatedMinutes: 30,
    prerequisites: ['lesson-07-insurance-types', 'lesson-08-rounding-precision'],
    objectives: [
      '명절 가산이 언제, 어떻게 적용되는지 설명할 수 있다',
      '본인부담상한제가 약제비 청구에 미치는 영향을 이해한다',
      '특수약품(하드코딩 약품)이 존재하는 이유와 처리 방식을 안다',
      '날짜 기준 분기(2024-07-01 고시 변경 등)가 왜 중요한지 설명할 수 있다',
    ],
  },
  {
    slug: 'lesson-10-integrated-practice',
    number: 10,
    title: '실전 종합 연습',
    subtitle: '처음부터 끝까지, 실제 처방전으로 직접 계산해보자',
    track: '심화',
    estimatedMinutes: 30,
    prerequisites: [
      'lesson-01-what-is-yakjaebi',
      'lesson-02-prescription-components',
      'lesson-03-drug-amount-basics',
      'lesson-04-dispensing-fees',
      'lesson-05-surcharge-rules',
      'lesson-06-copayment',
      'lesson-07-insurance-types',
      'lesson-08-rounding-precision',
      'lesson-09-special-cases',
    ],
    objectives: [
      '처방전 입력 → 약품금액 → 조제료 → 총약제비 → 본인부담금 → 청구액 전체 흐름을 스스로 계산할 수 있다',
      '건강보험·의료급여·보훈 3가지 시나리오를 각각 완성한다',
      '계산기 출력 결과와 직접 계산 결과를 비교·검증한다',
      '자주 발생하는 청구 오류 3가지와 원인을 설명할 수 있다',
      'CH11 테스트 시나리오 중 1개를 선택해 스스로 검증한다',
    ],
  },
];

// ─────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────

export function getLessonBySlug(slug: string): LessonMeta | undefined {
  return LESSONS.find((l) => l.slug === slug);
}

export function getNextLesson(slug: string): LessonMeta | undefined {
  const idx = LESSONS.findIndex((l) => l.slug === slug);
  if (idx < 0 || idx >= LESSONS.length - 1) return undefined;
  return LESSONS[idx + 1];
}

export function getPrevLesson(slug: string): LessonMeta | undefined {
  const idx = LESSONS.findIndex((l) => l.slug === slug);
  if (idx <= 0) return undefined;
  return LESSONS[idx - 1];
}
