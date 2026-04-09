# CH02 교차 검증 보고서

> 작성자: CH02 Verifier (Phase 2 Team 2B)
> 작성일: 2026-04-06
> 챕터: CH02 — 조제료 코드체계 (Z코드 완전 레퍼런스)
> 참조 분석 보고서: `ch02_analyst.md` (작성일: 2026-04-06)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

> 동일 계산 로직의 원본 C# 파일과 TypeScript 포팅 파일을 1:1로 대응시키고 포팅 정확도를 평가한다.

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|--------------------|-----------------------------|------------|------|
| `DispensingFeeCalculator.cs:GetInJojeSugaCD():L652` | `dispensing-fee.ts:z4InternalCode():L124` | ⚠ 부분 일치 | 1~15일 정확. 16일+ 임시코드 `Z4116` 하드코딩 버그 존재. §3 참조 |
| `DispensingFeeCalculator.cs:GetMedMgmtSugaCD():L672` | — | ✗ 미포팅 | Z5xxx 25구간 코드 생성 로직 없음. SugaFeeTable에도 Z51xx/Z53xx 미등록 |
| `DispensingFeeCalculator.cs:BuildBaseJojeCode():L101` | `dispensing-fee.ts:z2000Code():L98` | ⚠ 수식 차이 | text3(차등수가) 미반영. 소아심야(Z2000640) 미분기. §3 참조 |
| `DispensingFeeCalculator.cs:BuildDrugGuideCode():L129` | `dispensing-fee.ts:z3000Code():L111` | ⚠ 수식 차이 | 심야(IsMidNight) 분기 없음. Z3000020/Z3000040 미생성 |
| `DispensingFeeCalculator.cs:BuildTimedCode():L73` | `dispensing-fee.ts:z2000Code() 인라인` | ⚠ 부분 일치 | text3 미결합. C#은 `"0"+text2+text3`, TS는 코드 테이블 직접 하드코딩 |
| `DispensingFeeCalculator.cs:BuildInternalCode():L1362` | `dispensing-fee.ts:z4InternalCode():L124` | ⚠ 수식 차이 | 산제신체계(100 접미사)는 구현. text3 미반영. 심야 text2="2" 미정의 |
| `DispensingFeeCalculator.cs:BuildBaseJojeSaturdayCode():L126` | `dispensing-fee.ts:z4BothCode():L155` + `saturday-split.ts` | ⚠ 구조 불일치 | C#은 소아 토요=Z2000630 별도 처리. TS는 토요 기본코드 직접 반환 후 split에서 처리 |
| `DispensingFeeCalculator.cs:DetermineSurcharge():L496` | `surcharge.ts:determineSurcharge():L77` | ⚠ 부분 일치 | 비대면·가루약·야간/공휴·토요·소아 우선순위 일치. 심야 6세+ 성인 다운그레이드 존재(C# L538~541)하나 TS에서 미처리 |
| `DispensingFeeCalculator.cs:BuildSuffix():L570` | `surcharge.ts:determineSurcharge():L77` | ✗ 구조 비대칭 | C#은 text/text2/text3 3필드 SuffixSet 반환. TS는 holidayGb 단일값 + isPowder/isChild 분리. text3 전무 |
| `DispensingFeeCalculator.cs:CalcDrugMgm():L1524` | `dispensing-fee.ts:z5000Code():L164` | ✗ 심각 차이 | C#은 병팩=Z5011·마약=Z5001·구간코드 Z5xxx 분기(L1528~1573). TS는 항상 Z5000 반환 |
| `SugaCodes.cs` 전체 | `supabase/seed.sql` (Z코드 마스터) | ⚠ 3개 누락 | §2 상세 |

### 포팅 정확도 종합 평가

C# `DispensingFeeCalculator.cs`의 Z코드 생성 핵심 구조(BuildSuffix → BuildBaseJojeCode/BuildInternalCode)가 TS에서 근본적으로 다른 방식으로 구현되었다. C#은 text/text2/text3 세 필드를 독립적으로 유지하다 최종 결합하는 구조이나, TS는 holidayGb 단일 코드로 압축하여 text3(차등수가)를 완전히 소거하였다. 이로 인해 차등수가 비해당(末尾 "1") 코드(Z2000011, Z4101011 등 seed.sql에 63개 존재)가 전혀 생성되지 않는다. 또한 소아심야(IsMidNight) 분기가 C#에서 독립 코드 체계(Z2000620/Z2000640, Z3000020/Z3000040)를 사용하는 데 비해 TS는 holidayGb='8'(소아야간)과 혼용하여 오코드를 생성한다. `GetInJojeSugaCD()` 25구간 로직 자체는 C#과 동일하나, 신체계 산제(usePowderNewCode) 경로에서 16일+ 구간을 `Z4116`으로 하드코딩하는 버그가 추가 도입되었다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 구현이 따르는 소스 | 비고 |
|----------|--------|-----------|------|-----|----------------------|------|
| Z코드 기본코드 5자리 체계 | Holiday_gb 단일값 → 코드 직접 조회 | 산정코드 의미I/II/III 3자리 체계 | bool 6개 파라미터 → 점수 가산 방식 | text/text2/text3 3필드 결합 | 비즈팜 + EDB 혼합 | holidayGb는 비즈팜 호환, 코드 조합 로직은 C#(EDB 계열) |
| GetInJojeSugaCD 25구간 | DB PZCVALUE 직접 조회 | 투약일수별 구간 명시 | 투약일수별 구간 코드 | `GetInJojeSugaCD()` 동일 로직 | C# (EDB/우리 엔진) | 1~15일: Z41xx, 16일+: Z43xx — 4소스 구간 경계 일치 |
| 의약품관리료 Z5xxx 방식 | DB에서 Z5xxx 코드 조회 | 투약일수별 25구간 | 투약일수별 구간 (Get조제료Item) | `GetMedMgmtSugaCD()` C# 동일 | 미채택 | TS/seed.sql 모두 미구현 상태 |
| 수가 단가 저장 방식 | `PZCVALUE.insurance_amt` 정수 | 점수 × 점수당단가 (p.154) | `Load보험기준가(적용일)` | `SelectMediWage(dosDate)` → EAV 탭구분 | C# (EDB 계열) | seed.sql/repo 방식은 EDB와 동일 |
| 토요가산 별도 행 분리 | Z코드 직접 누적 (분리 미확인) | 별도 코드 사용 | 기본/가산 분리 합산 | 별도 GetPrice 호출 | 유팜/EDB 혼합 | 2016.09.29 이후 별도 행 분리 구현됨 |
| holiday_gb 7↔8 의미 | "7"=소아+공휴, "8"=소아+야간 | 산정코드 의미I "7" 정의 없음 | 독립 bool 파라미터 | text="6" + text2 조합 | 비즈팜 정의 채택 | TS surcharge.ts L19~20이 비즈팜과 동일 방향 |
| 비대면(UntactYN) 처리 | 별도 확인 필요 | ZC001~ZC004 코드 체계 | 별도 분기 | `DrugSafeYN[0]='U'` → ZC | C# (EDB 계열) | `DispensingFeeCalculator.cs:L501` ↔ `counseling.ts` |
| ZH(투약안전/재난) 처리 | 미확인 | ZH001~ZH004 체계 | 미확인 | `DrugSafeYN[0]='Y'/'A'` 분기 | C# (EDB 계열) | TS에 ZH 흐름 전무 — 누락 |

### 4소스 불일치 항목 요약

- `Z5xxx 의약품관리료 방식`: 비즈팜/유팜/EDB/공단 모두 투약일수별 25구간 코드 체계를 사용 — 우리는 Z5000 단일 고정. 4소스 전체와 불일치.
- `text3 차등수가 접미사`: EDB `text3` 필드, 공단 산정코드 "의미III" 체계가 동일. 비즈팜 미확인, 유팜 점수 방식. 우리는 text3 전무 — EDB/공단과 불일치.
- `소아심야 코드(Z2000640)`: EDB `text="6"+text2="4"`, 공단 산정코드 의미I=6·의미II=4 체계. 비즈팜 Holiday_gb '8' 단일 처리. 우리는 비즈팜 방식으로 Z2000610 생성 — EDB/공단과 불일치.
- `의약품관리료 병팩(Z5011)`: 비즈팜·유팜·EDB·공단 모두 병팩 판정 시 Z5011 사용 — 우리 처방조제 경로에서 Z5011 미생성.

---

## 3. 의심 항목 (Suspicious)

- [🔴 Suspicious / Critical] **산제 신체계 16일+ 베이스코드 하드코딩**: `dispensing-fee.ts:calcDispensingFee():L266-268`에서 `usePowderNewCode` 조건(산제+2023.11.01 이후)일 때 내복약 투약일수 > 15이면 `baseCode = 'Z4116'`를 생성한다. Z4116은 seed.sql에 **존재하지 않는 코드**다. 올바른 코드는 `GetInJojeSugaCD` 로직에 따라 16~20일=Z4316, 21~25일=Z4321, …이 되어야 한다. 실제 단가 조회 시 `getPrice('Z4316100')=존재, getPrice('Z4116100')=0`이므로 신체계 산제 16일 이상 조제 시 `addWage(powderCode, 1)` 조건(`if getPrice(powderCode)>0`) 실패, 기본 `Z4116` 폴백이 또 가격 0 → 수가 행 미추가. (`dispensing-fee.ts:L266-268` vs `DispensingFeeCalculator.cs:GetInJojeSugaCD():L652-666`)

- [🔴 Suspicious / Critical] **text3 차등수가 접미사 전무**: `dispensing-fee.ts`의 모든 Z코드 생성 함수(`z2000Code`, `z3000Code`, `z4InternalCode` 등)는 text3를 반영하지 않는다. C#의 `BuildTimedCode("Z3000", text2, text3):L78`은 `baseCode + "0" + text2 + text3`를 반환하므로 차등수가 비해당 시 Z3000011(야간비해당), Z3000041(심야비해당) 등을 생성한다. TS는 항상 text3="0" 상당의 코드(Z3000010 등)만 생성, 차등수가 비해당 환자에게 잘못된 코드가 청구된다. seed.sql에 "011" 말미 코드 62개가 등록되어 있으나 전혀 사용되지 않는다. (`dispensing-fee.ts` 전체 vs `DispensingFeeCalculator.cs:BuildTimedCode():L73-78`, `BuildBaseJojeCode():L101-123`)

- [🔴 Suspicious / Critical] **소아심야(Z2000640) ↔ 소아야간(Z2000610) 오분류**: `surcharge.ts:determineSurcharge():L153`에서 `isMidNight=true && isChild=true` 시 `holidayGb='8'`을 반환한다. `dispensing-fee.ts:z2000Code():L104`에서 holidayGb='8' → `Z2000610`(소아야간)을 생성한다. 그러나 `DispensingFeeCalculator.cs:BuildBaseJojeCode():L108-109`는 소아심야에 대해 `Z2000` + (`"64"` after 20231101, `"62"` before) + text3를 조합하며, seed.sql에는 Z2000640/Z2000620이 소아야간 Z2000610과 별도로 존재한다. 소아심야 조제 시 야간요금이 심야요금 대신 청구된다. (`dispensing-fee.ts:z2000Code():L104` vs `DispensingFeeCalculator.cs:BuildBaseJojeCode():L108-109`)

- [🟠 Suspicious / High] **Z3000 소아야간 코드 불일치**: `dispensing-fee.ts:z3000Code():L112`에서 `holidayGb === '8'` → `Z3000010`(야간)을 반환한다. C#의 `BuildDrugGuideCode():L140-141`는 `IsNight || IsHoliday` → `BuildTimedCode("Z3000", text2, text3)`이며, 소아야간(IsNight && IsChild)의 경우 text2="1", text3=차등수가에 따라 Z3000011 또는 Z3000010을 생성한다. TS는 holidayGb='8' 입력을 야간 그대로 처리하므로 소아야간 text3 비해당 시에도 Z3000010이 고정 생성된다. (`dispensing-fee.ts:z3000Code():L112` vs `DispensingFeeCalculator.cs:BuildDrugGuideCode():L129-143`)

- [🟠 Suspicious / High] **Z3000 심야 코드(Z3000020/Z3000040) 미생성**: `dispensing-fee.ts:z3000Code()`는 holidayGb 체계에 심야 단독(isMidNight=true, age>=6)에 대응하는 코드가 없다. C#의 `DetermineSurcharge():L530-541`은 `IsMidNight=true, 6세 이상` 시 야간으로 다운그레이드(`sc.IsNight = true`)한다. TS의 `surcharge.ts:determineSurcharge():L151-162`는 `isMidNight && isChild`만 처리하고, 성인 심야(`isMidNight=true, isChild=false`)는 holidayGb='0'으로 떨어진다 — Z3000이 야간가산 없이 기본 코드로 산정된다. (`surcharge.ts:determineSurcharge():L151` vs `DispensingFeeCalculator.cs:DetermineSurcharge():L530-541`)

- [🟡 Suspicious / Medium] **getSurchargeSuffix() 미사용**: `surcharge.ts:getSurchargeSuffix():L207`이 공개 함수로 정의되어 있으나 `dispensing-fee.ts`는 이를 전혀 호출하지 않고 z2000Code/z3000Code 내부 switch로 직접 처리한다. 두 경로가 병존하며 향후 getSurchargeSuffix 수정이 dispensing-fee.ts에 반영되지 않을 위험이 있다.

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🔴 Critical] `z2000Code()`, `z3000Code()`: `dosDate >= '20231101'` 기준 분기 없음 — C#의 `BuildBaseJojeCode():L106`/`BuildDrugGuideCode():L136`은 2023.11.01 전후로 소아심야/심야 코드(Z2000640↔Z2000620, Z3000040↔Z3000020)를 달리 생성한다. TS는 날짜를 전달받지 않으므로 시행일 전후 코드 분기 자체가 불가능하다.

