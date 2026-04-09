# CH12 교차 검증 보고서

> 작성자: CH12 Verifier (Phase 2 Team 12B)
> 작성일: 2026-04-06
> 챕터: CH12 — 보훈 약국 약제비 청구
> 참조 분석 보고서: (분석가 미작성 — 독립 검증)
> 상태: [x] 완료

---

## 1. C# 원본 vs TypeScript 포팅

| C# 원본 파일 / 함수 | TypeScript 포팅 파일 / 함수 | 포팅 정확도 | 비고 |
|---|---|---|---|
| `CopaymentCalculator.cs:GetBohunRate():L766` | `veteran.ts:getBohunRate():L128` | ✓ 동일 | 날짜 분기 포함 정확히 일치 |
| `CopaymentCalculator.cs:GetDoubleReductionRate():L791` | `veteran.ts:getDoubleReductionRate():L170` | ⚠ 부분 차이 | C# 반환값 -1(미해당)을 TS는 0으로 반환 — 하단 §3 참조 |
| `CopaymentCalculator.cs:IsBohunHospital():L1131` | `veteran.ts:isBohunHospital():L189` | ⚠ 주석 순서 불일치 | 코드셋 동일하나 주석에서 광주/대전 순서 뒤바뀜 — 하단 §3 참조 |
| `CopaymentCalculator.cs:CalcMpvaPrice():L810` | `veteran.ts:calcMpvaPrice():L210` | ⚠ 범위 불일치 | C# D타입/C21/C31/C32 제외 로직 없음 — 하단 §3 참조 |
| `CopaymentCalculator.cs:CalcCopay_G():L699` | `veteran.ts:calcVeteran():L254` | ⚠ 절사 로직 차이 | C# M20 이중감면에서 `Trunc100` 사용; TS도 `trunc100` 일치. G타입 M20 mpvaPrice=0 동일. ✓ |
| `CopaymentCalculator.cs:ApplyBohunPharmacy():L1040` | `veteran.ts:calcVeteran():L358-L380` | ⚠ 부분 누락 | C31/C32, D타입 분기 미구현 — 하단 §3 참조 |
| `GsCode.cs:GsCode.Determine():L55` | — | ✗ 미포팅 | 공상등구분 결정 함수 없음 — 하단 §4 참조 |
| `HospitalCodes.cs:BohunHospitals` | `veteran.ts:BOHUN_HOSPITAL_CODES:L64` | ✓ 동일 | 6곳 코드 일치 |

### 포팅 정확도 종합 평가

핵심 감면율 결정(`getBohunRate`), 위탁/비위탁 분기(`isMPVBill`), M10/M20/M61 특수 역산 로직은
C# 원본과 논리적으로 동일하게 포팅됐다. 다만 세 가지 중요 결함이 있다.

1. `CalcMpvaPrice`의 보험유형 필터링(D타입·C21/C31/C32 제외)이 TS에 없어, 해당 보험유형에서 `MpvaPrice`가 과산정될 수 있다.
2. `ApplyBohunPharmacy`의 C31/C32·D타입 분기가 veteran.ts에 없고 "Integration Lead 처리"로 위임됐으나 실제 연결이 확인되지 않는다.
3. `GsCode.Determine()` 전체가 미포팅이다.

---

## 2. 4소스 정합성 체크

| 계산 항목 | 비즈팜 | 공단(NHIS) | 유팜 | EDB | 우리 구현이 따르는 소스 | 비고 |
|---|---|---|---|---|---|---|
| 보훈청구액(MpvaPrice) 절사단위 | 10원 절사 추정 | PDF 미확정 | 10원 절사 | 10원 절사 | EDB/유팜 (trunc10) | ch12-보훈약국.md §4.3 "절사단위 미확정" 명시 |
| 위탁(G20) vs 비위탁(G10) 분리 | 분리 | 분리 | 분리 | 분리 | 4소스 일치 | `isMPVBill` 플래그로 처리 |
| M20 이중감면 기준연도 | 2018.01.01 | 2018.01.01 | 2018.01.01 | 2018.01.01 | 4소스 일치 | |
| M90 2018 이전 0% | 4소스 일치 | 4소스 일치 | 4소스 일치 | 4소스 일치 | 4소스 일치 | |
| 공상등구분 코드 매핑 | 확인 불가 | 확인 불가 | 확인 불가 | GsCode.cs 확인 | EDB GsCode.cs | TS 미포팅 |

