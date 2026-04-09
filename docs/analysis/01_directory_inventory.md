# 01. calc-engine 디렉토리 인벤토리

> **Phase 8 Calculation Logic Audit — Manager 1 출력물**
> 생성일: 2026-04-06
> 대상 경로: `src/lib/calc-engine/`
> 분석 범위: 소스 파일 전체 + `src/app/api/calculate/route.ts`

---

## 1. 파일 트리 (전체 목록)

```
src/lib/calc-engine/
├── types.ts                                  (284줄)
├── rounding.ts                                (51줄)
├── drug-amount.ts                             (45줄)
├── dispensing-fee.ts                         (359줄)
├── copayment.ts                              (237줄)
├── surcharge.ts                              (288줄)
├── index.ts                                  (210줄)
├── supabase-repo.ts                           (92줄)
│
├── modules/
│   ├── README.md
│   ├── insurance/
│   │   ├── veteran.ts                        (425줄)
│   │   ├── medical-aid.ts                    (305줄)
│   │   ├── auto-insurance.ts                  (99줄)
│   │   └── workers-comp.ts                    (91줄)
│   ├── modes/
│   │   ├── counseling.ts                     (322줄)
│   │   └── direct-dispensing.ts              (510줄)
│   ├── special/
│   │   ├── drug-648.ts                       (231줄)
│   │   ├── exemption.ts                      (272줄)
│   │   └── safety-net.ts                     (229줄)
│   └── surcharges/
│       ├── powder.ts                         (226줄)
│       ├── saturday-split.ts                 (307줄)
│       └── seasonal.ts                       (250줄)
│
└── __tests__/
    ├── rounding.test.ts                       (92줄)
    ├── s01-verify.ts                         (133줄)
    ├── modules-veteran.test.ts               (348줄)
    ├── modules-medical-aid.test.ts           (198줄)
    ├── modules-auto.test.ts                  (153줄)
    ├── modules-workers-comp.test.ts          (115줄)
    ├── modules-powder.test.ts                (122줄)
    ├── modules-seasonal.test.ts              (146줄)
    ├── modules-saturday.test.ts              (132줄)
    ├── modules-drug648.test.ts               (193줄)
    ├── modules-exemption.test.ts             (154줄)
    └── modules-safety-net.test.ts            (158줄)
```

**소스 파일 합계: 34개 (MD 1개 제외)**
**소스 총 라인: 코어 8파일(1,566줄) + modules 12파일(3,267줄) + tests 12파일(1,944줄) = 6,777줄**

---

## 2. 파일별 상세 정보

### 2-1. 코어 파일

| 파일 | 줄수 | 목적 | 주요 exports |
|------|------|------|-------------|
| `types.ts` | 284 | 전체 타입 정의 — CalcOptions, CalcResult, DrugItem 등 C# 포팅 | `InsuPayType`, `TakeType`, `DrugItem`, `MediIllnessInfo`, `CalcOptions`, `InsuRate`, `WageListItem`, `CalcResult`, `CalcStep`, `ICalcRepository` |
| `rounding.ts` | 51 | 약제비 반올림/절사 유틸리티 (R01~R17 규칙) | `round1`, `trunc10`, `trunc100`, `round10`, `roundToInt` |
| `drug-amount.ts` | 45 | 약품금액 계산 — 소모량 × 단가 + 4사5입 | `calcDrugAmount`, `calcDrugAmountSum` |
| `dispensing-fee.ts` | 359 | 조제료 전체 파이프라인 — 직접조제 분기, Z코드 선택, 산제/토요/명절/복약상담 호출 | `calcDispensingFee` |
| `copayment.ts` | 237 | 본인부담금 계산 — 보험유형별 모듈 위임 허브 | `calcCopayment`, `CopayResult`, `CopayStep` |
| `surcharge.ts` | 288 | 가산 우선순위 판정 — holidayGb 코드 결정 | `determineSurcharge`, `getSurchargeSuffix`, `getSaturdayAddCodes`, `SurchargeInput`, `SurchargeFlags` |
| `index.ts` | 210 | 공개 API 진입점 — 6단계 계산 파이프라인 | `calculate`, (재export) `CalcOptions`, `CalcResult`, `DrugItem`, `InsuRate`, `WageListItem`, `CalcStep`, `ICalcRepository`, `MediIllnessInfo`, `SupabaseCalcRepository`, `determineSurcharge`, `SurchargeFlags`, `SurchargeInput` |
| `supabase-repo.ts` | 92 | ICalcRepository의 Supabase 구현체 | `SupabaseCalcRepository` |

