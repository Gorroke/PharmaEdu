# CH10 교차 검증 보고서

> 작성자: CH10 Verifier (Phase 2 Team 10B)
> 작성일: 2026-04-06
> 챕터: CH10 — 계산 파이프라인
> 참조 분석 보고서: `ch10_analyst.md` (미작성 — 독립 검증)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

### 1.1 최상위 진입점 비교

| C# 원본 / 함수 | TypeScript 포팅 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `DispensingFeeCalculator.cs:Calculate():L166` | `index.ts:calculate():L35` | ⚠ 구조 차이 | 아래 §1.2 상세 |
| `CopaymentCalculator.cs:Calculate():L58` | `copayment.ts:calcCopayment():L50` | ⚠ 단계 수 차이 | C# 15단계 vs TS 6단계 |

### 1.2 C# `Calculate()` 파이프라인 vs TS `calculate()` 라인-by-라인

#### C# 단계 순서 (DispensingFeeCalculator.cs)

| C# 단계 | C# 호출 위치 | 처리 내용 |
|---|---|---|
| 입력 검증 | L169–L172 | DosDate 8자리, DrugList != null |
| `result.Clear()` | L178 | 결과 초기화 |
| `Get302DrugList()` | L179 | 302 약품 목록 로드 |
| **Step1** `LoadWageData()` | L182 | `SelectMediWage(dosDate)` — DueDate 기반 수가 마스터 로드 |
| wageData 없으면 조기종료 | L184–L189 | `_wageData.Count == 0` → return |
| **Step2** `ClassifyDrugs()` | L192 | 약품 순회 + 분류 + 합산 |
| TotalCount==0 이면 조기종료 | L197–L203 | → return |
| **Step3** `ResolveDoseContext()` | L206 | 투약일수 확정 |
| **Step4** `DetermineSurcharge()` | L211 | 가산 판정 (CH04) |
| **Step5** `BuildSuffix()` | L214 | Z코드 접미사 생성 (CH02) |
| **Step6** 수가 산정 (9항목) | L227–L258 | `CalcPharmMgm/CalcBaseJoje/CalcEatEdu/CalcInternalDrug/CalcExternalDrug/CalcSelfInjection/CalcDrugMgm/CalcMoonMgm/CalcDrugSafe/CalcHolidaySurcharge` |
| Step6b `Sum648903860` 전달 | L261–L262 | drugCtx.Sum648903860 → result |
| Step6c 급여약 0건 조기종료 | L265–L274 | `CoveredCount==0 && !HasNPayDrug` → WageList.Clear() |
| Step6c `ApplyNPayWageRules()` | L277 | 비급여 조제료 체계 (높음5) |
| Step6d `ApplyBohunWageReduction()` | L280 | 보훈 조제료 특례 (중간14) |
| **Step7** `AssembleResult()` | L283 | 결과 조립 |

#### TS 단계 순서 (index.ts)

| TS 단계 | TS 호출 위치 | C# 대응 |
|---|---|---|
| 입력 검증 | L38–L43 | ≈ C# L169–L172 (insuCode 누락 검증 추가됨) |
| **Step 0** `process648Special()` | L50–55 | **없음** — C#는 ClassifyDrugs 내부에서 처리 (L358–L366) |
| **Step 1** `calcDrugAmountSum()` | L59 | C# Step2 내 금액합산의 일부 |
| **Step 2** `calcDispensingFee()` | L62 | C# Step1~Step7 전체 (조제료 파이프라인) |
| **Step 3** `repo.getInsuRate()` | L65 | C# CopaymentCalculator 외부 — DB 조회 |
| **Step 4** `calcCopayment()` | L91 | C# CopaymentCalculator.Calculate() |
| **Step 5/6** `applyPostProcessing()` | L101 | 648 가산 + 본인부담상한제 후처리 |

### 1.3 포팅 정확도 종합 평가

