# Phase 8 감사 마스터 플랜
## PharmaEdu 계산 엔진 TypeScript 포팅 검증

> **문서 목적**: 33명 에이전트팀의 전체 감사 작업을 조율하는 최상위 계획서
> **작성**: Manager 5 — Master Coordinator
> **작성일**: 2026-04-06
> **상태**: 확정 (읽기 전용)

---

## 1. 미션 스테이트먼트

### 1.1 감사 목적

PharmaEdu 프로젝트는 기존 C# 약제비 계산 엔진(`YakjaebiCalc.Engine`)을 TypeScript(`calc-engine`)로 포팅하여 웹 기반 교육 플랫폼에 통합하고 있다. Phase 7까지 기능 구현이 완료되었으나, 포팅 과정에서 다음 위험이 존재한다.

- **누락(Missing)**: C# 원본에 있는 로직이 TypeScript에 구현되지 않은 경우
- **의심(Suspicious)**: 구현은 되어 있으나 C# 원본 또는 4개 참조 소스와 동작이 다를 가능성이 있는 경우
- **부족(Insufficient)**: 구현은 있으나 엣지케이스·예외처리·반올림 정밀도 등이 불완전한 경우

본 감사(Phase 8)는 위 세 범주의 문제를 전수 식별하여, Phase 9 수정 작업의 정확한 입력물을 생성하는 것을 목적으로 한다.

### 1.2 감사 범위

