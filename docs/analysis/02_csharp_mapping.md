# 02. C# 소스 매핑 — YakjaebiCalc.Engine

> **작성**: Manager 2 — C# Source Mapping Specialist  
> **대상 경로**: `C:\Projects\DSNode\약제비 분析용\YakjaebiCalc\YakjaebiCalc.Engine\`  
> **목적**: 엔진 내 모든 `.cs` 파일의 역할·메서드·의존성을 완전 목록화. 수정 없음.

---

## 1. 파일 트리 (obj/bin 제외, 총 35개)

| 경로 | 라인 수 | 목적 | 핵심 클래스 / 주요 타입 |
|------|---------|------|------------------------|
| **Engine/** | | | |
| `Engine/CopaymentCalculator.cs` | 1,173 | 본인부담금 계산 + 3자배분 메인 엔진 | `CopaymentCalculator` (partial) |
| `Engine/CopaymentCalculator.Logging.cs` | 56 | 구조화 로깅 partial 확장 | `CopaymentCalculator` (partial) |
| `Engine/DispensingFeeCalculator.cs` | 2,059 | 조제료(Z코드) 9단계 산정 메인 엔진 | `DispensingFeeCalculator` (partial) |
| `Engine/DispensingFeeCalculator.Logging.cs` | 67 | 구조화 로깅 partial 확장 | `DispensingFeeCalculator` (partial) |
| **Models/** | | | |
| `Models/CalcOptions.cs` | 237 | 계산 입력 파라미터 (55개 필드) | `CalcOptions` |
| `Models/CalcResult.cs` | 245 | 계산 출력 결과 (51개 필드) | `CalcResult` |
| `Models/DrugItem.cs` | 154 | 처방 약품 1건 (자동 합계 재계산) | `DrugItem : INotifyPropertyChanged` |
| `Models/InsuRateInfo.cs` | 68 | 보험료율 마스터 (보험코드별 요율) | `InsuRateInfo` |
| `Models/MediIllnessInfo.cs` | 24 | 산정특례 정보 (V252 등) | `MediIllnessInfo` |
| `Models/WageItem.cs` | 17 | 수가 마스터 1건 (Z코드+단가+명칭) | `WageItem` |
| `Models/WageListItem.cs` | 41 | 수가 산출 결과 1건 (readonly record) | `WageListItem` |
| **Enums/** | | | |
| `Enums/BohunCode.cs` | 40 | 보훈 코드 10종 상수 (M10~M90) | `BohunCode` (static class) |
| `Enums/GsCode.cs` | 77 | 공상등구분 코드 (HIRA EDI 필드) | `GsCode` (static class) |
| `Enums/InsuPayType.cs` | 29 | 약품 보험급여구분 7종 | `InsuPayType` (enum) |
| `Enums/InsuranceType.cs` | 23 | 보험 대분류 5종 문자상수 | `InsuranceType` (static class) |
| `Enums/NPayRoundType.cs` | 26 | 비급여 반올림 유형 6종 | `NPayRoundType` (enum) |
| `Enums/SurchargeType.cs` | 32 | 가산 종류 7종 | `SurchargeType` (enum) |
| `Enums/TakeType.cs` | 17 | 약품 복용구분 3종 | `TakeType` (enum) |
| **Constants/** | | | |
| `Constants/DateThresholds.cs` | 144 | 날짜 임계값 상수 (제도 변경 시점 30+건) | `DateThresholds` (static class) |
| `Constants/HospitalCodes.cs` | 46 | 보훈병원 코드 6건 + 등급 보정 코드 | `HospitalCodes` (static class) |
| `Constants/InsuranceCodes.cs` | 155 | 보험코드 상수 (접두사·세부코드) | `InsuranceCodes` (static class) |
| `Constants/SpecialDrugCodes.cs` | 44 | 특수 약품코드 (648903860 등) | `SpecialDrugCodes` (static class) |
| `Constants/SugaCodes.cs` | 180 | Z코드 상수 전체 목록 | `SugaCodes` (static class) |
| **Tables/** | | | |
| `Tables/CopayRateTable.cs` | 1,238 | 본인부담금 산출 테이블+함수 (레거시 호환 포함) | `CopayRateTable`, `CopayResult`, `SelectiveBenefits`, `SelectiveBenefitAmounts` |
| `Tables/FeeBaseParams.cs` | 284 | 조제료 수가 기본 파라미터 record (U0M120) | `FeeBaseParams` (record) |
| `Tables/HolidayTable.cs` | 180 | 공휴일 마스터 (2024~2026 하드코딩) | `HolidayTable` (static class) |
| `Tables/InsuranceRuleTable.cs` | 868 | 보험 유형 정의 + 본인부담금 규칙 테이블 | `InsuranceRuleTable`, `InsuranceTag`, `MedicalAidType`, `AmtRateTag`, `VeteranDiscountRate`, `HospitalGrade`, `RoundingUtil` |
| `Tables/PrescDosageFeeTable.cs` | 206 | 투약일수별 처방조제료 고정금액 (2024/2026) | `PrescDosageFeeTable` (static class) |
| `Tables/SugaFeeTable.cs` | 667 | Z코드 수가 테이블 (2024: 282건, 2026: 282건) | `SugaFeeTable` (static class), `SugaFeeEntry` (record) |
| **Data/** | | | |
| `Data/ICalcRepository.cs` | 109 | DB 접근 인터페이스 9개 메서드 | `ICalcRepository` (interface) |
| `Data/MediWageData.cs` | 167 | 수가 마스터 딕셔너리 (탭구분 문자열 파싱) | `MediWageData` |
| `Data/MockCalcRepository.cs` | 464 | 인메모리 Mock 리포지토리 (단위 테스트용) | `MockCalcRepository : ICalcRepository` |
| `Data/SqlCalcRepository.cs` | 674 | SQL Server 구현 리포지토리 | `SqlCalcRepository : ICalcRepository` |
| **Utilities/** | | | |
| `Utilities/RoundingHelper.cs` | 144 | 반올림/절사 유틸리티 7종 함수 | `RoundingHelper` (static class) |
| **Exceptions/** | | | |
| `Exceptions/YakjaebiCalcException.cs` | 33 | 엔진 예외 계층 (기본+3파생) | `YakjaebiCalcException`, `WageDataNotFoundException`, `InsuranceRateNotFoundException`, `InvalidCalcOptionsException` |

**전체 소스 라인 수: 약 7,342 라인**

---

## 2. 계산 로직 파일 (Engine/) 상세

### 2-1. `Engine/CopaymentCalculator.cs` (1,173줄)

**무엇을 계산하는가**: CH05/CH06/CH07 기반의 본인부담금 산출 및 3자배분.  
처리 순서: ①총약제비(PbSum) 산출 → ②보험요율 4단계 결정 → ③보훈감면율 결정 → ④보험유형별 본인부담금(C/D/G/F/E) → ⑤3자배분(UserPrice/InsuPrice/MpvaPrice) → ⑥SumUser/SumInsure 확정.

| 메서드 시그니처 | 설명 |
|----------------|------|
| `void Calculate(CalcOptions opt, CalcResult result, InsuRateInfo rate, MediIllnessInfo? illness)` | **메인 진입점**. PbSum → 요율 → 보훈 → 유형분기 → 3자배분 → SumUser 순서로 완전 처리 |
| `decimal DetermineInsuRate(CalcOptions opt, InsuRateInfo rate, MediIllnessInfo? illness)` | 본인부담률 4단계 결정: 기본→질병코드→V252등급→6세미만 |
| `decimal CalcCopay_C(...)` | 건강보험(C) 본인부담금. C21=0, C31=0, C32=정액, 일반=정률 100원절사 |
| `decimal CalcCopay_D(...)` | 의료급여(D) 본인부담금. D10/D20 정액, V252 3%, B014 30% |
| `decimal CalcCopay_G(...)` | 보훈(G) 본인부담금. M10=0, M82=일반, 감면30/50/60/90 역산 |
| `decimal CalcCopay_F(CalcOptions opt, decimal pbSum)` | 자동차보험(F): Trunc10(전액). 할증은 Premium으로 분리 |
| `static int GetBohunRate(string bohunCode, string dosDate)` | 보훈코드별 감면율 반환 (2018.01.01 기준 분기) |
| `decimal GetDoubleReductionRate(string bohunCode, string dosDate)` | M20/M61 이중감면률: 2018이후=10, 이전=20 |
| `decimal CalcMpvaPrice(CalcOptions opt, decimal pbSum, int bohunRate)` | 보훈청구액: 위탁=Trunc10(총액×감면율%), 비위탁=역산 방식 |
| `decimal CalcMpvaComm(CalcOptions opt, CalcResult result, int bohunRate)` | 보훈 비급여 감면분(MpvaComm): Trunc10(비급여×감면율%) |
| `decimal CalcPubPrice(CalcOptions opt, CalcResult result, decimal insuRate, MediIllnessInfo? illness)` | 공비 결정: 희귀질환/F008긴급복지/특수공비/IndYN=Y 등 |
| `void ApplySpecialPub(CalcOptions opt, CalcResult result)` | 특수공비 302/101/102 재배분 (C/D/G 유형별) |
| `void ApplyBohunPharmacy(CalcOptions opt, CalcResult result)` | M81/M82/M83 보훈약국 후처리 (SumUser 조정) |
| `void ApplyOverUserPrice(CalcOptions opt, CalcResult result)` | 본인부담상한제: 연간 누적 초과분 OverUserPrice 전환 |
| `bool IsBohunHospital(string hospCode)` | 보훈병원 6곳 하드코딩 판정 |
| `bool IsMediAid1Exempt(CalcOptions opt)` | 의료급여 1종 면제 7종 판정 (18세미만/임산부/결핵 등) |
| `bool IsV252ForMediAid(CalcOptions opt, MediIllnessInfo? illness)` | 의료급여 V252 경증질환 3% 적용 대상 판정 |
| `bool IsV252Series(string code)` | V252/V352/V452 경증질환 코드 판정 |

**의존성**: `ICalcRepository` (ApplyOverUserPrice에서 DB조회), `InsuRateInfo`, `MediIllnessInfo`, `RoundingHelper`, `InsuranceCodes`, `BohunCode`, `InsuranceType`, `GsCode`

---

### 2-2. `Engine/DispensingFeeCalculator.cs` (2,059줄)

**무엇을 계산하는가**: CH02(Z코드 체계)+CH03(수가 9단계)+CH04(가산 로직) 통합. 약품을 분류하여 해당 Z코드를 선택하고 WageList에 적재, SumWage를 산출.

| 메서드 시그니처 | 설명 |
|----------------|------|
| `CalcResult Calculate(CalcOptions options)` | **메인 진입점**. Step1~7 순서 실행 후 CalcResult 반환 |
| `MediWageData LoadWageData(string dosDate)` | Step1: 수가마스터 로드. `ICalcRepository.SelectMediWage` 호출 |
| `DrugClassifyContext ClassifyDrugs(CalcOptions options, Dictionary drug302List)` | Step2: 약품 순회하며 내복/외용/주사, 급여/비급여, 최대일수, 산제, 마약, 팩단위 분류 |
| `DoseContext ResolveDoseContext(CalcOptions options, DrugClassifyContext drugCtx)` | Step3: 투약일수 확정 (InsuDose/RealDose/ActualInternalDose/ManagementDose) |
| `SurchargeContext DetermineSurcharge(CalcOptions options, DrugClassifyContext drugCtx)` | Step4: 가산 판정. 비대면>가루약>야간/공휴>심야>토요 우선순위 |
| `SuffixSet BuildSuffix(CalcOptions options, SurchargeContext sc)` | Step5: Z코드 접미사 3자리 생성 (text/text2/text3) |
| `void CalcPharmMgm(CalcResult result, CalcOptions options, SuffixSet suffix, int presDosage)` | Step6-(1): Z1000 약국관리료 산정 |
| `void CalcBaseJoje(CalcResult result, CalcOptions options, SuffixSet suffix, SurchargeContext sc, int presDosage)` | Step6-(2): Z2000 기본조제기술료 + 토요가산 |
| `void CalcEatEdu(CalcResult result, CalcOptions options, SuffixSet suffix, SurchargeContext sc, int presDosage)` | Step6-(3): Z3000 복약지도료 + 토요가산 |
| `void CalcInternalDrug(...)` | Step6-(4): Z4xxx 내복약 조제료. 처방조제(Z41xx/Z43xx) / 직접조제(Z4200×일수) 분기 |
| `void CalcPresInternal(...)` | 처방조제 내복약 조제료 (25구간, 산제가산 포함) |
| `void CalcDirectInternal(...)` | 직접조제 내복약 조제료 (Z4200×일수, 산제=Z4020) |
| `void CalcExternalDrug(...)` | Step6-(5): 외용약 조제료 (Z4120 단독, Z4121 내복+외용 혼합) |
| `void CalcSelfInjection(...)` | Step6-(6): 자가주사 조제료 Z4130 |
| `void CalcDrugMgm(...)` | Step6-(7): Z5000/Z5001 의약품관리료 + Z5xxx 일수별 가산 |
| `void CalcMoonMgm(...)` | Step6-(8): Z7001 복약상담료 (18세이하+MoonYN=1+처방조제) |
| `void CalcDrugSafe(...)` | Step6-(9a): ZC(비대면)/ZH(투약안전/대면투약관리료) |
| `void CalcHolidaySurcharge(...)` | Step6-(9b): ZE100/ZE010/ZE101 명절조제지원금 |
| `void AssembleResult(CalcResult result, CalcOptions options, Dictionary drug302List)` | Step7: WageList→SumWage 산출 + 약품비 항별 합산 (선별급여 A/B/D/E항) |
| `void ApplyNPayWageRules(...)` | 높음5: 비급여약만 있을 때 조제료 처리 규칙 |
| `void ApplyBohunWageReduction(...)` | 중간14: 보훈감면(30/50/60/90%) 시 Z1000/Z2000/Z3000 0원 처리 |
| `string? GetInJojeSugaCD(int days)` | 내복약 처방조제료 25구간 Z코드 생성 (1~15일: Z41DD, 16일~: Z43XX) |
| `string? GetMedMgmtSugaCD(int days)` | 의약품관리료 25구간 Z코드 생성 (1~15일: Z51DD, 16일~: Z53XX) |
| `bool IsNum8Target(CalcOptions options, DrugItem drug, bool is302Drug)` | 투약일수 산정 기준 약품 판정 (보험약품 또는 302 약품) |

**의존성**: `ICalcRepository`, `MediWageData`, `DrugItem`, `CalcOptions`, `CalcResult`, `WageListItem`, `InsuPayType`, `TakeType`, `RoundingHelper`, `CopaymentCalculator` (GetBohunRate 호출)

---

## 3. 참조 테이블 파일 (Tables/ + Constants/)

### Tables/

| 파일 | 보유 데이터 | 레코드 수 | 커버 연도 |
|------|------------|-----------|----------|
| `CopayRateTable.cs` | 본인부담금 산출 함수 (CalcBurdenAmt, GetVeteranDiscount, CalcSelectiveBenefit 등 레거시 호환 포함) + CopayResult·SelectiveBenefits·SelectiveBenefitAmounts record | 함수 13개 (하드코딩 없음) | — |
| `FeeBaseParams.cs` | 조제료 수가 기본 파라미터 1건 record (약국관리료 740원, 기본조제기술료 1610원, 복약지도료 1090원 등 30여 파라미터) | 파라미터 record (단일 기준값) | 2024 |
| `HolidayTable.cs` | 공휴일 날짜 HashSet (연도별 하드코딩) + IsHoliday 조회 메서드 | 2024년 19건, 2025년 16건, 2026년 13건 이상 | 2024~2026 |
| `InsuranceRuleTable.cs` | 보험 유형 열거형 (InsuranceTag, MedicalAidType, AmtRateTag 등) + InsuranceRuleTable static class (22개 메서드) | 메서드 22개, 열거값 다수 | — |
| `PrescDosageFeeTable.cs` | 투약일수별 처방조제료 고정금액 딕셔너리 + 구간 배열 | 2024: 15건 개별 + 10구간, 2026: 15건 개별 + 10구간 | 2024, 2026 |
| `SugaFeeTable.cs` | Z코드 수가 단가 테이블 (SugaFeeEntry record: Code/Name/Price/Group) | **2024: 282건, 2026: 282건** (총 564건) | 2024, 2026 |

### Constants/

| 파일 | 보유 데이터 |
|------|------------|
| `DateThresholds.cs` | 제도 변경 시점 날짜 상수 30+건 (yyyyMMdd decimal 형식) |
| `HospitalCodes.cs` | 보훈병원 코드 6건 HashSet + 등급 보정 코드 2건 |
| `InsuranceCodes.cs` | 보험코드 접두사(C/D/G/F), 세부코드(C21/C31/C32/D10 등) |
| `SpecialDrugCodes.cs` | 특수약품코드 648903860, 투약일수 상한(5일), 산제 원소코드 |
| `SugaCodes.cs` | Z코드 상수 전체 (Z1000~Z7001, ZC/ZH/ZE계열) |

---

## 4. 핵심 메서드 TOP 30

> 계산 정확성에 대한 중요도 기준으로 선정.

| # | 파일 | 메서드명 | 목적 | 파라미터 | 반환값 | 특이사항 |
|---|------|----------|------|----------|--------|---------|
| 1 | `Engine/DispensingFeeCalculator.cs` | `Calculate(CalcOptions options)` | 조제료 전체 산정 메인 진입점 | `CalcOptions` | `CalcResult` | 7단계 순서 필수. 스레드 비안전 |
| 2 | `Engine/CopaymentCalculator.cs` | `Calculate(CalcOptions opt, CalcResult result, InsuRateInfo rate, MediIllnessInfo? illness)` | 본인부담금 + 3자배분 메인 진입점 | `CalcOptions`, `CalcResult`, `InsuRateInfo`, `MediIllnessInfo?` | `void` (result 수정) | result에 약가합계 미리 채워져 있어야 함 |
| 3 | `Engine/DispensingFeeCalculator.cs` | `ClassifyDrugs(CalcOptions, Dictionary)` | 약품 분류·집계 (내복/외용/주사, 일수, 급여여부) | `CalcOptions`, `Dictionary<string,object>` | `DrugClassifyContext` | EXTYPE 필터, 648903860 5일 제한 |
| 4 | `Engine/CopaymentCalculator.cs` | `DetermineInsuRate(CalcOptions, InsuRateInfo, MediIllnessInfo?)` | 본인부담률 4단계 결정 | `CalcOptions`, `InsuRateInfo`, `MediIllnessInfo?` | `decimal` (%) | 기본→질병→V252등급→6세미만 순서 |
| 5 | `Engine/DispensingFeeCalculator.cs` | `DetermineSurcharge(CalcOptions, DrugClassifyContext)` | 가산 조건 판정 (비대면>가루약>야간 등) | `CalcOptions`, `DrugClassifyContext` | `SurchargeContext` | 가루약 시 모든 가산 배제 |
| 6 | `Engine/DispensingFeeCalculator.cs` | `BuildSuffix(CalcOptions, SurchargeContext)` | Z코드 접미사 3자리 생성 | `CalcOptions`, `SurchargeContext` | `SuffixSet(Text,Text2,Text3)` | 차등가산(text3) 영업시간 판정 포함 |
| 7 | `Engine/CopaymentCalculator.cs` | `CalcCopay_C(CalcOptions, InsuRateInfo, MediIllnessInfo?, decimal, decimal, decimal, int, decimal, decimal, ref decimal)` | 건강보험 본인부담금 계산 | 여러 | `decimal` | C21=0, C31=0, C32=정액, 65세 3구간, M20/M61 이중감면, 648 5% 가산 분기 |
| 8 | `Engine/CopaymentCalculator.cs` | `CalcCopay_D(CalcOptions, InsuRateInfo, MediIllnessInfo?, decimal, decimal, int, decimal, ref decimal)` | 의료급여 본인부담금 계산 | 여러 | `decimal` | V252 3%, B014 30%, 면제 7종, M코드/B코드 정액 |
| 9 | `Engine/CopaymentCalculator.cs` | `CalcCopay_G(CalcOptions, InsuRateInfo, decimal, decimal, int, decimal, ref decimal)` | 보훈 본인부담금 계산 | 여러 | `decimal` | M10=0, M82=일반, 감면율별 절사 분기 |
| 10 | `Engine/CopaymentCalculator.cs` | `GetBohunRate(string bohunCode, string dosDate)` | 보훈코드별 감면율(%) 반환 | `string`, `string` | `int` | 2018.01.01 기준 분기. `static` 공개 메서드 |
| 11 | `Engine/CopaymentCalculator.cs` | `CalcMpvaPrice(CalcOptions, decimal pbSum, int bohunRate)` | 보훈청구액 산출 | `CalcOptions`, `decimal`, `int` | `decimal` | 위탁=정산, 비위탁=역산 (절사 오차 환자 불리 방지) |
| 12 | `Engine/DispensingFeeCalculator.cs` | `AssembleResult(CalcResult, CalcOptions, Dictionary)` | WageList 집계 + 약품비 항별 합산 | `CalcResult`, `CalcOptions`, `Dictionary` | `void` | A/B/D/E 선별급여 본인부담 Trunc10 |
| 13 | `Engine/DispensingFeeCalculator.cs` | `CalcInternalDrug(CalcResult, CalcOptions, SuffixSet, SurchargeContext, DoseContext, int)` | 내복약 조제료 산정 (처방/직접 분기) | 여러 | `void` | 산제 2023.11.01 체계 분기 |
| 14 | `Engine/DispensingFeeCalculator.cs` | `CalcPresInternal(...)` | 처방조제 내복약 조제료 25구간 | 여러 | `void` | InsuredDose와 ActualDose 차이분 비급여 분리 |
| 15 | `Engine/DispensingFeeCalculator.cs` | `GetInJojeSugaCD(int days)` | 내복약 조제료 Z코드 25구간 결정 | `int` | `string?` | 1~15일: Z41DD, 16~20: Z4316, … 91+: Z4391 |
| 16 | `Engine/DispensingFeeCalculator.cs` | `GetMedMgmtSugaCD(int days)` | 의약품관리료 Z코드 25구간 결정 | `int` | `string?` | 1~15일: Z51DD, 16~20: Z5316, … 91+: Z5391 |
| 17 | `Engine/DispensingFeeCalculator.cs` | `CalcDrugMgm(CalcResult, CalcOptions, DrugClassifyContext, DoseContext)` | Z5000 의약품관리료 + 일수별 가산 | `CalcResult`, `CalcOptions`, `DrugClassifyContext`, `DoseContext` | `void` | 병팩=Z5011, 마약=Z5001, 외용만=Z5010 |
| 18 | `Engine/DispensingFeeCalculator.cs` | `ApplyBohunWageReduction(CalcResult, CalcOptions)` | 보훈감면 시 Z1000/Z2000/Z3000 0원 처리 | `CalcResult`, `CalcOptions` | `void` | 감면 30/50/60/90%만 해당. Z4xxx/Z5xxx는 유지 |
| 19 | `Engine/DispensingFeeCalculator.cs` | `ApplyNPayWageRules(CalcResult, CalcOptions, DrugClassifyContext)` | 비급여전용 시 조제료 처리 | `CalcResult`, `CalcOptions`, `DrugClassifyContext` | `void` | NPayOnlyWage=FALSE면 WageList 전체 삭제 |
| 20 | `Engine/DispensingFeeCalculator.cs` | `ResolveDoseContext(CalcOptions, DrugClassifyContext)` | 투약일수 확정 (4종) | `CalcOptions`, `DrugClassifyContext` | `DoseContext` | InsuDose/RealDose/Actual/Management 분리 |
| 21 | `Engine/CopaymentCalculator.cs` | `CalcPubPrice(CalcOptions, CalcResult, decimal, MediIllnessInfo?)` | 공비(제3기관 지원금) 결정 | 여러 | `decimal` | 희귀질환/F008/특수공비/IndYN=Y 분기 |
| 22 | `Engine/CopaymentCalculator.cs` | `ApplySpecialPub(CalcOptions, CalcResult)` | 특수공비 302/101/102 재배분 | `CalcOptions`, `CalcResult` | `void` | 보험유형(C/D/G)별 Pub100Price/SumUser 조정 |
| 23 | `Engine/CopaymentCalculator.cs` | `ApplyOverUserPrice(CalcOptions, CalcResult)` | 본인부담상한제 적용 | `CalcOptions`, `CalcResult` | `void` | DB에서 누적액 조회 후 초과분 OverUserPrice 분리 |
| 24 | `Engine/CopaymentCalculator.cs` | `ApplyBohunPharmacy(CalcOptions, CalcResult)` | M81/M82/M83 보훈약국 후처리 | `CalcOptions`, `CalcResult` | `void` | G타입+비위탁: SumUser=0, MpvaPrice += RealPrice |
| 25 | `Engine/DispensingFeeCalculator.cs` | `CalcHolidaySurcharge(CalcResult, CalcOptions)` | ZE 명절조제지원금 산정 | `CalcResult`, `CalcOptions` | `void` | 날짜 하드코딩 (2024추석/2025설·추석). TDayPrice 누적 |
| 26 | `Engine/DispensingFeeCalculator.cs` | `CalcDrugSafe(CalcResult, CalcOptions, SurchargeContext)` | ZC(비대면)/ZH(투약안전) 산정 | `CalcResult`, `CalcOptions`, `SurchargeContext` | `void` | DrugSafeYN 첫 글자로 U/Y/A 분기 |
| 27 | `Utilities/RoundingHelper.cs` | `Trunc10(decimal v)` | 10원 미만 절사 | `decimal` | `decimal` | 총약제비/의료급여 본인부담금에 사용 |
| 28 | `Utilities/RoundingHelper.cs` | `Trunc100(decimal v)` | 100원 미만 절사 | `decimal` | `decimal` | 건강보험(C) 본인부담금 기준. 2016.09.29 이후 |
| 29 | `Utilities/RoundingHelper.cs` | `Round1(decimal v)` | 원미만 사사오입 (AwayFromZero) | `decimal` | `decimal` | 약품금액 전반. C# 기본 은행원반올림과 다름 |
| 30 | `Utilities/RoundingHelper.cs` | `ApplyNPayRound(decimal amount, NPayRoundType type)` | 비급여 금액 반올림 유형별 처리 | `decimal`, `NPayRoundType` | `decimal` | 6종 유형 (Floor10/Floor100/Round100/Ceil100/None/Round10) |

---

## 5. C# → TypeScript 파일 매핑

| C# 파일 | 대응 TypeScript 파일 (제안) |
|---------|---------------------------|
| `Engine/CopaymentCalculator.cs` + `CopaymentCalculator.Logging.cs` | `src/lib/calc-engine/copayment-calculator.ts` |
| `Engine/DispensingFeeCalculator.cs` + `DispensingFeeCalculator.Logging.cs` | `src/lib/calc-engine/dispensing-fee-calculator.ts` |
| `Models/CalcOptions.cs` | `src/lib/models/calc-options.ts` |
| `Models/CalcResult.cs` | `src/lib/models/calc-result.ts` |
| `Models/DrugItem.cs` | `src/lib/models/drug-item.ts` |
| `Models/InsuRateInfo.cs` | `src/lib/models/insu-rate-info.ts` |
| `Models/MediIllnessInfo.cs` | `src/lib/models/medi-illness-info.ts` |
| `Models/WageItem.cs` | `src/lib/models/wage-item.ts` |
| `Models/WageListItem.cs` | `src/lib/models/wage-list-item.ts` |
| `Enums/InsuPayType.cs` | `src/lib/enums/insu-pay-type.ts` |
| `Enums/InsuranceType.cs` | `src/lib/enums/insurance-type.ts` |
| `Enums/TakeType.cs` | `src/lib/enums/take-type.ts` |
| `Enums/BohunCode.cs` | `src/lib/enums/bohun-code.ts` |
| `Enums/GsCode.cs` | `src/lib/enums/gs-code.ts` |
| `Enums/NPayRoundType.cs` | `src/lib/enums/npay-round-type.ts` |
| `Enums/SurchargeType.cs` | `src/lib/enums/surcharge-type.ts` |
| `Constants/DateThresholds.cs` | `src/lib/constants/date-thresholds.ts` |
| `Constants/HospitalCodes.cs` | `src/lib/constants/hospital-codes.ts` |
| `Constants/InsuranceCodes.cs` | `src/lib/constants/insurance-codes.ts` |
| `Constants/SpecialDrugCodes.cs` | `src/lib/constants/special-drug-codes.ts` |
| `Constants/SugaCodes.cs` | `src/lib/constants/suga-codes.ts` |
| `Tables/SugaFeeTable.cs` | `src/lib/tables/suga-fee-table.ts` |
| `Tables/CopayRateTable.cs` | `src/lib/tables/copay-rate-table.ts` |
| `Tables/FeeBaseParams.cs` | `src/lib/tables/fee-base-params.ts` |
| `Tables/HolidayTable.cs` | `src/lib/tables/holiday-table.ts` |
| `Tables/InsuranceRuleTable.cs` | `src/lib/tables/insurance-rule-table.ts` |
| `Tables/PrescDosageFeeTable.cs` | `src/lib/tables/presc-dosage-fee-table.ts` |
| `Data/ICalcRepository.cs` | `src/lib/data/i-calc-repository.ts` |
| `Data/MediWageData.cs` | `src/lib/data/medi-wage-data.ts` |
| `Data/MockCalcRepository.cs` | `src/lib/data/mock-calc-repository.ts` |
| `Data/SqlCalcRepository.cs` | `src/lib/data/sql-calc-repository.ts` (또는 `db-calc-repository.ts`) |
| `Utilities/RoundingHelper.cs` | `src/lib/utilities/rounding-helper.ts` |
| `Exceptions/YakjaebiCalcException.cs` | `src/lib/exceptions/yakjaebi-calc-error.ts` |

---

*이 문서는 소스를 읽기 전용으로 분석한 결과입니다. 구현 여부 확인은 Chapter 분석가 담당입니다.*

**[약제비 분析용]**
