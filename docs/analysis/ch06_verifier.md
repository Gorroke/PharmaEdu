# CH06 교차 검증 보고서

> 작성자: CH06 Verifier (Phase 2 Team 6B)
> 작성일: 2026-04-06
> 챕터: CH06 — 3자배분 / 공비 / 특수공비 / 보훈약국 / 본인부담상한제
> 참조 분석 보고서: `ch06_analyst.md` (미작성 — 이 보고서가 최초 분석 겸 검증)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

### 1-1. 핵심 함수 매핑 테이블

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `CopaymentCalculator.cs:CalcMpvaPrice():L810` | `veteran.ts:calcMpvaPrice():L210` | ✓ 동일 | 비위탁 역산 공식 일치 확인 (§2 상세) |
| `CopaymentCalculator.cs:ApplyBohunPharmacy():L1040` | `veteran.ts:calcVeteran() 내 Step 7:L362` | ⚠ 부분 | M81~M83 G타입 비위탁 로직 일치. C31/C32/D타입 분기는 TS 내 Integration Lead 위임으로 처리되나 미연결 상태 |
| `CopaymentCalculator.cs:ApplyOverUserPrice():L1085` | `safety-net.ts:applySafetyNet():L151` | ⚠ 부분 | 핵심 초과금 산출 로직은 일치. C#은 DB에서 `P16` 상한액 조회, TS는 `ANNUAL_CAP_BY_DECILE` 상수 테이블 사용 — 연도별 갱신 불가 구조적 차이 존재 |
| `CopaymentCalculator.cs:ApplySpecialPub():L939` | TS 미포팅 | ✗ 미포팅 | 특수공비 302/101/102 분기 전혀 없음 (§4 상세) |
| `CopaymentCalculator.cs:CalcMpvaComm():L1146` | TS 미포팅 | ✗ 미포팅 | MpvaComm(보훈 비급여 감면분) 완전 누락 |
| `CopaymentCalculator.cs:GetBohunRate():L766` | `veteran.ts:getBohunRate():L128` | ✓ 동일 | M10/M20/M30/M50/M60/M61/M81/M82/M83/M90 10개 코드 일치 |
| `CopaymentCalculator.cs:GetDoubleReductionRate():L791` | `veteran.ts:getDoubleReductionRate():L170` | ⚠ 수식 차이 | C#은 -1 반환(비대상), TS는 0 반환 — 이하 §2-1 참조 |
| EDB `PrsBillCalcM.InsuRateCalc2.cs:L3100~3101` | `veteran.ts:calcMpvaPrice():L223` | ✓ 동일 | 비위탁 역산 패턴 동일 |
| EDB `PrsBillCalcM.InsuRateCalc3.cs:L3952~3984` | `veteran.ts:calcVeteran() Step 7:L362` | ✓ 동일 | G+비위탁 SumUser=0, MpvaPrice+=RealPrice 패턴 일치 |

### 1-2. 포팅 정확도 종합 평가

`CalcMpvaPrice()`의 역산 공식은 C#과 TS가 정확히 일치한다. `GetBohunRate()` 10개 코드 분기와 M81~M83 G타입 비위탁 처리도 일치한다. 그러나 `ApplySpecialPub()`(특수공비 302/101/102)와 `CalcMpvaComm()`(보훈 비급여 감면분)은 TS에 완전히 누락되어 있어, 특수공비 대상 처방이나 보훈 비급여 처방 건에서 금액 오류가 발생한다. `ApplyOverUserPrice()`는 초과금 산출 로직은 동일하나, C#은 `_repo.GetConfigValue("P","P16",year)`로 연도별 상한액을 DB에서 동적 조회하는 반면 TS는 2024년 기준 상수 테이블(`ANNUAL_CAP_BY_DECILE`)로 하드코딩되어 있다.

---

## 2. CalcMpvaPrice() 역산 검증

### 2-1. C# 원본 수식 (CopaymentCalculator.cs:L810~848)