| 구분 | 대상 |
|------|------|
| 우리 구현 | `C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\` (TypeScript) |
| C# 원본 | `C:\Projects\DSNode\약제비 분석용\YakjaebiCalc\YakjaebiCalc.Engine\` |
| 챕터 문서 | `C:\Projects\DSNode\약제비 분석용\output\CH01~CH12` (12개 MD 파일) |
| 4개 참조 소스 | 비즈팜 / 공단 / 유팜 / EDB (Manager 3가 매핑) |
| 감사 제외 | UI 컴포넌트, Supabase 스키마, 학습 콘텐츠 |

### 1.3 성공 기준

- [ ] CH01~CH12 전 챕터에 대해 analyst + verifier 보고서 각 1건 완성
- [ ] 누락/의심/부족 각 범주별 종합 보고서 1건 완성
- [ ] 최종 보고서(`99_FINAL_REPORT.md`)에 우선순위별 수정 로드맵 수록
- [ ] 모든 발견 사항에 소스 파일명 및 행 번호 인용
- [ ] 소스 코드 무수정 — 분석만 수행

---

## 2. 팀 구성

### 2.1 전체 팀 개요 (33명)

```
Phase 1 │ 5명  │ 관리자 (병렬 준비 작업)
Phase 2 │ 24명 │ 챕터 분석가 12 + 검증자 12 (병렬 실행)
Phase 3 │ 4명  │ 총괄 1 + 부담당 3 (순차 종합)
────────┼──────┼──────────────────────────────────────
합계    │ 33명 │
```

### 2.2 Phase 1 — 관리자 (5명)

| 에이전트 | 역할 | 산출물 |
|---------|------|--------|
| Manager 1 | 디렉토리 인벤토리 | `01_directory_inventory.md` |
| Manager 2 | C# 엔진 매핑 | `02_csharp_mapping.md` |
| Manager 3 | 4개 소스 프레임워크 | `03_4source_framework.md` |
| Manager 4 | 분석 템플릿 설계 | `04_analysis_template.md` |
| Manager 5 | 마스터 플랜 (본 문서) | `00_master_plan.md` |

> **Phase 1 완료 조건**: 위 5개 파일 모두 생성 완료. Phase 2는 Phase 1 완료 후 시작.

### 2.3 Phase 2 — 챕터 분석가 + 검증자 (24명)

각 챕터별 2명이 독립적으로 작업:
- **분석가 (Analyst)**: 챕터 문서 규격 대비 TypeScript 구현의 충족 여부 분석
- **검증자 (Verifier)**: C# 원본 대비 TypeScript 포팅의 충실도 검증 + 4개 소스 교차 확인

> **Phase 2 완료 조건**: 24개 파일(`ch01_analyst.md` ~ `ch12_verifier.md`) 모두 생성 완료. Phase 3는 Phase 2 완료 후 시작.

### 2.4 Phase 3 — 종합 에이전트 (4명)

| 에이전트 | 역할 | 입력 | 산출물 |
|---------|------|------|--------|
| 부담당 1 | 누락 사항 종합 | 24개 챕터 보고서 | `21_missing_aggregation.md` |
| 부담당 2 | 의심 사항 종합 | 24개 챕터 보고서 | `22_suspicious_aggregation.md` |
| 부담당 3 | 부족 사항 종합 | 24개 챕터 보고서 | `23_insufficient_aggregation.md` |
| 총괄 | 최종 통합 + 우선순위 | 3개 종합 보고서 | `99_FINAL_REPORT.md` |

> **Phase 3 완료 조건**: `99_FINAL_REPORT.md` 생성 완료 = 감사 완료.

---

## 3. 챕터 배정표

### 3.1 배정 기준

- 분석가는 **챕터 문서(CH??_.md)를 1차 기준**으로 삼아 TypeScript 구현 충족 여부 판단
- 검증자는 **C# 원본을 1차 기준**으로 삼아 포팅 충실도 판단 + 4개 소스 교차 확인
- 두 에이전트는 서로의 초안을 참조하지 않고 독립적으로 작성 (교차 오염 방지)

### 3.2 챕터별 배정 상세

| 챕터 | 제목 | 분석가 산출물 | 검증자 산출물 | 카테고리 |
|------|------|--------------|--------------|---------|
| CH01 | 약품금액 계산 | `ch01_analyst.md` | `ch01_verifier.md` | A |
| CH02 | 조제료 코드체계 (Z코드) | `ch02_analyst.md` | `ch02_verifier.md` | A |
| CH03 | 조제료 수가 계산 | `ch03_analyst.md` | `ch03_verifier.md` | B |
| CH04 | 가산 로직 | `ch04_analyst.md` | `ch04_verifier.md` | B |
| CH05 | 보험유형별 본인부담금 | `ch05_analyst.md` | `ch05_verifier.md` | C |
| CH06 | 3자배분/공비 | `ch06_analyst.md` | `ch06_verifier.md` | C |
| CH07 | 반올림/절사 규칙 | `ch07_analyst.md` | `ch07_verifier.md` | D |
| CH08 | 특수케이스/엣지케이스 | `ch08_analyst.md` | `ch08_verifier.md` | D |
| CH09 | 데이터 모델 설계 | `ch09_analyst.md` | `ch09_verifier.md` | D |
| CH10 | 계산 파이프라인 | `ch10_analyst.md` | `ch10_verifier.md` | E |
| CH11 | 테스트 시나리오 및 검증 | `ch11_analyst.md` | `ch11_verifier.md` | E |
| CH12 | 보훈 약국 약제비 청구 | `ch12_analyst.md` | `ch12_verifier.md` | C |

### 3.3 카테고리 정의

| 카테고리 | 범위 | 포함 챕터 |
|---------|------|----------|
| **A** | 약품금액 / 코드체계 | CH01, CH02 |
| **B** | 조제료 / 가산 | CH03, CH04 |
| **C** | 보험 / 3자배분 / 보훈 | CH05, CH06, CH12 |
| **D** | 반올림 / 특수케이스 / 데이터모델 | CH07, CH08, CH09 |
| **E** | 파이프라인 / 테스트 | CH10, CH11 |

---

## 4. 종합(Aggregation) 계획

### 4.1 부담당 1 — 누락 사항 종합 → `21_missing_aggregation.md`

**작업 정의**: 24개 챕터 보고서에서 "누락(Missing)" 태그가 달린 모든 항목을 수집하여 중복 제거 후 단일 목록으로 통합.

**산출물 구조**:
```
## 누락 사항 전체 목록
### 카테고리 A (약품금액/코드체계)
| 항목 | 발견 챕터 | 소스 인용 | 심각도 |
...
### 카테고리 B~E (동일 구조)

## 중복/연관 항목 분석
## 우선순위 권고 (총괄에게)
```

### 4.2 부담당 2 — 의심 사항 종합 → `22_suspicious_aggregation.md`

**작업 정의**: 24개 챕터 보고서에서 "의심(Suspicious)" 태그가 달린 항목 수집. 동일 의심이 여러 챕터에서 언급된 경우 교차 참조 포함.

**산출물 구조**:
```
## 의심 사항 전체 목록
### 고위험 의심 (동작 불일치 가능성 높음)
### 중위험 의심 (확인 필요)
### 저위험 의심 (주의 관찰)

## 교차 챕터 의심 클러스터
## 우선순위 권고 (총괄에게)
```

### 4.3 부담당 3 — 부족 사항 종합 → `23_insufficient_aggregation.md`

**작업 정의**: 24개 챕터 보고서에서 "부족(Insufficient)" 태그가 달린 항목 수집. 엣지케이스 미처리, 예외처리 부재, 반올림 정밀도 부족 등을 포함.

**산출물 구조**:
```
## 부족 사항 전체 목록
### 엣지케이스 미처리
### 예외처리 부재
### 정밀도/반올림 부족
### 기타 품질 부족

