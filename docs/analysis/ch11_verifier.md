# CH11 교차 검증 보고서 — 테스트 체계

> 작성자: CH11 Verifier (Phase 2 Team 11B)
> 작성일: 2026-04-06
> 챕터: CH11 — 테스트 체계 및 검증 정확도
> 상태: [x] 완료

---

## 1. C# 단위 테스트 vs TS 테스트 — 구조 비교

### 1-1. C# xUnit 테스트 구조

C# 프로젝트(`YakjaebiCalc.Engine.Tests`)의 테스트는 3계층으로 구성된다.

| 계층 | 파일 | 테스트 수 | 성격 |
|------|------|---------|------|
| **UnitTests** | `RoundingHelperTests.cs` | 소수 | 순수 단위 (반올림 함수) |
| **IntegrationTests** | `S01VerificationTest.cs`, `PolicyGoldenTests.cs`, `HealthInsuranceTests.cs`, `EdgeCaseGoldenTests.cs`, `MedicalAidTests.cs`, `VeteranTests.cs`, `VeteranExtendedTests.cs`, `VeteranCombinationTests.cs`, `VeteranRateOrderTests.cs`, `GsCodeMappingTests.cs`, `PriorityPolicyTests.cs`, `HighPriorityRegressionTests.cs` | 100+건 | 파이프라인 통합 (골든값 포함) |
| **E2ETests** | `Prescription1505Tests.cs` | 4개 [Fact] (내부 1,505건 루프) | 전수 자동 |

### 1-2. TS 테스트 구조

TypeScript 쪽(`src/lib/calc-engine/__tests__/`)의 테스트는 **수동 assert 방식**으로, xUnit의 `[Fact]`/`[Theory]`에 해당하는 프레임워크를 사용하지 않는다. 모든 파일이 Node.js에서 직접 실행하는 스크립트 형태다.

| 파일 | 대상 함수 | assert 수(대략) | 성격 |
|------|----------|----------------|------|
| `rounding.test.ts` | `round1`, `trunc10`, `trunc100`, `round10`, `roundToInt` | 22건 | 순수 단위 |
| `modules-auto.test.ts` | `calcAutoInsurance` (F10) | 13건 | 모듈 단위 |
| `modules-workers-comp.test.ts` | `calcWorkersComp` (E10/E20) | 9건 | 모듈 단위 |
| `modules-medical-aid.test.ts` | `calcMedicalAid`, `resolveMedicalAidFixAmount`, `applySbrdnTypeModifier` | 20건 | 모듈 단위 |
| `modules-veteran.test.ts` | `getBohunRate`, `calcVeteran` | 21건 | 모듈 단위 |
| `modules-exemption.test.ts` | `isV252Series`, `determineExemptionRate`, `inferExemptionRate`, `determineV252RateByGrade` | 33건 | 모듈 단위 |
| `modules-seasonal.test.ts` | `detectSeasonalHoliday`, `calcSeasonalSurcharge` | 28건 | 모듈 단위 |
| `modules-saturday.test.ts` | `isAfterSaturdaySplitDate`, `createSaturdaySplitRow`, `applySaturdaySurchargeRows` | 17건 | 모듈 단위 |
| `modules-powder.test.ts` | `hasPowderDrug`, `calcPowderSurcharge`, `shouldExcludeOtherSurcharges` | 14건 | 모듈 단위 |
| `modules-drug648.test.ts` | 648계열 약품 관련 | 미확인 | 모듈 단위 |
| `modules-safety-net.test.ts` | `calcSafetyNetOverage`, `calcSafetyNet`, `ANNUAL_CAP_BY_DECILE` | 18건 | 모듈 단위 |
| `s01-verify.ts` | S01 시나리오 단독 검증 | 5건 | E2E 수동 |

**TS 총 assert 수**: 약 200건 (수동 스크립트)

---

## 2. C# 1,505건 전수 테스트 vs 우리 테스트 규모 비교

### 2-1. C# Prescription1505Tests.cs 구성

`Prescription1505Tests.cs`(L1-L687)는 **43개 보험 시나리오 × 35개 약품 프리셋 = 1,505건**을 자동 루프로 실행한다.

