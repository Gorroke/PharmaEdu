# CH04 교차 검증 보고서

> 작성자: CH04 Verifier (Phase 2 Team 4B)
> 작성일: 2026-04-06
> 챕터: CH04 — 가산 로직 (Surcharge Logic)
> 참조 분석 보고서: `ch03_analyst.md` (작성일: 2026-04-06), `ch04_analyst.md` (미작성)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

### 1-1. DetermineSurcharge() → determineSurcharge()

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `DispensingFeeCalculator.cs:DetermineSurcharge():L496` | `surcharge.ts:determineSurcharge():L77` | ⚠ 부분 일치 | 우선순위 체인 자체는 맞으나 입력 판정 방식 차이(하단 §1-2 상세) |
| `DispensingFeeCalculator.cs:BuildSuffix():L570` | `surcharge.ts:getSurchargeSuffix():L207` | ⚠ 부분 일치 | text3(차등) 계산이 TS에 없음 (§3-1 참조) |
| `DispensingFeeCalculator.cs:CalcDrugSafe():L1611` | `counseling.ts:getNonFaceDispensingCode():L201` | ✓ 동일 | 공휴>심야>야간>기본 우선순위 완전 일치 |
| `DispensingFeeCalculator.cs:CalcDrugSafe():L1619-L1637` | `counseling.ts:calcCounseling():L264-L273` | ✓ 동일 | ZC001~ZC004 결정 후 return, ZH 미산정 동작 일치 |

### 1-2. 우선순위 체인 라인별 비교

**C# (L496~L555)**
```
비대면(U) → return sc (IsUntact=true)
hasPowder && dosDateAfterPowder(20231101) → sc.IsPowder=true, return
IsHolyDay → sc.IsHoliday=true
else if IsNight → sc.IsNight=true
else if IsMidNight:
    IsUnder6 → sc.IsMidNight=true
    else if Age!="" → sc.IsNight=true  ← 심야→야간 다운그레이드
else if IsSaturday && !IsNight && !IsHolyDay → sc.IsSaturday=true
IsUnder6 && !IsPowder → sc.IsChild=true  ← 독립 판정
```

**TS (`surcharge.ts:L77~L197`)**
```
isNonFace → return (모두 false)
isPowder → return (isChild=false 강제)
isHolyDay → return (isChild 반영)
isNight → return (isChild 반영)
isMidNight && isChild → return (isNight=true, isChild=true)
isSaturday → return (isChild 반영)
isChild → return (holidayGb='6')
```

**차이점 1 — 가루약 판정 조건**
- C#: `PowderYN != "N" && PowderYN != "" && drugCtx.MaxPowderDay > 0` (L508~L510)
- TS: `input.isPowder` 단일 boolean (surcharge.ts:L43~L94)
- TS 쪽은 hasPowderDrug() + dosDate 분기를 **호출자(dispensing-fee.ts:L230~L261)** 에서 수행해 isPowder boolean을 넘겨야 함. 이 책임 분리가 명시적이지 않아 호출자가 잘못 구성하면 2023.11.01 이전에도 isPowder=true가 넘어올 수 있음.

**차이점 2 — 심야→야간 다운그레이드 조건**
- C#: `else if (options.Age != "")` (L537) — 나이 문자열이 비어있지 않으면 다운그레이드
- TS: `isMidNight && isChild` 패스(L153) → isChild가 false면 다운그레이드 없이 그냥 넘어감. **6세 이상 성인이 심야 조건 체크인 경우 TS는 아무것도 안 함(야간으로 다운그레이드되지 않음)**

### 1-3. BuildSuffix() → getSurchargeSuffix()

C#의 `BuildSuffix()`는 text/text2/text3 3가지 접미사를 계산하고, 특히 **text3 (차등수가 해당/비해당)** 을 인수로 받은 영업시간(`_repo.SelectManageInOutTime`)을 기반으로 결정한다 (L589~L641).

TS `getSurchargeSuffix()`(L207~L255)는 text3 개념 자체가 없다. holidayGb와 codeType으로 접미사 문자열을 반환할 뿐이며, 차등수가 관련 "0"/"1" text3 결정 로직은 코드베이스 어디에도 없다.

### 포팅 정확도 종합 평가

