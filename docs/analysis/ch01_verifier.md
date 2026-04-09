# CH01 교차 검증 보고서

> 작성자: CH01 Verifier (Phase 2 Team 1B)
> 작성일: 2026-04-06
> 챕터: CH01 — 약품금액 계산
> 참조 분석 보고서: `ch01_analyst.md` (작성일: 2026-04-06)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

> 동일 계산 로직의 원본 C# 파일과 TypeScript 포팅 파일을 1:1로 대응시키고 포팅 정확도를 평가한다.

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `Models/DrugItem.cs:DrugItem.RecalcSum():L20-L26` | `src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L17-L22` | ⚠ 수식 구조 일치, 미묘한 차이 있음 | §1-1 참조 |
| `Engine/DispensingFeeCalculator.cs:CalculateDrugSumForDays():L1894-L1903` | `src/lib/calc-engine/modules/special/drug-648.ts:sum648DrugAmount():L116-L125` | ⚠ 반올림 함수가 다름 | §1-2 참조 |
| `Engine/DispensingFeeCalculator.cs:AssembleResult():L1767-L1849` | `src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum():L28-L44` | ⚠ 항별 분류 미흡 | §1-3 참조 |
| `Engine/DispensingFeeCalculator.cs:ClassifyDrugs():L331-L335` | — | ✗ 미포팅 | EXTYPE 필터 전혀 없음 |
| `Engine/DispensingFeeCalculator.cs:ClassifyDrugs():L339-L346` | — | ✗ 미포팅 | 비급여 코로나19 50,000원 고정 미구현 |
| `Engine/CopaymentCalculator.cs:Calculate():L129-L143` | `src/lib/calc-engine/modules/special/drug-648.ts:calcDrug648Surcharge():L192-L231` | ✓ 동일 | 날짜·보훈 분기·5% 공식 일치 |
| `Models/DrugItem.cs:DrugItem.ForceSetSum():L120-L124` | — | ✗ 미포팅 | 코로나19 50,000원 강제 세팅 메서드 없음 |
| `Utilities/RoundingHelper.cs:Round1():L32-L33` | `src/lib/calc-engine/rounding.ts:round1():L14-L16` | ✓ 동일 | Math.round() = AwayFromZero (양수) |
| `Utilities/RoundingHelper.cs:RoundToInt():L132-L133` | `src/lib/calc-engine/rounding.ts:roundToInt():L49-L51` | ✓ 동일 | Math.floor(v+0.5) |

### 1-1. RecalcSum vs calcDrugAmount — 수식 비교

**C# 원본** (`DrugItem.cs:L20-L26`):
```csharp
var amount = _dose * _dNum * _dDay;
if (_pack > 0) amount /= _pack;
else if (_pack < 0) amount = 0;
Sum = (int)Math.Round(amount * _price, MidpointRounding.AwayFromZero);
```

**TypeScript 포팅** (`drug-amount.ts:L17-L22`):
```typescript
const pack = drug.pack && drug.pack > 1 ? drug.pack : 1;
const amount = (drug.dose * drug.dNum * drug.dDay) / pack;
return Math.floor(amount * drug.price + 0.5);
```

**차이점 요약**:
1. **음수 팩 처리**: C#은 `_pack < 0`이면 amount = 0으로 명시. TypeScript는 `pack > 1` 조건에서 음수(-1 등)는 사실상 `pack = 1`로 처리 → 음수 팩 입력 시 동작이 다름.
2. **팩=0 처리**: C#은 `_pack > 0`일 때만 나누기. TypeScript는 `pack > 1`일 때만 나누기 → 팩=1인 경우 둘 다 나누기 없음(동일). 단 C#은 `pack=0`이면 나누기 안 함. TypeScript도 동일.
3. **반올림 함수**: C#은 `Math.Round(x, AwayFromZero)`, TypeScript는 `Math.floor(x + 0.5)`. 양수에서 결과 동일.
4. **중요**: C#의 `(int)Math.Round(...)` 는 decimal → int 캐스트이므로 소수점 완전 제거. TypeScript는 JS number 사용 → 부동소수점 오차 가능.