## 개선 우선순위 권고 (총괄에게)
```

### 4.4 총괄 — 최종 통합 → `99_FINAL_REPORT.md`

**작업 정의**: `21_`, `22_`, `23_` 3개 보고서를 통합하여 수정 로드맵 생성.

**산출물 구조**:
```
## Executive Summary
## 전체 발견 사항 통계
## 수정 우선순위 매트릭스
### P1 — 즉시 수정 (Critical)
### P2 — Phase 9 수정 (High)
### P3 — 향후 개선 (Medium/Low)
## Phase 9 작업 권고
## 위험 잔존 항목 (감사 범위 외)
```

---

## 5. 산출물 파일 전체 목록

모든 파일 위치: `C:\Projects\KSH\PharmaEdu\docs\analysis\`

```
00_master_plan.md          ← Manager 5 (본 문서) ✅
01_directory_inventory.md  ← Manager 1
02_csharp_mapping.md       ← Manager 2
03_4source_framework.md    ← Manager 3
04_analysis_template.md    ← Manager 4

ch01_analyst.md            ← CH01 분석가
ch01_verifier.md           ← CH01 검증자
ch02_analyst.md            ← CH02 분석가
ch02_verifier.md           ← CH02 검증자
ch03_analyst.md            ← CH03 분석가
ch03_verifier.md           ← CH03 검증자
ch04_analyst.md            ← CH04 분석가
ch04_verifier.md           ← CH04 검증자
ch05_analyst.md            ← CH05 분석가
ch05_verifier.md           ← CH05 검증자
ch06_analyst.md            ← CH06 분석가
ch06_verifier.md           ← CH06 검증자
ch07_analyst.md            ← CH07 분석가
ch07_verifier.md           ← CH07 검증자
ch08_analyst.md            ← CH08 분석가
ch08_verifier.md           ← CH08 검증자
ch09_analyst.md            ← CH09 분석가
ch09_verifier.md           ← CH09 검증자
ch10_analyst.md            ← CH10 분석가
ch10_verifier.md           ← CH10 검증자
ch11_analyst.md            ← CH11 분석가
ch11_verifier.md           ← CH11 검증자
ch12_analyst.md            ← CH12 분석가
ch12_verifier.md           ← CH12 검증자

21_missing_aggregation.md      ← 부담당 1
22_suspicious_aggregation.md   ← 부담당 2
23_insufficient_aggregation.md ← 부담당 3
99_FINAL_REPORT.md             ← 총괄
```

**총 파일 수**: 33개 (본 문서 포함)

---

## 6. 품질 기준

### 6.1 인용 규칙 (필수)

모든 발견 사항은 다음 형식으로 소스를 인용해야 한다:

```
[파일명:행번호] 또는 [파일명:함수명]
예시:
- `copayment.ts:142` — calcUserPrice() 반올림 누락
- `CopaymentCalculator.cs:87` — Floor() 사용 확인
- `CH05_보험유형별_본인부담금.md:§3.2` — 산정 기준 명시
```

행 번호를 특정할 수 없는 경우 함수명 또는 섹션 번호로 대체 가능. 단, 파일명은 반드시 포함.

### 6.2 심각도 분류 기준

| 심각도 | 기준 | 예시 |
|--------|------|------|
| **Critical** | 계산 결과가 다른 값이 나올 수 있는 로직 오류 | 반올림 방향 반전, 본인부담율 오적용 |
| **High** | 특정 케이스에서 오류 발생 가능 | 보훈 100% 케이스 미처리 |
| **Medium** | 정상 동작하나 명세와 불일치 | 변수명/상수 불일치 |
| **Low** | 개선 권고 수준 | 코드 가독성, 주석 부재 |

심각도 주장에는 반드시 **근거 인용**이 수반되어야 한다. 근거 없는 심각도 주장은 보고서에서 제외.

### 6.3 금지 사항

- **소스 코드 수정 절대 금지** — 분석 파일만 생성
- **추측성 발언 금지** — 증거 없는 "아마도", "것 같다" 표현 사용 시 발견 사항으로 불인정
- **타 에이전트 보고서 참조 금지** (Phase 2) — 챕터 분석가/검증자는 독립 작성
- **범위 외 파일 열람 금지** — 지정된 참조 경로 외 파일은 접근 불가

### 6.4 보고서 필수 섹션

각 챕터 보고서(`ch??_analyst.md`, `ch??_verifier.md`)는 `04_analysis_template.md`의 템플릿을 준수해야 한다. 최소 포함 섹션:

1. 분석 범위 및 참조 파일 목록
2. 누락 사항 목록 (없으면 "없음" 명기)
3. 의심 사항 목록 (없으면 "없음" 명기)
4. 부족 사항 목록 (없으면 "없음" 명기)
5. 전체 요약 (3줄 이내)

---

## 7. 참조 경로 레퍼런스

### 7.1 TypeScript 구현 (우리 코드)

```
C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\
├── drug-amount.ts          # CH01 약품금액
├── dispensing-fee.ts       # CH02, CH03 조제료
├── surcharge.ts            # CH04 가산
├── copayment.ts            # CH05 본인부담금
├── rounding.ts             # CH07 반올림
├── types.ts                # CH09 데이터모델
├── index.ts                # CH10 파이프라인 진입점
├── supabase-repo.ts        # 데이터 조회 레이어
├── modules/
│   ├── insurance/          # CH05 보험유형별 처리
│   │   ├── medical-aid.ts  # 의료급여
│   │   └── veteran.ts      # 보훈 (CH12)
│   ├── surcharges/         # CH04 가산 모듈
│   ├── special/            # CH08 특수케이스
│   └── modes/              # 계산 모드
└── __tests__/              # CH11 테스트
    ├── rounding.test.ts
    ├── modules-veteran.test.ts
    └── ...