C# 엔진은 **DispensingFeeCalculator.Calculate() 단일 함수**에서 "수가마스터 로드 → 약품분류 → 투약일수 → 가산판정 → Z코드 접미사 → 수가산정" 전 과정을 7단계로 처리한다. TypeScript는 이 흐름을 `calcDispensingFee()` 하나로 래핑하면서 **Step 0(648 전처리)을 분리 추출**했고, 약품금액 계산(`calcDrugAmountSum`)도 별도 함수로 분리했다. 핵심 순서(수가 → 조제료 → 본인부담)는 보존되어 있으나, **C#의 조기종료 6가지 조건 중 TS에서 일부 누락**이 있다.

---

## 2. 4소스 파이프라인 비교

CH10_계산_파이프라인.md §2 기준으로 4소스의 전체 단계 수 및 구조를 비교한다.

| 항목 | 비즈팜 | 유팜 | EDB | 공단 | 우리(TS) |
|---|---|---|---|---|---|
| **핵심 함수** | `Insurance_Calculate()` + `Pres_Bill()` | `CalculateAll()` | `Execute()` | 구현명세 18단계 | `calculate()` (index.ts) |
| **단계 수** | 약 7단계 | 18단계 | 6단계 | 18단계 | 6단계 |
| **단가/수가 로드 위치** | Pres_Bill() 내부 DB 직조회 | `Load보험기준가()` 분리 | `SelectMediWage(dosDate)` | 외부 마스터 전제 | `repo.getSugaFeeMap(year)` |
| **DueDate 기반 수가 조회** | `PZCVALUE` 유효기간 필터 | `적용일` 파라미터 | `dosDate` 파라미터 | MAX <= 처방일 | `year`(연도 추출) — ⚠ 월일 손실 |
| **약품 금액 계산 위치** | `Check_Drug()` L8642~L8913 | `약가Logic.Calculate*()` 8종 | `Execute()` Step3 L822~L1244 | §3 약품 순회 | `calcDrugAmountSum()` (분리) |
| **조제료 계산 위치** | `Pres_Bill()` L9220~L9577 | `조제료Logic.Calculate*()` | `Step6_SugaCalc()` | §4 Step3 | `calcDispensingFee()` (분리) |
| **본인부담 계산 위치** | `SelfRate()` + `Pres_Bill()` 후반 | `Get본인부담금()` 추상메서드 | InsuRateCalc2 | §7~§8 | `calcCopayment()` (분리) |
| **조기종료 조건 수** | 없음(별도 플래그) | 명시 없음 | 5~6개 | 없음(명세) | 2개 (입력검증 + coveredCount) |

### 우리 구현은 어느 소스에 가까운가?

**EDB에 가장 근접하다.** 이유:

1. Repository 패턴 사용 (`ICalcRepository` ↔ `_repository.SelectMediWage`)
2. 단계 수 6개 ≈ EDB `Execute()` 6단계
3. `SelectMediWage(dosDate)` 구조가 `repo.getSugaFeeMap(year)` 와 동일한 설계 패턴
4. `CalcOptions` 입력 객체 + `CalcResult` 출력 객체 구조

다만 **DueDate 처리 방식**은 EDB·유팜이 `dosDate` 전체(8자리)를 넘기는 반면, **TS는 `year`(연도 4자리)만 추출**하여 수가 조회하므로 이 지점에서 EDB와 다르다.

---

## 3. 의심 항목 (Suspicious)

### 3.1 DueDate 기반 수가 조회 — 연도 손실

- **[🔴 Suspicious / Critical]** `calcDispensingFee()` 수가 조회: `year` 추출만 사용

  `dispensing-fee.ts:L179` —
  ```typescript
  const year = parseInt(opt.dosDate.substring(0, 4), 10) || 2026;
  const sugaMap = await repo.getSugaFeeMap(year);
  ```

  C# 원본(`DispensingFeeCalculator.cs:LoadWageData():L297`)은 `SelectMediWage(dosDate)` 에 **8자리 전체 날짜**를 넘긴다. EDB·유팜·비즈팜 모두 `MAX(적용일) <= 처방일` 조건으로 해당 처방일 시점 수가를 찾는다.

  TS 구현은 연도만 추출하므로, **같은 해에 수가 개정이 있을 경우(예: 2024.07.01 개정, 처방일 2024.03.01)** 최신 수가를 적용하는 오류가 발생할 수 있다. 수가 개정은 매년 1~2회 이루어지므로 실 영향 가능성이 높다.

  **기대 동작**: `repo.getSugaFeeMap(opt.dosDate)` (8자리 전달)

