# PharmaEdu Phase 8 감사 — 최종 종합 보고서

> 작성자: Phase 3 총괄 담당 (PM)
> 작성일: 2026-04-07
> 감사 범위: Phase 1 산출물 5종 + Phase 2 챕터 분석 24종 (ch01~ch12 analyst/verifier)
> 상태: **최종본 (FINAL)**

---

## 섹션 1. Executive Summary

PharmaEdu 약제비 계산 엔진(TypeScript `calc-engine`)은 한국 건강보험 약제비 청구 계산 로직을 C# 원본(`YakjaebiCalc.Engine`)으로부터 웹 기반 교육 플랫폼으로 포팅한 프로젝트이다. Phase 8 감사는 4개 원본 소스(비즈팜 VB6, 공단 PDF, 유팜 C#, EDB C#)와의 비교를 통해 현재 TypeScript 구현의 완성도를 정밀 측정하였다.

### 핵심 결론

**현재 구현 완성도는 교육용 MVP 시연 수준이며, 실제 건강보험 청구에 사용하기에는 다음과 같은 구조적 결함이 존재한다.**

| 심각도 | 건수 | 대표 사례 |
|--------|------|----------|
| Critical | 44건 | 선별급여 독립 계산 전무, 의약품관리료 25구간 미구현, 공비 계산 전혀 없음 |
| High | 38건 | 차등수가 미구현, 보훈 M61 오적용, Ceil10 미구현 |
| Medium | 21건 | 비대면 시행일 분기 미사용, 공상등구분 Enum 미포팅 |
| Low | 9건 | WageItem 인터페이스 미정의, KST 시간대 처리 |
| **합계** | **112건** | |

19개 통합 시나리오 실행 결과: **PASS 12건 / FAIL 7건** (단, 4건은 기대값 문서 오류로 실질 엔진 오류는 3건).

CalcOptions 포팅율 **42%** (45개 중 19개), CalcResult 포팅율 **40%** (42개 중 17개)로, 데이터 계약 자체가 아직 MVP 수준에 머물러 있다.

---

## 섹션 2. 감사 범위 및 방법론

### 2.1 감사 대상

| 구분 | 파일/소스 | 설명 |
|------|----------|------|
| TypeScript 대상 | `src/lib/calc-engine/` | 소스 34파일, 6,777줄 |
| C# 원본 비교 | `YakjaebiCalc.Engine/` | 35파일, 약 7,342줄 |
| 핵심 C# 파일 | `DispensingFeeCalculator.cs` | 2,059줄, 9단계 조제료 파이프라인 |
| 핵심 C# 파일 | `CopaymentCalculator.cs` | 1,173줄, 15단계 본인부담금 계산 |
| DB 데이터 | `seed.sql` | 수가 마스터 초기 데이터 |

### 2.2 Phase 2 챕터 분석 팀 구성

| 챕터 | 주제 | 담당 |
|------|------|------|
| CH01 | 약품금액 | Analyst 10A + Verifier 10B |
| CH02 | 조제료 코드체계(Z코드) | Analyst + Verifier |
| CH03 | 조제료 수가 계산 | Analyst + Verifier |
| CH04 | 가산 로직 | Analyst + Verifier |
| CH05 | 보험유형별 본인부담금 | Analyst + Verifier |
| CH06 | 3자배분/공비 | Analyst + Verifier |
| CH07 | 반올림/절사 규칙 | Analyst + Verifier |
| CH08 | 특수케이스/엣지케이스 | Analyst + Verifier |
| CH09 | 타입/인터페이스 포팅 정확도 | Analyst + Verifier |
| CH10 | 계산 파이프라인 | Analyst + Verifier |
| CH11 | 테스트 시나리오 | Analyst + Verifier |
| CH12 | 보훈 약국 약제비 청구 | Analyst + Verifier |

### 2.3 이슈 분류 기준

- **누락(Missing)**: 원본에 있는 기능이 TS에 전혀 없음
- **의심(Suspicious)**: 구현은 있으나 로직 오류/불일치 의심
- **부족(Insufficient)**: 구현이 있으나 완성도 미달, 엣지케이스 미처리

### 2.4 심각도 기준

- **Critical**: 금액 오산출, 청구 반송, 법령 위반 직결
- **High**: 특정 보험유형/조건에서 오산출
- **Medium**: 엣지케이스 미처리, 코드 품질 문제
- **Low**: 유지보수성, 명명 일관성 문제

---

## 섹션 3. 전체 통계

### 3.1 챕터별 이슈 수

| 챕터 | Critical | High | Medium | Low | 합계 |
|------|----------|------|--------|-----|------|
| CH01 약품금액 | 3 | 4 | 2 | 1 | 10 |
| CH02 Z코드 | 6 | 3 | 2 | 2 | 13 |
| CH03 조제료 계산 | 5 | 3 | 2 | 1 | 11 |
| CH04 가산 로직 | 2 | 4 | 1 | 1 | 8 |
| CH05 본인부담금 | 6 | 4 | 2 | 1 | 13 |
| CH06 3자배분 | 4 | 3 | 1 | 0 | 8 |
| CH07 반올림/절사 | 4 | 5 | 1 | 1 | 11 |
| CH08 특수케이스 | 5 | 3 | 2 | 1 | 11 |
| CH09 타입/인터페이스 | 2 | 2 | 3 | 2 | 9 |
| CH10 파이프라인 | 5 | 5 | 4 | 1 | 15 |
| CH11 테스트 | 2 | 5 | 4 | 1 | 12 |
| CH12 보훈 약국 | 8 | 6 | 3 | 0 | 17 |
| **합계** | **52** | **47** | **27** | **12** | **138** |

