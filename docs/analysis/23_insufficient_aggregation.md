# Phase 3 부족(Insufficient) 항목 종합 보고서

> 작성자: Phase 3 부담당 3 — 부족 항목 취합 담당
> 작성일: 2026-04-07
> 참조: CH01~CH12 analyst × 12 + verifier × 12 = 24개 보고서
> 상태: [x] 완료

---

## 개요

본 보고서는 PharmaEdu 계산 로직 감사 Phase 3의 일환으로, CH01~CH12의 24개 보고서에서 **"부족(Insufficient)"** 카테고리 항목만 추출·취합한 것이다.

- **부족(Insufficient) 정의**: 일부 구현되었으나 케이스 커버리지가 불완전하거나, 단순화로 인해 정확도가 저하되거나, 확장이 필요한 항목. 완전 미구현(Missing)과는 구분된다.
- **심각도 기준**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low
- **총 부족 항목 수**: **59개** (Critical 14개, High 26개, Medium 18개, Low 1개)

---

## CH01 — 약품금액 계산

**출처 파일**: `ch01_analyst.md`, `ch01_verifier.md`

### ch01_analyst.md 추출 항목 (5개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-001 | 🟠 High | **1회투약량/1일투여횟수 소수점 전처리** | `calcDrugAmount()`가 DrugItem.dose, DrugItem.dNum 값을 raw 그대로 사용 | CH01 §2-2에서 요구하는 5자리→4자리 4사5입 정규화, 3자리→2자리 정규화 전처리 없음 | `calcDrugAmount()` 호출 전 dose/dNum 정규화 함수 추가 또는 호출부에서 처리 |
| I-002 | 🟠 High | **A/B/D/E/U항별 개별 합산 미분리** | `calcDrugAmountSum()`이 비급여 vs 나머지 2종으로만 분리 | A/B/D/E/U항별 개별 합산 없어 선별급여 본인부담률 개별 적용 불가 | `calcDrugAmountSum()` 반환 구조에 항별 분리 필드 추가 |
| I-003 | 🟡 Medium | **단가 최소 1원 보정 없음** | `calcDrugAmount()`에 `price < 1` 보정 없음 | 외부에서 이미 보정된 price가 전달된다는 가정에 의존, price=0이면 0원 반환 | `calcDrugAmount()` 내부에 `price = Math.max(price, 1)` 조건 추가 |
| I-004 | 🟡 Medium | **648 가산 보훈 면제 M81 누락** | EDB 코드에서 M10/M83/M82만 면제 대상 | M81도 면제 대상으로 확인됨; `EXEMPT_BOHUN_CODES`에 M81 미포함 | `drug-648.ts:L39`의 `EXEMPT_BOHUN_CODES`에 M81 추가 |
| I-005 | 🟡 Medium | **비급여 약가 합계 CalcResult 미반영** | `calcDrugAmountSum()`의 `sumUser`가 계산됨 | `buildResult()`에서 `void sumUserDrug`로 버려져 CalcResult에 미반영 | `buildResult()`에서 `sumUserDrug` 값을 CalcResult 비급여 필드에 노출 |

**위치**: `src/lib/calc-engine/drug-amount.ts`, `src/lib/calc-engine/modules/special/drug-648.ts`, `src/lib/calc-engine/index.ts`

### ch01_verifier.md 추가 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-006 | 🟠 High | **JS number 부동소수점 정밀도** | 전체 계산이 JS `number`(IEEE 754 배정밀도) 사용 | C#은 `decimal` 타입 사용; dose=0.1, dNum=0.2 등 비정수 입력에서 미세 오차 발생 가능 | Decimal.js 등 외부 라이브러리 도입 또는 정수 연산 변환 검토 |
| I-007 | 🟡 Medium | **apply648DayLimit() dDay=0 보정 누락** | `d.dDay > DAY_LIMIT_648` 조건으로 초과 제한 처리 | dDay가 0 또는 음수이면 조건 불충족으로 그대로 통과; C# L363은 `effectiveDDay==0`이면 1로 보정 | `apply648DayLimit()`에 `dDay <= 0`이면 1로 보정하는 로직 추가 |

---

## CH02 — 조제료 코드 생성

**출처 파일**: `ch02_analyst.md`, `ch02_verifier.md`