### 4소스 불일치 항목 요약

- `보훈청구액 절사단위`: ch12-보훈약국.md 작성 시점에서 "PDF만으로는 명확히 확정되지 않는다"고 명시됨. C# 엔진은 `Trunc10` 사용(`CopaymentCalculator.cs:L840, L845`). TS veteran.ts도 `trunc10` 사용(`veteran.ts:L220, L223`). 따라서 **C# 원본 기준 10원 절사로 통일된 상태**이나, 원칙 문서 근거가 약하므로 현장 검증이 필요하다.

---

## 3. 의심 항목 (Suspicious)

- [🔴 Suspicious / Critical] **`CalcMpvaPrice` D타입/C21/C31/C32 제외 미적용**: C#에서는 의료급여(D) 또는 C21/C31/C32 보험코드이면서 M10이 아닌 경우 `MpvaPrice = 0`을 강제한다(`CopaymentCalculator.cs:L817-L834`). TS `calcMpvaPrice()`는 `totalPrice`, `bohunRate`, `isMPVBill` 세 인자만 받고 보험코드/카테고리를 전혀 참조하지 않는다(`veteran.ts:L210-L226`). 이로 인해 D타입+M30(30% 감면) 같은 케이스에서 보훈청구액이 과산정된다.

- [🟠 Suspicious / High] **`GetDoubleReductionRate` 반환값 의미 차이**: C# 원본은 M20·M61 이외 코드에서 `-1`을 반환하고, 호출부에서 `num7 > 0` 조건으로 분기한다(`CopaymentCalculator.cs:L793-L798`, `L449`, `L457`). TS는 `0`을 반환하며 `num7 > 0` 조건으로 동일하게 분기한다(`veteran.ts:L171-L176`, `L300`, `L314`). `0`과 `-1` 중 하나를 반환값으로 통일해야 하는데, TS의 `0` 반환은 `num7 >= 0` 조건(`veteran.ts:L314` M61 분기)에서 미세한 오동작 가능성이 있다. M61이 아닌 경우 `num7=0`이 되면 `num7 >= 0`이 true가 되어 M61 역산 로직에 진입할 수 있다. 그러나 현재 코드는 `bohunCode === BohunCode.M61` 조건을 앞에서 먼저 확인하므로 실제 오동작은 없다. 다만 방어 코드 관점에서 `-1` 반환이 더 안전하다.

- [🟠 Suspicious / High] **보훈병원 주석 순서 불일치**: C# `HospitalCodes.cs:L25`는 `"37100220"` 주석을 "광주보훈병원"으로, TS `veteran.ts:L67-L69`는 같은 코드를 "광주보훈병원"으로 올바르게 표기하나, 주석 순서에서 광주와 대전이 뒤바뀌어 있다. C# 주석 `HospitalCodes.cs:L22-L26`은 서울→부산→대전→광주→대구→인천 순이고, TS는 서울→부산→광주→대전→대구→인천 순이다. 코드값 자체는 동일하므로 로직 오류는 없으나, 코드 리뷰 혼란을 야기한다.

---

## 4. 위험 분기 누락

### 4-1. 날짜 기준 분기

- [🔴 Missing / Critical] **MT038='1' 삭제 분기 미처리**: ch12-보훈약국.md §5.6에 따르면 `MT038='1'`은 `2018-01-01` 진료분부터 삭제됐다. 이 날짜 분기를 처리하는 코드가 veteran.ts 및 GsCode.cs 어디에도 없다. 위탁진료 약국에서 2018 이전/이후 MT038 처리 방식이 달라야 한다.
- [🟠 Insufficient / High] **G20 공상등구분 '7' 날짜 분기 미처리**: ch12-보훈약국.md §5.6에 따르면 일부본인부담 전상군경등의 타질환 조제는 `2013-01-01` 청구분부터 공상등구분 `7→4`로 바뀐다(`veteran.ts` 및 `GsCode.cs`에 날짜 분기 없음).