> 주: 복수 챕터에서 중복 언급된 이슈를 정리하면 실질 독립 이슈는 약 112건이다.

### 3.2 카테고리별 분포

| 카테고리 | Critical | High | 소계 |
|---------|----------|------|------|
| 미구현 기능(Missing) | 28 | 19 | 47 |
| 로직 오류(Suspicious) | 11 | 14 | 25 |
| 불완전 구현(Insufficient) | 5 | 14 | 19 |

### 3.3 통합 테스트 결과 (19개 시나리오)

| 구분 | 건수 |
|------|------|
| PASS | 12 |
| FAIL — 기대값 문서 오류 | 4 (S02/S05/S10/S14) |
| FAIL — 모듈 연결 누락 | 2 (S07/S12) |
| FAIL — ENGINE_BUG | 1 (S06) |
| 3자배분 항등식 (totalPrice=userPrice+pubPrice) | 19/19 OK |

---

## 섹션 4. Critical 이슈 Top 44

아래 목록은 금액 오산출, 청구 반송, 법령 위반에 직결되는 최우선 수정 대상이다.

### 4.1 약품금액 (CH01) — 3건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-01 | **비급여 코로나19 치료제 50,000원 강제 세팅 미포팅**: `DrugItem.ForceSetSum()` 메서드 및 EXTYPE="1" 필터 전혀 없음. 50,000원을 초과하는 단가가 그대로 계산에 사용됨 | `drug-amount.ts:calcDrugAmountSum()` | CH01 §4 |
| C-02 | **Del_Yn 코드 7종 분기 전혀 없음**: `DrugItem`에 `delYn` 필드 없음. 삭제/보류 약품이 계산에 포함될 수 있음 | `types.ts:DrugItem` | CH01 §4 |
| C-03 | **A/B/D/E/U항 개별 합산 미분리**: `calcDrugAmountSum()`이 급여/비급여 2분류만 반환. 선별급여 항별 독립 계산 전혀 불가 | `drug-amount.ts:L35-44` | CH01 §4, CH10 §Step3-4 |

### 4.2 조제료 코드체계 Z코드 (CH02) — 6건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-04 | **Z4130 자가투여주사제 조제료 완전 누락**: 자가주사 조제료 코드 자체가 없음 | `dispensing-fee.ts` | CH02 §4 |
| C-05 | **Z5101~Z5391 의약품관리료 25구간 코드 미구현**: seed.sql에도 없음. Z5001/Z5011 처방조제 경로 분기도 없음 | `seed.sql`, `dispensing-fee.ts` | CH02 §4 |
| C-06 | **text3 차등수가 접미사 전무**: seed.sql에 "011" 코드 62개 존재하나 미사용. 차등수가 산정 자체 불가 | `surcharge.ts`, `seed.sql` | CH02 §4, CH04 §4 |
| C-07 | **소아심야 Z2000640 ↔ 소아야간 Z2000610 오분류**: `holidayGb='8'` 단일 값으로 소아야간/소아심야를 구별 불가. 금액 차이 발생 | `surcharge.ts:determineSurcharge()` | CH02 §4, CH03 §4 |
| C-08 | **산제 신체계 16일+ `baseCode = 'Z4116'` 하드코딩 버그**: 16일 이상 산제에 Z4116 코드가 잘못 하드코딩됨 | `dispensing-fee.ts:L266-268` | CH02 §4 |
| C-09 | **ZH001~ZH004 코로나19 투약관리료 코드 없음**: seed.sql에도 없으며 관련 가산 로직 없음 | `seed.sql`, `dispensing-fee.ts` | CH02 §4, CH03 §4 |

### 4.3 조제료 수가 계산 (CH03) — 5건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-10 | **Z3000 심야 신체계 분기 없음**: 20231101 이후 3,260원 적용해야 하나 구체계 1,410원 계속 적용 — 건당 1,850원 오산출 | `dispensing-fee.ts` | CH03 §4 |
| C-11 | **Z2000 소아심야 신체계 분기 없음**: 20231101 이후 신체계 단가 미반영 | `dispensing-fee.ts` | CH03 §4 |
| C-12 | **급여 조제료 미산정 조건 2~3번 미구현**: 조기종료 조건 일부 누락으로 조제료가 산정되어선 안 될 케이스에서 산정됨 | `dispensing-fee.ts` | CH03 §4 |
| C-13 | **Z5xxx 의약품관리료 처방조제 경로 완전 누락**: 직접조제 경로는 구현되나 처방조제 경로가 없음 | `dispensing-fee.ts` | CH03 §5 |
| C-14 | **비급여 조제료 차액 산정 없음**: 비급여 조제료를 별도로 산정하는 로직 전혀 없음 | `dispensing-fee.ts` | CH03 §4 |