### 2-2. insurance 모듈

| 파일 | 줄수 | 목적 | 주요 exports |
|------|------|------|-------------|
| `modules/insurance/veteran.ts` | 425 | 보훈(G/M코드) 본인부담금 + 3자배분 | `BohunCode`, `BohunCodeType`, `VeteranCalcContext`, `VeteranCalcResult`, `VeteranCalcStep`, `getBohunRate`, `getDoubleReductionRate`, `isBohunHospital`, `calcVeteran` |
| `modules/insurance/medical-aid.ts` | 305 | 의료급여(D계열) 본인부담금 — D10/D20/D40/D80/D90/B014/B030/V103 | `SbrdnType`, `calcMedicalAid`, `resolveMedicalAidFixAmount`, `applySbrdnTypeModifier` |
| `modules/insurance/auto-insurance.ts` | 99 | 자동차보험(F10) — 전액 자부담 + 할증 | `calcAutoInsurance` |
| `modules/insurance/workers-comp.ts` | 91 | 산재(E10/E20) — 환자 부담 0원 | `calcWorkersComp` |

### 2-3. surcharges 모듈

| 파일 | 줄수 | 목적 | 주요 exports |
|------|------|------|-------------|
| `modules/surcharges/powder.ts` | 226 | 산제(가루약) 가산 — Z4010/Z41xx100 체계 2023.11.01 분기 | `PowderCalcContext`, `PowderCalcResult`, `hasPowderDrug`, `shouldExcludeOtherSurcharges`, `calcPowderSurchargeFromCtx`, `calcPowderSurcharge` |
| `modules/surcharges/saturday-split.ts` | 307 | 토요 가산 별도행 분리 — Z2000030/Z3000030/Z41xx030 (2016.09.29 이후) | `SaturdaySplitContext`, `SaturdaySplitResult`, `isAfterSaturdaySplitDate`, `createSaturdaySplitRow`, `applySaturdaySurchargeRows`, `calcSaturdaySplit` |
| `modules/surcharges/seasonal.ts` | 250 | 명절 가산 — ZE100/ZE010/ZE020/ZE101/ZE102 (하드코딩 날짜 테이블) | `SeasonalCalcContext`, `SeasonalCalcResult`, `detectSeasonalHoliday`, `calcSeasonalSurcharge`, `calcSeasonalSurchargeCtx` |

### 2-4. modes 모듈

| 파일 | 줄수 | 목적 | 주요 exports |
|------|------|------|-------------|
| `modules/modes/direct-dispensing.ts` | 510 | 직접조제(의약분업 예외) — Z4200/Z4201/Z4220/Z4221 × 투약일수 | `DirectDispensingContext`, `DirectDispensingResult`, `isDirectDispensingMode`, `calcDirectDosageFee`, `calcDirectDispensing` (오버로드 2개) |
| `modules/modes/counseling.ts` | 322 | 복약상담(Z7001 달빛어린이) + 비대면(ZC001~ZC004) | `FeeBaseParams`, `CounselingCalcContext`, `CounselingCalcResult`, `calcCounselingFee`, `calcMoonChildBonus`, `getNonFaceDispensingCode`, `isNonFaceMode`, `calcCounseling` |

### 2-5. special 모듈

| 파일 | 줄수 | 목적 | 주요 exports |
|------|------|------|-------------|
| `modules/special/drug-648.ts` | 231 | 특수약품 648903860 — 5일 상한 + 2024.10.25 이후 5% 가산 | `SPECIAL_DRUG_648`, `Drug648CalcContext`, `Drug648CalcResult`, `has648Drug`, `apply648DayLimit`, `sum648DrugAmount`, `calc648Surcharge`, `process648Special`, `calcDrug648Surcharge` |
| `modules/special/exemption.ts` | 272 | 산정특례 요율 결정 — V252/V352/V452 등급별, V0xx 5%, V1xx 10% | `isV252Series`, `determineExemptionRate`, `determineV252RateByGrade`, `inferExemptionRate` |
| `modules/special/safety-net.ts` | 229 | 본인부담상한제 — 소득분위별 연간 상한액(2024 기준) 초과분 공단 전환 | `ANNUAL_CAP_BY_DECILE`, `SafetyNetCalcContext`, `SafetyNetCalcResult`, `CalcResultWithSafetyNet`, `calcSafetyNetOverage`, `applySafetyNet`, `calcSafetyNet` |