```
비위탁(비MPV):
  nonBohun = Trunc10(총액 × (100 - bohunRate) / 100)
  MpvaPrice = 총액 - nonBohun

위탁(MPV):
  MpvaPrice = Trunc10(총액 × bohunRate / 100)
```

- `CopaymentCalculator.cs:L844-846` 비위탁 역산
- `CopaymentCalculator.cs:L839-840` 위탁 정산

### 2-2. TypeScript 구현 수식 (veteran.ts:L210~226)

```typescript
if (isMPVBill) {
  return trunc10(totalPrice * bohunRate / 100);   // 위탁: 정산
} else {
  const nonBohun = trunc10(totalPrice * (100 - bohunRate) / 100);
  return totalPrice - nonBohun;                    // 비위탁: 역산
}
```

**검증 결과: C# 수식과 100% 일치.** EDB `InsuRateCalc2.cs:L3076~3078` (역산 `PbMpvaPrice = num - Trunc10(num × (100-rate)/100)`)과도 동일 패턴이다.

### 2-3. GetDoubleReductionRate() 차이점 — 의심 항목

| 구분 | C# 반환값 | TS 반환값 |
|------|----------|---------|
| M20/M61이 아닌 경우 | `-1` (음수 센티널) | `0` |
| M20 2018 이후 | `10` | `10` |
| M20 2018 이전 | `20` | `20` |

C#(`CopaymentCalculator.cs:L794`)은 비대상 코드에 `-1`을 반환하여 `num7 >= 0` 조건으로 M61 역산 분기를 제어한다. TS(`veteran.ts:L175`)는 `0`을 반환하여 `num7 > 0` 조건이 false가 되므로 M61 분기에 진입하지 않아 실질적으로 동일하게 동작한다. **현재 로직상 오류는 없으나**, C# 센티널 의미(-1)와 다른 방식이므로 코드 의도 명확화가 필요하다.

---

## 3. M81~M83 보훈약국 비위탁 — 환자부담 0원 검증

### 3-1. C# 원본 (CopaymentCalculator.cs:L1040~1074)

```csharp
// G타입 + 비위탁: 환자부담 0, 보훈전액부담
else if (category == InsuranceType.Veterans)   // L1065
{
    result.SumUser = 0m;                        // L1067
    if (!opt.IsSimSa)
        result.UserPrice = 0m;                  // L1070
    result.MpvaPrice += result.RealPrice;       // L1072
}
```

**C31/C32 분기 (L1050~1052):** `SumUser = RealPrice` (환자가 RealPrice만큼 부담)
**D타입 분기 (L1054~1057):** `SumUser = RealPrice`
**G타입 위탁(L1059~1062):** `SumUser = RealPrice`

### 3-2. EDB 원본 (PrsBillCalcM.InsuRateCalc3.cs:L3952~3984)

```
case "M81"/"M82"/"M83":
  C31/C32 → SumUser = RealPrice               [3961]
  D타입   → SumUser = RealPrice               [3965]
  G+MPV   → SumUser = RealPrice               [3969]
  else    → SumUser = 0, UserPrice = 0 (비심사), MpvaPrice += RealPrice  [3973~3978]
```

EDB `L3973~3978`과 C# `L1065~1073`의 G타입+비위탁+비심사 처리가 완전히 일치한다.

### 3-3. TypeScript 구현 (veteran.ts:L362~379)

```typescript
if (isVeteransInsurance && !isMPVBill) {
  const realPrice = userPrice;
  if (!isSimSa) {
    userPrice = 0;               // UserPrice = 0
  }
  mpvaPrice += realPrice;        // MpvaPrice += RealPrice
  insuPrice = totalPrice - userPrice - mpvaPrice;
}
```

**검증 결과:** G타입+비위탁+비심사 환자부담 0원 처리 정확히 포팅됨.