### 1-2. CalculateDrugSumForDays vs sum648DrugAmount — 반올림 함수 차이

**C# 원본** (`DispensingFeeCalculator.cs:L1894-L1903`):
```csharp
decimal amount = drug.Dose * drug.DNum * days;
if (drug.Pack > 0m) amount /= drug.Pack;
else if (drug.Pack < 0m) amount = 0m;
return Round1(amount * drug.Price);  // = Math.Round(v, 0, AwayFromZero) — decimal 반환
```

**TypeScript 포팅** (`drug-648.ts:sum648DrugAmount():L119-L124`):
```typescript
const pack = d.pack && d.pack > 1 ? d.pack : 1;
const amount = (d.dose * d.dNum * d.dDay) / pack;
const drugAmt = Math.floor(amount * d.price + 0.5);  // roundToInt 방식
```

**차이점**: C# `CalculateDrugSumForDays`는 `Round1`(= `Math.Round(x, AwayFromZero)`)을 사용하여 decimal 정밀도를 유지한 채 반올림. TypeScript는 `Math.floor(x + 0.5)` 방식. 양수에서 결과는 동일하나 `sum648DrugAmount()`는 `calcDrugAmount()`와 동일한 인라인 계산을 중복 구현하고 있어 단일 책임 원칙 위반 (분석가 보고서 §6 관찰 사항과 동일하게 확인).

### 1-3. AssembleResult vs calcDrugAmountSum — 항별 분류 비교

**C# 원본** (`DispensingFeeCalculator.cs:L1796-L1824`): `InsuPayType` 7종 switch로 NonCovered/Covered/Partial50/80/30/90/FullSelf 별도 합산.

**TypeScript 포팅** (`drug-amount.ts:calcDrugAmountSum():L28-L44`): `nonCovered` vs 그 외 2종으로만 분리. A/B/D/E/U항 개별 합산 없음.

**결론**: AssembleResult의 선별급여 항별 분리 로직이 TypeScript에 미포팅. 이는 분석가 보고서에서 [🟠 Insufficient/High]로 이미 식별됨. 독립 검증 결과 동일.

### 포팅 정확도 종합 평가

핵심 약품금액 계산 공식 자체(`(int)(소모량 × 단가 + 0.5)`)는 양수 입력 범위에서 C# 원본과 동일하게 동작한다. 그러나 세 가지 중요한 미포팅 항목이 있다: ①비급여 코로나19 치료제 50,000원 강제 세팅(ForceSetSum) 로직 전혀 없음, ②EXTYPE "1"/"9" 필터 없음, ③항별 합산 분류 부족(A/B/D/E/U 미분리). 또한 음수 팩 처리 방식이 C# 원본과 다르나 실제 데이터에서 음수 팩 입력이 없다면 무해하다. JS `number` 타입으로 인한 부동소수점 오차 가능성은 구조적 위험으로 남아 있다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 구현이 따르는 소스 | 비고 |
|---|---|---|---|---|---|---|
| **기본 공식** | `Int(qty×횟수×일수×단가+0.5)` | `단가×횟수×1일투여횟수×일수, 원미만 4사5입` | `(단가+장려금)×(1+할증%) × 소모량 → To원미만사사오입()` | `(int)(DOSE×DNUM×DDAY/PACK×PRICE+0.5m)` | EDB (소모량 나누기 방식, Math.floor+0.5) | 팩 처리 포함 |
| **반올림 방법** | `Int(x+0.5)` VB6 | 원미만 4사5입 | `Math.Round(AwayFromZero)` | `(int)(x+0.5m)` | EDB/비즈팜 방식(`Math.floor+0.5`) | 양수에서 4소스 결과 동일 |
| **팩 처리** | 없음(팩 개념 미확인) | 1회투약량 환산(방법1) | Get소모량()=사전 계산 | 소모량 나누기(방법2) | EDB (방법2) | 방법1,2 결과 동일 |
| **단가 결정** | DB 3단계 폴백(PPREVALU→PDRUDRUG→평균가) | 외부 마스터 전제 | 보험/실거래가/판매 동적 선택 | 외부 주입(PD_PRICE) | EDB 방식(외부 주입) | M01 미결 확정 |
| **비급여/전액본인 분류** | "부분" 단일 범주 | U항 별도 분리 | 직접/처방 조제에 따라 다름 | PD_INSUPAY 코드별 분리 | EDB 방식(7종 InsuPayType) — 단 합산은 부족 | M02 |
| **선별급여 A/B/D/E** | 없음(미지원) | 4항 분리, 각 요율 | 4개 별도 메서드 | 4개 별도 변수 | EDB/유팜/공단 일치 방향 — 구현 부족 | M04 |
| **코로나19 50,000원** | 미확인 | 미확인 | 50,000원 고정(비급여) | 5% 가산(급여 합산) | **C# 엔진**: 비급여 = 50,000원(유팜), 급여 = 5% 가산(EDB) **두 가지 모두** | M06 — C# YakjaebiCalc 엔진이 두 로직 통합 구현 |
| **사용장려금(퇴장방지)** | 미확인 | 직접조제 전용 | 직접/처방 구분 | 미확인 | 미구현 | M05 미결 |
| **EXTYPE 필터** | 없음 | 명시 없음 | 없음 | 코드 내 분기 있음 | **C# 엔진**: EXTYPE "1"/조건부 "9" 필터 구현(DispensingFeeCalculator.cs:L334-L335) — TypeScript 미포팅 | |