### 2-6. 테스트 파일

| 파일 | 줄수 | 테스트 대상 | 테스트 방식 |
|------|------|------------|-----------|
| `__tests__/rounding.test.ts` | 92 | rounding.ts 전체 5개 함수 | 직접 실행 스크립트 (jest 아님) |
| `__tests__/s01-verify.ts` | 133 | index.ts `calculate()` 엔드투엔드 (S01 시나리오: C10/40세/내복7일) | Mock 리포지토리 사용 |
| `__tests__/modules-veteran.test.ts` | 348 | veteran.ts — `getBohunRate`, `calcVeteran` | 직접 실행 스크립트 |
| `__tests__/modules-medical-aid.test.ts` | 198 | medical-aid.ts — `calcMedicalAid`, `resolveMedicalAidFixAmount`, `applySbrdnTypeModifier` | 직접 실행 스크립트 |
| `__tests__/modules-auto.test.ts` | 153 | auto-insurance.ts — `calcAutoInsurance` | 직접 실행 스크립트 |
| `__tests__/modules-workers-comp.test.ts` | 115 | workers-comp.ts — `calcWorkersComp` | 직접 실행 스크립트 |
| `__tests__/modules-powder.test.ts` | 122 | powder.ts — `hasPowderDrug`, `calcPowderSurcharge`, `shouldExcludeOtherSurcharges` | 직접 실행 스크립트 |
| `__tests__/modules-seasonal.test.ts` | 146 | seasonal.ts — `detectSeasonalHoliday`, `calcSeasonalSurcharge` | 직접 실행 스크립트 |
| `__tests__/modules-saturday.test.ts` | 132 | saturday-split.ts — `isAfterSaturdaySplitDate`, `createSaturdaySplitRow`, `applySaturdaySurchargeRows` | 직접 실행 스크립트 |
| `__tests__/modules-drug648.test.ts` | 193 | drug-648.ts — `apply648DayLimit`, `calc648Surcharge`, `has648Drug`, `sum648DrugAmount`, `calcDrug648Surcharge` | 직접 실행 스크립트 |
| `__tests__/modules-exemption.test.ts` | 154 | exemption.ts — `isV252Series`, `determineExemptionRate`, `inferExemptionRate`, `determineV252RateByGrade` | 직접 실행 스크립트 |
| `__tests__/modules-safety-net.test.ts` | 158 | safety-net.ts — `calcSafetyNetOverage`, `calcSafetyNet`, `ANNUAL_CAP_BY_DECILE` | 직접 실행 스크립트 |

---

## 3. 모듈 카테고리별 분류

### 카테고리 A — 핵심 타입
- `types.ts`

### 카테고리 B — 반올림 유틸리티
- `rounding.ts`

### 카테고리 C — 약품금액 계산
- `drug-amount.ts`

### 카테고리 D — 조제료 계산
- `dispensing-fee.ts` (파이프라인 허브)

### 카테고리 E — 본인부담금 계산
- `copayment.ts` (라우팅 허브)

### 카테고리 F — 가산 판정
- `surcharge.ts`

### 카테고리 G — 보험 유형별 모듈
- `modules/insurance/veteran.ts`
- `modules/insurance/medical-aid.ts`
- `modules/insurance/auto-insurance.ts`
- `modules/insurance/workers-comp.ts`

### 카테고리 H — 가산 모듈
- `modules/surcharges/powder.ts`
- `modules/surcharges/saturday-split.ts`
- `modules/surcharges/seasonal.ts`

### 카테고리 I — 조제 모드 모듈
- `modules/modes/direct-dispensing.ts`
- `modules/modes/counseling.ts`

### 카테고리 J — 특수 모듈
- `modules/special/drug-648.ts`
- `modules/special/safety-net.ts`
- `modules/special/exemption.ts`

### 카테고리 K — 리포지토리
- `supabase-repo.ts` (Supabase 구현체)
- `__tests__/s01-verify.ts` 내 `MockCalcRepository` (Mock, 테스트 전용)

### 카테고리 L — 공개 API + 파이프라인 통합
- `index.ts`

### 카테고리 M — 테스트
- `__tests__/rounding.test.ts`
- `__tests__/s01-verify.ts`
- `__tests__/modules-*.test.ts` (10개)

