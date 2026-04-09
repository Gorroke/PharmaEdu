# CH05 교차 검증 보고서

> 작성자: CH05 Verifier (Phase 2 Team 5B)
> 작성일: 2026-04-06
> 챕터: CH05 — 보험유형별 본인부담금
> 참조 분석 보고서: `ch05_analyst.md` (미작성 — 독립 검증)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

> C# 원본: `CopaymentCalculator.cs` (1173줄)
> TS 포팅: `copayment.ts`, `modules/insurance/veteran.ts`, `modules/insurance/medical-aid.ts`, `modules/insurance/auto-insurance.ts`, `modules/insurance/workers-comp.ts`

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `CopaymentCalculator.cs:CalcCopay_C():L358` | `copayment.ts:calcCopayment():L116` | ⚠ 부분 구현 | 65세 bohunRate 조건 누락, 2구간 날짜 조건 누락, basisAmt vs totalPrice 혼용 |
| `CopaymentCalculator.cs:CalcCopay_D():L528` | `modules/insurance/medical-aid.ts:calcMedicalAid():L64` | ⚠ 부분 구현 | M20 이중감면 미포팅, Mcode/Bcode 기본값 오류(1000원→500원) |
| `CopaymentCalculator.cs:CalcCopay_G():L699` | `modules/insurance/veteran.ts:calcVeteran():L254` | ⚠ 부분 구현 | M61 공식 오적용 (C타입 공식→G타입에 사용), M20 절사 단위 차이 |
| `CopaymentCalculator.cs:CalcCopay_F():L749` | `modules/insurance/auto-insurance.ts:calcAutoInsurance():L44` | ✓ 동일 | Trunc10 + 할증 포함 |
| `CopaymentCalculator.cs:InsuranceType.Industrial:L189` | `modules/insurance/workers-comp.ts:calcWorkersComp():L45` | ✓ 동일 | 0원 처리 일치 |
| `CopaymentCalculator.cs:GetBohunRate():L766` | `modules/insurance/veteran.ts:getBohunRate():L128` | ✓ 동일 | 날짜 분기 포함 일치 |
| `CopaymentCalculator.cs:GetDoubleReductionRate():L791` | `modules/insurance/veteran.ts:getDoubleReductionRate():L170` | ⚠ 반환값 불일치 | C#: 비M20/M61 → `-1`, TS: `0` 반환 |
| `CopaymentCalculator.cs:CalcMpvaPrice():L810` | `modules/insurance/veteran.ts:calcMpvaPrice():L210` | ⚠ 부분 구현 | D타입/C21/C31/C32 + B014 예외 분기 미포팅 |
| `CopaymentCalculator.cs:IsBohunHospital():L1131` | `modules/insurance/veteran.ts:isBohunHospital():L189` | ✓ 동일 | 6곳 하드코딩 일치 |
| `CopaymentCalculator.cs:ApplyBohunPharmacy():L1040` | `modules/insurance/veteran.ts:calcVeteran():L362` | ⚠ 부분 구현 | C31/C32·D타입 분기 미포팅 |
| `CopaymentCalculator.cs:DetermineInsuRate():L313` | `copayment.ts:_determineEffectiveRate():L217` | ⚠ 의미 불일치 | C#: 6세미만 insuRate 변환 포함, TS: 산정특례 요율만 반환(-1/값) |

### 포팅 정확도 종합 평가