### 4.4 가산 로직 (CH04) — 2건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-15 | **차등수가 전체 미구현**: text3 접미사 없음, 4구간 판정(75건이하/76~100/101~150/151+) 없음, 차등지수 산출 공식 없음. 처방건수 기반 수가 감산 전혀 불가 | `surcharge.ts`, `dispensing-fee.ts` | CH04 §4 |
| C-16 | **소아심야 산정코드 접미사 오류**: `holidayGb='8'`이 소아야간과 소아심야를 구별 불가로 인한 코드 오분류 (C-07과 연관) | `surcharge.ts:getSurchargeSuffix()` | CH04 §4 |

### 4.5 보험유형별 본인부담금 (CH05) — 6건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-17 | **선별급여 A×50%+B×80%+D×30%+E×90% trunc10 독립 계산 없음**: A/B/D/E항 분리 집계 자체가 없어 선별급여 본인부담 계산 전혀 불가 | `copayment.ts` | CH05 §4 |
| C-18 | **U항 100/100 본인부담금 및 요양급여비용총액2 없음**: U항 독립 집계, trunc10 처리, totalPrice2 필드 모두 없음 | `copayment.ts`, `types.ts:CalcResult` | CH05 §4, CH10 §Step8-2 |
| C-19 | **의료급여 V252 경증질환 3% 차등제 없음**: V252 시리즈 분리 계산 로직 없음 | `copayment.ts`, `modules/insurance/medical-aid.ts` | CH05 §4 |
| C-20 | **G타입 M61 역산 공식 오적용**: C타입 공식을 G타입에 잘못 이식. 고엽제 환자 보훈청구액 오산출 | `veteran.ts:calcVeteran():L314-324` | CH05 §4, CH12 §4 |
| C-21 | **65세 이상 2구간 날짜조건(20180101) 누락**: 2018년 전후 정액 기준 분기 없음 | `copayment.ts` | CH05 §4 |
| C-22 | **D타입 M20 이중감면 미포팅**: D타입 + 보훈감면 조합 케이스 처리 없음 | `copayment.ts`, `veteran.ts` | CH05 §4 |

### 4.6 3자배분/공비 (CH06) — 4건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-23 | **공비(PubPrice) 계산 로직 전혀 없음**: `pubPrice` 필드는 선언되어 있으나 `totalPrice - userPrice` 단순 계산만 존재. 실제 공비 산출 로직 없음 | `copayment.ts:L184` | CH06 §4 |
| C-24 | **특수공비 302/101/102 재배분(ApplySpecialPub) 완전 미포팅**: 3소스 모두 구현된 핵심 기능이 TS에 전혀 없음 | `copayment.ts` | CH06 §4 |
| C-25 | **RealPrice/SumUser/SumInsure 최종 확정 로직 없음**: 3자배분 후처리 단계가 미구현으로 최종 확정값 불신뢰 | `copayment.ts` | CH06 §4 |
| C-26 | **100%약품(EXTYPE9) 3자배분 없음**: ExType=9 약품의 별도 3자배분 로직 없음 | `copayment.ts` | CH06 §4 |

### 4.7 반올림/절사 규칙 (CH07) — 4건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-27 | **R13 요양급여비용총액2 필드 미구현**: `CalcResult`에 `totalPrice2` 필드 없음. 전자청구 필수 항목 | `types.ts:CalcResult` | CH07 §4 |
| C-28 | **R14~R17 선별급여 4종 절사 규칙 미구현**: 선별급여 A/B/D/E 항별 절사 처리 전혀 없음 | `rounding.ts` | CH07 §4 |
| C-29 | **Ceil10 함수 미구현**: 보훈 청구액 올림 처리 함수 없음. 유팜 방식인데 절사(trunc10)로 하드코딩됨 | `rounding.ts` | CH07 §4, CH12 §5 |
| C-30 | **C31/C32 건강보험 경로 오진입**: 의료급여 코드 C31/C32가 건강보험 경로로 잘못 진입. 절사 단위 불일치 (2016.09.29 분기 없음) | `copayment.ts` | CH07 §4 |

### 4.8 특수케이스/엣지케이스 (CH08) — 5건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-31 | **ZE010 seed.sql 단가 5배 오류**: 5,000원 기재 → 정확한 값 1,000원 (즉시 수정 필요) | `seed.sql:L291` | CH08 §4 |
| C-32 | **ZE020 seed.sql 단가 오류**: 10,000원 기재 → 정확한 값 3,000원 (즉시 수정 필요) | `seed.sql:L292` | CH08 §4 |
| C-33 | **ZE101/ZE102 seed.sql 2024/2026 테이블 모두 누락**: 마스터 데이터 자체 없음 | `seed.sql` | CH08 §4 |
| C-34 | **2025 설날 연휴 5일 누락**: 01-25~01-27, 02-01~02-02 누락. `seasonal.ts`에 01-28~01-30만 있음. 해당 기간 명절가산 미산정 | `modules/special/seasonal.ts` | CH08 §4 |
| C-35 | **E10 연도별 분기 없음, M계열 명절가산 대상 미포함**: 2023년 이전/이후 연도 분기 없고 보훈 환자 명절가산 미적용 | `modules/special/seasonal.ts` | CH08 §4 |