---

## 4. 커버리지 매트릭스

| 모듈 파일 | 구현 여부 | 단위 테스트 | 메인 파이프라인 사용 | 계산기 UI 사용 |
|-----------|----------|------------|-------------------|-------------|
| `types.ts` | Y | — | Y (전체) | Y (타입만) |
| `rounding.ts` | Y | Y (`rounding.test.ts`) | Y | N (직접 사용 없음) |
| `drug-amount.ts` | Y | N (S01 통합 검증만) | Y (`index.ts`) | N |
| `dispensing-fee.ts` | Y | N (S01 통합 검증만) | Y (`index.ts`) | N |
| `copayment.ts` | Y | N (S01 통합 검증만) | Y (`index.ts`) | N |
| `surcharge.ts` | Y | N | Y (`dispensing-fee.ts`에서 호출) | N |
| `index.ts` | Y | Y (`s01-verify.ts`) | — (진입점) | Y (API를 통해) |
| `supabase-repo.ts` | Y | N | Y (`route.ts`에서) | Y (API 경유) |
| `insurance/veteran.ts` | Y | Y (`modules-veteran.test.ts`) | Y (`copayment.ts`에서) | N |
| `insurance/medical-aid.ts` | Y | Y (`modules-medical-aid.test.ts`) | Y (`copayment.ts`에서) | N |
| `insurance/auto-insurance.ts` | Y | Y (`modules-auto.test.ts`) | Y (`copayment.ts`에서) | N |
| `insurance/workers-comp.ts` | Y | Y (`modules-workers-comp.test.ts`) | Y (`copayment.ts`에서) | N |
| `surcharges/powder.ts` | Y | Y (`modules-powder.test.ts`) | Y (`dispensing-fee.ts`에서) | N |
| `surcharges/saturday-split.ts` | Y | Y (`modules-saturday.test.ts`) | Y (`dispensing-fee.ts`에서) | N |
| `surcharges/seasonal.ts` | Y | Y (`modules-seasonal.test.ts`) | Y (`dispensing-fee.ts`에서) | N |
| `modes/direct-dispensing.ts` | Y | N (전용 테스트 없음) | Y (`dispensing-fee.ts`에서) | N |
| `modes/counseling.ts` | Y | N (전용 테스트 없음) | Y (`dispensing-fee.ts`에서) | N |
| `special/drug-648.ts` | Y | Y (`modules-drug648.test.ts`) | Y (`index.ts`에서) | N |
| `special/exemption.ts` | Y | Y (`modules-exemption.test.ts`) | Y (`copayment.ts`에서) | N |
| `special/safety-net.ts` | Y | Y (`modules-safety-net.test.ts`) | Y (`index.ts`에서) | N |

**비고:**
- 계산기 UI (`src/app/calculator/page.tsx`)는 `CalcResult`, `DrugItem` 타입을 사용하고 API(`/api/calculate`)를 호출함 — 모듈을 직접 임포트하지 않음
- `direct-dispensing.ts`, `counseling.ts`는 단독 테스트 파일이 없음 (테스트 커버리지 공백)
- `drug-amount.ts`, `dispensing-fee.ts`, `copayment.ts`, `surcharge.ts`는 S01 시나리오 통합 검증(`s01-verify.ts`)으로 간접 검증됨

---

## 5. 함수 인벤토리 (모든 export 함수 서명 + 설명)

### 5-1. rounding.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `round1` | `(v: number): number` | 원미만 사사오입 (R01/R04~R11 규칙) |
| `trunc10` | `(v: number): number` | 10원 미만 절사 (R12~R17 규칙) |
| `trunc100` | `(v: number): number` | 100원 미만 절사 (건보 본인부담금 용) |
| `round10` | `(v: number): number` | 10원 미만 사사오입 (조제료 단가 계산용) |
| `roundToInt` | `(v: number): number` | EDB 호환 사사오입 `floor(v + 0.5)` |

### 5-2. drug-amount.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcDrugAmount` | `(drug: DrugItem): number` | 약품 1줄 금액 계산 — `floor(소모량×단가+0.5)` |
| `calcDrugAmountSum` | `(drugs: DrugItem[]): { sumInsu: number; sumUser: number }` | 급여/비급여 약품 금액 합계 분리 계산 |