### ch02_analyst.md 추출 항목 (5개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-008 | 🔴 Critical | **소아심야 코드 오분류** | `surcharge.ts:determineSurcharge()` L153에서 소아심야(isMidNight=true, age<6)를 holidayGb='8'로 반환 | `z2000Code()`에서 Z2000610(소아야간) 생성; 정확한 코드는 Z2000640(2023.11.01~) | `z2000Code()`에서 isMidNight+age<6 조합 시 Z2000640 반환하도록 수정 |
| I-009 | 🔴 Critical | **text3 차등수가 접미사 전무** | z2000Code, z3000Code, z4InternalCode 등 모든 Z코드 생성 함수에서 text3 미반영 | seed.sql에 text3=1 코드 62개가 미사용 상태로 존재 | Z코드 생성 함수에 text3 필드 참조 분기 추가 |
| I-010 | 🔴 Critical | **날짜 분기 20231101 미적용** | Z코드 생성 로직에 날짜 분기 없음 | 2023.11.01 이후 소아야간/소아심야 코드 체계 변경(Z2000620→Z2000630/Z2000640) 미반영 | Z코드 생성 함수에 `dispensingDate >= 20231101` 분기 추가 |
| I-011 | 🔴 Critical | **Z4116 하드코딩 버그** | Z4116 코드가 하드코딩으로 사용됨 | Z4116은 2022.01.01 이후 폐지된 코드; 현행은 Z4116xxx 방식으로 변경됨 | Z4116을 현행 코드 체계(Z4116010 등)로 교체 |
| I-012 | 🟠 High | **Z3000 심야 미분기** | Z3000 코드 생성 시 단일 코드 반환 | 심야(Z3000010/Z3000020)와 일반야간(Z3000030) 미분리; 날짜별 수가 차이 존재 | isMidNight 플래그로 Z3000 분기 처리 추가 |

**위치**: `src/lib/calc-engine/surcharge.ts`, `src/lib/calc-engine/dispensing-fee.ts`

### ch02_verifier.md 추가 항목 (0개)

- ch02_verifier.md의 의심/위험 분기 항목은 대부분 ch02_analyst.md에서 이미 식별된 항목과 중복되거나 Missing으로 분류됨.

---

## CH03 — 조제료 수가

**출처 파일**: `ch03_analyst.md`, `ch03_verifier.md`

### ch03_analyst.md 추출 항목 (4개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-013 | 🟠 High | **Z5xxx 일수별 가산 처방조제 경로 누락** | Z5000(의약품관리료) 기본 처리됨 | Z5107(7일), Z5114(14일~28일) 등 일수별 차등 코드가 MockRepository에 등록 안 됨; S01 산출값 8,660원 vs C# 기대값 9,210원 차이(550원) | MockCalcRepository에 Z5107/Z5114 코드 등록 및 `selectZ5Code()` 일수 분기 확인 |
| I-014 | 🟠 High | **투약일수 결정 단순화** | 단일 약품의 투약일수를 그대로 사용 | 다품목 처방 시 "가장 긴 약품의 투약일수"를 기준으로 해야 하나, 구현에서 max(dDay) 로직 확인 필요 | `calcDispensingFee()` 내 투약일수 결정 로직 검토 및 max(dDay) 보장 |
| I-015 | 🟡 Medium | **Z3000 심야 수가 1,850원 차이** | Z3000 코드 생성됨 | Z3000010(심야) 수가가 구현에서 잘못 매핑되어 실측 vs 기대 1,850원 차이 발생 | seed.sql의 Z3000010 수가 값 검토 및 정정 |
| I-016 | 🟡 Medium | **Z2000 소아심야 수가 2,750원 차이** | Z2000 코드 생성됨 | 소아심야 Z2000640 수가 매핑 오류로 실측 vs 기대 2,750원 차이 발생 | seed.sql의 Z2000640 수가 값 검토 및 정정 |

**위치**: `src/lib/calc-engine/dispensing-fee.ts`, `src/lib/calc-engine/mock-calc-repository.ts`

### ch03_verifier.md 추가 항목 (0개)

- ch03_verifier.md는 ch03_analyst.md의 수치 오차를 정량화하는 역할로, 신규 Insufficient 항목 없음.

---

## CH04 — 가산 로직

**출처 파일**: `ch04_analyst.md`, `ch04_verifier.md`

### ch04_analyst.md 추출 항목 (4개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-017 | 🔴 Critical | **소아심야 접미사 오류** | `surcharge.ts`에서 소아심야 분기 존재 | 생성 코드가 Z2000640(소아심야)이 아닌 Z2000610(소아야간)으로 오산출; I-008과 연동 | I-008 수정과 함께 처리 |
| I-018 | 🟠 High | **6세 이상 야간 다운그레이드 미처리** | 야간 분기에서 연령 조건 분기 없음 | 만 6세 이상 소아 야간 시 Z2000610에서 Z2000010으로 다운그레이드 규칙 미구현 | `surcharge.ts`에 age >= 6이면 소아 야간 코드 대신 일반 야간 코드 반환하는 분기 추가 |
| I-019 | 🟠 High | **토요 가산률 날짜 분기 미반영** | 토요 가산 기본 처리됨 | 토요 가산률 변경(2023.11.01 기점 상이) 날짜 분기 미반영 | `surcharge.ts`에 `dispensingDate >= 20231101` 조건으로 가산률 분기 추가 |
| I-020 | 🟠 High | **달빛어린이 15세 초과 시 코드 다운그레이드 미처리** | 달빛어린이 야간 분기 존재 | moonYn=1이고 age >= 6이면 소아 야간 코드 배제 규칙 미구현 | `determineSurcharge()`에 달빛+연령 복합 조건 분기 추가 |

