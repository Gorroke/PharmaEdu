# CH04 구현 분석 보고서

> 작성자: CH04 Analyst (Phase 2 Team 4A)
> 작성일: 2026-04-06
> 챕터: CH04 — 가산 로직 (야간/공휴/소아/소아심야/토요/가루약/비대면/차등)
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 가산 로직 통합
- **핵심 주제**: 약국 조제료 산정 시 적용되는 8종 가산(야간·공휴·소아·소아심야·토요·가루약·비대면·차등)의 판정 조건, 우선순위 체인, 산정코드 접미사 생성, 금액 계산 방식을 다룬다. 가산 간 상호 배타적 if-else 체인 구성이 핵심이며, 잘못된 순서로 가산을 적용하면 청구액이 달라지므로 구현 정확도가 매우 중요하다.
- **다루는 계산 로직 범위**:
  - 가산 우선순위 체인: 비대면 전제 → 가루약(1) → 야간/공휴(2) → 소아심야(3) → 토요(4), 소아는 1순위 제외 시 중복 가능
  - 적용 대상: 건강보험 외래 처방조제 기준 (차등수가는 건강보험 "C" 계열만)
  - 관련 법령: 요양급여비용 청구방법 고시 (2023.11.01 가루약 신체계, 2023.06.01 비대면, 2016.09.29 토요 분리, 2017.10.01 차등)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/surcharge.ts` | 288줄 | `determineSurcharge()`, `getSurchargeSuffix()`, `getSaturdayAddCodes()` | 가산 판정 핵심 진입점 |
| `src/lib/calc-engine/modules/surcharges/powder.ts` | 226줄 | `hasPowderDrug()`, `shouldExcludeOtherSurcharges()`, `calcPowderSurchargeFromCtx()`, `calcPowderSurcharge()` | 가루약 가산 (2023.11.01 분기) |
| `src/lib/calc-engine/modules/surcharges/saturday-split.ts` | 307줄 | `isAfterSaturdaySplitDate()`, `createSaturdaySplitRow()`, `applySaturdaySurchargeRows()`, `calcSaturdaySplit()` | 토요 가산 별도 행 분리 (2016.09.29 이후) |
| `src/lib/calc-engine/modules/modes/counseling.ts` | ~290줄 | `getNonFaceDispensingCode()`, `calcCounselingFee()`, `calcMoonChildBonus()` | 비대면 ZC코드 결정 |
| `src/lib/calc-engine/modules/surcharges/seasonal.ts` | 250줄 | `detectSeasonalHoliday()`, `calcSeasonalSurcharge()`, `calcSeasonalSurchargeCtx()` | CH04 범위 외 (CH08 명절가산) — 참조만 |

### 미구현 영역

- `차등수가 계산 모듈` — CH04 §4-8 / 부록 B 참조. `text3` 접미사 설정 이상의 차등지수 산출 공식(1일 평균 조제횟수 기반 구간별 가중치), 차등수가 청구액 산출 흐름이 독립 파일로 존재하지 않음. `surcharge.ts`에도 `text3` 로직 없음.
- `소아심야 가산 계산 모듈` — CH04 §4-4. 소아심야 판정 플래그(`isMidNight`)는 `determineSurcharge()`에 입력으로 수신되나, 2023.11.01 전후 별도 가산률(`소아야간가산률_기본` vs `소아야간가산률`) 적용 분기 로직이 별도 모듈로 구현되어 있지 않음.

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §       | 요구사항 요약                                                               | 우리 구현 위치                                                                                       | 상태 | 비고 |
|-------------|---------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|------|------|
| CH04 §3-1   | 가산 우선순위 체인: 비대면→가루약→야간/공휴→소아심야→토요, 소아는 1순위 제외 시 중복 가능 | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L77`                                         | ✓    |      |
| CH04 §3-2   | 유팜 `Get조제료Item()` 구조: 가루약 블록과 else 블록 완전 분리, 소아는 else 내 독립 if | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L93-L198`                                    | ✓    | 구조 일치 |
| CH04 §3-3   | 가루약+소아 동시 → 소아 미적용 (`Check소아가산_조제료` 로직)                    | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L94-L103`                                    | ✓    | `isChild: false` 반환 |
| CH04 §4-1   | 야간 판정: 토요 13시, 평일 18시 기준; holidayGb="1"                          | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L129`                                        | ⚠    | 시간 판정은 caller에 위임 — surcharge.ts 내 시간 계산 없음 |
| CH04 §4-1   | 야간 산정코드 접미사 "010"                                                   | `src/lib/calc-engine/surcharge.ts:getSurchargeSuffix():L215`                                        | ✓    |      |
| CH04 §4-1   | 야간 금액 공식: `기본점수 × (1 + 공휴가산률)`                               | — (dispensing-fee.ts 레벨에서 처리 예상)                                                             | ⚠    | surcharge.ts 내 금액 계산 없음, 실제 배율 적용 위치 미확인 |
| CH04 §4-2   | 공휴일 가산: PCOMDAY1 조회, holidayGb="5"; 공휴 시 토요 무효화                | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L107-L127`                                   | ✓    | 공휴가 야간보다 우선 처리 정확 |
| CH04 §4-2   | 공휴일 산정코드 접미사 "050"                                                 | `src/lib/calc-engine/surcharge.ts:getSurchargeSuffix():L218`                                        | ✓    |      |
| CH04 §4-3   | 소아 판정: 나이 < 6 또는 주민번호 앞6자리 "000000"; holidayGb 결합 체계 "6"/"7"/"8" | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L79`                                         | ⚠    | 주민번호 "000000" 조건 미구현 — age만 체크 |
| CH04 §4-3   | Z2000 소아 접미사 "600"/"610"/"650"; Z3000은 소아 단독 코드 없음              | `src/lib/calc-engine/surcharge.ts:getSurchargeSuffix():L212-L231`                                   | ✓    | Z3000 홀딩 정확 |
| CH04 §4-3   | 소아 중복 가능 범위(야간/공휴/토요/소아심야)                                   | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L107-L188`                                   | ✓    |      |
| CH04 §4-4   | 소아심야 판정: 6세 미만 + 심야 시간대; 6세 이상이면 야간으로 다운그레이드        | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L151-L162`                                   | ⚠    | 6세 이상 시 야간 다운그레이드 로직 없음 — `isMidNight && isChild` 조건만 있음, 6세 이상 미입력 나이("") 처리 없음 |
| CH04 §4-4   | 소아심야 2023.11.01 분기: 기본조제기술료/복약지도료에만 `소아야간가산률_기본` 적용 | —                                                                                                   | ✗    | 미구현 |
| CH04 §4-4   | 소아심야 산정코드: Z2000 "64"+text3, Z41/Z43 "020"                          | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L155` (holidayGb="8" 설정만)                  | ⚠    | "64" 접미사 생성 로직 없음; getSurchargeSuffix()에서 holidayGb="8" → "010" 반환 (소아심야와 소아+야간 구별 불가) |
| CH04 §4-5   | 토요 판정: 토요일 09~13시, 야간/공휴 미해당                                   | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L164-L176`                                   | ✓    |      |
| CH04 §4-5   | 토요 가산 분리 라운딩: 기본점수와 가산점수 별도 라운딩 후 합산                    | `src/lib/calc-engine/modules/surcharges/saturday-split.ts:calcSaturdaySplit():L218`                  | ⚠    | 행 단가를 기본 코드 단가로 복사하는 방식 — 별도 비율(토요일가산률) 적용 여부 미확인 |
| CH04 §4-5   | 토요 가산 2016.09.29 이후 별도 행 분리                                        | `src/lib/calc-engine/modules/surcharges/saturday-split.ts:isAfterSaturdaySplitDate():L77`           | ✓    |      |
| CH04 §4-5   | 토요 + 6세: Z2000630 사용                                                   | `src/lib/calc-engine/modules/surcharges/saturday-split.ts:calcSaturdaySplit():L253`                 | ✓    |      |
| CH04 §4-5   | 토요 + 내복+외용 동시: Z4121030 없음, Z41xx030만 적용                         | `src/lib/calc-engine/modules/surcharges/saturday-split.ts:calcSaturdaySplit():L300-L304`            | ⚠    | 외용만 있을 때 Z4120030 추가하나, 내복+외용 동시 시 Z4120030 미추가 여부 명확히 확인 필요 |
| CH04 §4-6   | 가루약 판정: 산제 약품 존재 + 2023.11.01 분기                                  | `src/lib/calc-engine/modules/surcharges/powder.ts:hasPowderDrug():L75`, `isAfter20231101` 파라미터  | ✓    |      |
| CH04 §4-6   | 2023.11.01 이전: Z4010 별도 행 추가                                          | `src/lib/calc-engine/modules/surcharges/powder.ts:calcPowderSurchargeFromCtx():L173-L177`           | ✓    |      |
| CH04 §4-6   | 2023.11.01 이후: Z41xx + "100" 접미사                                        | `src/lib/calc-engine/modules/surcharges/powder.ts:calcPowderSurchargeFromCtx():L148-L170`           | ⚠    | 폴백 시 `addWage(baseCode, 1)` — 가루약 가산이 없는 기본 코드로 폴백하여 가산 미반영 위험 |
| CH04 §4-6   | 가루약 적용 시 야간/공휴/소아심야/토요/소아 전부 배제                           | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L94-L103`                                    | ✓    |      |
| CH04 §4-7   | 비대면 판정: DrugSafe_YN 첫 자리 "U"; 2023.06.01 이후                        | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L82-L91`                                     | ⚠    | 2023.06.01 시행일 분기 없음 |
| CH04 §4-7   | 비대면 ZC코드 결정 우선순위: 공휴 > 심야 > 야간 > 기본                          | `src/lib/calc-engine/modules/modes/counseling.ts:getNonFaceDispensingCode():L201`                   | ✓    |      |
| CH04 §4-7   | 비대면 시 모든 가산 비활성화 + 플래그 흡수                                       | `src/lib/calc-engine/surcharge.ts:determineSurcharge():L82-L91`                                     | ✓    |      |
| CH04 §4-7   | 비대면유형 2023.12.15 변경 (본인/대리/재택 3종)                                | `src/lib/calc-engine/modules/modes/counseling.ts` 내 명세서 기재 분기                                | ⚠    | 조제료 산정 로직에는 영향 없으나 명세서 출력 모듈 내 2023.12.15 분기 존재 여부 미확인 |
| CH04 §4-8   | 차등수가: text3 접미사 "1"(차등 미적용) / "0"(기타)                           | —                                                                                                   | ✗    | 미구현 |
| CH04 §4-8   | 차등수가: 2017.10.01 전후 영업시간 기준 분기                                   | —                                                                                                   | ✗    | 미구현 |
| CH04 §4-8   | 차등수가: 보험코드 "C" 외 계열은 비해당(text3="0")                             | —                                                                                                   | ✗    | 미구현 |
| CH04 부록 A | 비대면Types 열거형 상세 (None/본인수령/대리수령/재택수령)                        | `src/lib/calc-engine/modules/modes/counseling.ts`                                                   | ⚠    | getNonFaceDispensingCode()에 2023.12.15 이후 유형별 분기 없음 |
| CH04 부록 B | 차등지수 산출 공식 (구간별 가중치, 소수점 7자리 라운딩)                           | —                                                                                                   | ✗    | 미구현 |

---

## 4. 누락 항목 (Missing)

- [🔴 Missing / Critical] **차등수가 판정 및 text3 접미사 생성**: 차등수가(약국관리료 Z1000 의미III) 판정에 필요한 영업시간 조회, `m_isChadung_Yn` 플래그, `text3` 접미사 설정 로직이 `surcharge.ts` 및 관련 모듈 어디에도 존재하지 않는다. 차등수가가 미적용되면 Z1000 코드 구성이 틀려 청구 반송 위험이 있다. (CH04 §4-8)
- [🔴 Missing / Critical] **차등지수 산출 공식 및 차등수가 청구액 계산**: 1일 평균 조제횟수 기반 구간별 가중치(75건/100건/150건 구간)와 차등지수 산출, 심사청구서 수준 합산 차감 로직이 전혀 구현되지 않았다. (CH04 부록 B §B-1~B-4)
- [🟠 Missing / High] **소아심야 2023.11.01 별도 가산률 분기**: 기본조제기술료(Z2000)·복약지도료(Z3000)에만 `소아야간가산률_기본`을 적용하고, 그 외 항목에는 `소아야간가산률`을 적용하는 2023.11.01 이후 분기 로직이 없다. 유팜 `Base조제료Logic.cs:L128` 및 EDB 소스에서 확인된 규격이다. (CH04 §4-4)
- [🟡 Missing / Medium] **비대면 2023.06.01 시행일 분기**: `determineSurcharge()`에서 `isNonFace=true`이면 무조건 비대면 처리하나, 2023.06.01 이전 조제 건에 대한 분기가 없다. 과거 데이터 재계산 또는 조제일 2023.06.01 이전 케이스에서 오류 가능. (CH04 §4-7)

---

## 5. 부족 항목 (Insufficient)

- [🔴 Insufficient / Critical] **소아심야 산정코드 접미사 오류 가능성**: `determineSurcharge()`에서 소아심야를 `holidayGb="8"`, `isNight=true`로 반환한다. 그러나 `getSurchargeSuffix()`에서 `holidayGb="8"`은 야간+소아 결합("010")으로만 처리되며, 소아심야 전용 접미사인 Z2000 `"64"+text3`, Z41xx `"020"`은 생성되지 않는다. 소아심야와 소아+야간 케이스가 동일 코드로 처리되어 청구코드가 틀릴 가능성이 있다. (`src/lib/calc-engine/surcharge.ts:getSurchargeSuffix():L219`, `src/lib/calc-engine/surcharge.ts:determineSurcharge():L155`)
- [🟠 Insufficient / High] **소아 판정 — 주민번호 "000000" 조건 누락**: `determineSurcharge()`는 `age < 6`만 검사한다. 원문 규격(비즈팜 라인 8630~8638) 및 CH04 §4-3에는 주민번호 앞6자리가 "000000"이면 6세 미만으로 처리하는 조건이 있다. 나이 미입력 케이스에서 소아 가산 누락 위험. (`src/lib/calc-engine/surcharge.ts:determineSurcharge():L79`)
- [🟠 Insufficient / High] **소아심야 6세 이상 → 야간 다운그레이드 미처리**: EDB 소스(`PrsBillCalcM.SugaCalc.cs:L1391-1402`)에서 `isMidNight=true && age >= 6`이면 `isMidNight=false`, `isNight=true`로 다운그레이드한다. `determineSurcharge()`는 `isMidNight && isChild` 조건만 검사하므로, 6세 이상 환자에 `isMidNight=true`로 입력이 들어오면 소아심야 미적용 후 야간으로도 전환되지 않고 가산 없음 처리될 수 있다. (`src/lib/calc-engine/surcharge.ts:determineSurcharge():L151-L162`)
- [🟠 Insufficient / High] **소아심야 나이 미입력("") 처리 누락**: EDB 소스에서 나이가 빈 문자열이면 심야 플래그를 해제한다. 현재 구현은 `age` 타입이 `number`이므로 빈 문자열 입력 방어 코드가 없다. `SurchargeInput.age`에 undefined/NaN 가드는 `L78`에 있으나(0으로 처리), 나이 미입력을 6세 이상으로 간주하는 명시적 처리가 없어 0세로 처리되어 소아 가산이 잘못 적용될 수 있다. (`src/lib/calc-engine/surcharge.ts:L78`)
- [🟠 Insufficient / High] **토요 가산 분리 라운딩 — 가산률 미반영 의심**: `calcSaturdaySplit()`에서 토요 가산 별도 행의 단가를 기본 코드 단가와 동일하게 설정한다(예: Z2000030 price = Z2000 price). 그러나 유팜 원본(`Base조제료Logic.cs:L131-134`)은 `토요일가산률`을 기본점수에 곱한 별도 점수로 가산분을 산출한다. 현재 구현이 100%를 가산으로 적용하고 있어 가산률 반영이 누락되었을 가능성이 있다. (`src/lib/calc-engine/modules/surcharges/saturday-split.ts:calcSaturdaySplit():L253-L296`)
- [🟡 Insufficient / Medium] **가루약 2023.11.01 이후 신체계 폴백 — 가산 미반영 위험**: `calcPowderSurchargeFromCtx()`의 신체계 분기에서 `Z41xx100` 단가가 없으면 `addWage(baseCode, 1)`로 기본 내복약 코드를 사용한다. 폴백 시 가루약 가산이 전혀 반영되지 않아 무음 실패가 발생한다. (`src/lib/calc-engine/modules/surcharges/powder.ts:calcPowderSurchargeFromCtx():L167-L170`)
- [🟡 Insufficient / Medium] **비대면 유형 2023.12.15 명세서 분기 미확인**: `counseling.ts`의 `getNonFaceDispensingCode()`는 조제료 산정에만 관여하나, 명세서 출력 모듈에서 비대면 유형코드(본인수령/대리수령/재택수령) 기재 시 2023.12.15 이전/이후 분기가 필요하다. 해당 모듈 위치를 확인하지 못하여 미확인으로 기재. (CH04 부록 A §A-2)
- [🟢 Insufficient / Low] **`shouldExcludeOtherSurcharges()` — 날짜 분기 미반영**: `powder.ts:shouldExcludeOtherSurcharges()`는 약품 리스트에 가루약이 있으면 무조건 `true`를 반환하나, 내부 주석에 "2023.11.01 이후에만 활성화"라고 적시되어 있음에도 날짜 인수가 없다. 2023.11.01 이전 처방에서 가루약 약품이 포함되면 다른 가산을 잘못 배제할 수 있다. (`src/lib/calc-engine/modules/surcharges/powder.ts:shouldExcludeOtherSurcharges():L88-L90`)

---

## 6. 기타 관찰 사항

- **`seasonal.ts`는 CH04 범위 외**: `src/lib/calc-engine/modules/surcharges/seasonal.ts`는 명절가산(ZE 계열)을 구현하며, 파일 내 주석에 `output/CH08_특수케이스.md §2`를 참조 출처로 명시하고 있다. CH04 가산 8종(야간/공휴/소아/소아심야/토요/가루약/비대면/차등)과는 별개 모듈이다. CH08 분석팀이 담당한다.

- **`determineSurcharge()` 시간 판정 위임 구조**: 야간·토요·소아심야의 시간 판정(ZTime1/ZTime2/ZTime3 비교)은 `determineSurcharge()` 내부에서 이루어지지 않고, caller가 미리 계산하여 `isNight`, `isSaturday`, `isMidNight` 플래그로 주입하는 구조이다. 이로 인해 시간 판정 로직 위치를 별도로 확인해야 하며, 비즈팜 `PZCVALUE` 기본값(ZTime1=0900, ZTime2=1300, ZTime3=1800) 적용 여부를 `dispensing-fee.ts` 또는 상위 통합 레이어에서 검증할 필요가 있다.

- **holidayGb "8" 중복 사용 문제**: `surcharge.ts`에서 "야간+소아"(`isNight=true, isChild=true`)와 "소아심야"(`isMidNight=true, isChild=true`) 두 경우 모두 `holidayGb="8"`을 반환한다. 하위 계층에서 두 케이스를 구별하려면 추가 플래그가 필요하다. 현재 구조에서는 `isNight` 필드로 구별 가능하나(`isNight=true`=야간+소아, 소아심야도 `isNight=true`로 동일 설정), 소아심야 전용 접미사 생성이 불가하다.

- **차등수가 외부 데이터 의존**: 차등수가 판정은 1일 평균 조제횟수 산출에 약사별 누적 데이터가 필요하다(CH04 부록 B §B-1). 단일 명세서 계산만으로는 판정 불가이므로, 계산 엔진 외부에서 데이터를 주입하는 인터페이스 설계가 필요하다.

- **`getSaturdayAddCodes()` — `surcharge.ts` 내 중복 기능**: `surcharge.ts:getSaturdayAddCodes()`와 `saturday-split.ts:calcSaturdaySplit()`이 유사한 토요 가산 코드 목록 생성 역할을 한다. 두 함수의 책임이 명확히 분리되어 있지 않아 향후 유지보수 시 혼선이 발생할 수 있다.

---

## 부록 A: 가산 Types 코드표 및 2023.12.15 변경

### A-1. holidayGb 코드 체계 (비즈팜 호환)

| holidayGb 값 | 의미 | 대응 Z코드 접미사 (Z2000 기준) |
|---|---|---|
| "0" | 해당 없음 | (없음) |
| "1" | 야간 | 010 |
| "3" | 토요 | 030 |
| "5" | 공휴일 | 050 |
| "6" | 6세 미만 단독 | 600 |
| "7" | 6세 미만 + 공휴일 | 650 |
| "8" | 6세 미만 + 야간 / 소아심야 | 610 (야간+소아), 640+text3 (소아심야 — 현재 미구현) |

출처: `CH04_가산_로직.md §4-2`, `surcharge.ts:L13-L28`

### A-2. 비대면 조제 유형 및 2023.12.15 변경

| 값 | 명칭 | 설명 |
|---|---|---|
| 0 | None | 비대면 미해당 (일반 조제) |
| 100 | 본인수령 | 환자 본인이 약국 방문하여 수령 (비대면 상담) |
| 200 | 대리수령 | 대리인이 약국 방문하여 수령 |
| 300 | 재택수령 | 택배/퀵 등으로 환자 자택 배송 |

- 시행일: 2023.06.01~
- 2023.12.15부터 유형이 본인수령(100)/대리수령(200)/재택수령(300) 3종으로 재분류됨
- ZC001~ZC004 코드 결정 로직(시간대별 판정)에는 변경 없음
- 명세서 특정내역 기재 시 유형코드가 달라지므로 명세서 출력 모듈에서만 분기 처리 필요

출처: `CH04_가산_로직.md 부록 A §A-1, A-2`

---

## 부록 B: 차등수가 산출 공식 (실측값 기반)

### B-1. 1일 평균 조제횟수 산출

```
1일_평균_조제횟수(n) = 주(또는 월)_총_조제횟수 ÷ 약사별_총_조제일수
→ 소수점 첫째 자리에서 절사
```

외부 데이터 연동 필수. 단일 명세서로는 판정 불가.

### B-2. 구간별 가중치 (2026 상대가치점수표 기준)

| 구간 | 1일 평균 조제횟수 | 가중치 |
|------|----------------|--------|
| 1구간 | 75건 이하 | 1.00 (100%) |
| 2구간 | 76~100건 | 0.90 (90%) |
| 3구간 | 101~150건 | 0.75 (75%) |
| 4구간 | 151건 이상 | 0.50 (50%) |

출처: 상대가치점수표 제1부 일반원칙 III (고시 제2025-186호), `CH04_가산_로직.md 부록 B §B-2`

### B-3. 차등지수 산출 공식

```
n ≤ 75:  차등지수 = 1.0

75 < n ≤ 100:
  차등지수 = {75×1.00 + (n-75)×0.90} / n

100 < n ≤ 150:
  차등지수 = {75×1.00 + 25×0.90 + (n-100)×0.75} / n

150 < n:
  차등지수 = {75×1.00 + 25×0.90 + 50×0.75 + (n-150)×0.50} / n

→ 소수점 여덟째 자리에서 4사5입 → 소수점 일곱째 자리까지 유지
```

예시 (n=120): 차등지수 = 112.5 / 120 = 0.9375000

### B-4. 차등수가 청구액 산출

```
조제료등_합계 = Z40~Z43 + Z10 + Z20 + Z30 (Z10 의미I='1' 차등 제외분 제외)
차감액 = 조제료등_합계 × (1 - 차등지수)
차등수가청구액 = 청구액 - 차감액
```

차등수가는 심사청구서 수준에서 합산 기재. 건강보험(보험코드 첫 자리 "C") 외래 처방조제에만 적용.

출처: `CH04_가산_로직.md 부록 B §B-3, B-4`

---

**[약제비 분석용]**
