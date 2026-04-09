# CH06 구현 분석 보고서

> 작성자: CH06 Analyst (Phase 2 Team 6A)
> 작성일: 2026-04-06
> 챕터: CH06 — 3자배분(환자/공단/보훈) 및 공비(PubPrice) 로직
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 3자배분(환자/공단/보훈) 및 공비(PubPrice) 로직
- **핵심 주제**: 약국 약제비(요양급여비용총액1)를 환자(UserPrice) · 공단(InsuPrice) · 보훈청(MpvaPrice)의 세 주체에게 배분하는 규칙을 정의한다. 항등식 `총액1 = UserPrice + InsuPrice + MpvaPrice`가 불변 조건이며, 공비(PubPrice) · 특수공비(302/101/102) · 보훈약국(M81~M83) · 본인부담상한제(OverUserPrice)까지 전 흐름을 포함한다.
- **다루는 계산 로직 범위**:
  - 기본 3자배분 (일반/보훈감면/보훈국비100%)
  - 공비(PubPrice) — 희귀질환·긴급복지·차상위 등
  - 특수공비 302/101/102 재배분 (C/D/G타입)
  - 보훈 MpvaPrice / MpvaComm 산출 (위탁·비위탁·역산 방식)
  - M81/M82/M83 보훈약국 처리
  - 본인부담상한제 OverUserPrice
  - RealPrice / SumUser / SumInsure 최종 확정
  - 100%약품(EXTYPE9) 3자배분