### 4소스 불일치 항목 요약

- **M01 단가 결정**: 비즈팜 3단계 폴백 DB 조회 vs 유팜 동적 선택 vs EDB/공단 외부 주입. 우리 TypeScript는 EDB와 동일하게 DrugItem.price를 외부에서 수령하는 방식 채택. 단가 결정 책임은 calc-engine 외부(API Route 등)에 있음 — 미포팅 범위로 분류.
- **M02 전액본인부담 귀속**: 유팜 직접/처방 조제 방식이 상이, EDB/공단은 별도 집계. 우리는 EDB 방식(FullSelf = InsuPayType.fullSelf로 별도 분류)을 채택했으나, C# AssembleResult에서의 항별 합산이 TypeScript calcDrugAmountSum()에서 미흡.
- **M04 선별급여 A/B/D/E**: 비즈팜 미지원. 우리 InsuPayType에 7종 정의 완료(EDB 방향). 단 calcDrugAmountSum()에서 항별 개별 합산이 없어 본인부담 계산 시 항별 요율 적용 불가 — 분리 구현 필요.
- **M06 코로나19 치료제**: C# YakjaebiCalc 엔진은 비급여 → 50,000원 고정(유팜 방식)과 급여 → 5% 가산(EDB 방식)을 통합 구현. TypeScript에는 5% 가산(EDB 방식)만 구현(drug-648.ts). 비급여 50,000원 강제 세팅(ForceSetSum)이 완전 미포팅.

---

## 3. 의심 항목 (Suspicious)

- [🟡 Suspicious / Medium] **음수 팩(-pack) 처리 상이**: C# `DrugItem.RecalcSum()`은 `_pack < 0`이면 amount = 0으로 강제 처리(DrugItem.cs:L24). TypeScript `calcDrugAmount()`는 `pack > 1` 조건만 체크하므로, 음수 팩(예: -1) 입력 시 `pack = 1`로 치환되어 `amount/1` 계산을 수행. C#과 동작이 다름. 음수 팩 입력 케이스가 실제 존재하는지 확인 필요 (`src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L18` vs `Models/DrugItem.cs:RecalcSum():L24`).

- [🟡 Suspicious / Medium] **sum648DrugAmount()의 중복 인라인 계산**: `sum648DrugAmount()`(drug-648.ts:L121-L122)가 `calcDrugAmount()`를 호출하지 않고 동일한 수식을 인라인 재구현. 향후 `calcDrugAmount()`의 팩 처리 로직이 변경될 경우 sum648DrugAmount()가 동기화되지 않는 위험. 단 현재 수식은 일치하므로 즉각적인 계산 오류는 없음 (`src/lib/calc-engine/modules/special/drug-648.ts:L121-L122` vs `src/lib/calc-engine/drug-amount.ts:L18-L21`).