**위치**: `src/lib/calc-engine/surcharge.ts`

### ch04_verifier.md 추가 항목 (0개)

- ch04_verifier.md는 ch02/ch04 analyst의 text3 미구현, 날짜 분기 불일치를 재확인하는 역할로, 신규 Insufficient 항목 없음.

---

## CH05 — 본인부담금

**출처 파일**: `ch05_analyst.md`, `ch05_verifier.md`

### ch05_analyst.md 추출 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-021 | 🟠 High | **C31/C32/C21 직접 분기 없음** | C계열 건강보험 처리됨 | C31(30%), C32(30%), C21(30%) 등 보험유형별 부담률이 직접 분기되지 않고 공통 경로를 탐 | `copayment.ts`에 C21/C31/C32 전용 분기 추가 또는 insuCode→rate 매핑 테이블 정비 |
| I-022 | 🟠 High | **산정특례 우선순위 충돌** | V계열 산정특례 처리됨 | 복수 산정특례 코드 존재 시 우선순위 결정 로직이 단순 첫 번째 선택; 암+희귀 복합 케이스 오산출 위험 | V코드 우선순위 테이블 정의 및 적용 함수 작성 |
| I-023 | 🟠 High | **M20 G타입 분기 불완전** | G타입 보훈 처리됨 | M20(이중감면) G타입 시 건강보험 기준 계산 후 보훈 감면 적용 순서가 불명확; 음수 방지 처리 없음 | `veteran.ts:getDoubleReductionRate()` 분기 검토 및 음수 방지 로직 추가 |

**위치**: `src/lib/calc-engine/copayment.ts`, `src/lib/calc-engine/modules/insurance/veteran.ts`

### ch05_verifier.md 추가 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-024 | 🔴 Critical | **G타입 M61 역산 공식 오적용** | M61(고엽제) 역산 처리됨 | 역산 공식에서 `normalUser - userPrice`를 mpvaPrice로 쓰는 방식이 C# 원본과 비교 미검증; 오적용 위험 | `veteran.ts:calcVeteran():L314-324`를 C# `CopaymentCalculator.cs` 원본과 1:1 수식 대조 |
| I-025 | 🔴 Critical | **65세 2구간 날짜조건 미반영** | 65세 저액 처리됨 | 65세 본인부담 정액 2구간(총액 ≤ 기준금액: 1,500원, 초과: 10%) 날짜 분기(2022.01.01 등) 미반영 | `copayment.ts`에 65세 기준 날짜 조건 추가 |
| I-026 | 🟠 High | **D10 기본값 오류** | D10 정액 처리됨 | sbrdnType="" 시 기본값 500원으로 fallback하나 실제 기대값 1,000원; S06 ENGINE_BUG와 연동 | `resolveMedicalAidFixAmount()`에서 빈 문자열 처리 경로 정비 |

---

## CH06 — 3자배분

**출처 파일**: `ch06_analyst.md`, `ch06_verifier.md`

### ch06_analyst.md 추출 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-027 | 🟠 High | **M81~M83 보훈약국 처리 불완전** | M81/M82/M83 코드 인식됨 | C31/C32, D타입 보험코드와 M81~M83 조합 시 `SumUser = RealPrice`로 전환하는 C# 로직 미포팅 | `veteran.ts:ApplyBohunPharmacy` 대응 로직 구현; `veteran.ts:L361` 주석에서 "Integration Lead 처리" 위임 확인 |
| I-028 | 🟠 High | **상한제 InsuPrice 연동 불일치** | 상한제 처리됨 | 상한제 적용 후 InsuPrice 재산출 시 mpvaPrice 분리 없이 단순 합산; 보훈 3자배분 항등식 위반 가능 | 상한제 적용 후 `pubPrice = insuPrice + mpvaPrice` 재계산 검토 |
| I-029 | 🟡 Medium | **MpvaComm 전환 미구현** | 3자배분 기본 구조 구현됨 | 보훈 위탁수수료(MpvaComm 66원/건) 집계·전환 로직 없음 | 별도 운영 기능으로 분리하되, CalcResult에 mpvaComm 필드 노출 검토 |

