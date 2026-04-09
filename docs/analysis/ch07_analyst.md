# CH07 구현 분석 보고서

> 작성자: CH07 Analyst (Phase 2 Team 7A)
> 작성일: 2026-04-06
> 챕터: CH07 — 반올림/절사 규칙 통합
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 반올림/절사 규칙 통합 명세
- **핵심 주제**: 약제비 계산 파이프라인 전 단계에 걸쳐 적용되는 사사오입·절사·올림 규칙을 하나의 문서로 통합한다. 계산 단계(R01~R18)별 반올림 방식, 보험유형별 본인부담금 절사 단위, 반올림 유틸리티 함수 9종(Round1·RoundN·Trunc10·Trunc100·Ceil10·Round10·Round100·Ceil100·roundToInt), 비급여 NPayRoundType 6종, 수납 절사 옵션 gSelfAmt 3종을 정의한다.
- **다루는 계산 로직 범위**:
  - 약품 단가·금액 사사오입 (R01, R04)
  - 요양급여비용총액1 10원 절사 (R12)
  - 보험유형별(C/D/G/F/E) 본인부담금 절사 (C→100원, D→10원, G→조건부)
  - 비급여(NPayRoundType 0~5) 및 수납(gSelfAmt 0~2) 절사 옵션
  - 유팜 MathHelper 명칭 버그(10배 오차) 회피 지침
  - C31/C32 날짜 분기 (2016.09.29)
  - 관련 법령: 국민건강보험법 제107조, 국고금관리법 제47조

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/rounding.ts` | 52줄 | `round1()`, `trunc10()`, `trunc100()`, `round10()`, `roundToInt()` | 핵심 반올림 유틸리티 |
| `src/lib/calc-engine/copayment.ts` | 235줄 | `calcCopayment()` | trunc10(총액1), trunc100(건보 본인부담) 적용 |
| `src/lib/calc-engine/modules/insurance/veteran.ts` | 425줄 | `calcVeteran()`, `calcMpvaPrice()` | 보훈 본인부담 trunc10/trunc100 조건부 분기 |
| `src/lib/calc-engine/modules/insurance/medical-aid.ts` | 305줄 | `calcMedicalAid()` | 의료급여 trunc10 적용 |
| `src/lib/calc-engine/__tests__/rounding.test.ts` | 93줄 | round1·trunc10·trunc100·round10·roundToInt 테스트 | |

### 미구현 영역

- `RoundN(x, decimals)` 함수 — CH07 §3-2: 소수 N자리 사사오입 (1회투약량 4자리, 조제료 점수 2자리 라운딩)
- `Ceil10()` 함수 — CH07 §3-5: 10원 미만 올림 (보훈청구 유팜 방식)
- `Round100()` 함수 — CH07 §3-7: 100원 미만 사사오입 (비급여 NPayRoundType 2)
- `Ceil100()` 함수 — CH07 §3-8: 100원 미만 올림 (비급여 NPayRoundType 3)
- NPayRoundType 6종 디스패처 — CH07 §4: 비급여 반올림 타입 분기 함수
- gSelfAmt 3종 수납 절사 — CH07 §5: 수납 파이프라인용 절사 옵션
- C31/C32 절사 단위 날짜 분기 — CH07 §4-3: 2016.09.29 이전/이후 분기

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §       | 요구사항 요약                                     | 우리 구현 위치                                                              | 상태 | 비고 |
|-------------|--------------------------------------------------|---------------------------------------------------------------------------|------|------|
| CH07 §2-1 R01 | 약품 단가: 원미만 사사오입                       | `src/lib/calc-engine/rounding.ts:round1():L14`                             | ✓    | |
| CH07 §2-1 R02 | 1회투약량: 소수5자리→4자리 사사오입              | —                                                                         | ✗    | RoundN 미구현 |
| CH07 §2-1 R03 | 1일투약횟수: 소수3자리→2자리 사사오입            | —                                                                         | ✗    | RoundN 미구현 |
| CH07 §2-1 R04 | 약품별 금액: 원미만 사사오입                     | `src/lib/calc-engine/rounding.ts:round1():L14`                             | ✓    | drug-amount.ts에서 호출 |
| CH07 §2-1 R05 | 조제료 점수 중간값: 소수2자리 사사오입           | —                                                                         | ✗    | RoundN 미구현 |
| CH07 §2-1 R06 | 조제료 항목 금액: 원미만 사사오입                | `src/lib/calc-engine/rounding.ts:round1():L14`                             | ⚠    | dispensing-fee.ts 내 호출 여부 별도 확인 필요 |
| CH07 §2-1 R07 | 토요가산 분리계산: 원미만 사사오입               | `src/lib/calc-engine/modules/surcharges/saturday-split.ts`                | ⚠    | round1 사용 여부 미확인 |
| CH07 §2-1 R08 | 할증 적용: 원미만 사사오입                       | —                                                                         | ⚠    | surcharge.ts 내 round1 사용 여부 미확인 |
| CH07 §2-1 R09 | 사용장려금 단가: 원미만 사사오입 (최소 1원)       | —                                                                         | ✗    | 사용장려금 로직 미구현 |
| CH07 §2-1 R10 | 사용장려금 금액: 원미만 사사오입                 | —                                                                         | ✗    | 사용장려금 로직 미구현 |
| CH07 §2-1 R11 | 대체조제 장려금 단가: 원미만 사사오입            | —                                                                         | ✗    | 대체조제 장려금 미구현 |
| CH07 §2-1 R12 | 요양급여비용총액1: 10원미만 절사                 | `src/lib/calc-engine/copayment.ts:calcCopayment():L60`                    | ✓    | `trunc10(sumInsuDrug + sumWage)` |
| CH07 §2-1 R13 | 요양급여비용총액2: 10원미만 절사                 | —                                                                         | ✗    | 총액2 필드 미구현 |
| CH07 §2-1 R14 | 100/100본인부담금총액: 10원미만 절사             | —                                                                         | ✗    | 100/100 본인부담 관련 총액 필드 미구현 |
| CH07 §2-1 R15 | 100/100미만 총액: 10원미만 절사                  | —                                                                         | ✗    | 선별급여 100/100미만 처리 미구현 |
| CH07 §2-1 R16 | 100/100미만 본인부담금: 합산 후 1회 10원 절사    | —                                                                         | ✗    | 선별급여 A/B/D/E항 합산 절사 미구현 |
| CH07 §2-1 R17 | 100/100미만 청구액: 10원미만 절사                | —                                                                         | ✗    | 선별급여 청구액 미구현 |
| CH07 §2-1 R18 | 청구액: 절사 없음                                | `src/lib/calc-engine/copayment.ts:calcCopayment():L184`                   | ✓    | `totalPrice - userPrice` 그대로 |
| CH07 §2-2 C  | 건보 본인부담금: 100원미만 절사                  | `src/lib/calc-engine/copayment.ts:calcCopayment():L138,146,156,175`       | ✓    | `trunc100()` 사용 |
| CH07 §2-2 D  | 의료급여 본인부담금: 10원미만 절사               | `src/lib/calc-engine/modules/insurance/medical-aid.ts:calcMedicalAid():L157,165` | ✓ | `trunc10()` 사용 |
| CH07 §2-2 G (100/100) | 보훈 100/100: 10원미만 절사             | `src/lib/calc-engine/modules/insurance/veteran.ts:calcVeteran():L336`     | ⚠    | 아래 §5 "부족 항목" 참조 |
| CH07 §2-2 G (<100%)   | 보훈 감면 <100%: 100원미만 절사         | `src/lib/calc-engine/modules/insurance/veteran.ts:calcVeteran():L296,339` | ⚠    | 아래 §5 참조 |
| CH07 §3-1 Round1  | 원미만 사사오입 함수                        | `src/lib/calc-engine/rounding.ts:round1():L14`                            | ✓    | |
| CH07 §3-2 RoundN  | 소수N자리 사사오입 함수                     | —                                                                         | ✗    | 미구현 |
| CH07 §3-3 Trunc10 | 10원미만 절사 함수                          | `src/lib/calc-engine/rounding.ts:trunc10():L23`                           | ✓    | |
| CH07 §3-4 Trunc100| 100원미만 절사 함수                         | `src/lib/calc-engine/rounding.ts:trunc100():L32`                          | ✓    | |
| CH07 §3-5 Ceil10  | 10원미만 올림 함수                          | —                                                                         | ✗    | 미구현 |
| CH07 §3-6 Round10 | 10원미만 사사오입 함수                      | `src/lib/calc-engine/rounding.ts:round10():L41`                           | ✓    | |
| CH07 §3-7 Round100| 100원미만 사사오입 함수                     | —                                                                         | ✗    | 미구현 |
| CH07 §3-8 Ceil100 | 100원미만 올림 함수                         | —                                                                         | ✗    | 미구현 |
| CH07 §4   NPayRoundType 0~5 | 비급여 반올림 타입 6종 디스패처    | —                                                                         | ✗    | 미구현 |
| CH07 §5   gSelfAmt 0~2 | 수납 절사 옵션 3종                      | —                                                                         | ✗    | 미구현 |
| CH07 §7 버그 #1 | `x * 0.1` vs `x / 10` 부동소수점 회피       | `src/lib/calc-engine/rounding.ts:trunc10():L24`                           | ✓    | `Math.floor(v / 10) * 10` 정수연산 사용 |
| CH07 §6-3 유팜 명칭버그 | 함수명과 실제 동작 일치 여부          | `src/lib/calc-engine/rounding.ts`                                         | ✓    | 함수명이 실제 단위를 명확히 표기 |
| CH07 §4-3 C31/C32 날짜 분기 | 2016.09.29 절사 단위 변경        | —                                                                         | ✗    | 날짜 분기 미구현 |
| CH07 §8 선별급여 | 합산 후 1회 절사 (개별 절사 금지)          | —                                                                         | ✗    | 선별급여 미구현 |

---

## 4. 누락 항목 (Missing)

- [🟠 Missing / High] `RoundN(x, decimals)` 함수: 소수 N자리 사사오입이 구현되지 않아 1회투약량 4자리 라운딩(R02)·1일투약횟수 2자리 라운딩(R03)·조제료 점수 중간값 2자리 라운딩(R05)을 수행할 함수가 없음. 현재 drug-amount.ts·dispensing-fee.ts가 어떤 방식으로 처리하는지 추가 확인 필요 (CH07 §3-2)
- [🟠 Missing / High] `Ceil10()` 함수: 10원미만 올림 함수 미구현. 유팜은 보훈청구액에 Ceil10을 적용하며, NPayRoundType 미사용이더라도 보훈 시나리오에서 현장 확인 후 채택 여부를 결정해야 함 (CH07 §3-5)
- [🟡 Missing / Medium] `Round100()` 함수: 100원미만 사사오입 미구현. NPayRoundType 2(십원단위 반올림)에서 필요 (CH07 §3-7)
- [🟡 Missing / Medium] `Ceil100()` 함수: 100원미만 올림 미구현. NPayRoundType 3(십원단위 올림)에서 필요 (CH07 §3-8)
- [🟠 Missing / High] NPayRoundType 디스패처: 비급여 반올림 타입 0~5 분기 로직 전체 미구현. 비급여 금액 계산 시 약국 설정값에 따라 분기해야 함 (CH07 §4)
- [🟡 Missing / Medium] gSelfAmt 수납 절사 옵션(0/1/2): 수납 파이프라인 전체 미구현. 청구 파이프라인과 수납 파이프라인이 분리되지 않아 있음 (CH07 §5)
- [🔴 Missing / Critical] R13 요양급여비용총액2 필드: `trunc10(총액1 + 100/100 본인부담금총액)` 계산 및 CalcResult 필드 미구현. 청구서 총액2 항목 누락 (CH07 §2-1 R13)
- [🔴 Missing / Critical] R14~R17 선별급여(100/100미만) 4종: A/B/D/E항 합산 후 1회 trunc10 처리 로직 전체 미구현. 선별급여 청구서 작성 불가 (CH07 §2-1 R14~R17, §8)
- [🟠 Missing / High] R09~R11 사용장려금·대체조제 장려금: 단가·금액 모두 미구현 (CH07 §2-1 R09~R11)
- [🟡 Missing / Medium] C31/C32 날짜 분기 (2016.09.29): 특정 날짜 이후 약가 반올림 방식 변경. 현행 규칙만 구현된 상태로, 과거 명세서 재검증 시 누락 (CH07 §4-3)

---

## 5. 부족 항목 (Insufficient)

- [🔴 Insufficient / Critical] 보훈 감면 본인부담 절사 분기: `calcVeteran()`의 일반 보훈 감면 분기(L329~339)는 감면율 30/50/60/90%일 때 `trunc10`을, 그 외에는 `trunc100`을 적용한다. 그러나 CH07 §2-2는 감면(30~90%)에 `trunc10`, 보훈 일반(<100%)에 `trunc100`이라고 기술하며, M82(감면없음)에 `trunc100`(L297)을 사용하는 것은 맞다. **M10(100%) 이외 M30/M50/M60/M90 케이스에서 절사 함수 선택 기준이 "감면율 열거값"으로만 하드코딩되어 있어, 새 감면율 추가 시 누락 위험이 있다.** (`src/lib/calc-engine/modules/insurance/veteran.ts:calcVeteran():L329-339`)
- [🟠 Insufficient / High] 보훈 MpvaPrice 역산 시 절사 함수: `calcMpvaPrice()`(L220~226)에서 `trunc10`을 사용하나, 정산방식(isMPVBill=true)과 역산방식(false) 모두 동일하게 `trunc10`을 적용한다. CH07 §6-6에서 보훈청구 반올림 방향이 "올림/절사/사사오입 미확정"으로 표기되어 있어, `trunc10`이 맞는 선택인지 현장 확인이 필요하다. (`src/lib/calc-engine/modules/insurance/veteran.ts:calcMpvaPrice():L220-226`)
- [🟡 Insufficient / Medium] 건보 65세 이상 3구간 절사: `copayment.ts`의 1구간(정액, L129)에서는 `Math.min(totalPrice, fixCost)` 그대로 사용하며 trunc100을 적용하지 않는다. 정액 부분의 절사 미적용이 규격상 허용되는지 확인 필요 (`src/lib/calc-engine/copayment.ts:calcCopayment():L127-135`)
- [🟡 Insufficient / Medium] 의료급여 B014 정률 30% 절사: `calcMedicalAid()`(L137)에서 `trunc10(totalPrice * 0.3)`을 사용하며, `applySbrdnTypeModifier()`(L136)로 전달한 후 다시 `trunc10(totalPrice * 0.3)`을 재계산(L258)한다. 동일 로직의 중복 계산이 존재하여, 향후 소수점 오차 가능성이 있다 (`src/lib/calc-engine/modules/insurance/medical-aid.ts:L134-148`)
- [🟡 Insufficient / Medium] `round10()`의 AwayFromZero 정밀도: JS `Math.round(v / 10) * 10`은 `.5` 경계에서 C#의 `MidpointRounding.AwayFromZero`와 양수 영역에서 동일하나, CH07 §3-6 부록 A의 테스트 데이터(예: round10(5)=10)가 현재 `rounding.test.ts`에 커버되어 있음을 확인. 단, round10 테스트가 경계값 `15→20`만 포함하고 `1745→1750`(조제료 단가 예시)는 미포함 (`src/lib/calc-engine/__tests__/rounding.test.ts:L69-76`)
- [🟢 Insufficient / Low] `roundToInt()` 함수 존재 의미: `round1()`과 양수 영역에서 결과가 동일하고 `rounding.ts` 주석에도 "양수 영역에서 round1과 동일"이라고 명시되어 있다. EDB 호환 목적이라면 내부 사용처를 한 군데로 통일하는 것이 유지보수에 유리하다 (`src/lib/calc-engine/rounding.ts:roundToInt():L49-51`)

---

## 6. 기타 관찰 사항

- **유팜 MathHelper 명칭 버그 회피 성공**: `rounding.ts`의 함수명(`round1`, `trunc10`, `round10` 등)은 "절사 대상 단위"를 기준으로 명명하여 유팜의 `To원단위사사오입()`이 실제로는 10원 단위 사사오입이었던 10배 오차 명칭버그를 회피했다. CH07 §6-3 요구사항 충족.

- **`x * 0.1` 부동소수점 버그 회피 성공**: `trunc10()`은 `Math.floor(v / 10) * 10`으로 구현되어 있어 CH07 §7 버그 #1의 비즈팜 패턴(`x * 0.1`)을 사용하지 않는다. 단, `medical-aid.ts`(L137)에서 `totalPrice * 0.3`을 사용하는 패턴은 `totalPrice`가 항상 trunc10 후 정수이므로 실질적 오차는 발생하지 않으나, 원칙적으로는 `totalPrice * 30 / 100` 또는 정수 나눗셈이 더 안전하다.

- **보훈 청구액 반올림 미확정 항목**: CH07 §6-6에서 "올림/절사/사사오입 미확정"으로 표기된 보훈청구액 반올림 방향이 현재 `calcMpvaPrice()`에서 `trunc10`(절사)으로 구현되어 있다. 공단 규칙에 명시가 없으므로 약국 현장 확인 후 Ceil10(올림) 또는 Round10(사사오입)으로 변경될 가능성이 있다. 현장 확인 완료 전까지 이 항목은 의심(Suspicious) 상태로 관리해야 한다.

- **의료급여 본인부담 절사 10원 vs 100원**: CH07 §2-2에서 의료급여(D)는 10원 절사로 명시되어 있으며, `medical-aid.ts`는 모든 D계열에 `trunc10`을 일관되게 사용하고 있어 규격과 일치한다. 단, 정액(fixAmt)을 `trunc10`에 통과시키는 것(L157, L165)이 정액 자체의 값에 10원 미만이 포함될 수 없는 경우 불필요한 연산이다 — 실질적 오류는 아님.

- **선별급여(100/100미만) R15~R17 미구현 우선순위**: R13~R17은 총액2 및 선별급여 청구서 생성에 필수이며, 선별급여 처방이 포함된 경우 청구 자체가 불가능하다. 이 5개 규칙의 구현을 빠른 시일 내에 추진해야 한다.

- **테스트 커버리지**: `rounding.test.ts`는 round1·trunc10·trunc100·round10·roundToInt만 테스트한다. RoundN·Ceil10·Round100·Ceil100이 구현되면 부록 A의 전체 단위 테스트 데이터(CH07 §부록A)를 테스트로 변환하는 것이 권장된다.

- **청구 파이프라인 vs 수납 파이프라인 분리**: CH07 §7 버그 #5에서 비즈팜의 gSelfAmt가 청구 금액에도 영향을 주는 경로를 지적했다. 현재 우리 구현에는 gSelfAmt 자체가 미구현이므로 이 버그 패턴은 재현되지 않는다. gSelfAmt 구현 시 반드시 수납 파이프라인을 독립 모듈로 분리하여 청구 금액과 완전히 격리해야 한다.

---

*참조 문서: `C:\Projects\DSNode\약제비 분석용\output\CH07_반올림_절사_규칙.md` (2026-04-03 초판)*

**[약제비 분석용]**