- [🟠 High] `calcDispensingFee()`: 신체계 산제(usePowderNewCode) 판정에서 `opt.dosDate >= '20231101'` 분기는 존재(`L261`)하나, 이 경로에서 16일+ 구간 코드를 `Z4116`으로 하드코딩하여 날짜 분기의 효과가 소멸된다. (`dispensing-fee.ts:L266`)

- [🟡 Medium] `surcharge.ts:determineSurcharge()`: `isMidNight=true, age>=6`(성인 심야) 입력 시 야간 다운그레이드 로직이 없어 holidayGb='0'(가산 없음)으로 처리된다. C# `DetermineSurcharge():L537-541`의 다운그레이드 동작과 불일치.

### 4-2. 보험 코드 분기

- [🔴 Critical] `z2000Code()`, `z3000Code()`, `z4InternalCode()`: text3 차등수가 접미사가 전무하다. C#의 `BuildSuffix():L591-638`은 `options.InsuCategory == "C"` 여부 + `DrugSafeYN[0]` + 영업시간 판정으로 text3를 결정한다. TS는 `CalcOptions`에 `insuCategory`/`DrugSafeYN` 파라미터가 전달되더라도 Z코드 생성 시 text3를 전혀 사용하지 않는다. (`dispensing-fee.ts:z2000Code():L98` vs `DispensingFeeCalculator.cs:BuildSuffix():L570-641`)

