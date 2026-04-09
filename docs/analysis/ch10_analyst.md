# CH10 구현 분석 보고서

> 작성자: CH10 Analyst (Phase 2 Team 10A)
> 작성일: 2026-04-06
> 챕터: CH10 — 약제비 계산 파이프라인
> 상태: [ ] 초안 | [ ] 검토 중 | [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 약제비 계산 파이프라인 (10단계 통합 파이프라인)
- **핵심 주제**: 비즈팜 VB6(`Insurance_Calculate`), 유팜 C#(`Base총약제비Logic.CalculateAll`), EDB C#(`PrsBillCalcM.Execute`), 공단 원문PDF 구현명세 4소스를 합의하여 도출한 10단계 순차 처리 파이프라인. 입력(환자·처방·약품·마스터 데이터) → Step 1~10 처리 → 출력(총액1/2, 본인부담금, 청구액, 3자배분 등)의 흐름을 단일 계약으로 정의한다.
- **다루는 계산 로직 범위**:
  - 전체 10단계: 입력 검증·초기화 → 마스터 로드 → 약품 순회 → 투약일수 확정 → 가산 판정 → 수가 산정 → 본인부담금 → 3자배분 → 후처리 → 결과 조립
  - 서식번호 결정 (H024/H124/H025/H125)
  - 시점관리: DueDate 기반 과거 수가 소급 조회
  - 조기종료 조건 6종 (약품 없음, 주사제만, NoWage 등)
  - 관련 법령: 국민건강보험법 요양급여비용 고시, HIRA 전자청구 명세서 고시 (2024 기준)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/index.ts` | 211줄 | `calculate()`, `applyPostProcessing()`, `buildResult()`, `errorResult()` | 파이프라인 진입점 + 결과 조립 |
| `src/lib/calc-engine/drug-amount.ts` | 46줄 | `calcDrugAmount()`, `calcDrugAmountSum()` | Step 3 약품 금액 계산 |
| `src/lib/calc-engine/dispensing-fee.ts` | 360줄 | `calcDispensingFee()`, `classifyDrugs()`, `buildSurcharge()`, z코드 선택 함수들 | Step 4~6 투약일수·가산·수가 |
| `src/lib/calc-engine/surcharge.ts` | 289줄 | `determineSurcharge()`, `getSurchargeSuffix()`, `getSaturdayAddCodes()` | Step 5 가산 판정 |
| `src/lib/calc-engine/copayment.ts` | 238줄 | `calcCopayment()`, `_determineEffectiveRate()`, `_resultToCopay()` | Step 7 본인부담금 |
| `src/lib/calc-engine/rounding.ts` | 52줄 | `round1()`, `trunc10()`, `trunc100()`, `round10()`, `roundToInt()` | 전 단계 공통 반올림 |
| `src/lib/calc-engine/types.ts` | 285줄 | `CalcOptions`, `CalcResult`, `DrugItem`, `InsuRate`, `ICalcRepository` 등 | 데이터 계약 |
| `src/lib/calc-engine/supabase-repo.ts` | 93줄 | `SupabaseCalcRepository` — `getSugaFeeMap()`, `getPrescDosageFee()`, `getInsuRate()` | Step 2 마스터 로드 (DB 구현체) |
| `src/lib/calc-engine/modules/special/drug-648.ts` | 232줄 | `process648Special()`, `apply648DayLimit()`, `sum648DrugAmount()`, `calcDrug648Surcharge()` | Step 0 + Step 9 특수약품 |
| `src/lib/calc-engine/modules/special/safety-net.ts` | 229줄 | `applySafetyNet()`, `calcSafetyNetOverage()`, `calcSafetyNet()` | Step 9 본인부담상한제 |
| `src/app/api/calculate/route.ts` | 50줄 | `POST()` | HTTP 진입점, dosDate 자동 설정 |

### 미구현 영역

- `서식번호 결정 (H024/H124/H025/H125)` — CH10 §Step1 참조. `CalcOptions` 또는 `CalcResult`에 서식번호 필드가 없고, 결정 로직이 코드베이스 어디에도 존재하지 않음.
- `요양급여비용총액2 필드` — CH10 §Step8·§Step10 참조. `CalcResult`에 `totalPrice2` 또는 `total_amount_2` 필드가 없음. `trunc10(총액1 + U항)` 계산 불가.
- `U항(100/100 본인부담) 독립 집계 및 trunc10` — CH10 §Step8-1 참조. `section_totals[U항]` 합산 후 `trunc10` 처리하는 모듈 없음.
- `선별급여 A/B/D/E항 독립 계산` — CH10 §Step8-3 참조. A항×50%, B항×80%, D항×30%, E항×90% 개별 산출 후 합산 절사하는 모듈 없음.
- `장려금(사용장려금·대체조제장려금)` — CH10 §Step7-3·§Step10 참조. `incentiveSum` 필드가 `CalcOptions`에 있으나, 본인부담 기준액에서 차감하는 로직이 `calcCopayment()`에 구현되지 않음.
- `본인부담 기준액 장려금 차감 처리` — CH10 §Step7-3. `본인부담_기준액 = 총액1 - incentive_total` 분기 없음.
- `의료급여 특수 리셋 (Step 9-1)` — CH10 §Step9 참조. 의료급여 + 특정 조건 시 조제료 0 리셋 후 재계산 로직 없음 (의료급여 본인부담 계산은 `medical-aid.ts`에 위임되나, 조제료 리셋 자체는 없음).
- `차등수가 처리 (Step 9-7)` — CH10 §Step9-7 참조. 1일 평균 조제횟수 기반 차등지수 산출 및 차등수가청구액 계산 모듈 없음.
- `환자실부담 합계 출력 (Step 10-4)` — CH10 §Step10-4 참조. `CalcResult`에 `sumUser`(최종 환자수납액) 필드는 있으나 산출 로직 없음.
- `조제투약내역 줄 목록 생성 (Step 10-2)` — CH10 §Step10-2 참조. 항번호·목번호·줄번호·코드구분 등 전자청구 명세서 줄 포맷 생성 기능 없음.
- `특정내역 생성 (Step 10-3)` — CH10 §Step10-3 참조. JS002, CT002, MT008, MT018, JT006, JT019 등 특정내역 코드 생성 모듈 없음.

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §             | 요구사항 요약                                                        | 우리 구현 위치                                                                   | 상태 | 비고 |
|-------------------|--------------------------------------------------------------------|-------------------------------------------------------------------------------------|------|------|
| CH10 §Step1-1     | 모든 금액 변수·플래그 초기화                                          | `index.ts:calculate():L38` (try 블록 진입 즉시 암묵적 초기화)                        | ✓    | 별도 Clear 함수 없이 로컬 변수로 초기화 |
| CH10 §Step1-2     | 약품 목록 비어있으면 조기종료                                          | `index.ts:calculate():L42-44`                                                       | ✓    | `drugList.length === 0` → errorResult |
| CH10 §Step1-2     | 보험코드 유효값 확인                                                 | `index.ts:calculate():L46-48`                                                       | ✓    | `!opt.insuCode` → errorResult |
| CH10 §Step1-2     | dosDate 형식 검증 (yyyyMMdd)                                        | `index.ts:calculate():L38-40`                                                       | ✓    | `length < 8` 검사 |
| CH10 §Step1-2     | 서식번호 결정 (처방조제/직접조제 × 건강보험/의료급여 → H024/H124/H025/H125) | 미구현                                                                              | ✗    | CH10 §Step1 필수 출력. 아래 §4 참조 |
| CH10 §Step1-3     | 야간/공휴/소아/토요/가루약 플래그 설정                                  | `CalcOptions` 입력 필드로 수신 (`index.ts`, `types.ts:L92-103`)                      | ✓    | 플래그 설정은 호출자 책임으로 분리 |
| CH10 §Step2-1     | 조제일자 기준 수가 마스터 로드 (DueDate 기반)                           | `dispensing-fee.ts:calcDispensingFee():L179` (year 추출 → `getSugaFeeMap(year)`)     | ⚠    | year 단위로만 조회. DueDate(월·일) 세밀도 미지원 |
| CH10 §Step2-2     | 보험료율 로드                                                        | `index.ts:calculate():L65` (`repo.getInsuRate(opt.insuCode)`)                       | ✓    | `supabase-repo.ts:getInsuRate():L70` |
| CH10 §Step2-3     | 약품 마스터 참조 (상한금액, 퇴장방지, 보험등재)                          | 미구현 (DB 조회 없음)                                                                | ✗    | `DrugItem.price`를 입력값 그대로 사용. 상한금액 초과 방지 로직 없음 |
| CH10 §Step2-4     | 산정특례 마스터 참조 (CT002 코드별 부담률)                              | `index.ts:calculate():L68-71` (`repo.getMediIllnessInfo()` 옵션 호출)                | ⚠    | `getMediIllnessInfo` 구현이 `supabase-repo.ts`에 없음 (선택적 메서드) |
| CH10 §Step3-1     | 약품코드 빈값·PD_EXTYPE 1,9 skip                                    | `drug-amount.ts:calcDrugAmountSum():L35-44`                                         | ⚠    | 빈 코드·EXTYPE 필터 없음. `insuPay` 기반 분류만 존재 |
| CH10 §Step3-2     | 단가 = min(실구입가, 상한금액), 최소 1원, 원미만 4사5입                  | `drug-amount.ts:calcDrugAmount():L18-22`                                            | ⚠    | 상한금액 비교 없음. 단가는 입력값 그대로 사용 |
| CH10 §Step3-3     | 금액 = 단가 × 1회투약량 × 1일투여횟수 × 총투약일수, 원미만 4사5입          | `drug-amount.ts:calcDrugAmount():L19-22`                                            | ✓    | `Math.floor(amount * price + 0.5)` |
| CH10 §Step3-4     | 본인부담률구분코드 기준 항 분류 (A/B/D/E/U/V/W/빈값)                    | `drug-amount.ts:calcDrugAmountSum():L37-43`                                         | ⚠    | `nonCovered` → sumUser, 나머지 → sumInsu로 2분류만 존재. A/B/D/E/U/V/W 7항 분리 없음 |
| CH10 §Step3-5     | 01/02/03목 분류 (내복/외용/주사)                                      | `dispensing-fee.ts:classifyDrugs():L51-88`                                          | ✓    | `take` 필드 기반 분류 |
| CH10 §Step3-6     | 항별·목별 합계 누적                                                  | 미구현 (`section_totals{항}{목}` 구조 없음)                                          | ✗    | `sumInsu`/`sumUser` 2필드로 단순화됨 |
| CH10 §Step3-7     | 내복/외용/비급여 최대 투약일수 추적                                     | `dispensing-fee.ts:classifyDrugs():L72-83`                                          | ✓    | `maxInternalDay`, `maxExternalDay` |
| CH10 §Step3-8     | 퇴장방지·대체조제 장려금 마킹, 코로나19 급여 강제                         | 미구현                                                                              | ✗    | CH10 §Step3-8 |
| CH10 §Step4-1     | 급여 내복/외용/주사 조제일수 확정 (팩·병단위 특수처리)                     | `dispensing-fee.ts:classifyDrugs():L72-88`                                          | ⚠    | 팩단위(dDay=1 고정) 처리 없음 |
| CH10 §Step4-4     | 648903860 MAX 5일 제한                                              | `index.ts:calculate():L50-55` (`process648Special()`)                               | ✓    | `drug-648.ts:apply648DayLimit():L97-104` |
| CH10 §Step4-5     | 유효 약품 0개 → 조기종료                                              | `index.ts:calculate():L42-44`                                                       | ✓    | Step 1에서 선처리 |
| CH10 §Step4-5     | 주사약만 + 자가투여=false → 조제료 미산정                               | `dispensing-fee.ts:calcDispensingFee():L239-246`                                    | ✓    | isInjectionOnly 분기, Z5000만 산정 |
| CH10 §Step5-1     | Holiday_gb 코드 체계 (N/0/1/5/6/7/8) 결정                           | `surcharge.ts:determineSurcharge():L77-198`                                         | ✓    | holidayGb 7값 완전 구현 |
| CH10 §Step5-2     | 가산 우선순위: 가루약>야간/공휴>소아심야>토요, 비대면 시 전부 비활성         | `surcharge.ts:determineSurcharge():L82-198`                                         | ✓    | 우선순위 체인 정확히 구현 |
| CH10 §Step5-3     | Z코드별 가산 맵 결정                                                  | `surcharge.ts:getSurchargeSuffix():L207-255`                                        | ✓    | Z2000/Z3000/Z41xx/Z4120/Z4121 별 접미사 |
| CH10 §Step6-1     | 처방조제/직접조제별 Z코드 자동 결정 (내복/외용/주사 조합)                   | `dispensing-fee.ts:calcDispensingFee():L248-315`                                    | ✓    | 처방조제 분기 구현. 직접조제는 `direct-dispensing.ts` 위임 |
| CH10 §Step6-2     | Z1000/Z2000/Z3000/Z5000/Z7001 기본 조제료 산정                        | `dispensing-fee.ts:calcDispensingFee():L249-319`                                    | ⚠    | Z7001 야간조제관리료 미산정 (복약상담 ZC계열과 혼재 가능성) |
| CH10 §Step6-3     | Z41xx 내복약 조제료 (1~15일/16일+ 차등), 외용·주사 조제료               | `dispensing-fee.ts:z4InternalCode():L124-146` + `getPrescDosageFee()` 테이블 조회    | ✓    | 1~15일 직접, 16일+ DB 조회 |
| CH10 §Step6-4     | 가산 적용 후 라운딩 `Math.Round(값, 2, AwayFromZero)`                  | `dispensing-fee.ts:addWage():L211-224`                                              | ⚠    | `price * cnt` 그대로 합산. AwayFromZero 소수점 2자리 라운딩 없음 |
| CH10 §Step7-1     | 요양급여비용총액1 = trunc10(01항+02항)                                  | `copayment.ts:calcCopayment():L60`                                                  | ✓    | `trunc10(sumInsuDrug + sumWage)` |
| CH10 §Step7-2     | 본인부담율 결정 (공상/차상위/긴급복지/보훈/특례/65세이상/6세미만/일반)      | `copayment.ts:calcCopayment():L68-192`                                              | ⚠    | 공상(`gongsang_code`), 차상위, 긴급복지, 직접조제 정액 분기 없음. 아래 §5 참조 |
| CH10 §Step7-3     | 장려금 제외: 본인부담_기준액 = 총액1 - incentive_total                   | 미구현                                                                              | ✗    | `calcCopayment()` 내 incentive 차감 없음 |
| CH10 §Step7-4     | 정률: trunc100 / 의료급여: trunc10                                     | `copayment.ts:calcCopayment():L146,156,175`                                         | ✓    | C계열 trunc100, D계열은 `medical-aid.ts` 내 trunc10 |
| CH10 §Step7-5     | 청구액 = 총액1 - 본인부담 (음수 시 0)                                   | `copayment.ts:calcCopayment():L184`                                                 | ⚠    | 음수 처리 없음 (`pubPrice = totalPrice - userPrice`만 있음) |
| CH10 §Step8-1     | 100/100 본인부담금총액 = trunc10(U항 합계)                              | 미구현                                                                              | ✗    | U항 분리 집계 없음 |
| CH10 §Step8-2     | 요양급여비용총액2 = trunc10(총액1 + U항 합계)                           | 미구현                                                                              | ✗    | `CalcResult.totalPrice2` 필드 없음 |
| CH10 §Step8-3     | 선별급여 A/B/D/E항 독립 계산 (항별 부담률 × 합계, 합산 후 1회 절사)       | 미구현                                                                              | ✗    | A/B/D/E항 분리 집계 없음 |
| CH10 §Step8-4     | 보훈 3자배분 (감면율, 청구액, 본인부담금 분리)                            | `copayment.ts:calcCopayment():L85-94` → `veteran.ts:calcVeteran()`                  | ✓    | G계열 + M코드 분기, `mpvaPrice`/`insuPrice` 반환 |
| CH10 §Step8-5     | 비급여 금액 합산 (W항 + 비급여 조제료)                                   | 미구현                                                                              | ✗    | `sumUser`는 있으나 비급여 조제료와 합산 안 됨 |
| CH10 §Step8-6     | 급여제한/비보험 단독 재계산 (청구액=0)                                   | 미구현                                                                              | ✗    | CH10 §Step8-6 |
| CH10 §Step9-1     | 의료급여 조제료 리셋 + 재계산                                           | 미구현                                                                              | ✗    | `calcMedicalAid()`는 본인부담금 처리만 담당 |
| CH10 §Step9-2     | 코로나19 가산 처리 (코로나확진대면/확진 관리료)                           | 미구현                                                                              | ✗    | CH10 §Step9-2 |
| CH10 §Step9-3     | 조제지원금 반영 (추석 등)                                              | 미구현                                                                              | ✗    | seasonal.ts는 명절가산이고, 조제지원금은 별도 |
| CH10 §Step9-4     | 희귀질환/긴급복지 지원금 처리 (본인부담 200만원 한도 차감)                  | 미구현                                                                              | ✗    | CH10 §Step9-4 |
| CH10 §Step9-5     | 비보험 조제료 별도 산정 (chkBiboPres)                                   | 미구현                                                                              | ✗    | CH10 §Step9-5 |
| CH10 §Step9-7     | 차등수가 처리                                                         | 미구현                                                                              | ✗    | CH10 §Step9-7 |
| CH10 §Step9-8     | 본인부담상한제 초과 처리                                               | `index.ts:applyPostProcessing():L152-157` → `safety-net.ts:applySafetyNet()`        | ✓    | `yearlyAccumulated` + `incomeDecile` 제공 시 적용 |
| CH10 §Step10-1    | 필수 출력 필드 (총액1/2, 본인부담, 청구액, U항, 선별급여, 보훈, 지원금 등) | `index.ts:buildResult():L160-196`                                                   | ⚠    | 총액2, U항, 선별급여, 지원금, 상한초과금 없음 |
| CH10 §Step10-2    | 조제투약내역 줄 목록 생성 (전자청구 포맷)                                | 미구현                                                                              | ✗    | wageList는 조제료 항목만, 약품줄 없음 |
| CH10 §Step10-3    | 특정내역 (JS002/CT002/MT008 등) 생성                                  | 미구현                                                                              | ✗    | CH10 §Step10-3 |
| CH10 §Step10-4    | 환자실부담 합계 (본인부담+U항+선별급여+비급여-지원금)                      | 미구현                                                                              | ✗    | `CalcResult.sumUser` 필드 있으나 산출 없음 |
| CH10 §3-1         | 시점관리: 조제일자 기준 과거 수가/로직 소급                               | `dispensing-fee.ts:calcDispensingFee():L179` (year 기준), `drug-648.ts:L33` (날짜 상수) | ⚠    | year 단위만 소급. 월·일 단위 DueDate 조회 미지원 |
| CH10 §3-2         | DueDate 기반 수가 버전 관리 (MAX(DueDate) <= 조제일자)                  | `supabase-repo.ts:getSugaFeeMap():L18-37`                                           | ⚠    | `apply_year` 연단위 조회. DueDate MAX쿼리 미구현 |
| CH10 §6-1         | 조기종료: 약품 없음                                                    | `index.ts:calculate():L42-44`                                                       | ✓    | errorResult 반환 |
| CH10 §6-2         | 조기종료: 주사제만 + 비자가투여                                          | `dispensing-fee.ts:calcDispensingFee():L239-246`                                    | ✓    | Z5000만 산정 후 반환 |
| CH10 §6-3         | 조기종료: NoWage (수가 마스터 로드 실패)                                 | `dispensing-fee.ts:calcDispensingFee():L201` (빈 Map 반환 → 가격 0)                  | ⚠    | 로드 실패 시 오류 반환이 아닌 0원 처리로 silent 통과 |
| CH10 §6-4         | 조기종료: 의료급여 특수 리셋                                            | 미구현                                                                              | ✗    | CH10 §6-4 |
| CH10 §6-5         | 조기종료: 급여제한/비보험 단독                                          | 미구현                                                                              | ✗    | CH10 §6-5 |

---

## 4. 누락 항목 (Missing)

- [🔴 Missing / Critical] **항별 분리 집계 (A/B/D/E/U/V/W항)**: `calcDrugAmountSum()`은 급여/비급여 2분류만 반환. 선별급여(A/B/D/E), U항(100/100), V항(보훈 100/100), W항(비급여)을 항별로 분리 집계하는 `section_totals` 구조가 전혀 없음. 이로 인해 총액2, 선별급여 독립 계산, U항 본인부담금 전부 불가. (`src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum()`, CH10 §Step3-4 / §Step8)

- [🔴 Missing / Critical] **서식번호 결정 (H024/H124/H025/H125)**: 처방조제 여부(`isDirectDispensing`) × 보험유형(`insuCode` C/D계열)으로 서식번호를 결정하는 로직이 없음. `CalcOptions`에 입력 필드도, `CalcResult`에 출력 필드도 없음. (CH10 §Step1-2)

- [🔴 Missing / Critical] **요양급여비용총액2**: `totalPrice2 = trunc10(총액1 + U항)` 계산 및 `CalcResult` 필드 없음. 전자청구 필수 항목. (CH10 §Step8-2 / §Step10-1)

- [🔴 Missing / Critical] **선별급여(A/B/D/E항) 독립 계산**: A항×50%, B항×80%, D항×30%, E항×90% 각각 산출 후 합산 trunc10하는 `under100_copay`, `under100_total`, `under100_claim` 계산 및 필드 없음. (CH10 §Step8-3)

- [🔴 Missing / Critical] **약품 단가 상한금액 검증**: `calcDrugAmount()`는 입력 `price`를 그대로 사용하며 약품별 상한금액 조회·비교를 수행하지 않음. Step 2에서 약품 마스터(`drug_ceiling_prices`) 로드 기능도 없음. (CH10 §Step2-3 / §Step3-2)

- [🟠 Missing / High] **장려금 본인부담 기준액 차감**: `총액1 - incentive_total`이 본인부담 기준액이어야 하나, `calcCopayment()`는 `totalPrice` 그대로 본인부담율 적용. (CH10 §Step7-3)

- [🟠 Missing / High] **공상등구분 코드 기반 분기 (Step 7-2)**: `gongsang_code` 필드가 `CalcOptions`에 없으며, 공상(1→0%), 차상위1종(C/H→0%), 차상위2종(E/F→500원 정액), 긴급복지(G→500원 정액) 분기 없음. (CH10 §Step7-2)

- [🟠 Missing / High] **직접조제 정액 분기**: 총액1 ≤ 4,000원 시 정액표 조회, >4,000원 시 40% 적용 분기. `direct-dispensing.ts`는 조제료 Z42xx 계산을 담당하나, 본인부담금 정액/정률 전환 로직이 `calcCopayment()`에 없음. (CH10 §Step7-2)

- [🟠 Missing / High] **비급여 합계 (W항 + 비급여 조제료)**: `sumUser`는 비급여 약가만. 비급여 조제료를 합산한 `npay_total` 필드 없음. (CH10 §Step8-5)

- [🟠 Missing / High] **희귀질환/긴급복지 지원금 처리**: 본인부담금 200만원 한도 차감 및 `support_amount` 출력 필드 없음. (CH10 §Step9-4)

- [🟡 Missing / Medium] **코로나19 가산 처리**: 코로나확진 관련 관리료 가산 없음. (CH10 §Step9-2)

- [🟡 Missing / Medium] **비보험 조제료 별도 산정 (chkBiboPres)**: 비보험 약품 전용 조제료 재계산 없음. (CH10 §Step9-5)

- [🟡 Missing / Medium] **조제투약내역 줄 목록 (Step 10-2)**: 전자청구용 약품별 줄 포맷 생성 없음. `wageList`는 조제료 수가 항목 목록이며, 약품 명세 줄이 아님. (CH10 §Step10-2)

- [🟡 Missing / Medium] **특정내역 코드 생성 (Step 10-3)**: JS002, CT002, MT008, MT018, JT006, JT019 없음. (CH10 §Step10-3)

- [🟢 Missing / Low] **차등수가 처리 (Step 9-7)**: 1일 평균 조제횟수 기반 차등지수 산출 없음. (CH10 §Step9-7)

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] **DueDate 세밀도 미흡**: `getSugaFeeMap(year)`는 연도 단위로만 수가표를 조회하여 같은 해 중간 고시 변경(월·일 단위)을 반영 불가. CH10 §3-2 규격은 `MAX(DueDate) <= 조제일자` 패턴 요구. (`src/lib/calc-engine/supabase-repo.ts:getSugaFeeMap():L18`)

- [🟠 Insufficient / High] **조제료 가산 후 라운딩 미흡**: CH10 §Step6-4에서 가산 적용 후 `Math.Round(값, 2, AwayFromZero)` 요구. `dispensing-fee.ts:addWage()`는 `price * cnt` 정수 합산만 수행하며 소수점 처리 없음. (`src/lib/calc-engine/dispensing-fee.ts:addWage():L211-224`)

- [🟠 Insufficient / High] **청구액 음수 미처리**: CH10 §Step7-5에서 `청구액 < 0 → 0`이 명시되어 있으나, `copayment.ts:calcCopayment():L184`에서 음수 체크 없음. (`src/lib/calc-engine/copayment.ts:L184`)

- [🟡 Insufficient / Medium] **수가 마스터 로드 실패 처리 미흡**: `supabase-repo.ts:getSugaFeeMap()`는 오류 시 빈 Map 반환. `dispensing-fee.ts`에서 빈 Map을 받으면 모든 수가가 0원으로 처리되어 silent 오류 발생. CH10 §6-3(NoWage)은 오류 반환을 요구. (`src/lib/calc-engine/dispensing-fee.ts:getPrice():L203-205`)

- [🟡 Insufficient / Medium] **팩단위 투약일수 보정 미구현**: CH10 §Step4-1에서 팩단위 약품은 투약일수 1로 고정해야 하나, `classifyDrugs()`는 `Math.floor(drug.dDay)` 그대로 사용. (`src/lib/calc-engine/dispensing-fee.ts:classifyDrugs():L74`)

- [🟡 Insufficient / Medium] **PD_EXTYPE 1,9 필터 없음**: CH10 §Step3-1에서 PD_EXTYPE=1,9 약품은 skip해야 하나, `DrugItem` 타입에 `exType` 필드가 없고 필터 로직 없음. (`src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum()`)

- [🟡 Insufficient / Medium] **산정특례 마스터 DB 조회 미구현**: `ICalcRepository.getMediIllnessInfo()`가 인터페이스에는 있으나, `SupabaseCalcRepository`에 구현 없음. 산정특례는 항상 `CalcOptions.mediIllnessInfo` 직접 전달에 의존. (`src/lib/calc-engine/supabase-repo.ts`)

- [🟢 Insufficient / Low] **route.ts dosDate 자동 설정 시 시간대**: `route.ts:POST():L21`에서 `new Date().toISOString()`은 UTC 기준. 한국 시간(KST=UTC+9)에서 자정 전후 날짜가 틀릴 수 있음. (`src/app/api/calculate/route.ts:L21-22`)

---

## 6. 기타 관찰 사항

- **파이프라인 구조 단순화**: 우리 구현은 CH10 §2 통합 파이프라인의 10단계 중 핵심 계산 흐름(Step 1~2 일부, Step 4~7, Step 9-8, Step 10 일부)만 구현되어 있다. 현재 상태는 건강보험(C10) 단순 처방조제 케이스를 교육 목적으로 시연 가능한 수준이며, 전자청구 명세서 생성을 위한 완전한 파이프라인으로는 미완성이다.

- **항별 분리 집계가 핵심 선행조건**: §4에 기재한 🔴 Critical 누락 중 "항별 분리 집계(A/B/D/E/U/V/W)"는 총액2, 선별급여 독립 계산, 비급여 합산 등 5개 이상의 다른 누락 항목의 공통 선행조건이다. 이 구조가 구현되어야 하위 Step들의 구현이 가능하다.

- **`index.ts`와 CH10 파이프라인의 단계 번호 불일치**: `index.ts` 주석 헤더는 "Step 0~6"의 6단계 구조로 표기되나, CH10 규격은 "Step 1~10"의 10단계. 양측 Step 번호가 1:1로 대응되지 않으므로 향후 유지보수 시 혼란 가능성이 있다. (예: `index.ts` Step 1 = 약품금액 계산 ↔ CH10 Step 3)

- **`CalcOptions`의 입력 범위와 CH10 §Step1 불일치**: `CalcOptions`에는 `isDirectDispensing`, `bohunCode`, `sbrdnType` 등 보험유형별 확장 필드가 있으나, CH10 §Step1에서 요구하는 `gongsang_code`(공상등구분), `ct002_code`(특정기호), `issuing_hospital_grade`(처방발급기관 종별) 필드가 없다. 공상 0% 처리, 발급기관 종별 조제료 차등 등에 영향.

- **CH10 §3-2 DueDate 설계 vs 현재 DB 스키마 불일치**: CH10 §3-2는 `suga_fee` 테이블에 `DueDate(적용시작일)` 컬럼을 요구하나, `supabase-repo.ts`는 `apply_year` 연도 컬럼만 사용. DB 스키마 변경이 필요하다.

- **`errorResult()` 반환 vs 예외 전파**: `index.ts:calculate()`는 모든 오류를 `errorResult()` 객체로 감싸 반환(HTTP 200 + `error` 필드). CH10 §6-3(NoWage) 등 일부 조기종료는 HTTP 400/500 에러 코드가 더 적합할 수 있으나, 현재 route.ts는 `result.error` 유무로만 400 분기.

- **의존성 체인**: Step 3(항별 분리) → Step 7(장려금 차감) → Step 8(총액2/선별급여/3자배분) → Step 10(출력 필드) 순서로 구현 블로커가 연쇄되어 있다. 리팩터링 우선순위는 이 체인 순서를 따라야 한다.
