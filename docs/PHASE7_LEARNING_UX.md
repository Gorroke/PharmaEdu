# PHASE7_LEARNING_UX.md — 단계별 학습 UX 스펙

> **작성**: Learning UX Designer (Expert #3)
> **작성일**: 2026-04-06
> **대상**: Phase 7B (라우팅/레이아웃), 7C (인터랙티브 컴포넌트), 7D (진도 시스템) 개발팀
> **전제**: DESIGN_SYSTEM.md v1.0 준수 / Tailwind 4 / Next.js App Router

---

## 목차

1. [공통 규칙](#1-공통-규칙)
2. [`/learn` — 커리큘럼 오버뷰](#2-learn--커리큘럼-오버뷰)
3. [`/learn/lesson/[slug]` — 레슨 뷰어](#3-learnlessonslug--레슨-뷰어)
4. [인터랙티브 컴포넌트 스펙](#4-인터랙티브-컴포넌트-스펙)
5. [진도 시스템 스펙](#5-진도-시스템-스펙)
6. [반응형 전략](#6-반응형-전략)
7. [접근성 체크리스트](#7-접근성-체크리스트)
8. [ASCII 와이어프레임](#8-ascii-와이어프레임)
9. [컴포넌트 매핑 레퍼런스](#9-컴포넌트-매핑-레퍼런스)

---

## 1. 공통 규칙

Phase 6 UX 스펙 (`PHASE6_UX_SPECS.md`)의 공통 규칙을 그대로 상속한다.

| 항목 | 기준 |
|------|------|
| 컨테이너 | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |
| 페이지 배경 | `bg-[#F5F7FA]` (`bg-bg-page`) |
| 카드 배경 | `bg-white` |
| 브레이크포인트 | 모바일 `<640px` / 태블릿 `640–1023px` / 데스크탑 `≥1024px` |
| 포커스 링 | `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2` |
| 애니메이션 | 카드 호버: `transition-all duration-200 -translate-y-1` |
| 로딩 상태 | `<Skeleton />` 컴포넌트 사용 |

### 학습 전용 컬러 시멘틱

| 상태 | 컬러 토큰 | HEX | 용도 |
|------|----------|-----|------|
| 완료 (completed) | success | `#13DEB9` / `#E6FFFA` | 완료된 레슨 노드, 배지 |
| 현재 (current) | primary | `#5D87FF` / `#ECF2FF` | 진행 중 레슨 노드 |
| 잠김 (locked) | neutral | `#7C8FAC` / `#F2F6FA` | 잠긴 레슨 노드 |
| 진행 중 (in-progress) | warning | `#FFAE1F` / `#FEF5E5` | 시작했지만 미완료 |

---

## 2. `/learn` — 커리큘럼 오버뷰

> **담당**: Phase 7B
> **파일**: `src/app/learn/page.tsx`

### 2.1 목적

학습자가 전체 10개 레슨 커리큘럼을 한눈에 파악하고, 현재 위치를 확인하며, 다음 행동(레슨 시작/재개)을 결정한다.

### 2.2 페이지 구조 (섹션 순서)

```
① <LearnHero />         — 진도 요약 히어로
② <CourseMap />         — 코스 맵 시각화 (3트랙 × 노드)
③ <LessonCardList />    — 레슨 상세 카드 목록
④ <ReferenceLinks />    — 원본 명세서 링크 섹션
```

---

### 2.3 섹션 ① — LearnHero (진도 요약)

#### 레이아웃
```
배경: primary-600 → primary-500 그라데이션 (왼쪽 → 오른쪽)
패딩: py-12 px-6 (데스크탑: py-16)
텍스트: text-on-primary (white)
Border radius: rounded-2xl (카드 형태로 컨테이너 안에 배치)
```

#### 내부 구성

왼쪽 블록 (flex-1):
- `<Trophy w-8 h-8 text-yellow-300 />` + 제목 "나의 학습 현황"  (`text-2xl font-bold`)
- 부제: "약제비 계산 마스터 과정" (`text-base opacity-80`)
- `<Button variant="primary" size="lg">` — 현재 레슨 계속하기 / 학습 시작하기

오른쪽 블록 (데스크탑 flex-row, 모바일 그리드 3열):
세 가지 스탯 카드 (bg-white/20 rounded-xl p-4):
```
[진도율]         [완료 레슨]       [남은 시간]
  72%              7 / 10            45분
"전체 진도"      "완료한 레슨"     "예상 잔여"
```
- 숫자: `text-3xl font-extrabold`
- 레이블: `text-sm opacity-70`

#### 상태 조건

| 상태 | 조건 | CTA 텍스트 |
|------|------|-----------|
| 첫 방문 | `currentLesson === null` | "학습 시작하기" (Lesson 1로 이동) |
| 진행 중 | `currentLesson` 있음 | "Lesson N 계속하기" |
| 전체 완료 | 10개 모두 completed | "복습하기" (Trophy 아이콘 강조) |

---

### 2.4 섹션 ② — CourseMap (코스 맵 시각화)

#### 레이아웃
```
배경: bg-white
Border radius: rounded-2xl
그림자: shadow-sm
패딩: p-6 (데스크탑: p-8)
```

#### 3트랙 구조

```
트랙 헤더:
  [기초 트랙]     [중급 트랙]     [심화 트랙]
  Lesson 1~3     Lesson 4~7     Lesson 8~10
  badge: neutral  badge: primary  badge: warning
```

각 트랙은 `<div class="track-section">` 으로 구분.
트랙 헤더 레이블:
- `text-xs font-semibold uppercase tracking-wider`
- 기초: `text-neutral-500 bg-neutral-100`
- 중급: `text-primary-600 bg-primary-100`
- 심화: `text-warning-600 bg-warning-100`

#### 레슨 노드 (LessonNode)

각 레슨은 원형 노드로 표현:

```
완료 (completed):
  원: w-12 h-12, bg-success-500 (#13DEB9), text-white
  아이콘: <CheckCircle2 w-6 h-6 />
  링: ring-4 ring-success-500/20

현재 (current / in-progress):
  원: w-14 h-14 (slightly larger), bg-primary-500 (#5D87FF), text-white
  아이콘: <BookOpen w-6 h-6 />
  링: ring-4 ring-primary-500/30
  애니메이션: animate-pulse (ring만 pulse)

잠김 (locked):
  원: w-12 h-12, bg-neutral-200 (#EAEFF4), text-neutral-400
  아이콘: <Lock w-5 h-5 />
  커서: cursor-not-allowed
  tooltip: "이전 레슨을 완료하면 잠금 해제됩니다"
```

노드 아래 텍스트:
- 레슨 번호: `text-xs text-muted`
- 레슨 제목 (단축): `text-sm font-medium text-primary` (최대 2줄, truncate)

#### 연결선 (Progress Line)

노드 사이를 잇는 선:
```
완료 구간: bg-success-500, h-1 (가로 연결)
미완료 구간: bg-neutral-200, h-1, border-dashed
현재 진행 구간: gradient success-500 → neutral-200
```

데스크탑 레이아웃:
```
[노드1]──[노드2]──[노드3]    [노드4]──...──[노드7]    [노드8]──[노드9]──[노드10]
      기초 트랙                    중급 트랙                  심화 트랙
```

모바일 레이아웃: 수직 스택 (각 트랙 내 노드도 세로 배치)

#### 인터랙션

- 완료/현재 노드: 클릭 → `/learn/lesson/[slug]` 이동
- 잠긴 노드: 클릭 → Toast "이전 레슨을 완료해야 잠금 해제됩니다" (warning)
- 노드 hover: 레슨 제목 툴팁 + 예상시간 표시

---

### 2.5 섹션 ③ — LessonCardList (레슨 카드 목록)

#### 카드 그리드
```
모바일: grid-cols-1
태블릿: grid-cols-2
데스크탑: grid-cols-3
gap: gap-4
```

#### 레슨 카드 (LessonCard)

컴포넌트: `<Card variant="elevated">`

```
┌─────────────────────────────┐
│ [트랙 배지]  [상태 배지]      │  ← px-6 pt-6
│                              │
│ Lesson 3                     │  ← text-xs text-muted
│ 약품금액 계산 기초             │  ← text-lg font-bold text-primary
│ 단가 × 수량 × 횟수 × 일수    │  ← text-sm text-secondary mt-1
│                              │
│ ────────────────────────────  │  ← border-t mt-4
│ ⏱ 20분    📚 7개 핵심개념    │  ← px-6 py-4 text-xs text-muted
│                              │
│ [계속하기 →]                 │  ← px-6 pb-6
└─────────────────────────────┘
```

**상태 배지 스펙:**

| 상태 | 컴포넌트 | 텍스트 |
|------|----------|--------|
| completed | `<Badge variant="success">` | "완료 ✓" |
| in-progress | `<Badge variant="warning">` | "학습 중" |
| unlocked | `<Badge variant="primary">` | "시작 가능" |
| locked | `<Badge variant="neutral">` | "잠김" |

**트랙 배지:**

| 트랙 | 컬러 | 텍스트 |
|------|------|--------|
| 기초 (1~3) | `<Badge variant="neutral">` | "기초" |
| 중급 (4~7) | `<Badge variant="primary">` | "중급" |
| 심화 (8~10) | `<Badge variant="warning">` | "심화" |

**CTA 버튼:**

| 상태 | 버튼 | 동작 |
|------|------|------|
| completed | `<Button variant="ghost">` "복습하기" | 레슨 뷰어 이동 |
| in-progress | `<Button variant="primary">` "계속하기 →" | 레슨 뷰어 이동 |
| unlocked | `<Button variant="primary">` "시작하기 →" | 레슨 뷰어 이동 |
| locked | `<Button variant="secondary" disabled>` "잠김" | 비활성 |

**잠긴 카드 전체 스타일:**
```
opacity-60
filter: grayscale(30%)
hover: 호버 효과 없음
cursor-not-allowed (카드 전체)
```

---

### 2.6 섹션 ④ — ReferenceLinks (원본 명세서 링크)

```
배경: bg-primary-50 (#F0F5FF)
Border radius: rounded-xl
패딩: p-6
border: 1px solid border-light
```

제목: "원본 명세서 참조" + `<BookOpen w-5 h-5 text-primary-500 />` (`text-base font-semibold`)

링크 목록 (이 목록은 Phase 7A 콘텐츠 팀이 정의한 챕터를 사용):
```
• CH00 — 계산 엔진 입력 개요    [→ 챕터 보기]
• CH01 — 약품금액 계산          [→ 챕터 보기]
• CH02 — 조제료                 [→ 챕터 보기]
• CH05 — 본인부담금             [→ 챕터 보기]
• CH07 — 반올림 규칙            [→ 챕터 보기]
```

링크 스타일: `text-sm text-primary-600 hover:text-primary-700 hover:underline`

---

## 3. `/learn/lesson/[slug]` — 레슨 뷰어

> **담당**: Phase 7B
> **파일**: `src/app/learn/lesson/[slug]/page.tsx`

### 3.1 목적

개별 레슨 콘텐츠를 읽고, 인터랙티브 요소로 개념을 실습하며, 지식 체크를 통과해 다음 레슨을 언락한다.

### 3.2 전체 레이아웃

#### 데스크탑 (≥1024px)

```
┌──────────────────────────────────────────────────────────┐
│                  <Header /> (sticky, z-50)               │
├──────────────┬──────────────────────────┬────────────────┤
│              │                          │                │
│  <Lesson     │   <LessonContent />      │  <NextStep     │
│   Sidebar /> │   (본문 콘텐츠)           │   Panel />     │
│              │                          │                │
│  w-64        │   flex-1 max-w-[768px]   │  w-72          │
│  (좌측 고정) │                          │  (우측 sticky) │
│              │                          │                │
└──────────────┴──────────────────────────┴────────────────┘
```

#### 모바일 (<640px)

```
┌────────────────────────────────┐
│ <Header />                     │
├────────────────────────────────┤
│ <LessonProgressBar />  3/5 ▓▓▓▒▒ │  ← sticky, 상단 고정
├────────────────────────────────┤
│                                │
│   <LessonContent />            │
│   (본문 콘텐츠 풀 너비)          │
│                                │
├────────────────────────────────┤
│ <MobileBottomNav />            │  ← fixed bottom, z-40
│ [← 이전]  [목차 ≡]  [다음 →]  │
└────────────────────────────────┘
```

---

### 3.3 LessonSidebar (좌측 사이드바)

```
너비: w-64 (256px)
배경: bg-white
border-right: 1px solid border-light
position: sticky, top-16 (헤더 높이 아래)
height: calc(100vh - 64px)
overflow-y: auto
패딩: p-4
```

#### 내부 구조

**① 레슨 목록 TOC** (전체 레슨 네비게이션)

```
섹션 레이블: "레슨 목록" (text-xs font-semibold uppercase tracking-wider text-muted)

각 레슨 아이템:
  패딩: px-3 py-2, rounded-lg
  현재: bg-primary-50, text-primary-700, font-semibold
  완료: text-success-600, [CheckCircle2 w-4 h-4]
  잠김: text-muted, [Lock w-4 h-4], cursor-not-allowed
  미방문: text-secondary, [CircleDashed w-4 h-4]

아이콘 + 번호 + 제목 (truncate) 1줄 구성
```

**② 현재 레슨 내 섹션 TOC** (자동 생성)

본문 `<h2>`, `<h3>` 태그에서 자동 추출.

```
섹션 레이블: "이 레슨의 목차" (mt-6 mb-2, text-xs font-semibold text-muted)

각 항목: text-sm text-secondary hover:text-primary
  h2: pl-3 (들여쓰기 없음)
  h3: pl-6 (들여쓰기)
  활성 항목 (스크롤 추적): text-primary-600, font-medium
    left-border: border-l-2 border-primary-500
```

Intersection Observer API로 스크롤 위치에 따라 활성 항목 자동 업데이트.

---

### 3.4 LessonHeader (레슨 상단 정보)

```
배경: bg-white
border-bottom: 1px solid border-light
패딩: px-6 py-5
```

```
┌─────────────────────────────────────────────────────┐
│  [기초] [20분]  [★★☆ 중급]                          │  ← 배지 행
│                                                     │
│  Lesson 3 — 약품금액 계산 기초                       │  ← text-2xl font-bold
│  단가 × 수량 × 횟수 × 일수, 그리고 반올림             │  ← text-base text-secondary mt-1
│                                                     │
│  ▓▓▓▓▓▓▓▓░░░░  60% 읽음                            │  ← readPercent 진도바
└─────────────────────────────────────────────────────┘
```

**배지 상세:**

| 배지 | 컴포넌트 | 내용 |
|------|----------|------|
| 트랙 | `<Badge variant="neutral">` | "기초" / "중급" / "심화" |
| 예상시간 | `<Badge variant="info">` | "⏱ 20분" |
| 난이도 | `<Badge variant="primary">` | 별점 아이콘 1~3개 (★☆☆/★★☆/★★★) |

**읽기 진도바:**

```
컴포넌트: <progress> 또는 커스텀 div
높이: h-1.5
배경: bg-neutral-200
진도: bg-primary-500, transition-all duration-300
너비: readPercent%
```

스크롤 이벤트로 `readPercent` 업데이트 → localStorage에 저장.

---

### 3.5 LessonContent (본문 콘텐츠 영역)

```
max-width: max-w-[768px] mx-auto
패딩: px-6 py-8
```

#### 마크다운 렌더링 스타일

```css
/* prose 클래스 기반, Tailwind Typography 플러그인 사용 권장 */
h1: text-3xl font-bold text-primary mt-10 mb-4
h2: text-2xl font-bold text-primary mt-8 mb-3 pb-2 border-b border-border-light
h3: text-xl font-semibold text-primary mt-6 mb-2
p:  text-base leading-relaxed text-[#2A3547] mb-4
ul/ol: pl-6 mb-4 space-y-1
li: text-base leading-relaxed
code (inline): bg-neutral-100 text-primary-700 px-1.5 py-0.5 rounded text-sm font-mono
pre (block): bg-[#1E2A3A] text-neutral-100 rounded-xl p-4 overflow-x-auto text-sm
table: w-full border-collapse text-sm
th: bg-neutral-100 text-primary font-semibold px-4 py-2 text-left border border-border-light
td: px-4 py-2 border border-border-light
blockquote: border-l-4 border-primary-300 pl-4 text-secondary italic
strong: font-semibold text-primary
```

#### 인터랙티브 요소 삽입 영역

마크다운 파일 안에 MDX 컴포넌트 형태로 삽입:

```mdx
<InlineCalculator preset="preset_drug_calc_3items" />
<KnowledgeCheck questions={[...]} />
<CourseProgress current={3} total={5} />
<ConceptCard term="4사5입" definition="원 미만 반올림 규칙..." />
```

각 컴포넌트는 Section 4에서 상세 스펙 정의.

---

### 3.6 KnowledgeCheck 통과 후 — NextLesson 언락 UI

레슨 본문 최하단에 위치. 지식 체크 통과 여부에 따라 두 가지 상태:

**통과 전 (잠김):**

```
┌────────────────────────────────────────┐
│  🔒 지식 체크를 완료하면               │
│     다음 레슨이 열립니다               │
│                                        │
│  [지식 체크 풀기 ↓]                    │
└────────────────────────────────────────┘
배경: bg-neutral-50, border: 1px solid border-light, rounded-xl, p-6
텍스트: text-muted
버튼: anchor 링크 (페이지 내 KnowledgeCheck 위치로 스크롤)
```

**통과 후 (언락):**

```
┌────────────────────────────────────────┐
│  ✅ Lesson 3 완료!                     │
│  약품금액 계산 기초를 마스터했습니다.   │
│                                        │
│  다음: Lesson 4 — 조제료 이해하기      │
│  [다음 레슨 시작하기 →]               │  ← Button primary large
└────────────────────────────────────────┘
배경: bg-success-50 (#E6FFFA)
border: 1px solid #13DEB9
rounded-xl p-6
제목: text-success-700 font-bold text-lg
설명: text-success-600 text-sm mt-1
```

**마지막 레슨(Lesson 10) 완료 시:**

```
┌────────────────────────────────────────┐
│  🏆 전체 커리큘럼 완료!                │
│  약제비 계산 마스터 과정을             │
│  완료하셨습니다.                        │
│                                        │
│  [학습 현황 보기]  [처음부터 복습]     │
└────────────────────────────────────────┘
배경: primary-600 그라데이션, text-white
Trophy 아이콘: w-12 h-12 text-yellow-300
```

---

### 3.7 NextStepPanel (우측 고정 패널, 데스크탑 전용)

```
너비: w-72
position: sticky, top-24
패딩: p-4
```

**① 이 레슨 진도** (`<CourseProgress />`)

```
"이 레슨 진도" 레이블 (text-xs text-muted)
3 / 5 스텝 완료
[▓▓▓░░] 진도바 (h-2, rounded-full)
```

**② 다음 행동 CTA**

지식 체크 미통과:
```
<Button variant="secondary" full-width>
  지식 체크 풀기
  [아래 화살표 아이콘]
</Button>
```

지식 체크 통과:
```
<Button variant="primary" full-width size="lg">
  다음 레슨 →
  Lesson 4: 조제료 이해하기
</Button>
```

**③ 현재 레슨 메타 요약**

```
⏱ 예상 20분 남음
📖 읽기 진도: 45%
✅ 핵심 개념 7개
```
`text-xs text-muted`, 각 줄 아이콘 + 텍스트

---

### 3.8 MobileBottomNav (모바일 하단 네비)

```
position: fixed, bottom-0, left-0, right-0
height: h-16 (64px)
배경: bg-white
border-top: 1px solid border-light
그림자: shadow-[0_-4px_16px_rgba(0,0,0,0.08)]
z-index: z-40
padding: px-4
```

```
[← 이전 레슨]     [목차 ≡]     [다음 레슨 →]
  text-sm          아이콘만       text-sm
  ghost btn        icon btn       primary btn (잠금 시 disabled)
```

"목차 ≡" 클릭 → 레슨 목록 Bottom Sheet 오픈 (Modal 컴포넌트 활용, `rounded-t-2xl`)

---

## 4. 인터랙티브 컴포넌트 스펙

> **담당**: Phase 7C
> **파일 경로**: `src/components/learning/`

---

### 4.1 `<InlineCalculator />` — 임베디드 계산기

**Props:**

```typescript
interface InlineCalculatorProps {
  preset: string;            // 프리셋 키 (PHASE7_LEARNING_PLAN 참조)
  title?: string;            // 기본: "실습 계산기"
  description?: string;      // 학습 맥락 설명
  readOnly?: boolean;        // true면 결과 보여주기만
}
```

**UI 구조:**

```
┌─────────────────────────────────────────────────────┐
│  🧮 실습 계산기                        [접기 ▲]     │  ← 헤더
│  "아래 값을 조작해 계산 결과를 확인하세요"           │
├─────────────────────────────────────────────────────┤
│  [기존 CalcForm 컴포넌트 임베드 — 프리셋 주입]       │  ← 본문
│  (Phase 6의 계산기 UI를 재사용)                     │
├─────────────────────────────────────────────────────┤
│  [계산하기]                   [초기값으로 리셋]      │  ← 푸터
└─────────────────────────────────────────────────────┘
배경: bg-primary-50
border: 1px solid border-medium
rounded-2xl
margin: my-8 (레슨 본문 안에서 여백 확보)
```

**상태:**
- 기본: 헤더만 표시, 본문 접혀있음 (`collapsed`)
- 클릭 시: 펼치기 (`expanded`), `transition-all duration-300`
- 기본 펼침으로 `defaultExpanded` prop 지원

---

### 4.2 `<KnowledgeCheck />` — 지식 체크 퀴즈

**Props:**

```typescript
interface KnowledgeCheckProps {
  lessonSlug: string;        // 연결된 레슨 식별자
  questions: QuizQuestion[]; // 1~3개 미니 퀴즈
  onPass: () => void;        // 통과 시 콜백 (다음 레슨 언락 트리거)
}

interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank';
  question: string;
  options?: string[];        // multiple-choice 전용
  answer: string | number;
  explanation: string;       // 정답/오답 해설
}
```

**UI 흐름:**

```
[1단계] 퀴즈 카드 표시
  ┌────────────────────────────────────┐
  │  지식 체크 1/3                     │  ← 진도 표시
  │                                    │
  │  Q. 약품금액 기본 공식은?           │  ← text-base font-semibold
  │                                    │
  │  ○ 단가 × 일수                    │
  │  ● 단가 × 수량 × 횟수 × 일수      │  ← 라디오 버튼 목록
  │  ○ 단가 × 100                     │
  │  ○ 단가만                         │
  │                                    │
  │  [확인]                            │  ← 선택 전 비활성, 선택 후 활성
  └────────────────────────────────────┘

[2단계] 즉시 피드백
  정답: 정답 보기 bg-success-50, border-success, 체크 아이콘
        "정답입니다! [해설 텍스트]"
  오답: 오답 보기 bg-error-50, border-error, X 아이콘
        선택지 중 정답 강조 (success 색상)
        "다시 시도해보세요" or "틀렸습니다. [해설]"
  
  [다음 문제] 버튼 → 다음 퀴즈 or 결과 화면

[3단계] 결과 화면
  전체 통과 (모두 정답 or 설정된 통과 기준 충족):
    "✅ 지식 체크 통과! 다음 레슨이 열렸습니다."
    → onPass() 호출 → localStorage 업데이트 → UI 업데이트
  
  미통과:
    "다시 도전해보세요. [재시도]"
    재시도 횟수 제한 없음
```

**스타일:**
```
전체 컨테이너: bg-white border border-border-light rounded-2xl p-6 shadow-sm my-8
진도 배지: text-xs text-muted mb-4
질문: text-base font-semibold text-primary mb-4
라디오 옵션: px-4 py-3 rounded-lg border cursor-pointer
  기본: border-border-light hover:border-primary-300 hover:bg-primary-50
  선택됨: border-primary-500 bg-primary-50 text-primary-700
  정답 확인 후 정답: border-success bg-success-50
  정답 확인 후 오답 선택: border-error bg-error-50
```

---

### 4.3 `<CourseProgress />` — 레슨 내 스텝 진도

**Props:**

```typescript
interface CourseProgressProps {
  current: number;   // 현재 완료된 스텝 수
  total: number;     // 전체 스텝 수
  labels?: string[]; // 각 스텝 레이블 (선택)
}
```

**UI:**

```
  스텝 1    스텝 2    스텝 3    스텝 4    스텝 5
  ●━━━━━━━━━●━━━━━━━━━●━━━━━━━━━○─────────○
 (완료)    (완료)    (현재)             (미완료)

"3 / 5 스텝 완료"
```

- 완료 스텝: `bg-success-500` 원 + 실선
- 현재 스텝: `bg-primary-500` 원 (약간 크게, ring pulse)
- 미완료: `bg-neutral-300` 원 + 점선

모바일에서는 진도바 형태로만 표시 (스텝 원 숨김):
```
[▓▓▓░░] 3 / 5
```

---

### 4.4 `<ConceptCard />` — 핵심 개념 강조 카드

**Props:**

```typescript
interface ConceptCardProps {
  term: string;          // 개념 용어
  definition: string;    // 설명
  example?: string;      // 예시 (선택)
  relatedTerms?: string[]; // 연관 개념 (선택)
  icon?: LucideIcon;     // 아이콘 (선택, 기본: BookOpen)
}
```

**UI:**

```
┌────────────────────────────────────────┐
│  📖  핵심 개념                          │  ← 헤더 (bg-primary-500 text-white rounded-t-xl px-4 py-2)
├────────────────────────────────────────┤
│                                        │
│  4사5입 (round_half_up)                │  ← term: text-xl font-bold text-primary
│                                        │
│  원 미만의 소수점을 반올림하는 규칙.    │  ← definition: text-base text-secondary
│  0.5 이상이면 올림, 미만이면 내림.     │
│                                        │
│  예시: 125.5원 → 126원                 │  ← example: bg-neutral-50 rounded p-3 text-sm font-mono
│                                        │
│  연관 개념: [Trunc10] [Floor100]       │  ← relatedTerms: Chip 스타일
└────────────────────────────────────────┘
배경: bg-white
border: 1px solid border-light
rounded-xl
margin: my-6
그림자: shadow-sm
```

---

## 5. 진도 시스템 스펙

> **담당**: Phase 7D
> **파일**: `src/lib/learning/progress.ts`

### 5.1 localStorage 데이터 구조

키: `pharmaedu_learning_progress`

```typescript
interface LearningProgress {
  lessons: {
    [slug: string]: LessonProgress;
  };
  currentLesson: string | null;   // 현재 진행 중인 레슨 slug
  totalMinutes: number;            // 누적 학습 시간 (분)
  lastUpdated: number;             // Unix timestamp (ms)
}

interface LessonProgress {
  status: 'locked' | 'unlocked' | 'in-progress' | 'completed';
  readPercent: number;             // 0~100, 스크롤 깊이 기반
  quizPassed: boolean;
  lastVisited: number;             // Unix timestamp (ms)
  timeSpent?: number;              // 이 레슨에 쓴 분 수 (선택)
}
```

### 5.2 초기 상태

```typescript
const INITIAL_PROGRESS: LearningProgress = {
  lessons: {
    'lesson-01-what-is-yakjaebi': {
      status: 'unlocked',    // Lesson 1은 선수 없음 → 초기에 언락
      readPercent: 0,
      quizPassed: false,
      lastVisited: 0,
    },
    'lesson-02-prescription-components': { status: 'locked', ... },
    'lesson-03-drug-amount-basics':       { status: 'locked', ... },
    // ... 이하 동일
  },
  currentLesson: null,
  totalMinutes: 0,
  lastUpdated: Date.now(),
};
```

### 5.3 언락 규칙

```
Lesson N+1 언락 조건:
  lessons[slugN].quizPassed === true
  → lessons[slugN+1].status = 'unlocked'
```

**예외 — Lesson 8 (선수: Lesson 3 + Lesson 6):**
```
lessons['lesson-03-...'].quizPassed &&
lessons['lesson-06-...'].quizPassed
→ lessons['lesson-08-...'].status = 'unlocked'
```

**예외 — Lesson 6 (선수: Lesson 4 + Lesson 5):**
```
lessons['lesson-04-...'].quizPassed &&
lessons['lesson-05-...'].quizPassed
→ lessons['lesson-06-...'].status = 'unlocked'
```

### 5.4 진도 업데이트 함수 (인터페이스)

```typescript
// src/lib/learning/progress.ts

export function getProgress(): LearningProgress
export function saveProgress(progress: LearningProgress): void

// 레슨 시작 시
export function markLessonStarted(slug: string): void

// 스크롤 이벤트 → readPercent 업데이트 (throttle 300ms 권장)
export function updateReadPercent(slug: string, percent: number): void

// 퀴즈 통과 시 (KnowledgeCheck의 onPass 내부에서 호출)
export function markQuizPassed(slug: string): void
  // 내부에서 unlockNextLesson(slug) 자동 호출

// 선수 레슨 확인 후 다음 레슨 언락
function unlockNextLesson(completedSlug: string): void

// 전체 진도 통계 계산
export function calcStats(): {
  completedCount: number;     // quizPassed === true 인 레슨 수
  progressPercent: number;    // completedCount / 10 * 100
  remainingMinutes: number;   // 미완료 레슨의 예상시간 합계
}
```

### 5.5 상태 파생 로직

```typescript
// status 파생 우선순위
function deriveStatus(lesson: LessonProgress): VisualStatus {
  if (lesson.quizPassed)         return 'completed';
  if (lesson.status === 'locked') return 'locked';
  if (lesson.readPercent > 0)    return 'in-progress';
  return 'unlocked';
}
```

### 5.6 React Hook

```typescript
// src/hooks/useLearningProgress.ts

export function useLearningProgress() {
  // localStorage에서 읽어 state로 관리
  // 컴포넌트 내에서 progress, stats, updateReadPercent, markQuizPassed 등 제공
  return {
    progress: LearningProgress,
    stats: { completedCount, progressPercent, remainingMinutes },
    markLessonStarted,
    updateReadPercent,
    markQuizPassed,
    isLessonAccessible: (slug: string) => boolean,
  };
}
```

---

## 6. 반응형 전략

### 6.1 브레이크포인트별 레이아웃 변화

| 화면 | `/learn` | `/learn/lesson/[slug]` |
|------|----------|----------------------|
| 모바일 (<640px) | 1열 카드, 코스맵 세로 스택 | 진도바 상단, 사이드바 숨김+토글, 하단 네비 |
| 태블릿 (640~1023px) | 2열 카드, 코스맵 2트랙 표시 | 사이드바 오버레이 (슬라이드인), 우측 패널 숨김 |
| 데스크탑 (≥1024px) | 3열 카드, 코스맵 3트랙 가로 | 사이드바 고정, 우측 NextStep 패널 표시 |

### 6.2 모바일 사이드바 토글

레슨 뷰어 모바일에서 사이드바 숨김:

```
헤더 우측에 "목차 ≡" 아이콘 버튼 (IconButton)
클릭 시: 오버레이 + 사이드바 슬라이드인 (왼쪽에서)
  배경: bg-[#2A3547] (DESIGN_SYSTEM Sidebar 색상)
  오버레이: bg-black/50 z-30
  사이드바: z-40, translate-x-0 (열림) / translate-x-[-100%] (닫힘)
  transition-transform duration-300
닫기: 오버레이 클릭 or X 버튼
```

---

## 7. 접근성 체크리스트

### 7.1 키보드 네비게이션

| 요소 | 키보드 동작 |
|------|------------|
| 레슨 노드 (CourseMap) | Tab 이동, Enter/Space = 클릭 |
| 레슨 카드 | Tab 이동, Enter = 레슨 이동 |
| KnowledgeCheck 옵션 | Tab 이동, Enter/Space = 선택 |
| MobileBottomNav 버튼 | Tab 이동, Enter = 클릭 |
| 사이드바 TOC 링크 | Tab 이동, Enter = 스크롤 이동 |

### 7.2 ARIA 레이블

```html
<!-- CourseMap 노드 -->
<button
  role="button"
  aria-label="Lesson 3: 약품금액 계산 기초 — 완료됨"
  aria-disabled={isLocked}
>

<!-- KnowledgeCheck 라디오 그룹 -->
<fieldset>
  <legend>질문 1/3: 약품금액 기본 공식은?</legend>
  <input type="radio" aria-label="단가 × 수량 × 횟수 × 일수" />
</fieldset>

<!-- 진도바 -->
<div
  role="progressbar"
  aria-valuenow={readPercent}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="읽기 진도"
/>

<!-- 레슨 상태 배지 (스크린 리더용 숨김 텍스트) -->
<Badge>완료 <span class="sr-only">상태</span></Badge>
```

### 7.3 포커스 링

모든 인터랙티브 요소:
```css
focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
```

잠긴 노드/버튼 — 포커스는 받되 동작 없음 (`aria-disabled="true"`, `tabindex="0"`).

### 7.4 화면 읽기 친화 제목 구조

```
<h1> — 페이지 제목 (Lesson N: [제목])
  <h2> — 주요 섹션
    <h3> — 하위 섹션
```

한 페이지에 `<h1>` 단 1개. 마크다운 렌더러에서 `#` → `<h2>`, `##` → `<h3>`로 매핑 권장 (레슨 제목이 이미 `<h1>`이므로).

---

## 8. ASCII 와이어프레임

### 8.1 `/learn` — 데스크탑

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🏥 PharmaEdu     학습  계산기  퀴즈  데일리                      [로그인] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  🏆 나의 학습 현황              [72%]  [7/10]  [45분]           │   │
│  │  약제비 계산 마스터 과정         완료   레슨   남음               │   │
│  │  [Lesson 8 계속하기 →]                                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  코스 맵                                                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  [기초]                [중급]                  [심화]            │   │
│  │                                                                  │   │
│  │  ✅1 ━━ ✅2 ━━ ✅3    ✅4 ━━ ✅5 ━━ ✅6 ━━ ✅7  🔵8 ─── ⬜9 ─── ⬜10│   │
│  │  약제비  처방전 약품금액  조제료  가산  본인부담  보험  반올림  특수  종합│   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  레슨 목록                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ [기초] [완료✓] │  │ [기초] [완료✓] │  │ [기초] [완료✓] │            │
│  │ Lesson 1       │  │ Lesson 2       │  │ Lesson 3       │            │
│  │ 약제비란       │  │ 처방전의       │  │ 약품금액       │            │
│  │ 무엇인가?      │  │ 구성요소       │  │ 계산 기초      │            │
│  │ ────────────── │  │ ────────────── │  │ ────────────── │            │
│  │ ⏱15분  핵심6개│  │ ⏱20분  핵심8개│  │ ⏱20분  핵심7개│            │
│  │ [복습하기]     │  │ [복습하기]     │  │ [복습하기]     │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ [중급] [완료✓] │  │ [중급] [학습중]│  │ [심화] [잠김]  │            │
│  │ Lesson 4       │  │ Lesson 8       │  │ Lesson 9       │            │
│  │ 조제료 이해하기│  │ 반올림과 절사  │  │ 특수 케이스    │            │
│  │ ...            │  │ ...            │  │ ...            │            │
│  │ [복습하기]     │  │ [계속하기 →]   │  │ [잠김]        │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  📖 원본 명세서 참조                                             │   │
│  │  CH00 계산 엔진 입력 개요  [→]   CH01 약품금액 계산  [→]        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

### 8.2 `/learn/lesson/[slug]` — 데스크탑

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🏥 PharmaEdu     학습  계산기  퀴즈  데일리                      [로그인] │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
├──────────────────┬──────────────────────────────┬────────────────────────┤
│                  │                              │                        │
│  레슨 목록       │  [기초] [⏱20분] [★★☆]       │  이 레슨 진도          │
│  ──────────────  │  Lesson 3                    │  3 / 5 스텝            │
│  ✅ Lesson 1     │  약품금액 계산 기초            │  [▓▓▓░░]              │
│  ✅ Lesson 2     │  단가×수량×횟수×일수          │                        │
│  🔵 Lesson 3 ←  │  ▓▓▓▓▓▓░░░░ 60% 읽음         │  [지식 체크 풀기 ↓]    │
│  ✅ Lesson 4     │  ──────────────────────────  │                        │
│  ✅ Lesson 5     │                              │  ─────────────────     │
│  ✅ Lesson 6     │  ## 기본 공식                │  ⏱ 예상 8분 남음       │
│  ✅ Lesson 7     │                              │  📖 읽기: 60%          │
│  🔵 Lesson 8 ←  │  약품금액 = 단가 × 1회량     │  ✅ 핵심개념 7개        │
│  🔒 Lesson 9     │  × 1일횟수 × 투약일수       │                        │
│  🔒 Lesson 10    │                              │                        │
│                  │  <ConceptCard               │                        │
│  ──────────────  │    term="4사5입" />          │                        │
│  이 레슨 목차    │                              │                        │
│  > 기본 공식 ←  │  ## 예제로 보는 계산         │                        │
│    예제 계산    │                              │                        │
│    급여/비급여  │  <InlineCalculator           │                        │
│    실습         │    preset="preset_drug..." />│                        │
│                  │                              │                        │
│                  │  ## 지식 체크                │                        │
│                  │                              │                        │
│                  │  <KnowledgeCheck ... />      │                        │
│                  │                              │                        │
│                  │  ┌──────────────────────┐   │                        │
│                  │  │ ✅ Lesson 3 완료!     │   │                        │
│                  │  │ [다음 레슨 시작하기→] │   │                        │
│                  │  └──────────────────────┘   │                        │
│                  │                              │                        │
└──────────────────┴──────────────────────────────┴────────────────────────┘
```

---

### 8.3 모바일 버전 (`/learn` + `/learn/lesson/[slug]`)

**`/learn` 모바일:**

```
┌──────────────────────────┐
│ 🏥 PharmaEdu    [≡]     │  ← 헤더 h-14
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ 🏆 학습 현황         │ │  ← Hero 카드
│ │ 72%  7/10  45분      │ │
│ │ [Lesson 8 계속하기→] │ │
│ └──────────────────────┘ │
│                          │
│ 코스 맵                  │
│ ┌──────────────────────┐ │
│ │ [기초]               │ │
│ │ ✅1 ━ ✅2 ━ ✅3     │ │
│ │ [중급]               │ │
│ │ ✅4 ━ ✅5 ━ ✅6 ━ ✅7│ │
│ │ [심화]               │ │
│ │ 🔵8 ─ ⬜9 ─ ⬜10   │ │
│ └──────────────────────┘ │
│                          │
│ Lesson 1     [완료✓]    │
│ 약제비란 무엇인가?        │
│ ⏱15분                   │
│ [복습하기]               │
│ ─────────────────────── │
│ Lesson 8     [학습중]   │
│ 반올림과 절사의 정밀함    │
│ ⏱20분                   │
│ [계속하기 →]             │
│ ─────────────────────── │
│ Lesson 9     [잠김🔒]   │
│ 특수 케이스              │
│ [잠김]                   │
└──────────────────────────┘
```

**`/learn/lesson/[slug]` 모바일:**

```
┌──────────────────────────┐
│ 🏥 PharmaEdu  [목차≡]   │  ← 헤더
├──────────────────────────┤
│ ▓▓▓▓▓▓░░░░  3/5 스텝    │  ← 진도바 (sticky)
├──────────────────────────┤
│ [기초] [⏱20분] [★★☆]  │
│ Lesson 3                 │
│ 약품금액 계산 기초        │
│ ──────────────────────── │
│                          │
│ ## 기본 공식             │
│                          │
│ 약품금액 = 단가 × ...    │
│                          │
│ ┌──────────────────────┐ │
│ │ 📖 핵심 개념: 4사5입 │ │
│ │ 원 미만 반올림 규칙  │ │
│ └──────────────────────┘ │
│                          │
│ 🧮 실습 계산기 [접기▲]  │
│ [계산기 컴포넌트]        │
│                          │
│ ## 지식 체크             │
│ [KnowledgeCheck 컴포넌트]│
│                          │
├──────────────────────────┤
│ [← 이전]  [목차≡]  [다음→]│  ← 하단 고정 네비 h-16
└──────────────────────────┘
```

---

## 9. 컴포넌트 매핑 레퍼런스

### 9.1 `/learn` 화면

| 섹션/요소 | 공유 컴포넌트 | variant / 비고 |
|----------|--------------|---------------|
| 히어로 섹션 | `<Card>` 직접 구현 | gradient bg, `rounded-2xl` |
| 진도율 스탯 | 커스텀 StatCard | bg-white/20 인라인 스타일 |
| "계속하기" CTA | `<Button>` | `variant="primary" size="lg"` |
| 코스 맵 컨테이너 | `<Card variant="standard">` | `rounded-2xl` |
| 레슨 노드 | 커스텀 `<LessonNode>` | 상태별 색상 분기 |
| 레슨 카드 | `<Card variant="elevated">` | hover 애니메이션 |
| 트랙 배지 | `<Badge>` | `variant="neutral"` / `"primary"` / `"warning"` |
| 상태 배지 | `<Badge>` | `variant="success"` / `"warning"` / `"primary"` / `"neutral"` |
| 카드 CTA | `<Button>` | `variant="primary"` / `"ghost"` / `"secondary" disabled` |
| 참조 링크 섹션 | `<Card variant="outlined">` | `bg-primary-50` 오버라이드 |

### 9.2 `/learn/lesson/[slug]` 화면

| 섹션/요소 | 공유 컴포넌트 | variant / 비고 |
|----------|--------------|---------------|
| 레슨 헤더 | 커스텀 `<LessonHeader>` | `bg-white`, border-bottom |
| 트랙 배지 | `<Badge>` | `variant="neutral"` |
| 시간 배지 | `<Badge>` | `variant="info"` |
| 난이도 배지 | `<Badge>` | `variant="primary"` |
| 읽기 진도바 | 커스텀 progress div | h-1.5, primary-500 |
| 사이드바 | `<Sidebar>` (6단계 컴포넌트) | 좌측 고정, bg-white 변형 |
| 레슨 목록 아이템 | `<Sidebar>` 내부 아이템 | 상태별 색상 |
| 다음 레슨 언락 박스 | `<Card variant="outlined">` | success/neutral 테마 |
| "다음 레슨" CTA | `<Button>` | `variant="primary" size="lg"` |
| "복습" CTA | `<Button>` | `variant="ghost"` |
| 하단 네비 이전/다음 | `<Button>` | `variant="ghost"` / `"primary"` |
| 하단 네비 목차 | `<Button>` | icon-only, `variant="secondary"` |
| Toast (잠금 안내) | `<Toast>` | `variant="warning"` |

### 9.3 인터랙티브 컴포넌트

| 컴포넌트 | 파일 경로 | 의존 공유 컴포넌트 |
|---------|----------|-----------------|
| `<InlineCalculator>` | `src/components/learning/InlineCalculator.tsx` | `<Card>`, `<Button>`, 기존 CalcForm |
| `<KnowledgeCheck>` | `src/components/learning/KnowledgeCheck.tsx` | `<Button>`, `<Badge>` |
| `<CourseProgress>` | `src/components/learning/CourseProgress.tsx` | 없음 (순수 CSS) |
| `<ConceptCard>` | `src/components/learning/ConceptCard.tsx` | `<Card>`, Lucide 아이콘 |

---

## 부록 — Phase 7C/D 개발자 인수인계 메모

### Phase 7C (인터랙티브 컴포넌트 담당)

1. **InlineCalculator**: 기존 Phase 6 계산기 컴포넌트(`CalcForm`)를 재사용. `preset` prop으로 초기값 주입. PHASE7_LEARNING_PLAN의 각 레슨 "계산기 프리셋" 항목 참조.
2. **KnowledgeCheck**: `onPass` 콜백은 반드시 `markQuizPassed(lessonSlug)` 호출로 연결. 직접 localStorage 조작 금지 — 진도 시스템 훅 경유 필수.
3. **CourseProgress**: `current` / `total` props만으로 동작. 진도 데이터 직접 읽지 않음 — 부모(LessonPage)에서 주입.
4. **ConceptCard**: 마크다운 MDX 파일에서 직접 태그로 사용. 스타일은 이 문서 4.4 섹션 기준.

### Phase 7D (진도 시스템 담당)

1. **절대 규칙**: localStorage 직접 접근은 `src/lib/learning/progress.ts` 함수만 허용. 컴포넌트에서 `localStorage.setItem` 직접 호출 금지.
2. **SSR 주의**: Next.js App Router에서 localStorage는 클라이언트 전용. `useLearningProgress` 훅은 `'use client'` 컴포넌트에서만 사용.
3. **언락 규칙 엄수**: PHASE7_LEARNING_PLAN.md의 각 레슨 "선수 레슨" 항목 확인. Lesson 6은 선수 2개(L4+L5), Lesson 8은 선수 2개(L3+L6) — 단순 선형이 아님.
4. **readPercent 업데이트**: IntersectionObserver 또는 스크롤 이벤트 + throttle(300ms) 사용. 100% 도달 시 자동으로 `status: 'in-progress'`로 변경하되 `completed`는 `quizPassed`에만 의존.