- [🟠 High] `calcDispensingFee()`: 처방조제 경로에서 `isDrugNarcotic`/`isAllPack` 판정 없이 항상 Z5000 사용. 마약류 포함 여부(Z5001)와 전체 병팩 여부(Z5011) 분기가 없다. C#의 `CalcDrugMgm():L1524-1573`과 직접 대응.

### 4-3. 특수 케이스 분기

- [🔴 Critical] `calcDispensingFee()`: ZH(투약안전관리료/재난응급) 처리 흐름 전무. C#의 `CalcDrugSafe():L26(mapping)` — `DrugSafeYN[0]='Y'/'A'` 분기가 없다.

- [🟠 High] `calcDispensingFee()`: 주사제 단독(`isInjectionOnly=true`) 경로에서 Z5000만 반환하고 종료(`dispensing-fee.ts:L241-246`). C#은 동일 조건에서 `Z4130`(자가주사) 산정 로직을 별도로 보유(`DispensingFeeCalculator.cs:CalcSelfInjection()`).

- [🟠 High] `z3000Code()`: holidayGb='6'(소아 단독)에 대한 처리 없음(default로 Z3000 반환). C#의 `BuildDrugGuideCode():L140`은 소아 단독을 명시적으로 Z3000 기본 반환으로 처리하므로 결과는 동일하나, 의도가 코드에 표현되지 않음.

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- [🟠 High] `calcDispensingFee()`: 수가 단가를 `number` 타입으로 처리. C#은 `decimal` (`_wageData.GetPrice()` 반환 후 `RoundToInt(decimal v)` 적용). TS의 `addWage(code, cnt)` — `sum = price * cnt`에서 `number` 정밀도만 사용. 단가 자체는 seed.sql에서 정수로 저장되므로 실질 오차 가능성은 낮으나, 향후 소수점 단가 입력 시 위험. (`dispensing-fee.ts:L215`)

