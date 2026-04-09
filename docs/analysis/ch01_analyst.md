# CH01 구현 분석 보고서

> 작성자: CH01 Analyst (Phase 2 Team 1A)
> 작성일: 2026-04-06
> 챕터: CH01 — 약품금액 계산
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 약품금액 계산
- **핵심 주제**: 처방전 1줄 단위로 약품 금액(단가 × 소모량, 원미만 4사5입)을 결정하는 로직. 단가 결정(보험등재 상태·DB 조회), 팩수량 처리, 급여구분별 항번호 분류, 저가대체장려금·사용장려금 산출, 특수 약품(648903860) 처리까지를 범위로 한다.
- **다루는 계산 로직 범위**:
  - 기본 공식: `(int)(소모량 × 단가 + 0.5)` (4사5입)
  - 1회투약량(소수4자리), 1일투여횟수(소수2자리) 정밀도 전처리
  - 팩수량(pack) 처리 3가지 방법
  - 단가 결정 3중 분기 (PPREVALU → PDRUDRUG → 약품평균가)
  - Del_Yn 코드 7종 + 보험유형별 단가 선택
  - 급여구분 분류 (01항 / A / B / D / E / U / W)
  - 내복·외용·주사 목번호 분류
  - 저가대체조제장려금 (차액×30%, 2020.03.01 이후)
  - 퇴장방지의약품 사용장려금 (상한금액×10%, 직접조제)
  - 코로나19 치료제 648903860: 투약일수 5일 제한 + 2024.10.25 이후 5% 가산
  - EXTYPE "1"/"9" 필터링 (2020.03.01 기점)
  - 할증률 적용 (자보/비보험)
  - 관련 법령: 건강보험 요양급여비용 고시 (2024-07-01), HIRA 청구 지침

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/drug-amount.ts` | 45줄 | `calcDrugAmount()`, `calcDrugAmountSum()` | CH01 핵심 구현 |
| `src/lib/calc-engine/rounding.ts` | 51줄 | `round1()`, `roundToInt()` | 반올림 공통 유틸리티 |
| `src/lib/calc-engine/modules/special/drug-648.ts` | 231줄 | `apply648DayLimit()`, `sum648DrugAmount()`, `calc648Surcharge()`, `process648Special()`, `calcDrug648Surcharge()`, `has648Drug()` | 특수약품 648903860 전용 모듈 |
| `src/lib/calc-engine/types.ts` | 284줄 | `DrugItem`, `InsuPayType`, `TakeType` | 타입 정의 |
| `src/lib/calc-engine/index.ts` | 210줄 | `calculate()` (Step 0, Step 1, Step 5) | 파이프라인 진입점 |

### 미구현 영역

- `단가 결정 로직 (Del_Yn 분기)` — CH01 §3-1, §3-2, §3-3: DrugItem.price가 이미 결정된 값으로 전달되어 DB 조회·Del_Yn 분기가 calc-engine 내부에 존재하지 않음
- `저가대체조제장려금 계산` — CH01 §6-1: calc-engine에 관련 함수 없음
- `퇴장방지의약품 사용장려금 계산` — CH01 §6-2: calc-engine에 관련 함수 없음
- `1회투약량/1일투여횟수 소수점 전처리(정밀도 정규화)` — CH01 §2-2: 호출 전 정규화 없이 raw 값 그대로 사용
- `EXTYPE "1"/"9" 필터링` — CH01 §7-4: DrugItem에 exType 필드 없음
- `코로나19 치료제 3종 (648903670, 655502130) 처리` — CH01 §7-1: 648903860 외 2종에 대한 개별 처리 없음
- `할증률 적용` — CH01 §7-3: DrugItem에 할증률 필드 없음, calcDrugAmount 내 할증 로직 없음
- `약품평균가(PDRUVALU) 단가 우선적용` — CH01 §3-1 [4단계]: 구현 없음

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 § | 요구사항 요약 | 우리 구현 위치 | 상태 | 비고 |
|--------|-------------|--------------|------|------|
| CH01 §2-1 | 기본 공식: `(int)(소모량 × 단가 + 0.5)` | `src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L19-L21` | ✓ | `Math.floor(amount * price + 0.5)` — EDB 방식과 동일 |
| CH01 §2-2 | 1회투약량 소수4자리, 1일투여횟수 소수2자리 전처리 | — | ✗ | 입력 raw 값을 그대로 사용; 정규화 없음 |
| CH01 §2-3 | 팩수량(pack) 처리 — 소모량 나누기 방식 | `src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L18-L19` | ✓ | `pack > 1`이면 소모량 나누기 (EDB 방법 2 채택) |
| CH01 §2-3 | 팩수량 0 나누기 방지 (0이면 1로 치환) | `src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L18` | ✓ | `pack > 1` 조건으로 사실상 0 나누기 방지 |
| CH01 §2-4 | 반올림: 4사5입(AwayFromZero) | `src/lib/calc-engine/rounding.ts:roundToInt():L49-L51` | ✓ | `Math.floor(v + 0.5)` — 양수에서 AwayFromZero와 동일 |
| CH01 §2-4 | 단가 최소값 1원 | — | ✗ | `calcDrugAmount()` 내 최소 단가 1원 보정 없음 |
| CH01 §3-1 | 단가 결정 3중 분기 (PPREVALU → PDRUDRUG → 평균가) | — | ✗ | DrugItem.price가 외부에서 전달됨; calc-engine 내부에 DB 조회 없음 |
| CH01 §3-3 | Del_Yn 코드 7종 분기 (None/M/G/P/A/B/C/F) | — | ✗ | DrugItem에 delYn 필드 없음 |
| CH01 §3-4 | 비급여 약품 단가 (ilban_amt 우선) | — | ✗ | 단가 결정 로직 자체가 calc-engine 밖에 있음 |
| CH01 §4-1 | 급여구분 분류: 01/A/B/D/E/U/W 항번호 | `src/lib/calc-engine/types.ts:InsuPayType:L9-L16` | ✓ | 7종 InsuPayType으로 정의됨 (covered/nonCovered/fullSelf/partial50/80/30/90) |
| CH01 §4-1 | V항(보훈국비 100/100) 분류 | — | ✗ | InsuPayType에 V항 없음 |
| CH01 §4-4 | 급여약/비급여약 분리 합산 | `src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum():L28-L44` | ⚠ | `nonCovered`/그외 2종으로만 분리; A/B/D/E/U항별 개별 합산 없음 |
| CH01 §4-5 | 내복/외용/주사 목번호 분류 | `src/lib/calc-engine/types.ts:TakeType:L18-L22` | ✓ | internal/external/injection 3종 정의 |
| CH01 §5-3 | EXTYPE "1"/"9" 필터링 (2020.03.01 기점) | — | ✗ | DrugItem에 exType 필드 없음 |
| CH01 §6-1 | 저가대체조제장려금 (차액×30%, 2020.03.01 이후) | — | ✗ | calc-engine에 관련 함수 없음 |
| CH01 §6-2 | 퇴장방지의약품 사용장려금 (상한금액×10%, 직접조제) | — | ✗ | calc-engine에 관련 함수 없음 |
| CH01 §7-1 | 코로나19 치료제 3종 급여 동등 취급 | — | ⚠ | 648903860만 처리; 648903670·655502130 미처리 |
| CH01 §7-2 | 648903860 투약일수 5일 제한 | `src/lib/calc-engine/modules/special/drug-648.ts:apply648DayLimit():L97-L104` | ✓ | dDay > 5이면 5로 제한 |
| CH01 §7-2 | 648903860 5% 가산 (2024.10.25 이후) | `src/lib/calc-engine/modules/special/drug-648.ts:calcDrug648Surcharge():L192-L231` | ✓ | round1(sum648 × 0.05) |
| CH01 §7-2 | 648 가산 보훈 면제 (M10/M83/M82) | `src/lib/calc-engine/modules/special/drug-648.ts:calcDrug648Surcharge():L213-L221` | ⚠ | M10/M83/M82 처리; EDB에서는 M81도 면제 대상이나 미포함 |
| CH01 §7-3 | 할증률 (자보/비보험) 약품금액에 적용 | — | ✗ | DrugItem에 할증률 필드 없음; calcDrugAmount 내 할증 없음 |
| CH01 §7-4 | EXTYPE "9" 2020.03.01 이전/이후 분기 | — | ✗ | EXTYPE 개념 자체 미구현 |
| CH01 §9-1 | 금액 0원 방지 (구성요소가 0이면 0원) | `src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L19-L21` | ✓ | 곱셈 결과 자연적으로 0원 처리됨 |

---

## 4. 누락 항목 (Missing)

- [🟠 Missing / High] **단가 결정 로직 (PPREVALU/PDRUDRUG/평균가 DB 조회)**: calc-engine이 DrugItem.price를 외부에서 수령하는 구조이므로, 단가 결정 3중 분기 자체가 calc-engine 내부에 존재하지 않음. 외부 호출 코드에 구현 여부를 별도 확인해야 함 (CH01 §3-1)
- [🔴 Missing / Critical] **Del_Yn 코드 7종 분기**: DrugItem에 delYn 필드 자체 없음. Del_Yn "F"(폐기) → 강제 비급여 전환, "C"/"B"/"A" → 보험유형별 단가 분기, "P" → 전액본인부담 플래그 — 이 모든 분기가 누락됨 (CH01 §3-3)
- [🟠 Missing / High] **저가대체조제장려금**: 차액×30% 계산 함수 전혀 없음. 저가대체조제 건의 명세서 2줄(조제구분4/9) 분리 처리도 미구현 (CH01 §6-1)
- [🟠 Missing / High] **퇴장방지의약품 사용장려금**: 상한금액×10% 계산 함수 전혀 없음. 직접조제 건에서만 산정하는 분기도 미구현 (CH01 §6-2)
- [🟠 Missing / High] **할증률 적용 (약품금액)**: DrugItem에 할증률(surchargeRate) 필드 없음; calcDrugAmount()에 `(1 + 할증률/100)` 곱하기 없음 (CH01 §7-3)
- [🟡 Missing / Medium] **EXTYPE "1"/"9" 필터링**: DrugItem에 exType 필드 없음; 2020.03.01 기점 분기 없음 (CH01 §7-4)
- [🟡 Missing / Medium] **코로나19 치료제 648903670·655502130 급여 동등 취급**: 648903860만 특수 처리; 나머지 2종에 대한 개별 처리 없음 (CH01 §7-1)
- [🟡 Missing / Medium] **V항(보훈국비 100/100) 분류**: InsuPayType에 V항 없음 (CH01 §4-1)
- [🟢 Missing / Low] **약품평균가(PDRUVALU) 단가 우선적용**: 환경설정 기반 선택적 기능이나 완전 미구현 (CH01 §3-1 [4단계])

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] **1회투약량/1일투여횟수 소수점 전처리**: calcDrugAmount()가 DrugItem.dose, DrugItem.dNum 값을 raw 그대로 사용; CH01 §2-2에서 요구하는 "5자리에서 4사5입 → 4자리 정규화" 및 "3자리에서 4사5입 → 2자리 정규화" 전처리 없음 (`src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L17-L21`)
- [🟠 Insufficient / High] **A/B/D/E/U항별 개별 합산 미분리**: calcDrugAmountSum()이 `nonCovered`(비급여) vs 나머지(급여) 2종으로만 분리. A/B/D/E/U항별 개별 합산은 없어 본인부담 산정 시 항별 본인부담률 개별 적용 불가 (`src/lib/calc-engine/drug-amount.ts:calcDrugAmountSum():L28-L44`)
- [🟡 Insufficient / Medium] **단가 최소 1원 보정**: calcDrugAmount()에 `price < 1`이면 1원으로 올리는 보정 없음; 외부에서 이미 보정된 price가 전달된다는 가정에 의존 (`src/lib/calc-engine/drug-amount.ts:calcDrugAmount():L17`)
- [🟡 Insufficient / Medium] **648 가산 보훈 면제 M81 누락**: EDB 코드에서 M10/M83/M82 외에 M81도 면제 대상으로 확인됨; drug-648.ts의 EXEMPT_BOHUN_CODES에 M81이 포함되지 않음 (`src/lib/calc-engine/modules/special/drug-648.ts:L39`)
- [🟡 Insufficient / Medium] **calcDrugAmountSum()의 비급여 약가 미활용**: sumUser가 계산되나 buildResult()에서 `void sumUserDrug`로 버려짐; 비급여 약가 합계가 CalcResult에 반영되지 않음 (`src/lib/calc-engine/index.ts:buildResult():L168`)

---

## 6. 기타 관찰 사항

- **단가 결정 아키텍처**: calc-engine은 단가가 결정된 DrugItem.price를 외부에서 전달받는 구조로 설계되었음. 이는 의도적인 관심사 분리(DB 조회 계층 분리)로 볼 수 있으나, Del_Yn 분기 처리가 어느 계층에서 이루어지는지 문서화가 필요함. 외부 호출 코드(API Route 등)에서 처리되는지 여부를 별도 확인해야 함.

- **팩수량 처리 방법 선택**: 구현은 EDB의 "소모량 나누기(방법 2)" 방식을 채택함. CH01 §2-3 구현 권고는 "방법 1(1회투약량 환산)을 기본으로 하되 방법 2와 결과 일치 확인"을 권고하는데, 두 방법의 결과가 동일하므로 실질적 문제는 없음. 단 소수점 연산 순서에 따라 부동소수점 오차가 달라질 수 있음.

- **Math.floor(x + 0.5) vs Math.round(x)**: drug-amount.ts는 `Math.floor(amount * price + 0.5)` (roundToInt 방식), rounding.ts의 round1()은 `Math.round(v)`를 사용. 양수에서 두 함수는 동일하지만, drug-amount.ts가 rounding.ts의 round1()을 import하지 않고 인라인으로 구현한 점은 불일치. 코드 일관성 관점에서 round1() 또는 roundToInt() 중 하나로 통일 권장.

- **drug-648.ts의 sum648DrugAmount()**: 해당 함수 내부에서도 `Math.floor(amount * d.price + 0.5)` 인라인 계산을 수행(L121-L122). calcDrugAmount()와 중복 구현이며, calcDrugAmount()를 직접 호출하는 방식으로 리팩토링하면 단일 책임 원칙에 부합.

- **JS number 타입 정밀도**: 약품금액 계산 전체가 JS `number`(IEEE 754 배정밀도)를 사용. CH01 §9-1에서 "신규 구현 시 decimal 타입 사용"을 권고하나 TypeScript에는 내장 decimal 타입이 없음. dose=0.3333, dNum=3과 같은 반복소수 입력에서 JS 부동소수점 오차 가능성 있음. Decimal.js 등 외부 라이브러리 도입 또는 정수 연산 변환 검토 필요.

- **다른 챕터와의 의존성**:
  - CH02/CH03(조제료): calcDrugAmountSum()의 내복/외용/주사 약품 수가 조제료 Z코드 선택에 영향을 줌 — TakeType 분류가 올바라야 조제료 계산 정확
  - CH05(본인부담금): A/B/D/E항별 개별 합산이 미분리된 경우 선별급여 본인부담률 개별 적용 불가
  - CH06(3자배분): 보훈 약품 금액 분리가 InsuPayType에서 이루어지나 V항 없음

---

*소스 참조: `C:\Projects\DSNode\약제비 분석용\output\CH01_약품금액_계산.md` (CH01 요구사항), `C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\drug-amount.ts`, `rounding.ts`, `modules/special/drug-648.ts`, `types.ts`, `index.ts`*