### 4.9 타입/인터페이스 (CH09) — 2건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-36 | **CalcOptions 26개 필드 누락** (포팅율 42%): Sex, PsCode, CustId, RealDose, DrugSafeYN, SelfInjYN, SpecialPub, GradeSatIn, NPayRoundType, IsBohunNpayUser, NPayRoundF10YN 등 핵심 연산 파라미터 누락. `NPayExpYN`은 주석이 깨진 상태 | `types.ts:CalcOptions` | CH09 §2 |
| C-37 | **PrsBillM/CalcResult 25개 필드 누락** (포팅율 40%): SumInsuDrug50/80/30/90(선별급여), UnderUser/UnderInsu, GsCode(공상등구분) 등 청구서 필수 필드 누락 | `types.ts:CalcResult` | CH09 §3 |

### 4.10 파이프라인 (CH10) — 5건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-38 | **항별 분리 집계(A/B/D/E/U/V/W항) 전혀 없음**: 다른 5개 이상 Critical 이슈의 공통 선행조건. 이 구조 없이 총액2/선별급여/U항 계산 전부 불가 | `drug-amount.ts:calcDrugAmountSum()` | CH10 §Step3-4 |
| C-39 | **서식번호 결정(H024/H124/H025/H125) 미구현**: 처방조제×건강보험→H024 등 서식번호 결정 로직 없음. 전자청구 출력 필수 항목 | `index.ts`, `types.ts` | CH10 §Step1-2 |
| C-40 | **DueDate 수가 조회 연도 손실**: `dispensing-fee.ts:L179`에서 `year`만 추출. 연내 수가 개정 반영 불가 (예: 2024.07.01 개정 시 1~6월 처방에 개정 수가 적용 오류) | `dispensing-fee.ts:L179`, `supabase-repo.ts:getSugaFeeMap()` | CH10 §3.1 |
| C-41 | **약품 단가 상한금액 검증 없음**: `calcDrugAmount()`가 입력 `price`를 그대로 사용하며 상한금액 DB 조회/비교 없음 | `drug-amount.ts:calcDrugAmount()` | CH10 §Step2-3 |
| C-42 | **EXTYPE 필터 미적용 후 유효건수 0 조기종료 없음**: 모든 약품이 EXTYPE=1 또는 9로 제외되는 케이스에서 조기종료가 발동되지 않음 | `index.ts:calculate()` | CH10 §3.2 |

### 4.11 보훈 약국 (CH12) — 8건

| # | 이슈 | 위치 | 근거 |
|---|------|------|------|
| C-43 | **`calcMpvaPrice()` 보험유형 필터 누락**: D타입/C21/C31/C32에서 M10 이외 코드 시 MpvaPrice=0 강제 미적용 → 과산정 | `veteran.ts:L210-L226` vs `CopaymentCalculator.cs:L817-L834` | CH12 §3.1 |
| C-44 | **`GsCode.Determine()` 미포팅**: 공상등구분 결정 함수 없음. 청구서 EDI 공상등구분 필드 공란 | `GsCode.cs:L55` → TS 대응 없음 | CH12 §4-1 |
| C-45 | **MT038='A' 도서벽지 60% 감면 처리 미구현**: 처리 파라미터 및 출력 필드 없음 | `veteran.ts` 전체 | CH12 §5.4 |
| C-46 | **MT038='2' 보훈국비환자 타질환 처리 미구현**: MT038 출력 필드 자체 없음 | `veteran.ts` 전체 | CH12 §5.6 |
| C-47 | **MT038='1' 2018.01.01 이전/이후 날짜 분기 미구현**: 2018 이전 레거시 처리 시 오기재 위험 | `veteran.ts` 전체 | CH12 §5.6 |
| C-48 | **두 청구 체계 분리 모듈 없음**: 보훈병원 업무처리 기준(공상등구분 3/5/6/J) vs 보훈위탁진료(0/4/6/7+MT038) 혼용 시 청구 반송 | `copayment.ts:L85-93` | CH12 §5.3 |
| C-49 | **S06 ENGINE_BUG — D10 sbrdnType="" Mcode 미적용**: sbrdnType="" 시 Mcode 미진입, 기대 1,000원 대신 500원 산출 | `modules/insurance/medical-aid.ts:resolveMedicalAidFixAmount()` | CH11 §6 |
| C-50 | **S07 C10+bohunCode 조합 보훈 모듈 미진입**: `insuCode.charAt(0)==='G'`만 확인하여 C10 처방에 bohunCode=M10이 있을 때 보훈 모듈 미호출, userPrice 7,600원 오산출 (기대 0원) | `copayment.ts:L85-93` | CH11 §6 |

---

## 섹션 5. 챕터별 요약

### CH01 — 약품금액 (`drug-amount.ts`)

- **포팅 완성도**: 낮음 (기본 단가×수량×일수 계산만 구현)
- **주요 누락**: 비급여 코로나19 강제 세팅, Del_Yn 분기, 항별 분리 집계, 1회투약량 소수점 전처리
- **주요 오류**: 없음 (단순 사칙연산 부분은 정확)
- **즉시 조치**: Del_Yn 필드 추가, EXTYPE 필터 추가, 항별 분리 집계 구조(`section_totals`) 신설

