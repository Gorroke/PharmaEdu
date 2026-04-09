# CH02 구현 분석 보고서

> 작성자: CH02 Analyst (Phase 2 Team 2A)
> 작성일: 2026-04-06
> 챕터: CH02 — 조제료 코드체계 (Z코드 완전 레퍼런스)
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 조제료 코드체계 (Z코드 완전 레퍼런스)
- **핵심 주제**: 약국 약제비 청구 시 02항(조제료)에 사용되는 Z코드 전체를 정의한다. 5자리 기본코드와 3자리 산정코드(접미사)의 결합 구조, 투약일수별 25구간 코드 생성(GetInJojeSugaCD), 가산별 접미사 조합 규칙, 토요가산 별도 행 처리, ZH/ZC/ZE 특수코드를 망라한다.
- **다루는 계산 로직 범위**:
  - Z1000/Z2000/Z3000/Z4xxx/Z5xxx 기본코드 선택 로직
  - 접미사 text(연령/가루약) + text2(시간대) + text3(차등수가) 3자리 조합
  - 투약일수 1~15일(Z41xx 개별) / 16일 이상(Z43xx 구간) 분기 및 Z5xxx 동일 25구간
  - 의약품관리료 Z5000/Z5001/Z5011 분기 (마약류 포함 여부, 병팩 여부)
  - 토요가산 "030" 별도 행 분리 (2016.09.29 이후)
  - ZH(재난/코로나19), ZC(비대면), ZE(명절) 특수코드
  - 관련 고시: 건강보험 요양급여비용 청구방법 (2024.07 기준)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/dispensing-fee.ts` | 359줄 | `z1000Code()`, `z2000Code()`, `z3000Code()`, `z4InternalCode()`, `z4ExternalCode()`, `z4BothCode()`, `z5000Code()`, `calcDispensingFee()` | Z코드 선택 핵심 허브 |
| `src/lib/calc-engine/surcharge.ts` | 288줄 | `determineSurcharge()`, `getSurchargeSuffix()`, `getSaturdayAddCodes()` | holidayGb → 접미사 매핑 |
| `src/lib/calc-engine/modules/surcharges/saturday-split.ts` | 307줄 | `isAfterSaturdaySplitDate()`, `createSaturdaySplitRow()`, `applySaturdaySurchargeRows()`, `calcSaturdaySplit()` | 030 별도 행 분리 |
| `src/lib/calc-engine/modules/surcharges/seasonal.ts` | 250줄 | `detectSeasonalHoliday()`, `calcSeasonalSurcharge()`, `calcSeasonalSurchargeCtx()` | ZE 계열 |
| `src/lib/calc-engine/modules/modes/counseling.ts` | 322줄 | `getNonFaceDispensingCode()`, `isNonFaceMode()`, `calcCounseling()` | ZC 계열 |
| `src/lib/calc-engine/modules/modes/direct-dispensing.ts` | 510줄 | `calcDirectDispensing()` | Z42xx 코드 체계 |
| `supabase/seed.sql` | — | Z코드 수가 마스터 (2024/2026 연도) | Z5101~Z5391 없음 |

### 미구현 영역

- `Z5001/Z5011 처방조제 분기` — CH02 §3-1: 처방조제 경로에서 Z5000만 고정 사용. 마약류 포함 시 Z5001, 전체 병팩 시 Z5011 분기가 없음 (직접조제 모듈에는 존재)
- `Z4130 자가투여주사제 조제료` — CH02 §3-2: 주사제 단독 시 Z4130 산정 로직 없음. 현재는 Z5000만 반환
- `Z5101~Z5391 의약품관리료 구간별 코드` — CH02 §5-3: GetMedMgmtSugaCD() 의사코드 대응 구현 없음. Z5000 단일 고정만 존재
- `ZH001/ZH002/ZH003/ZH004 코로나19 관련 코드` — CH02 §3-5: dispensing-fee.ts에 ZH 처리 흐름이 전혀 없음
- `Z1000 차등수가 제외 분기 (Z1000100/Z1000001)` — CH02 §4-1: z1000Code()가 항상 'Z1000' 반환. 차등수가 제외 플래그 처리 없음
- `Z3000/Z2000 심야 코드 (Z2000640, Z3000040)` — CH02 §4-2: 소아심야(holidayGb='8') 시 z2000Code()는 Z2000610(야간코드)을 생성하나, seed.sql에는 Z2000640(소아심야)이 별도 존재. z3000Code()는 소아심야를 Z3000010으로 처리하나 Z3000040이 별도 존재

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §      | 요구사항 요약                     | 우리 구현 위치                              | 상태    | 비고 |
|------------|----------------------------------|------------------------------------------|---------|------|
| CH02 §2-1 | Z코드 = 기본코드 5자리 + 접미사 3자리 구조 | `src/lib/calc-engine/dispensing-fee.ts:z2000Code():L98` | ✓ | 구조 자체는 올바름 |
| CH02 §2-2 | Z10~Z70 대분류 범위 | `dispensing-fee.ts` 전반 | ✓ | 코드 범위 내 생성 |
| CH02 §2-3 | text/text2/text3 3자리 접미사 | `surcharge.ts:getSurchargeSuffix():L207` | ⚠ | 심야 text2 분기 불완전 (§4항 상세) |
| CH02 §3-1 | Z1000 약국관리료 | `dispensing-fee.ts:z1000Code():L93` | ⚠ | 차등수가 제외 분기 없음 |
| CH02 §3-1 | Z2000 조제기본료 소아/야간/공휴/토요 | `dispensing-fee.ts:z2000Code():L98` | ⚠ | 소아심야(Z2000640) 미처리 |
| CH02 §3-1 | Z3000 복약지도료 야간/공휴/토요 | `dispensing-fee.ts:z3000Code():L111` | ⚠ | 심야(Z3000040) 미처리 |
| CH02 §3-1 | Z5000/Z5001/Z5011 의약품관리료 분기 | `dispensing-fee.ts:z5000Code():L164` | ✗ | Z5001/Z5011 분기 없음 (처방조제 경로) |
| CH02 §3-1 | Z7001 야간조제관리료 | `modules/modes/counseling.ts:calcCounseling()` | ✓ | 달빛어린이약국 분기 존재 |
| CH02 §3-2 | Z4101~Z4115 처방내복조제료 1~15일 | `dispensing-fee.ts:z4InternalCode():L124` | ✓ | |
| CH02 §3-2 | Z4316~Z4391 처방내복조제료 16일+ | `dispensing-fee.ts:calcDispensingFee():L280` (repo 조회) | ✓ | presc_dosage_fee 테이블 조회 |
| CH02 §3-2 | Z4120 외용약 단독 처방조제 | `dispensing-fee.ts:z4ExternalCode():L149` | ✓ | |
| CH02 §3-2 | Z4121 내외용 동시 처방조제 | `dispensing-fee.ts:z4BothCode():L155` | ✓ | |
| CH02 §3-2 | Z4130 주사단독 처방조제 (2021.11.01~) | — | ✗ | 주사단독 시 Z4130 미산정, Z5000만 반환 |
| CH02 §3-3 | Z4200/Z4201/Z4220/Z4221 직접조제 코드 | `modules/modes/direct-dispensing.ts` | ✓ | |
| CH02 §3-4 | Z5101~Z5391 의약품관리료 25구간 | — | ✗ | 구간 코드 미구현, seed.sql에도 데이터 없음 |
| CH02 §3-5 | ZC001~ZC004 비대면 | `modules/modes/counseling.ts:getNonFaceDispensingCode()` | ✓ | |
| CH02 §3-5 | ZH001~ZH004 코로나19 | — | ✗ | dispensing-fee.ts에 ZH 처리 흐름 없음 |
| CH02 §3-5 | ZE100/ZE010/ZE020 명절 | `modules/surcharges/seasonal.ts` | ⚠ | ZE101/ZE102(2025추석) seed.sql 누락 |
| CH02 §4-1 | text="6" Z2000 소아 | `dispensing-fee.ts:z2000Code():L98` | ✓ | holidayGb='6'→Z2000600 |
| CH02 §4-1 | text="1" Z41xx 가루약 | `modules/surcharges/powder.ts` | ✓ | |
| CH02 §4-1 | text="1" Z1000 차등수가 제외 | — | ✗ | z1000Code() 항상 'Z1000' 반환 |
| CH02 §4-2 | Z20 심야+6세미만 = text2="4" | `surcharge.ts:determineSurcharge():L153` | ✗ | holidayGb='8' 반환하나 Z2000640 아닌 Z2000610 생성 |
| CH02 §4-2 | Z41 심야+6세미만 = text2="2" | `surcharge.ts` | ✗ | holidayGb 체계에 '2'(심야) 미정의. 소아심야 시 야간 코드만 생성 |
| CH02 §4-3 | text3 차등수가 "0"/"1" | — | ✗ | text3 처리 로직 전무 |
| CH02 §5-1 | GetInJojeSugaCD 25구간 | `dispensing-fee.ts:z4InternalCode():L124` + repo 조회 | ✓ | |
| CH02 §5-3 | GetMedMgmtSugaCD Z5xxx 25구간 | — | ✗ | 미구현 |
| CH02 §5-4 | 조제일수 산정 규칙 (비급여=1일 강제 등) | `dispensing-fee.ts:classifyDrugs():L51` | ⚠ | 팩수량>1 1일 강제 처리 불분명 |
| CH02 §6 | 토요가산 030 별도 행 분리 (2016.09.29~) | `modules/surcharges/saturday-split.ts` | ✓ | |
| CH02 §6-3 | Z4130 토요가산 Z4130030 | — | ✗ | Z4130 자체가 미구현 |
| CH02 §7 | 산제 2023.11.01 전후 분기 | `dispensing-fee.ts:L260`, `modules/surcharges/powder.ts` | ✓ | |
| CH02 §9-2 | Holiday_gb 6종 (0/1/2/3/4/5) | `surcharge.ts:determineSurcharge()` | ⚠ | holidayGb '2'(심야) 미정의, '4'/'5' 공휴 매핑 확인 필요 |
| CH02 §9-4 | Z20 vs Z41 심야 접미사 차이 | `surcharge.ts` | ✗ | 동일 holidayGb='8'을 양쪽에 적용하여 코드 종류별 분기 없음 |

---

## 4. 누락 항목 (Missing)

- [🔴 Critical] **Z4130 자가투여주사제 조제료**: 주사제 단독 처방 시 Z4130(기본) + Z4130010/Z4130020/Z4130030/Z4130050(가산) 산정 로직이 dispensing-fee.ts에 전혀 없다. isInjectionOnly 분기에서 Z5000만 반환하고 종료된다. seed.sql에는 Z4130 전 가산 코드가 모두 존재한다. (CH02 §3-2)

- [🔴 Critical] **Z5101~Z5391 의약품관리료 25구간 코드**: GetMedMgmtSugaCD() 의사코드 대응 구현이 없다. dispensing-fee.ts의 `z5000Code()`는 항상 'Z5000' 반환만 한다. CH02 §3-4에서 투약일수별 25구간 코드 분기가 명시되어 있으나, 코드와 seed.sql 데이터가 모두 없다. (CH02 §3-4, §5-3)

- [🔴 Critical] **Z5001/Z5011 분기 (처방조제 경로)**: z5000Code()가 항상 Z5000을 반환한다. CH02 §3-1에서 마약/향정의약품 포함 시 Z5001, 전체 병팩 시 Z5011을 사용해야 한다고 명시하고 있다. direct-dispensing.ts에는 Z5001 분기가 존재(L471)하나 처방조제 경로(dispensing-fee.ts)에는 없다. (CH02 §3-1)

- [🟠 High] **ZH001~ZH004 코로나19 투약관리료**: dispensing-fee.ts 어디에도 ZH 처리 흐름이 없다. seed.sql에는 ZH001~ZH004 4개 코드가 모두 존재한다. 비대면 시 ZH001 미산정, 대면 시 ZH002/ZH003/ZH004 분기가 전무하다. (CH02 §3-5)

- [🟠 High] **Z1000 차등수가 제외 분기 (Z1000100/Z1000001)**: z1000Code()가 항상 'Z1000'을 반환한다. CH02 §4-1에서 text="1"이 차등수가 제외 표시임을 명시하고 있으며 seed.sql에 Z1000001이 존재한다. 차등수가 제외 플래그 입력값(CalcOptions) 자체가 없다. (CH02 §4-1)

- [🟠 High] **text3 차등수가 처리 전무**: CH02 §4-3에서 text3="0"(차등수가 해당) / "1"(비해당) 접미사를 모든 Z코드에 적용해야 한다고 명시하나, 우리 구현에서 text3 처리 로직이 전혀 없다. 야간/공휴 코드(Z2000010 등)가 seed.sql에서 text3=0/1 변형(Z2000011 등)으로 별도 등록되어 있다. (CH02 §4-3)

- [🟡 Medium] **ZE101/ZE102 (2025 추석) seed.sql 누락**: seasonal.ts 코드는 ZE101/ZE102를 정의하고 있으나(L80-83), seed.sql의 2024/2026 연도 데이터에 ZE101/ZE102가 없다. getPrice() 조회 시 단가 0 반환으로 행이 미추가된다. (CH02 §3-5)

---

## 5. 부족 항목 (Insufficient)

- [🔴 Insufficient / Critical] **소아심야 코드 오분류 (Z2000640 vs Z2000610)**: `surcharge.ts:determineSurcharge():L153`에서 소아심야(isMidNight=true, age<6)를 holidayGb='8'로 반환한다. z2000Code()에서 holidayGb='8' → Z2000610(소아야간)을 생성한다. 그러나 CH02 §4-2 및 seed.sql L23에서 소아심야는 Z2000640(2023.11.01~)이어야 한다. 소아야간(Z2000610)과 소아심야(Z2000640)가 동일 holidayGb='8'로 묶여 구분 불가능하다. (`src/lib/calc-engine/surcharge.ts:determineSurcharge():L153`, `dispensing-fee.ts:z2000Code():L103`)

- [🟠 Insufficient / High] **Z3000 심야 코드 미분기**: z3000Code()는 holidayGb='1'/'8' → Z3000010(야간), holidayGb='5'/'7' → Z3000050(공휴) 만 처리한다. seed.sql L29-32에서 Z3000020(심야 ~2023.10.31)과 Z3000040(심야 2023.11.01~)이 별도 존재한다. 일반 심야 조제 시(isNight=false, isMidNight=true, age>=6) 코드가 없다. (`dispensing-fee.ts:z3000Code():L111`)

- [🟠 Insufficient / High] **Z41/Z43 심야 접미사 "020" 미처리**: CH02 §4-2에서 Z41/Z43 계열의 심야는 text2="2" → 접미사 "020"이다. surcharge.ts는 holidayGb '2'(심야 단독) 코드를 정의하지 않는다. 성인 심야 조제 시 내복약에 Z4107020 등 심야 접미사를 붙이지 못한다. seed.sql에 Z4101020~Z4115020, Z4316020 등이 존재한다. (`surcharge.ts:determineSurcharge()`, `dispensing-fee.ts:z4InternalCode():L124`)

- [🟠 Insufficient / High] **신체계 산제 16일+ 구간 코드 오류**: dispensing-fee.ts L266-268에서 usePowderNewCode 시 16일 이상이면 무조건 `Z4116`을 베이스코드로 하드코딩한다. Z4316이 올바른 코드이며 실제 구간(Z4316~Z4391)을 repo에서 조회해야 한다. 가루약 신체계에서 16일 이상 조제 시 잘못된 코드가 생성된다. (`dispensing-fee.ts:calcDispensingFee():L266-268`)

- [🟠 Insufficient / High] **토요가산 Z4121030 처리 일관성**: saturday-split.ts의 `applySaturdaySurchargeRows()` 함수는 Z4121(내외용동시) 코드에 대한 030 행 추가 로직이 없다. z4BothCode()에서 직접 Z4121030을 반환하는 경로와 applySaturdaySurchargeRows()의 030 행 추가 경로가 불일치한다. CH02 §6의 토요가산 모델(기본코드 + 별도 030 행)에 따르면 Z4121도 기본 Z4121 + Z4121030 별도 행으로 분리되어야 한다. (`dispensing-fee.ts:z4BothCode():L155-161`, `saturday-split.ts:applySaturdaySurchargeRows():L123`)

- [🟡 Insufficient / Medium] **Z2000 soaHoliday(소아공휴) 코드 확인**: z2000Code()에서 holidayGb='7'(6세미만+공휴) → Z2000650을 반환한다(L103). 이는 올바르나, seed.sql에 Z2000650(소아공휴가산)이 존재하며 z3000Code()의 holidayGb='7' → Z3000050 매핑과 대칭 여부 검증 필요. (`dispensing-fee.ts:z2000Code():L103`)

- [🟡 Insufficient / Medium] **조제일수 산정 규칙 일부 미처리**: CH02 §5-4에서 팩수량>1인 약품은 투약일수를 1일로 강제해야 한다고 명시하나, classifyDrugs()는 drug.pack 필드를 참조하지 않는다. (`dispensing-fee.ts:classifyDrugs():L51-88`)

- [🟢 Insufficient / Low] **Holiday_gb '4'/'5' 미정의**: CH02 §9-2의 비즈팜 Holiday_gb 체계에서 '4'(공휴주간), '5'(공휴야간)가 정의되어 있다. surcharge.ts는 이를 isHolyDay 단일 플래그로 처리하며 holidayGb는 '5'(공휴)만 사용한다. 공휴 야간 세분화가 누락되어 있으나 실제 수가코드는 동일 Z코드를 사용하므로 실용적 영향은 낮다. (`surcharge.ts:determineSurcharge():L107-127`)

---

## 6. 기타 관찰 사항

- **Z코드 선택과 getSurchargeSuffix() 미활용**: surcharge.ts에 `getSurchargeSuffix()` 함수가 있으나 dispensing-fee.ts는 이를 사용하지 않고 인라인 switch로 접미사를 처리한다. 두 경로가 병존하여 향후 유지보수 시 불일치 위험이 있다.

- **holidays 하드코딩 유효기간**: seasonal.ts의 명절 날짜 테이블은 2024 추석 / 2025 설 / 2025 추석만 정의되어 있다. 2026년 이후 명절 날짜를 추가하지 않으면 명절가산이 미산정된다. (CH02 §3-5)

- **seed.sql Z5xxx 구간 코드 미등록**: Z5011(병팩), Z5101~Z5391 전체가 seed.sql에 없다. 구현 전에 데이터 등록이 선행되어야 한다.

- **Z2000 소아심야 시행일 분기 필요**: seed.sql에서 Z2000620(소아심야 ~2023.10.31)과 Z2000640(소아심야 2023.11.01~)이 구분되어 있다. 구현 시 dosDate 기준 분기가 필요하다. (CH02 §4-2)

- **Z4121 7일↔8일 버그 (CH02 §9-4 불일치 #1)**: 비즈팜에서 Z4121 7일/8일 코드·점수 뒤바뀜 버그가 보고되어 있으나, 우리 구현은 Z4121에 투약일수 입력이 없는 구조(방문당 1회 고정)이므로 해당 버그의 직접 영향은 없다. 다만 Z4121이 투약일수와 무관하게 단일 코드인지 검증이 필요하다.

- **직접조제 Z5001/Z5011 분기**: direct-dispensing.ts L471에서 마약류 포함 시 Z5001 분기가 이미 구현되어 있다. 동일 패턴을 처방조제 경로에도 적용하면 된다.
