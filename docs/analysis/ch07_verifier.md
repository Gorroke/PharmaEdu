# CH07 교차 검증 보고서

> 작성자: CH07 Verifier (Phase 2 Team 7B)
> 작성일: 2026-04-06
> 챕터: CH07 — 반올림/절사 규칙
> 참조 분석 보고서: `ch07_analyst.md` (미작성 — 이 보고서는 독립 검증으로 작성됨)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

### 1-1. 함수별 1:1 매핑

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `RoundingHelper.cs:Round1():L35-L36` | `rounding.ts:round1():L14-L16` | ⚠ 동작 동일, 구현 다름 | §1-2 상세 |
| `RoundingHelper.cs:RoundN():L43-L44` | — | ✗ 미포팅 | 소수 N자리 사사오입 — 조제료 점수 등 미구현 |
| `RoundingHelper.cs:Trunc10():L54-L55` | `rounding.ts:trunc10():L22-L25` | ✓ 동일 | `Math.floor(v/10)*10` 완전 일치 |
| `RoundingHelper.cs:Trunc100():L65-L66` | `rounding.ts:trunc100():L32-L34` | ✓ 동일 | `Math.floor(v/100)*100` 완전 일치 |
| `RoundingHelper.cs:Ceil10():L76-L77` | — | ✗ 미포팅 | 보훈 청구액 올림 — §4-3 참조 |
| `RoundingHelper.cs:Round10():L87-L88` | `rounding.ts:round10():L41-L43` | ✓ 동일 | `Math.round(v/10)*10` 동작 일치 (양수 기준) |
| `RoundingHelper.cs:Round100():L98-L99` | — | ✗ 미포팅 | 비급여 십원단위 반올림 |
| `RoundingHelper.cs:Ceil100():L109-L110` | — | ✗ 미포팅 | 비급여 십원단위 올림 |
| `RoundingHelper.cs:ApplyNPayRound():L123-L132` | — | ✗ 미포팅 | 비급여 6종 분기 전체 없음 |
| `RoundingHelper.cs:RoundToInt():L142-L143` | `rounding.ts:roundToInt():L49-L51` | ✓ 동일 | `Math.floor(v+0.5)` 양수 동일 |

### 1-2. Round1 vs round1 — 핵심 차이 분석

**C# 원본** (`RoundingHelper.cs:L35-L36`):
```csharp
public static decimal Round1(decimal v)
    => Math.Round(v, 0, MidpointRounding.AwayFromZero);
```
- 타입: `decimal` → `decimal` (128비트 십진 부동소수점)
- 반올림 방향: `MidpointRounding.AwayFromZero` — 0.5는 항상 올림(양수), 내림(음수)

**TypeScript 포팅** (`rounding.ts:L14-L16`):
```typescript
export function round1(v: number): number {
  return Math.round(v);
}
```
- 타입: `number` → `number` (64비트 IEEE 754 배정밀도)
- 반올림 방향: `Math.round` = "round half to positive infinity" (0.5는 항상 양의 방향)

**주석의 설명** (`rounding.ts:L5-L7`): "JavaScript Math.round()는 round half to even이 아닌 round half up이지만 정확히는 음수 처리에서 차이가 있다. 약제비는 항상 양수이므로 Math.round = AwayFromZero."

**결론**: 양수 범위에서 `Math.round(v)` = `Math.Round(v, 0, AwayFromZero)` = "round half up". 동작은 동일하나 C#의 `decimal` 타입 정밀도를 JS `number`가 보장하지 못하는 구조적 차이 존재 (§5-1 참조).

### 1-3. Banker's Rounding 위험 확인

C#의 `Math.Round` 기본값(`MidpointRounding.ToEven`, 은행원 반올림)을 사용하면 `Math.Round(2.5m)` = 2 (짝수로 반올림). 그러나 C# 원본 `RoundingHelper.cs:L36`은 명시적으로 `MidpointRounding.AwayFromZero`를 지정하므로 `Math.Round(2.5m, 0, AwayFromZero)` = 3. 이는 JS `Math.round(2.5)` = 3과 동일하다. 따라서 **Banker's Rounding 문제는 C# 원본에서 이미 회피**되어 있고, TS 포팅도 정상이다.