C타입·F타입·E타입의 기본 구조는 정확히 포팅되었으나, D타입과 G타입에서 여러 중요 분기가 누락 또는 오적용되었다. 특히 G타입 M61 역산 공식이 C타입 공식을 G타입에 그대로 적용한 오류와, D타입 M20 이중감면이 전혀 구현되지 않은 점, Mcode 기본값 불일치(500원→1000원)가 가장 심각한 문제다. 65세 이상 3구간 분기에서도 2018-01-01 이전/이후 날짜 조건 및 보훈환자 제외 조건이 누락되어 있다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 구현이 따르는 소스 | 비고 |
|---|---|---|---|---|---|---|
| C10 30% 100원 절사 | O (Int+100원) | O | O | O | EDB/공단 기준 (일치) | 4소스 일치 |
| 65세 정액 1,000원 | O (DB의존) | O | O | O | EDB 기준 | 4소스 일치 |
| 65세 2구간 20% 날짜분기 | △(DB의존) | O | O | O | EDB/유팜 기준 — **TS 미반영** | |
| 6세미만 21% (SixAgeRate) | O (Holiday_gb 분기) | O | O | O | EDB 기준 | 4소스 일치, TS는 DB 필드 의존 |
| D10 Mcode 기본값 | 500원 하드코딩 | 미명시 | 500원 | 500원 | EDB — **TS 1000원 오류** | C# 기본 500원(L608) |
| D10 Bcode 기본값 | 500원 하드코딩 | 미명시 | 미확인 | 미확인 | EDB — **TS 1500원** | C# 기본 500원(L613) |
| D B014 10원 절사 | X(미구현) | O | O | O | EDB 기준 (trunc10) | TS trunc10 일치 |
| G M61 역산 절사 | X(미구현) | 미명시 | △ | O | EDB — **TS 오적용** | C# G타입은 Trunc10(일반분기) |
| G M20 이중감면 절사 (D타입) | X | 미명시 | 미확인 | 2018이후 Trunc10/이전 Trunc100 | EDB — **TS 미구현** | C# D타입 L564-567 |
| 보훈 MpvaPrice 위탁/비위탁 | 사사오입 | 미명시 | 올림(Ceil10) | 역산(비위탁) | EDB(역산) | TS 역산 채택 — M09 충돌 |
| F 자보 10원 절사 | O | O | O | O | 4소스 일치 | |
| E 산재 0원 | O | O | O | O | 4소스 일치 | |
| BUG-002: 비즈팜 50%+암환자 이중등호 | **버그** | - | - | - | 비즈팜 방식 미채택 (올바름) | VB6 `A=A=B` 비교 오류 |
| 차등수가 미구현(비즈팜) | 미구현 | O | O | O | EDB/공단 — TS에도 미구현 | DispensingFeeCalculator 담당 |

### 4소스 불일치 항목 요약

- `Mcode/Bcode 기본값`: C# 500원(L608,L613) vs TS medical-aid.ts `mcode:1000원, bcode:1500원(L224,L219)` — C# 원본 500원이 법령 기준에 맞지 않을 수 있으나 원본과의 불일치가 확실함. EDB Mock에서 D20 FixCost=500원 확인.
- `G타입 M61 공식`: C#은 CalcCopay_G에 M61 전용 분기가 없고 일반 감면 60% 분기(Trunc10)를 따름. TS는 C타입 M61 역산 공식(`trunc100(basisAmt * insuRate/100 * num7/100)`)을 G타입에 그대로 적용 — 이는 오적용.
- `D타입 M20 이중감면`: C# L561-575에 D타입 M20 이중감면(2018 이후 Trunc10/이전 Trunc100)이 구현되어 있으나 TS medical-aid.ts에 전혀 없음.

---

## 3. 의심 항목 (Suspicious)

- [🔴 Suspicious / Critical] **G타입 M61 역산 공식 오적용**: TS `modules/insurance/veteran.ts:calcVeteran():L314-324`는 M61에 대해 `trunc100(basisAmt * insuRate/100 * num7/100)` 공식을 적용하고 있다. 그러나 C# 원본 `CalcCopay_G()`(L699-739)에는 M61 전용 분기가 없으며, M61(bohunRate=60)은 일반 감면 분기(L720-722)로 처리되어 `Trunc10(basisAmt * insuRate / 100)`가 적용된다. C타입 M61 공식(L456-464)을 G타입에 잘못 이식한 것으로 판단된다. (`modules/insurance/veteran.ts:L314` vs `CopaymentCalculator.cs:CalcCopay_G():L699-739`)

- [🔴 Suspicious / Critical] **65세 이상 2구간 날짜 조건 누락**: C# L430에서 2구간(`basisAmt <= 12000m`)은 `opt.DosDate >= "20180101"` 조건이 함께 적용된다. 이 날짜 조건이 없으면 2018년 이전 처방에 20% 구간이 잘못 적용된다. TS `copayment.ts:L136`는 `totalPrice <= 12000` 조건만 있고 날짜 체크가 없다. (`copayment.ts:L136` vs `CopaymentCalculator.cs:CalcCopay_C():L430`)

- [🔴 Suspicious / Critical] **65세 이상 3구간 분기 기준액 불일치**: C# L422에서 1구간 조건은 `basisAmt <= 10000m`이며 `basisAmt = pbSum - mpvaPrice`(L415)다. 즉 보훈감면 후 기준액으로 비교한다. TS `copayment.ts:L127`는 `totalPrice <= 10000`으로 비교해 mpvaPrice 차감 없이 총액으로 비교한다. 보훈 감면 환자 65세의 경우 차이 발생. (`copayment.ts:L127` vs `CopaymentCalculator.cs:CalcCopay_C():L415,L422`)