- [🟡 Medium] `classifyDrugs()`: `Math.floor(drug.dDay)` 적용 (`dispensing-fee.ts:L75`). C#의 `DrugItem.DDay`는 `decimal` 타입이며 절사(`int`)는 명시적 캐스팅. 행동 동일하나 타입 문서화 미흡.

### 5-2. Null 안전성

- [🟡 Medium] `calcDispensingFee()`: `opt.drugList`가 비어있을 때 `classifyDrugs([])` 호출 후 `coveredCount===0` 분기로 조기 반환한다 (`dispensing-fee.ts:L234`). C#의 `Calculate():L171`은 빈 목록 시 `InvalidCalcOptionsException`을 던진다. TS는 조용히 빈 결과 반환 — 호출자가 오류를 인지하지 못할 수 있다.

- [🟡 Medium] `z4InternalCode()`: `days <= 0` 처리 없음 (`dispensing-fee.ts:L124`). C#의 `GetInJojeSugaCD():L654`는 `days < 1`이면 `null` 반환.

### 5-3. 경계 조건

- [🟡 Medium] `z4InternalCode()`: `days <= 15` 분기에서 `days=0` 입력 시 `Z4100` 생성 (`'Z41' + '00'`). Z4100은 seed.sql에 존재하나 0일 조제는 유효하지 않은 입력. C#은 `days < 1 → null` 처리.