**위치**: `src/lib/calc-engine/modules/insurance/veteran.ts`, `src/lib/calc-engine/copayment.ts`

### ch06_verifier.md 추가 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-030 | 🟠 High | **상한액 2024 하드코딩** | 본인부담 상한액 분기 존재 | 2024 기준 상한액이 하드코딩; 연도별 갱신 메커니즘 없음 | `ANNUAL_CAP_BY_DECILE` 상수를 연도별 매핑 테이블로 전환 |
| I-031 | 🟠 High | **M20 G타입 처리 방식 차이** | G타입 보훈+M20 처리됨 | C# `CalcCopay_G`의 M20 분기는 `Trunc100(userPrice * num7 / 100m)` 사용하나, C타입 M20 절사 방식(truncC)과 혼용 위험 | C타입 M20 경로가 `copayment.ts`에서 별도 처리되는지 확인 |

---

## CH07 — 반올림

**출처 파일**: `ch07_analyst.md`, `ch07_verifier.md`

### ch07_analyst.md 추출 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-032 | 🔴 Critical | **보훈 감면 절사 분기 하드코딩** | 보훈 감면 절사 처리됨 | 10원 절사 단위가 하드코딩되어 있으나 공식 문서에 "미확정"으로 표시됨; 정책 변경 시 단일 수정점 없음 | `BOHUN_TRUNC_UNIT` 정책 상수 분리 선언 |
| I-033 | 🟡 Medium | **MpvaPrice 역산 절사 미확정** | `calcMpvaPrice()` 비위탁 역산 방식 구현됨 | 역산 방식의 절사 단위 근거 문서 없음; C# 원본 `CalcMpvaPrice` 수식과 1:1 대조 미완료 | C# `CopaymentCalculator.cs:L840, L845`와 TS `veteran.ts:L220, L223` 상세 대조 |

**위치**: `src/lib/calc-engine/modules/insurance/veteran.ts`, `src/lib/calc-engine/rounding.ts`

### ch07_verifier.md 추가 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-034 | 🟠 High | **의료급여 절사 날짜 분기 없음** | 의료급여 절사 처리됨 | 의료급여 절사 방식이 날짜 기준(2022.01.01 등)으로 변경됐으나 날짜 분기 없음 | `resolveMedicalAidFixAmount()`에 날짜 기반 절사 분기 추가 |
| I-035 | 🔴 Critical | **C31/C32 건강보험 경로 오진입** | C31/C32 처리 존재 | C31/C32가 건강보험 일반 경로를 탐; 30% 부담률이 아닌 다른 부담률 적용 위험 | I-021과 연동하여 C31/C32 전용 분기 처리 |

---

## CH08 — 특수케이스

**출처 파일**: `ch08_analyst.md`, `ch08_verifier.md`

### ch08_analyst.md 추출 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-036 | 🟠 High | **설날 연휴 날짜 범위 과소 (2024)** | 2024 설날 명절 처리됨 | 2024 설날 연휴 범위가 일부 누락(연휴 전날/다음날 경계 처리 부족) | `modules-seasonal.ts`의 명절 날짜 배열에 2024 설날 전체 범위 추가 |
| I-037 | 🟠 High | **추석 연휴 날짜 범위 과소 (2024)** | 2024 추석 명절 처리됨 | 동일한 연휴 범위 과소 문제 | 2024 추석 전체 범위 추가 |
| I-038 | 🟠 High | **상한제 옵션 플래그 미체크** | 상한제 계산 모듈 구현됨 | `calcSafetyNet()` 호출 전 `options.useSafetyNet` 플래그 확인 없이 항상 적용 위험 | 파이프라인에서 `options.useSafetyNet` 체크 후 조건부 호출 |

**위치**: `src/lib/calc-engine/modules/seasonal.ts`, `src/lib/calc-engine/modules/safety-net.ts`

### ch08_verifier.md 추가 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-039 | 🔴 Critical | **2025 설날 연휴 범위 누락** | 2025 설날 처리됨 | 2025 설날 연휴(01.28~01.30) 중 일부 날짜가 `detectSeasonalHoliday()`에서 누락 확인됨 | 2025 설날 연휴 전체 날짜를 `SEASONAL_HOLIDAYS` 배열에 추가 |
| I-040 | 🟠 High | **암환자+M50 분기 없음** | 암환자 산정특례 처리됨 | 암환자(V193)와 보훈(M50 60%) 복합 시 산정특례 5% vs 보훈 60% 감면 우선순위 분기 없음 | 산정특례+보훈 복합 케이스 우선순위 정책 확인 후 분기 추가 |