- [🟠 Suspicious / High] **D10 Mcode 기본값 1000원 (원본 500원)**: TS `modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount():L224`는 `rate.mcode > 0 ? rate.mcode : 1000`으로 기본값 1000원을 사용한다. C# `CalcCopay_D():L608`는 `rate.Mcode > 0 ? rate.Mcode : 500m`으로 기본값 500원이다. 현행 DB 값이 1000원이라면 실무 영향은 없으나 원본 대비 불일치. (`modules/insurance/medical-aid.ts:L224` vs `CopaymentCalculator.cs:L608`)

- [🟠 Suspicious / High] **D10 Bcode 기본값 1500원 (원본 500원)**: TS `modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount():L219`는 `rate.bcode > 0 ? rate.bcode : 1500`으로 기본값 1500원 사용. C# `CalcCopay_D():L613`는 `rate.Bcode > 0 ? rate.Bcode : 500m`으로 기본값 500원. 고시 개정 여부와 무관하게 C# 원본 대비 불일치. (`modules/insurance/medical-aid.ts:L219` vs `CopaymentCalculator.cs:L613`)

- [🟠 Suspicious / High] **65세 이상 분기에서 보훈환자(bohunRate > 0) 제외 조건 누락**: C# L419는 `opt.IsOver65 && !hasSpecialIllness && bohunRate == 0` 세 조건을 모두 요구한다. TS `copayment.ts:L125`는 `age >= 65 && effectiveCopayRate < 0`만 체크하며 bohunRate 조건이 없다. 65세 이상 보훈환자가 TS에서는 65세 정액 분기로 잘못 진입할 수 있다. (`copayment.ts:L125` vs `CopaymentCalculator.cs:CalcCopay_C():L419`)

- [🟠 Suspicious / High] **65세 이상 분기 산정특례 임계값 불일치**: C# `hasSpecialIllness = illness.Rate >= 0 && illness.Rate < 30m`(L418)이므로 30% 이상인 산정특례(예: V252=50%)가 있으면 `hasSpecialIllness=false` → 65세 분기 **진입**한다. TS `effectiveCopayRate < 0`이어야만 65세 분기 진입하므로 V252(50%)인 경우 `effectiveCopayRate=50 >= 0` → 65세 분기 **미진입**. 즉 C#은 V252 50%이더라도 65세 정액(1000원)/20% 구간을 적용하지만 TS는 50% 정률을 바로 적용. (`copayment.ts:L125` vs `CopaymentCalculator.cs:L418-419`)

- [🟠 Suspicious / High] **GetDoubleReductionRate 비M20/M61 반환값 불일치**: C# `GetDoubleReductionRate()`(L793-794)는 M20/M61이 아니면 `-1m`을 반환한다. TS `getDoubleReductionRate()`(L171)는 `0`을 반환한다. C# CalcCopay_C에서는 `num7 >= 0` 조건(L457)으로 -1이면 M61 분기가 발동되지 않는다. TS `calcVeteran`의 M61 분기(L314)는 `num7 >= 0` 조건으로 0인 경우에도 **발동**되어 `insuRate/100 * 0/100 = 0원`이 된다. 실제로 M61 이외 코드에서 `getDoubleReductionRate`가 0을 반환하면 계산 오류가 발생할 수 있다. (`modules/insurance/veteran.ts:L171` vs `CopaymentCalculator.cs:L793-794`)

- [🟡 Suspicious / Medium] **C#의 truncC (2016.09.29 날짜 분기 절사)**: C# `CalcCopay_C:L368-372`에서 2016.09.29 이후이면 Trunc100, 이전이면 Trunc10을 C타입 전체에 적용한다. TS는 이 날짜 분기가 없으며 항상 `trunc100`을 사용한다. 2016.09.29 이전 조제 건 소급 계산 시 오류. (`copayment.ts:L138,L146,L156,L175` vs `CopaymentCalculator.cs:L368-372`)

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🔴 Insufficient / Critical] `calcCopayment()`: 65세 이상 2구간(10,001~12,000원)에서 `dosDate >= '20180101'` 조건 없음 — `copayment.ts:L136` vs `CopaymentCalculator.cs:L430`
- [🟠 Insufficient / High] `calcCopayment()`: 2016.09.29 이전/이후 truncC 분기 없음 (C타입 절사 단위 변경) — `copayment.ts:L138,L146` vs `CopaymentCalculator.cs:L368-372`
- [🟠 Insufficient / High] `getDoubleReductionRate()`: 2018.01.01 이전/이후 분기는 구현됨. 그러나 반환값 0/-1 불일치로 인한 M61 오적용 위험 존재 — `modules/insurance/veteran.ts:L171` vs `CopaymentCalculator.cs:L793`

### 4-2. 보험 코드 분기

