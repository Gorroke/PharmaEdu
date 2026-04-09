# CH03 교차 검증 보고서

> 작성자: CH03 Verifier (Phase 2 Team 3B)
> 작성일: 2026-04-06
> 챕터: CH03 — 조제료 수가 계산 로직 통합
> 참조 분석 보고서: `ch03_analyst.md` (작성일: 2026-04-06)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

### 1-1. 9개 수가항목 메서드 → TS 함수 매핑

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `DispensingFeeCalculator.cs:CalcPharmMgm():L730` | `dispensing-fee.ts:z1000Code():L93` + `addWage():L211` | ⚠ 부분 | `AddRat`(할증) 미포팅, `BuildStoreManageCode` 분기 단순화 |
| `DispensingFeeCalculator.cs:CalcBaseJoje():L765` | `dispensing-fee.ts:z2000Code():L98` + `addWage():L252` | ⚠ 부분 | 토요 가산 별도 행은 `saturday-split.ts`로 위임, 소아심야 신/구체계(20231101) 분기 없음 |
| `DispensingFeeCalculator.cs:CalcEatEdu():L857` | `dispensing-fee.ts:z3000Code():L111` + `addWage():L255` | ⚠ 부분 | Z3000 심야 신체계(20231101) 분기 없음 (`Z3000040` 미포팅) |
| `DispensingFeeCalculator.cs:CalcPresInternal():L983` | `dispensing-fee.ts:z4InternalCode():L124` + `L276-L306` | ⚠ 부분 | insuDose/actualDose 분리(급여/비급여 차액 행) 미포팅 |
| `DispensingFeeCalculator.cs:CalcDirectInternal():L1078` | `direct-dispensing.ts:calcDirectDosageFee():L239` | ✓ 동일 | Z4200 × 일수 핵심 로직 일치 |
| `DispensingFeeCalculator.cs:CalcExternalDrug():L1393` | `dispensing-fee.ts:z4ExternalCode():L149`, `z4BothCode():L156` | ✓ 동일 | Z4120/Z4121/Z4220/Z4221 코드 결정 정확 |
| `DispensingFeeCalculator.cs:CalcSelfInjection():L1440` | — | ✗ 미포팅 | Z4130 자가주사 조제료 전혀 없음 |
| `DispensingFeeCalculator.cs:CalcDrugMgm():L1555` | `dispensing-fee.ts:z5000Code():L163` + `addWage():L318` | ✗ 중요 오류 | Z5000 단일 행만 산정. Z5xxx 일수별 가산 행 미포팅. Z5001·Z5011 마약/병팩 분기 없음 |
| `DispensingFeeCalculator.cs:CalcMoonMgm():L1627` | `counseling.ts:calcCounselingFee():L127` | ✓ 동일 | 달빛어린이(MoonYN=1)+18세이하 조건 일치 |
| `DispensingFeeCalculator.cs:CalcDrugSafe():L1655` | `counseling.ts:getNonFaceDispensingCode():L201` | ⚠ 부분 | ZH001~ZH004 미포팅; ZC 시행일(20230601) 분기 미처리 |
| `DispensingFeeCalculator.cs:CalcHolidaySurcharge():L1714` | `seasonal.ts:calcSeasonalSurcharge()` | ✓ 동일 | ZE 연도별 날짜·코드 매핑 일치 확인 |

### 1-2. 포팅 정확도 종합 평가

직접조제 경로(`calcDirectDispensing`)는 C# `CalcDirectInternal`/`CalcExternalDrug`의 핵심 로직(Z4200 × 일수, Z4220 × 1)을 충실히 포팅하였다. 그러나 처방조제 경로(`calcDispensingFee`)에는 다음 세 가지 구조적 결함이 있다.