**단, 주의**: 만약 미래에 C# `RoundingHelper` 외부 코드에서 `Math.Round(v)` 기본값(ToEven)을 사용한 계산 결과를 TS로 포팅할 경우 `Math.round(v)` != `Math.Round(v)` 상황이 발생한다.

### 1-4. Round10 — 유팜 To원단위사사오입 vs 우리 round10 비교

| 구현 | 공식 | 수식 |
|---|---|---|
| **유팜 `To원단위사사오입()`** | `Math.Round(src/10, AwayFromZero)*10` | 10원 단위 사사오입 |
| **우리 `round10()`** (`rounding.ts:L41-L43`) | `Math.round(v / 10) * 10` | 10원 단위 사사오입 |
| **C# `Round10()`** (`RoundingHelper.cs:L87-L88`) | `Math.Round(v/10m, 0, AwayFromZero)*10m` | 10원 단위 사사오입 |

세 구현 모두 양수 범위에서 **동일한 결과**를 산출한다. M04 "MathHelper 명칭 버그"는 우리 코드에는 존재하지 않는다 — 우리 `round10`은 이름과 동작이 일치한다.

### 포팅 정확도 종합 평가

핵심 4개 함수(round1, trunc10, trunc100, round10)의 양수 범위 동작은 C# 원본과 동일하다. 그러나 `RoundN`, `Ceil10`, `Round100`, `Ceil100`, `ApplyNPayRound` 5개 함수가 미포팅 상태다. 이 중 `Ceil10`은 M07(M09) 보훈 청구액 산출에, `ApplyNPayRound`는 비급여 절사 분기에 직접 연관된다. TS `rounding.ts`가 C# 대비 기능 범위 약 50%에 머물고 있다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 구현이 따르는 소스 | 비고 |
|---|---|---|---|---|---|---|
| **원미만 사사오입 (약품금액)** | `Int(x+0.5)` VB6 | 원미만 4사5입 (p.154) | `To원미만사사오입()` = `Math.Round(AwayFromZero)` | `(int)(x+0.5m)` | **공단/유팜 방향**: `Math.round(v)` | 4소스 양수 결과 동일 |
| **10원 미만 절사 (총액)** | `Int(x*0.1)*10` | 10원 미만 절사 (p.154) | `To십원미만내림()` = `Truncate(x/10)*10` | `Truncate(x/10m)*10m` | **4소스 일치**: `Math.floor(v/10)*10` | ✓ 완전 일치 |
| **100원 미만 절사 (건보 본인부담)** | `Int(x*0.01)*100` | 100원 미만 절사 (p.22) | `To백원미만내림()` = `Truncate(x/100)*100` | `Truncate(x/100m)*100m` | **4소스 일치**: `Math.floor(v/100)*100` | ✓ 완전 일치 |
| **10원 단위 사사오입 (수가 단가)** | DB 정수 로드 | 10원 미만 4사5입 (p.154) | `To원단위사사오입()` = `Round(x/10)*10` (M04 명칭 버그!) | DB int 저장 | **공단/유팜 방향**: `Math.round(v/10)*10` | M07 참조 |
| **의료급여 본인부담 절사** | 별도 함수/정액 | 100원 절사 추정 (p.22) | `To원단위버림()` = **10원 절사** | 2018이후 10원, 이전 100원 절사 | **유팜/EDB 방향**: `trunc10` | M08 미결 — §4-1 참조 |
| **보훈 MpvaPrice 산출** | `Int(x+0.5)*10` 사사오입 | — | `Ceiling` 올림 | `Truncate` 절사 (역산) | **EDB 방향**: 역산 `trunc10` (비위탁) / 정산 `trunc10` (위탁) | M09 — §3 참조 |
| **비급여 절사 6종** | 단일 cboBoHum5 | — | `ApplyNPayRound` 6종 | 외부 분기 | **미구현** | M11과 관련 — §4-3 참조 |
| **C31/C32 본인부담 절사** | 분기 없음 | — | 분기 없음 | 2016.09.29 전후 10→100원 변경 | **미구현** (C31/C32 처리 자체 없음) | M11 — §4-2 참조 |

### 4소스 불일치 항목 요약