- **43개 보험 시나리오** (`InsuranceScenarios`, L236-L298): 건강보험 6, 의료급여 5, 보훈 8, 산재/자보 3, 시간가산 5, 특수조건 5, 조합 3, 달빛/특수 5, 산정특례 3
- **35개 약품 프리셋** (`DrugPresets`, L26-L230): 투약일수 경계 10종, 복용구분 7종, 급여유형 9종, 극값·Pack 4종, 실전패턴 5종

4개 `[Fact]` 테스트가 이 조합을 전수 실행한다:
- `All1505_처방전_전수테스트_예외없이_실행` (L305): TotalPrice >= 0 검증
- `All1505_금액정합성_검증` (L376): 음수/3자배분 검증
- `All1505_보험유형별_부담률_상한검증` (L482): 산재 UserPrice=0 등
- `전수검증_CSV리포트_생성` (L557): 전 건 CSV 출력

### 2-2. 우리의 대응 테스트

우리 TS 쪽에는 **1,505건 전수 루프에 해당하는 테스트가 없다.** `s01-verify.ts`가 S01 1건만 고정 검증한다.

**커버리지 비율**: 1건 / 1,505건 = **0.07%** (전수 루프 기준)

모듈 단위 테스트 ~200건은 개별 함수 레벨이므로 파이프라인 조합 커버리지와는 별개다.

---

## 3. WPF TestApp 시나리오 43개 vs 우리 19개 — 1:1 대조표

### 3-1. C# 43개 시나리오 (ComparisonPanel.cs L72-L131)

| # | 카테고리 | 시나리오명 | 핵심 조건 |
|---|---------|-----------|---------|
| 1 | 건강보험 | 건보 30세 일반 | C10, 30세 |
| 2 | 건강보험 | 건보 68세 고령 | C10, 68세 |
| 3 | 건강보험 | 건보 5세 소아 | C10, 5세 |
| 4 | 건강보험 | 건보 3세 영유아 | C10, 3세 |
| 5 | 건강보험 | 건보 종합병원 40% | C20, 30세 |
| 6 | 건강보험 | 건보 상급종합 50% | C10, 30세, hgGrade=4 |
| 7 | 의료급여 | 의급 1종 정액500원 | D10, 55세 |
| 8 | 의료급여 | 의급 2종 정률15% | D20, 45세 |
| 9 | 의료급여 | 의급 1종 70세 | D10, 70세 |
| 10 | 의료급여 | 의급 행려8종 | D80, 40세 |
| 11 | 의료급여 | 의급 1종 직접조제 | D10, 55세, isDirectJoje |
| 12 | 보훈 | 보훈 M10 100% | G10+M10, 70세 |
| 13 | 보훈 | 보훈 M20 30% | G10+M20, 65세 |
| 14 | 보훈 | 보훈 M30 50% | G10+M30, 60세 |
| 15 | 보훈 | 보훈 M50 60% | G10+M50, 55세 |
| 16 | 보훈 | 보훈 M60 80% | G10+M60, 70세 |
| 17 | 보훈 | 보훈 M83 90% | G10+M83, 60세 |
| 18 | 보훈 | 보훈 M90 | G10+M90, 65세 |
| 19 | 보훈 | 보훈위탁 G20+M10 | G20+M10, 75세 |
| 20 | 산재/자보 | 산재 요양급여 | E10, 40세 |
| 21 | 산재/자보 | 산재 후유증 | E20, 50세 |
| 22 | 산재/자보 | 자동차보험 | F10, 35세 |
| 23 | 시간가산 | 야간조제 (22시) | C10, 30세, isNight |
| 24 | 시간가산 | 토요조제 | C10, 30세, isSaturday |
| 25 | 시간가산 | 공휴일조제 | C10, 30세, isHolyDay |
| 26 | 시간가산 | 심야조제 (02시) | C10, 30세, isMidNight |
| 27 | 시간가산 | 소아 야간조제 | C10, 5세, isNight |
| 28 | 특수조건 | 직접조제 | C10, 30세, isDirectJoje |
| 29 | 특수조건 | 산제(가루약) 조제 | C10, 8세, isPowder |
| 30 | 특수조건 | 마약류 포함처방 | C10, 30세, isSpec34 |
| 31 | 특수조건 | 약물안전서비스 | C10, 30세, isDrugSafe |
| 32 | 특수조건 | 임산부 처방 | C10, 30세, isPregnant |
| 33 | 조합 | 의급1종+소아+야간 | D10, 5세, isNight |
| 34 | 조합 | 보훈60%+야간 | G10+M60, 70세, isNight |
| 35 | 조합 | 고령+토요+산제 | C10, 68세, isSaturday+isPowder |
| 36 | 달빛/특수 | 달빛어린이 소아야간 | C10, 5세, isNight, moonYn=1 |
| 37 | 달빛/특수 | 달빛어린이 15세야간 | C10, 15세, isNight, moonYn=1 |
| 38 | 달빛/특수 | 비대면조제 주간 | C10, 30세 |
| 39 | 달빛/특수 | 비대면조제 공휴 | C10, 30세, isHolyDay |
| 40 | 달빛/특수 | 보건소처방 의급1종 | D10, 55세, isHealthCenter |
| 41 | 산정특례 | 암 V193 본인5% | C10, 55세, V193 |
| 42 | 산정특례 | 희귀난치 V124 10% | C10, 40세, V124 |
| 43 | 산정특례 | 결핵 V001 면제 | C10, 35세, V001 |