1. **Z5xxx 의약품관리료**: C#은 `CalcDrugMgm()`에서 기본료(Z5000/Z5001/Z5011)와 일수별 가산(Z5xxx)을 2단계로 산정하나, TS는 `addWage('Z5000', 1)` 단일 행만 산정한다. 직접조제 경로에는 `z5DosageCode()`가 구현되어 있어 처방조제와 불일치가 발생한다.
2. **insuDose vs actualDose 분리**: C#은 `TryCalcPresInternalSeparated()`에서 급여 투약일수(insuDose)와 실제 투약일수(actualDose) 차이를 `insuPay="0"` 별도 행으로 처리하나, TS는 이 분리 없이 단일 행만 산정한다.
3. **소아심야 신/구체계 날짜 분기(20231101)**: C#은 `BuildBaseJojeCode()` L109, `BuildDrugGuideCode()` L137에서 `20231101` 기준으로 Z2000 소아심야(`Z2000640`/`Z2000620`) 및 Z3000 심야(`Z3000040`/`Z3000020`)를 분기하나, TS는 `z2000Code()`·`z3000Code()`에 해당 분기가 없다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB(우리 C# 원본) | 우리 TS 구현이 따르는 소스 | 비고 |
|---|---|---|---|---|---|---|
| Z1000 단가 조회 | PZCVALUE DB 직접 조회 | 외부 마스터 전제 | 기준금액×점수 계산 | MediWageM 딕셔너리 조회 | **EDB 방식**: `repo.getSugaFeeMap()` Map 조회 | 4소스 중 EDB 구조에 가장 근접 |
| Z2000 코드 결정 | `Holiday_gb` 직접 코드 | 코드 목록 명세만 | `Get조제료Item(CodeTypes)` | `BuildBaseJojeCode()` 분기 | **EDB 방식** (holidayGb → 코드 분기) | 소아심야 신체계(20231101) 분기 누락 |
| Z3000 심야 코드 | 단일 코드 | Z3000020(~2023.10)/Z3000040(2023.11~) | 유사 분기 | `BuildDrugGuideCode()` L136 날짜 분기 | 미구현: 날짜 무관 Z3000 또는 Z3000010 | **[Suspicious]** 심야 신체계 분기 없음 |
| 토요 가산 | **미구현** | 2016.09.29 이후 별도 행 | 구현됨 | 별도 행 분리 | **유팜/EDB 방식**: `saturday-split.ts` | 비즈팜은 토요 가산 없음 — 우리 구현이 올바름 |
| Z4xxx 처방조제 코드 | 25구간 직접 결정 | 25구간 코드 명세 | `Get조제료Item()` | `GetInJojeSugaCD()` L670 | **EDB 방식** (1~15일: Z41xx, 16일~: Z43xx) | ✓ 일치 |
| Z4200 직접조제 | 직접조제 별도 경로 | Z4200 × 일수 | Z4200 단가×일수 | `CalcDirectInternal()` L1078 | **EDB 방식** | ✓ 일치 |
| Z4121 토요 코드 | `Z4121030` (비즈팜 정상 코드 확인 필요) | 명세 없음 | 불명확 | `BuildExternalCode()` → `Z4121` + `"030"` | TS: `z4BothCode()` L159 `Z4121030` 반환 | 3-1절 참조 (버그 회피 확인) |
| Z5xxx 일수별 가산 | 일수별 Z5코드 존재 | Z5010~Z5391 구간 명세 | 구현됨 | `CalcDrugMgm()` 2단계 | **미구현**: `addWage('Z5000', 1)` 단일 | **[Critical]** 처방조제 Z5xxx 누락 |
| 단가 소스 결정 | DB 직접 조회(3단계 폴백) | 외부 마스터 전제 | 기준금액×점수 | 외부 주입+딕셔너리 | **EDB 방식**: Supabase `suga_fee` 테이블 | `getSugaFeeMap(year)` DB 조회 |

### 4소스 불일치 항목 요약

- `Z3000 심야 코드 (20231101 분기)`: EDB/공단은 날짜 기준 코드 분기(Z3000020→Z3000040) — TS는 분기 없이 야간(Z3000010) 또는 기본(Z3000) 사용. 2023.11.01 이후 심야 조제 건에서 단가 오류 발생
- `Z5xxx 일수별 가산`: 비즈팜/유팜/EDB/공단 모두 기본료+일수별 2단계인데, TS 처방조제 경로만 단일 행 — 직접조제 경로와 처방조제 경로의 불일치이며, 매 건마다 Z5xxx 가산분 누락
- `토요 가산`: 비즈팜 미구현 vs 유팜/EDB/공단 구현 — 우리는 EDB/유팜 방식(`saturday-split.ts`) 채택, 적절한 판단

---

## 3. 의심 항목 (Suspicious)

