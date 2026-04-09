# CH11 구현 분석 보고서

> 작성자: CH11 Analyst (Phase 2 Team 11A)
> 작성일: 2026-04-06
> 챕터: CH11 — 테스트 시나리오 및 검증 데이터셋
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 테스트 시나리오 및 검증 데이터셋
- **핵심 주제**: 약제비 계산 엔진 구현 완료 후 기능 정합성을 검증하기 위한 10개(CH11 정의) + 19개(구현) 시나리오 체계. EDB Mock 수가(2026년 기준)를 사용하며 1원 단위 일치를 목표로 한다.
- **다루는 계산 로직 범위**:
  - 기본 파이프라인 전체(약품금액→조제료→총액1→본인부담→청구액)
  - 가산 코드 선택(야간/토요/6세미만/산제) 및 우선순위
  - 보험 종별 본인부담 분기(C10/D10/D20/D80/G10/G20/E10/E20/F10)
  - 항번호 분류(01항/U항/W항) 및 보훈 3자 배분
  - 반올림·절사 규칙 (CH07 종속)
  - 관련 법령: 국민건강보험법 시행령 별표2, 의료급여법 시행령 별표1 등

---

## 2. 우리 구현 매핑

| 파일 경로 | 이 챕터 관련 구성요소 | 비고 |
|----------|---------------------|------|
| `src/components/calculator/scenarios.ts` | `SCENARIOS[]` (S01~S19), `SCENARIO_GROUPS` | 19개 프리셋 정의 |
| `scripts/run-scenarios.ts` | `runScenarios()`, `MockCalcRepository`, `EXPECTED[]` | 일괄 실행 및 PASS/FAIL 판정 |
| `src/lib/calc-engine/__tests__/rounding.test.ts` | `round1`, `trunc10`, `trunc100`, `round10`, `roundToInt` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-medical-aid.test.ts` | `calcMedicalAid`, `resolveMedicalAidFixAmount`, `applySbrdnTypeModifier` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-veteran.test.ts` | `getBohunRate`, `calcVeteran` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-exemption.test.ts` | `isV252Series`, `determineExemptionRate`, `inferExemptionRate`, `determineV252RateByGrade` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-powder.test.ts` | `hasPowderDrug`, `calcPowderSurcharge`, `shouldExcludeOtherSurcharges` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-saturday.test.ts` | `isAfterSaturdaySplitDate`, `createSaturdaySplitRow`, `applySaturdaySurchargeRows` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-seasonal.test.ts` | `detectSeasonalHoliday`, `calcSeasonalSurcharge` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-safety-net.test.ts` | `calcSafetyNetOverage`, `calcSafetyNet`, `ANNUAL_CAP_BY_DECILE` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-auto.test.ts` | `calcAutoInsurance` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-workers-comp.test.ts` | `calcWorkersComp` | 단위 테스트 |
| `src/lib/calc-engine/__tests__/modules-drug648.test.ts` | `apply648DayLimit`, `calc648Surcharge`, `calcDrug648Surcharge` | 단위 테스트 |
| `docs/SCENARIO_RESULTS.md` | 19개 시나리오 실행 결과 기록 | 2026-04-06 기준 |

### 미구현 영역

- `직접조제 통합 시나리오` — Z4200 코드의 다일수 적용 방식 별도 검증 시나리오 없음 (CH11 §13-4 참조)
- `선별급여 (A/B/D/E 항)` — 시나리오 및 단위 테스트 전혀 없음 (CH11 §13-4 참조)
- `외용약 단독 (Z4120)` — 내복병용(Z4121)은 S02에서 커버하나, 단독 Z4120 시나리오 없음 (CH11 §13-4 참조)
- `본인부담상한제` — `modules-safety-net.test.ts`에 단위 테스트 존재하나 통합 시나리오 없음
- `차등수가` — 시나리오 및 테스트 없음
- `비대면 조제 (ZC001~ZC004)` — 시나리오 및 테스트 없음 (CH11 §13-4 참조)
- `산정특례 V252/V352` — `modules-exemption.test.ts`에 단위 테스트 존재하나 통합 시나리오 없음 (CH11 §13-4 참조)

---

## 3. CH11 정의 시나리오 10개 vs 우리 구현 시나리오 19개 매핑

### 3-1. 시나리오 대응표

CH11 원문(S01~S10)과 우리 구현(S01~S19)의 시나리오 번호는 **다른 체계**이다. CH11의 번호는 학습용 검증 개념이고, 우리 구현 번호는 WPF TestApp 포팅 기준이다.

| CH11 시나리오 | CH11 검증 포인트 | 대응 구현 시나리오 | 매핑 상태 |
|-------------|----------------|-----------------|---------|
| CH11 S01 — 기본 처방 (C10, 40세, 내복1종 7일) | 기본 파이프라인 전체, Z4107, trunc100(30%) | **구현 S01** (C10, 45세, 내복2종 3일) | ⚠ 부분 대응 — 나이·약품종수·일수 다름 |
| CH11 S02 — 단수 발생 (0.5정, C10) | 사사오입 경계값, (int)(qty×price+0.5) | **구현 S01~S05** 내 dNum/dose 케이스, rounding.test.ts | ⚠ 분산 커버 |
| CH11 S03 — 6세미만+야간 (C10, 3세) | Z2000610, Z3000010, Z4107010, 21%/15% 차이 | **구현 S05** (C10, 3세), **구현 S14** (C10, 5세+달빛) | ⚠ 야간 없는 소아(S05)와 달빛+야간(S14)으로 분리 |
| CH11 S04 — 혼합보험 (급여+비급여+U항) | 01항/U항/W항 분리, totalPrice1 비급여 제외 | **구현 S03** (급여+비급여 혼합) | ⚠ U항(100%본인) 시나리오는 구현에 없음 |
| CH11 S05 — 65세 이상 정액 (C10, 70세) | FixCost 정액 분기, 10,000원 기준 | **구현 S04** (C10, 72세, FixCost) | ✓ 직접 대응 |
| CH11 S06 — 의료급여 1종 (D10, sbrdnType="M") | Mcode 정액 1,000원, Rate=0% | **구현 S06** (D10, 55세) | ⚠ 구현에서 sbrdnType="" → ENGINE_BUG 확인됨 |
| CH11 S07 — 보훈 60% 감면 (G10, M60) | 3자배분, Z1000/Z2000/Z3000=0, trunc100(잔여×30%) | **구현 S15** (G10+M60+야간) | ⚠ S15는 야간 포함, 순수 보훈60% 주간 시나리오 없음 |
| CH11 S08 — 가루약 가산 (C10, 40세, 산제=Y) | Z4010 별도 행, 야간/6세미만 배제 | **구현 S19** (C10, 8세, powder=Y) | ⚠ 나이 다름(40→8), Z4103100 Mock 누락 |
| CH11 S09 — 토요가산 (C10, 40세) | 별도 행 분리, Z2000030+Z3000030+Z4107030 | **구현 S08** (C10, 45세, 야간+토요) | ⚠ 순수 토요만 시나리오 없음, S08은 야간+토요 복합 |
| CH11 S10 — 빌런 처방전 (소아+산제+야간+혼합) | 가루약 1순위, 6세미만 코드 배제, 21% 적용, U항/W항 분리 | 단일 대응 시나리오 **없음** | ✗ 미커버 |

### 3-2. 구현 전용 시나리오 (CH11에 없는 19개 추가 케이스)

| 구현 시나리오 | 내용 | CH11 미포함 이유 |
|------------|------|---------------|
| S07 C10+M10 | C계열 보험+보훈 M10 전액면제 | CH11은 G계열 보훈만 정의 |
| S09 E10 산재 | 산재 전액면제 | CH11 범위 외 |
| S10 F10 자보 | 자동차보험 전액본인 | CH11 범위 외 |
| S11 E20 산재후유증 | E20 전액면제 | CH11 범위 외 |
| S12 G20+M10 보훈위탁 | 위탁 전액 보훈청 청구 | CH11 범위 외 |
| S13 직접조제 | Z4200 사용 | CH11 §13-4 미커버 열거 |
| S14 달빛어린이 | Z7001+Z2000610 | CH11 범위 외 |
| S16 D20+65세 | D20 FixCost 분기 | CH11 S05와 별도 |
| S17 D10+B014 30% | sbrdnType B014 정률 | CH11 범위 외 |
| S18 D80 행려 | 행려 전액면제 | CH11 범위 외 |

---

## 4. PASS/FAIL 현황 (SCENARIO_RESULTS.md 기반)

> 출처: `docs/SCENARIO_RESULTS.md` (2026-04-06, 19개 전수 실행)

### 4-1. 요약

| 구분 | 수량 |
|------|------|
| 전체 | 19개 |
| PASS | 12개 |
| FAIL | 7개 |
| SKIP | 0개 |
| 합계 항등식 (totalPrice = userPrice + pubPrice) | 19개 전체 OK |

### 4-2. 시나리오별 상세

| 시나리오 | 상태 | sumInsuDrug (실제/기대) | userPrice (실제/기대) | 주요 원인 |
|---------|------|----------------------|---------------------|---------|
| S01 C10 일반 3일 | **PASS** | 7,200 / 7,200 | 4,200 / N/A | — |
| S02 7일+외용 | **FAIL** | 34,650 / 26,100 (+8,550) | 13,100 / N/A | 기대값 문서 오류 (실질 PASS) |
| S03 급여+비급여 | **PASS** | 7,500 / 7,500 | 4,500 / N/A | — |
| S04 65세 저액 | **PASS** | 1,200 / 1,200 | 1,500 / 1,500 | — |
| S05 6세미만 소아 | **FAIL** | 3,150 / 1,050 (+2,100) | 1,600 / N/A | 기대값 문서 오류 (dNum=3을 1로 계산) (실질 PASS) |
| S06 D10 의료급여 | **FAIL** | 14,250 / 14,250 | 500 / 1,000 (-500) | ENGINE_BUG: sbrdnType="" 시 Mcode 미진입 |
| S07 C10+M10 보훈 | **FAIL** | 16,800 / 16,800 | 7,600 / 0 (+7,600) | MODULE_NOT_WIRED: C계열 bohunCode 미처리 |
| S08 야간+토요 | **PASS** | 7,200 / 7,200 | 4,700 / N/A | — |
| S09 E10 산재 | **PASS** | 12,000 / 12,000 | 0 / 0 | — |
| S10 F10 자보 | **FAIL** | 32,550 / 33,600 (-1,050) | 41,210 / N/A | 기대값 문서 오류 (실질 PASS) |
| S11 E20 산재후유증 | **PASS** | 5,400 / 5,400 | 0 / 0 | — |
| S12 G20+M10 보훈위탁 | **FAIL** | 24,150 / 24,150 | 0 / 0 | MODULE_NOT_WIRED: mpvaPrice 필드 미노출 (금액 로직은 정확) |
| S13 직접조제 | **PASS** | 7,200 / 7,200 | 5,300 / N/A | — |
| S14 달빛어린이 야간 | **FAIL** | 3,150 / 1,050 (+2,100) | 2,200 / N/A | 기대값 문서 오류 (S05와 동일) (실질 PASS) |
| S15 G10+M60+야간 | **PASS** | 24,150 / 24,150 | 4,190 / N/A | — |
| S16 D20+65세 | **PASS** | 4,500 / 4,500 | 500 / 500 | — |
| S17 D10+B014 30% | **PASS** | 14,250 / 14,250 | 6,600 / N/A | — |
| S18 D80 행려 | **PASS** | 7,200 / 7,200 | 0 / 0 | — |
| S19 산제 가루약 | **PASS** | 9,000 / 9,000 | 4,800 / N/A | — |

### 4-3. FAIL 원인 카테고리

| 카테고리 | 건수 | 해당 시나리오 |
|---------|------|------------|
| ENGINE_BUG (엔진 계산 오류) | 1 | S06 |
| MODULE_NOT_WIRED (모듈 연결 누락) | 2 | S07, S12 |
| EXPECTED_VALUE_UNCLEAR (기대값 문서 오류) | 4 | S02, S05, S10, S14 |

> **실질 엔진 오류**: 7건 FAIL 중 엔진 자체 버그는 **S06 1건**뿐. 4건(S02/S05/S10/S14)은 문서 기대값이 잘못됨. 1건(S12)은 금액은 맞으나 필드 노출 문제.

---

## 5. 누락 항목 (Missing)

- [🔴 Missing / Critical] **CH11 S10 빌런 처방전 통합 시나리오**: 소아+가루약+야간+혼합보험 조합(U항/W항 분리, 가루약 1순위, 21% 6세미만) 통합 시나리오가 19개 구현에 없음. `scripts/run-scenarios.ts` 및 `scenarios.ts`에 추가 필요 (CH11 §12)

- [🔴 Missing / Critical] **U항(100%본인부담) 혼합 시나리오**: 급여+비급여+100%본인 3중 혼합(CH11 S04, S10) 시나리오가 없음. S03은 급여+비급여 2종만 커버 (CH11 §6, §12)

- [🟠 Missing / High] **순수 토요가산 단독 시나리오**: CH11 S09가 요구하는 토요 단독(야간 없이 Z2000030+Z3000030+Z4107030 별도 행) 시나리오가 없음. S08은 야간+토요 복합만 커버 (CH11 §11)

- [🟠 Missing / High] **Z4120 외용약 단독 시나리오**: Z4121(내복병용)은 S02에서 커버하나 Z4120(외용 단독) 시나리오 없음 (CH11 §13-4)

- [🟠 Missing / High] **선별급여 A/B/D/E 항 시나리오**: 선별급여 전체 미커버. 단위 테스트 및 통합 시나리오 모두 없음 (CH11 §13-4)

- [🟡 Missing / Medium] **비대면 조제 시나리오**: ZC001~ZC004 코드 사용 시나리오 없음. `modules-seasonal.test.ts`에서 비대면 플래그가 명절 가산 배제 조건으로만 언급됨 (CH11 §13-4)

- [🟡 Missing / Medium] **산정특례 V252/V352 통합 시나리오**: `modules-exemption.test.ts`에 단위 테스트 존재하나 전체 파이프라인 통합 시나리오 없음 (CH11 §13-4)

- [🟡 Missing / Medium] **본인부담상한제 통합 시나리오**: `modules-safety-net.test.ts`에 단위 테스트 존재하나 실제 누적 계산 통합 시나리오 없음 (CH11 §13-4)

- [🟡 Missing / Medium] **차등수가 시나리오**: 시나리오 및 단위 테스트 모두 없음 (CH11 §13-4)

---

## 6. 부족 항목 (Insufficient)

- [🔴 Insufficient / Critical] **S06 D10 sbrdnType="" Mcode 미적용** (`src/lib/calc-engine/modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount()`): D10 + sbrdnType=""(기본 수급자)일 때 Mcode 분기 미진입. sbFirst=""이므로 'M' 조건 불충족 → fixCost(=0) fallback → 결과적으로 D20의 500원이 적용됨. CH11 S06 §9 기대값 1,000원과 500원 차이. **수정**: `sbrdnType이 'B'로 시작하면 bcode, 나머지(빈 문자열 포함)는 mcode 적용`.

- [🔴 Insufficient / Critical] **S07 C10+bohunCode 조합 보훈 모듈 미진입** (`src/lib/calc-engine/copayment.ts`): `insuCode.charAt(0) === 'G'`일 때만 `calcVeteran()` 호출. C10 처방에 bohunCode=M10이 있는 경우 보훈 모듈에 진입하지 못해 일반 C10 30% 계산 적용 → userPrice 7,600원 (기대 0원). 보훈감면 7,600원 오산출. **수정**: `bohunCode 존재 시 insuCode 무관하게 calcVeteran() 호출`.

- [🟠 Insufficient / High] **S08 야간+토요 복합 가산 누락** (`scripts/run-scenarios.ts` 관찰 §5-2): 엔진이 야간 우선 적용 시 토요 별도 행(Z2000030, Z3000030, Z4103030)을 추가하지 않음. 실측: Z2000010+Z3000010+Z4103010만 출력. CH11 S09가 요구하는 "기본행 + 별도 가산행" 구조 미준수. `modules-saturday.test.ts`는 토요 단독에서 정상이나 야간+토요 복합 시 미동작.

- [🟠 Insufficient / High] **S12 G20+M10 mpvaPrice 필드 CalcResult 미노출** (`src/lib/calc-engine/veteran.ts` → `buildResult()` 또는 `_resultToCopay()`): G20 위탁 전액 처리 시 `mpvaPrice` 내부 계산은 정확하나 상위 결과 객체로 전달되지 않음. `run-scenarios.ts`에서 `result.mpvaPrice === undefined`. 금액은 `pubPrice`에 합산되어 정확하나 필드 노출 필요.

- [🟠 Insufficient / High] **S19 Z4103100 Mock DB 미등록**: 2026년(신체계) 산제가산 코드 Z4103100이 `MockCalcRepository`에 없음 → Z4103(2,680원)으로 fallback하여 산제가산(800원)이 `sumWage`에 미반영. Z4010(800원)은 개별 행으로 출력되나 sumWage 합산 여부 확인 필요 (SCENARIO_RESULTS.md §5-4 참조).

- [🟡 Insufficient / Medium] **S08 sumWage 기대값 불일치**: S01(2약품 3일) 실측 sumWage=7,020원, WPF EDB Mock 기준 기대값=9,210원 (SCENARIO_RESULTS.md §5-1). Mock DB 수가와 WPF 기준 수가 사이 차이 확인 필요.

---

## 7. 테스트 계층 분석 (단위 / 통합 / E2E)

### 7-1. 현재 구조

| 계층 | 파일 위치 | 내용 | 상태 |
|------|----------|------|------|
| **단위 테스트** | `src/lib/calc-engine/__tests__/*.test.ts` (11개 파일) | 반올림, 의료급여, 보훈, 산정특례, 산제, 토요, 명절, 안전망, 자보, 산재, 648약품 모듈별 독립 검증 | 구현됨 |
| **통합 테스트 (스크립트)** | `scripts/run-scenarios.ts` | 19개 시나리오 전체 파이프라인 실행, PASS/FAIL 판정 | 구현됨 |
| **E2E 테스트** | — | 브라우저 UI 레벨 테스트 없음 | 미구현 |

### 7-2. 테스트 프레임워크 관찰

단위 테스트 파일들이 **Jest/Vitest 표준 프레임워크 미사용**. 자체 `assert()` 함수와 `failCount`를 사용하는 직접 실행 방식(`npx tsx ...`)이다. 장점: 의존성 단순. 단점: CI 통합, 병렬 실행, 커버리지 측정 어려움.

---

## 8. 1원 단위 일치 검증 가능 여부

### 8-1. 현재 검증 가능 범위

| 항목 | 검증 가능 여부 | 비고 |
|------|-------------|------|
| sumInsuDrug (약품금액) | ✓ | S01~S19 전체 기대값 정의 |
| userPrice (본인부담금) | 부분 | S04/S06/S07/S09/S11/S12/S16/S18만 기대값 있음 |
| totalPrice (요양급여총액1) | ⚠ 간접 | 항등식(totalPrice=userPrice+pubPrice)으로만 검증 |
| sumWage (조제료) | ✗ | 기대값 미정의, 실측만 기록 |
| pubPrice (청구액) | ✗ | 기대값 미정의 |
| mpvaPrice (보훈청구액) | ✗ | S07/S12에서 S07=총액, S12=미노출 |

### 8-2. CH11 정의 기대값과의 1원 단위 비교

CH11 원문이 제시하는 기대값과 구현 시나리오의 입력이 다르기 때문에 **직접적인 1원 단위 비교는 불가**하다. CH11 S01(단일약품 500원×3×7=10,500원)과 구현 S01(2약품 800원 합산×3×3=7,200원)은 입력 자체가 다르다. 그러나 반올림 규칙(rounding.test.ts), 조제료 코드 선택, 항등식은 동일 수가 기준으로 1원 단위 일치를 확인 가능하다.

### 8-3. 실질 검증 상태

- **sumInsuDrug 1원 단위**: 12개 PASS 시나리오에서 완전 일치 확인
- **userPrice 1원 단위**: S04(1,500원 = 기대), S09(0원 = 기대), S11(0원 = 기대), S16(500원 = 기대), S18(0원 = 기대) — 5개 완전 일치
- **항등식**: 19개 전체 OK (`totalPrice = userPrice + pubPrice`)
- **CH11 S01 기대값 기준**: sumInsuDrug(10,500), sumWage(8,660), total(19,160), user(5,700), pubPrice(13,460) — 구현에서 이 정확한 입력으로 직접 검증하는 시나리오 없음

---

## 9. S10 빌런 처방전 상세 분석

### 9-1. CH11 정의 (원문 §12)

**입력**: C10, 3세, 야간=Y, 산제=Y, 조제일 2026-04-03

| 약품 | 급여구분 | 단가 | 1회량 | 1일횟수 | 일수 |
|------|---------|------|------|-------|-----|
| 약품1 | 급여(01항) | 500원 | 1정 | 3회 | 7일 |
| 약품2 | 비급여(W항) | 300원 | 1정 | 2회 | 7일 |
| 약품3 | 100%본인(U항) | 200원 | 1정 | 2회 | 7일 |

**기대 결과**:
- 01항: 10,500원 / 02항: 9,460원 / 총액1: 19,960원
- 본인부담: 4,100원 (21%, 6세미만 법령 기준)
- 청구액: 15,860원
- U항: 2,800원 / W항: 4,200원 / 총액2: 22,760원

**핵심 판단 포인트**:
1. **가루약 1순위**: 산제=Y → 야간 가산 배제, Z2000(일반) 사용 (Z2000610 미사용)
2. **6세미만 코드 배제**: 가루약 시 Z2000600도 미사용
3. **산제가산 Z4010(800원)**: 별도 행 추가
4. **본인부담률 21%**: 가루약 가산과 독립적, 6세미만 경감은 보험료율 규칙이므로 적용
5. **U항/W항 총액1 제외**: 급여 01항+02항만 총액1 산입

### 9-2. 현재 구현 커버 현황

| 요소 | 단위 테스트 커버 | 통합 시나리오 | 비고 |
|-----|--------------|-----------|-----|
| 가루약 1순위 (shouldExcludeOtherSurcharges) | ✓ (modules-powder.test.ts) | ✗ | 통합 없음 |
| Z2000 일반코드 선택 (가루약 시) | ✗ | ✗ | 미검증 |
| Z4010 별도 행 | ✓ (calcPowderSurcharge 구체계) | ✓ (S19 부분) | S19는 신체계(null반환) |
| 21% 6세미만 적용 | ✗ | ✗ | 단위·통합 모두 없음 |
| U항/W항 분리 + 총액1 제외 | ✗ | ✗ | S03은 W항만, U항 없음 |
| 3중 혼합(01항+U항+W항) | ✗ | ✗ | 미구현 |

**결론**: S10 빌런 처방전의 7개 검증 포인트 중 현재 구현 시나리오로 검증 가능한 것은 **0개**이다. 개별 요소의 단위 테스트는 일부 존재하나 복합 시나리오로는 전혀 커버되지 않는다.

---

## 10. 기타 관찰 사항

### 10-1. CH11 vs 구현 시나리오 번호 체계 충돌

CH11의 S01~S10과 구현의 S01~S19는 **다른 체계**이다. CH11 S03(6세미만+야간)은 구현 S05(6세미만 주간)와 다르고, CH11 S07(보훈60%)은 구현 S15(G10+M60+야간)와 다르다. 향후 문서 참조 시 혼란 방지를 위해 구현 쪽에 CH11 대응 번호를 명시하는 주석 추가를 권장한다.

### 10-2. 구현 EXPECTED 기대값 일부 미정의

`scripts/run-scenarios.ts`의 `EXPECTED` 테이블에서 sumWage, totalPrice, pubPrice의 기대값이 대부분 미정의(`N/A`)이다. sumInsuDrug와 userPrice만 검증되므로 조제료 코드 선택 정확성(Z코드 구성)은 `wageList` 출력으로만 확인 가능하다.

### 10-3. 직접조제 Z4200 적용 방식 불명확

S13 실측: Z4200(2,110원) × 3 = 6,330원. SCENARIO_RESULTS.md §8에 "직접조제 횟수 적용 방식 별도 검토 필요"로 기재됨. CH11 §13-4에서 직접조제를 미커버 영역으로 명시하나, 구현에는 S13이 있어 불완전하게나마 검증 중.

### 10-4. 기대값 오류 4건 문서 수정 필요

SCENARIO_RESULTS.md가 지적한 대로 `scripts/run-scenarios.ts`의 `EXPECTED` 테이블에서 S02/S05/S10/S14의 sumInsuDrug 기대값이 잘못되었다. 특히 S05/S14의 dNum=3을 1로 계산한 착오는 동일 원인이므로 일괄 수정이 필요하다.

| 시나리오 | 현행 기대값 | 정정값 |
|---------|-----------|--------|
| S02 | 26,100원 | 34,650원 |
| S05 | 1,050원 | 3,150원 |
| S10 | 33,600원 | 32,550원 |
| S14 | 1,050원 | 3,150원 |

### 10-5. EDB Mock SixAgeRate 법령 불일치

CH11 §5 (S03 검증 포인트)에서 명시: C10 SixAgeRate=50 → 15%, 법령 기준 21%. 구현 S05 실측 userPrice=1,600원. 이 값이 15% 기준인지 21% 기준인지는 `totalPrice=10,870`을 기준으로 계산하면: 15% → trunc100(10870×0.15)=1,600원(일치), 21% → trunc100(10870×0.21)=2,200원(불일치). **엔진이 EDB Mock 15%(SixAgeRate 기준) 적용 중**. CH11 §13-3 불일치 #2로 기록된 사항.

---

*출처 문서: `C:\Projects\DSNode\약제비 분석용\output\CH11_테스트_시나리오.md`, `C:\Projects\KSH\PharmaEdu\src\components\calculator\scenarios.ts`, `C:\Projects\KSH\PharmaEdu\scripts\run-scenarios.ts`, `C:\Projects\KSH\PharmaEdu\docs\SCENARIO_RESULTS.md`, `C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\__tests__\` (11개 파일)*

**[약제비 분석용]**