가산 우선순위 체인(비대면→가루약→야간/공휴→심야→토요)의 골격은 정확히 포팅되었다. 그러나 두 가지 중요 차이가 있다. ①6세 이상 성인 심야→야간 다운그레이드가 TS에서 누락되었고, ②차등수가 text3 계산 로직이 TS에 전혀 존재하지 않는다. ZC 우선순위(공휴>심야>야간>기본)는 counseling.ts에서 정확히 재현되었다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 구현이 따르는 소스 | 비고 |
|---|---|---|---|---|---|---|
| 가산 우선순위 체인 (비대면 최우선) | 미확인 (VB6 분기 복잡) | 명시 (비대면→가루약→야간/공휴→심야→토요) | 확인됨 | 확인됨 | 공단/EDB | 우선순위 자체는 일치 |
| 토요 가산 별도 행 분리 | **미구현** (단일 행) | 2016.09.29 이후 별도 행 필수 | 구현됨 | 구현됨 | 유팜/EDB (saturday-split.ts) | 비즈팜 미구현 — 우리는 올바른 방식 채택 |
| 가루약 가산 우선순위 | **미구현** | 2023.11.01 이후 최우선 | 구현됨 (MaxPowderDay 기반) | 구현됨 | 유팜/EDB | 비즈팜 미구현 — 우리는 올바른 방식 채택 |
| 비대면 ZC 코드 (ZC001~ZC004) | 미확인 | ZC 코드 명시 | 확인 필요 | **ZC001~ZC004 구현 (EDB 확인됨)** | EDB/공단 | 우선순위: 공휴>심야>야간>기본 |
| 심야→야간 다운그레이드 | 미확인 | 명시 (6세 이상 심야 미적용) | 구현됨 | **명시적 다운그레이드 로직** | EDB | TS 미구현 (§3-2 참조) |
| 차등수가 4구간 (75건/76-100/101-150/151+) | **미구현** | 명시 (4구간) | 확인 필요 | 영업시간 기반 text3 판정 | C# (DispensingFeeCalculator) | **TS 미구현 (§3-1 참조)** |
| 가루약 단가 2023.11.01 변경 (Z41xx→Z41xx100) | **미구현** | 명시 | 구현됨 | 구현됨 | 유팜/EDB | TS도 구현됨 (powder.ts) |

### 4소스 불일치 항목 요약

- `토요 가산`: 비즈팜은 단일 행(미구현) vs 공단/유팜/EDB는 별도 행 — 우리는 별도 행 채택(올바름)
- `가루약 가산`: 비즈팜 미구현 vs 나머지 3소스 — 우리는 2023.11.01 분기 채택(올바름)
- `차등수가 4구간`: 비즈팜 미구현, 유팜 확인 필요, EDB는 영업시간 기반 text3로 구현 — **우리 TS는 미구현**; C#(DispensingFeeCalculator)에는 text3 로직이 있으나 TS로 미포팅

---

## 3. 의심 항목 (Suspicious)

- [🔴 Suspicious / Critical] **6세 이상 성인 심야→야간 다운그레이드 누락**: C# `DetermineSurcharge():L537`은 `Age != ""`이면 IsMidNight → IsNight 다운그레이드를 수행한다. TS `surcharge.ts:L151-L162`는 `isMidNight && isChild`(6세 미만)만 처리하므로, 6세 이상 환자가 심야 조건으로 들어오면 어떤 가산도 적용되지 않는다(`holidayGb='0'`). (`surcharge.ts:L151-L162` vs `DispensingFeeCalculator.cs:DetermineSurcharge():L529-L542`)

- [🔴 Suspicious / Critical] **차등수가 text3 미구현**: C# `BuildSuffix():L570-L641`에서 Z코드 접미사의 마지막 자리(text3)를 "0"(차등 해당) 또는 "1"(차등 비해당)으로 결정하고, 이 값이 Z1000/Z2000/Z3000/Z41xx 전체 코드에 영향을 미친다. TS `getSurchargeSuffix():L207-L255`는 text3 개념 자체가 없다. 즉, 건강보험(C 계열) 환자의 모든 수가 코드에서 차등수가 접미사가 빠진 채 산정된다. (`surcharge.ts:getSurchargeSuffix()` — `DispensingFeeCalculator.cs:BuildSuffix():L570`)