### 5-3. dispensing-fee.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcDispensingFee` | `(opt: CalcOptions, repo: ICalcRepository): Promise<{ wageList: WageListItem[]; sumWage: number }>` | 조제료 전체 파이프라인 — 직접조제 분기 후 처방조제 Z코드 선택 + 가산 행 추가 |

### 5-4. copayment.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcCopayment` | `(sumInsuDrug: number, sumWage: number, opt: CalcOptions, rate: InsuRate, illness?: MediIllnessInfo): CopayResult` | 본인부담금 계산 허브 — 보험유형에 따라 G/D/F/E 모듈로 위임, C10은 직접 처리 |

### 5-5. surcharge.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `determineSurcharge` | `(input: SurchargeInput): SurchargeFlags` | 가산 우선순위 체인 — holidayGb 코드 및 각 가산 활성 여부 결정 |
| `getSurchargeSuffix` | `(holidayGb: string, codeType: 'Z2000' \| 'Z3000' \| 'Z41xx' \| 'Z4120' \| 'Z4121' \| 'other'): string` | holidayGb → Z코드 접미사 변환 (010/030/050/600/610/650) |
| `getSaturdayAddCodes` | `(hasInternal: boolean, hasExternal: boolean, internalDay: number): string[]` | 토요 가산 별도 행 코드 목록 반환 (Z2000030, Z3000030, Z41xx030, Z4120030) |

### 5-6. index.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calculate` | `(opt: CalcOptions, repo: ICalcRepository): Promise<CalcResult>` | 약제비 계산 메인 진입점 — 6단계 파이프라인 실행 |

### 5-7. supabase-repo.ts

| 클래스/메서드 | 서명 | 설명 |
|-------------|------|------|
| `SupabaseCalcRepository` | `class implements ICalcRepository` | Supabase 기반 리포지토리 구현체 |
| `.getSugaFeeMap` | `(year: number): Promise<Map<string, { price: number; name: string }>>` | suga_fee 테이블에서 연도별 전체 Z코드 단가 Map 로드 |
| `.getPrescDosageFee` | `(year: number, days: number): Promise<{ sugaCode: string; fee: number } \| null>` | presc_dosage_fee 테이블에서 투약일수 범위에 해당하는 Z코드 조회 |
| `.getInsuRate` | `(insuCode: string): Promise<InsuRate \| null>` | insu_rate 테이블에서 보험코드별 요율 마스터 조회 |

### 5-8. insurance/veteran.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `getBohunRate` | `(bohunCode: string, dosDate: string): number` | 보훈코드 → 감면율(%) 반환 (M10~M90, 날짜 분기 포함) |
| `getDoubleReductionRate` | `(bohunCode: string, dosDate: string): number` | M20/M61 이중감면율 반환 (10 또는 20) |
| `isBohunHospital` | `(hospCode: string): boolean` | 요양기관기호가 보훈병원 6곳 중 하나인지 판정 |
| `calcVeteran` | `(options: CalcOptions, result: CalcResult, rate: InsuRate): CalcResult` | 보훈 본인부담금 + MpvaPrice/InsuPrice 3자배분 계산 |

### 5-9. insurance/medical-aid.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcMedicalAid` | `(options: CalcOptions, result: CalcResult, rate: InsuRate, illness?: MediIllnessInfo): CalcResult` | 의료급여 본인부담금 계산 — D10/D20/D40/D80/D90/B014/B030/V103 8가지 처리 우선순위 |
| `resolveMedicalAidFixAmount` | `(insuCode: string, rate: InsuRate, options: CalcOptions): number` | 보험코드·sbrdnType에 따른 의료급여 정액 기준값 결정 (mcode/bcode/fixCost) |
| `applySbrdnTypeModifier` | `(baseUserPrice: number, sbrdnType: string, totalPrice: number, dosDate: string): number` | sbrdnType(B014/B030/V103)에 따른 본인부담 조정 |

### 5-10. insurance/auto-insurance.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcAutoInsurance` | `(options: CalcOptions, result: CalcResult, rate: InsuRate): CalcResult` | 자동차보험(F10) — 전액 자부담 trunc10 + 할증(premium) 계산 |

### 5-11. insurance/workers-comp.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcWorkersComp` | `(options: CalcOptions, result: CalcResult, rate: InsuRate): CalcResult` | 산재(E10/E20) — userPrice=0, pubPrice=totalPrice 설정 |