### 4-2. 보험 코드 분기

- [🔴 Missing / Critical] **공상등구분 결정 함수(GsCode.Determine) 미포팅**: C# `GsCode.cs:GsCode.Determine():L55`는 `insuCode(G10/G20) + bohunCode` 조합으로 공상등구분을 결정한다. TS에 대응 함수가 없다. `CalcResult.gsCode` 필드가 없거나, 있더라도 값이 설정되지 않는다. CH12 청구서 EDI 출력 시 공상등구분 필드가 공란이 된다.
- [🔴 Missing / Critical] **MT038='A' 도서벽지 처리 미구현**: ch12-보훈약국.md §5.4, §5.5에 따르면 60% 감면환자 중 도서벽지 소재 약국에서 조제 시 `공상등구분='6'`, `MT038='A'`를 기재해야 한다. veteran.ts에 도서벽지 여부 입력 파라미터 및 MT038 출력 필드가 없다.
- [🔴 Missing / Critical] **MT038='2' 보훈국비환자 타질환 처리 미구현**: ch12-보훈약국.md §5.6에 따르면 G20 국비환자 타질환 조제(공상등구분='7', MT038='2') 처리가 필요하다. veteran.ts 결과에 MT038 필드 자체가 없다.
- [🟠 Insufficient / High] **보훈병원(P08) vs 위탁진료(G20) 청구체계 미분리**: C# GsCode.cs는 G10/G20 분기만 있고, ch12-보훈약국.md §5.2~5.4에서 요구하는 "보훈병원 업무처리 기준(P08)"과 "보훈위탁진료 작성요령(2025)"의 이중 체계를 완전히 분리하지 않는다. TS에서도 동일한 불완전 상태.

### 4-3. 특수 케이스 분기

- [🔴 Missing / Critical] **M61 공상등구분 결정 오류**: `GsCode.cs:L69`에서 `"M61" => isDelegate ? DelegateReduction : Reduction60`으로 M61을 Reduction60('7')에 매핑한다. 그런데 ch12-보훈약국.md §5.3의 공상등구분 표에는 M61에 대한 별도 코드 언급이 없다. M61은 고엽제 역산 로직을 사용하는 특수 코드로, Reduction60('7')과 동일하게 취급하는 것이 맞는지 원문 재확인이 필요하다.
- [🟠 Insufficient / High] **`ApplyBohunPharmacy` C31/C32·D타입 분기 미포팅**: C#에서는 C31/C32, D타입 보험코드에서 M81/M82/M83 처리 시 `SumUser = RealPrice`로 전환한다(`CopaymentCalculator.cs:L1050-L1057`). TS veteran.ts는 "Integration Lead가 연결할 때 별도 분기 추가 필요"(`veteran.ts:L361`)라는 주석만 있고 실제 구현이 없다. 해당 케이스에서 SumUser 과산정 위험이 있다.

---

## 5. 단위 / 타입 안전성

### 5-1. 수치 정밀도

- [🟠 Insufficient / High] **보훈청구액 절사단위 정책 미확정**: C# `Trunc10`과 TS `trunc10` 모두 10원 단위 버림이지만, ch12-보훈약국.md §4.3은 "PDF만으로는 명확히 확정되지 않는다"고 명시한다. 현장 검증 없이 10원 절사를 신뢰하면 청구액 1원~9원 오차가 발생할 수 있다.
- [🟡 Insufficient / Medium] **M20 이중감면 TS 절사 함수 차이**: C# `CalcCopay_G`의 M20 분기는 `Trunc100(userPrice * num7 / 100m)` 사용(`CopaymentCalculator.cs:L732`). TS도 동일하게 `trunc100(baseUser * num7 / 100)`(`veteran.ts:L309`). 일치. 그러나 `CalcCopay_C`의 M20 분기는 `truncC`(날짜 기준 100 또는 10)을 사용(`CopaymentCalculator.cs:L451`)하는데, TS veteran.ts는 G타입만 다루므로 C타입 M20에서의 절사 방식은 다른 곳에서 처리해야 한다. copayment.ts에서 처리 여부 추가 확인 필요.