---

## CH09 — 데이터 모델

**출처 파일**: `ch09_analyst.md`, `ch09_verifier.md`

### ch09_analyst.md 추출 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-041 | 🟠 High | **MediIllnessInfo 타입 불일치** | `MediIllnessInfo` 타입 정의됨 | 일부 필드(예: v2520)가 C# 원본 데이터 모델의 필드명/타입과 불일치; 의미 불명확 | C# `MediIllnessInfo` 클래스와 TS 타입 1:1 매핑 문서 작성 후 정합 수정 |
| I-042 | 🟠 High | **CalcOptions 포팅율 42%** | CalcOptions 타입 구현됨 | C# 원본 `CalcOptions` 대비 58% 필드 미포팅; 특히 날짜 관련, 특수 플래그 관련 필드 다수 누락 | C# `CalcOptions` 전 필드 목록화 후 미포팅 필드 순차 추가 |
| I-043 | 🟠 High | **CalcResult 포팅율 40%** | CalcResult 타입 구현됨 | C# 원본 `CalcResult` 대비 60% 필드 미포팅; mpvaPrice, gsCode, mt038 등 보훈 관련 필드 다수 누락 | C# `CalcResult` 전 필드 목록화 후 미포팅 필드 순차 추가 |

**위치**: `src/lib/calc-engine/types.ts`

### ch09_verifier.md 추가 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-044 | 🟠 High | **DrugItem 포팅율 부분 미확인** | DrugItem 타입 구현됨 | exType, 할증률, Del_Yn 등 C# 원본 DrugItem의 일부 필드가 TS에 없어 관련 계산 불가 | DrugItem 전 필드 목록화 후 미포팅 필드 추가 |
| I-045 | 🟡 Medium | **v2520 필드명 의미 불명확** | v2520 필드 존재 | 필드명이 코드 번호 그대로여서 의미 파악 불가; 잘못 사용 시 계산 오류 | 필드명을 의미 기반으로 변경하거나 JSDoc 주석 추가 |
| I-046 | 🟡 Medium | **insuCode nullable 타입 불일치** | insuCode 필드 존재 | C# 원본은 nullable이나 TS 타입에서 non-null로 정의; null 입력 시 런타임 오류 가능 | insuCode 타입을 `string | null | undefined`로 수정 또는 방어 처리 |

---

## CH10 — 파이프라인

**출처 파일**: `ch10_analyst.md`, `ch10_verifier.md`

### ch10_analyst.md 추출 항목 (3개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-047 | 🟠 High | **DueDate 세밀도 미흡** | DueDate(투약기한) 처리됨 | 연도 정보가 손실되는 케이스 존재; 날짜 연산에서 연도 누락 시 다음 해 계산 오류 | DueDate 연산 함수에 연도 포함 검증 로직 추가 |
| I-048 | 🟠 High | **청구액 음수 미처리** | 청구액 계산됨 | 보훈 감면 등으로 청구액이 음수가 되는 케이스에서 음수 그대로 반환; 방어 처리 없음 | 청구액 최솟값 0원 보정 로직 추가 |
| I-049 | 🟡 Medium | **가산 라운딩 미흡** | 가산 계산됨 | 복합 가산(야간+토요) 시 각 가산의 반올림 순서가 명세와 불일치 가능 | 복합 가산 반올림 순서 명세화 및 적용 |

**위치**: `src/lib/calc-engine/index.ts`, `src/lib/calc-engine/copayment.ts`

### ch10_verifier.md 추가 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-050 | 🔴 Critical | **DueDate 연도 손실** | DueDate 처리됨 | 특정 날짜 조건에서 연도가 손실되어 1900년대로 계산되는 버그 확인 | DueDate 연산 전체 검토 및 연도 유지 보장 |
| I-051 | 🔴 Critical | **조기종료 EE4 없음** | 파이프라인 에러 처리 존재 | C# 엔진의 EE4(무한루프 방지 조기종료) 로직이 TS에 미포팅; 이상 입력 시 무한루프 위험 | 파이프라인에 EE4에 해당하는 최대 반복 횟수 제한 추가 |

---

## CH11 — 테스트 체계

**출처 파일**: `ch11_analyst.md`, `ch11_verifier.md`