- [🟢 Low] `getSaturdayAddCodes()`: `internalDay=0` 입력 시 `Z41${00}030` = `Z4100030`을 코드에 추가할 수 있다. `Z4100030`은 seed.sql에 존재하나 0일 투약 시나리오는 정상 경로에서 발생하지 않으므로 실질 위험 낮음. (`surcharge.ts:getSaturdayAddCodes():L276`)

---

## 6. Z코드 마스터 데이터: C# SugaCodes.cs vs Supabase seed.sql

### 6-1. SugaCodes.cs 상수 vs seed.sql 코드 비교

`SugaCodes.cs`에 정의된 기본 코드 상수 28개 중 3개가 `seed.sql`(2024/2026 데이터)에 없다.

| 코드 | SugaCodes.cs | seed.sql | 비고 |
|------|:---:|:---:|------|
| `Z4020` (산제직접조제) | ✓ L70 | ✗ | 직접조제 경로에서만 사용. `DispensingFeeCalculator.cs:CalcDirectInternal()` 참조 |
| `ZE101` (2025추석 단기) | ✓ L142 | ✗ | 2025년 신설. seasonal.ts 코드에서 참조하나 단가 0 |
| `ZE102` (2025추석 장기) | ✓ L145 | ✗ | 동상 |

`seed.sql`에는 있으나 `SugaCodes.cs` 상수로 미등록된 코드(주로 접미사 파생 코드 및 구간 코드)는 총 22개이다. 이 코드들은 Z코드 생성 로직 내에서 문자열로 직접 조합되어 사용되므로 상수 누락 자체가 런타임 버그를 유발하지는 않는다.

| 카테고리 | 대표 코드 | 개수 | 설명 |
|---------|----------|------|------|
| Z1000 파생 | Z1000001 | 1 | 차등수가 비해당 |
| Z2000 파생 | Z2000010~Z2000650 | 14 | 야간/공휴/소아/토요/심야 조합 |
| Z3000 파생 | Z3000010~Z3000050 | 7 | 야간/공휴/심야/토요 |
| Z5010, Z5061 | Z5010, Z5061 | 2 | 의약품관리료 외용·Z5061 |

### 6-2. seed.sql vs SugaFeeTable.cs 완전 일치 확인

seed.sql과 `SugaFeeTable.cs`에 등록된 Z코드 집합은 **282개로 완전 일치**한다. 양쪽에서 동일한 코드가 누락되어 있다 — Z5011(병팩), Z51xx/Z53xx(의약품관리료 구간), ZE101/ZE102, Z4020이 둘 다 없다. C#의 `CalcDrugMgm()`이 Z5011을 `_wageData.GetPrice("Z5011")`로 조회하는데 `SugaFeeTable.cs`에 Z5011이 없으면 가격 0 반환으로 행이 미추가되는 동일한 버그가 C# 측에도 잠재한다.