**미연결 부분:** C31/C32 및 D타입 분기는 `veteran.ts`의 주석에 "Integration Lead가 연결할 때 별도 분기 추가 필요"로 위임 처리됨. 현재 `calcVeteran()`이 G계열에서만 호출되는 구조라면 실질 누락은 없으나, C타입/D타입 보훈 코드 입력 시 M81~M83 SumUser 재배분이 작동하지 않을 위험이 있다.

---

## 4. 특수공비 302/101/102 분기

### 4-1. C# 원본 (CopaymentCalculator.cs:L939~1017)

보험유형별 3분기:

| 보험유형 | 302 | 101 | 102 | 기타 |
|----------|-----|-----|-----|------|
| C타입 | NPay확장=N: `Pub100=SumInsuDrug100, SumUser-=SumInsuDrug100` / NPay확장=Y: `Pub100=SumUser, SumUser=0` | `Pub100=SumInsuDrug100, SumUser-=SumInsuDrug100` | **pass (미처리)** | `SumUser-=, InsuPrice+=, SumInsure+=` |
| D타입 | 동일 (C타입과 같음) | 동일 | 미처리 | 미처리 |
| G타입 | `Pub100=SumUser, SumUser=0` | 미처리 | 미처리 | 미처리 |

- `CopaymentCalculator.cs:L952~981` C타입 switch
- `CopaymentCalculator.cs:L983~1005` D타입 switch
- `CopaymentCalculator.cs:L1006~1016` G타입 switch

EDB `InsuRateCalc3.cs:L3998~4062` 와 C# 분기 구조가 일치함:
- C타입 302 NPay확장=N: EDB `L4008-4009`, C# `L964-965`
- C타입 102: EDB `L4026-4027` (pass), C# `L972-974` (pass) — **두 소스 모두 102를 미처리로 동일하게 구현**

### 4-2. TypeScript 구현

`safety-net.ts`, `veteran.ts`, `index.ts` 어디에도 `SpecialPub`, `Pub100Price`, `specialPubCode` 처리가 존재하지 않는다.

**포팅 상태: 완전 누락 (Missing)**

---

## 5. BUG-001 Dead Code (비즈팜) 검증

비즈팜 `Ppre1000__.frm` 라인 9825:
```vb
If intZBaseAmt <> intZBaseAmt Then   ' 항상 False — dead code
```

`intZBaseAmt <> intZBaseAmt`는 동일 변수를 자기비교하므로 항상 False이다. 이 조건의 Else 분기 코드는 실행 경로에 포함되지 않는다.

**C# 구현(`CopaymentCalculator.cs`):** 이 dead code에 대응하는 코드 없음 — 정상 처리 경로만 구현되어 있어 비즈팜 버그가 재현되지 않는다. `ch06-3자배분.md §10-2-(B)`에서도 "dead code — 구현 시 무시"로 명시됨.

**TypeScript 구현:** 마찬가지로 해당 dead code 영향이 없다.

**검증 결과:** BUG-001은 비즈팜 고유 문제이며 C# 및 TS 구현 모두 이 버그를 포함하지 않는다.

---

## 6. 본인부담상한제 적용 흐름 (소득분위별 상한액)

### 6-1. C# 원본 흐름 (CopaymentCalculator.cs:L1085~1118)

```
Step 1: opt.OverUserPriceYN == "Y" 여부 확인   [L1087]
Step 2: _repo.GetPbRealPrice(psCode, dosDate, custId)  →  연간 누적 RealPrice 조회  [L1091]
Step 3: _repo.GetConfigValue("P", "P16", year)  →  연도별 상한액 DB 조회  [L1095]
Step 4: total = cumulative + result.RealPrice   [L1099]
Step 5: if (total > annualLimit):
          over = total - annualLimit
          if (over >= RealPrice): OverUserPrice = RealPrice, RealPrice = 0
          else:                   RealPrice -= over, OverUserPrice = over
Step 6: SumUser -= OverUserPrice   [L1117]
```

