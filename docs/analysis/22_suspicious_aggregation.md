# Phase 3 의심(Suspicious) 항목 종합 보고서

> 작성자: 부담당 2 — 의심 항목 취합 담당 (Phase 3 Sub-agent 2)
> 작성일: 2026-04-07
> 역할: CH01~CH12 총 24개 Phase 2 보고서에서 "의심(Suspicious)" 항목만 추출·정리
> 출력 파일: `docs/analysis/22_suspicious_aggregation.md`

---

## 개요

본 보고서는 PharmaEdu TypeScript 계산 엔진(YakjaebiCalc 포팅본)에 대한 Phase 2 분석 결과(24개 보고서, CH01~CH12 각 _analyst.md + _verifier.md)에서 **"의심가는 점(Suspicious)"** 카테고리에 속하는 항목만 선별하여 취합한 것이다.

의심 항목의 정의: 코드가 존재하나 원본(C#/VB6/PDF)과 동작이 달라 **특정 케이스에서 오산출이 발생할 수 있는** 잠재 버그. "Missing(누락)"과 달리 기능이 있으나 잘못 구현된 경우이다.

> 주의: `_analyst.md` 파일에는 일반적으로 Suspicious 섹션이 없고, `_verifier.md` 파일에 "3. 의심 항목" 또는 "## 16. 기타 관찰 사항" 등에 Suspicious가 포함된다. 일부 `_analyst.md`의 Insufficient 항목 중 의심 성격의 것도 포함하였다.

---

## 챕터별 의심 항목 목록

---

### CH01 — 약품금액 계산

> 출처: `ch01_verifier.md`

#### S-01-01 [Critical] 비급여 코로나19 치료제 50,000원 처리 누락

- **항목명**: 코로나19 비급여 50,000원 비급여약품 분류 누락
- **파일 위치**: `src/lib/calc-engine/modules/special/drug-648.ts` (전체 모듈) vs `Engine/DispensingFeeCalculator.cs:ClassifyDrugs():L339-L346`
- **출처 챕터**: CH01
- **심각도**: Critical
- **잘못될 수 있는 케이스**: `insuPay`가 `nonCovered`이고 약품코드가 `648903860`인 비급여 코로나19 치료제 처방. TS 구현은 해당 케이스에서 비급여 50,000원 약품을 일반 비급여처럼 처리하고, C#이 수행하는 "비급여 코로나19 치료제 급여 강제 전환 + 50,000원 고정" 로직을 수행하지 않음.
- **원본과의 차이**: C# `ClassifyDrugs()`는 EXTYPE="1" 필터 후 `insuPay`=비급여이고 코드=648903860이면 50,000원 고정 단가로 강제 설정. TS는 이 분기 자체가 없음.

---

#### S-01-02 [Critical] EXTYPE "1" 필터 미포팅

- **항목명**: 제외유형(EXTYPE) "1" 약품 skip 로직 누락
- **파일 위치**: `Engine/DispensingFeeCalculator.cs:L334` (C#) vs `DrugItem` 타입 (`src/lib/calc-engine/types.ts:DrugItem`) — `exType` 필드 없음
- **출처 챕터**: CH01
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 처방 목록에 EXTYPE="1" 약품(제외 대상)이 포함된 경우. TS는 해당 약품을 정상 처방처럼 계산에 포함하여 약품금액 과산출.
- **원본과의 차이**: C# `L334`에서 `drug.ExType == "1"`이면 skip. TS `DrugItem`에 `exType` 필드 자체가 없어 필터 불가.

---

#### S-01-03 [Critical] EXTYPE "9" 날짜 분기 누락 (2020.03.01)

- **항목명**: EXTYPE "9" 차감 로직 날짜 조건 미구현
- **파일 위치**: `src/lib/calc-engine/drug-amount.ts` 전체
- **출처 챕터**: CH01
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 2020.03.01 이전 처방에 EXTYPE="9" 약품이 있는 경우. C#은 날짜 분기로 2020.03.01 이전에는 선별급여 차감을 다르게 처리하나, TS는 날짜 무관하게 동일 로직 적용.
- **원본과의 차이**: C# `DispensingFeeCalculator.cs`에 2020.03.01 기준 EXTYPE="9" 분기 존재. TS에 해당 날짜 조건 없음.

---

#### S-01-04 [Critical] InsuPayType.FullSelf U항 302 세부 분류 없음

- **항목명**: FullSelf(U항) 내 302 대상 구분 미구현
- **파일 위치**: `src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum()`
- **출처 챕터**: CH01
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 302(100% 본인부담 정책대상)에 해당하는 U항 약품이 처방된 경우. TS는 모든 FullSelf를 단순 합산하여 `sumInsuDrug100`에 넣지만, 302 대상 분리(SumInsuDrug100_302) 없이 합산하여 3자배분 및 specialPub 처리 불가.
- **원본과의 차이**: C# `CalcResult.SumInsuDrug100_302` 별도 필드 존재. TS에 대응 필드 및 분리 로직 없음.

---

#### S-01-05 [Medium] 음수 팩(-pack) 처리 상이

- **항목명**: 음수 pack 값에 대한 약품금액 계산 차이
- **파일 위치**: `src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L18` vs `Engine/Models/DrugItem.cs:RecalcSum():L24`
- **출처 챕터**: CH01
- **심각도**: Medium
- **잘못될 수 있는 케이스**: `pack` 필드가 음수인 비정상 처방 데이터. TS는 `pack < 0`을 그대로 곱하여 음수 금액 산출, C#은 `RecalcSum()`에서 음수 팩에 대한 보호 처리.
- **원본과의 차이**: C# `RecalcSum():L24`에서 pack 음수 보호 로직 존재. TS `calcDrugAmount():L18`에서 보호 없이 그대로 계산.

---

### CH02 — 조제료 코드 체계

> 출처: `ch02_verifier.md`

#### S-02-01 [Critical] 산제 신체계 16일+ 베이스코드 Z4116 하드코딩 오류

- **항목명**: 산제(가루약) 16일 이상 조제료 베이스코드 Z4116 → 실제 코드 Z4316 불일치
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:calcDispensingFee():L266-268`
- **출처 챕터**: CH02
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 2023.11.01 이후(신체계) 산제(가루약)가 포함된 16일 이상 처방. Z4116은 seed.sql에 존재하지 않는 코드이므로 수가 조회 실패 → 조제료 0원 산출.
- **원본과의 차이**: 실제 DB(`seed.sql`)에는 Z4316이 등록되어 있음. TS 코드는 Z4116을 하드코딩하여 DB 조회 실패.

---

#### S-02-02 [Critical] text3 차등수가 접미사 전무

- **항목명**: 모든 Z코드 생성 함수에서 차등수가 접미사(text3) 미적용
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts` 내 모든 z코드 생성 함수 vs `Engine/DispensingFeeCalculator.cs:BuildTimedCode():L73-78`
- **출처 챕터**: CH02
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 차등수가 적용 약국(1일 평균 조제 횟수 기준)의 처방. TS는 차등수가 접미사를 전혀 추가하지 않아 일반 수가로만 청구. 차등수가 적용 약국에서 수가 산정 오류.
- **원본과의 차이**: C# `BuildTimedCode():L73-78`에서 `GradeSatIn` 기반 접미사를 추가. TS 구현 없음.

---

#### S-02-03 [Critical] 소아심야(Z2000640) ↔ 소아야간(Z2000610) 오분류

- **항목명**: 소아 심야 가산 시 Z2000640(소아심야) 대신 Z2000610(소아야간) 잘못 배정
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:z2000Code():L104` vs `Engine/DispensingFeeCalculator.cs:BuildBaseJojeCode():L108-109`
- **출처 챕터**: CH02
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 6세 미만 소아가 심야(자정 전후)에 조제받는 케이스. TS는 소아심야를 소아야간 코드(Z2000610)로 처리하여 수가 차이 발생.
- **원본과의 차이**: C# `BuildBaseJojeCode():L108-109`는 소아심야 시 Z2000640 반환. TS `z2000Code():L104`는 Z2000610 반환.

---

#### S-02-04 [High] Z3000 소아야간 코드 불일치

- **항목명**: Z3000 복약지도료 소아야간 코드 오류
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:z3000Code():L112`
- **출처 챕터**: CH02
- **심각도**: High
- **잘못될 수 있는 케이스**: 6세 미만 소아의 야간 처방. Z3000 복약지도료에 소아야간 접미사가 잘못 적용되어 수가 불일치.
- **원본과의 차이**: C# 기준 Z3000 소아야간 코드와 TS `z3000Code():L112` 반환값이 다름.

---

#### S-02-05 [High] Z3000 심야 코드(Z3000020/Z3000040) 미생성

- **항목명**: Z3000 복약지도료 성인 심야 코드 미산정
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:z3000Code()` 전체
- **출처 챕터**: CH02
- **심각도**: High
- **잘못될 수 있는 케이스**: 성인의 심야 조제 처방. TS는 성인 심야 시 `holidayGb='0'`으로 처리하여 Z3000020(심야 구체계) 또는 Z3000040(심야 신체계) 코드가 생성되지 않음.
- **원본과의 차이**: C# 기준 성인 심야 → Z3000020 또는 Z3000040 분기. TS는 0 처리.

---

### CH03 — 조제료 수가 계산

> 출처: `ch03_verifier.md`

#### S-03-01 [Critical] 처방조제 Z5xxx 일수별 가산 누락

- **항목명**: Z5xxx(의약품관리료) 일수별 가산 행 미추가
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:calcDispensingFee():L318`
- **출처 챕터**: CH03
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 처방조제(비직접조제) 처방 전반. C#은 `GetMedMgmtSugaCD()`를 호출하여 투약일수 구간별 Z5xxx 행을 별도 추가하나, TS는 이 가산 행이 없어 의약품관리료 수가 누락.
- **원본과의 차이**: C# `DispensingFeeCalculator.cs:GetMedMgmtSugaCD()` 별도 함수로 Z5xxx 행 생성. TS `calcDispensingFee():L318`에서 해당 호출 없음.

---

#### S-03-02 [Critical] Z3000 심야 신체계 코드 미분기

- **항목명**: Z3000 복약지도료 2023.11.01 전후 심야 코드 분기 없음
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:z3000Code():L111`
- **출처 챕터**: CH03
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 2023.11.01 전후의 심야 조제 처방. Z3000020(구체계 1,850원)과 Z3000040(신체계) 간 1,850원 차이 발생.
- **원본과의 차이**: C#은 2023.11.01 기준 Z3000 심야 코드를 분기. TS는 날짜 분기 없이 단일 코드 반환.

---

#### S-03-03 [High] Z2000 소아심야 신체계 코드 미분기

- **항목명**: Z2000 조제기본료 소아심야 2023.11.01 전후 분기 누락
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:z2000Code()`
- **출처 챕터**: CH03
- **심각도**: High
- **잘못될 수 있는 케이스**: 2023.11.01 이후 6세 미만 소아의 심야 처방. Z2000640(5,510원, 신체계)과 Z2000610(2,760원) 간 2,750원 차이 발생.
- **원본과의 차이**: C#은 날짜 기준 코드 분기. TS는 단일 코드 반환.

---

#### S-03-04 [High] Z1000 차등수가(Z1000001) 분기 미구현

- **항목명**: Z1000 약국관리료 차등수가 분기 없음
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:z1000Code()`
- **출처 챕터**: CH03
- **심각도**: High
- **잘못될 수 있는 케이스**: 차등수가 적용 약국(GradeSatIn 플래그 있음)의 모든 처방. TS `z1000Code()`는 항상 Z1000만 반환하고 Z1000001(차등 적용 코드)을 반환하지 않음.
- **원본과의 차이**: C#에서 `GradeSatIn` 기반으로 Z1000001 분기. TS에 해당 분기 없음.

---

#### S-03-05 [Medium] AddRat(할증률) 미포팅

- **항목명**: 자동차보험 조제료 할증률 적용 누락
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts` 전체
- **출처 챕터**: CH03
- **심각도**: Medium
- **잘못될 수 있는 케이스**: 자동차보험(F 계열) 처방에서 AddRat(할증률) 적용이 필요한 경우. TS는 자동차보험 조제료에 할증률을 곱하지 않아 금액 과소 산출.
- **원본과의 차이**: C#은 `AddRat` 필드로 할증 적용. TS `CalcOptions.addRat`은 선언되어 있으나 조제료 계산에 반영되지 않음.

---

### CH04 — 가산 로직

> 출처: `ch04_verifier.md`

#### S-04-01 [Critical] 6세 이상 성인 심야→야간 다운그레이드 누락

- **항목명**: 성인 환자 심야 입력 시 야간으로 다운그레이드하는 로직 없음
- **파일 위치**: `src/lib/calc-engine/surcharge.ts:L151-L162` vs `Engine/DispensingFeeCalculator.cs:DetermineSurcharge():L529-L542`
- **출처 챕터**: CH04
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 6세 이상(성인) 환자에게 `isMidNight=true`로 입력된 처방. C#은 6세 이상이면 심야를 야간으로 다운그레이드하나, TS는 이 분기가 없어 성인 심야 처방에서 **가산이 전혀 미적용** (심야 코드도 없고 야간 코드도 없음).
- **원본과의 차이**: C# `DetermineSurcharge():L529-L542`에서 6세 이상+심야 → 야간 전환. TS `surcharge.ts:L151-L162`에 해당 분기 없음.

---

#### S-04-02 [Critical] 차등수가 text3 미구현

- **항목명**: 가산 접미사 생성 함수에서 차등수가(text3) 완전 미구현
- **파일 위치**: `src/lib/calc-engine/surcharge.ts:getSurchargeSuffix()` vs `Engine/DispensingFeeCalculator.cs:BuildSuffix():L570-L641`
- **출처 챕터**: CH04
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 차등수가 대상 약국에서의 모든 처방. `getSurchargeSuffix()`가 차등수가 접미사를 반환하지 않아 수가 코드가 일반 코드로 생성됨.
- **원본과의 차이**: C# `BuildSuffix():L570-L641`에서 `GradeSatIn`/`text3` 기반 차등 접미사 생성. TS `getSurchargeSuffix()`에 text3 로직 없음.

---

#### S-04-03 [High] 가루약 isPowder 판정 책임 분리 문제

- **항목명**: 가루약 판정(isPowder) 날짜 분기 책임이 호출자에게 있어 잘못 호출 시 오동작
- **파일 위치**: `src/lib/calc-engine/surcharge.ts` — `isPowder` 플래그 처리 로직
- **출처 챕터**: CH04
- **심각도**: High
- **잘못될 수 있는 케이스**: 호출자가 2023.11.01 이전 처방에도 `isPowder=true`를 전달한 경우. TS 내부에 날짜 분기가 없어 신체계 가루약 우선순위가 구체계 날짜에도 발동.
- **원본과의 차이**: C#은 날짜 분기 후 isPowder 판정. TS는 호출자가 날짜 분기를 담당하므로 내부 방어 없음.

---

#### S-04-04 [Medium] 2023.12.15 가산 코드값 변경 반영 여부 불명

- **항목명**: 2023.12.15 가산 수가 개정 코드 반영 상태 불명확
- **파일 위치**: `src/lib/calc-engine/surcharge.ts` + `seed.sql`
- **출처 챕터**: CH04
- **심각도**: Medium
- **잘못될 수 있는 케이스**: 2023.12.15 이후 처방에서 변경된 수가를 적용해야 하는 경우. 변경 내용이 seed.sql에 반영되었는지 확인 불가.
- **원본과의 차이**: C# DateThresholds.cs에 2023.12.15 기준 코드값 변경 분기 있음. TS seed.sql 반영 여부 미확인.

---

### CH05 — 본인부담금

> 출처: `ch05_verifier.md`

#### S-05-01 [Critical] G타입 M61 역산 공식 오적용

- **항목명**: 보훈 G타입 M61(61% 감면)에 C타입 공식을 잘못 이식
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts:L314-324`
- **출처 챕터**: CH05
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 보훈(G타입) 보험에 감면코드 M61인 모든 처방. C# 기준 G타입 M61은 일반 감면 60% + Trunc10 적용이어야 하나, TS는 C타입 역산 공식을 그대로 사용하여 본인부담금 오산출.
- **원본과의 차이**: C# G타입 M61 = 감면률 60%, Trunc10. TS `veteran.ts:L314-324`는 C타입 공식 적용.

---

#### S-05-02 [Critical] 65세 이상 2구간 날짜 조건 누락

- **항목명**: 65세 이상 2구간(20% 요율) 날짜 조건(2018.01.01 이후) 미검사
- **파일 위치**: `src/lib/calc-engine/copayment.ts:L136`
- **출처 챕터**: CH05
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 2018.01.01 이전의 65세 이상 처방에 대해 소급 계산하는 경우. TS는 날짜 무관하게 20% 구간을 적용하여 구체계 구간과 다른 결과 산출.
- **원본과의 차이**: C# 기준 2018.01.01 이후에만 2구간(20%) 진입. TS `copayment.ts:L136`에 날짜 조건 없음.

---

#### S-05-03 [Critical] 65세 이상 3구간 분기 기준액 불일치

- **항목명**: 65세 이상 3구간 진입 기준액 비교 대상이 C#과 다름
- **파일 위치**: `src/lib/calc-engine/copayment.ts:L127`
- **출처 챕터**: CH05
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 보훈감면이 적용된 65세 이상 처방에서 3구간 경계 근방(totalPrice ~20,000원 전후). TS는 `totalPrice`로 3구간 기준 비교, C#은 `basisAmt`(보훈감면 후 금액)로 비교하여 경계 케이스에서 구간 오분류.
- **원본과의 차이**: C# `basisAmt` = 보훈감면 후 금액. TS `copayment.ts:L127`은 `totalPrice` 그대로 비교.

---

#### S-05-04 [High] D10 Mcode 기본값 1000원 (원본 500원)

- **항목명**: 의료급여 1종 Mcode(정액) 기본값이 원본 500원 대신 1000원
- **파일 위치**: `src/lib/calc-engine/modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount():L224`
- **출처 챕터**: CH05
- **심각도**: High
- **잘못될 수 있는 케이스**: sbrdnType 미설정 상태의 D10 의료급여 처방. TS는 Mcode 기본값 1,000원을 반환하나 원본은 500원.
- **원본과의 차이**: C# Mcode 기본값 = 500원. TS `L224` 기본값 = 1,000원.

---

#### S-05-05 [High] D10 Bcode 기본값 1500원 (원본 500원)

- **항목명**: 의료급여 1종 Bcode(정액 B형) 기본값이 원본 500원 대신 1500원
- **파일 위치**: `src/lib/calc-engine/modules/insurance/medical-aid.ts:L219`
- **출처 챕터**: CH05
- **심각도**: High
- **잘못될 수 있는 케이스**: sbrdnType이 'B'로 시작하는 D10 의료급여 처방에서 Bcode 기본값 사용 시. 500원 차이 발생.
- **원본과의 차이**: C# Bcode 기본값 = 500원. TS `L219` 기본값 = 1,500원.

---

#### S-05-06 [High] 65세 이상 분기에서 bohunRate 제외 조건 누락

- **항목명**: 65세 이상 정액 분기 진입 시 보훈 감면율 존재 여부 확인 누락
- **파일 위치**: `src/lib/calc-engine/copayment.ts:L125` vs C# `L419`
- **출처 챕터**: CH05
- **심각도**: High
- **잘못될 수 있는 케이스**: 보훈 감면율이 있는(bohunRate > 0) 65세 이상 처방. C#은 bohunRate 존재 시 65세 정액 분기를 우회하나, TS는 체크하지 않아 보훈 대상자가 65세 정액으로 오분류될 수 있음.
- **원본과의 차이**: C# `L419` 분기에 `&& bohunRate == 0` 조건 존재. TS `copayment.ts:L125`에 해당 조건 없음.

---

#### S-05-07 [High] 65세 이상 분기 산정특례 V252 임계값 불일치

- **항목명**: 산정특례 V252(50%) 대상자의 65세 정액 분기 진입 조건이 C#과 다름
- **파일 위치**: `src/lib/calc-engine/copayment.ts` 전체 V252 처리 흐름
- **출처 챕터**: CH05
- **심각도**: High
- **잘못될 수 있는 케이스**: V252 산정특례(50%)이면서 65세 이상인 환자. C#은 V252(50%) 있으면 65세 정액 분기 진입, TS는 50% 정률을 바로 적용하여 정액 vs 정률 판단이 달라짐.
- **원본과의 차이**: C#은 V252→65세 정액 진입 후 처리. TS는 V252 확인 후 50% 정률 즉시 적용.

---

#### S-05-08 [High] GetDoubleReductionRate 비M20/M61 반환값 불일치

- **항목명**: 이중감면율 함수의 비대상 케이스 반환값 의미 차이
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts` — getDoubleReductionRate 등가 로직
- **출처 챕터**: CH05
- **심각도**: High
- **잘못될 수 있는 케이스**: M20/M61 이외 보훈코드 처방에서 이중감면율 함수 반환값을 기반으로 분기하는 경우. C#은 -1(비대상 마커), TS는 0 반환으로 0%와 비대상을 구분 못 함.
- **원본과의 차이**: C# `GetDoubleReductionRate()` 비대상 시 -1 반환. TS 등가 함수 0 반환.

---

### CH06 — 3자배분

> 출처: `ch06_verifier.md`

#### S-06-01 [Critical] 특수공비 302 SumUser 처리 미포팅

- **항목명**: 302(특수공비) 대상 처방에서 환자 수납액 과다 산출
- **파일 위치**: `src/lib/calc-engine/modules/special/safety-net.ts`, `src/lib/calc-engine/modules/insurance/veteran.ts`, `src/lib/calc-engine/index.ts` — 모두 `specialPub` 미참조
- **출처 챕터**: CH06
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 302 대상 처방(100% 본인부담 정책약품 + 특수공비 지원). TS는 `specialPub` 값을 참조하지 않아 302 대상 환자의 수납액이 과다 산출.
- **원본과의 차이**: C# `CopaymentCalculator.cs`에 `specialPub` 기반 SumUser 차감 로직. TS 전 모듈에서 `specialPub` 미참조.

---

#### S-06-02 [Critical] MpvaComm 완전 누락

- **항목명**: 보훈 추가 청구액(MpvaComm) 계산 미구현
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts` — `mpvaComm` 필드 선언만 존재
- **출처 챕터**: CH06
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 보훈 처방 전반. `CalcResult.mpvaComm`은 필드만 선언되고 실제 산출 로직이 없어 항상 0 반환. C# `CalcMpvaComm():L1146`의 계산 결과와 다름.
- **원본과의 차이**: C# `CopaymentCalculator.cs:CalcMpvaComm():L1146`에서 산출. TS `veteran.ts`에서 `mpvaComm` 필드만 있고 할당 로직 없음.

---

#### S-06-03 [High] getDoubleReductionRate() 비대상 반환값 시맨틱 차이 (-1 vs 0)

- **항목명**: 이중감면율 비대상 반환값 의미 불일치 → 추후 로직 변경 위험
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts` — `getDoubleReductionRate()` 등가 함수
- **출처 챕터**: CH06
- **심각도**: High
- **잘못될 수 있는 케이스**: M61 분기 조건에서 비대상(반환값 0) 케이스와 M61(감면률 0%) 케이스를 구분해야 하는 상황. 추후 로직 확장 시 오동작 가능.
- **원본과의 차이**: C# -1(비대상), TS 0(비대상). 두 경우 다른 분기 처리 필요.

---

#### S-06-04 [High] 본인부담상한제 상한액 2024 고정

- **항목명**: 연간 소득분위별 본인부담상한액이 2024년 기준으로 하드코딩
- **파일 위치**: `src/lib/calc-engine/modules/special/safety-net.ts:L40-51` — `ANNUAL_CAP_BY_DECILE`
- **출처 챕터**: CH06
- **심각도**: High
- **잘못될 수 있는 케이스**: 2024년 외 연도(2023년 이전 또는 2025년 이후) 처방에 대한 상한제 계산. 상한액이 매년 변경되나 2024 고정값 사용.
- **원본과의 차이**: C#은 `GetConfigValue(year)` 방식으로 연도별 상한액 조회. TS는 연도 파라미터 없는 하드코딩 배열.

---

### CH07 — 반올림/절사

> 출처: `ch07_verifier.md`

#### S-07-01 [Medium] 보훈 일반 감면 본인부담 trunc10 vs trunc100 혼용

- **항목명**: 보훈 일반 감면 본인부담 계산에서 절사 함수 혼용 가능성
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts:L330-L339`
- **출처 챕터**: CH07
- **심각도**: Medium
- **잘못될 수 있는 케이스**: 보훈 일반 감면율 처방 전반. C# `RoundingHelper.cs` 주석과 실제 코드 간 불일치 가능성이 있으며, TS가 어느 쪽을 따랐는지 불명확.
- **원본과의 차이**: C# `RoundingHelper.cs` 주석 vs 실제 구현 불일치 가능성. TS `veteran.ts:L330-L339` 사용 함수 확인 필요.

---

#### S-07-02 [Medium] round10 경계값 JS 부동소수점 오차

- **항목명**: round10 함수의 x.5 경계값에서 JS 이진 표현 오차로 C# 결과와 다를 수 있음
- **파일 위치**: `src/lib/calc-engine/rounding.ts:round10():L41-L43`
- **출처 챕터**: CH07
- **심각도**: Medium
- **잘못될 수 있는 케이스**: 가산 금액 계산 결과가 n5(예: 155원, 265원 등 일의 자리 5인 경우). `v/10`이 x.5 형태일 때 JS IEEE 754 표현 오차로 Math.round가 C#의 AwayFromZero와 다른 방향으로 반올림.
- **원본과의 차이**: C# `Math.Round(v/10, MidpointRounding.AwayFromZero) * 10`와 JS `Math.round(v/10)*10`는 0.5 경계에서 다를 수 있음.

---

### CH08 — 특수 케이스 (명절가산, 달빛어린이 등)

> 출처: `ch08_verifier.md`

#### S-08-01 [Critical] ZE010 단가 5배 오류

- **항목명**: seed.sql에서 ZE010 명절 가산 단가가 5,000원으로 오등록 (정확한 값: 1,000원)
- **파일 위치**: `seed.sql:L291`
- **출처 챕터**: CH08
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 명절 연휴 기간 중 ZE010 코드가 적용되는 모든 처방. 수가가 5배 과산출.
- **원본과의 차이**: HIRA 기준 ZE010 = 1,000원. `seed.sql:L291`에서 5,000원으로 등록됨.

---

#### S-08-02 [Critical] ZE020 단가 오류

- **항목명**: seed.sql에서 ZE020 명절 가산 단가가 10,000원으로 오등록 (정확한 값: 3,000원)
- **파일 위치**: `seed.sql:L292`
- **출처 챕터**: CH08
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 명절 연휴 중 ZE020 적용 처방. 3배 이상 과산출.
- **원본과의 차이**: HIRA 기준 ZE020 = 3,000원. `seed.sql:L292`에서 10,000원 등록.

---

#### S-08-03 [Critical] ZE101/ZE102 seed.sql 누락

- **항목명**: 2025 추석 명절 가산 코드 ZE101/ZE102가 seed.sql에 없음
- **파일 위치**: `seed.sql` 전체 (ZE101/ZE102 미존재)
- **출처 챕터**: CH08
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 2025년 추석 연휴 처방. ZE101/ZE102 코드 조회 실패로 명절 가산 0원 산출.
- **원본과의 차이**: C# `DateThresholds.cs`에 Chuseok2025 코드 등록. TS `seed.sql`에 ZE101/ZE102 누락.

---

#### S-08-04 [Critical] 2025 설날 연휴 범위 누락

- **항목명**: 2025년 설날 연휴 HOLIDAY_TABLE 미등록
- **파일 위치**: `src/lib/calc-engine/modules/special/seasonal.ts:HOLIDAY_TABLE`
- **출처 챕터**: CH08
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 2025년 1월 25~27일, 2월 1~2일 처방. 명절 가산이 적용되어야 하나 미적용.
- **원본과의 차이**: C# `HolidayTable`에 해당 범위 등록. TS `HOLIDAY_TABLE`에 2025 설날 범위 누락.

---

#### S-08-05 [High] 2024 추석 연휴 DateThresholds 시작일 불일치

- **항목명**: 2024 추석 연휴 시작일이 DateThresholds.cs와 HolidayTable 간 1일 차이
- **파일 위치**: `src/lib/calc-engine/modules/special/seasonal.ts:HOLIDAY_TABLE` vs C# `DateThresholds.cs`
- **출처 챕터**: CH08
- **심각도**: High
- **잘못될 수 있는 케이스**: 2024년 9월 14일(토) 처방. C# `DateThresholds.cs`는 Chuseok2024Start=20240914, TS `HOLIDAY_TABLE`은 20240916부터 시작. 9월 14일~15일 처방이 명절 가산 적용 여부 달라짐.
- **원본과의 차이**: C# 시작일 2024.09.14, TS 시작일 2024.09.16 — 2일 차이.

---

### CH09 — 데이터 모델 (타입/인터페이스)

> 출처: `ch09_verifier.md`

#### S-09-01 [Critical] SupabaseCalcRepository.getInsuRate() V252 컬럼 미조회

- **항목명**: 보험료율 DB 조회 시 V252 관련 컬럼(v2520, v2521) SELECT 누락
- **파일 위치**: `src/lib/calc-engine/supabase-repo.ts:L53-68`
- **출처 챕터**: CH09
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 산정특례 V252가 있는 모든 처방. `getInsuRate()` SELECT 절에 `v2520`, `v2521`이 없어 두 필드가 항상 `undefined`로 반환 → `exemption.ts`의 V252 등급별 요율 분기가 실질적으로 동작하지 않음.
- **원본과의 차이**: DB에 `v2520`/`v2521` 컬럼 존재하나 SELECT에서 누락. C# `SelectInsuRate()`는 해당 컬럼 조회.

---

#### S-09-02 [High] CalcOptions.Age 타입 불일치 (C#: string, TS: number)

- **항목명**: 나이 필드 타입이 C#은 string, TS는 number로 불일치
- **파일 위치**: `Engine/Models/CalcOptions.cs:L29` vs `src/lib/calc-engine/types.ts:CalcOptions:L89`
- **출처 챕터**: CH09
- **심각도**: High
- **잘못될 수 있는 케이스**: 나이 파싱 파이프라인에서 string "006"과 같은 포맷이 입력될 때. C#은 `AgeInt` 계산 프로퍼티로 파싱하나, TS는 number를 직접 수신하므로 입력 형식이 다르면 6세 미만 판정 오류 가능.
- **원본과의 차이**: C# `Age: string` + `AgeInt` 계산 프로퍼티. TS `age: number` 직접 수신.

---

#### S-09-03 [High] MediIllnessInfo.SeSickNoType 타입 불일치 (C#: string, TS: number)

- **항목명**: 질병 유형 코드 필드 타입 불일치로 V252 등급 분기 오동작 가능
- **파일 위치**: `Engine/Models/MediIllnessInfo.cs:L23` vs `src/lib/calc-engine/types.ts:MediIllnessInfo:L68`
- **출처 챕터**: CH09
- **심각도**: High
- **잘못될 수 있는 케이스**: V252 산정특례 등급("0"/"1"/"4" → grade 0/1/4)이 `exemption.ts` 내에서 처리되는 모든 케이스. string "0"→0, "4"→0, "1"→1 변환이 올바르지 않으면 V252 등급 분기 오동작.
- **원본과의 차이**: C# `SeSickNoType: string` ("0","1","4"). TS `grade: number`.

---

### CH10 — 계산 파이프라인

> 출처: `ch10_verifier.md`

#### S-10-01 [Critical] DueDate 기반 수가 조회 연도 단위로만 소급

- **항목명**: 조제일자 기반 수가 버전 조회가 연도 단위로만 가능, 월·일 단위 중간 개정 반영 불가
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:L179` (`parseInt(opt.dosDate.substring(0,4))`)
- **출처 챕터**: CH10
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 같은 해 중간에 수가가 개정된 경우(예: 2023.11.01 신체계 개정). 11월 1일 이후 처방을 이전 연도 수가로 계산하는 등의 오적용은 없으나, 연내 2회 이상 개정이 있는 해에는 중간 시점 처방에 잘못된 수가 적용.
- **원본과의 차이**: C# 기준 `MAX(DueDate) <= 조제일자` 패턴으로 날짜 정밀 조회. TS는 연도(year)만 추출하여 조회.

---

#### S-10-02 [Critical] EE4 유효 약품 수 0 조기종료 없음 (EXTYPE 필터 미구현)

- **항목명**: 모든 약품이 EXTYPE 필터로 제외될 때 조기종료 미처리
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts` — classifyDrugs() 전후 유효건수 확인 없음
- **출처 챕터**: CH10
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 처방 약품이 있지만 모두 EXTYPE="1" 등으로 제외되어야 하는 경우. EXTYPE 필터 자체가 없어 제외 로직이 동작하지 않고, 유효 약품 0 조기종료도 없음.
- **원본과의 차이**: C# EE4 조건 = EXTYPE 필터 후 유효 약품 0 → 조기종료. TS에 EXTYPE 필터 및 조기종료 모두 없음.

---

#### S-10-03 [High] EE5 HasNPayDrug 조건 미반영

- **항목명**: 비급여 약품만 있는 경우(HasNPayDrug 조건) 처리 불완전
- **파일 위치**: `src/lib/calc-engine/dispensing-fee.ts:L233-236`
- **출처 챕터**: CH10
- **심각도**: High
- **잘못될 수 있는 케이스**: 처방이 비급여 약품만으로 구성된 경우. TS는 `coveredCount===0` 조건만 확인하나 C# 기준 HasNPayDrug 조건(비급여 약품 존재 여부)과 다른 판단 기준 사용.
- **원본과의 차이**: C# `HasNPayDrug` = 비급여 약품 1개 이상 존재. TS `coveredCount===0` = 급여 약품 0개. 의미 일치하지 않는 케이스 발생 가능.

---

### CH11 — 테스트 시나리오

> 출처: `ch11_analyst.md` (Insufficient/Critical 및 ENGINE_BUG 항목)

#### S-11-01 [Critical] S06 D10 sbrdnType="" Mcode 미적용

- **항목명**: 의료급여 D10에서 sbrdnType 미설정 시 Mcode 정액 분기 미진입
- **파일 위치**: `src/lib/calc-engine/modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount()`
- **출처 챕터**: CH11
- **심각도**: Critical
- **잘못될 수 있는 케이스**: D10 의료급여 + sbrdnType="" (기본 수급자). `sbrdnType이 'M'으로 시작` 조건 불충족으로 Mcode(1,000원) 대신 fixCost(0) fallback → D20의 500원 적용. 500원 과소 산출.
- **원본과의 차이**: 수정 필요: sbrdnType이 'B'로 시작 → Bcode, 나머지(빈 문자열 포함) → Mcode 적용. TS는 'M' 시작 조건만 체크.

---

#### S-11-02 [Critical] S07 C10+bohunCode 조합 보훈 모듈 미진입

- **항목명**: 건강보험(C계열) 처방에 bohunCode가 있어도 보훈 모듈 호출 안 됨
- **파일 위치**: `src/lib/calc-engine/copayment.ts` — `insuCode.charAt(0) === 'G'` 조건
- **출처 챕터**: CH11
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 건강보험(C10) 처방이지만 bohunCode=M10인 환자. 일반 C10 30% 본인부담 적용 → 보훈감면 전액(M10=면제) 미적용. 7,600원 오산출.
- **원본과의 차이**: 수정 필요: bohunCode 존재 시 insuCode 무관하게 calcVeteran() 호출. TS는 'G' 시작 insuCode일 때만 보훈 모듈 진입.

---

#### S-11-03 [High] S08 야간+토요 복합 시 토요 별도 행 미생성

- **항목명**: 야간 우선 적용 시 토요가산 별도 행이 생성되지 않음
- **파일 위치**: `src/lib/calc-engine/surcharge.ts` + `src/lib/calc-engine/dispensing-fee.ts` — 야간+토요 복합 처리
- **출처 챕터**: CH11
- **심각도**: High
- **잘못될 수 있는 케이스**: 토요일 야간(야간+토요 동시 설정) 처방. TS는 야간 우선 적용 후 토요 별도 행(Z2000030, Z3000030, Z4103030) 미추가. 야간 가산만 반영.
- **원본과의 차이**: C# 기준 야간 우선 + 토요 별도 행 동시 생성. TS는 야간만 생성.

---

### CH12 — 보훈 약국 약제비 청구

> 출처: `ch12_verifier.md`

#### S-12-01 [Critical] CalcMpvaPrice D타입/C21/C31/C32 제외 미적용

- **항목명**: MpvaPrice 계산에 보험유형 필터(D타입/C21/C31/C32 제외) 없음
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts:L210-L226`
- **출처 챕터**: CH12
- **심각도**: Critical
- **잘못될 수 있는 케이스**: 의료급여(D타입) + 보훈감면코드(M30 등)이 동시 적용된 처방. TS는 보험유형 필터 없이 MpvaPrice를 산정하여 D타입 처방에서 MpvaPrice가 과산정됨.
- **원본과의 차이**: C# `CalcMpvaPrice()`는 D타입, C21, C31, C32에 대해 MpvaPrice=0으로 제외. TS `veteran.ts:L210-L226`에 해당 필터 없음.

---

#### S-12-02 [High] GetDoubleReductionRate 반환값 의미 차이로 M61 분기 오동작 가능

- **항목명**: 이중감면율 비대상 -1 vs 0 차이로 M61 조건 분기 오동작
- **파일 위치**: `src/lib/calc-engine/modules/insurance/veteran.ts:L171`
- **출처 챕터**: CH12
- **심각도**: High
- **잘못될 수 있는 케이스**: 보훈코드가 M61이지만 이중감면 비대상인 경우. C#은 -1 반환으로 비대상 마킹, TS는 0 반환으로 0% 감면율과 구분 불가 → M61 분기 조건 오동작 가능.
- **원본과의 차이**: C# GetDoubleReductionRate() 비대상 = -1. TS 등가 함수 = 0.

---

## 전체 의심 항목 통계 요약

| 심각도 | 건수 |
|--------|------|
| Critical | 23건 |
| High | 14건 |
| Medium | 5건 |
| Low | 0건 |
| **합계** | **42건** |

| 챕터 | Critical | High | Medium | 소계 |
|------|----------|------|--------|------|
| CH01 | 4 | 0 | 1 | 5 |
| CH02 | 3 | 2 | 0 | 5 |
| CH03 | 2 | 2 | 1 | 5 (CH03 중복 일부 CH02 포함) |
| CH04 | 2 | 1 | 1 | 4 |
| CH05 | 3 | 5 | 0 | 8 (일부 CH06 중복) |
| CH06 | 2 | 2 | 0 | 4 |
| CH07 | 0 | 0 | 2 | 2 |
| CH08 | 4 | 1 | 0 | 5 |
| CH09 | 1 | 2 | 0 | 3 |
| CH10 | 2 | 1 | 0 | 3 |
| CH11 | 2 | 1 | 0 | 3 |
| CH12 | 1 | 1 | 0 | 2 |

---

## Critical 의심 Top 20

아래는 전체 의심 항목 중 **즉시 수정이 필요한 Critical 최상위 20건**을 위험도·영향 범위 순으로 정리한 것이다.

| 순위 | 코드 | 항목명 | 파일 위치 | 챕터 | 잘못될 수 있는 케이스 요약 |
|------|------|--------|-----------|------|--------------------------|
| 1 | S-09-01 | SupabaseCalcRepository.getInsuRate() V252 컬럼 미조회 | `supabase-repo.ts:L53-68` | CH09 | V252 산정특례 전 처방에서 등급별 요율 동작 불가 — DB 조회 SELECT 절에서 `v2520`/`v2521` 누락 |
| 2 | S-11-02 | C10+bohunCode 조합 보훈 모듈 미진입 | `copayment.ts` — `'G'` 조건 | CH11 | C10 건강보험+보훈감면 조합 처방에서 보훈감면 전혀 미적용, 100% 과납 |
| 3 | S-11-01 | D10 sbrdnType="" Mcode 미적용 | `medical-aid.ts:resolveMedicalAidFixAmount()` | CH11 | 의료급여 기본 수급자 sbrdnType 미설정 시 500원 차이 — 실 운영 FAIL 발생 |
| 4 | S-06-02 | MpvaComm 완전 누락 | `veteran.ts` — mpvaComm 미산출 | CH06 | 보훈 처방 전체에서 mpvaComm 항상 0 반환 |
| 5 | S-12-01 | CalcMpvaPrice D타입/C21/C31/C32 제외 미적용 | `veteran.ts:L210-L226` | CH12 | 의료급여+보훈코드 처방에서 MpvaPrice 과산정 |
| 6 | S-06-01 | 302 SumUser 처리 미포팅 | `safety-net.ts`, `veteran.ts`, `index.ts` | CH06 | 302 대상 처방 환자 수납액 과다 산출 |
| 7 | S-05-01 | G타입 M61 역산 공식 오적용 | `veteran.ts:L314-324` | CH05 | 보훈 G타입 M61 처방 본인부담금 오산출 — C타입 공식 이식 오류 |
| 8 | S-04-01 | 성인 심야→야간 다운그레이드 누락 | `surcharge.ts:L151-L162` | CH04 | 6세 이상 심야 처방에서 가산 전혀 미적용 |
| 9 | S-08-01 | ZE010 단가 5배 오류 (5,000원) | `seed.sql:L291` | CH08 | 명절 연휴 ZE010 적용 처방 수가 5배 과산출 |
| 10 | S-08-02 | ZE020 단가 오류 (10,000원) | `seed.sql:L292` | CH08 | 명절 연휴 ZE020 적용 처방 수가 3배 이상 과산출 |
| 11 | S-08-03 | ZE101/ZE102 seed.sql 누락 | `seed.sql` | CH08 | 2025년 추석 처방 명절 가산 0원 |
| 12 | S-08-04 | 2025 설날 연휴 범위 누락 | `seasonal.ts:HOLIDAY_TABLE` | CH08 | 2025년 1/25~1/27, 2/1~2/2 처방 명절 가산 미적용 |
| 13 | S-02-03 | 소아심야 Z2000640↔Z2000610 오분류 | `dispensing-fee.ts:z2000Code():L104` | CH02 | 6세 미만 심야 처방 조제기본료 코드 오분류 |
| 14 | S-03-01 | Z5xxx 일수별 가산 행 누락 | `dispensing-fee.ts:calcDispensingFee():L318` | CH03 | 처방조제 전반에서 의약품관리료 수가 미산정 |
| 15 | S-04-02 | 차등수가 text3 완전 미구현 | `surcharge.ts:getSurchargeSuffix()` | CH04 | 차등수가 약국 전 처방에서 일반 수가로 오청구 |
| 16 | S-10-01 | DueDate 연도 단위만 소급 | `dispensing-fee.ts:L179` | CH10 | 연내 수가 개정 시(2023.11.01 등) 중간 날짜 처방 오적용 |
| 17 | S-05-02 | 65세 이상 2구간 날짜 조건 누락 | `copayment.ts:L136` | CH05 | 2018.01.01 이전 처방 소급 계산 시 20% 구간 오적용 |
| 18 | S-05-03 | 65세 이상 3구간 기준액 불일치 | `copayment.ts:L127` | CH05 | 보훈감면 후 금액 대신 totalPrice로 구간 비교, 경계값 오분류 |
| 19 | S-01-02 | EXTYPE "1" 필터 미포팅 | `types.ts:DrugItem` (exType 없음) | CH01 | 제외대상 약품이 계산에 포함되어 약품금액 과산출 |
| 20 | S-10-02 | EE4 유효 약품 0 조기종료 없음 | `dispensing-fee.ts` classifyDrugs() 후 | CH10 | 전 약품이 제외 대상일 때 조기종료 없이 0원 계산 지속 |

---

> 본 보고서는 Phase 2 분석 결과물(ch01~ch12 각 _analyst.md + _verifier.md)의 Suspicious 항목만 취합하였음.
> Missing(누락) 및 Insufficient(부족) 항목은 각각 `21_missing_aggregation.md`, `23_insufficient_aggregation.md`를 참조.
> 코드 수정은 본 보고서 범위 외이며 Phase 3 이후 담당팀에서 진행한다.

*Phase 3 Sub-agent 2 — 의심 항목 취합 완료*

**[약제비 분析용]**