```

### 7.2 C# 원본 엔진

```
C:\Projects\DSNode\약제비 분석용\YakjaebiCalc\YakjaebiCalc.Engine\
├── Engine\
│   ├── CopaymentCalculator.cs         # 본인부담금 계산
│   ├── CopaymentCalculator.Logging.cs
│   ├── DispensingFeeCalculator.cs     # 조제료 계산
│   └── DispensingFeeCalculator.Logging.cs
├── Models\
│   ├── CalcOptions.cs     # 계산 옵션
│   ├── CalcResult.cs      # 계산 결과
│   ├── DrugItem.cs        # 약품 항목
│   ├── InsuRateInfo.cs    # 보험료율 정보
│   ├── MediIllnessInfo.cs # 상병 정보
│   ├── WageItem.cs        # 수가 항목
│   └── WageListItem.cs    # 수가 목록
└── Utilities\
    └── RoundingHelper.cs  # 반올림 유틸리티
```

### 7.3 챕터 문서

```
C:\Projects\DSNode\약제비 분석용\output\
├── CH01_약품금액_계산.md
├── CH02_조제료_코드체계.md
├── CH03_조제료_수가계산.md
├── CH04_가산_로직.md
├── CH05_보험유형별_본인부담금.md
├── CH06_3자배분_공비.md
├── CH07_반올림_절사_규칙.md
├── CH08_특수케이스.md
├── CH09_데이터모델.md
├── CH10_계산_파이프라인.md
├── CH11_테스트_시나리오.md
└── CH12_보훈_약국_약제비_청구.md
```

### 7.4 4개 참조 소스 (Manager 3 매핑 참조)

상세 파일 경로는 `03_4source_framework.md` 참조.

| 소스 | 특성 |
|------|------|
| 비즈팜 | VB6 기반 레거시, `Ppre1000__.frm` 핵심 |
| 공단 | 공단 전자문서 PDF (p.648~655 핵심) |
| 유팜 | C# 구현, `보훈국비100.cs` 포함 |
| EDB | C# 구현, `PrsBillCalcM.*` 핵심 |

---

## 8. 실행 타임라인

```
Phase 1 (병렬)
 └─ Manager 1~5 동시 실행
 └─ 완료 기준: 5개 파일 생성 완료

Phase 2 (병렬, Phase 1 완료 후 시작)
 └─ CH01~CH12 분석가 12명 동시 실행
 └─ CH01~CH12 검증자 12명 동시 실행
 └─ 완료 기준: 24개 파일 생성 완료

Phase 3 (순차, Phase 2 완료 후 시작)
 Step 3-1 (병렬): 부담당 1 + 부담당 2 + 부담당 3 동시 실행
 Step 3-2 (순차, 3-1 완료 후): 총괄 최종 통합
 └─ 완료 기준: 99_FINAL_REPORT.md 생성 완료
```

---

## 9. 의존 관계 다이어그램

```
[Manager 1] ──┐
[Manager 2] ──┤
[Manager 3] ──┼──→ Phase 2 착수 가능
[Manager 4] ──┤    (04_analysis_template.md 필수 선행)
[Manager 5] ──┘

[ch01_analyst] ──┐
[ch01_verifier]──┤
[ch02_analyst] ──┤
     ...         ├──→ [부담당 1] ──┐
[ch12_analyst] ──┤    [부담당 2] ──┼──→ [총괄] → 99_FINAL_REPORT.md
[ch12_verifier]──┘    [부담당 3] ──┘
```

**중요**: Phase 2 에이전트는 `04_analysis_template.md` 파일을 반드시 먼저 읽고 템플릿을 준수하여 작성한다.

---

*Manager 5 — Master Coordinator | Phase 8 Calculation Logic Audit*