### 5-12. surcharges/powder.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `hasPowderDrug` | `(drugList: DrugItem[]): boolean` | DrugItem.isPowder==='1' 약품 존재 여부 판정 |
| `shouldExcludeOtherSurcharges` | `(drugList: DrugItem[]): boolean` | 산제 가산 활성 시 다른 가산 배제 여부 (현재 hasPowderDrug와 동일) |
| `calcPowderSurchargeFromCtx` | `(ctx: PowderCalcContext): Promise<PowderCalcResult>` | 산제 가산 계산 (2023.11.01 전후 분기) — repo를 통해 단가 조회 |
| `calcPowderSurcharge` | `(drugList: DrugItem[], dosDate: string): WageListItem \| null` | 산제 가산 단순 인터페이스 — 단가 없이 구조만 반환 (price=0) |

### 5-13. surcharges/saturday-split.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `isAfterSaturdaySplitDate` | `(dosDate: string): boolean` | 2016.09.29 이후 여부 (별도 행 분리 방식 기준일) |
| `createSaturdaySplitRow` | `(baseCode: string, basePrice: number, dosDate: string): WageListItem \| null` | 토요 가산 별도 행 1건 생성 (baseCode + '030') |
| `applySaturdaySurchargeRows` | `(wageList: WageListItem[], dosDate: string, isSaturday: boolean): WageListItem[]` | 기존 wageList에 토요 가산 030 행 삽입 |
| `calcSaturdaySplit` | `(ctx: SaturdaySplitContext): Promise<SaturdaySplitResult>` | 토요 가산 별도행 계산 (repo 직접 조회, 16일+ 포함) |

### 5-14. surcharges/seasonal.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `detectSeasonalHoliday` | `(dosDate: string): { code: string; amount: number; isActualDay: boolean } \| null` | 조제일자가 명절 연휴에 해당하는지 판정 |
| `calcSeasonalSurcharge` | `(dosDate: string, insuCode: string, isNonFace: boolean): WageListItem \| null` | 명절가산 WageListItem 생성 (C/D 계열만, 비대면 제외) |
| `calcSeasonalSurchargeCtx` | `(ctx: SeasonalCalcContext): Promise<SeasonalCalcResult>` | 명절가산 계산 async 래퍼 (통합 레이어 호환용) |

### 5-15. modes/direct-dispensing.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `isDirectDispensingMode` | `(options: CalcOptions): boolean` | 직접조제 여부 판정 (isDirectDispensing 필드 또는 insuCode=C21) |
| `calcDirectDosageFee` | `(drugList: DrugItem[], dosDate: string, repo: ICalcRepository, sc: SurchargeFlags): Promise<WageListItem[]>` | Z4200/Z4201/Z4220/Z4221 직접조제 약품조제료 계산 |
| `calcDirectDispensing` | 오버로드 2개: `(ctx: DirectDispensingContext): Promise<DirectDispensingResult>` / `(options, drugList, feeParams, repo): Promise<WageListItem[]>` | 직접조제 전체 조제료 계산 (Z1000/Z2000/Z3000/Z4200계열/Z5xxx 포함) |

### 5-16. modes/counseling.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `calcCounselingFee` | `(options: CalcOptions, feeParams: FeeBaseParams): WageListItem \| null` | Z7001 야간조제관리료 산정 (달빛어린이약국 + hasCounseling=true) |
| `calcMoonChildBonus` | `(options: CalcOptions, age: number): WageListItem \| null` | 달빛어린이 추가 가산 (age<6 + 야간/공휴, price=0 경고) |
| `getNonFaceDispensingCode` | `(options: CalcOptions, _dosDate: string): string \| null` | 비대면 조제 ZC 코드 결정 (ZC001~ZC004, 우선순위: 공휴>심야>야간>기본) |
| `isNonFaceMode` | `(options: CalcOptions): boolean` | 비대면 조제 여부 판정 (isNonFace=true) |
| `calcCounseling` | `(ctx: CounselingCalcContext): Promise<CounselingCalcResult>` | 복약상담/비대면 조제 수가 통합 계산 |