**[주요 누락 코드 — C#/TS/seed.sql 전체에서 없음]**

| 코드 | 사용처 | 영향 |
|------|--------|------|
| `Z5011` | `CalcDrugMgm():L1530` | 병팩 조제 시 의약품관리료 미산정 |
| `Z51xx/Z53xx` (25구간) | `GetMedMgmtSugaCD():L672-686` | 의약품관리료 구간코드 전량 미산정 |
| `ZE101`, `ZE102` | `SugaCodes.cs:L142,145` / `seasonal.ts` | 2025추석 명절가산 미산정 |
| `Z4020` | `SugaCodes.cs:L70` / 직접조제 경로 | 직접조제 산제가산 일부 미산정 가능 |

---

## 7. Holiday_gb 7↔8 교차 매핑 검증 (비즈팜 버그 여부)

ch02-조제료코드.md §9 및 ch04-가산로직.md L178~197에 따른 비즈팜 Holiday_gb 체계:

```
"7" = 6세 미만 + 공휴일
"8" = 6세 미만 + 야간
```

비즈팜의 내부 전환 로직 (ch04-가산로직.md L193~196):
```
IF 나이 < 6세:
    IF Holiday_gb = "1" → "8"  (야간 → 소아야간)
    ELIF Holiday_gb = "5" → "7"  (공휴 → 소아공휴)
```

**TS `surcharge.ts` 매핑 (검증 결과):**
- `isHolyDay=true + isChild=true` → `holidayGb: '7'` (`surcharge.ts:L111`)
- `isNight=true + isChild=true` → `holidayGb: '8'` (`surcharge.ts:L133`)

**판정: 비즈팜과 TS의 7↔8 정의는 일치한다.** 7=소아공휴, 8=소아야간이며 교차 오류 없음.

ch02-조제료코드.md §9-4의 "Z4121 7일↔8일 버그"는 Holiday_gb 7/8 교차가 아니라 Z4121의 **투약일수** 7일/8일에 대한 비즈팜 내부 코드·점수 뒤바뀜 문제다. TS의 Z4121은 투약일수와 무관하게 방문당 1회 고정 코드를 사용하므로 이 특정 버그는 TS에서 재현되지 않는다.

**단, 관련 실질 버그 확인:** `z2000Code()` (`dispensing-fee.ts:L103-104`)에서 holidayGb='8' → `Z2000610`(소아야간)을 생성하는데, 소아야간이 올바르고, 소아심야(isMidNight=true)도 동일 holidayGb='8'에 해당하여 소아심야 시 Z2000640 대신 Z2000610을 생성하는 문제(§3 상세)는 Holiday_gb 7↔8 정의 자체의 문제가 아니라 심야/야간 구분을 단일 holidayGb 값으로 처리하는 설계 한계에서 비롯된다.

---

## 8. 분석가 보고서 교차 확인 결과

분석가(ch02_analyst.md) 발견 항목을 독립 검증하여 아래와 같이 확인/보완한다.

| 분석가 항목 | 검증 결과 | 보완 사항 |
|-----------|---------|---------|
| Z4130 미구현 | ✓ 확인 — `isInjectionOnly` 경로 Z5000만 반환 | C#의 `CalcSelfInjection()` 메서드 존재 확인 |
| Z5101~Z5391 미구현 | ✓ 확인 — TS 코드 없음, seed.sql 없음, **C# SugaFeeTable.cs도 없음** | C#에서도 `GetMedMgmtSugaCD()` 반환 코드 조회 시 가격 0 → 동일 버그 잠재 |
| Z5001/Z5011 분기 없음 | ✓ 확인 + Z5011은 seed.sql·SugaFeeTable.cs 양쪽 미등록 | C# `CalcDrugMgm()` L1530에서 Z5011 조회하나 데이터 없음 |
| ZH 미구현 | ✓ 확인 | |
| Z1000 차등수가 분기 없음 | ✓ 확인 — Z1000001 seed.sql 존재하나 미사용 | |
| text3 전무 | ✓ 확인 + 심각도 Critical으로 상향 평가 | seed.sql에 text3=1 코드 62개 미사용 확인 |
| Z2000640 오분류 | ✓ 확인 + C#의 BuildBaseJojeCode 비교로 구체화 | Z2000620(2023.11.01 이전) 분기도 누락 |
| ZE101/ZE102 seed.sql 누락 | ✓ 확인 — SugaFeeTable.cs도 동일 누락 | |
| 산제 16일+ Z4116 하드코딩 | **신규 발견** — 분석가 보고서 미언급. §3 상세 | Z4316100 존재, Z4116100 미존재 확인 |
| 성인 심야 처리 누락 | **신규 발견** — TS에서 성인 심야 시 holidayGb='0', Z코드 야간 접미사 미부착 | C# L537~541 다운그레이드 로직 대응 없음 |

---

*분석 기준 파일 버전: `DispensingFeeCalculator.cs` (2,059줄), `surcharge.ts` (288줄), `dispensing-fee.ts` (359줄), `seed.sql` (282건)*

**[약제비 분析용]**