- [🟡 Suspicious / Medium] **drug-amount.ts가 roundToInt()를 import하지 않고 인라인 구현**: `drug-amount.ts:L21`의 `Math.floor(amount * drug.price + 0.5)`는 `rounding.ts:roundToInt()`와 동일 로직을 인라인 반복. 코드 일관성 문제이나 결과는 동일 (`src/lib/calc-engine/drug-amount.ts:L21` vs `src/lib/calc-engine/rounding.ts:roundToInt():L49-L51`).

- [🔴 Suspicious / Critical] **비급여 코로나19 치료제 50,000원 처리 완전 누락**: C# `DispensingFeeCalculator.cs:ClassifyDrugs()`(L339-L346)는 `InsuPay == NonCovered && dosDate >= 20240501`이고 코드가 648903670/655502130/648903860 중 하나이면 `ForceSetSum(50000m)`으로 강제 세팅. TypeScript에는 이 로직이 전혀 없음. drug-648.ts는 급여 코드(648903860)의 5% 가산만 구현. 비급여 코로나19 치료제를 처방한 건에서 TypeScript는 정상 약가(수십만원 이상)를 계산하지만 C# 엔진은 50,000원을 반환 — 금액 차이가 매우 큼 (`Engine/DispensingFeeCalculator.cs:ClassifyDrugs():L339-L346` vs `src/lib/calc-engine/modules/special/drug-648.ts`).

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🔴 Critical] `calcDrugAmount()` 및 `calcDrugAmountSum()`: EXTYPE "9" 2020.03.01 이전/이후 분기 없음. C# `DispensingFeeCalculator.cs:L335`는 `EXTYPE == "9" && dosDate >= "20200301"`이면 해당 약품 skip. TypeScript에 EXTYPE 필드 자체 없음 — 2020년 이후 건에서 필터되어야 할 약품이 계산에 포함될 수 있음 (CH01 §7-4).
- [🔴 Critical] 비급여 코로나19 50,000원 적용 시작일(2024.05.01) 분기 없음. C# `DispensingFeeCalculator.cs:L342`에 `dosDate >= "20240501"` 조건 명시. TypeScript 미구현 (CH01 §7-1).
- [✓] 648 5% 가산 날짜 분기(2024.10.25): `drug-648.ts:SURCHARGE_START_DATE = '20241025'` 정상 구현.

### 4-2. 보험 코드 분기

- [🟠 High] 보훈코드 M81 가산 면제 누락: C# `CopaymentCalculator.cs:L137`는 `BohunCode.M10 or BohunCode.M83 or BohunCode.M82` 3종. TypeScript `drug-648.ts:EXEMPT_BOHUN_CODES`도 `['M10', 'M83', 'M82']` 3종 일치. 단 분석가 보고서에서 EDB 코드에서 M81도 면제 대상으로 확인됐다고 보고했으나, C# YakjaebiCalc 엔진은 M81을 면제 목록에 포함하지 않으므로 **C# 원본 기준에서는 TypeScript가 올바르게 포팅됨**. M81 면제 여부는 EDB vs YakjaebiCalc 간 불일치로 별도 확인 필요.
- [🔴 Critical] `InsuPayType.FullSelf`(전액본인부담/U항) 분류는 정의되어 있으나, C# `DispensingFeeCalculator.cs:AssembleResult()`에서 U항 약품은 302 대상 여부까지 추적(`sumInsuDrug100_302`). TypeScript에 U항 302 세부 분류 없음 (CH01 §4-1).

### 4-3. 특수 케이스 분기