- **M07 수가 단가 반올림**: 공단·유팜·EDB·비즈팜 모두 "외부 마스터에서 이미 결정된 정수"로 취급. 우리 TS calc-engine도 `getSugaFeeMap()`으로 조회된 값을 그대로 사용(외부 주입 방식). 엔진 내부 충돌 없음. 채택 소스: EDB 방식 (외부 주입).
- **M08 의료급여 본인부담 절사**: 유팜·EDB(2018이후)는 10원 절사, 공단 PDF는 100원 절사 시사. 우리는 `trunc10` 채택 (`medical-aid.ts:L33,L137,L157,L165`). 근거: 현행 유팜 현장 표준 추종. 법령 미확인 상태임을 명시 필요.
- **M09 보훈 청구액**: 비즈팜(사사오입), 유팜(올림), EDB(절사·역산) 3소스 불일치. 우리는 EDB 역산 방식(비위탁: `totalPrice - trunc10(totalPrice*(100-rate)/100)`, 위탁: `trunc10(totalPrice*rate/100)`) 채택 (`veteran.ts:L218-L225`). Ceil10 함수가 TS에 없으므로 유팜 방식 채택 불가.
- **M10 MathHelper 명칭 버그**: 우리 TS `rounding.ts`는 `round10` 등 숫자 명시 방식을 사용하여 유팜 명칭 버그가 없음. ✓ 안전.
- **M11 C31/C32 절사 변경**: 우리 `medical-aid.ts`는 C31/C32 보험코드를 인식하지 않음. EDB만 구현한 2016.09.29 날짜 분기도 없음. **미포팅**.

---

## 3. 의심 항목 (Suspicious)

- [🟡 Suspicious / Medium] **보훈 일반 감면 본인부담 trunc10 vs trunc100 혼용**: `veteran.ts:L330-L339`에서 감면율 30/50/60/90%이면 `trunc10`, 그 외이면 `trunc100`을 적용. C# `RoundingHelper.cs`의 주석(L58-L66)은 "건보/보훈 일반 본인부담금 → 100원 절사"로 `Trunc100`을 명시하고, `Ceil10`·`Trunc10`은 "의료급여 본인부담금 또는 총액"에 배정함. 그러나 C# `CopaymentCalculator.cs`의 실제 보훈 분기에서 일부 코드는 `trunc10`을 사용. **C# 원본을 라인 단위로 재확인하여 분기 기준을 명확히 해야 한다** (`src/lib/calc-engine/modules/insurance/veteran.ts:L330-L339`).

- [🟡 Suspicious / Medium] **round10 — Math.round(v/10)*10의 경계값 동작**: JS `Math.round(1.5/10)*10` = `Math.round(0.15)*10`. JS에서 `0.15`는 IEEE 754 이진수로 정확히 표현되지 않아 `Math.round(0.15) = 0`이 될 수 있음. 예: `round10(1.5) = 0`(버림) vs C# `Math.Round(1.5m/10m, 0, AwayFromZero)*10m = 10m`(올림). 이 오차는 조제료 점수 단가 계산에서 발생 가능 (`src/lib/calc-engine/rounding.ts:round10():L41-L43`).

- [🟢 Suspicious / Low] **roundToInt vs round1 이중 경로**: `rounding.ts`에 `round1`(L14-L16)과 `roundToInt`(L49-L51)가 공존하며 양수에서 동일한 결과를 반환. C# 원본에서도 `Round1()`과 `RoundToInt()`(L142-L143)가 "호환용"으로 구분됨. TS에서 `drug-amount.ts`는 `roundToInt`를 import하지 않고 `Math.floor(x+0.5)` 인라인 반복. 어느 함수를 표준으로 사용할지 정책 통일이 필요 (`src/lib/calc-engine/rounding.ts:L14,L49`).

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🟠 Insufficient / High] `medical-aid.ts:calcMedicalAid()`: EDB `InsuRateCalc2.cs:L3777-L3781`은 2018-01-01 이전/이후 기준으로 의료급여 본인부담을 각각 100원 절사/10원 절사로 분기. 우리 구현은 날짜 무관 `trunc10` 일괄 적용 (`src/lib/calc-engine/modules/insurance/medical-aid.ts:L137,L157,L165`). 2018년 이전 처방 이력 조회 시 오차 발생 가능.

- [🟠 Insufficient / High] `medical-aid.ts`: C31/C32 코드에 대한 2016.09.29 절사 단위 변경(10원→100원) 분기 없음. EDB만 구현. 현행 처방에서 C31/C32 코드는 여전히 발생함 (`src/lib/calc-engine/modules/insurance/medical-aid.ts` — C31/C32 인식 자체 없음).