### 5-2. Null 안전성

- [🟡 Insufficient / Medium] `calcVeteran()`에서 `options.insuCode`에 null 체크 없이 `.startsWith('G')` 호출(`veteran.ts:L368`). `insuCode`가 undefined이면 런타임 오류 발생.

### 5-3. 경계 조건

- [🟢 Low] `getBohunRate()`에서 빈 문자열 입력 시 0 반환으로 안전하게 처리됨. C# 원본과 일치.

---

## 6. 기타 관찰 사항

### 6-1. 보훈청구액 절사단위 결정 경위

ch12-보훈약국.md §4.3 및 §1 주의 항목에서 "절사단위는 이 PDF 세트만으로는 명확히 확정되지 않는다"고 명시했다. C# 엔진은 `CopaymentCalculator.cs:L840, L845`에서 `Trunc10` (10원 단위 버림)을 채택했다. TS veteran.ts도 동일하게 `trunc10`을 채택(`veteran.ts:L220, L223`). 즉 **10원 절사**를 사실상 기본값으로 채택한 상태이며, 별도 정책 플래그나 현장 검증이 수행된 흔적은 코드에 없다.

### 6-2. 자가처치 치료재료 26품목 미구현

ch12-보훈약국.md §8에 26품목의 자가처치 치료재료(BZ401001~BZ499002)와 월/주/일 지급상한이 정의됐다. veteran.ts는 물론 calc-engine 전체에서 이 품목 마스터나 상한 검증 로직이 전혀 없다. 분석 범위 외로 명시적으로 제외(§8 프로젝트 해석: "YakjaebiCalc가 일반 약제비만 다루면 이 표는 참조만 하면 된다")됐으나, 향후 범위 확장 시 월/주/일 상한, 적응증, 혼용금지, 의무기록 사유기재까지 데이터 모델에 포함해야 한다.

### 6-3. 보훈병원(P08) vs 보훈위탁진료(2025 작성요령) 이중 체계

ch12-보훈약국.md §5.2에서 두 청구 체계를 명확히 구분하도록 요구하고 있으나, `GsCode.cs`는 G10/G20 보험코드 분기만 있고, 실제 청구 규칙(공상등구분 3/5/6/J vs 0/4/6/7, MT038 사용 여부)을 체계적으로 분리하지 않는다. 청구서 EDI 생성 단계에서 이 두 체계가 혼용되면 심사 반송 원인이 된다.

### 6-4. G20 DelegateNational '4' 와 DelegateReduction '0' 충돌

`GsCode.cs:L34-L36`에서 `DelegateNational = "4"`, `DelegateOtherDisease = "7"`이 정의됐고, `GsCode.cs:L65`에서 M10은 G20이면 `DelegateNational("4")`로 매핑된다. 그런데 ch12-보훈약국.md §5.4 표에서는 `보훈국비환자 조제분`에 `4 또는 7`이 모두 등장하며, `90%/60% 감면환자`에는 `0(E)`가 사용된다. `GsCode.cs`의 `DelegateReduction = "0"`이 '0' 또는 'E' 중 무엇인지 명확하지 않다. PDF p.616의 `0(E)` 표기 해석이 필요하다.

---

## 즉시 수정 필요 항목 요약 (🔴 Critical)

| 번호 | 항목 | 위치 |
|---|---|---|
| 1 | `calcMpvaPrice()` 보험유형 필터 누락 (D/C21/C31/C32 과산정) | `veteran.ts:L210-L226` vs `CopaymentCalculator.cs:L817-L834` |
| 2 | `GsCode.Determine()` TS 미포팅 — 공상등구분 필드 미출력 | `GsCode.cs:L55` |
| 3 | MT038='A' 도서벽지 처리 미구현 | ch12 §5.4, veteran.ts 전체 |
| 4 | MT038='2' 보훈국비환자 타질환 처리 미구현 | ch12 §5.6, veteran.ts 전체 |
| 5 | MT038='1' 2018 이전/이후 날짜 분기 미구현 | ch12 §5.6 |
