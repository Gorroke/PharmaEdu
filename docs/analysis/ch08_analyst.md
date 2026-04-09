# CH08 구현 분석 보고서

> 작성자: CH08 Analyst (Phase 2 Team 8A)
> 작성일: 2026-04-06
> 챕터: CH08 — 특수케이스/엣지케이스 통합
> 상태: [ ] 초안 | [ ] 검토 중 | [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 특수케이스/엣지케이스 통합
- **핵심 주제**: 일반 산정 로직으로 처리할 수 없는 정책 기반 예외(명절가산, 본인부담상한제, 특수약품, 보훈병원 하드코딩)와 경계값·결함 기반 예외(날짜 분기, 비급여 반올림, U항, 비즈팜 버그)를 통합 규정한다. EDB, 유팜, 비즈팜, 공단 PDF 4소스를 교차하여 새 시스템 구현 기준을 명시한다.
- **다루는 계산 로직 범위**:
  - 명절가산 ZE100~ZE102 수가코드 산정 (날짜/금액/보험코드 분기)
  - 본인부담상한제 연간 누적 초과분 계산 및 공단 전환
  - 특수약품 648903860 투약일수 5일 상한 및 5% 가산 (2024.10.25~)
  - 보훈병원 6곳 하드코딩 및 관련 보험코드 전환
  - 날짜 기점 분기 17건 전체 (2000~2024)
  - 비즈팜 고유 버그 3건(BUG-001, BUG-002, Z4121) 회피 여부
  - 관련 법령: 국민건강보험법 요양급여비용 고시 (2024 기준), 보건복지부 고시 (본인부담상한액), 보훈처 고시 (보훈코드별 감면율)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/modules/surcharges/seasonal.ts` | 250줄 | `detectSeasonalHoliday()`, `calcSeasonalSurcharge()`, `calcSeasonalSurchargeCtx()` | 명절가산 ZE계열 전담 |
| `src/lib/calc-engine/modules/special/safety-net.ts` | 229줄 | `calcSafetyNetOverage()`, `applySafetyNet()`, `calcSafetyNet()` | 본인부담상한제 |
| `src/lib/calc-engine/modules/special/drug-648.ts` | 231줄 | `has648Drug()`, `apply648DayLimit()`, `sum648DrugAmount()`, `calc648Surcharge()`, `process648Special()`, `calcDrug648Surcharge()` | 특수약품 648903860 |
| `src/lib/calc-engine/modules/insurance/veteran.ts` | 425줄 | `isBohunHospital()`, `getBohunRate()`, `getDoubleReductionRate()`, `calcVeteran()` | 보훈병원 하드코딩 포함 |
| `src/lib/calc-engine/modules/modes/counseling.ts` | 322줄 | `isNonFaceMode()`, `getNonFaceDispensingCode()`, `calcCounselingFee()`, `calcMoonChildBonus()`, `calcCounseling()` | 비대면조제 ZC계열 (CH08 §6 날짜 분기 #14 관련) |

### 미구현 영역

- `비급여 반올림 옵션(NPayRoundType 6종)` — CH08 §7 참조. `seasonal.ts`·`safety-net.ts`·`drug-648.ts`를 포함한 어떤 파일에도 `NPayRoundType` 처리 모듈이 없음.
- `U항(100% 본인부담) 전용 집계 모듈` — CH08 §8 참조. `PbInsuDrug_100` / `Pub100Price` 누적·분리 처리 모듈이 별도로 확인되지 않음 (통합 레이어에서 처리 가능성 있으나 미확인).
- `반환/취소/수정처방 처리 모듈` — CH08 §10 참조. `claim_kind` / `original_receipt_no` 등 보완·추가청구 처리 코드 없음.

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §     | 요구사항 요약                                                        | 우리 구현 위치                                                                      | 상태 | 비고 |
|-----------|--------------------------------------------------------------------|-------------------------------------------------------------------------------------|------|------|
| CH08 §2-1 | ZE100(2024추석), ZE010/ZE020(2025설날), ZE101/ZE102(2025추석) 코드 체계 | `seasonal.ts:HOLIDAY_TABLE:L56-90`                                                  | ⚠    | 날짜 범위 불일치 — 아래 §4 참조 |
| CH08 §2-2 | 2024 추석 2024.09.14~09.18, 2025 설날 01.25~02.02, 2025 추석 10.03~10.09 | `seasonal.ts:HOLIDAY_TABLE:L56-90`                                                  | ⚠    | 구현된 날짜가 규격보다 좁음 |
| CH08 §2-2 | 당일 가산 구조: 연휴 1,000원 + 당일 추가 2,000원 = 합계 3,000원          | `seasonal.ts:detectSeasonalHoliday():L126-149`                                      | ✓    | actualAmount=3000 정상 |
| CH08 §2-3 | 대상 보험코드: C계열, D계열, M10/M20/M30/M50/M60/M61                   | `seasonal.ts:isEligibleInsuCode():L102-106`                                         | ⚠    | M계열(보훈) 미포함, C/D만 처리 |
| CH08 §2-3 | 2024 추석: E10 제외 / 2025 이후: E10 포함                              | `seasonal.ts:isEligibleInsuCode():L102-106`                                         | ✗    | E10 분기 없음 |
| CH08 §2-4 | 비대면(DrugSafe_YN="U") 시 명절가산 미적용                              | `seasonal.ts:calcSeasonalSurcharge():L175`                                          | ✓    | isNonFace 체크 정상 |
| CH08 §2-4 | 비급여만(isOnlyNPayDrug) 시 명절가산 미적용                              | `seasonal.ts:calcSeasonalSurcharge():L169-202`                                      | ✗    | isOnlyNPayDrug 조건 없음 |
| CH08 §2-5 | 가산 미적용 기준금액(`Get조제료Item_가산미적용`) 사용                       | 미확인 (통합 레이어 범위)                                                            | ⚠    | 단일 모듈에서 미확인, 통합 레이어 확인 필요 |
| CH08 §3-2 | 옵션 확인: M_OverUserPriceYN == "Y"                                    | `safety-net.ts:calcSafetyNet():L181-229`                                            | ⚠    | 옵션 플래그 체크 없음. `cumulativeUserPrice` 없으면 미적용으로 처리 |
| CH08 §3-2 | 연간 누적 본인부담금 조회 `GetPbRealPrice(환자코드, 조제일자, 환자ID)`       | `safety-net.ts:applySafetyNet():L151` (yearlyAccumulated 인자로 전달)                | ✓    | 조회 자체는 호출자 책임으로 분리 정상 |
| CH08 §3-3 | 초과분 = min(초과분, PbRealPrice) — 현재 건 초과 불가                    | `safety-net.ts:calcSafetyNetOverage():L134`                                         | ✓    | `Math.min(raw, currentUserPrice)` 정상 |
| CH08 §3-4 | 상한제 적용 후 m_TDay_Price(명절가산)는 PbInsuPrice에 추가               | 미구현                                                                               | ✗    | safety-net.ts에서 명절가산 후처리 연결 없음 |
| CH08 §3-4 | 소득 구간별 상한액 (P16 연도별 변동)                                     | `safety-net.ts:ANNUAL_CAP_BY_DECILE:L40-51`                                         | ⚠    | 2024년 기준 하드코딩, 연도별 변동 미지원 |
| CH08 §4-2 | 648903860 투약일수 = min(처방일수, 5)                                   | `drug-648.ts:apply648DayLimit():L97-104`                                            | ✓    | `dDay > DAY_LIMIT_648` 정상 처리 |
| CH08 §4-2 | num==0인 경우 1로 처리                                                  | `drug-648.ts:apply648DayLimit():L97-104`                                            | ✗    | dDay=0 케이스: 5 이하이므로 변경 없음 → 0 그대로 반환 (1로 보정 안 됨) |
| CH08 §4-3 | 2024.10.25 이후 5% 가산 적용                                            | `drug-648.ts:calc648Surcharge():L139-143`                                           | ✓    | SURCHARGE_START_DATE='20241025' 정상 |
| CH08 §4-3 | M61, M20: 가산 적용 / M10, M83, M82: 가산 제외                          | `drug-648.ts:calcDrug648Surcharge():L192-231`                                       | ⚠    | M10/M83/M82 제외 구현됨. M61·M20은 EXEMPT_BOHUN_CODES에 없어 가산 적용 — 규격 일치 |
| CH08 §4-3 | V252(중증질환) 산정 시 648약가 별도 분리 계산                            | `drug-648.ts` 전체                                                                   | ✗    | V252 분기 없음. 일반 surcharge만 적용 |
| CH08 §5-1 | 보훈병원 6곳 요양기관기호 하드코딩                                        | `veteran.ts:BOHUN_HOSPITAL_CODES:L64-71`                                            | ✓    | 6곳 Set 정상 구현 |
| CH08 §5-2 | PD_INSUPAY=9 + G보험 + 보훈코드 → PD_INSUPAY="0"(비급여) 변환           | `veteran.ts:calcVeteran():L254-425`                                                 | ✗    | PD_INSUPAY=9 전환 로직 없음 |
| CH08 §5-2 | G보험 + 보훈병원 + 비급여만 → isOnlyNPayDrug=true 설정                   | `veteran.ts:calcVeteran():L254-425`                                                 | ✗    | isOnlyNPayDrug 설정 로직 없음 |
| CH08 §5-3 | 2018.01.01 이전 병원등급 하드코딩 3곳 (38100231, 11100915, 37100467)     | `veteran.ts` 전체 검색                                                               | ✗    | 2018 이전 병원등급 하드코딩 없음 |
| CH08 §6   | 날짜 기점 분기 17건 전체 구현 (2007.08.01 ~ 2024.10.25)                 | 분산 구현 (veteran.ts, drug-648.ts, seasonal.ts 등)                                  | ⚠    | 아래 §5 부족 항목 참조 |
| CH08 §9-1 | BUG-001 회피: 보훈 정액 구간 본인부담 재조정                              | `veteran.ts:calcVeteran():L342-356`                                                 | ✓    | 음수 insuPrice 발생 시 mpvaPrice·userPrice 순 차감 처리됨 (자기비교 없음) |
| CH08 §9-2 | BUG-002 회피: 50%감면 + 암환자 본인부담금 정상 산식                       | `veteran.ts:calcVeteran():L327-340`                                                 | ✓    | 이중등호 없이 정상 산식 사용 |
| CH08 §9-3 | Z4121 Holiday_gb 7/8 교차 오류 미재현                                   | counseling.ts, seasonal.ts 범위 외                                                   | ✓    | 신규 코드는 Holiday_gb 체계 사용 안 함 (수가 코드 직접 지정 방식) |

---

## 4. 누락 항목 (Missing)

- [🔴 Missing / Critical] **E10 연도별 분기**: 2024 추석은 E10 제외, 2025 이후는 E10 포함 — 구현된 `isEligibleInsuCode()`는 C/D만 처리하며 E/M 계열 분기가 전혀 없다. E10 환자가 2025 명절에 가산을 받지 못하거나 2024 추석에 잘못 수령하는 오류 발생. (`seasonal.ts:isEligibleInsuCode():L102-106`, CH08 §2-3)

- [🔴 Missing / Critical] **M계열(보훈) 보험코드 명절가산 대상 미포함**: 규격(CH08 §2-3)은 M10, M20, M30, M50, M60, M61을 명절가산 적용 대상으로 명시하나, `isEligibleInsuCode()`는 C/D만 처리. 보훈 환자 전체 누락. (`seasonal.ts:isEligibleInsuCode():L102-106`, CH08 §2-3)

- [🔴 Missing / Critical] **648903860 V252 분리 계산**: 규격(CH08 §4-3)은 V252(중증질환) 환자의 경우 `PbUserPrice = trunc10((총액 - 648약가) × V252요율%) + 648약가 × 5%`로 약가를 분리하여 계산하도록 요구한다. `drug-648.ts`에는 V252 분기가 전혀 없다. 중증질환 환자의 648 약품 본인부담금 계산 오류. (`drug-648.ts` 전체, CH08 §4-3)

- [🟠 Missing / High] **비급여만 시 명절가산 미적용 조건**: 규격(CH08 §2-4)은 `isOnlyNPayDrug`가 true인 경우 명절가산을 적용하지 않도록 명시. `calcSeasonalSurcharge()`에 해당 조건이 없다. (`seasonal.ts:calcSeasonalSurcharge():L169-202`, CH08 §2-4)

- [🟠 Missing / High] **명절가산 후 본인부담상한제 연계**: 규격(CH08 §3-4)은 상한제 적용 후에도 `m_TDay_Price`(명절가산)를 `PbInsuPrice`, `PbTotalPrice`, `PbSumInsure`에 별도 추가한다고 명시. `safety-net.ts`에는 명절가산 후처리 연결 로직이 없다. (`safety-net.ts` 전체, CH08 §3-4)

- [🟠 Missing / High] **648 투약일수 0일 → 1일 보정**: 규격(CH08 §4-2)은 `num == 0 → 1`로 명시하나, `apply648DayLimit()`은 dDay=0인 경우 `0 > 5`가 false이므로 0을 그대로 반환한다. (`drug-648.ts:apply648DayLimit():L97-104`, CH08 §4-2)

- [🟠 Missing / High] **보훈병원 PD_INSUPAY=9 → "0" 변환**: G보험 + 보훈코드 + PD_INSUPAY=9 조합에서 비급여로 전환하는 로직이 `veteran.ts`에 없다. (`veteran.ts:calcVeteran():L254-425`, CH08 §5-2)

- [🟠 Missing / High] **비급여 반올림 옵션(NPayRoundType 6종) 전담 모듈**: 규격(CH08 §7)은 10원/100원 단위 올림·반올림·내림 6종 + 차액 보정을 요구. 해당 처리 모듈이 코드베이스에서 확인되지 않는다. (CH08 §7)

- [🟠 Missing / High] **보완청구/추가청구 처리 모듈**: 규격(CH08 §10)은 `claim_kind`, `original_receipt_no`, `reject_reason_code` 등 보완/추가청구 처리를 요구. 해당 모듈이 없다. (CH08 §10)

- [🟡 Missing / Medium] **U항(100% 본인부담) 전용 집계 분리**: 규격(CH08 §8)은 U항 약가를 `요양급여비용총액1`에서 제외하고 `건강보험100분의100본인부담금총액`으로 별도 집계하도록 요구. 전담 집계 모듈이 확인되지 않는다. (CH08 §8)

- [🟡 Missing / Medium] **2018.01.01 이전 병원등급 하드코딩(3곳)**: 규격(CH08 §5-3)은 요양기관기호 38100231·11100915·37100467의 과거 등급을 하드코딩하도록 명시. `veteran.ts`에 없다. (`veteran.ts` 전체, CH08 §5-3)

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] **2024 추석 명절 날짜 범위 과소**: 규격(CH08 §2-2)은 2024 추석 연휴를 `2024.09.14~09.18`로 정의하나 구현은 `20240916~20240918`(3일)이다. 2024.09.14(토)·09.15(일) 이틀 누락. (`seasonal.ts:HOLIDAY_TABLE:L57-67`, CH08 §2-2)

- [🟠 Insufficient / High] **2025 설날 날짜 범위 과소**: 규격(CH08 §2-2)은 `2025.01.25~01.30 + 02.01~02.02`(8일, 비연속)로 정의하나 구현은 `20250128~20250130`(3일)이다. 01.25(토)·01.26(일)·01.27(월)·02.01(토)·02.02(일) 5일 누락. 비연속 날짜 범위 처리 구조도 없음. (`seasonal.ts:HOLIDAY_TABLE:L69-78`, CH08 §2-2)

- [🟠 Insufficient / High] **2025 추석 날짜 범위 과소**: 규격(CH08 §2-2)은 `2025.10.03~10.09`(7일)로 정의하나 구현은 `20251005~20251007`(3일)이다. 10.03(금)·10.04(토)·10.08(수)·10.09(목) 4일 누락. (`seasonal.ts:HOLIDAY_TABLE:L80-89`, CH08 §2-2)

- [🟠 Insufficient / High] **2024 추석 당일 가산 미분리**: 규격(CH08 §2-2)은 ZE100 단일 코드로 1,000원 적용이나, 구현 주석(`seasonal.ts:L59`)은 "당일/연휴 코드 구분 없음"으로 처리. 그러나 당일(2024.09.17)에 대해 actualAmount도 1,000원으로 동일하게 설정되어 있어 규격과는 일치한다. 다만 `codeActual: 'ZE100'`으로 연휴·당일 모두 같은 코드 사용 — 규격과 동일하므로 허용 범위 내. 재확인 필요.

- [🟡 Insufficient / Medium] **본인부담상한제 연도별 상한액 변동 미지원**: 규격(CH08 §3-4)은 연간 상한액(P16)이 매년 변동 가능하다고 명시. `ANNUAL_CAP_BY_DECILE`은 2024년 기준 하드코딩이며, 연도 파라미터를 받는 구조가 없다. (`safety-net.ts:ANNUAL_CAP_BY_DECILE:L40-51`, CH08 §3-4)

- [🟡 Insufficient / Medium] **본인부담상한제 M_OverUserPriceYN 옵션 플래그 미체크**: 규격(CH08 §3-2)의 첫 번째 단계는 `M_OverUserPriceYN == "Y"` 확인이다. `calcSafetyNet()`은 해당 플래그 없이 `cumulativeUserPrice` 미제공 시 미적용으로 처리한다. 약국 옵션 설정에 따른 분기가 누락되어 있다. (`safety-net.ts:calcSafetyNet():L181-229`, CH08 §3-2)

- [🟡 Insufficient / Medium] **날짜 분기 17건 중 직접 커버 미확인 항목**: CH08 §6의 17개 날짜 분기 중 현재 분석 대상 파일에서 직접 확인된 분기: `20180101`(veteran.ts), `20241025`(drug-648.ts), `20230601`(counseling.ts의 ZC코드 시행 — _dosDate 미사용으로 사실상 미처리). 나머지 14건은 타 모듈 분산 여부 미확인. (`counseling.ts:getNonFaceDispensingCode():L201-218`, CH08 §6 #14)

- [🟢 Insufficient / Low] **`M_isBohunHospigtal` 오타 필드명 호환**: 규격(CH08 §5-4)은 원본 오타(Hospigtal) 유지를 권고. TypeScript 구현은 `isBohunHospital()`로 수정됨 — 외부 API명 수정은 규격과 일치하나, C# 원본 연동 시 필드명 매핑 주의. (`veteran.ts:isBohunHospital():L189`, CH08 §5-4)

---

## 6. 기타 관찰 사항

- **명절가산 날짜 범위의 구조적 한계**: `HOLIDAY_TABLE`의 `start`/`end`는 연속 범위만 표현 가능하다. 2025 설날처럼 `01.25~01.30 + 02.01~02.02` 비연속 기간을 처리하려면 `HolidayDef` 구조를 `ranges: {start, end}[]`로 확장해야 한다. 현재 구조로는 정확한 날짜 범위 구현이 불가능하다.

- **명절가산 단일 항목 반환 구조의 한계**: `detectSeasonalHoliday()`는 당일에 `ZE020`/`ZE102` 코드와 3,000원을 반환하나, 규격(CH08 §2-2 비고)은 `ZE010 + ZE020` **2개 수가 항목을 중복 적용**하는 구조를 시사한다. 현재 구현은 단일 항목 반환으로 수가 분리 청구 여부 불명확. 검증자 확인 필요.

- **비대면조제 시행일 분기 `_dosDate` 미사용**: `getNonFaceDispensingCode()`는 `_dosDate` 파라미터를 받지만 실제로 사용하지 않는다(underscore prefix). 규격(CH08 §6 #14) 2023.06.01 시행일 이전 건에도 ZC 코드가 반환될 수 있다. 현재 Phase 2 교육 도구 범위에서는 허용 가능하나, 실 청구 시스템으로 전환 시 반드시 수정이 필요하다.

- **`calcMoonChildBonus()` price=0 반환**: 달빛어린이약국 가산 함수가 `price: 0`으로 WageListItem을 반환하며 Integration Lead가 수정하도록 TODO 처리됨. 단독 호출 시 0원 항목이 그대로 사용될 위험이 있다. (`counseling.ts:calcMoonChildBonus():L175-183`)

- **`round1` 함수 정의 미확인**: `drug-648.ts:L23`에서 `import { round1 } from '../../rounding'`을 사용하나, 이 함수의 정의(소수점 이하 반올림 방식)를 본 분석에서 확인하지 않았다. 검증자가 `rounding.ts`에서 `round1`이 `Math.round(x)` 또는 `Math.round(x * 10) / 10` 중 어느 쪽인지 확인해야 한다. 5% 가산 금액 산출 정밀도에 영향.

- **`calcVeteran()` 보훈병원 isSimSa 분기**: `isSimSa === true`이면 비위탁 보훈약국에서도 `userPrice = 0` 처리를 건너뛴다(`veteran.ts:L373`). 규격 CH08에서 `isSimSa`에 대한 언급이 없어 이 분기의 근거 원본을 확인할 수 없었다. 검증자가 C# 원본과 대조 필요.

- **`safety-net.ts:applySafetyNet()`의 `pubPrice` 재정의**: 함수 내 `pubPrice: newInsuPrice`로 설정하여 기존 pubPrice(공단청구) 정의를 덮어쓴다(`safety-net.ts:L169`). 그러나 `CalcResultWithSafetyNet`은 `insuPrice` 필드를 별도로 추가한다. `pubPrice = insuPrice + mpvaPrice`의 기존 정의(`veteran.ts:L417`)와 충돌 가능성이 있다. 통합 레이어에서 `pubPrice` 재정의 충돌 여부를 반드시 검토해야 한다.

- **날짜 분기 17건 중 3건만 직접 확인**: CH08 §6의 17개 분기 중 분석 대상 파일(seasonal.ts, safety-net.ts, drug-648.ts, counseling.ts, veteran.ts)에서 직접 날짜 상수가 확인된 것은 `20180101`(2건), `20241025`(1건) 총 3건이다. 나머지 14건(2007.08.01, 2015.11.01, 2016.09.29 등)은 copayment.ts, dispensing.ts 등 타 파일에 분산되어 있을 것으로 추정된다. Phase 2 전체 집계 시 타 챕터 분석 결과와 교차 확인이 필요하다.

---

**[약제비 분석용]**