- [🔴 Suspicious / Critical] **처방조제 Z5xxx 일수별 가산 누락**: `dispensing-fee.ts:calcDispensingFee():L318`에서 `addWage(z5000Code(sc), 1)` 단일 행만 산정. C# `DispensingFeeCalculator.cs:CalcDrugMgm():L1600`은 `GetMedMgmtSugaCD(managementDose)` 결과를 별도 행으로 추가. 동일 건에서 직접조제는 두 행(Z5000 + Z5xxx), 처방조제는 한 행(Z5000만) 산정되어 수가 불일치 발생
- [🔴 Suspicious / Critical] **Z3000 심야 신체계 코드 미분기**: `dispensing-fee.ts:z3000Code():L111`은 `holidayGb`가 `'1'`이나 `'8'`이면 `Z3000010`(야간)을 반환하고, 심야(`holidayGb` 별도 값 없음) 처리가 없다. C# `BuildDrugGuideCode():L136`은 `sc.IsMidNight` 여부와 `dosDate >= "20231101"` 를 동시에 검사하여 `Z3000040`(2023.11~) 또는 `Z3000020`(~2023.10)을 반환. TS는 심야 가산 금액이 야간 단가(Z3000010, 1,410원)로 고착되어 2023.11 이후 신체계 단가(Z3000040, 3,260원)와 1,850원 차이 발생
- [🟠 Suspicious / High] **Z2000 소아심야 신체계 코드 미분기**: `dispensing-fee.ts:z2000Code():L98`에서 `holidayGb='8'`(소아+야간)을 `Z2000610`으로만 처리. C# `BuildBaseJojeCode():L109`는 `sc.IsMidNight && sc.IsChild`를 별도 분기하여 `dosDate >= "20231101"`이면 `Z2000640`(5,510원), 이전이면 `Z2000620`(3,300원)을 반환. 소아심야의 경우 TS는 Z2000610(2,760원)만 산정되어 Z2000640 대비 2,750원 차이
- [🟠 Suspicious / High] **급여/비급여 투약일수 차이(차액) 행 미포팅**: C# `TryCalcPresInternalSeparated():L1200`은 `actualDosage > insuredDosage`이면 차액분을 `insuPay="0"`(비급여) 별도 행으로 산정. TS는 항상 단일 행으로 산정하여 투약일수가 급여일수 초과 건에서 비급여 차액분 누락
- [🟠 Suspicious / High] **Z1000 차등수가(Z1000001) 분기 미구현**: C# `BuildStoreManageCode():L96`은 suffix.Text2가 "1"/"2"이고 Text3="1"이면 `Z1000001`을 반환. TS `z1000Code()`는 항상 `'Z1000'`만 반환. 차등수가 제외 대상 약국에서 `Z1000001`이 산정되어야 하는 케이스 누락
- [🟡 Suspicious / Medium] **AddRat(할증률) 미포팅**: C# `CalcPharmMgm():L743`, `CalcBaseJoje():L797`, `CalcPresInternal():L1057` 등에서 `options.AddRat > 0`이면 `price += price * AddRat/100`을 적용. TS `addWage()`는 단순 `getPrice(code)` 사용하며 할증 계산이 없음. 자동차보험 등 할증률 적용 보험 건에서 조제료 금액 차이

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🔴 Critical] `z3000Code()`: `20231101` 이전/이후 심야 코드(Z3000020/Z3000040) 분기 없음 — `DispensingFeeCalculator.cs:BuildDrugGuideCode():L136` 참조. 2023.11.01 이후 심야 조제에서 3,260원 대신 1,410원 산정
- [🔴 Critical] `z2000Code()`: `20231101` 이전/이후 소아심야 코드(Z2000620/Z2000640) 분기 없음 — `DispensingFeeCalculator.cs:BuildBaseJojeCode():L109` 참조
- [🟠 High] `z2000Code()` / 전체 조제료 파이프라인: `chkDate`(20000901) 분기 없음 — CH03 §3-2 공단 명세에 명시. 2000.09.01 이전 처방에서 코드 결정 오류 가능 (실사용 빈도 낮음)
- [🟡 Medium] `isDirectDispensingMode()` `direct-dispensing.ts:L199`: `options.isDirectDispensing` 필드가 없을 경우 `insuCode === 'C21'`로 폴백. C21 외에도 직접조제 해당 보험코드가 존재할 수 있어 미판정 위험

### 4-2. 보험 코드 분기