- [🔴 Missing / Critical] `calcMedicalAid()`: D타입 M20 이중감면 분기 전혀 없음. C# `CalcCopay_D():L561-635`에서 3개 경로(V252, B014, 기본정액) 각각에 M20 처리가 있으나 TS에 전혀 미반영 — `modules/insurance/medical-aid.ts` 전체 vs `CopaymentCalculator.cs:L561-635`
- [🟠 Missing / High] `calcMedicalAid()`: 의료급여 1종 면제 7종(IsMediAid1Exempt) 분기 없음. C# `CalcCopay_D():L549-551`에 `IsMediAid1Exempt()` 호출 — `modules/insurance/medical-aid.ts` vs `CopaymentCalculator.cs:L549-551`
- [🟠 Missing / High] `calcMedicalAid()`: 의료급여 경증질환 V252 3% 차등제(IsV252ForMediAid) 분기 없음. C# `CalcCopay_D():L553-575` — `modules/insurance/medical-aid.ts` vs `CopaymentCalculator.cs:L553-575`
- [🟡 Missing / Medium] `calcVeteran()`: ApplyBohunPharmacy()에서 C31/C32·D타입 분기(SumUser=RealPrice) 미포팅. TS는 G타입만 처리 — `modules/insurance/veteran.ts:L362-380` vs `CopaymentCalculator.cs:ApplyBohunPharmacy():L1050-1058`
- [🟡 Missing / Medium] `calcMpvaPrice()` (TS): D타입 + M10 이외 경우 MpvaPrice=0 예외(B014 2019이후 fall-through 포함) 미포팅 — `modules/insurance/veteran.ts:calcMpvaPrice():L210` vs `CopaymentCalculator.cs:CalcMpvaPrice():L815-834`

### 4-3. 특수 케이스 분기

- [🟠 Suspicious / High] `calcVeteran()` M61: C# G타입 M61은 전용 분기 없이 일반 감면 60% 분기(Trunc10)로 처리되나 TS는 별도 역산 분기(trunc100×num7)를 적용 — TS 오적용
- [🟡 Missing / Medium] `calcCopayment()`: C32 f028(자립청소년 14%) 분기 없음 — `CopaymentCalculator.cs:CalcCopay_C():L386-389`
- [🟡 Missing / Medium] `calcCopayment()`: C32 보건기관 처방전(0원) 분기 없음 — `CopaymentCalculator.cs:CalcCopay_C():L392-393`
- [🟢 Missing / Low] **비즈팜 BUG-002 (이중등호)**: 비즈팜 라인 9732의 VB6 이중 `=` 연산(`Insur_Self_Amt = Insur_Self_Amt = Int(...)`)은 보훈 50%+암환자+조합기호 있음 조합에서 잘못된 비교 결과(0/-1)를 산출하는 버그다. TS는 이 케이스를 calcVeteran()의 일반 분기로 처리하므로 버그를 미재현한 것은 올바르다. 단, CH05 문서 §5.9에서 해당 케이스를 명시적으로 테스트 케이스로 추가하여 TS가 올바른 결과를 내는지 확인이 필요하다.
- [🟢 Missing / Low] **비즈팜 차등수가 미구현**: 비즈팜은 차등수가 관련 로직이 없으며 C# 주석(L71-73)에서도 차등가산은 `DispensingFeeCalculator.BuildSuffix`에서 처리한다고 명시되어 있다. TS calc-engine에 차등수가 전용 모듈이 없는 것은 CH05 범위 밖이므로 이슈 제외. DispensingFeeCalculator 담당 챕터에서 검토 필요.

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- [🟠 Insufficient / High] **number vs decimal 정밀도**: C#은 전 연산에 `decimal` 타입을 사용하나 TS는 IEEE 754 `number`를 사용한다. 특히 `trunc100(totalPrice * (rate2 / 100))`(`copayment.ts:L138`) 같은 연산에서 부동소수점 오차 가능성이 있다. 예: `totalPrice=11999, rate2=20` → `11999 * 0.2 = 2399.8` → `trunc100(2399.8) = 2300` (올바름). 그러나 큰 금액(`1200000 * 0.3`)에서 IEEE 754 오차가 발생할 수 있다. EDB·유팜 모두 `decimal`을 사용하므로 TS만 오차 위험 존재.

### 5-2. Null 안전성

- [🟡 Insufficient / Medium] `resolveMedicalAidFixAmount()`: `options.sbrdnType ?? ''`으로 처리되어 null 안전. `rate.mcode`, `rate.bcode`는 0 체크만 있으며 undefined 체크는 없음. InsuRate 인터페이스에서 `mcode`, `bcode`가 필수 필드로 선언되어 있으므로 런타임 오류는 없으나 DB 값이 0일 때 기본값 분기가 실행됨 — 의도된 동작인지 확인 필요.