- [🔴 Critical] `EXTYPE == "1"` 약품 필터: C# `DispensingFeeCalculator.cs:L334`는 EXTYPE="1"이면 무조건 skip. TypeScript DrugItem에 exType 필드 없음 — EXTYPE="1" 약품이 계산에 포함될 수 있음 (CH01 §7-4).
- [🟠 High] 비급여 코로나19 치료제 3종(648903670, 655502130, 648903860) 중 648903860 급여 5% 가산만 구현. 나머지 2종 비급여 50,000원 처리 없음 (CH01 §7-1).
- [🟡 Medium] `DrugItem.pack = 0` 처리: C# `RecalcSum()`은 `_pack > 0`이면 나누기(pack=0이면 나누기 없음). TypeScript `calcDrugAmount()`는 `pack > 1`이면 나누기(pack=0,1이면 나누기 없음). 결과는 동일하나 C#의 pack=0 처리 의도가 "0으로 나누기 방지"임을 명확히 주석으로 문서화 필요.

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- [🟠 High] `calcDrugAmount()`: C#은 `decimal` 타입으로 전체 계산(DrugItem 필드 Price/Dose/DNum/DDay/Pack 모두 decimal). TypeScript는 JS `number`(IEEE 754 배정밀도). 특히 `dose = 0.3333` 또는 `dNum = 1.5`와 같은 비정수 입력에서 JS 부동소수점 오차 발생 가능. 예: `0.3333 × 3 × 7 = 6.9993`는 JS에서 정확히 표현되나, `0.1 × 0.2 × 7 = 0.14000000000000001`과 같이 의도치 않은 반올림이 발생할 수 있음 (`src/lib/calc-engine/drug-amount.ts:L18-L21`).
- [🟠 High] `sum648DrugAmount()`: 동일한 JS number 오차 위험 존재. 추가로 `calcDrugAmount()`를 재사용하지 않고 인라인 계산하여 future drift 위험 (`src/lib/calc-engine/modules/special/drug-648.ts:L121-L122`).
- [🟡 Medium] `round1()`: `Math.round(v)`는 JS의 "round half away from zero"가 아닌 실제로는 "round half to positive infinity"임. 양수에서는 AwayFromZero와 동일하므로 현재 약제비 계산(항상 양수)에서 문제없음. 단 명세에 이 사실을 주석으로 명시하여 향후 음수 입력 추가 시 혼란 방지 권장 (`src/lib/calc-engine/rounding.ts:round1():L14-L16` — 실제로 현재 주석에 잘 설명되어 있음).

### 5-2. Null 안전성

- [🟡 Medium] `calcDrugAmount()`: `drug.pack`이 `undefined`일 경우 `drug.pack && drug.pack > 1`에서 `undefined`는 falsy이므로 `pack = 1`로 처리됨. 의도된 동작이나 명시적 null 체크 없음 (`src/lib/calc-engine/drug-amount.ts:L18`).
- [🟡 Medium] `calcDrugAmountSum()`: `drugs`가 빈 배열이면 `{ sumInsu: 0, sumUser: 0 }` 반환 — 정상. null/undefined 입력 시 런타임 오류 가능. 타입 레벨에서 `DrugItem[]`로 보장되어 있으나, 실제 호출 전 방어 코드 없음 (`src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum():L28`).

### 5-3. 경계 조건

- [🟡 Medium] **단가 최소 1원 보정 없음**: C# `CH01_약품금액_계산.md §2-4`에서 "단가가 1원 미만이면 1원으로 올린다" 규칙 명시. TypeScript `calcDrugAmount()`에 해당 보정 없음. `drug.price = 0`이면 금액 = 0원이 그대로 반환됨 (`src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L17-L22`).
- [🟡 Medium] `apply648DayLimit()`: `d.dDay > DAY_LIMIT_648` 조건에서 dDay가 음수이면 조건 불충족으로 그대로 통과. C# `DispensingFeeCalculator.cs:L363`는 `effectiveDDay == 0`이면 1로 보정하는 로직 추가. TypeScript에 0 또는 음수 dDay 처리 없음 (`src/lib/calc-engine/modules/special/drug-648.ts:apply648DayLimit():L97-L104` vs `DispensingFeeCalculator.cs:L362-L363`).

