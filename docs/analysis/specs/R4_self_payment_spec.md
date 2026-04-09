# R4 — CH05 본인부담금 수정 사양서

> 작성자: R4 CH05 본인부담금 사양조사 담당  
> 작성일: 2026-04-07  
> 상태: 초안 완료  
> 참조 소스: ch05_analyst.md, ch05_verifier.md, 21_missing_aggregation.md (CH05), 22_suspicious_aggregation.md (S-05/S-09/S-11), 23_insufficient_aggregation.md (I-024~I-052)

---

## 목차

1. [선별급여 A/B/D/E항 본인부담 미구현 (M05-01)](#1-선별급여-abdeu항-독립-본인부담-계산)
2. [U항 / 요양급여비용총액2 미구현 (M05-02)](#2-u항-100100-본인부담금--요양급여비용총액2)
3. [G타입 M61 역산 오적용 (S-05-01)](#3-g타입-m61-역산-공식-오적용)
4. [65세 2구간 날짜 조건 누락 (S-05-02)](#4-65세-이상-2구간-날짜-조건-누락)
5. [D10 sbrdnType="" Mcode 미진입 (S-11-01)](#5-d10-sbrdntype-mcode-미진입)
6. [산정특례 V252 등급별 DB 미조회 (S-09-01)](#6-산정특례-v252-등급별-db-컬럼-미조회)

---

## 사양화 항목 요약

| # | 항목 ID | 항목명 | 심각도 | 파일 위치 |
|---|---------|--------|--------|----------|
| 1 | M05-01 | 선별급여 A/B/D/E항 독립 본인부담 계산 | 🔴 Critical | `copayment.ts` (신규 함수) |
| 2 | M05-02 | U항(100/100) 본인부담금 및 총액2 산출 | 🔴 Critical | `copayment.ts` (신규 필드/함수) |
| 3 | S-05-01 | G타입 M61 역산 공식 오적용 | 🔴 Critical | `modules/insurance/veteran.ts:L314-324` |
| 4 | S-05-02 | 65세 이상 2구간 날짜 조건 누락 | 🔴 Critical | `copayment.ts:L136` |
| 5 | S-11-01 | D10 sbrdnType="" Mcode 미진입 | 🔴 Critical | `modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount()` |
| 6 | S-09-01 | V252 컬럼 미조회 (v2520/v2521) | 🔴 Critical | `supabase-repo.ts:getInsuRate():L73` |

총 **6개** 항목 사양화.

---

## 1. 선별급여 A/B/D/E/U항 독립 본인부담 계산

### 1.1 원본 사양

**출처**: `ch05_analyst.md:L47`, `21_missing_aggregation.md:L182-L183`

- CH05 §8.3: 선별급여 약품은 일반 급여와 분리하여 항별(A/B/D/E)로 독립 계산  
- 계산식: `100/100미만본인부담금 = trunc10(A항금액×50% + B항금액×80% + D항금액×30% + E항금액×90%)`
- 절사 규칙: 10원 절사 (`trunc10`)
- EDB 원본: `NPayCalc.cs` — A/B/D/E항 각각 별도 본인부담 산출 후 합산

**항별 본인부담률·보험자부담률 표**

| 항 구분 | InsuPayType | 본인부담률 | 보험자부담률 | 계산식 | 비고 |
|---------|------------|-----------|------------|--------|------|
| A항 | `partial50` | 50% | 50% | `trunc10(합계 × 0.50)` | 선별급여 기본 |
| B항 | `partial80` | 80% | 20% | `trunc10(합계 × 0.80)` | 고가 비급여 대체 |
| D항 | `partial30` | 30% | 70% | `trunc10(합계 × 0.30)` | 필수 선별 |
| E항 | `partial90` | 90% | 10% | `trunc10(합계 × 0.90)` | 임시적 선별급여 |
| U항 | `fullSelf`  | 100% | 0% | `sumU` 전액 본인부담 | 총액2로 별도 처리 → 항목 2 참조 |

> **주의**: A/B/D/E 각 항의 합계에 대해 **항별 개별 trunc10**을 적용한 후 합산한다.  
> 즉, `trunc10(A합) + trunc10(B합) + trunc10(D합) + trunc10(E합)` ≠ `trunc10(A합+B합+D합+E합)`  
> EDB `NPayCalc.cs` 방식: 항별 개별 절사 후 합산.

### 1.2 현재 상태 결함

- `ch05_analyst.md:L47`: `copayment.ts`에 선별급여 독립 계산 함수 없음
- `21_missing_aggregation.md:M05-01`: 선별급여 처방에서 본인부담금 완전 누락
- `ch05_analyst.md:L100`: `CH05 §8.3` — 미구현 (`✗`)
- `types.ts:InsuPayType`: `partial50/partial80/partial30/partial90` 열거형은 정의됨
- `drug-amount.ts (I-002, ch05_analyst.md 연관)`: A/B/D/E/U항별 합산 구조 미분리

### 1.3 수정 사양

#### 신규 함수: `calcNPaySelfAmount()`

```typescript
// 파일: src/lib/calc-engine/copayment.ts (또는 신규 npay.ts)

/**
 * 선별급여(A/B/D/E항) 독립 본인부담금 계산
 *
 * CH05 §8.3: 항별 개별 trunc10 적용 후 합산
 *
 * @param sumA  A항 약품금액 합계 (InsuPayType='partial50')
 * @param sumB  B항 약품금액 합계 (InsuPayType='partial80')
 * @param sumD  D항 약품금액 합계 (InsuPayType='partial30')
 * @param sumE  E항 약품금액 합계 (InsuPayType='partial90')
 * @returns NPaySelfResult (각 항별 본인부담, 합계)
 */
export interface NPaySelfResult {
  selfA: number;    // trunc10(sumA × 50%)
  selfB: number;    // trunc10(sumB × 80%)
  selfD: number;    // trunc10(sumD × 30%)
  selfE: number;    // trunc10(sumE × 90%)
  totalSelf: number; // selfA + selfB + selfD + selfE
}

export function calcNPaySelfAmount(
  sumA: number,
  sumB: number,
  sumD: number,
  sumE: number
): NPaySelfResult {
  const selfA = trunc10(sumA * 0.50);
  const selfB = trunc10(sumB * 0.80);
  const selfD = trunc10(sumD * 0.30);
  const selfE = trunc10(sumE * 0.90);
  return {
    selfA,
    selfB,
    selfD,
    selfE,
    totalSelf: selfA + selfB + selfD + selfE,
  };
}
```

#### 분기 매트릭스 (보험유형 × 선별급여 항)

| 보험유형 | A항 50% | B항 80% | D항 30% | E항 90% | 비고 |
|---------|---------|---------|---------|---------|------|
| C (건강보험) | ✓ | ✓ | ✓ | ✓ | 모두 적용 |
| D (의료급여) | ✓ | ✓ | ✓ | ✓ | 단, V103/B030 면제 시 0원 |
| G (보훈) | ✓ (감면 후) | ✓ | ✓ | ✓ | 보훈 감면율 선적용 후 항별 계산 |
| F (자동차) | 100% | 100% | 100% | 100% | 선별급여 구분 무관, 전액 환자부담 |
| E (산재) | 0% | 0% | 0% | 0% | 전액 면제 |

#### 호출 위치 수정

`calcCopayment()` 내 또는 `index.ts (buildResult)` 에서:

```typescript
// 약품 합산 시 항별로 분리 집계 (drug-amount.ts 개선 연동 필요)
const { sumA, sumB, sumD, sumE, sumU } = drugAmountSumBySection(drugList);

// 선별급여 본인부담
const npaySelf = calcNPaySelfAmount(sumA, sumB, sumD, sumE);

// CalcResult에 추가
result.npaySelfTotal = npaySelf.totalSelf;
result.npaySelfA = npaySelf.selfA;
result.npaySelfB = npaySelf.selfB;
result.npaySelfD = npaySelf.selfD;
result.npaySelfE = npaySelf.selfE;
```

### 1.4 의존성

- `drug-amount.ts (I-002)`: `calcDrugAmountSum()` 반환에 항별 분리 필드 추가 선행 필요
  - `sumA`, `sumB`, `sumD`, `sumE`, `sumU` 필드
- `types.ts:CalcResult`: `npaySelfTotal`, `npaySelfA/B/D/E` 필드 추가
- `rounding.ts:trunc10`: 이미 구현됨

### 1.5 단위 테스트

```typescript
describe('calcNPaySelfAmount', () => {
  test('T1: A항만 존재 — 10,000원 × 50% = 5,000원', () => {
    const r = calcNPaySelfAmount(10000, 0, 0, 0);
    expect(r.selfA).toBe(5000);
    expect(r.totalSelf).toBe(5000);
  });

  test('T2: B항만 존재 — 10,000원 × 80% = 8,000원', () => {
    const r = calcNPaySelfAmount(0, 10000, 0, 0);
    expect(r.selfB).toBe(8000);
  });

  test('T3: D항만 존재 — 10,000원 × 30% = 3,000원', () => {
    const r = calcNPaySelfAmount(0, 0, 10000, 0);
    expect(r.selfD).toBe(3000);
  });

  test('T4: E항만 존재 — 10,000원 × 90% = 9,000원', () => {
    const r = calcNPaySelfAmount(0, 0, 0, 10000);
    expect(r.selfE).toBe(9000);
  });

  test('T5: trunc10 확인 — A항 1,234원 × 50% = 617원 → trunc10 = 610원', () => {
    const r = calcNPaySelfAmount(1234, 0, 0, 0);
    expect(r.selfA).toBe(610); // trunc10(617) = 610
  });

  test('T6: 혼합 항목 — A:5000 + B:3000 + D:2000 + E:1000', () => {
    // selfA = trunc10(5000×0.5) = 2500
    // selfB = trunc10(3000×0.8) = 2400
    // selfD = trunc10(2000×0.3) = 600
    // selfE = trunc10(1000×0.9) = 900
    // total = 6400
    const r = calcNPaySelfAmount(5000, 3000, 2000, 1000);
    expect(r.selfA).toBe(2500);
    expect(r.selfB).toBe(2400);
    expect(r.selfD).toBe(600);
    expect(r.selfE).toBe(900);
    expect(r.totalSelf).toBe(6400);
  });

  test('T7: 모두 0원 — 결과 0원', () => {
    const r = calcNPaySelfAmount(0, 0, 0, 0);
    expect(r.totalSelf).toBe(0);
  });
});
```

---

## 2. U항(100/100) 본인부담금 및 요양급여비용총액2

### 2.1 원본 사양

**출처**: `ch05_analyst.md:L48`, `21_missing_aggregation.md:L188-L189`, `22_suspicious_aggregation.md:S-01-04`

- CH05 §8.1: U항(100/100 본인부담) 약제는 **요양급여비용총액2** 별도 필드에 분리 산정
- `요양급여비용총액2 = trunc10(U항 약품금액 합계 + U항 귀속 조제료)`
- U항 본인부담금: 총액2 전액 환자 부담 (`userPrice100 = totalPrice2`)
- 보험자 부담 없음 (청구액=0)
- `21_missing_aggregation.md:M07-01` (L256): 총액2 필드 Ceil10 반올림 — EDB `RoundingHelper.cs:R13()`
- `22_suspicious_aggregation.md:S-01-04` (L61-67): 302(정책대상) U항 분리 집계 `SumInsuDrug100_302` 미구현

**U항 302 대상 구분**

| 구분코드 | 설명 | 처리 |
|---------|------|------|
| 일반 U항 | 100% 자부담 | `sumInsuDrug100`에 합산 |
| 302 대상 | 정책 대상 100% 자부담 | `sumInsuDrug100_302` 별도 집계 (specialPub 처리) |

### 2.2 현재 상태 결함

- `ch05_analyst.md:L98`: `CH05 §8.1` — 미구현 (`✗`)
- `copayment.ts:L60`: `totalPrice`(총액1)만 산출, `totalPrice2` 없음
- `types.ts:CalcResult:L233-L235`: `sumInsuDrug100`, `totalPrice100`, `userPrice100` 필드는 정의되어 있으나 **계산 로직 미연결**
- `supabase-repo.ts`: U항 관련 DB 조회 없음
- `22_suspicious_aggregation.md:S-01-04`: 302 분리 로직 완전 미구현

### 2.3 수정 사양

#### CalcResult 필드 추가 (types.ts)

```typescript
// 기존 필드 활용 + 신규 필드 추가
interface CalcResult {
  // ... 기존 ...
  
  /** U항 약품금액 합계 (100/100 자부담) */
  sumInsuDrug100: number;           // 기존 필드 — 계산 연결 필요
  /** U항 귀속 조제료 (비급여 조제료 배분액) */
  sumWage100?: number;              // 신규
  /** 요양급여비용총액2 = trunc10(sumInsuDrug100 + sumWage100) */
  totalPrice2?: number;             // 신규
  /** U항 환자부담 = totalPrice2 (전액) */
  userPrice100: number;             // 기존 필드 — 계산 연결 필요
  /** U항 302 대상 약품금액 합계 */
  sumInsuDrug100_302?: number;      // 신규 (specialPub 처리용)
}
```

#### 신규 함수: `calcUItemCopayment()`

```typescript
// 파일: src/lib/calc-engine/copayment.ts

/**
 * U항(100/100 본인부담) 총액2 계산
 *
 * CH05 §8.1: U항은 총액1과 분리하여 총액2로 산출
 *
 * @param sumU   U항 약품금액 합계 (InsuPayType='fullSelf')
 * @param sumWageU U항 귀속 조제료 (없으면 0)
 * @returns UItemResult
 */
export interface UItemResult {
  totalPrice2: number;   // trunc10(sumU + sumWageU)
  userPrice100: number;  // = totalPrice2 (전액 환자부담)
  pubPrice2: number;     // 0 (보험자 부담 없음)
}

export function calcUItemCopayment(
  sumU: number,
  sumWageU: number = 0
): UItemResult {
  const totalPrice2 = trunc10(sumU + sumWageU);
  return {
    totalPrice2,
    userPrice100: totalPrice2,  // 전액 환자부담
    pubPrice2: 0,
  };
}
```

#### 보험유형별 분기 매트릭스

| 보험유형 | U항 처리 | 총액2 | 환자부담 | 비고 |
|---------|---------|------|---------|------|
| C (건강보험) | 전액 환자부담 | totalPrice2 = trunc10(sumU) | 100% | 청구서 총액2 기재 |
| D (의료급여) | 전액 환자부담 | totalPrice2 = trunc10(sumU) | 100% | 면제 규정 미적용 |
| G (보훈) | 감면 없음 | totalPrice2 = trunc10(sumU) | 100% | 보훈 감면 대상 아님 |
| F (자동차) | 100% + 할증 | totalPrice2 + 할증 | 100%+ | addRat 적용 |
| E (산재) | 0% (면제) | 총액2 없음 | 0원 | 산재는 U항 없음 |

### 2.4 의존성

- `drug-amount.ts (I-002)`: `calcDrugAmountSum()` 반환에 `sumU`, `sumInsuDrug100_302` 분리 필요
- `types.ts:CalcResult`: `totalPrice2`, `sumWage100`, `userPrice100`, `sumInsuDrug100_302` 신규/연결
- `rounding.ts:trunc10`: 이미 구현됨

### 2.5 단위 테스트

```typescript
describe('calcUItemCopayment', () => {
  test('T1: U항 10,000원 — 총액2 = 10,000원, 전액 환자부담', () => {
    const r = calcUItemCopayment(10000);
    expect(r.totalPrice2).toBe(10000);
    expect(r.userPrice100).toBe(10000);
    expect(r.pubPrice2).toBe(0);
  });

  test('T2: U항 10,005원 — trunc10 적용 → 10,000원', () => {
    const r = calcUItemCopayment(10005);
    expect(r.totalPrice2).toBe(10000);
  });

  test('T3: U항 + 귀속 조제료 합산', () => {
    const r = calcUItemCopayment(8000, 2000);
    expect(r.totalPrice2).toBe(10000);
    expect(r.userPrice100).toBe(10000);
  });

  test('T4: U항 0원 — 모두 0', () => {
    const r = calcUItemCopayment(0);
    expect(r.totalPrice2).toBe(0);
    expect(r.pubPrice2).toBe(0);
  });

  test('T5: U항 1원 — trunc10 → 0원', () => {
    const r = calcUItemCopayment(1);
    expect(r.totalPrice2).toBe(0);
  });
});
```

---

## 3. G타입 M61 역산 공식 오적용

### 3.1 원본 사양

**출처**: `ch05_verifier.md:L65-L66`, `22_suspicious_aggregation.md:S-05-01:L253-L260`, `23_insufficient_aggregation.md:I-024`

- **C# 원본** `CopaymentCalculator.cs:CalcCopay_G():L699-L739`:
  - G타입 M61(bohunRate=60)은 **전용 분기 없음**
  - 일반 감면 분기(L720-L722)로 처리: `Trunc10(basisAmt × insuRate / 100)`
  - 감면율 60% → `basisAmt = totalPrice - mpvaPrice` 기준
  - `mpvaPrice = totalPrice - Trunc10(totalPrice × (100-60)/100)` (비위탁 역산)
  - 절사: **Trunc10** (감면율 30/50/60/90%는 Trunc10 규칙)

- **오적용된 TS 공식** (`veteran.ts:L314-L324`):
  - C타입 M61 역산 공식 이식: `trunc100(basisAmt × insuRate/100 × num7/100)`
  - `mpvaPrice = normalUser - userPrice`
  - 이는 **C타입 전용 로직**이며 G타입에 적용 불가

**올바른 G타입 M61 계산 흐름**

```
1. mpvaPrice = totalPrice - trunc10(totalPrice × 40/100)     // 비위탁 역산, 감면율60%
2. basisAmt  = totalPrice - mpvaPrice
3. userPrice = trunc10(basisAmt × insuRate / 100)            // Trunc10 (감면율 60%)
4. insuPrice = totalPrice - userPrice - mpvaPrice
```

> **근거**: C# CalcCopay_G() 일반 감면 분기 조건 `bohunRate == 30 || 50 || 60 || 90` → `Trunc10` 적용.  
> M61의 `bohunRate = 60`이므로 일반 감면 분기(Trunc10) 진입.  
> `ch05_verifier.md:L65`: "C# 원본 CalcCopay_G에는 M61 전용 분기가 없으며, M61(bohunRate=60)은 일반 감면 분기(L720-L722)로 처리되어 Trunc10(basisAmt × insuRate / 100)가 적용된다."

### 3.2 현재 상태 결함

- **파일**: `src/lib/calc-engine/modules/insurance/veteran.ts:L314-L324`
- **결함**: M61 전용 역산 분기(`else if (bohunCode === 'M61' && num7 >= 0)`)가 존재하여 C타입 공식 적용
- **오산출 조건**: `insuCode`가 G계열이고 `bohunCode='M61'`인 모든 처방
- `getDoubleReductionRate('M61', ...)` 반환값 10(2018이후)/20(이전)이 M61 분기를 트리거하는 문제도 병존

### 3.3 수정 사양

#### 함수 시그니처 (변경 없음, 내부 로직만 수정)

```typescript
// 파일: src/lib/calc-engine/modules/insurance/veteran.ts
// 함수: calcVeteran()
// 수정 대상 라인: L314-L324
```

#### 수정 전 (오적용 코드)

```typescript
// M61: 고엽제 역산 — 이 분기 전체를 제거
else if (bohunCode === BohunCode.M61 && num7 >= 0) {
  const basisAmt = totalPrice - mpvaPrice;
  userPrice = trunc100(basisAmt * insuRate / 100 * num7 / 100);  // ← C타입 공식
  const normalUser = trunc100(totalPrice * insuRate / 100);
  mpvaPrice = normalUser - userPrice;
  if (mpvaPrice < 0) mpvaPrice = 0;
}
```

#### 수정 후 (G타입 올바른 처리)

```typescript
// M61(고엽제): G타입에서는 일반 감면 60% → Trunc10 분기로 처리
// C# CalcCopay_G() 일반 감면 분기(L720-L722) 준수
// ★ M61 전용 분기 제거: 이 else-if 블록을 삭제하고 일반 감면 분기에서 처리됨
```

#### 일반 감면 분기 (현행 유지, M61이 자동 처리됨)

```typescript
// 일반 보훈 감면 (M30/M50/M60/M61/M81/M83/M90 — 감면율 30/50/60/90%)
else {
  const basisAmt = totalPrice - mpvaPrice;
  // 감면율 30/50/60/90%: Trunc10
  if (bohunRate === 30 || bohunRate === 50 || bohunRate === 60 || bohunRate === 90) {
    userPrice = trunc10(basisAmt * insuRate / 100);
  } else {
    userPrice = trunc100(basisAmt * insuRate / 100);
  }
}
```

> M61은 `getBohunRate('M61', ...)` → 60을 반환하므로 `bohunRate === 60` 조건에 의해 `trunc10`이 적용된다.

#### `getDoubleReductionRate()` 반환값 수정

**출처**: `ch05_verifier.md:L79-L80`, `22_suspicious_aggregation.md:S-05-08`

- C# 원본: M20/M61이 아니면 **`-1`** 반환 (비대상 마커)
- TS 현재: `0` 반환 → M61 분기 조건 `num7 >= 0`에서 0도 통과 (오작동)

```typescript
// 수정 전
export function getDoubleReductionRate(bohunCode: string, dosDate: string): number {
  if (bohunCode !== BohunCode.M20 && bohunCode !== BohunCode.M61) return 0; // ← 오류
  ...
}

// 수정 후
export function getDoubleReductionRate(bohunCode: string, dosDate: string): number {
  if (bohunCode !== BohunCode.M20 && bohunCode !== BohunCode.M61) return -1; // C# 원본 준수
  const isAfter2018 = dosDate >= '20180101';
  return isAfter2018 ? 10 : 20;
}
```

> M61 전용 분기를 제거한 후에는 `getDoubleReductionRate`의 M61 반환값(10/20)이 미사용이 되므로,  
> 이 함수는 M20 이중감면 전용으로 의미가 축소된다. 함수 JSDoc 갱신 필요.

#### 분기 매트릭스 (보훈코드 × 절사 단위)

| bohunCode | bohunRate | 절사 단위 | 비고 |
|-----------|-----------|----------|------|
| M10 | 100 | 해당 없음 | userPrice=0 |
| M20 | 90/80 | trunc100 (M20 이중감면) | num7 분기 유지 |
| M30 | 30 | trunc10 | |
| M50 | 50 | trunc10 | |
| M60 | 60 | trunc10 | |
| **M61** | **60** | **trunc10** | **← 일반 감면 분기로 처리 (수정 핵심)** |
| M81 | 60 | trunc10 | 보훈약국 후처리 |
| M82 | 0 | trunc100 | 감면없음 |
| M83 | 90 | trunc10 | 보훈약국 90% |
| M90 | 90/0 | trunc10 | 2018이후만 |

### 3.4 의존성

- `veteran.ts:getBohunRate()`: M61 → 60 반환 (현행 유지)
- `veteran.ts:getDoubleReductionRate()`: 반환값 -1 수정 (위 참조)
- `veteran.ts:calcVeteran()`: M61 전용 분기 블록 제거

### 3.5 단위 테스트

```typescript
describe('calcVeteran — M61 수정 검증', () => {
  const baseOpt = {
    insuCode: 'G10',
    bohunCode: 'M61',
    dosDate: '20240101',
    age: 60,
    isMPVBill: false, // 비위탁
    drugList: [],
  };
  const baseRate = { insuCode: 'G10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 };

  // totalPrice=10,000, 비위탁, M61(bohunRate=60)
  // mpvaPrice = 10000 - trunc10(10000 × 40%) = 10000 - 4000 = 6000
  // basisAmt  = 10000 - 6000 = 4000
  // userPrice = trunc10(4000 × 30%) = trunc10(1200) = 1200
  test('T1: G타입 M61 비위탁, totalPrice=10000, rate=30% → userPrice=1200', () => {
    const result = { totalPrice: 10000, sumInsuDrug: 7000, sumWage: 3000, userPrice: 0, pubPrice: 0, wageList: [], steps: [] };
    const r = calcVeteran(baseOpt, result, baseRate);
    expect(r.userPrice).toBe(1200);
    expect(r.mpvaPrice).toBe(6000);
    expect(r.insuPrice).toBe(2800); // 10000 - 1200 - 6000
  });

  test('T2: getDoubleReductionRate M20/M61 외 → -1 반환', () => {
    expect(getDoubleReductionRate('M30', '20240101')).toBe(-1);
    expect(getDoubleReductionRate('M10', '20240101')).toBe(-1);
  });

  test('T3: getDoubleReductionRate M61 → 10 (2018이후)', () => {
    expect(getDoubleReductionRate('M61', '20240101')).toBe(10);
  });

  test('T4: M61 절사 단위 — trunc10 적용 확인', () => {
    // basisAmt=1234, rate=30% → 370.2 → trunc10(370) = 370
    const result = { totalPrice: 1234 + 4000, sumInsuDrug: 4000, sumWage: 1234, userPrice: 0, pubPrice: 0, wageList: [], steps: [] };
    // mpvaPrice(비위탁, 60%): 5234 - trunc10(5234×40%) = 5234 - 2090 = 3144
    // basisAmt = 5234 - 3144 = 2090
    // userPrice = trunc10(2090 × 30%) = trunc10(627) = 620
    const r = calcVeteran(baseOpt, result, baseRate);
    expect(r.userPrice).toBe(620);
  });

  test('T5: trunc100 미적용 확인 — M61은 trunc10 사용', () => {
    // totalPrice=11000, 비위탁, M61
    // mpvaPrice = 11000 - trunc10(11000×40%) = 11000 - 4400 = 6600
    // basisAmt = 11000 - 6600 = 4400
    // userPrice = trunc10(4400 × 30%) = trunc10(1320) = 1320
    const result = { totalPrice: 11000, sumInsuDrug: 8000, sumWage: 3000, userPrice: 0, pubPrice: 0, wageList: [], steps: [] };
    const r = calcVeteran(baseOpt, result, baseRate);
    expect(r.userPrice).toBe(1320); // trunc100이면 1300이 됨 — trunc10이 맞음
  });
});
```

---

## 4. 65세 이상 2구간 날짜 조건 누락

### 4.1 원본 사양

**출처**: `ch05_verifier.md:L67`, `22_suspicious_aggregation.md:S-05-02:L264-L275`, `23_insufficient_aggregation.md:I-025`

- **C# 원본** `CopaymentCalculator.cs:CalcCopay_C():L430`:
  - 2구간 조건: `basisAmt > 10000m AND basisAmt <= 12000m AND opt.DosDate >= "20180101"`
  - 날짜 조건 `dosDate >= '20180101'`이 **2구간에만** 적용
  - 2018.01.01 이전: 2구간(20%) 없음 → 바로 3구간(30%) 진입

**날짜 분기 전체 구조**

```
dosDate >= '20180101':
  totalPrice <= 10,000: 1구간 정액 1,000원
  totalPrice <= 12,000: 2구간 20% (trunc100)
  totalPrice >  12,000: 3구간 30% (trunc100)

dosDate < '20180101':
  totalPrice <= 10,000: 1구간 정액 1,000원
  totalPrice >  10,000: 구(舊)3구간 30% (trunc100) ← 2구간 없음
```

**추가 누락 조건** (`ch05_verifier.md:L75-L77`):

- C# L419: `opt.IsOver65 && !hasSpecialIllness && bohunRate == 0` — 보훈환자(bohunRate > 0) 65세 분기 제외
- `hasSpecialIllness`: `illness.Rate >= 0 && illness.Rate < 30m` — 산정특례 요율 30% 미만인 경우만 `hasSpecialIllness=true`
  - V252(50%)이면 `hasSpecialIllness=false` → **65세 정액 분기 진입** (C# 기준)
  - TS 현재: `effectiveCopayRate >= 0`이면 산정특례 분기 → V252(50%)는 65세 분기 미진입 (**C#과 반대**)

### 4.2 현재 상태 결함

- **파일**: `src/lib/calc-engine/copayment.ts:L125-L153`
- **결함 1**: `totalPrice <= 12000` 조건에 `dosDate >= '20180101'` 없음 (`L136`)
- **결함 2**: 보훈환자(`bohunRate > 0`) 65세 분기 제외 조건 없음 (`L125`)
- **결함 3**: 65세 + V252(50%) 조합 시 C#은 65세 정액 적용, TS는 산정특례 50% 적용 (우선순위 반전)
- **결함 4**: `basisAmt`(보훈감면 후 금액) 대신 `totalPrice`로 구간 비교 (`L127`, `L136`)

### 4.3 수정 사양

#### 함수 시그니처 (변경 없음)

```typescript
// 파일: src/lib/calc-engine/copayment.ts
// 함수: calcCopayment()
// 수정 대상: L125-L153 (65세 이상 분기 블록 전체)
```

#### 수정 전 (현행)

```typescript
if (age >= 65 && effectiveCopayRate < 0) {
  if (totalPrice <= 10000) {                           // ← basisAmt 사용해야 함
    ...
  } else if (totalPrice <= 12000) {                   // ← 날짜 조건 없음, basisAmt 필요
    ...
  } else {
    ...
  }
}
```

#### 수정 후

```typescript
// bohunRate: copayment.ts에서 직접 접근 불가 → CalcOptions에 bohunRate 전달 또는 opt.bohunCode로 판정
const hasBohunRate = !!(opt.bohunCode && opt.bohunCode.startsWith('M') && opt.bohunCode !== 'M82');
// hasSpecialIllness: C# 기준 — 산정특례 요율 0 이상 AND 30 미만인 경우
const hasSpecialIllness = effectiveCopayRate >= 0 && effectiveCopayRate < 30;
// basisAmt: 보훈감면 후 금액 (보훈 없으면 totalPrice와 동일)
// 주의: copayment.ts에서 보훈감면은 calcVeteran()으로 위임하므로 totalPrice 사용
// 단, 65세 분기는 C타입에서만 진입 (보훈은 calcVeteran으로 먼저 빠짐)
// → hasBohunRate가 true이면 이미 calcVeteran()으로 처리됨, 여기 미진입
// 따라서 이 분기에서 basisAmt = totalPrice로 사용 가능 (보훈 분리 확인 필요)

if (age >= 65 && !hasSpecialIllness && !hasBohunRate) {
  // C# CalcCopay_C():L419: IsOver65 && !hasSpecialIllness && bohunRate == 0
  if (totalPrice <= 10000) {
    // 1구간: 정액 (날짜 무관)
    const fixCost = rate.fixCost > 0 ? rate.fixCost : 1000;
    userPrice = Math.min(totalPrice, fixCost);
    ...
  } else if (totalPrice <= 12000 && opt.dosDate >= '20180101') {
    // 2구간: 20% — 2018.01.01 이후만 적용
    const rate2 = rate.age65_12000Less > 0 ? rate.age65_12000Less : 20;
    userPrice = trunc100(totalPrice * (rate2 / 100));
    ...
  } else {
    // 3구간: 30% (2018이전 10,001원 이상도 여기)
    userPrice = trunc100(totalPrice * (rate.rate / 100));
    ...
  }
} else if (effectiveCopayRate >= 0) {
  // 산정특례 — hasSpecialIllness=true 케이스 포함
  // ★ C# 기준: V252(50%)이면 hasSpecialIllness=false → 65세 분기 진입
  // → effectiveCopayRate >= 30이면 산정특례 분기 진입 안 함 (65세 우선)
  // 현재 TS 구조에서는 위 조건에서 !hasSpecialIllness로 제어되므로 여기는 rate<30인 케이스
  userPrice = trunc100(totalPrice * (effectiveCopayRate / 100));
  ...
}
```

> **설계 주의사항**:  
> C# 기준 `hasSpecialIllness = rate >= 0 AND rate < 30`이므로:
> - V252(50%): `hasSpecialIllness=false` → 65세 정액 분기 진입
> - V009(5%): `hasSpecialIllness=true` → 65세 분기 우회, 산정특례 5% 적용
> - V452(30%): `hasSpecialIllness=false` → 65세 분기 진입  
>
> 이 동작은 현재 TS와 **반대**이므로 우선순위 로직 전면 재작성 필요.

#### 날짜 분기 매트릭스

| 나이 | dosDate | totalPrice | 보훈 | 산정특례(rate) | 적용 구간 | 공식 |
|------|---------|-----------|------|--------------|---------|------|
| 65+ | 모두 | ≤10,000 | 없음 | rate≥30 또는 없음 | 1구간 정액 | min(totalPrice, fixCost) |
| 65+ | ≥20180101 | 10,001~12,000 | 없음 | rate≥30 또는 없음 | 2구간 20% | trunc100(totalPrice×20%) |
| 65+ | <20180101 | 10,001~12,000 | 없음 | rate≥30 또는 없음 | 3구간 30% | trunc100(totalPrice×30%) |
| 65+ | 모두 | >12,000 | 없음 | rate≥30 또는 없음 | 3구간 30% | trunc100(totalPrice×30%) |
| 65+ | 모두 | 모두 | 있음 | 모두 | calcVeteran() | (보훈 분리 처리) |
| 65+ | 모두 | 모두 | 없음 | 0~29% | 산정특례 우선 | trunc100(totalPrice×rate%) |
| <65 | 모두 | 모두 | 없음 | ≥0% | 산정특례 | trunc100(totalPrice×rate%) |
| <65 | 모두 | 모두 | 없음 | 없음 | 일반 or 6세미만 | trunc100(totalPrice×30%) 등 |

### 4.4 의존성

- `copayment.ts`: `effectiveCopayRate` 판정 로직 재작성 (`_determineEffectiveRate`)
- `CalcOptions`: `bohunCode` 필드 이미 정의됨
- C# `CalcCopay_C():L418-L430` 원본 참조 (hasSpecialIllness 조건)

### 4.5 단위 테스트

```typescript
describe('calcCopayment — 65세 날짜 분기', () => {
  const baseRate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 1000, mcode: 0, bcode: 0, age65_12000Less: 20 };
  const opt65 = { insuCode: 'C10', age: 70, dosDate: '20240101', drugList: [] };
  const opt65old = { insuCode: 'C10', age: 70, dosDate: '20170101', drugList: [] };

  test('T1: 65세, 2024년, totalPrice=9000 → 1구간 정액 1,000원', () => {
    const r = calcCopayment(7000, 2000, opt65, baseRate); // totalPrice = trunc10(9000) = 9000
    expect(r.userPrice).toBe(1000);
  });

  test('T2: 65세, 2024년, totalPrice=11000 → 2구간 20% = 2,200원', () => {
    const r = calcCopayment(8000, 3000, opt65, baseRate); // totalPrice = 11000
    expect(r.userPrice).toBe(2200); // trunc100(11000×20%) = 2200
  });

  test('T3: 65세, 2017년, totalPrice=11000 → 3구간 30% = 3,300원 (날짜분기)', () => {
    const r = calcCopayment(8000, 3000, opt65old, baseRate);
    expect(r.userPrice).toBe(3300); // 2017년 → 2구간 없음, 3구간 30%
  });

  test('T4: 65세, 2024년, totalPrice=15000 → 3구간 30% = 4,500원', () => {
    const r = calcCopayment(10000, 5000, opt65, baseRate);
    expect(r.userPrice).toBe(4500); // trunc100(15000×30%) = 4500
  });

  test('T5: 65세 + V009(5%) — 산정특례 우선 (rate<30)', () => {
    const illV009 = { code: 'V009', rate: 5, isV252: false };
    const r = calcCopayment(7000, 2000, { ...opt65, mediIllness: 'V009', mediIllnessInfo: illV009 }, baseRate);
    // totalPrice=9000, V009=5% → hasSpecialIllness=true → 산정특례 적용
    expect(r.userPrice).toBe(trunc100(9000 * 0.05)); // 450 → trunc100 = 400
  });

  test('T6: 65세 + V252(50%) — C# 기준 65세 정액 우선', () => {
    const illV252 = { code: 'V252', rate: 50, isV252: true };
    const r = calcCopayment(7000, 2000, { ...opt65, mediIllness: 'V252', mediIllnessInfo: illV252 }, baseRate);
    // totalPrice=9000, V252=50% → hasSpecialIllness=false → 65세 1구간 정액 1,000원
    expect(r.userPrice).toBe(1000);
  });
});
```

---

## 5. D10 sbrdnType="" Mcode 미진입

### 5.1 원본 사양

**출처**: `22_suspicious_aggregation.md:S-11-01:L552-L559`, `23_insufficient_aggregation.md:I-052`, `ch05_verifier.md:L71-L73`

- **C# 원본** `CopaymentCalculator.cs:CalcCopay_D():L603-L618`:
  ```csharp
  if (sbrdnType.StartsWith("B")) {
      fixAmt = rate.Bcode > 0 ? rate.Bcode : 500m;  // Bcode
  } else {
      fixAmt = rate.Mcode > 0 ? rate.Mcode : 500m;  // Mcode (빈 문자열 포함)
  }
  ```
  - `sbrdnType`이 빈 문자열("")이면 → `else` 분기 → **Mcode 적용**
  - C# Mcode 기본값: **500원** (L608)
  - C# Bcode 기본값: **500원** (L613)

- **올바른 분기 규칙**:
  - `sbrdnType`이 `'B'`로 시작 → Bcode 적용
  - 나머지 (빈 문자열 `""`, `'M'` 시작 등 모두) → Mcode 적용

- **Mcode/Bcode 기본값** (`ch05_verifier.md:L71-L73`):
  - C# 원본: 500원
  - TS 현재: Mcode=1000원, Bcode=1500원 (오류)
  - 주의: 현행 DB 값이 별도로 존재할 경우 DB 값이 우선 (`rate.mcode > 0`이면 DB 값 사용)

### 5.2 현재 상태 결함

- **파일**: `src/lib/calc-engine/modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount():L214-L228`
- **결함 1**: D10 + `sbrdnType=""` → 현재 코드 `sbFirst = ''` → `if (insuCode === 'D10' && sbFirst === 'B')` 불충족 → `if (insuCode === 'D10')` 진입 → **Mcode 적용 (여기까지는 맞음)**
  - **그러나**: `S-11-01`에서 지적한 별도 경로 존재 — 주석에는 `'M'으로 시작` 조건이라 명시되어 있으나 코드는 `D10`이면 Mcode 적용 (현재 코드는 이 부분은 맞음)
  - **실제 결함**: `resolveMedicalAidFixAmount()` 주석(L197): "D10 + sbrdnType 없음 또는 'M' 시작 → rate.mcode" — 이는 맞지만 기본값이 **1000원**으로 잘못됨
- **결함 2**: Mcode 기본값 `1000원` (L224) — C# 원본 `500원`과 불일치
- **결함 3**: Bcode 기본값 `1500원` (L219) — C# 원본 `500원`과 불일치

> **재검토**: `S-11-01`의 실제 결함은 이전 버전 코드에서 `sbrdnType이 'M'으로 시작` 조건만 체크했을 때의 문제였을 수 있음. 현재 코드(`medical-aid.ts:L222`)는 `if (insuCode === 'D10')` 조건으로 sbrdnType 무관하게 Mcode 적용하므로 진입 자체는 올바름. **기본값(1000원/1500원)이 핵심 결함**임.

### 5.3 수정 사양

#### 함수 시그니처 (변경 없음)

```typescript
// 파일: src/lib/calc-engine/modules/insurance/medical-aid.ts
// 함수: resolveMedicalAidFixAmount()
```

#### 수정 전

```typescript
if (insuCode === 'D10' && sbFirst === 'B') {
  return rate.bcode > 0 ? rate.bcode : 1500;  // ← 1500 오류
}
if (insuCode === 'D10') {
  return rate.mcode > 0 ? rate.mcode : 1000;  // ← 1000 오류
}
return rate.fixCost > 0 ? rate.fixCost : 500;
```

#### 수정 후

```typescript
if (insuCode === 'D10' && sbFirst === 'B') {
  // B코드 수급권자 → Bcode (C# 기본값 500원)
  return rate.bcode > 0 ? rate.bcode : 500;
}
if (insuCode === 'D10') {
  // 기본 수급자(sbrdnType="") 또는 M코드 → Mcode (C# 기본값 500원)
  return rate.mcode > 0 ? rate.mcode : 500;
}
// D20, D40, D80, D90 → FixCost
return rate.fixCost > 0 ? rate.fixCost : 500;
```

> **운영 DB 확인 필요**: 실제 `insu_rate` 테이블의 `mcode`, `bcode` 컬럼 값이 0이 아닌 올바른 값으로 등록되어 있으면 기본값 수정은 fallback 경로에만 영향. DB 값이 올바르게 등록된 경우 실운영 영향은 제한적.

#### 분기 매트릭스 (D10 sbrdnType별)

| insuCode | sbrdnType | sbFirst | 적용 필드 | C# 기본값 | TS 수정값 |
|---------|-----------|---------|---------|----------|----------|
| D10 | `""` (빈) | `""` | mcode | 500원 | 500원 |
| D10 | `"M001"` 등 | `"M"` | mcode | 500원 | 500원 |
| D10 | `"B014"` | `"B"` | bcode | 500원 | 500원 |
| D10 | `"B030"` | `"B"` | bcode | 500원 | 500원 (B030은 Step3에서 먼저 처리됨) |
| D20 | 무관 | 무관 | fixCost | 500원 | 500원 |
| D80/D90 | 무관 | 무관 | 0원 | 해당없음 | 해당없음 (Step5 먼저) |

### 5.4 의존성

- DB `insu_rate.mcode`, `insu_rate.bcode` 컬럼 값 확인 (별도 DB 팀)
- `supabase-repo.ts:getInsuRate()`: `mcode`, `bcode` SELECT 이미 포함됨 (`L73`)

### 5.5 단위 테스트

```typescript
describe('resolveMedicalAidFixAmount — sbrdnType 분기', () => {
  const baseRate = { insuCode: 'D10', rate: 0, sixAgeRate: 0, fixCost: 500, mcode: 0, bcode: 0, age65_12000Less: 0 };

  test('T1: D10 sbrdnType="" → Mcode → 기본값 500원', () => {
    const r = resolveMedicalAidFixAmount('D10', baseRate, { dosDate: '20240101', insuCode: 'D10', age: 40, drugList: [], sbrdnType: '' });
    expect(r).toBe(500);
  });

  test('T2: D10 sbrdnType="" + rate.mcode=1000 → 1000원 (DB값 우선)', () => {
    const r = resolveMedicalAidFixAmount('D10', { ...baseRate, mcode: 1000 }, { dosDate: '20240101', insuCode: 'D10', age: 40, drugList: [], sbrdnType: '' });
    expect(r).toBe(1000);
  });

  test('T3: D10 sbrdnType="B014" → Bcode → 기본값 500원', () => {
    const r = resolveMedicalAidFixAmount('D10', baseRate, { dosDate: '20240101', insuCode: 'D10', age: 40, drugList: [], sbrdnType: 'B014' });
    expect(r).toBe(500);
  });

  test('T4: D20 → fixCost 500원', () => {
    const r = resolveMedicalAidFixAmount('D20', baseRate, { dosDate: '20240101', insuCode: 'D20', age: 40, drugList: [] });
    expect(r).toBe(500);
  });

  test('T5: D10 sbrdnType="M001" → Mcode → 기본값 500원', () => {
    const r = resolveMedicalAidFixAmount('D10', baseRate, { dosDate: '20240101', insuCode: 'D10', age: 40, drugList: [], sbrdnType: 'M001' });
    expect(r).toBe(500);
  });
});
```

---

## 6. 산정특례 V252 등급별 DB 컬럼 미조회

### 6.1 원본 사양

**출처**: `22_suspicious_aggregation.md:S-09-01:L478-L488`

- `exemption.ts:determineV252RateByGrade()`: `rate.v2520`(0등급), `rate.v2521`(1등급) 컬럼 참조
- `types.ts:InsuRate`: `v2520?: number`, `v2521?: number` 필드 정의됨
- **DB 조회 누락**: `supabase-repo.ts:getInsuRate():L73`의 SELECT 절에 `v2520`, `v2521` **없음**
- 결과: `getInsuRate()` 반환 객체에서 두 필드가 항상 `undefined` → V252 등급별 요율이 실질적으로 동작하지 않음

**V252 등급별 요율 결정 테이블**

| grade (SeSickNoType) | 사용 컬럼 | 없을 때 기본값 | 비고 |
|---------------------|---------|-------------|------|
| `"0"` 또는 `"4"` | `insu_rate.v2520` | 50% (V252) / 40% (V352) / 30% (V452) | 0등급 |
| `"1"` | `insu_rate.v2521` | 50% / 40% / 30% | 1등급 |
| 없음 | 해당 없음 | 코드 기준 고정값 | grade 미전달 |

**V252 계열 고정값**

| 코드 | 고정 본인부담률 |
|------|--------------|
| V252 (상급종합) | 50% |
| V352 (종합병원) | 40% |
| V452 (병원·의원) | 30% |

### 6.2 현재 상태 결함

- **파일**: `src/lib/calc-engine/supabase-repo.ts:getInsuRate():L73`
- **결함**: SELECT 절: `'insu_code, rate, six_age_rate, fix_cost, mcode, bcode, age65_12000_less'` — `v2520`, `v2521` 누락
- **영향**: V252 산정특례가 있는 모든 처방에서 등급별 요율(DB값) 사용 불가 → 항상 고정 50%/40%/30% 적용

### 6.3 수정 사양

#### 함수 수정: `getInsuRate()` SELECT 절 추가

```typescript
// 파일: src/lib/calc-engine/supabase-repo.ts
// 함수: getInsuRate()
// 수정 대상: L73

// 수정 전
.select('insu_code, rate, six_age_rate, fix_cost, mcode, bcode, age65_12000_less')

// 수정 후
.select('insu_code, rate, six_age_rate, fix_cost, mcode, bcode, age65_12000_less, v2520, v2521')
```

#### 반환 객체 매핑 추가

```typescript
// 수정 전 반환 (L82-L90)
return {
  insuCode: data.insu_code as string,
  rate: Number(data.rate),
  sixAgeRate: Number(data.six_age_rate),
  fixCost: Number(data.fix_cost),
  mcode: Number(data.mcode),
  bcode: Number(data.bcode),
  age65_12000Less: Number(data.age65_12000_less),
};

// 수정 후
return {
  insuCode: data.insu_code as string,
  rate: Number(data.rate),
  sixAgeRate: Number(data.six_age_rate),
  fixCost: Number(data.fix_cost),
  mcode: Number(data.mcode),
  bcode: Number(data.bcode),
  age65_12000Less: Number(data.age65_12000_less),
  v2520: data.v2520 != null ? Number(data.v2520) : undefined,  // 신규
  v2521: data.v2521 != null ? Number(data.v2521) : undefined,  // 신규
};
```

#### DB 스키마 확인 필요

```sql
-- insu_rate 테이블에 v2520, v2521 컬럼 존재 여부 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'insu_rate'
  AND column_name IN ('v2520', 'v2521');
```

컬럼이 없으면 마이그레이션 추가:

```sql
ALTER TABLE insu_rate
  ADD COLUMN v2520 numeric(5,2) DEFAULT NULL COMMENT 'V252 0등급 본인부담률(%)',
  ADD COLUMN v2521 numeric(5,2) DEFAULT NULL COMMENT 'V252 1등급 본인부담률(%)';
```

#### 분기 매트릭스 (V252 등급 × DB 조회 결과)

| mediIllness | grade | v2520 | v2521 | 적용 요율 |
|------------|-------|-------|-------|---------|
| V252 | 0 또는 4 | 30 | - | 30% (DB값) |
| V252 | 0 또는 4 | null/0 | - | 50% (고정) |
| V252 | 1 | - | 25 | 25% (DB값) |
| V252 | 1 | - | null/0 | 50% (고정) |
| V252 | 없음 | - | - | 50% (고정) |
| V352 | 0 | 30 | - | 30% (DB값) |
| V352 | 없음 | - | - | 40% (고정) |
| V452 | 0 | 30 | - | 30% (DB값) |
| V452 | 없음 | - | - | 30% (고정) |

### 6.4 의존성

- DB `insu_rate` 테이블 스키마: `v2520`, `v2521` 컬럼 추가 또는 확인
- `types.ts:InsuRate`: `v2520?`, `v2521?` 이미 정의됨 (변경 불필요)
- `exemption.ts:determineV252RateByGrade()`: 이미 `rate.v2520/v2521` 참조 (변경 불필요)
- `copayment.ts:_determineEffectiveRate()`: grade 전달 경로 이미 구현됨

### 6.5 단위 테스트

```typescript
describe('determineV252RateByGrade — DB 컬럼 반영', () => {
  test('T1: V252 grade=0, v2520=30 → 30% (DB값)', () => {
    const rate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0, v2520: 30, v2521: 25 };
    expect(determineV252RateByGrade('V252', '0', rate)).toBe(30);
  });

  test('T2: V252 grade=1, v2521=25 → 25% (DB값)', () => {
    const rate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0, v2520: 30, v2521: 25 };
    expect(determineV252RateByGrade('V252', '1', rate)).toBe(25);
  });

  test('T3: V252 grade=4, v2520=30 → 30% (grade 4는 0과 동일)', () => {
    const rate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0, v2520: 30 };
    expect(determineV252RateByGrade('V252', '4', rate)).toBe(30);
  });

  test('T4: V252 grade=0, v2520 미조회(undefined) → 50% (고정)', () => {
    const rate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 };
    // v2520 없음 → undefined → 고정 50%
    expect(determineV252RateByGrade('V252', '0', rate)).toBe(50);
  });

  test('T5: V352 grade=0, v2520=30 → 30% (DB값, V352도 v2520 사용)', () => {
    const rate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0, v2520: 30 };
    expect(determineV252RateByGrade('V352', '0', rate)).toBe(30);
  });

  test('T6: V452, grade 없음 → 30% (고정)', () => {
    const rate = { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 };
    // grade를 전달하지 않음 → determineExemptionRate 경로로 처리
    expect(determineV252RateByGrade('V452', '', rate)).toBe(30);
  });
});
```

---

## 의존성 맵 (수정 순서 권고)

```
[선행 필요]
drug-amount.ts (I-002)
  └── 항별 합산 분리 (sumA/B/D/E/U)
        ├── calcNPaySelfAmount() [항목 1]
        └── calcUItemCopayment() [항목 2]

[독립 수정 가능]
supabase-repo.ts:getInsuRate() [항목 6] ← DB 스키마 확인 선행
medical-aid.ts:resolveMedicalAidFixAmount() [항목 5] ← 단독 수정
veteran.ts:calcVeteran() + getDoubleReductionRate() [항목 3] ← 단독 수정
copayment.ts 65세 분기 [항목 4] ← _determineEffectiveRate 재작성 연동
```

---

## 수정 파일 목록

| 파일 | 수정 유형 | 관련 항목 |
|------|---------|---------|
| `src/lib/calc-engine/copayment.ts` | 신규 함수 추가, 65세 분기 재작성 | 1, 2, 4 |
| `src/lib/calc-engine/modules/insurance/veteran.ts` | M61 분기 제거, getDoubleReductionRate 반환값 수정 | 3 |
| `src/lib/calc-engine/modules/insurance/medical-aid.ts` | Mcode/Bcode 기본값 수정 | 5 |
| `src/lib/calc-engine/supabase-repo.ts` | SELECT 절 v2520/v2521 추가 | 6 |
| `src/lib/calc-engine/types.ts` | CalcResult 필드 추가 | 1, 2 |

---

**[약제비 분析용]**