### 5-17. special/drug-648.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `has648Drug` | `(drugList: DrugItem[]): boolean` | 648903860 약품 포함 여부 판정 |
| `apply648DayLimit` | `(drugList: DrugItem[]): DrugItem[]` | 648903860 약품의 dDay를 5일로 제한 (원본 불변) |
| `sum648DrugAmount` | `(drugList: DrugItem[]): number` | 648903860 약품 급여금액 합산 |
| `calc648Surcharge` | `(sum648: number, dosDate: string): number` | 2024.10.25 이후 5% 가산액 계산 |
| `process648Special` | `(drugList: DrugItem[], dosDate: string): { modifiedDrugList, sum648, surcharge648 }` | 648903860 전처리 메인 — 5일 상한 + 금액 합산 + 5% 가산 계산 |
| `calcDrug648Surcharge` | `(ctx: Drug648CalcContext): Drug648CalcResult` | 648903860 5% 가산 계산 (보훈 M10/M83/M82 면제 포함) |

### 5-18. special/exemption.ts

| 함수 | 서명 | 설명 |
|------|------|------|
| `isV252Series` | `(mediIllness: string): boolean` | V252/V352/V452 계열 판정 |
| `determineExemptionRate` | `(mediIllness: string, rate: InsuRate, baseRate: number): number` | 산정특례 요율 결정 — 0~100 반환, -1이면 미적용 |
| `determineV252RateByGrade` | `(mediIllness: string, grade: string, rate: InsuRate & { v2520?: number; v2521?: number }): number` | V252 계열 등급(SeSickNoType)별 요율 결정 |
| `inferExemptionRate` | `(mediIllness: string): number \| null` | DB 없이 코드만으로 요율 추론 (null = DB 조회 필요) |

### 5-19. special/safety-net.ts

| 함수/상수 | 서명 | 설명 |
|----------|------|------|
| `ANNUAL_CAP_BY_DECILE` | `Record<number, number>` | 소득분위별 연간 본인부담 상한액 상수 (2024 기준, 87만~598만원) |
| `calcSafetyNetOverage` | `(currentUserPrice: number, yearlyAccumulated: number, decile: number): number` | 본인부담상한제 초과금 계산 |
| `applySafetyNet` | `(options: CalcOptions, result: CalcResult, yearlyAccumulated: number, decile: number): CalcResultWithSafetyNet` | 상한제 적용 후 CalcResult 반환 (userPrice 차감, pubPrice/insuPrice 증가) |
| `calcSafetyNet` | `(ctx: SafetyNetCalcContext): SafetyNetCalcResult` | 상한제 처리 (컨텍스트 객체 방식, 내부 호환용) |

---

## 6. 의존성 분석

### 6-1. 모듈 간 import 그래프

```
index.ts
  ├─ types.ts
  ├─ drug-amount.ts
  ├─ dispensing-fee.ts
  │    ├─ types.ts
  │    ├─ surcharge.ts
  │    ├─ modules/modes/direct-dispensing.ts
  │    │    ├─ types.ts
  │    │    ├─ surcharge.ts
  │    │    └─ @/../types/database  ← 외부 프로젝트 타입
  │    ├─ modules/surcharges/powder.ts
  │    │    └─ types.ts
  │    ├─ modules/surcharges/saturday-split.ts
  │    │    └─ types.ts
  │    ├─ modules/surcharges/seasonal.ts
  │    │    └─ types.ts
  │    └─ modules/modes/counseling.ts
  │         └─ types.ts
  ├─ copayment.ts
  │    ├─ types.ts
  │    ├─ rounding.ts
  │    ├─ modules/insurance/veteran.ts
  │    │    ├─ types.ts
  │    │    └─ rounding.ts
  │    ├─ modules/insurance/medical-aid.ts
  │    │    ├─ types.ts
  │    │    └─ rounding.ts
  │    ├─ modules/insurance/auto-insurance.ts
  │    │    ├─ types.ts
  │    │    └─ rounding.ts
  │    ├─ modules/insurance/workers-comp.ts
  │    │    └─ types.ts
  │    └─ modules/special/exemption.ts
  │         └─ types.ts
  ├─ modules/special/drug-648.ts
  │    ├─ types.ts
  │    └─ rounding.ts
  └─ modules/special/safety-net.ts
       └─ types.ts
```

**규칙 준수 현황:**
- modules 간 직접 import: 없음 (README 계약 준수)
- modules → rounding.ts: veteran.ts, medical-aid.ts, auto-insurance.ts, drug-648.ts만 사용
- modules → types.ts: 전체 사용 (계약 준수)

**예외 사항:**
- `direct-dispensing.ts`가 `@/../types/database`의 `FeeBaseParams`를 import하고 있음 — 내부 calc-engine 타입이 아닌 외부 의존성