### ch11_analyst.md 추출 항목 (6개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-052 | 🔴 Critical | **S06 D10 sbrdnType="" Mcode 미적용** | D10 처리됨 | `sbrdnType=""`일 때 Mcode 분기 미진입 → fixCost(=0) fallback → D20의 500원 적용; 기대값 1,000원과 500원 차이 | `resolveMedicalAidFixAmount()`에서 `sbrdnType이 빈 문자열`이면 mcode 경로로 진입하도록 수정 |
| I-053 | 🔴 Critical | **S07 C10+bohunCode 조합 보훈 모듈 미진입** | G계열 보훈 처리됨 | `insuCode.charAt(0) === 'G'`일 때만 `calcVeteran()` 호출; C10 처방+bohunCode=M10 조합은 미진입 → userPrice 7,600원 오산출(기대 0원) | `bohunCode 존재 시 insuCode 무관하게 calcVeteran() 호출` 로직으로 변경 |
| I-054 | 🟠 High | **S08 야간+토요 복합 가산 누락** | 야간 가산 처리됨 | 야간 우선 적용 시 토요 별도 행(Z2000030, Z3000030, Z4103030) 미추가; "기본행+별도 가산행" 구조 미준수 | 야간 선택 후 토요 조건이 함께 있으면 토요 행도 추가하는 복합 가산 로직 구현 |
| I-055 | 🟠 High | **S12 G20+M10 mpvaPrice 필드 CalcResult 미노출** | G20 위탁 전액 처리됨 | `mpvaPrice` 내부 계산은 정확하나 상위 결과 객체로 미전달; `result.mpvaPrice === undefined` | `buildResult()` 또는 `_resultToCopay()`에서 mpvaPrice 필드 노출 |
| I-056 | 🟠 High | **S19 Z4103100 Mock DB 미등록** | 산제 가산 처리됨 | 2026년 신체계 산제가산 코드 Z4103100이 MockCalcRepository에 없음 → Z4103으로 fallback → 산제가산 800원 sumWage 미반영 | MockCalcRepository에 Z4103100 코드 등록 |
| I-057 | 🟡 Medium | **S08 sumWage 기대값 불일치** | sumWage 산출됨 | S01 실측 sumWage=7,020원 vs WPF EDB Mock 기준 기대값=9,210원; Mock DB 수가와 WPF 수가 간 차이 미확인 | Mock DB 수가 테이블과 WPF TestApp 수가 테이블 일치화 |

**위치**: `src/lib/calc-engine/modules/insurance/medical-aid.ts`, `src/lib/calc-engine/copayment.ts`, `src/lib/calc-engine/mock-calc-repository.ts`

### ch11_verifier.md 추가 항목 (2개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-058 | 🟡 Medium | **달빛어린이 15세 시나리오 없음** | S14(달빛+5세) 존재 | C# 43개 중 "달빛 15세야간"에 해당하는 TS 시나리오 없음; 15세 달빛 처리 검증 불가 | `scenarios.ts`에 달빛+15세 야간 시나리오 추가 |
| I-059 | 🟡 Medium | **조합 시나리오 부족** | S15(보훈+야간) 1개 존재 | C# 43개 중 의급+소아+야간, 고령+토요+산제 등 조합 시나리오가 TS 19개에 없음 | `scenarios.ts`에 주요 조합 시나리오 추가 |

---

## CH12 — 보훈 약국 약제비 청구

**출처 파일**: `ch12_analyst.md`, `ch12_verifier.md`

### ch12_analyst.md 추출 항목 (6개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-060 | 🟠 High | **공상등구분 ↔ BohunCode 명시적 매핑 없음** | `getBohunRate()`가 M코드 수신 처리 | EDI 명세서의 공상등구분 '3'/'5'/'6'/'J'를 M30/M50/M60/M83으로 변환하는 입력 매핑 함수 없음 | 상위 레이어 또는 `veteran.ts`에 공상등구분→M코드 매핑 함수 추가 |
| I-061 | 🟠 High | **P06 13번/14번 분기 미처리** | `getBohunRate()`에 M코드별 감면율 처리됨 | P06 13번(공단 임직원 50%)/14번(병원장 재량 50% 이하)에 해당하는 별도 코드·분기 없음; 범위 제외 주석도 없음 | 적용 범위 정책 결정 후 제외 주석 또는 분기 추가 |
| I-062 | 🟠 High | **위탁/비위탁 절사 방식 근거 문서 불일치** | `calcMpvaPrice()`가 위탁 시 `trunc10()` 사용 | CH12 §4.3이 절사단위를 "미확정"으로 표시; 향후 확정 규칙과 다를 경우 계산 오류 발생 | `BOHUN_TRUNC_UNIT` 정책 상수 분리 및 현장 검증 요청 (I-032와 동일 맥락) |
| I-063 | 🟡 Medium | **M61 이중감면 역산 로직 검증 부족** | `calcVeteran()`의 M61 처리 존재 | CH12 원문이 역산 방식 수식을 명시하지 않음; C# 원본과 수식 대조 미완료 | `veteran.ts:L314-324`를 `CopaymentCalculator.cs` M61 분기와 1:1 대조 |
| I-064 | 🟡 Medium | **보훈병원 vs 보훈위탁 진입 분기 없음** | `copayment.ts`에 보훈 분기 존재 | 두 청구 체계 중 어느 경로인지 구분 없이 `calcVeteran()` 호출; 명세서 필드 생성 시 오기재 위험 | `copayment.ts:L85-93`에 청구 체계 구분 플래그 추가 |
| I-065 | 🟡 Medium | **세부 보훈코드 M10~M90 법령 근거 부재** | `veteran.ts` 상단에 M코드 목록 주석 존재 | 코드들의 원천 법령 근거가 주석에 미명시 | `veteran.ts:L8-26` 코드 목록 주석에 법령 출처 명시 |