### CH02 — 조제료 코드체계 (`dispensing-fee.ts`, `seed.sql`)

- **포팅 완성도**: 중간 (Z1000/Z2000/Z3000/Z4xxx 기본 코드는 구현, 차등수가/특수코드 미구현)
- **주요 누락**: Z4130, Z5101~Z5391(25구간), text3 차등수가 접미사, ZH001~ZH004
- **주요 오류**: 소아심야/소아야간 오분류, 산제 Z4116 하드코딩 버그
- **데이터 오류**: seed.sql의 ZE010(5배), ZE020(3.3배) 단가 오류, ZE101/ZE102 누락

### CH03 — 조제료 수가 계산 (`dispensing-fee.ts`, `modules/special/`)

- **포팅 완성도**: 중간 (기본 경로 구현, 심야/소아 신체계 미반영)
- **주요 누락**: Z3000 심야 신체계(1,850원 차이), Z2000 소아심야 신체계, Z5xxx 처방조제 경로
- **주요 오류**: ZC 비대면 시행일 분기 `_dosDate` 미사용(TODO 주석만)

### CH04 — 가산 로직 (`surcharge.ts`)

- **포팅 완성도**: 중간 (holidayGb 7값 체계는 정확, 차등수가 전혀 없음)
- **주요 누락**: 차등수가 4구간 판정, 6세 이상 성인 심야→야간 다운그레이드, 소아 "000000" 주민번호 조건
- **주요 오류**: 소아심야 코드 오분류

### CH05 — 보험유형별 본인부담금 (`copayment.ts`, `modules/insurance/`)

- **포팅 완성도**: 낮음 (C10 기본 경로만 완전, 선별급여/의료급여 특수케이스 다수 누락)
- **주요 누락**: 선별급여 독립 계산, U항 100/100, V252 3% 차등제, D타입 M20 이중감면
- **주요 오류**: G타입 M61 역산 오적용, D10 Mcode 기본값 500원 오류(기재 1,000원), D10 Bcode 기본값 오류

### CH06 — 3자배분/공비 (`copayment.ts`, `veteran.ts`)