### 6-2. 외부 의존성

| 의존성 | 사용 위치 | 용도 |
|--------|----------|------|
| `@supabase/supabase-js` (간접) | `supabase-repo.ts` → `@/lib/supabase-server` | DB 클라이언트 |
| `@/lib/supabase-server` | `supabase-repo.ts` | 서버 Supabase 클라이언트 생성 |
| `next/server` | `route.ts` | NextRequest/NextResponse |
| `@/../types/database` | `direct-dispensing.ts` | `FeeBaseParams` 타입 (외부 프로젝트 타입) |

### 6-3. calc-engine을 import하는 외부 파일

| 파일 | import 내용 |
|------|------------|
| `src/app/api/calculate/route.ts` | `calculate`, `SupabaseCalcRepository`, `CalcOptions` |
| `src/app/api/quiz/generate/route.ts` | (미확인) |
| `src/app/calculator/page.tsx` | `CalcResult`, `DrugItem` (타입만) |
| `src/app/quiz/dynamic/page.tsx` | (미확인) |
| `src/components/calculator/scenarios.ts` | `DrugItem` (타입만) |
| `src/components/learning/InlineCalculator.tsx` | `CalcResult`, `DrugItem` (타입만) |
| `src/lib/calculator-history/types.ts` | `CalcOptions` (타입만) |
| `src/lib/quiz/dynamic-generator.ts` | `CalcOptions`, `CalcResult`, `ICalcRepository`, `calculate` |

---

## 7. API Route 요약 (`src/app/api/calculate/route.ts`)

```
POST /api/calculate
  body: CalcOptions (JSON)
  
  처리:
    1. body 유효성 검사 (insuCode, drugList 필수)
    2. dosDate 미입력 시 오늘 날짜 자동 설정
    3. SupabaseCalcRepository 생성
    4. calculate(body, repo) 호출
    5. CalcResult 반환
  
  반환:
    200 OK: CalcResult
    400 Bad Request: { error: string }
    500 Internal Server Error: { error: string }
```

---

## 8. 주요 관찰 사항 (팩트만 — 권고사항 제외)

1. **테스트 방식**: 모든 테스트가 Jest/Vitest 프레임워크 없이 직접 실행 스크립트 방식으로 작성됨 (`ts-node` 실행 전제)

2. **테스트 공백**: `direct-dispensing.ts`, `counseling.ts` 두 파일은 전용 단위 테스트 파일이 없음

3. **외부 의존**: `direct-dispensing.ts`가 `../../../../types/database`의 `FeeBaseParams`를 import — 이 경로가 프로젝트 내 어디를 가리키는지 주의 필요

4. **이중 인터페이스**: `direct-dispensing.ts`의 `calcDirectDispensing`이 오버로드 2개(`Context` 방식 / `CalcOptions` + `drugList` + `repo` 방식)를 지원하며, `FeeBaseParams` 파라미터(`_feeParams`)는 사실상 미사용(underscore prefix)

5. **counseling.ts의 price=0 이슈**: `calcMoonChildBonus` 함수가 price=0인 WageListItem을 반환하며, 호출처(`calcCounseling`)에서 sugaMap으로 재조회하여 채우는 2단계 패턴을 사용

6. **seasonal.ts 하드코딩**: 명절 날짜가 2024 추석/2025 설날/2025 추석까지만 하드코딩되어 있음

7. **safety-net.ts 연도 고정**: `ANNUAL_CAP_BY_DECILE`이 2024년 기준으로 하드코딩됨

8. **파이프라인 Step 번호**: `index.ts` 주석 기준 Step 0(648 전처리) ~ Step 6(상한제)으로 명시됨

9. **supabase-repo.ts의 미구현 메서드**: `ICalcRepository`에 선언된 `getHolidayType?`, `getMediIllnessInfo?` 옵션 메서드가 `SupabaseCalcRepository`에 구현되어 있지 않음

10. **copayment.ts의 M코드 우선 처리**: `bohunCode`가 M코드이면 `insuCode`(C10 등)가 건보여도 보훈 모듈을 먼저 호출하는 로직이 있음

---

*이 파일은 Phase 8 Calculation Logic Audit의 Manager 1이 생성한 디렉토리 인벤토리입니다. 소스 코드 수정 없이 분석만 수행하였습니다.*