### 3-2. 우리 TS 19개 시나리오 (scenarios.ts L28-L315)

| TS ID | 레이블 | 핵심 조건 |
|-------|--------|---------|
| S01 | 일반 3일 C10 45세 | C10, 45세 |
| S02 | 7일+외용 복합 C10 35세 | C10, 35세, 내복+외용 |
| S03 | 급여+비급여 혼합 C10 40세 | C10, 40세, 비급여 혼합 |
| S04 | 65세 저액 정액 C10 72세 | C10, 72세, 저액 |
| S05 | 6세미만 소아 C10 3세 | C10, 3세 |
| S06 | 의료급여 1종 D10 55세 | D10, 55세 |
| S07 | 보훈 M10 전액면제 C10+M10 70세 | C10+M10, 70세 |
| S08 | 야간+토요 가산 C10 45세 | C10, 45세, isNight+isSaturday |
| S09 | 산재 E10 본인부담 0원 | E10, 40세 |
| S10 | 자동차보험 F10 전액 본인 | F10, 35세 |
| S11 | 산재 후유증 E20 본인부담 0원 | E20, 50세 |
| S12 | 보훈위탁 G20+M10 75세 | G20+M10, 75세 |
| S13 | 직접조제 C10 45세 | C10, 45세, isDirectDispensing |
| S14 | 달빛어린이 야간 C10 5세 | C10, 5세, isNight, isDalbitPharmacy |
| S15 | 보훈 M60+야간 G10 60세 | G10+M60, 60세, isNight |
| S16 | 의료급여 2종+65세 D20 70세 | D20, 70세 |
| S17 | 의료급여 B014 30% D10 50세 | D10, 50세, sbrdnType=B014 |
| S18 | 행려 D80 전액면제 | D80, 40세 |
| S19 | 산제 가루약 ATB C10 8세 | C10, 8세, isPowder |

### 3-3. 1:1 매핑 결과