---

### 3.2 조기종료 6가지 조건 — TS 일부 누락

C# `Calculate()` 에서 식별되는 조기종료 조건을 TS와 대조한다.

| # | C# 조기종료 조건 | C# 위치 | TS 대응 여부 |
|---|---|---|---|
| EE1 | DosDate 빈값 또는 8자 미만 | `L169–L172` | ✓ `index.ts:L38–L39` |
| EE2 | DrugList null 또는 0건 | `L171–L172` | ✓ `index.ts:L41–L42` |
| EE3 | 수가마스터 로드 실패 (`_wageData.Count==0`) | `L184–L189` | ⚠ `index.ts:L73–L88` — `rate==null` 시 fallback 처리. 수가마스터 자체 로드 실패(0건)에 대한 명시적 분기 없음 |
| EE4 | 약품 유효건수 0 (`TotalCount==0`) | `L197–L203` | ✗ **없음** — TS `classifyDrugs()`는 카운트만 하고 0건 early-return 없음 |
| EE5 | 급여약 0건 + 비급여도 없음 (`CoveredCount==0 && !HasNPayDrug`) | `L265–L274` | ⚠ `dispensing-fee.ts:L233–L236` — `coveredCount===0` 이면 `[]` 반환하나, `!HasNPayDrug` 조건 없이 단순히 조제료를 0으로 만듦. C#은 `WageList.Clear()` 후 `AssembleResult()` 재호출 |
| EE6 | 보험코드 누락 | 없음 (C#은 검증 안 함) | ✓ `index.ts:L43–L44` — TS가 더 엄격 |

- **[🔴 Suspicious / Critical]** EE4: 약품 유효건수 0 조기종료 없음 (`index.ts` — TS `calculate()` 전체 흐름에서 `drugList.length === 0` 검증은 있으나, EXTYPE 제거 후 유효건수가 0이 되는 케이스 미처리)

  C# `ClassifyDrugs()`는 `ExType=="1"` 과 `ExType=="9"` (2020.03.01 이후) 를 skip하므로, 입력 약품이 모두 제외 대상이면 `TotalCount==0` 조기종료(L197–L203)가 발동된다. TS는 EXTYPE 필터 자체가 없다.

- **[🟠 Suspicious / High]** EE5: `HasNPayDrug` 조건 미반영 (`dispensing-fee.ts:L233–L236`)

  C# `L265–L274`는 `CoveredCount==0 && !HasNPayDrug` **두 조건 동시** 충족 시에만 WageList를 비운다. TS는 `coveredCount===0` 하나만 확인한다. 결과적으로 **비급여 약품만 있을 때 조제료 미산정 여부가 다르게 동작**할 수 있다.

---

### 3.3 서식번호 결정 로직 (H024/H124/H025/H125)

- **[🟠 Suspicious / High]** 서식번호 결정 로직 미구현

  CH10 §Step1에서 명세:
  ```
  처방조제 + 건강보험 → H024
  처방조제 + 의료급여 → H124
  직접조제 + 건강보험 → H025
  직접조제 + 의료급여 → H125
  ```

  C# `CalcResult` 에는 서식번호 필드가 있을 것으로 예상되나, TS `CalcResult`(`types.ts:L197~`) 에는 `formType` 또는 이에 해당하는 필드가 없다. `ICalcRepository` 에도 서식 관련 메서드 없음.

  이 필드는 심사청구서 출력 시 필수이므로 전체 출력 명세에 영향이 있다. 단, 교육용 플랫폼(PharmaEdu)의 범위가 계산 로직으로 제한되어 있다면 의도적 생략일 수 있다.

---

### 3.4 보험코드 검증 위치 차이

- **[🟢 Low]** C# 는 보험코드 유효성을 미검증 (InsuCode 빈값 허용), TS는 `index.ts:L43` 에서 명시적으로 검증. TS가 더 방어적이므로 기능적 문제는 없으나, C#과의 동작 차이로 테스트케이스 설계 시 주의 필요.

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- **[🔴 Missing / Critical]** `dispensing-fee.ts:getSugaFeeMap()`: `dosDate` 8자리 대신 `year` 4자리만 전달 — 연내 수가 개정 반영 불가 (§3.1 상세)

- **[🟠 Insufficient / High]** `dispensing-fee.ts:L260`: 가루약 코드 분기 날짜 `>= '20231101'` 는 구현됨. 그러나 2023.11.01 이전 구체계 경로(`!usePowderNewCode`) 에서 `repo.getPrescDosageFee(year, ...)` 가 `year`만 사용하는 점은 동일한 DueDate 문제를 공유함.

### 4-2. 보험 코드 분기

- **[🟠 Insufficient / High]** `dispensing-fee.ts`: EXTYPE 필터 없음. C#에서 `ExType=="1"` 또는 `ExType=="9"` (날짜 조건부) 제외 처리(`L334–L335`)가 TS에 미포팅됨.

- **[🟡 Insufficient / Medium]** `dispensing-fee.ts:classifyDrugs()`: `InsuDrug` 필드 활용 안 함. C# `IsNum8Target()`(L472~L478)은 보험약품여부(`InsuDrug`) 또는 302약품 여부를 이용해 `MaxInsuOr302Day`를 별도 추적하나, TS `classifyDrugs()`는 해당 필드 미사용.

### 4-3. 특수 케이스 분기

- **[🟠 Missing / High]** `ApplyNPayWageRules()` 미포팅. C# `L277` — 비급여 조제료 체계(높음5). TS에 해당 함수 없음.

- **[🟠 Missing / High]** `ApplyBohunWageReduction()` 미포팅. C# `L280` — 보훈 조제료 특례(중간14). TS `calcVeteran()` 이 본인부담금 계산은 수행하나, **조제료 자체를 감면하는 후처리**는 없음.

- **[🟡 Missing / Medium]** `CalcHolidaySurcharge()` 미포팅. C# `L259` — 명절/달빛어린이 등 특수 수가. TS는 `calcSeasonalSurcharge()` 로 부분 구현(ZE 계열)되어 있으나, `CalcDrugSafe()` (비대면/코로나) 와 `CalcHolidaySurcharge()` 가 분리된 두 함수인 반면 TS는 단일 `calcSeasonalSurcharge()` 로 통합 → 커버리지 확인 필요.

- **[🟡 Insufficient / Medium]** `CopaymentCalculator.cs`의 15단계(§1.1) 대비 `calcCopayment()` 는 약 6단계. 누락 단계: MpvaComm 산출(단계4b), SpecialPub 302/101/102 재배분(단계12), BohunPharmacy M81~M83 후처리(단계13).

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- **[🟠 Insufficient / High]** 전체 파이프라인: C#은 `decimal` 타입으로 중간 연산. TS는 `number`(IEEE 754 배정밀도). 약품금액 × 투약일수가 수백만원 단위일 때 `number` 정밀도 문제가 이론상 발생할 수 있다. 실제로 0.1+0.2≠0.3 케이스는 원미만 4사5입 이전 단계에서 발생하므로 최종 금액에 영향이 제한적이나, 보훈 분수 계산(감면율 30/50/60/90%)에서 소수점 오차 가능.

- **[🟢 Low]** C# `decimal` 연산 `Trunc10/Trunc100` → TS `trunc10/trunc100` (`rounding.ts`): 구현 매핑됨. 올바른 방향.

### 5-2. Null 안전성

- **[🟡 Insufficient / Medium]** `dispensing-fee.ts:getPrice()` — `sugaMap.get(code)?.price ?? 0`: 0 반환 시 조용히 미산정 처리. C#은 폴백 코드(기본코드 fallback, L704–L707)로 재시도 후에도 0이면 미산정. TS는 폴백 없이 바로 `price===0` skip.

### 5-3. 경계 조건

- **[🟡 Insufficient / Medium]** `calcDispensingFee()`: `drugCtx.maxInternalDay === 0`이면 Z4xxx 산정 생략됨. C#은 `doseCtx.InsuDose`에 폴백 로직(`L452–L461`)이 있으나 TS는 단순 0 처리.

---

## 6. 기타 관찰 사항

### 6.1 C# CalcOptions vs TS CalcOptions 필드 차이

C# `CalcOptions`(미직접 열람, 다른 파일에서 유추)는 `InsuDose`, `IsRealDose`, `RealDose`, `NPayRoundType`, `NPayRoundF10YN`, `SelfInjYN`, `DrugSafeYN` 등 복잡한 필드를 가진다. TS `CalcOptions` (`types.ts:L80~L153`)는 이 중 `insuDose`, `isNonFace`, `isDirectDispensing` 만 포함. `selfInjYN`, `nPayRoundType`, `drugSafeYN` 는 미포팅.

- **[🟠 Insufficient / High]** `selfInjYN` 미포팅: C#에서 자가주사 조제료(Z4130) 산정 조건으로 사용(`L220`). TS `dispensing-fee.ts:L241`는 `hasInjection && !drugCtx.hasInternal && !drugCtx.hasExternal` 만 확인 — 자가주사 여부를 별도 플래그로 구분하지 않음.

### 6.2 CopaymentCalculator 15단계 vs TS 6단계 상세

C# `CopaymentCalculator.Calculate()` 는 주석 기준 15개 단계를 처리한다:
- 단계 1: 총약제비 = Trunc10(약가+조제료)
- 단계 2: 보험요율 결정 (4단계: 기본→질병코드→V252→6세미만)
- 단계 3: 보훈 감면율
- 단계 4: MpvaPrice 산출
- 단계 4b: MpvaComm 산출
- 단계 5: 보험유형별 본인부담금 (C/D/G/F/E)
- 단계 6: 3자배분
- 단계 7: 공비(PubPrice)
- 단계 8: RealPrice = UserPrice - PubPrice
- 단계 EC-02: F008 코로나 전액 공비
- 단계 9: 할증(Premium) — 자보
- 단계 10: 100%약품 3자배분
- 단계 11: SumUser (비급여 NPayRound 적용)
- 단계 12: 특수공비 302/101/102 재배분
- 단계 13: M81~M83 보훈약국 후처리
- 단계 14: 본인부담상한제
- 단계 15: SumInsure 확정

TS `calcCopayment()` 는 단계 1(총약제비), 2(보험요율), 5(유형별본인부담, 모듈 위임)를 구현. 단계 3~4b(보훈MpvaComm), 6(3자배분), 7(공비), 10(100%약품), 11(SumUser), 12(SpecialPub), 13(BohunPharmacy) 는 미구현 또는 부분 구현. **단계 8(EC-02 F008)** 는 TS에 해당 코드 없음.

### 6.3 648903860 처리 순서 차이

C# 에서는 `ClassifyDrugs()` 내부(Step2, `L358–L366`)에서 648903860 5일 제한 및 합계 추적을 수행한다. TS에서는 `process648Special()`을 **Step 0**으로 분리하여 `index.ts:L50` 에서 최우선 처리한다. 이 순서 변경 자체는 결과에 영향이 없으나, C# 에서 `EXTYPE` 체크 이후 648 처리를 하는 반면 TS는 EXTYPE 필터 자체가 없으므로, EXTYPE 제외 약품이 648903860인 케이스에서 다르게 동작할 수 있다.

---

## 요약 (3줄)

1. **파이프라인 구조**: TS는 EDB 6단계와 근접하며 핵심 순서(약품분류 → 조제료 → 본인부담)는 정확히 보존됨. 단, C# 15단계 CopaymentCalculator의 절반(MpvaComm, SpecialPub, BohunPharmacy, F008, SumInsure)이 미포팅.
2. **DueDate 수가 조회**: `year`만 추출하는 `getSugaFeeMap(year)` 는 연내 수가 개정 시 오적용 위험 — Critical 이슈.
3. **조기종료 조건**: C# 6개 조건 중 EE4(EXTYPE 제거 후 유효건수 0)와 EE5의 `HasNPayDrug` 조건이 누락 — 비급여 단독 케이스에서 동작 불일치.

---

*CH10 Verifier | Phase 2 Team 10B | PharmaEdu Phase 8 Audit*