### 5-3. 경계 조건

- [🟡 Insufficient / Medium] `calcCopayment()` 65세 1구간: TS L129 `Math.min(totalPrice, fixCost)`로 총액 < 정액일 때 총액 전체를 본인부담으로 처리한다. C# L426도 `basisAmt < fixCost ? basisAmt : fixCost`로 동일 처리. 그러나 TS는 `totalPrice`를 사용하고 C#은 `basisAmt`(보훈감면 후)를 사용하는 차이가 경계에서 다른 결과를 낼 수 있다.
- [🟡 Insufficient / Medium] `calcVeteran()` 음수 userPrice: `userPrice -= overflow - mpvaPrice` 연산에서 userPrice가 음수가 되는 극단적 케이스에 대한 floor 처리가 없다 — `modules/insurance/veteran.ts:L354`.

---

## 6. 기타 관찰 사항

- **CalcCopay_C의 6세미만 처리 구조 차이**: C#은 `DetermineInsuRate()`(L313-348)에서 6세미만 경감을 적용해 `insuRate` 자체를 21%로 변환한 후 모든 분기에서 동일하게 사용한다. TS `_determineEffectiveRate()`(L217)는 산정특례 요율만 반환하며, 6세미만 처리는 `calcCopayment()` 본체(L163-181)에서 별도 분기로 처리한다. 이 구조 차이로 인해 6세미만 + 산정특례 조합 케이스에서 처리 순서가 달라질 수 있다. C#에서는 6세미만이 마지막(4단계)으로 insuRate를 덮어쓰므로 산정특례보다 6세미만이 우선된다. TS에서는 `effectiveCopayRate >= 0`(산정특례)이 `age < 6`보다 먼저 평가되어 산정특례가 우선된다.

- **648903860 5% 가산 로직 TS 미포팅**: C# `CalcCopay_C():L466-515`에 `2024.10.25` 이후 648903860 약품 5% 가산 및 보훈 역산 로직이 상당히 복잡하게 구현되어 있다. TS에는 이 로직이 전혀 없다. `copayment.ts`와 `veteran.ts` 모두 해당 처리 없음. 2024.10.25 이후 648903860 약품 처방 건에서 금액 오류 발생.

- **M20 이중감면 num7 시맨틱 주석 오류**: TS `veteran.ts:L162-163` 주석에서 "num7=10이면 userPrice의 10%를 보훈청이 추가 부담, 환자는 90%만 낸다"고 설명하나, 실제 C# `CalcCopay_G():L732`는 `addMpva = userPrice - Trunc100(userPrice * num7/100)` → `num7=10`이면 `addMpva = userPrice - trunc100(userPrice*0.1)` = 나머지 90%를 보훈이 부담하는 것이 아니라 10%를 추가 보훈부담(환자는 90% 유지)이다. 주석은 맞으나 TS M20 분기(L303-311)의 실제 계산식은 C# 원본과 일치한다. 문제없음.

- **차등수가 TS 미구현 — 의도적 제외 확인**: C# 주석(L71-73)에 "차등가산은 BuildSuffix에서 처리"로 명시되어 있고 `CopaymentCalculator.cs` 범위 밖이다. TS calc-engine에서도 본인부담금 계산 모듈 범위 밖으로 판단하여 미구현인 것으로 보이며, 이는 의도된 범위 제한이다. DispensingFeeCalculator 포팅 챕터에서 확인 필요.

---

## 7. 발견 이슈 요약

| 심각도 | 수 | 항목 |
|---|---|---|
| 🔴 Critical | 4 | G타입 M61 오적용, 65세 2구간 날짜조건 누락, 65세 분기 basisAmt vs totalPrice, D타입 M20 미포팅 |
| 🟠 High | 7 | D10 Mcode기본값 오류, D10 Bcode기본값 오류, 65세 분기 bohunRate 조건 누락, 65세 분기 산정특례 임계값 불일치, GetDoubleReductionRate 반환값 불일치, truncC 날짜분기 누락, 648가산 미포팅 |
| 🟡 Medium | 6 | C32 f028/보건기관 분기, IsMediAid1Exempt 분기, IsV252ForMediAid 분기, ApplyBohunPharmacy C31/C32·D 분기, CalcMpvaPrice D타입 예외, 음수 userPrice 처리 |
| 🟢 Low | 2 | BUG-002 테스트 케이스 추가 권고, 수치 정밀도(number vs decimal) |

---

**[약제비 분析용]**