핵심: **연간상한액은 `"P16"` config key로 DB에서 연도별로 조회** (`CopaymentCalculator.cs:L1094-1096`).

### 6-2. TypeScript 구현 (safety-net.ts)

```typescript
// safety-net.ts:L40~51 — 2024년 기준 상수 테이블
export const ANNUAL_CAP_BY_DECILE: Record<number, number> = {
  1:  870_000,
  2:  1_030_000,
  ...
  10: 5_980_000,
};
```

적용 경로 (`index.ts:L151~155`):
```typescript
if (opt.yearlyAccumulated !== undefined && opt.incomeDecile !== undefined) {
  const snResult = applySafetyNet(opt, r, opt.yearlyAccumulated, opt.incomeDecile);
}
```

### 6-3. 4소스 비교 (소득분위별 상한액)

| 항목 | C# (EDB 계열) | TS 구현 | 비고 |
|------|--------------|---------|------|
| 상한액 결정 | DB 동적 조회 (`P16`, 연도별) | 2024 상수 테이블 하드코딩 | 구조적 차이 |
| 누적 RealPrice 소스 | DB 쿼리 (`GetPbRealPrice`) | 호출자가 `yearlyAccumulated` 직접 전달 | 아키텍처 차이 |
| 소득분위 | N/A (C#은 단일 상한액 사용) | `incomeDecile` 파라미터 | TS가 더 세분화됨 |
| 초과금 계산 공식 | `over = total - annualLimit` | 동일 | 일치 |
| 음수 보정 | `min(over, RealPrice)` | `Math.min(raw, currentUserPrice)` | 동일 |

**C#은 소득분위를 명시적으로 구분하지 않고 단일 `P16` 상한액을 사용**한다. TS의 `ANNUAL_CAP_BY_DECILE` 10개 분위 체계는 보건복지부 고시 기준으로 정확하나, 상수가 2024년에 고정되어 연도 변경 시 코드 수정이 필요하다.

---

## 7. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 TS 구현 | 비고 |
|-----------|--------|-----------|------|-----|------------|------|
| MpvaPrice 역산 | 역산 방식 (006 §7) | p.576 항등식 명시 | 역산 방식 | `InsuRateCalc2.cs:L3100` | **EDB 일치** | 4소스 일치 |
| 보훈감면율 테이블 | 005 코드표 10종 | p.575 | 동일 10종 | `GetBohunRate()` | **4소스 일치** | |
| M81~M83 G비위탁 환자0원 | 확인됨 | p.585 | 확인됨 | `L3973~3978` | **EDB 일치** | |
| 특수공비 302/101/102 | 006 §7 있음 | p.579 있음 | 있음 | `L3998~4062` | **미포팅** | Critical |
| MpvaComm 산출 | 있음 | 명시 없음 | 있음 | `L3107~3232` | **미포팅** | High |
| 본인부담상한제 트리거 | `OverUserPriceYN` 플래그 | 사후정산 원칙 | 있음 | `P16` DB 조회 | 파라미터 기반 | 아키텍처 차이 |
| D타입 M20 절사 단위 시기별 | 불명확 | 불명확 | 불명확 | `L3773~3783` (2018 기준) | `veteran.ts:L565-567` | EDB 일치 |
| 102 미처리 | 006 L4026 pass | 불명확 | 불명확 | `L4026~4027` pass | 미포팅(=pass와 동치) | EDB/C# 일치 |

### 4소스 불일치 항목 요약

- `특수공비 302/101`: 비즈팜/유팜/EDB/C# 모두 구현 — TS만 완전 누락. 302 대상 처방에서 `SumUser`가 잘못 산출됨
- `MpvaComm`: EDB `L3107~3232`의 15개 분기(보훈병원/비위탁/심사 등)가 C#에는 단순화 구현(`L1146~1172`), TS는 전혀 없음
- `본인부담상한제 상한액 소스`: EDB/C#은 DB `P16` 연도별 동적 — TS는 2024 상수. 2025년 이후 상한액 갱신 불가

---

## 8. 의심 항목 (Suspicious)

- [🔴 Suspicious / Critical] **특수공비 302 SumUser 처리 미포팅**: `safety-net.ts`, `veteran.ts`, `index.ts` 모두 `specialPub` 필드를 참조하지 않음. C#의 `ApplySpecialPub():L939`에서 302 코드 시 `SumUser -= SumInsuDrug100` 또는 `SumUser = 0` 처리가 없어 302 대상 처방 건의 환자 수납액이 과다 산출됨
- [🔴 Suspicious / Critical] **MpvaComm 완전 누락**: `CalcMpvaComm():CopaymentCalculator.cs:L1146`는 보훈 비급여 감면분을 `SumUser`에서 차감하는 핵심 처리. TS의 `calcVeteran()` 결과물에 `mpvaComm` 필드가 없어 보훈 환자의 비급여 수납액이 과다 산출됨
- [🟠 Suspicious / High] **`getDoubleReductionRate()` 비대상 반환값 시맨틱 차이**: `CopaymentCalculator.cs:L794`는 비대상 시 `-1` 반환, `veteran.ts:L175`는 `0` 반환. M61 분기 조건 `num7 >= 0`(C#) vs `num7 > 0`(TS)에서 `0` 전달 시 동작이 상이할 수 있음. 현재 M61은 `getDoubleReductionRate()` 결과가 10/20이므로 실질 오류는 없으나 추후 로직 변경 시 위험
- [🟠 Suspicious / High] **본인부담상한제 상한액 2024 고정**: `safety-net.ts:L40~51`의 `ANNUAL_CAP_BY_DECILE`은 2024년 고시 기준이나 연도 파라미터가 없음. 2025년 이후 상한액이 갱신되어도 코드 수정 전까지 구버전 금액 적용

---

## 9. 위험 분기 누락

### 9-1. 날짜 기준 분기

- [🟠 Insufficient / High] `safety-net.ts:ANNUAL_CAP_BY_DECILE`: 연도별 상한액 분기 없음. C#은 `GetConfigValue("P","P16",year)`로 연도별 DB 조회 (`CopaymentCalculator.cs:L1094~1096`). 2025년 이후 상한액 변동 시 오산정
- [🟡 Insufficient / Medium] `veteran.ts:calcMpvaPrice()`: `IsMPVBill` 조건 분기 외에, EDB `InsuRateCalc2.cs:L3082` `PbSumWage == num && num2 == m_pb_SumInsuDrug_100` 특수조건(위탁 역산 방식 전환) 미포팅. 일반적 케이스에서는 영향 없으나, 조제료 합계=전체 금액이고 비급여=100%약품만인 경우 위탁에서도 역산이 적용되어야 하는 케이스 누락

### 9-2. 보험 코드 분기

- [🔴 Missing / Critical] `calcVeteran()` 외부 — C31/C32/D타입 + M81~M83 시 `SumUser = RealPrice` 처리 미연결: `CopaymentCalculator.cs:L1050~1057` 대응 분기가 TS Integration Lead 연결 전 작동 안 함
- [🟠 Insufficient / High] EDB `InsuRateCalc3.cs:L3923~3941` M20 G타입 `MpvaPrice = InsuPrice; InsuPrice = 0` 처리: C#에서는 `CalcCopay_G():L730~736` 내에서 처리되고, `veteran.ts:L311`에서 `mpvaPrice = 0` 리셋 후 addMpva로 전환하는 방식이 상이. EDB는 G타입 M20에서 InsuPrice 전체를 MpvaPrice로 전환하지만, TS는 addMpva만큼만 보훈 전환하는 구조 차이 존재

### 9-3. 특수 케이스 분기

- [🟠 Missing / High] D타입 B014 2019년 이후 MpvaPrice 산출 허용 분기: `CopaymentCalculator.cs:L823~829`의 `B014+D타입+2019이후 fall-through` 로직이 `veteran.ts:calcMpvaPrice()`에 없음. B014 수급권자 D타입 보훈 처방에서 MpvaPrice가 항상 0으로 산출됨
- [🟡 Insufficient / Medium] `ApplyBohunPharmacy()` C# L1068 `opt.IsSimSa` 체크: TS에서는 `!isSimSa` 분기가 존재하나 (`veteran.ts:L372`), `isSimSa` 필드가 `CalcOptions` 타입에 선택적으로 정의되어 있어 undefined 입력 시 `?? false`로 처리됨 — 현행 기본값 처리 적절하나 명시적 검증 필요

---

## 10. 단위 / 타입 안전성

### 10-1. 수치 정밀도

- [🟠 High] `veteran.ts:calcMpvaPrice():L223`: `trunc10(totalPrice * (100 - bohunRate) / 100)`에서 `totalPrice`는 JS `number`. C#은 `decimal` 타입으로 `Trunc10(num * (100m - m_bohunRate) / 100m)`. 총액이 수십만 원 이하 정수 범위면 실질 오차 없으나, 향후 소수점 약가가 포함될 경우 정밀도 차이 발생 가능
- [🟡 Medium] `safety-net.ts:calcSafetyNetOverage():L130`: `total = yearlyAccumulated + currentUserPrice`. 두 값 모두 JS `number` — 연간 누적 수십만 원 정수 범위에서는 IEEE 754 오차 없음

### 10-2. Null 안전성

- [🟡 Medium] `safety-net.ts:applySafetyNet():L160`: `result.userPrice`에 대한 null/undefined 체크 없음. `CalcResult.userPrice`가 undefined인 경우 `NaN`이 전파될 수 있음
- [🟡 Medium] `veteran.ts:calcVeteran():L260`: `options.bohunCode ?? ''` 처리로 null 안전하나, `options.dosDate`는 빈 문자열 시 날짜 비교 `>= '20180101'`가 false로 처리되어 2018 이전 로직 적용. 입력 검증 없음

### 10-3. 경계 조건

- [🟡 Medium] `safety-net.ts:calcSafetyNetOverage():L129`: `ANNUAL_CAP_BY_DECILE[decile] ?? ANNUAL_CAP_BY_DECILE[10]` — 분위가 0이거나 11 이상인 경우 10분위 상한액(5,980,000원)으로 폴백. 잘못된 분위 입력에 대한 경고 없음
- [🟢 Low] `veteran.ts:getBohunRate():L129`: `if (!bohunCode) return 0`으로 빈 문자열 처리됨. 정상 동작.

---

## 11. 항등식 검증 가능 여부

### 11-1. 3자배분 항등식

```
totalPrice = userPrice + insuPrice + mpvaPrice
```

**C# 검증 위치:** `CopaymentCalculator.cs:L207~223` — InsuPrice 음수 시 MpvaPrice→UserPrice 순서 차감 보정.
**TS 검증 위치:** `veteran.ts:L343~356` — 동일 패턴 구현됨.

현재 TS `calcVeteran()`이 반환하는 필드에서 `totalPrice = userPrice + insuPrice + mpvaPrice` 항등식은 수학적으로 항상 성립한다. **단, `ApplySpecialPub()` 미포팅으로 인해 특수공비 302 적용 후 `SumUser` 변동이 `pubPrice/insuPrice` 재배분에 반영되지 않으므로, 특수공비 대상 건에서는 `SumUser` 기반 파생 항등식이 성립하지 않는다.**

### 11-2. SumUser 항등식

```
SumUser = RealPrice + 비급여약품 + 비급여수가 + Premium + UserPrice100 - MpvaComm - OverUserPrice
```

**현재 TS에서 검증 불가:** `MpvaComm`과 `OverUserPrice`가 선택적(optional) 필드이고 `ApplySpecialPub()` 미포팅으로 `SumUser`가 정확히 산출되지 않아 항등식 단위 테스트 작성이 불가능한 상태이다.

---

## 12. EDB InsuRateCalc2/3 라인 직접 인용 요약

| 주제 | EDB 파일 | 라인 | 대응 C# | TS 포팅 |
|------|---------|------|---------|--------|
| 비위탁 MpvaPrice 역산 | InsuRateCalc2.cs | L3076~3078 | CopaymentCalculator.cs:L844~846 | veteran.ts:L222~225 ✓ |
| 위탁 MpvaPrice 정산 | InsuRateCalc2.cs | L3089 | CopaymentCalculator.cs:L839~840 | veteran.ts:L219~220 ✓ |
| D/C21/C31/C32+비M10 MpvaPrice=0 | InsuRateCalc2.cs | L3103~3106 | CopaymentCalculator.cs:L816~833 | veteran.ts 미포팅 ✗ |
| M81~M83 G비위탁 SumUser=0 | InsuRateCalc3.cs | L3973~3978 | CopaymentCalculator.cs:L1065~1072 | veteran.ts:L369~376 ✓ |
| M20 G타입 MpvaPrice→InsuPrice 전환 | InsuRateCalc3.cs | L3926~3929 | CopaymentCalculator.cs:L730~736 | veteran.ts:L311 (방식 차이) ⚠ |
| 공비(PubPrice) G타입 | InsuRateCalc3.cs | L3868~3870 | CopaymentCalculator.cs:L871~880 | TS 미포팅 ✗ |
| 특수공비 302/101/102 | InsuRateCalc3.cs | L3998~4062 | CopaymentCalculator.cs:L939~1017 | TS 미포팅 ✗ |
| 3자배분 InsuPrice 음수 보정 | InsuRateCalc3.cs | L3909~3943 | CopaymentCalculator.cs:L207~223 | veteran.ts:L343~356 ✓ |

---

## 13. 기타 관찰 사항

### 13-1. pubPrice 필드 의미 불일치

`veteran.ts:L417`에서 `pubPrice: insuPrice + mpvaPrice`로 반환한다. C# 모델에서 `PubPrice`는 공비(제3기관 지원금)이고 `InsuPrice`는 공단청구액이며 두 개념이 분리되어 있다. TS에서 이를 합산하여 `pubPrice`로 반환하는 것은 의미상 혼용이다. Integration Lead가 `CalcResult` 타입 정의를 확정할 때 `pubPrice` / `insuPrice` / `mpvaPrice`를 명확히 분리해야 한다.

### 13-2. 특수공비 102 — Dead Code 동치

C# `ApplySpecialPub():L972~974`의 `case "102": break;`는 아무것도 하지 않는 pass이다. EDB `InsuRateCalc3.cs:L4026~4027`도 동일하게 pass이다. 따라서 TS의 미포팅은 102에 한해서는 **pass와 동치**로 오류를 유발하지 않는다.

### 13-3. 즉시 수정 필요 Critical 항목 목록

1. **특수공비 302/101 처리 구현** — `ApplySpecialPub()` 패턴을 TS로 포팅 (`CopaymentCalculator.cs:L939~1017`, `InsuRateCalc3.cs:L3998~4062` 참조)
2. **MpvaComm 산출 구현** — `CalcMpvaComm()` 단순화 버전 포팅: `Trunc10(비급여금액 × bohunRate / 100)` (`CopaymentCalculator.cs:L1146~1172` 참조)
3. **C31/C32/D타입 M81~M83 SumUser 연결** — Integration Lead에게 C31/C32/D타입 분기 연결 요청 (`CopaymentCalculator.cs:L1050~1057` 참조)
4. **본인부담상한제 상한액 연도별 동적 처리** — `ANNUAL_CAP_BY_DECILE`을 연도 파라미터 기반 룩업 또는 DB 조회 방식으로 전환 (`CopaymentCalculator.cs:L1094~1096` 참조)

---

**[약제비 분석용]**