- **포팅 완성도**: 낮음 (MpvaPrice 역산 공식은 C#과 일치, 공비 계산 로직 전혀 없음)
- **주요 누락**: 공비(PubPrice) 계산 로직, 특수공비 302/101/102 재배분, RealPrice/SumInsure 확정 로직
- **확인됨**: MpvaPrice 역산 공식 C#과 100% 일치, 보훈병원 6곳 코드 일치

### CH07 — 반올림/절사 규칙 (`rounding.ts`)

- **포팅 완성도**: 부분 (trunc10/trunc100 C#과 동일 확인, 선별급여/보훈 전용 함수 없음)
- **주요 누락**: R13~R17 선별급여 절사, Ceil10 함수, NPayRoundType 6종 디스패처
- **주요 오류**: C31/C32 건강보험 경로 오진입(2016.09.29 날짜 분기 없음)
- **확인됨**: trunc10/trunc100 정확, 유팜 MathHelper 명칭버그 회피 성공

### CH08 — 특수케이스/엣지케이스 (`seed.sql`, `modules/special/`)

- **포팅 완성도**: 부분 (648약품, 본인부담상한제 구현, seed.sql 데이터 오류 다수)
- **주요 누락**: ZE101/ZE102 데이터, 2025 설날 5일 누락, 비급여 NPayRoundType 모듈
- **즉시 조치**: `seed.sql:L291-292` ZE010/ZE020 단가 수정 (금액이 3~5배 오기재)

### CH09 — 타입/인터페이스 (`types.ts`)

- **포팅 완성도**: CalcOptions 42%, CalcResult 40%
- **주요 누락**: 26개 CalcOptions 필드, 25개 CalcResult 필드, 4개 Enum 클래스 미정의
- **확인됨**: InsuPayType 7개 값 100% 일치, TakeType 3개 값 100% 일치
- **주의**: `Age` 타입 불일치 (C#: string, TS: number), 이름 불일치 2건

### CH10 — 계산 파이프라인 (`index.ts`)

- **포팅 완성도**: EDB 6단계와 근접하나 C# 15단계 CopaymentCalculator의 절반 미포팅
- **주요 누락**: 항별 분리 집계(5개 Critical의 선행조건), 서식번호 결정, DueDate 세밀도
- **구조 문제**: `index.ts` Step 0~6(6단계) vs CH10 규격 Step 1~10(10단계) 불일치

### CH11 — 테스트 시나리오 (`scripts/run-scenarios.ts`, `__tests__/`)

- **현황**: 19개 시나리오 중 12 PASS / 3 엔진 오류 / 4 기대값 문서 오류
- **커버리지**: C# 1,505건 전수 루프 대비 우리 0.07% (1건)
- **주요 누락**: 43개 C# 시나리오 중 26개(60%) 미커버, 선별급여/차등수가/비대면 시나리오 전무
- **확인됨**: 19개 전체 3자배분 항등식 OK, 5개 시나리오에서 userPrice 1원 단위 일치

### CH12 — 보훈 약국 (`veteran.ts`)

- **포팅 완성도**: 감면율 계산/3자배분 핵심은 정확, 청구 체계 분리/MT038 처리 전무
- **주요 누락**: MT038 출력 필드 자체 없음, 두 청구 체계 분리 모듈, GsCode.Determine() 미포팅
- **주요 오류**: calcMpvaPrice() 보험유형 필터 누락으로 D타입 과산정
- **확인됨**: getBohunRate() C#과 동일, 보훈병원 6곳 코드 일치

---

## 섹션 6. 카테고리별 통찰

### 6.1 구조적 결함 — 항별 분리 집계 부재

현재 구현의 가장 근본적인 구조 결함은 **약품금액 항별 분리 집계 부재**이다. `calcDrugAmountSum()`이 급여/비급여 2분류만 반환하는 것이 다음 이슈들의 공통 선행조건(블로커)이 된다:

- 선별급여 A×50%+B×80%+D×30%+E×90% 독립 계산 불가 (C-17)
- U항 100/100 본인부담금 계산 불가 (C-18)
- 요양급여비용총액2 산출 불가 (C-27)
- 3자배분 완전 구현 불가 (C-23)
- 전자청구 명세서 줄 생성 불가 (CH10 §Step10-2)

**이 구조 변경 없이는 법정 전자청구 명세서를 생성할 수 없다.**

### 6.2 데이터 오류 — seed.sql 즉시 수정 필요

seed.sql의 수가 데이터 오류는 코드 수정과 별개로 **즉시 수정이 필요한 데이터 문제**이다:

| 코드 | 현재 단가 | 정확한 단가 | 오류 배수 |
|------|---------|----------|---------|
| ZE010 | 5,000원 | 1,000원 | 5배 |
| ZE020 | 10,000원 | 3,000원 | 약 3.3배 |
| ZE101 | 누락 | — | — |
| ZE102 | 누락 | — | — |

또한 2025 설날 연휴(01-25~01-27, 02-01~02-02) 5일 누락은 `seasonal.ts` 하드코딩 날짜 배열에서 수정이 필요하다.

### 6.3 시점관리 — DueDate 정밀도 부족

`dispensing-fee.ts:L179`에서 `year` 4자리만 추출하는 문제는 연내 수가 개정 시 **잘못된 수가를 적용하는 구조적 오류**이다. 한국 건강보험 수가는 매년 1~2회 개정되며(예: 7월 1일 개정), 개정 전 처방일(1~6월)에 개정 수가가 적용될 수 있다. EDB·유팜·비즈팜 모두 8자리 전체 날짜를 수가 조회에 사용한다.

### 6.4 보훈 체계 — 청구 반송 위험

CH12 분석에서 식별된 MT038 처리 미구현은 실 운영 시 **심사 반송의 직접적 원인**이 된다:
- 두 청구 체계(보훈병원 업무처리 vs 보훈위탁진료) 혼용 시 공상등구분 코드 오기재
- MT038='1' 2018년 이후 폐지 분기 없음
- MT038='2', MT038='A' 출력 필드 자체 없음

### 6.5 테스트 커버리지 — 심각한 격차

C# 1,505건 전수 테스트 대비 TS는 파이프라인 통합 기준 **0.07%** 커버리지이다. 특히 다음 영역이 완전히 테스트되지 않았다:

- 산정특례(암/희귀/결핵) 파이프라인 통합 시나리오 전무
- 선별급여 시나리오 및 단위 테스트 전무
- 차등수가 시나리오 전무
- 비대면 조제 시나리오 전무

---

## 섹션 7. 권장 우선순위 로드맵

### Phase A — 즉시 수정 (1~2주, 데이터 오류 + 엔진 버그)

> 목표: 현재 19개 시나리오 FAIL 3건 해소, 데이터 정합성 확보

| 순번 | 작업 | 예상 공수 | 위치 |
|------|------|---------|------|
| A-1 | `seed.sql` ZE010/ZE020 단가 수정 | 0.5일 | `seed.sql:L291-292` |
| A-2 | `seed.sql` ZE101/ZE102 행 추가 | 1일 | `seed.sql` |
| A-3 | `seasonal.ts` 2025 설날 연휴 5일 추가 | 0.5일 | `modules/special/seasonal.ts` |
| A-4 | **S06 ENGINE_BUG** — `resolveMedicalAidFixAmount()` sbrdnType="" 시 Mcode 적용 수정 | 1일 | `modules/insurance/medical-aid.ts` |
| A-5 | **S07 ENGINE_BUG** — `calcCopayment()` bohunCode 존재 시 insuCode 무관 보훈 모듈 호출 | 1일 | `copayment.ts:L85-93` |
| A-6 | `dispensing-fee.ts:L266-268` 산제 신체계 Z4116 하드코딩 버그 수정 | 1일 | `dispensing-fee.ts` |
| A-7 | Z3000 심야 신체계(20231101 이후 3,260원) 날짜 분기 추가 | 1일 | `dispensing-fee.ts` |
| A-8 | `dispensing-fee.ts` year→dosDate 8자리 수가 조회 수정 및 DB 스키마 DueDate 컬럼 추가 | 3일 | `dispensing-fee.ts:L179`, `supabase-repo.ts:getSugaFeeMap()` |

### Phase B — 구조 개선 (3~8주, 핵심 기능 누락 해소)

> 목표: 건강보험 C10 단순 처방조제 완성도 확보, 법정 전자청구 가능 구조 수립

| 순번 | 작업 | 의존성 | 위치 |
|------|------|-------|------|
| B-1 | **항별 분리 집계 구조(`section_totals`) 신설** — A/B/D/E/U/V/W항 독립 집계 | 없음 | `drug-amount.ts:calcDrugAmountSum()` |
| B-2 | **선별급여 본인부담 독립 계산** — A×50%+B×80%+D×30%+E×90% trunc10 | B-1 | `copayment.ts` |
| B-3 | **U항 100/100 본인부담금 + 요양급여비용총액2 필드** | B-1 | `copayment.ts`, `types.ts:CalcResult` |
| B-4 | **공비(PubPrice) 계산 로직** + RealPrice/SumInsure 확정 | B-2, B-3 | `copayment.ts` |
| B-5 | **특수공비 302/101/102 재배분(ApplySpecialPub)** | B-4 | `copayment.ts` |
| B-6 | **서식번호 결정(H024/H124/H025/H125)** + `CalcResult` 필드 추가 | 없음 | `index.ts`, `types.ts` |
| B-7 | **CalcOptions 핵심 누락 필드 추가**: NPayRoundType, SpecialPub, CustId, SelfInjYN 등 | 없음 | `types.ts:CalcOptions` |
| B-8 | **Z5101~Z5391 의약품관리료 25구간** — seed.sql 추가 + 처방조제 경로 구현 | 없음 | `seed.sql`, `dispensing-fee.ts` |
| B-9 | **GsCode.Determine() 포팅** — 공상등구분 결정 함수 | 없음 | `veteran.ts` 또는 신규 파일 |
| B-10 | **MT038 출력 필드 및 날짜 분기** — '1'(2018前), '2', 'A' 처리 | B-9 | `veteran.ts` |
| B-11 | **EXTYPE 필터** (ExType=1, ExType=9) + Del_Yn 7종 분기 | 없음 | `drug-amount.ts`, `types.ts:DrugItem` |
| B-12 | **Ceil10 함수 추가** + NPayRoundType 6종 디스패처 | 없음 | `rounding.ts` |
| B-13 | **65세 이상 2구간 날짜조건(20180101)** 분기 추가 | 없음 | `copayment.ts` |
| B-14 | **calcMpvaPrice() 보험유형 필터** — D타입/C21/C31/C32 제외 | 없음 | `veteran.ts:L210-226` |

### Phase C — 완성도 향상 (8~20주, 특수 보험유형 + 테스트 확충)

> 목표: 전 보험유형 법정 수준 완성, C# 1,505건 전수 테스트 수준 달성

| 순번 | 작업 | 의존성 |
|------|------|-------|
| C-1 | 차등수가 4구간 판정 + text3 접미사 + 차등지수 산출 | B-7 |
| C-2 | Z4130 자가투여주사제 조제료 구현 | 없음 |
| C-3 | V252 경증질환 3% 차등제 | B-1 |
| C-4 | D타입 M20 이중감면 | 없음 |
| C-5 | 비급여 조제료 차액 산정 + NPayRoundType 6종 적용 | B-7, B-12 |
| C-6 | 비급여 코로나19 치료제 50,000원 강제 세팅 (`ForceSetSum` 포팅) | B-11 |
| C-7 | 두 청구 체계 분리 모듈 (보훈병원 vs 위탁) | B-9, B-10 |
| C-8 | 100%약품(EXTYPE9) 3자배분 | B-4 |
| C-9 | MpvaComm 산출 로직 | B-4 |
| C-10 | 산정특례/선별급여/차등수가/비대면 통합 시나리오 추가 | 전체 |
| C-11 | Jest/Vitest 도입 + CI 통합 | 없음 |
| C-12 | C# 1,505건 매트릭스 테스트 TS 버전 구현 | C-10 |
| C-13 | 조제투약내역 줄 목록 생성 (전자청구 명세서 포맷) | B-6 |
| C-14 | 특정내역 코드 생성 (JS002/CT002/MT008 등) | C-13 |

---

## 섹션 8. 결론 및 다음 단계

### 8.1 결론

PharmaEdu TypeScript calc-engine은 현재 **건강보험(C10) 단순 처방조제 케이스를 교육 목적으로 시연할 수 있는 수준**이다. 3자배분 항등식이 19개 시나리오 전체에서 유지되고, 핵심 반올림 함수(trunc10/trunc100)가 C# 원본과 일치하며, 보훈 감면율 계산이 정확한 점은 긍정적 성과이다.

그러나 다음 이유로 **실제 건강보험 청구 시스템으로 사용하기에는 아직 부적합**하다:

1. **항별 분리 집계 부재**: 법정 전자청구 명세서의 핵심 구조가 없음
2. **seed.sql 데이터 오류**: ZE010이 5배, ZE020이 3.3배 과기재됨
3. **DueDate 수가 조회 결함**: 연내 수가 개정 반영 불가
4. **보훈 청구 체계 미분리**: MT038 출력 필드 전무로 청구 반송 위험
5. **44건 Critical 이슈**: 금액 오산출에 직결되는 미구현/오류 항목

### 8.2 즉시 조치 필요 (경영진 승인 요청)

1. **seed.sql 데이터 수정 배포** (A-1~A-3): ZE010/ZE020 단가, ZE101/ZE102 추가, 2025 설날 날짜 — 0.5일 내 수정 가능, 운영 중인 DB에 즉각 적용 권장
2. **Phase A 스프린트 착수 승인**: 엔진 버그 3건 + 구조적 결함 수정에 약 2주 소요
3. **항별 분리 집계 설계 리뷰**: Phase B의 핵심 선행 조건으로, 아키텍처 검토 및 코드 리뷰 인원 확보 필요

### 8.3 다음 단계

| 단계 | 담당 | 기한 | 산출물 |
|------|------|------|--------|
| Phase A 착수 | TS 개발팀 | +2주 | seed.sql 수정, ENGINE_BUG 3건 수정, 수가 조회 개선 |
| Phase B 설계 리뷰 | 아키텍트 + PM | +1주 | 항별 분리 집계 설계 문서, CalcOptions/Result 확장 계획 |
| Phase B 구현 | TS 개발팀 | +8주 | 법정 전자청구 가능 구조 완성 |
| 회귀 테스트 강화 | QA팀 | Phase B 완료 후 | C# 43개 시나리오 TS 대응 커버, Jest/Vitest 도입 |
| Phase C 착수 | TS 개발팀 | +20주 | 전 보험유형 완성, C# 1,505건 전수 테스트 수준 달성 |

---

## 부록 A. 파일 위치 참조

| 파일 | 역할 | 라인 수 |
|------|------|--------|
| `src/lib/calc-engine/index.ts` | 파이프라인 진입점 | 211 |
| `src/lib/calc-engine/drug-amount.ts` | 약품금액 계산 | 46 |
| `src/lib/calc-engine/dispensing-fee.ts` | 조제료 계산 | 360 |
| `src/lib/calc-engine/surcharge.ts` | 가산 판정 | 289 |
| `src/lib/calc-engine/copayment.ts` | 본인부담금 계산 | 238 |
| `src/lib/calc-engine/rounding.ts` | 반올림/절사 함수 | 52 |
| `src/lib/calc-engine/types.ts` | 데이터 계약 | 285 |
| `src/lib/calc-engine/supabase-repo.ts` | DB 레포지토리 | 93 |
| `src/lib/calc-engine/modules/insurance/veteran.ts` | 보훈 계산 | 425 |
| `src/lib/calc-engine/modules/insurance/medical-aid.ts` | 의료급여 계산 | — |
| `src/lib/calc-engine/modules/special/drug-648.ts` | 648약품 특수처리 | 232 |
| `src/lib/calc-engine/modules/special/safety-net.ts` | 본인부담상한제 | 229 |
| `src/lib/calc-engine/modules/special/seasonal.ts` | 명절가산 | — |
| `seed.sql` | 수가 마스터 초기 데이터 | — |
| `scripts/run-scenarios.ts` | 통합 시나리오 실행 | — |

## 부록 B. 확인된 정확 구현 항목

다음 항목은 Phase 8 감사에서 C# 원본과의 100% 일치가 확인되었다:

- `InsuPayType` Enum 7개 값 매핑 완전 일치 (`types.ts:L9-16`)
- `TakeType` Enum 3개 값 매핑 완전 일치 (`types.ts:L19-22`)
- `trunc10()` / `trunc100()` 함수 C#과 동일 (`rounding.ts`)
- 유팜 `MathHelper` 명칭버그(Ceil→Round 혼용) 회피 성공
- 보훈병원 6곳 코드 집합 C#과 동일 (`veteran.ts:BOHUN_HOSPITAL_CODES`)
- `getBohunRate()` 감면율 결정 로직 C#과 동일 (`veteran.ts:L128-146`)
- `MpvaPrice` 역산 공식 C# 원본과 100% 일치
- `holidayGb` 7값 체계 완전 구현 (`surcharge.ts:determineSurcharge()`)
- 648903860 5일 제한 처리 정확 (`drug-648.ts:apply648DayLimit()`)
- 3자배분 항등식 (`totalPrice = userPrice + pubPrice`) 19/19 시나리오 유지
- `M20 이중감면 날짜조건 (2018.01.01)` 구현 확인 (`veteran.ts`)

---

**본 보고서는 Phase 1 산출물 5종(`00_master_plan.md`, `01_directory_inventory.md`, `02_csharp_mapping.md`, `03_4source_framework.md`, `04_analysis_template.md`) 및 Phase 2 챕터 분석 24종 (ch01~ch12 analyst/verifier)을 직접 원본에서 읽어 종합하였으며, 부담당 3명의 취합 파일에 의존하지 않았다.**

*Phase 3 PM | PharmaEdu Phase 8 Audit | 2026-04-07*

---

**[약제비 분析용]**