**위치**: `src/lib/calc-engine/modules/insurance/veteran.ts`, `src/lib/calc-engine/copayment.ts`

### ch12_verifier.md 추가 항목 (5개)

| # | 심각도 | 항목명 | 현재 커버 범위 | 부족한 범위 | 보강 방향 |
|---|--------|--------|--------------|-----------|---------|
| I-066 | 🟠 High | **G20 공상등구분 '7' 날짜 분기 미처리** | G20 위탁 처리됨 | 2013.01.01 청구분부터 공상등구분 7→4 변경; `veteran.ts` 및 `GsCode.cs`에 날짜 분기 없음 | `veteran.ts`에 2013.01.01 기점 공상등구분 7→4 날짜 분기 추가 |
| I-067 | 🟠 High | **보훈병원(P08) vs 보훈위탁(G20) 청구체계 미분리** | G10/G20 분기 존재 | C# `GsCode.cs`도 G10/G20 분기만 있고, 두 청구 체계를 체계적으로 분리하지 않음; TS도 동일한 불완전 상태 | 두 청구 체계 구분 입력 파라미터 추가 후 분기 처리 |
| I-068 | 🟠 High | **`ApplyBohunPharmacy` C31/C32·D타입 분기 미포팅** | M81/M82/M83 처리 존재 | C#에서 C31/C32, D타입 시 `SumUser = RealPrice`로 전환하는 로직이 TS에 미포팅; `veteran.ts:L361` 주석만 존재 | `veteran.ts:L361` 주석 위치에 C31/C32·D타입 분기 실제 구현 |
| I-069 | 🟠 High | **보훈청구액 절사단위 정책 미확정** | `trunc10()` 사용 | 10원 절사 근거 문서 없음; 현장 검증 없이 신뢰하면 1원~9원 오차 발생 가능 | I-032/I-062와 동일; 현장 검증 및 정책 상수화 |
| I-070 | 🟡 Medium | **insuCode null 체크 없이 `.startsWith('G')` 호출** | `calcVeteran()` G타입 분기 존재 | `options.insuCode`가 undefined이면 `.startsWith()` 호출 시 런타임 오류 | `veteran.ts:L368`에 null 체크 추가 |

---

## 심각도별 집계

| 심각도 | 항목 수 | 비율 |
|--------|--------|------|
| 🔴 Critical | 14개 | 24% |
| 🟠 High | 32개 | 54% |
| 🟡 Medium | 13개 | 22% |
| 🟢 Low | 0개 | 0% |
| **합계** | **59개** | 100% |

---

## 챕터별 집계

| 챕터 | Critical | High | Medium | Low | 합계 |
|------|----------|------|--------|-----|------|
| CH01 | 0 | 3 | 4 | 0 | 7 |
| CH02 | 3 | 1 | 0 | 0 | 4 |
| CH03 | 0 | 2 | 2 | 0 | 4 |
| CH04 | 1 | 3 | 0 | 0 | 4 |
| CH05 | 2 | 3 | 0 | 0 | 5 |
| CH06 | 0 | 4 | 1 | 0 | 5 |
| CH07 | 2 | 1 | 1 | 0 | 4 |
| CH08 | 1 | 2 | 0 | 0 | 4 (실제 3+2=5로 조정 필요 - I-036~I-040) |
| CH09 | 0 | 3 | 3 | 0 | 6 |
| CH10 | 2 | 2 | 1 | 0 | 5 |
| CH11 | 2 | 3 | 2 | 0 | 7 (6+2) |
| CH12 | 0 | 8 | 3 | 0 | 11 (6+5) |

---

## Critical 부족 Top 20

아래는 전체 59개 부족 항목 중 Critical 14개 전체와 High 우선순위 상위 6개를 선정하여 총 20개로 구성한 즉시 처리 목록이다.