- [🟠 High] 보훈 감면(M30/M50/M60/M90) 보험코드에서 기본조제료(Z1000/Z2000/Z3000) 0원 처리 없음 — C# `ApplyBohunWageReduction():L~` 분기. `calcDispensingFee()`는 `insuCode` 참조 자체가 없음
- [🟠 High] 주사제 전용 처방 분기 — TS `isInjectionOnly` 판정 후 자가주사 여부(`isSelfInjection`) 미확인. C# `DispensingFeeCalculator.cs:L224`는 `isSelfInj` 여부로 Z5000 단독 vs Z4130 분기. TS는 항상 Z5000만 산정

### 4-3. 특수 케이스 분기

- [🟠 High] Z5001(마약 포함) 처방조제 경로 치환 없음 — `dispensing-fee.ts:L318`은 `z5000Code(sc)`가 항상 `'Z5000'`을 반환하여 마약·향정 약품 포함 처방에서도 Z5000 산정
- [🟠 High] Z5011(병팩 전용) 분기 없음 — `classifyDrugs()`에 `allPack` 플래그가 없어 전 품목 팩단위 처방에서 Z5011 미산정. 직접조제 경로에는 `drugs.allPack` 필드가 있으나 처방조제 경로에는 없음
- [🟡 Medium] ZC 비대면 시행일(20230601) 분기 없음 — `counseling.ts:getNonFaceDispensingCode():L204`의 `_dosDate` 미사용(TODO 주석 존재). 2023.06.01 이전 처방에서 ZC 코드 오산정 가능
- [🟡 Medium] 직접조제 일일2회내방 시 Z1000/Z2000 0원 처리 없음 — `direct-dispensing.ts:_calcDirectDispensingImpl():L433`에 `isDoubleVisit` 플래그 없음

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- [🟠 High] `addWage(code, cnt)` 함수 `dispensing-fee.ts:L211`: `sum = price * cnt`에서 `price`와 `cnt` 모두 JS `number`(IEEE 754 double). C# 원본은 `decimal` 타입 사용. 단가가 정수원 단위라면 실질 오차 없으나, 할증률(`AddRat`) 계산 등 소수점 연산이 추가되면 오차 발생 가능
- [🟡 Medium] `direct-dispensing.ts:calcDirectDosageFee():L249`: `sum = price * drugs.maxInternalDay`. C# `CalcDirectInternal():L1110`은 `decimal`로 계산 후 `RoundToInt()` 적용. TS는 `Math.floor` 없이 바로 곱셈하여 일수가 소수이면 미세 오차 가능 (실사용에서는 정수 보장 필요)

### 5-2. Null 안전성

- [🟡 Medium] `dispensing-fee.ts:calcDispensingFee():L201`: `await repo.getSugaFeeMap(year)` 반환이 빈 Map일 때 `getPrice()` 함수가 `0`을 반환하고 `addWage()`가 `if (price === 0) return`으로 조용히 스킵. C# `DispensingFeeCalculator.cs:L183`는 `wageData.Count == 0` 시 조기 반환하고 명시적 로그를 남김. TS에는 수가 데이터 로드 실패 시 경고 없이 빈 wageList 반환
- [🟡 Medium] `dispensing-fee.ts:z4InternalCode():L133`: `days > 15`일 때 `baseCode = 'Z4116'`으로 임시 하드코딩 후 `needsTableLookup = true` 반환. 이후 `repo.getPrescDosageFee()` 실패 시 해당 내복조제료가 누락됨 (오류 없이 조용히 스킵)

### 5-3. 경계 조건

- [🟡 Medium] `classifyDrugs():L75`: `ctx.maxInternalDay = Math.floor(drug.dDay)`. C# `ClassifyDrugs():L~`는 `RoundToInt(drug.DDay)`로 반올림하나, TS는 내림(floor) 처리. 0.5일 처방에서 C# = 1일, TS = 0일 불일치
- [🟡 Medium] `z4InternalCode():L128`: `days <= 15`에서 `padStart(2,'0')`. `days=0`이면 `'Z4100'` 반환 — C# `GetInJojeSugaCD():L670`은 `days < 1`이면 `null` 반환. TS에서 0일 처방 입력 시 Z4100(포장단위 코드)가 의도치 않게 선택될 수 있음

---

## 6. 기타 관찰 사항

### 6-1. Z4121 Holiday_gb 버그 회피 확인 — 정상 패턴 채택

CH03 §7-1에서 지적된 비즈팜 Z4121 매핑 버그(`("1","7")`=010, `("5","8")`=050)에 대해, `dispensing-fee.ts:z4BothCode():L157-L158`은 다른 Z코드와 동일한 정상 패턴(`"1","8"` → 야간, `"5","7"` → 공휴)을 채택하고 있다. **버그 회피 확인됨.** 비즈팜 호환이 필요한 경우 별도 플래그 처리 필요.