- [🟡 Insufficient / Medium] `veteran.ts:calcVeteran()`: M20 이중감면율 2018.01.01 분기는 `getDoubleReductionRate()`에서 정상 처리됨(L170-L175). M90 감면율 2018.01.01 분기도 `getBohunRate()`에서 정상 처리됨(L143). 날짜 분기 자체는 이상 없음 — 단, **이 분기들이 충돌 분석 M09 항목과 독립됨을 확인**: M09는 보훈 MpvaPrice 산출 방식(올림/절사)에 관한 것이고, 날짜 분기는 감면율에 관한 것으로 별도 차원.

### 4-2. 보험 코드 분기

- [🟠 Insufficient / High] **C31/C32 보험코드 미인식**: `medical-aid.ts`는 `D10/D20/D40/D80/D90`만 처리. C31(의료급여 1종), C32(의료급여 2종) 코드가 입력되면 `insuCategory`가 'C'로 판단되어 `copayment.ts`의 건강보험 경로로 진입. C31/C32는 의료급여 코드임에도 건강보험 로직(trunc100, 30% 요율)이 적용되는 오류 발생 가능 (`src/lib/calc-engine/copayment.ts:L68-L102`).

- [🟢 Low] `rounding.ts`의 `ApplyNPayRound()` 미포팅으로 비급여 절사 6종(Floor10/Floor100/Round100/Ceil100/None/Round10) 지원 불가. 비급여 처방 계산 시 절사 옵션을 무시하고 원 단위 미처리 상태로 반환됨.

### 4-3. 특수 케이스 분기

- [🟠 Missing / High] **Ceil10 함수 미포팅**: `RoundingHelper.cs:Ceil10():L76-L77`은 보훈 청구액(일부 경로) 및 비급여 절사 옵션 중 "십원단위 올림"에 사용됨. TS `rounding.ts`에 `ceil10()`이 없어 유팜 `To원단위올림()` 계열 로직 재현 불가 — 만약 향후 유팜 호환 경로가 추가되면 이 함수가 없어 올바른 결과를 낼 수 없음.

- [🟡 Missing / Medium] **Round100, Ceil100 함수 미포팅**: `RoundingHelper.cs:L98-L110`. 비급여 절사 옵션 "십원단위 반올림/올림"에 필요. 현재 비급여 계산 미지원 상태이므로 즉각 영향은 없으나 비급여 기능 추가 시 동시 필요.

- [🟡 Missing / Medium] **RoundN 함수 미포팅**: `RoundingHelper.cs:RoundN():L43-L44`. 조제료 점수(소수 2자리), 1회투약량(소수 4자리) 등 중간 계산값 반올림에 필요. 현재 TS calc-engine에서 이런 중간 계산을 수행하지 않으므로 즉각 영향은 없음.

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도 — decimal vs number 경계 케이스

핵심 위험은 `round10()`의 `v/10` 중간 계산이다.

**경계 케이스 분석**:

| 입력 | C# `Round10(decimal)` | TS `round10(number)` | 일치 여부 |
|---|---|---|---|
| `785.975m` | `Math.Round(785.975m/10m)*10m` = `Math.Round(78.5975m)*10m` = `79*10m` = **790** | `Math.round(785.975/10)*10` = `Math.round(78.5975)*10` = `79*10` = **790** | ✓ |
| `1745m` | `Math.Round(1745m/10m)*10m` = `Math.Round(174.5m)*10m` = `175*10m` = **1750** | `Math.round(1745/10)*10` = `Math.round(174.5)*10` = `175*10` = **1750** | ✓ |
| `0.5m` | `Math.Round(0.5m/10m)*10m` = `Math.Round(0.05m)*10m` = `0*10m` = **0** | `Math.round(0.05)*10` = `0*10` = **0** | ✓ |
| `5m` | `Math.Round(5m/10m, 0, AwayFromZero)*10m` = `Math.Round(0.5m)*10m` = **10** | `Math.round(5/10)*10` = `Math.round(0.5)*10` = `1*10` = **10** | ✓ |
| `1.5m` (조제료 소수점) | `Math.Round(1.5m/10m, 0, AwayFromZero)*10m` = `Math.Round(0.15m)*10m`. 0.15m은 decimal에서 정확히 0.15. `Math.Round(0.15m, 0, AwayFromZero)` = **0**. 결과: **0** | `Math.round(1.5/10)*10` = `Math.round(0.15)*10`. JS: `0.15` = 0.1499999999... (이진수 오차). `Math.round(0.15)` = **0**. 결과: **0** | ✓ (같은 이유로 일치, 단 decimal은 논리적 0.15, JS는 오차로 인한 0) |
| `15m` | `Math.Round(15m/10m)*10m` = `Math.Round(1.5m, 0, AwayFromZero)*10m` = `2*10m` = **20** | `Math.round(15/10)*10` = `Math.round(1.5)*10` = `2*10` = **20** | ✓ |
| `25m` | `Math.Round(25m/10m)*10m` = `Math.Round(2.5m, 0, AwayFromZero)*10m` = `3*10m` = **30** | `Math.round(25/10)*10` = `Math.round(2.5)*10` = `3*10` = **30** | ✓ (JS Math.round(2.5)=3, C# AwayFromZero=3) |

**결론**: 실용적으로 사용되는 범위(약제비 계산 — 양의 정수 또는 소수 2자리 이하)에서는 `round10` 오차 발생 가능성이 낮다. 그러나 `v/10`이 정확히 `x.5` 형태의 소수일 때 JS 이진 표현 오차가 반올림 방향에 영향을 줄 수 있으므로, 조제료 점수×단가 계산처럼 소수가 자주 등장하는 곳에서 테스트 강화 권장.

- [🟠 High] **trunc10/trunc100의 부동소수점 입력 누적 오차**: `totalPrice * 0.3` (총액의 30%) 계산 시 JS `number`에서 부동소수점 오차 발생 가능. 예: `trunc10(2130 * 0.3)` — 테스트(`rounding.test.ts:L53`)에서 `trunc10(2130 * 0.3) === 630` 통과. 단 이 케이스는 `0.3` 표현 오차로 인해 `2130 * 0.3 = 638.9999...`가 될 수 있음. `Math.floor(639.0/10)*10 = 630` 이 되는 것이 아니라, `Math.floor(638.999.../10)*10 = Math.floor(63.8999...)*10 = 63*10 = 630`이 되어 우연히 통과하는 상황. 총액이 달라지면 오차 방향이 달라질 수 있음 (`src/lib/calc-engine/rounding.ts:trunc10():L22-L25`).

### 5-2. Null 안전성

- [🟡 Medium] `rounding.ts`의 모든 함수는 `number` 타입 파라미터에 null 체크 없음. 호출 측에서 타입이 보장된다면 문제없으나, 런타임에서 `NaN` 또는 `undefined` 유입 시 `Math.floor(NaN/10)*10 = NaN*10 = NaN`이 반환되어 이후 계산 전체가 NaN으로 오염. 방어 코드 고려 권장 (`src/lib/calc-engine/rounding.ts:L22-L43`).

### 5-3. 경계 조건

- [🟢 Low] 모든 반올림 함수에서 음수 입력이 정의되지 않음. C# `RoundingHelper.cs`도 "약제비 계산은 항상 양수"라고 주석에 명시(L16-L18). TS `rounding.ts`도 동일한 전제 조건을 주석으로 문서화하면 충분.

- [🟢 Low] `trunc10(v)`, `trunc100(v)` — `v = 0` 입력: `Math.floor(0/10)*10 = 0`. 정상.

---

## 6. 기타 관찰 사항

### M07 수가 단가 반올림 — 우리는 어느 소스를 따랐는가

`round10()`이 구현되어 있으나, `dispensing-fee.ts` 또는 `direct-dispensing.ts`에서 수가 단가 산출 시 `round10()`을 호출하는 코드는 존재하지 않는다. `getSugaFeeMap()`으로 DB에서 로드된 값이 이미 10원 단위로 정수 저장되어 있다는 EDB 방식 전제를 따른다. M07의 실질 충돌(엔진 내부)은 없으며, **외부 입력 시 이미 10원 단위 사사오입 적용 완료**라는 전제 조건을 문서화해야 한다.

### M08 의료급여 본인부담 절사 — 우리는 어느 소스를 따랐는가

`medical-aid.ts`에서 `trunc10`을 일관 사용 (L33 import, L137 B014, L157 총액<정액, L165 정액 적용). **유팜 방식(10원 절사) + EDB 2018이후 방식**을 채택. 공단 PDF 원문에서 "의료급여 10원 절사" 명문 규정이 확인되지 않았으므로 근거 부족 상태. 법령 원문 확인 후 재검토 필요.

### M09 보훈 청구액 반올림 — 우리는 어느 소스를 따랐는가

`veteran.ts:calcMpvaPrice():L210-L226`:
- 위탁(`isMPVBill=true`): `trunc10(totalPrice * bohunRate / 100)` — **정산 방식, 절사**
- 비위탁(`isMPVBill=false`): `totalPrice - trunc10(totalPrice * (100 - bohunRate) / 100)` — **역산 방식**

역산 방식에서 MpvaPrice = `totalPrice - trunc10(비보훈분)`. 비보훈분을 먼저 절사하면 MpvaPrice는 절사 오차만큼 커진다(올림 효과). 유팜의 `Ceil10`(명시적 올림)과 실질적으로 근사한 결과를 낼 수 있으나, 정확히 동일하지는 않다. 예: `totalPrice=1000, bohunRate=30%` 일 때 — `비보훈분=trunc10(700)=700`, `MpvaPrice=300`. 유팜 `Ceil10(1000*0.3)=Ceil10(300)=300`. 이 케이스에서는 동일. 비즈팜 사사오입: `round10(300)=300`. **이 케이스들은 모두 300이지만**, `totalPrice=1009, bohunRate=30%`일 때 — `비보훈분=trunc10(706.3)=700`, `MpvaPrice=309`. 유팜 `Ceil10(302.7)=310`. 비즈팜 `round10(302.7)=300`. **EDB 역산(309), 유팜 올림(310), 비즈팜 사사오입(300)이 모두 달라진다**. M09 충돌은 현실적이며, EDB 역산 방식 채택 근거를 명시해야 한다.

### M10 MathHelper 명칭 버그 — 우리 코드의 위험 없음

우리 `rounding.ts`는 `round1`, `trunc10`, `trunc100`, `round10` 등 **숫자를 명시한 이름**을 사용하여 유팜의 "원단위=10원단위" 혼동 버그가 없다. 타 팀이 유팜 MathHelper 코드를 참조하여 포팅할 경우 반드시 구현 코드를 확인해야 한다는 주의사항을 공유 필요.

### M11 C31/C32 절사 변경 — 우리는 어느 소스를 따랐는가

C31/C32 보험코드 처리 자체가 없으므로 이 항목은 "미구현"이다. EDB만 구현한 2016.09.29 날짜 분기도 없다. 현재 `copayment.ts`에서 C31/C32가 입력되면 `insuCategory='C'`로 처리되어 건강보험 경로(trunc100, 30% 요율)를 타게 되는데, 이는 의료급여 코드를 건강보험으로 잘못 처리하는 오류다. [🔴 Critical] 수준의 분기 누락.

### 집계자 통보 사항

다음 2건을 Critical로 즉시 통보한다:

1. **C31/C32 보험코드 건강보험 경로 오진입**: `copayment.ts:L68`에서 `insuCategory` 기반 분기 시 C31/C32가 'C'로 처리되어 의료급여 규칙(trunc10, 정액) 대신 건강보험 규칙(trunc100, 30%)이 적용됨 — 해당 코드 처방 건 전체 오계산.
2. **M08 의료급여 본인부담 절사 법령 미확인**: `trunc10` 채택 근거가 유팜 관행뿐이며, 공단 원문 및 법령 미확인. 만약 규정이 100원 절사라면 모든 의료급여 본인부담금이 90원까지 과대 산정됨.

---

*소스 참조:*
- *`C:\Projects\DSNode\약제비 분析용\YakjaebiCalc\YakjaebiCalc.Engine\Utilities\RoundingHelper.cs`*
- *`C:\Projects\DSNode\약제비 분析용\output\CH01_CH07_소스간_모순_충돌_分析.md`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\rounding.ts`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\copayment.ts`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\modules\insurance\medical-aid.ts`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\modules\insurance\veteran.ts`*
- *`C:\Projects\KSH\PharmaEdu\src\lib\calc-engine\__tests__\rounding.test.ts`*

**[약제비 분析용]**