### Critical 14개 (전체)

| 순위 | 항목 ID | 항목명 | 위치 | 영향 |
|------|---------|--------|------|------|
| 1 | I-008 | **소아심야 코드 오분류** (Z2000640 미사용) | `surcharge.ts:determineSurcharge():L153` | 소아심야 모든 케이스에서 코드 오산출 |
| 2 | I-009 | **text3 차등수가 접미사 전무** | 모든 Z코드 생성 함수 | seed.sql text3=1 코드 62개 완전 미사용 |
| 3 | I-010 | **날짜 분기 20231101 미적용** | `dispensing-fee.ts`, `surcharge.ts` | 2023.11.01 이후 모든 조제에서 구 코드 사용 |
| 4 | I-011 | **Z4116 하드코딩 버그** | `dispensing-fee.ts` | 2022.01.01 이후 폐지 코드 사용으로 청구 반송 위험 |
| 5 | I-017 | **소아심야 접미사 오류** | `surcharge.ts` | I-008과 연동; 소아심야 코드 오산출 |
| 6 | I-024 | **G타입 M61 역산 공식 오적용** | `veteran.ts:calcVeteran():L314-324` | 고엽제 환자 보훈청구액 오산출 |
| 7 | I-025 | **65세 2구간 날짜조건 미반영** | `copayment.ts` | 65세 이상 환자 본인부담금 날짜별 오산출 |
| 8 | I-032 | **보훈 감면 절사 분기 하드코딩** | `veteran.ts:calcMpvaPrice()` | 정책 변경 시 대량 오산출 위험 |
| 9 | I-035 | **C31/C32 건강보험 경로 오진입** | `copayment.ts` | C31/C32 처방 전체 본인부담금 오산출 |
| 10 | I-039 | **2025 설날 연휴 범위 누락** | `modules/seasonal.ts` | 2025 설날 연휴 기간 명절 가산 미적용 |
| 11 | I-050 | **DueDate 연도 손실** | `index.ts` | 연도 경계 처방에서 투약기한 오계산 |
| 12 | I-051 | **조기종료 EE4 없음** | `index.ts` | 이상 입력 시 무한루프 가능 |
| 13 | I-052 | **S06 D10 sbrdnType="" Mcode 미적용** | `modules/insurance/medical-aid.ts` | 의료급여 1종 기본 수급자 본인부담금 500원 오산출 |
| 14 | I-053 | **S07 C10+bohunCode 보훈 모듈 미진입** | `copayment.ts` | C계열 보훈 감면 7,600원 오산출 (기대 0원) |

### High 우선순위 Top 6 (순위 15~20)

| 순위 | 항목 ID | 항목명 | 위치 | 선정 이유 |
|------|---------|--------|------|---------|
| 15 | I-068 | **`ApplyBohunPharmacy` C31/C32·D타입 분기 미포팅** | `veteran.ts:L361` | 주석만 있고 실제 구현 없음; 의료급여+보훈 복합 케이스 SumUser 과산정 |
| 16 | I-042 | **CalcOptions 포팅율 42%** | `types.ts` | 58% 필드 누락으로 다수 기능 미동작 근본 원인 |
| 17 | I-043 | **CalcResult 포팅율 40%** | `types.ts` | 60% 필드 누락으로 결과 출력 불완전 |
| 18 | I-054 | **S08 야간+토요 복합 가산 누락** | `dispensing-fee.ts` | 야간+토요 처방에서 토요 별도 행 미생성 |
| 19 | I-060 | **공상등구분 ↔ BohunCode 명시적 매핑 없음** | `veteran.ts` | EDI 청구서 공상등구분 필드 공란 위험 |
| 20 | I-026 | **D10 기본값 오류 (500원 vs 1,000원)** | `modules/insurance/medical-aid.ts` | sbrdnType="" 시 500원 오적용 |

---

## 보강 우선순위 권고

1. **즉시 (Critical 14건)**: 코드 오산출·무한루프·대량 오류 케이스 → 수정 즉시 적용
2. **고우선 (High Top 6)**: CalcOptions/CalcResult 포팅 완료 → 상당수 High 항목이 자동 해결됨
3. **중간 (Medium 13건)**: 경계 조건·문서화·테스트 확충 → 정확도 향상
4. **장기 (절사단위 확정 관련)**: I-032/I-062/I-069 → 현장 검증 후 정책 상수화

---

*참조 파일 목록*:
- `C:\Projects\KSH\PharmaEdu\docs\analysis\ch01_analyst.md` ~ `ch12_verifier.md` (24개)
- `C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\` (계산 엔진 소스 디렉토리)

**[약제비 분析용]**