- [🟠 Suspicious / High] **가루약 isPowder 판정 책임 분리 문제**: C#은 `DetermineSurcharge()`가 직접 `hasPowder && dosDateAfterPowder` 조건을 판정한다(L508-L517). TS는 호출자(`dispensing-fee.ts:L230`)가 `hasPowderDrug()` 결과를 `isPowder`로 넘기되, 날짜 분기(2023.11.01)는 `dispensing-fee.ts:L261`에서 별도로 처리한다. `determineSurcharge()`에는 날짜 분기가 없으므로, 호출자가 날짜를 고려하지 않은 `isPowder=true`를 넘기면 2023.11.01 이전에도 가루약 가산이 우선 적용된다. (`surcharge.ts:L93-L103` vs `DispensingFeeCalculator.cs:L508-L518`)

- [🟡 Suspicious / Medium] **2023.12.15 가산 코드값 변경 반영 여부 불명**: 2023.12.15 기준 일부 Z코드 단가 고시가 변경되었다는 외부 언급이 있으나, TS 코드베이스에 날짜 기반 분기가 없다. 수가 마스터를 DB에서 연도별(`getSugaFeeMap(year)`)로 로드하는 방식이므로 DB 데이터가 올바르면 자동 반영되나, DB 데이터 정확성은 본 검증 범위 밖이다.

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🔴 Insufficient / Critical] `determineSurcharge()`: 가루약 가산 날짜 분기(2023.11.01)가 함수 내에 없음 — 호출자 의존 구조. 호출자가 분기를 빠뜨릴 경우 2023.11.01 이전에도 가루약 우선순위가 발동됨 (`surcharge.ts:L93-L103`)

- [🟠 Insufficient / High] `getNonFaceDispensingCode()`: ZC001~ZC004 시행일(2023.06.01) 분기 파라미터 `_dosDate`가 선언만 되고 실제로 사용되지 않음 (`counseling.ts:L201-L218` — `_dosDate` 미사용). 2023.06.01 이전 조제에도 ZC 코드가 산정될 수 있음.

- [🟠 Insufficient / High] `calcPowderSurchargeFromCtx()`: `isAfter20231101` 플래그를 컨텍스트로 받으나, `calcPowderSurcharge()` 단순 함수(L200-L226)는 `dosDate.replace(/\./g, '') >= '20231101'`로 자체 판정한다. 두 함수 간 날짜 판정 방식이 불일치할 경우 경계일 처리에서 오동작 위험 (`powder.ts:L208` vs `powder.ts:L48`)

### 4-2. 보험 코드 분기

- [🔴 Insufficient / Critical] `determineSurcharge()` / `getSurchargeSuffix()`: 보험코드(InsuCategory) "C" 여부에 따른 차등수가 text3 분기가 전혀 없음. C# `BuildSuffix():L593`은 `options.InsuCategory == "C"` 조건을 명시적으로 판정하나 TS에는 해당 분기 없음. (`surcharge.ts:L77-L197`)

- [🟠 Insufficient / High] `determineSurcharge()`: DrugSafeYN "Y" 또는 "A"(투약안전관리료)에 대한 처리가 없음. C#은 `BuildSuffix():L598-L603`에서 이 코드값이 차등수가를 면제시키는 조건으로 사용된다. TS에는 Y/A 분기 없음.

### 4-3. 특수 케이스 분기

- [🔴 Missing / Critical] **차등수가 4구간 판정 미구현**: 건강보험 약국 조제료는 월별 조제 건수(75건 이하 / 76~100건 / 101~150건 / 151건 이상)에 따라 수가가 차등 적용된다. C#은 영업시간 기반 프록시로 `text3="0"/"1"`을 결정하나(L605-L628), 정식 4구간 판정(월별 건수 기반)은 C#에도 DB 조회(`_repo.SelectManageInOutTime`) 방식으로 처리되고 있어 완전한 4구간 구현이 아니다. TS에는 text3 자체가 없음 — **4구간 모두 미구현**

- [🟡 Insufficient / Medium] `applySaturdaySurchargeRows()`: 토요+내복+외용 동시 조제 시 `Z4121030`이 없다는 주의사항이 주석에 명시되어 있으나, 이 케이스에서 `Z41xx030`(내복)과 `Z4120030`(외용) 중 어느 것을 적용해야 하는지 코드에 분기가 없다. C# 동작과의 비교 검증 필요 (`saturday-split.ts:L17-L18`)

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- [🟠 Insufficient / High] `surcharge.ts` / `dispensing-fee.ts`: C#은 `decimal` 타입으로 금액 계산 후 `RoundToInt()`(banker's rounding 아닌 0.5 올림)를 적용한다. TS는 JS `number`(IEEE 754 double)를 사용한다. 가산 판정 자체는 정수 비교이므로 직접 영향은 낮으나, 가산 단가 계산 과정에서 `price * cnt`가 number 연산이므로 큰 금액에서 미세 오차 가능성이 있다.