---

## 6. 기타 관찰 사항

- **비급여 코로나19 50,000원 vs 급여 5% 가산 — 두 로직의 통합**: C# YakjaebiCalc 엔진은 M06 충돌에 대해 유팜 방식(비급여→50,000원 고정)과 EDB 방식(급여→5% 가산)을 **모두 구현하여** 조건별로 분기하는 방식을 채택했음이 확인됨. TypeScript는 EDB 방식(5% 가산)만 구현. C# 원본을 따르려면 비급여 코로나19 약품 처리 로직도 추가 필요.

- **CalculateDrugSumForDays vs RecalcSum 반올림 함수 불일치 (C# 내부)**: C# 엔진 내부에서도 약품금액 계산 함수가 두 개 존재하며 반올림 방식이 미묘하게 다름. `DrugItem.RecalcSum()`은 `Math.Round(x, AwayFromZero)` (일반 decimal 반올림), `CalculateDrugSumForDays()`는 `Round1()`(= `Math.Round(v, 0, AwayFromZero)`) 사용. 결과는 동일하나 C# 엔진 내에서 미세한 설계 불일치가 있으며, TypeScript 포팅 시 `roundToInt()`(Math.floor+0.5) 방식을 선택한 것이 두 C# 함수 중 `CalculateDrugSumForDays` 쪽(EDB 원형)에 더 가까운 선택임.

- **분석가 보고서 검증 결과**: 분석가 보고서 ch01_analyst.md의 모든 누락/부족 항목을 독립 검증한 결과, 전부 실제로 확인됨. 추가로 발견한 항목은: ①음수 팩 처리 상이(§3 Suspicious/Medium), ②apply648DayLimit()의 dDay=0 보정 누락(§4-3 Insufficient/Medium), ③비급여 코로나19 50,000원 완전 누락(§3 Suspicious/Critical — 분석가 보고서에서 Missing/High로 분류했으나 금액 오차 크기상 Critical로 상향 조정 권고).

- **M01 단가 결정 아키텍처 확정**: TypeScript 구현은 EDB 방식(DrugItem.price 외부 주입)을 완전히 채택. 이는 calc-engine 레벨에서의 단가 결정 책임을 포기한 것으로, 상위 레이어(UI/API Route)에서 PPREVALU/PDRUDRUG/평균가 폴백 체인, WAPPid 실거래가 비교, Del_Yn 분기를 모두 처리해야 함. 현재 해당 상위 레이어가 구현되어 있는지 확인 필요.

- **집계자 통보 사항 (Critical 2건)**:
  1. 비급여 코로나19 치료제(648903670/655502130/648903860) 50,000원 강제 세팅 로직 완전 미포팅 — 실제 비급여 코로나19 처방 건에서 금액 수십만원 이상 오차 발생 가능.
  2. EXTYPE "1" 필터 미포팅 — EXTYPE="1" 약품이 계산에 포함되어 급여 약가 합산이 과대 계산될 위험.

---

*소스 참조:*
- *`C:\Projects\DSNode\약제비 분析용\YakjaebiCalc\YakjaebiCalc.Engine\Engine\DispensingFeeCalculator.cs`*
- *`C:\Projects\DSNode\약제비 분析용\YakjaebiCalc\YakjaebiCalc.Engine\Models\DrugItem.cs`*
- *`C:\Projects\DSNode\약제비 분析용\YakjaebiCalc\YakjaebiCalc.Engine\Engine\CopaymentCalculator.cs`*
- *`C:\Projects\DSNode\약제비 분析용\YakjaebiCalc\YakjaebiCalc.Engine\Utilities\RoundingHelper.cs`*
- *`C:\Projects\DSNode\약제비 분析용\output\CH01_CH07_소스간_모순_충돌_분析.md`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\drug-amount.ts`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\rounding.ts`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\modules\special\drug-648.ts`*
- *`C:\Projects\KSH\PharmaEdu\docs\analysis\ch01_analyst.md`*

**[약제비 분析용]**