### 6-2. 토요 가산 — 비즈팜 미구현 항목 우리 구현 여부

비즈팜 VB6에는 토요 가산 로직이 전혀 없으나(CH03 §7-2), 우리 TS 구현은 `saturday-split.ts:applySaturdaySurchargeRows()`를 통해 Z2000030/Z3000030/Z41xx030 별도 행을 산정한다. 유팜/EDB 방식을 따르는 올바른 구현이다. 단, `dispensing-fee.ts:L334`에서 토요 가산 호출 시 `applySaturdaySurchargeRows(wageList, opt.dosDate, true)` 인자 구조를 별도 검증 권장.

### 6-3. 부록 D 점수표와 우리 단가 일치 여부

CH03 부록 D는 "기준금액 90.4원/점"을 사용한 예시를 제시하나, `SugaFeeTable.cs`의 2024년 주석은 **82.17원/점**으로 명시되어 있어 두 값이 다르다. 부록 D의 90.4원/점은 구(舊) 기준금액(2010년대 중반 수준)으로, 교재 예시용 수치로 추정된다. 우리 TS 구현은 `repo.getSugaFeeMap(year)`로 Supabase `suga_fee` 테이블에서 단가를 조회하는 DB 방식을 사용하므로, 점수표 수치와 직접 비교할 필요는 없다. 그러나 Supabase `suga_fee` 테이블의 실제 적재 단가가 `SugaFeeTable.cs`의 값과 일치하는지 검증이 필요하다.

**교차 확인 샘플 (2024년 기준)**:

| Z코드 | SugaFeeTable.cs 2024 | 부록 D 예시(90.4 × 점수) | 비고 |
|---|---|---|---|
| Z1000 | 740원 | 2,302원(25.47점) | 완전 불일치 — 기준금액 차이 |
| Z2000 | 1,610원 | 1,703원(18.84점) | 불일치 |
| Z3000 | 1,090원 | 1,135원(12.56점) | 불일치 |
| Z4101(1일) | 1,710원 | — | SugaFeeTable 기준 확인 필요 |
| Z4121 | 600원 | — | 2024 정상 단가 |
| Z5000 | 640원 | — | 2024 정상 단가 |

결론: 부록 D 점수표는 참고용 교육 자료이며 실제 단가 산출 근거가 아님. **우리 구현은 SugaFeeTable.cs 2024 기준 단가를 따르며 적절하다.** Supabase 테이블 적재값과의 일치 여부는 별도 DB 검증 단계에서 확인 필요.

### 6-4. 4소스 단가 조회 방식 비교 결론

| 소스 | 방식 | 우리 구현과의 관계 |
|---|---|---|
| 비즈팜 | PZCVALUE 테이블 DB 직접 조회 | 유사(DB 조회)하나 테이블명/구조 다름 |
| 유팜 | 기준금액 × 점수 동적 계산 | **미채택** — 부록 D 90.4원 방식 |
| EDB | MediWageM 딕셔너리 조회 (탭구분 문자열) | **가장 근접** — 우리는 Map 객체로 구현 |
| 공단 | 외부 마스터 전제 | 우리 Supabase 방식과 개념 일치 |

우리 TS는 EDB 방식(외부에서 사전 결정된 단가를 딕셔너리/Map으로 주입)과 일치하며, 이는 4소스 중 가장 클린한 아키텍처이다.

### 6-5. 즉시 수정 필요 Critical 항목 목록

1. **처방조제 Z5xxx 일수별 가산 행 추가** — `dispensing-fee.ts` 처방조제 경로에 `z5DosageCode()` 패턴 적용 (`direct-dispensing.ts:z5DosageCode():L171` 참조)
2. **Z3000 심야 신체계 분기 추가** — `z3000Code()`에 `isMidNight` 및 `dosDate >= '20231101'` 분기 추가 (`DispensingFeeCalculator.cs:BuildDrugGuideCode():L136` 참조)
3. **Z2000 소아심야 신체계 분기 추가** — `z2000Code()`에 `holidayGb='8'` 처리를 `isMidNight && isChild` + 날짜 분기로 정교화 (`DispensingFeeCalculator.cs:BuildBaseJojeCode():L109` 참조)