### 5-2. Null 안전성

- [🟡 Insufficient / Medium] `determineSurcharge()`: `input.age`가 undefined이면 `typeof input.age === 'number'` 체크로 0으로 처리된다(`surcharge.ts:L78`). 0세로 처리되면 isChild=true가 되어 소아 가산이 잘못 적용될 수 있다. 의도적 기본값인지 확인 필요.

- [🟡 Insufficient / Medium] `calcPowderSurcharge()` (단순 인터페이스, L200-L226): 반환되는 WageListItem의 `price: 0`, `sum: 0` — 실제 단가 없이 반환하므로 호출자가 DB 조회를 빠뜨리면 0원 행이 결과에 포함됨. 주석에 경고가 있으나 타입 수준에서 강제되지 않음 (`powder.ts:L212-L219`)

### 5-3. 경계 조건

- [🟡 Insufficient / Medium] `getSaturdayAddCodes()` (`surcharge.ts:L263-L288`): `internalDay <= 15`이면 `Z41${padStart(2,'0')}030` 직접 생성, 16일 이상은 "별도 처리"라고 주석 처리되었으나 함수가 빈 codes 배열만 반환. 16일 이상 토요 내복 조제 케이스에서 토요 내복가산이 누락됨.

---

## 6. 기타 관찰 사항

### 6-1. 비즈팜 미구현 항목 — 의도적 제외 확인 필요
비즈팜은 토요 가산 별도 행 분리와 가루약 가산 우선순위를 구현하지 않았다. 우리 TS는 이 두 항목을 올바르게 구현했으나, 비즈팜 기반 환경에서 마이그레이션하는 약국의 경우 계산 결과 차이가 발생할 수 있다는 점을 사용자에게 고지해야 한다.

### 6-2. 유팜 가루약 우선순위
유팜은 MaxPowderDay > 0 조건을 사용해 C#과 동일하게 가루약을 판정한다. TS는 DrugItem.isPowder === '1' 필드 기반이므로, element 방식(ATB/ACH/AGN)으로 가루약을 식별하는 일부 처방전은 미처리될 수 있다 (`powder.ts:L69-L76` 주석 참조).

### 6-3. EDB 비대면 ZC 우선순위 일치
EDB가 ZC001~ZC004를 공휴>심야>야간>기본 순으로 구현한 것이 C# `CalcDrugSafe():L1619-L1628`과 일치하며, TS `getNonFaceDispensingCode():L201-L218`도 동일하다. 이 항목은 3소스 일치로 검증 완료.

### 6-4. 차등수가 구현 우선순위 권고
차등수가 4구간은 건강보험(C 계열) 전체에 영향을 미치는 중요 기능으로, 현재 C#에서도 완전한 4구간(월별 건수)이 아닌 영업시간 프록시로 처리된다. TS 구현 시 다음 순서를 권장한다:
1. `CalcOptions`에 `monthlyDispenseCount: number` 추가
2. `surcharge.ts` 또는 별도 `tiered-fee.ts`에서 4구간 판정 함수 구현
3. `dispensing-fee.ts`의 각 Z코드 결정 시 text3에 해당하는 접미사 반영

### 6-5. 2023.11.01 / 2023.12.15 날짜 분기 정리
- **2023.11.01**: 가루약 가산 신체계 전환 — C#/TS 모두 구현됨 (`powder.ts:L48`, `DispensingFeeCalculator.cs:L510`)
- **2023.11.01**: Z2000 심야+6세 코드 변경 (Z200062x → Z200064x) — C# 구현됨(L776-L779), TS `dispensing-fee.ts:z2000Code()`에 holidayGb='8' 경로(L104)가 있으나 Z2000610 고정 코드 사용 — 2023.11.01 이전 Z200062x 분기 없음
- **2023.12.15**: 가산 코드값 변경 — DB 수가 마스터로 관리되므로 코드 변경 없이 DB 업데이트로 처리 가능. TS 코드 수준 이슈 없음.

---

*CH04 Verifier (Phase 2 Team 4B) — 2026-04-06*