- **관련 법령**: 보건복지부 고시 제2024-136호(2024-07), 국가보훈처 보훈병원 업무처리기준(CH12 참조)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/modules/insurance/veteran.ts` | 425줄 | `calcVeteran()`, `calcMpvaPrice()`, `getBohunRate()`, `getDoubleReductionRate()`, `isBohunHospital()` | CH06 핵심 파일 |
| `src/lib/calc-engine/copayment.ts` | 237줄 | `calcCopayment()`, `_resultToCopay()` | 보훈 분기 진입점 |
| `src/lib/calc-engine/index.ts` | 211줄 | `calculate()`, `applyPostProcessing()`, `buildResult()` | 파이프라인 진입점 |
| `src/lib/calc-engine/modules/special/safety-net.ts` | 229줄 | `applySafetyNet()`, `calcSafetyNet()`, `calcSafetyNetOverage()` | 본인부담상한제 |
| `src/lib/calc-engine/types.ts` | 284줄 | `CalcResult`, `CalcOptions` 타입 정의 | `mpvaPrice` / `insuPrice` / `realPrice` / `sumUser` / `sumInsure` / `overUserPrice` 필드 포함 |
| `src/lib/calc-engine/rounding.ts` | 52줄 | `trunc10()`, `trunc100()` | 절사 함수 |

### 미구현 영역

- `공비(PubPrice) 계산 전용 로직` — CH06 §3 (희귀질환·G타입·차상위·IND=Y·V246/V206 조건별 PubPrice 산출) 전용 함수 없음. 현재 `pubPrice` 필드는 `insuPrice + mpvaPrice` 합산값으로만 채워지며(veteran.ts L417), 공비 개념 자체가 분리되어 있지 않다.
- `특수공비(302/101/102) 재배분 로직` — CH06 §4 (C/D/G타입별 SumInsuDrug_100 이동, Pub100Price 산출) 전용 함수 없음. 대응 코드 없음.
- `MpvaComm 산출 로직` — CH06 §5-3 (비급여약품·조제관리료·100%이하약품에 대한 보훈 부담분 계산) 전용 함수 없음. types.ts에 `mpvaComm` 필드는 선언되어 있으나 채우는 코드가 없음.
- `RealPrice / SumUser / SumInsure 최종 확정 로직` — CH06 §8 (RealPrice = UserPrice - PubPrice, SumUser 파생 계산, SumInsure = InsuPrice + 약안전가산) 코드 없음. types.ts에 `realPrice` / `sumUser` / `sumInsure` 필드만 선언.
- `100%약품(EXTYPE9) 3자배분` — CH06 §9 (TotalPrice_100 분해, UserPrice100/InsuPrice100/MpvaPrice100, Extype9 잔액 보정) 코드 없음. `sumInsuDrug100` / `totalPrice100` / `userPrice100` 필드만 선언.
- `F008(긴급복지 전액면제) PubPrice 전환` — CH06 §3-4 코드 없음.
- `D타입 M20 절사 단위 시기별 분기(2018.01.01)` — CH06 §10-2(D) 에서 EDB 기준 D타입은 2018 전 100원 절사, 이후 10원 절사이나 현재 veteran.ts는 C타입(G계열) M20만 구현, D타입 M20 분기 없음.
- `M10 국비 → Under_Insu 전환` — CH06 §2-3 EDB InsuRateCalc3 L3917-3920의 `InsuPrice -= SumUserDrug_100_Under_Insu; MpvaPrice += SumUserDrug_100_Under_Insu` 처리 없음.

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 § | 요구사항 요약 | 우리 구현 위치 | 상태 | 비고 |
|--------|-------------|--------------|------|------|
| CH06 §1 | 항등식: 총액1 = UserPrice + InsuPrice + MpvaPrice | `veteran.ts:calcVeteran():L344` | ✓ | 음수 보정 포함 |
| CH06 §2-1 | 일반(비보훈) 3자배분: UserPrice = trunc100(총액1 × rate%), InsuPrice = 잔액 | `copayment.ts:calcCopayment():L175-L184` | ✓ | |
| CH06 §2-2 | 보훈감면 공식: MpvaPrice = trunc10(총액1 × 감면율), 기준액 = 총액1 - MpvaPrice, UserPrice = trunc10(기준액 × rate%) | `veteran.ts:calcMpvaPrice():L210-L226`, `calcVeteran():L327-L340` | ✓ | |
| CH06 §2-2 표 | 감면율 표: 3→30% / 5→50% / 6→60% / J→90% / 4/7→100% | `veteran.ts:getBohunRate():L133-L145` | ✓ | M30/M50/M60/M90/M10 매핑 |
| CH06 §2-3 | M10 국비100%: 환자 0원, 총액 전액 보훈 | `veteran.ts:calcVeteran():L291-L294` | ⚠ | Under_Insu→MpvaPrice 전환 미구현 |
| CH06 §3-1 | PubPrice 결정 규칙 (희귀질환·G타입·C타입+특수공비·IND=Y 조건) | — | ✗ | 전용 함수 없음 |
| CH06 §3-2 | V246/V206 특수공비 (C타입, 2016.07.01 이전 50% 적용) | — | ✗ | 날짜 분기 포함 미구현 |
| CH06 §3-4 | F008 긴급복지 전액면제 PubPrice 전환 | — | ✗ | |
| CH06 §4-1 | C타입 특수공비 302/101/102 재배분 (Pub100Price, SumUser 조정) | — | ✗ | |
| CH06 §4-2 | D타입 특수공비 302/101 재배분 | — | ✗ | |
| CH06 §4-3 | G타입 특수공비 302 재배분 (Pub100Price = SumUser, SumUser = 0) | — | ✗ | |
| CH06 §5-2(A) | MpvaPrice 역산 방식 (위탁 급여총액==약가총액인 경우) | `veteran.ts:calcMpvaPrice():L221-L225` | ⚠ | 조건 완전성 미확인 — `SumWage==num AND num2==SumInsuDrug_100` 분기 없음 |
| CH06 §5-2(B) | MpvaPrice 위탁 정산 방식 | `veteran.ts:calcMpvaPrice():L219` | ✓ | |
| CH06 §5-2(C) | 특수약품(648903860) 존재 시 MpvaPrice 별도 산출 | — | ✗ | |
| CH06 §5-2(D) | 비위탁 일반 → 역산 방식 | `veteran.ts:calcMpvaPrice():L221-L225` | ✓ | |
| CH06 §5-2(E) | D/C21/C31/C32 + M10이 아닌 경우 MpvaPrice 강제 0 | — | ✗ | D타입에서 M10이 아닌 경우 처리 없음 |
| CH06 §5-3 | MpvaComm 산출 (비급여약품·조제관리료·100%이하약품) | — | ✗ | types.ts 필드만 선언 |
| CH06 §5-4 | M20 이중감면 G타입 처리 (MpvaPrice 리셋, MpvaComm 전환) | `veteran.ts:calcVeteran():L300-L311` | ⚠ | MpvaPrice 리셋까지만 구현, MpvaComm 전환 미구현 |
| CH06 §5-4 | M20 D타입 절사 단위 시기별 분기 (2018.01.01) | — | ✗ | D타입 M20 처리 없음 |
| CH06 §5-5 | M61 고엽제 역산 (insuRate × num7 이중적용) | `veteran.ts:calcVeteran():L314-L324` | ⚠ | 특수약품(648903860) 없는 경우만 처리 — §5-5 num9==0 분기에 해당 |
| CH06 §6 | M81/M82/M83 보훈약국 — G비위탁: SumUser=0, UserPrice=0, MpvaPrice+=RealPrice | `veteran.ts:calcVeteran():L362-L380` | ⚠ | C31/C32·D타입 분기 없음, MpvaComm 보정 없음 |
| CH06 §7 | 본인부담상한제 OverUserPrice (SumUser에서 차감) | `safety-net.ts:applySafetyNet():L151-L173` | ⚠ | InsuPrice 미반영 — §7-2 "OverUserPrice는 SumUser에서만 차감, InsuPrice 미반영" 기준 불일치 |
| CH06 §8-1 | RealPrice = UserPrice - PubPrice | — | ✗ | 전용 계산 없음. types.ts 필드만 선언 |
| CH06 §8-2 | SumUser = RealPrice + num2 - (MpvaComm - MpvaPrice100) + SumUserDrug_100_Under_User | — | ✗ | |
| CH06 §8-3 | SumInsure = InsuPrice + 약안전가산 + TDay | — | ✗ | |
| CH06 §9-1 | TotalPrice_100 분해 (InsuPrice100/UserPrice100/MpvaPrice100) | — | ✗ | |
| CH06 §9-2 | 심사+보훈 시 UserPrice100 재배분 | — | ✗ | |
| CH06 §9-3 | Extype9 잔액 보정 (num18 → InsuPrice 가산, M10/M20 전액 보훈 전환) | — | ✗ | |

---

## 4. 누락 항목 (Missing)

- [🔴 Critical] **공비(PubPrice) 계산 로직**: 희귀질환·G타입·차상위·V246/V206 등 조건별 PubPrice 산출 함수가 전혀 없다. 현재 `pubPrice`는 `insuPrice + mpvaPrice` 합산으로만 채워지며 공비 개념이 분리되어 있지 않다. (CH06 §3)

- [🔴 Critical] **특수공비 302/101/102 재배분**: C/D/G타입별 `SumInsuDrug_100` 이동, `Pub100Price` 산출 로직이 전혀 없다. 차상위·긴급복지 환자의 100%약품 부담 배분이 불가능하다. (CH06 §4)

- [🔴 Critical] **RealPrice / SumUser / SumInsure 최종 확정**: `RealPrice = UserPrice - PubPrice`, `SumUser = RealPrice + num2 - (MpvaComm - MpvaPrice100) + ...`, `SumInsure = InsuPrice + 약안전가산` 로직이 없다. types.ts에 필드 선언만 있고 채우는 코드가 없어 최종 환자수납액과 공단청구액이 확정되지 않는다. (CH06 §8)

- [🔴 Critical] **100%약품(EXTYPE9) 3자배분**: `TotalPrice_100` 분해, `UserPrice100/InsuPrice100/MpvaPrice100` 산출, `Extype9` 잔액 보정(M10/M20 보훈 전환 포함)이 없다. (CH06 §9)

- [🟠 High] **MpvaComm 산출 로직**: 비급여약품 조제관리료·100%이하약품에 대한 보훈 부담분(`MpvaComm`) 계산 전용 로직이 없다. types.ts 선언만 있다. (CH06 §5-3)

- [🟠 High] **D타입 M20 절사 단위 시기별 분기**: EDB 기준 D타입 M20은 2018.01.01 이전 100원 절사, 이후 10원 절사이나 구현이 없다. G타입 M20만 구현되어 있다. (CH06 §10-2(D))

- [🟠 High] **D/C21/C31/C32 + M10이 아닌 경우 MpvaPrice 강제 0**: `EDB InsuRateCalc2 L3103-3106` 처리 없음. D타입 보훈 환자가 M10 아닌 코드(M30 등)로 입력될 때 MpvaPrice가 잘못 산출된다. (CH06 §5-2(E))

- [🟠 High] **M10 국비 → Under_Insu 전환**: M10 확정 후 `InsuPrice -= SumUserDrug_100_Under_Insu; MpvaPrice += SumUserDrug_100_Under_Insu` 처리가 없다. 100%이하 약품이 있는 M10 처방에서 3자배분이 틀린다. (CH06 §2-3)

- [🟠 High] **F008 긴급복지 전액면제 PubPrice 전환**: `PubPrice += RealPrice + F008_100DrugCost; RealPrice = 0` 처리 없음. (CH06 §3-4)

- [🟡 Medium] **V246/V206 특수공비 (2016.07.01 이전 50% 적용)**: C타입 V246/V206 조건 및 날짜 분기 미구현. 2016년 이전 처방 재현에서 오차 발생. (CH06 §3-2)

- [🟡 Medium] **특수약품(648903860) 존재 시 MpvaPrice 별도 산출**: CH06 §5-2(C) 분기 없음. 648 약품과 보훈 동시 처방 시 MpvaPrice 오차 가능. (CH06 §5-2(C))

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] **M81/M82/M83 보훈약국 처리**: G계열 비위탁 분기는 구현되어 있으나 C31/C32, D타입, 위탁(MPV_Bill) 분기가 누락되어 있다. 또한 비위탁·비심사 시 `MpvaComm += num2 - MpvaComm; MpvaComm += SumUserDrug_100_Under_User` 보정 처리가 없다. (`src/lib/calc-engine/modules/insurance/veteran.ts:calcVeteran():L362-L380`)

- [🟠 Insufficient / High] **본인부담상한제 OverUserPrice와 InsuPrice 연동**: `safety-net.ts:applySafetyNet()`은 `pubPrice += overage`로 처리하는데(L168), CH06 §7-2는 "OverUserPrice는 SumUser에서만 차감되고 InsuPrice에는 반영되지 않는다"고 명시한다. 두 정의가 상충한다. 즉 EDB 원본과 다른 방식으로 구현되어 있다. (`src/lib/calc-engine/modules/special/safety-net.ts:applySafetyNet():L164-L172`)

- [🟠 Insufficient / High] **M20 이중감면 MpvaComm 전환**: `calcVeteran()`에서 G타입 M20의 MpvaPrice를 0으로 리셋하는 것은 구현되어 있으나(L311), 이후 MpvaComm으로 전환하는 로직(`MpvaComm = num3 + SumWageComm - temp`)이 없다. 비급여약품이 있는 G타입 M20 처방에서 비급여분이 미처리된다. (`src/lib/calc-engine/modules/insurance/veteran.ts:calcVeteran():L308-L311`)

- [🟡 Insufficient / Medium] **calcMpvaPrice() 위탁 분기 세분화**: 현재 위탁 시 정산 방식과 비위탁 시 역산 방식 2가지만 구현되어 있으나, EDB InsuRateCalc2 L3082-3085는 `MPV_Bill AND SumWage==num AND num2==SumInsuDrug_100`인 경우를 별도 분기로 처리한다(역산 방식과 다른 공식). 이 조건에서 1원 오차가 발생할 수 있다. (`src/lib/calc-engine/modules/insurance/veteran.ts:calcMpvaPrice():L210-L226`)

- [🟡 Insufficient / Medium] **M61 고엽제 특수약품(648) 동시처방 분기**: `num9 > 0`(648 약품 존재) 시 MpvaPrice 산출 공식이 달라지나(`EDB L3094-3096`) 현재 구현은 num9==0 케이스만 처리한다. (`src/lib/calc-engine/modules/insurance/veteran.ts:calcVeteran():L314-L324`)

- [🟡 Insufficient / Medium] **M90 2018.01.01 이전 처리**: `getBohunRate()`에서 M90을 2018이전 0% 반환하는 것은 구현되어 있으나(L143), bohunRate=0인 상태에서 `calcMpvaPrice()`가 0을 반환하고 일반 부담률이 그대로 적용될 것인지 별도 검증이 필요하다. 2018 이전 M90=0%는 "보훈 적용 안 함 = 일반 환자 취급"을 의미한다는 정책 확인 필요. (`src/lib/calc-engine/modules/insurance/veteran.ts:getBohunRate():L143`)

---

## 6. 기타 관찰 사항

- **pubPrice 정의 불일치**: `types.ts`에서 `pubPrice`는 "청구액 = totalPrice - userPrice"로 문서화되어 있으나(L208), `veteran.ts`에서는 `pubPrice = insuPrice + mpvaPrice`(L417)로 채운다. 비보훈 케이스에서는 두 정의가 동일하지만, 보훈 3자배분이 있을 때 `pubPrice`가 "공단청구액만"인지 "공단+보훈 합산"인지 모호하다. CH06 §1의 파생 변수 정의와 types.ts 주석을 일치시켜야 한다.

- **PubPrice vs pubPrice 이름 충돌**: CH06 규격 문서에서 `PubPrice`는 공비(제3기관 지원금)를 의미하나, 우리 코드의 `pubPrice`는 공단청구액(= 총액 - 환자부담)을 의미한다. 용어가 달라 구현 혼선이 생길 수 있다. 공비는 별도 필드(예: `govSubsidy` 또는 `pubSubsidy`)로 분리하는 것이 권장된다.

- **CalcOptions에 특수공비 코드 필드 없음**: `M_Ps_Special_Pub`(302/101/102)에 해당하는 필드가 `CalcOptions`에 없다. 특수공비 재배분 구현 시 새 필드 추가가 필요하다.

- **SumInsuDrug_100 관련 입력 없음**: CH06 §4가 요구하는 `SumInsuDrug_100`(100%약품 보험분 합계), `SumUserDrug_100_Under_Insu/User/MpvPrice` 등 EXTYPE9 관련 중간값들이 `CalcOptions`에도 `CalcResult`에도 입력 경로가 없다. 약품금액 계산 단계(drug-amount.ts)에서 EXTYPE9 약품을 별도 집계하는 기능이 선행되어야 한다.

- **M81~M83은 G계열에만 존재하는 코드**: CH06 §6 표에서 C31/C32 분기가 있는 것은 처방전 발행 기관이 보훈병원인 경우 insuCode가 C31/C32로 기입될 수 있기 때문이다. 현재 copayment.ts는 insuCode가 C 계열이면 G 모듈이 아닌 C 경로로 처리(L68-L94)하므로, M81~M83 코드가 있어도 bohunCode M 코드 선처리 분기(L85-L88)를 통해 calcVeteran으로 진입한다. 이는 올바른 경로이나, C31/C32 내부에서 D타입 분기 누락이 문제로 남는다.

- **본인부담상한제 활성화 조건**: EDB는 약국 옵션(`M_OVER_USER_PRICE_YN`)으로 활성화 여부를 제어하나 현재 `CalcOptions`에는 해당 플래그가 없다. `yearlyAccumulated + incomeDecile`이 제공된 경우에만 적용하는 방식은 동일하지만, 옵션 플래그 부재는 의도치 않은 적용·미적용을 유발할 수 있다.

- **상한액 연도별 갱신 미지원**: `safety-net.ts`의 `ANNUAL_CAP_BY_DECILE`은 2024년 기준 하드코딩이다(L40-51). EDB는 연도 키(`P16` 설정값)로 조회하는 방식이나 현재 구현은 단일 연도 상수이다. 연도 파라미터 또는 DB 조회 방식으로 확장 필요.

- **M20 G타입의 MpvaPrice 리셋 후 처리 책임 주석**: `veteran.ts:L311`에 `// ★ G타입 M20: MpvaPrice는 0 (MpvaComm으로 전환 — Integration Lead 처리)` 주석이 있다. Integration Lead가 처리한다고 되어 있으나 현재 integration lead 레이어가 존재하지 않으므로 미구현 상태다.