| C# 시나리오 | 우리 TS 대응 | 일치 여부 | 비고 |
|------------|------------|---------|------|
| 건보 30세 일반 | S01(45세) | ⚠ 나이 다름 | S01=45세, C#=30세 |
| 건보 5세 소아 | S05(3세) | ⚠ 나이 다름 | S05=3세(영유아), C#=5세 |
| 건보 3세 영유아 | S05(3세) | ✓ | C#도 3세 |
| 건보 68세 고령 | — | ✗ 없음 | S04=72세(저액조건)로 대체 불가 |
| 건보 종합병원 C20 | — | ✗ 없음 | C20 코드 시나리오 없음 |
| 건보 상급종합 hgGrade=4 | — | ✗ 없음 | hgGrade 설정 시나리오 없음 |
| 의급 1종 D10 | S06(55세) | ✓ | 연령 일치 |
| 의급 2종 D20 | S16(70세) | ⚠ 나이 다름 | C#=45세 |
| 의급 1종 70세 | S16(70세) | ⚠ 코드 다름 | S16=D20, C#=D10 |
| 의급 행려 D80 | S18(40세) | ✓ | |
| 의급 1종 직접조제 | — | ✗ 없음 | D10+isDirectJoje 조합 없음 |
| 보훈 M10 100% | S07(C10+M10) | ⚠ insuCode 다름 | S07=C10, C#=G10 |
| 보훈 M20 | — | ✗ 없음 | M20 시나리오 없음 |
| 보훈 M30 | — | ✗ 없음 | |
| 보훈 M50 | — | ✗ 없음 | |
| 보훈 M60 | S15(야간조합) | ⚠ 야간 조건 추가 | |
| 보훈 M83 | — | ✗ 없음 | |
| 보훈 M90 | — | ✗ 없음 | |
| 보훈위탁 G20+M10 | S12(G20+M10) | ✓ | |
| 산재 E10 | S09(E10) | ✓ | |
| 산재 후유증 E20 | S11(E20) | ✓ | |
| 자동차보험 F10 | S10(F10) | ✓ | |
| 야간조제 | S08(야간+토요) | ⚠ 토요 동시 | S08은 야간+토요 조합 |
| 토요조제 | — | ✗ 없음 | 토요 단독 없음 |
| 공휴일조제 | — | ✗ 없음 | |
| 심야조제 | — | ✗ 없음 | |
| 소아 야간조제 | S14(달빛+야간) | ⚠ 달빛 추가 | |
| 직접조제 | S13(직접조제) | ✓ | |
| 산제가루약 | S19(산제) | ✓ | 나이 차이(C#=8세, S19=8세) 일치 |
| 마약류(isSpec34) | — | ✗ 없음 | |
| 약물안전서비스 | — | ✗ 없음 | |
| 임산부 처방 | — | ✗ 없음 | |
| 의급+소아+야간 조합 | — | ✗ 없음 | |
| 보훈60%+야간 조합 | S15(G10+M60+야간) | ✓ | |
| 고령+토요+산제 조합 | — | ✗ 없음 | |
| 달빛소아야간 | S14(달빛+야간) | ✓ | |
| 달빛15세야간 | — | ✗ 없음 | |
| 비대면조제 주간 | — | ✗ 없음 | |
| 비대면조제 공휴 | — | ✗ 없음 | |
| 보건소처방 의급1종 | — | ✗ 없음 | |
| 산정특례 V193 암 | — | ✗ 없음 | |
| 산정특례 V124 희귀 | — | ✗ 없음 | |
| 산정특례 V001 결핵 | — | ✗ 없음 | |

**요약**:
- 완전 일치 (✓): 약 10개
- 부분 일치 (⚠): 약 7개
- C#에 있으나 우리에 없음 (✗): **약 26개** (43개 중 60%)

---

## 4. 기대값 출처 분석

### 4-1. C# 골든값 출처

C# IntegrationTests의 Assert 값은 **WPF TestApp 실측값** 기반이다:

- `S01VerificationTest.cs:L50-L54` — 직접 assert: TotalPrice=19710, SumWage=9210, UserPrice=5900
  - 주석에 "Z5107(의약품관리료 7일=550) 포함"이라고 명시하여 계산 근거 추적 가능
- `VeteranTests.cs:L25-L40` — TotalPrice=11060, UserPrice=0, InsuPrice=4420, MpvaPrice=6640, SumWage=3710
  - 이 값들은 MockCalcRepository + TestDrugFactory 기본 약품으로 C# 엔진이 계산한 실측값
- `PolicyGoldenTests.cs:L12-L15` — C21/C31 전액면제: TotalPrice=14720 고정
- `HealthInsuranceTests.cs:L24` — 주석에 "약품비 = 150*1*3*3 + 500*2*2*3 = 7,350원" 계산식 명시

**출처 분류**:
- `PolicyGoldenTests`, `VeteranTests`: WPF TestApp에서 실행 후 캡처한 C# 엔진 실측값
- `S01VerificationTest`: 수작업 계산 후 C# 엔진으로 확인한 값
- `EdgeCaseGoldenTests`: `> 0` 형태의 구조 검증이 많아 구체적 숫자 없음
- `HighPriorityRegressionTests`: 회귀 방지용 정밀 골든값 (SpecialPub 302/101/102 등)

### 4-2. 우리 TS 기대값 출처

- `s01-verify.ts:L90-L96` — S01 기대값: sumInsuDrug=10500, sumWage=8660, totalPrice=19160, userPrice=5700
  - 주석에 직접 계산식 명시: "Z1000:790 + Z2000:1720 + Z3000:1150 + Z4107:4320 + Z5000:680 = 8660"

**중요 불일치**: C# S01과 TS S01의 기대값이 **다르다**:
- C# `S01VerificationTest.cs:L51-L54`: TotalPrice=**19710**, SumWage=**9210**, UserPrice=**5900**
- TS `s01-verify.ts:L90-L96`: totalPrice=**19160**, sumWage=**8660**, userPrice=**5700**

차이 원인: C# 쪽은 Z5107(의약품관리료 7일=550)을 포함하고, TS 쪽은 Z5000(680)만 계상. 또한 C#의 입력 조건은 40세지만 s01-verify.ts도 40세로 동일하므로 수가 테이블 차이(Z5107 vs Z5000) 때문이다.

---

## 5. C# 시나리오 중 우리가 빠뜨린 주요 항목

### 5-1. [🔴 Missing / Critical] 산정특례 시나리오 (V193/V124/V001) 전무

- C#: `InsuranceScenarios L295-L297`, `PolicyGoldenTests.cs:HealthInsurance_V252_*`, `EdgeCaseGoldenTests.cs:산정특례_부담률_검증`
- 우리: modules-exemption.test.ts에서 `determineExemptionRate` 단위 테스트만 있음 — 파이프라인 통합 검증 없음
- 영향: V193(5%), V124(10%), V001(면제) 등 암·희귀·결핵 환자 부담금이 파이프라인 수준에서 검증되지 않음

### 5-2. [🔴 Missing / Critical] 공휴일/심야/토요 단독 시나리오 없음

- C#: `Scenarios L104-L106` — 토요/공휴/심야 각각 독립 시나리오
- 우리: S08이 야간+토요 **조합**만 있음; 토요 단독, 공휴일 단독, 심야 단독 없음
- `modules-saturday.test.ts`는 함수 단위만 커버

### 5-3. [🔴 Missing / Critical] 보훈 M20/M30/M50/M83/M90 시나리오 없음

- C#: `Scenarios L87-L93` — M20, M30, M50, M83, M90 각각 독립 시나리오
- 우리: S07(M10), S12(G20+M10), S15(M60+야간) 3개뿐
- 특히 **M20 이중감면** 로직은 `PolicyGoldenTests.cs:L93-L117` 에서 별도 골든값 존재 (TotalPrice=11060, UserPrice=300, InsuPrice=7760, MpvaPrice=3000)

### 5-4. [🔴 Missing / Critical] 마약류(isSpec34)/약물안전서비스(isDrugSafe)/임산부(isPregnant) 시나리오 없음

- C#: `Scenarios L111-L113`
- 우리: 해당 플래그 관련 시나리오 또는 모듈 테스트 없음

### 5-5. [🟠 Missing / High] C20/C30(종합병원/상급종합) 시나리오 없음

- C#: `Scenarios L76-L77`, `InsuranceScenarios L243-L244`
- 우리: C10만 존재

### 5-6. [🟠 Missing / High] 보건소(isHealthCenter) / 비대면조제 시나리오 없음

- C#: `Scenarios L125` (보건소+의급1종), `L123-L124` (비대면)
- 우리: 없음

### 5-7. [🟠 Missing / High] 의급 직접조제(D10+isDirectJoje) 시나리오 없음

- C#: `Scenarios L84`
- 우리: C10 직접조제(S13)만 있음

### 5-8. [🟡 Insufficient / Medium] 달빛어린이 15세 시나리오 없음

- C#: `Scenarios L122` — 달빛 15세 야간
- 우리: S14(5세)만 있음

### 5-9. [🟡 Insufficient / Medium] 조합 시나리오 부족 (고령+토요+산제, 의급+소아+야간)

- C#: `Scenarios L116-L118` — 3개 조합 시나리오
- 우리: S15(보훈+야간) 1개뿐, 의급+소아+야간 없음

---

## 6. 검증 정확도 종합 평가

### 6-1. C# 테스트 정합성

C# 쪽은 3계층이 정합적으로 구성되어 있다:
- `RoundingHelperTests` → 함수 단위
- IntegrationTests 12개 파일 → 보험 유형별 골든값 + 엣지케이스 + 회귀
- `Prescription1505Tests` → 1,505건 전수 자동 루프

특히 `HighPriorityRegressionTests.cs`(528줄)는 SpecialPub(302/101/102), OverUserPrice(본인부담 초과), 100% 자부담 등록/미등록 구분 등 **고급 분기**를 촘촘히 커버한다.

### 6-2. TS 테스트의 강점

- 반올림 함수(rounding.test.ts): 22건으로 C# RoundingHelperTests보다 풍부
- 보훈(modules-veteran.test.ts): M10/M30/M50/M60/M82/M83 + G10/G20 비위탁/위탁 조합 21건 — 함수 레벨 커버리지 우수
- 안전망(modules-safety-net.test.ts): 소득분위별 상한, 초과 계산 상세 검증 — C#에는 대응 단위 테스트 없음
- 명절가산(modules-seasonal.test.ts): 2024추석/2025설날/추석 날짜별 코드 분기 — C# 단위 테스트에 없는 고유 커버리지

### 6-3. TS 테스트의 약점

| 구분 | 내용 | 심각도 |
|------|------|-------|
| 파이프라인 E2E 부재 | 1,505건은커녕 S01 1건만 | 🔴 Critical |
| 시나리오 커버리지 40% | C# 43개 중 실질 대응 ~17개 | 🔴 Critical |
| 산정특례 통합 테스트 없음 | V193/V124/V001 파이프라인 미검증 | 🔴 Critical |
| S01 기대값 차이 | C# 19710원 vs TS 19160원 (Z5107 550원 차) | 🟠 High |
| 1,505건 루프 없음 | 35종 약품 프리셋 조합 검증 불가 | 🟠 High |
| 보험 유형 조합 부족 | C20/C30/sbrdnType/isSpec34 등 미포함 | 🟠 High |

### 6-4. S01 기대값 불일치 상세

C# `S01VerificationTest.cs:L51`:
```csharp
Assert.Equal(9210m, result.SumWage);   // Z5107(550) 포함
Assert.Equal(19710m, result.TotalPrice);
Assert.Equal(5900m, result.UserPrice);  // trunc100(19710×30%)=5900
```

TS `s01-verify.ts:L91-L93`:
```typescript
sumWage: 8660,    // Z5107 없음 (Z5000:680만 계상)
totalPrice: 19160,
userPrice: 5700,  // trunc100(19160×30%)=5700
```

차이: Z5107(의약품관리료 7일 구간) **550원** 미산정. 이는 TS MockRepository가 Z5107 코드를 수가 테이블에 등록하지 않았기 때문이다 (`s01-verify.ts:L22-L31` — Z5107 없음).

---

## 7. 권고 사항

1. **[🔴 즉시]** 파이프라인 통합 테스트 최소 19개 시나리오 → Jest/Vitest 기반으로 전환하여 기대값 Assert 추가 (현재 s01-verify.ts 방식은 프레임워크 없음)
2. **[🔴 즉시]** s01-verify.ts 기대값 수정 또는 Z5107 Mock 수가 추가 — C# 실측값(19710/9210/5900)과 정합 필요
3. **[🔴 즉시]** V193/V124/V001 산정특례 시나리오 파이프라인 테스트 추가
4. **[🟠 고우선]** C# InsuranceScenarios 43개를 기준으로 우리 시나리오 확장 (현재 19개 → 43개)
5. **[🟠 고우선]** isSpec34/isDrugSafe/isPregnant 특수조건 시나리오 추가
6. **[🟡 중간]** C# DrugPresets 35종 중 T02(외용단독), T03(주사단독), I02(비급여단독) 등 약품 조합 커버리지 추가

**[약제비 분석용]**
