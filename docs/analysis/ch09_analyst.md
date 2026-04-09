# CH09 구현 분석 보고서

> 작성자: CH09 Analyst (Phase 2 Team 9A)
> 작성일: 2026-04-06
> 챕터: CH09 — 데이터 모델 설계 통합
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 데이터 모델 설계 통합
- **핵심 주제**: 4개 소스(BIZ/HIRA/UPH/EDB)의 데이터 구조를 통합 분석하여 계산 엔진이 사용할 클래스·인터페이스의 정규 설계안을 제시한다. CalcOptions(44필드) · DrugItem(19필드) · 수가/요율/산정특례 마스터 · PrsWageListM · PrsBillM(39필드) · Enum · ICostCalcRepository(9메서드)를 망라한다.
- **다루는 계산 로직 범위**:
  - 계산 엔진 입·출력 타입 정의 전체 (입력→마스터→중간→출력)
  - 보험코드(C10/D10/G10/F10), 보훈코드(M10~M90), 산정특례(V252), 본인부담상한제 등 모든 분기 파라미터
  - EDB `PrsBillCalcOptions` · `PrsBillM` · `ICostCalcRepository` 기준; 공단 명세서 p147-156 HIRA 전자문서 정합성
  - 관련 법령: 요양급여비용 청구방법 고시 (2024년 7월 기준)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 인터페이스/타입 | 비고 |
|----------|-----------|--------------------------|------|
| `src/lib/calc-engine/types.ts` | 284줄 | `CalcOptions`, `DrugItem`, `InsuRate`, `WageListItem`, `CalcResult`, `CalcStep`, `ICalcRepository`, `MediIllnessInfo`, `InsuPayType`, `TakeType` | 핵심 타입 파일 |

### 미구현 영역

- `MediWageM` (수가마스터 구조체) — CH09 §4, EDB `MediWageM` 대응 타입이 없음 (현재는 `ICalcRepository.getSugaFeeMap()`의 반환 타입으로 인라인 처리됨)
- `PrsWageListM` (수가 리스트 record) — CH09 §7, `WageListItem`으로 부분 대응하나 `AddType` 필드 누락
- `PrsBillM` (청구서 39필드) — CH09 §8, 전용 타입 없음; `CalcResult`가 일부를 흡수하나 39개 중 다수 누락
- `CalcResultWage` (조제료 세분 결과) — CH09 §9, `CalcResult.wageList[]`로 요약만 존재; 항목별(Z1000/Z2000/Z3000/Z4000/Z5000) 명시적 분리 없음
- `ICostCalcRepository` 확장 메서드 5개 — CH09 §11, 현재 인터페이스는 3개 필수 + 2개 옵션(4/5메서드)만 선언

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §      | 요구사항 요약 | 우리 구현 위치 | 상태 | 비고 |
|------------|-------------|--------------|------|------|
| CH09 §2 | CalcOptions 44개 필드 — 처방전 전체 파라미터 | `src/lib/calc-engine/types.ts:CalcOptions` | ⚠ | 44→32필드 (12필드 누락, 아래 §4 참조) |
| CH09 §3 | DrugItem 19개 필드 | `src/lib/calc-engine/types.ts:DrugItem` | ⚠ | 19→11필드 (8필드 누락, 아래 §4 참조) |
| CH09 §4 | MediWageM 수가마스터 (탭 구분 딕셔너리) | `src/lib/calc-engine/types.ts:ICalcRepository.getSugaFeeMap()` | ⚠ | 전용 타입 없음; Map 반환으로 대체 |
| CH09 §5 | InsuRateM 11개 필드 | `src/lib/calc-engine/types.ts:InsuRate` | ⚠ | 11→9필드 (2필드 누락, 아래 §4 참조) |
| CH09 §6 | MediIllnessM 5개 필드 (산정특례 마스터) | `src/lib/calc-engine/types.ts:MediIllnessInfo` | ⚠ | 5→5필드이나 필드명/용도 불일치 2건 (§5 참조) |
| CH09 §7 | PrsWageListM 6개 필드 (수가 리스트) | `src/lib/calc-engine/types.ts:WageListItem` | ⚠ | `Name` 추가됨, `AddType` 누락 |
| CH09 §8 | PrsBillM 39개 필드 (청구서 출력) | `src/lib/calc-engine/types.ts:CalcResult` | ⚠ | 39→18필드 (21필드 누락, 아래 §4 참조) |
| CH09 §9 | CalcResult조제료 — Z코드별 세분 결과 | `src/lib/calc-engine/types.ts:CalcResult.wageList` | ✗ | 항목별 분리 없음; 합계만 존재 |
| CH09 §10.1 | InsuPayType 7개 값 | `src/lib/calc-engine/types.ts:InsuPayType` | ✓ | 7개 모두 구현 |
| CH09 §10.2 | TakeType 3개 값 | `src/lib/calc-engine/types.ts:TakeType` | ✓ | 3개 모두 구현 |
| CH09 §10.3 | BohunCodes Enum (10코드) | `src/lib/calc-engine/types.ts:CalcOptions.bohunCode?: string` | ✗ | string 처리; 전용 Enum 없음 |
| CH09 §10.4 | InsuTypes Enum (C/D/G/F 4종) | `src/lib/calc-engine/types.ts:CalcOptions.insuCode: string` | ✗ | string 처리; 전용 Enum 없음 |
| CH09 §10.5~10.8 | 유팜 보험Types(26종)/처방Types(6종)/보험구분Types(9종)/급여구분Types(7종) | — | ✗ | 미구현 |
| CH09 §11 | ICostCalcRepository 9개 메서드 | `src/lib/calc-engine/types.ts:ICalcRepository` | ⚠ | 9→3+2개 (4개 누락, §4 참조) |

---

## 4. 누락 항목 (Missing)

### CalcOptions — 누락 12개 필드

| # | EDB 필드명 | 의미 | CH09 §ref |
|---|-----------|------|-----------|
| 1 | `Sex` | 성별 | CH09 §2.1 #6 |
| 2 | `PsCode` | 처방코드 (처방전발급번호 an(13)) | CH09 §2.1 #7 |
| 3 | `CustId` | 환자 ID | CH09 §2.1 #8 |
| 4 | `RealDose` | 실투여일수 | CH09 §2.1 #11 |
| 5 | `IsRealDose` | 실투여일수 사용 여부 (bool) | CH09 §2.1 #21 |
| 6 | `IsPregnant` | 임신 여부 (bool) — 일부 급여 처리에 영향 | CH09 §2.1 #22 |
| 7 | `DrugSafe_YN` | 약물안전서비스 (Y/A/U/N) | CH09 §2.1 #23 |
| 8 | `Self_Inj_YN` | 자가주사 여부 | CH09 §2.1 #26 |
| 9 | `Special_Pub` | 특수공비 (공상 처리용) | CH09 §2.1 #27 |
| 10 | `GradeSatIn` | 등급토요진입 | CH09 §2.1 #28 |
| 11 | `NPayRoundType` | 비급여 반올림 유형 | CH09 §2.1 #30 |
| 12 | `IsBohun_Npay_User` | 보훈 비급여 본인부담 여부 (bool) | CH09 §2.1 #35 |

- [🟠 Missing / High] `Sex`: 6세 미만 경감 외에 임신 등 성별 조건 분기에 필요 (CH09 §2.1 #6)
- [🟠 Missing / High] `RealDose`: 실투여일수는 보험투여일수와 별개 — 일부 보험 유형에서 실투여일수 기준 조제료 산정 (CH09 §2.1 #11)
- [🟡 Missing / Medium] `PsCode`, `CustId`: 처방전 식별·상한제 이력 조회에 필요 (CH09 §2.1 #7, #8)
- [🟡 Missing / Medium] `DrugSafe_YN`: 약물안전서비스 가산 여부 판별 (CH09 §2.1 #23)
- [🟡 Missing / Medium] `Self_Inj_YN`: 자가주사 조제료 분기 (CH09 §2.1 #26)
- [🟡 Missing / Medium] `Special_Pub`, `GradeSatIn`, `NPayRoundType`, `IsBohun_Npay_User`, `IsRealDose`, `IsPregnant` (CH09 §2.1 #21, #22, #27, #28, #30, #35)

### DrugItem — 누락 8개 필드

| # | EDB 필드명 | 의미 | CH09 §ref |
|---|-----------|------|-----------|
| 1 | `PD_EXTYPE` | 제외유형 — 비급여 산정 제외 판별 | CH09 §3.1 #4 |
| 2 | `PD_ELEMENT` | 성분코드 | CH09 §3.1 #12 |
| 3 | `PD_BIGUPWAGENO` | 대상수가번호 — Z4000 항목 연계 | CH09 §3.1 #15 |
| 4 | `DM_UNIT` | 단위 (mg, mL 등) | CH09 §3.1 #16 |
| 5 | `DM_AMT` | 약품 함량 | CH09 §3.1 #17 |
| 6 | `DM_EFFECT` | 약효분류코드 | CH09 §3.1 #18 |
| 7 | `DM_PWD_YN` | 약품마스터 산제여부 (vs PD_PWD 처방 산제여부 구분 필요) | CH09 §3.1 #19 |
| 8 | `PD_SUM` 자동계산 | `price * dose * dNum * dDay / pack` 공식 구현 여부 불명 | CH09 §3.2 |

- [🟠 Missing / High] `PD_EXTYPE`: 제외유형 없으면 선별급여(A/B/D/E/U)·비급여 품목 산정 분기 불가 (CH09 §3.1 #4)
- [🟠 Missing / High] `PD_BIGUPWAGENO`: 대상수가번호 없으면 Z4000 행별 약품조제료 연계 불가 (CH09 §3.1 #15)
- [🟡 Missing / Medium] `PD_ELEMENT`, `DM_UNIT`, `DM_AMT`, `DM_EFFECT`, `DM_PWD_YN` (CH09 §3.1 #12, #16~#19)

### InsuRateM — 누락 2개 필드

| # | EDB 필드명 | 의미 | CH09 §ref |
|---|-----------|------|-----------|
| 1 | `DueDate` | 적용 기준일자 (PK1) — 날짜별 요율 이력 관리 | CH09 §5.1 #1 |
| 2 | `HealthCenter` | 보건기관 적용 고정 금액 | CH09 §5.1 #6 |

- [🟠 Missing / High] `HealthCenter`: 보건기관 처방인 경우 고정금액 처리 분기 불가 (`src/lib/calc-engine/types.ts:InsuRate`) (CH09 §5.1 #6)
- [🟡 Missing / Medium] `DueDate`: 날짜 이력 없으면 요율 버전 관리 불가 (CH09 §5.1 #1)

### PrsBillM — 누락 21개 필드 (CalcResult에 없는 항목)

> CH09 §8.1 기준; `CalcResult`에서 대응 없는 필드만 열거.

- [🔴 Missing / Critical] `PbSumUserDrug` (비급여 약품 합계): 비급여 처방 청구 계산에 필수 (CH09 §8.1 #5)
- [🔴 Missing / Critical] `PbSumWageComm` / `PbWageComm` (조제료 가산 합계 / 가산율): 자보·야간 등 가산 분리 청구 필수 (CH09 §8.1 #7, #8)
- [🔴 Missing / Critical] `PbSum` (약가+조제료 합계): 총액 계산 중간값, HIRA 전자문서 매핑 필수 (CH09 §8.1 #9)
- [🟠 Missing / High] `PbCode` / `PbMakeYm` (청구번호 / 청구년월): 청구서 식별자 (CH09 §8.1 #1, #2)
- [🟠 Missing / High] `PbRealPrice` (실 청구금액=수납금액): 실수납 환자 부담 (CH09 §8.1 #12)
- [🟠 Missing / High] `PbMpvaComm` (보훈 가산금액) (CH09 §8.1 #15)
- [🟠 Missing / High] `PbSumInsure` (보험자 부담 합계) (CH09 §8.1 #16)
- [🟠 Missing / High] `PbSumUser` (환자 부담 합계) (CH09 §8.1 #18)
- [🟠 Missing / High] `PbBagPrice` (봉투요금), `PbReceive` (수납금액), `PbDc` (할인금액) (CH09 §8.1 #19~#21)
- [🟠 Missing / High] `PbTakeDayType`/`PbListDay`/`PbListPrice`/`PbAvgPrice` (투약일수·금액 리스트, 탭 구분 문자열) (CH09 §8.1 #22~#25)
- [🟠 Missing / High] `PbListDay100`/`PbListPrice100`/`PbListDayB`/`PbListPriceB` (100일 이상·B형 리스트) (CH09 §8.1 #26~#29)
- [🟡 Missing / Medium] `PbCfhcdmdamt` (처방전 조제수가 청구금액), `PbGoDang` (고당금액), `PbDiffCost` (차액 비용), `PbPub100Price` (100일 공단 부담), `PbTDayPrice` (투약일 단가) (CH09 §8.1 #30, #34~#35, #36, #39)

### CalcResultWage (조제료 세분 결과) — 미구현

- [🟠 Missing / High] `CalcResultWage` 타입 전체: Z1000(약국관리료)/Z2000(기본조제기술료)/Z3000(복약지도료)/Z4000(약품조제료 내복·외용·주사·가루약)/Z5000(의약품관리료) 항목별 금액 분리 없음 — 현재 `wageList[]`에 통합 (CH09 §9)

### Enum — 미구현

- [🟡 Missing / Medium] `BohunCodes` Enum (M10~M90 10개 코드): 현재 `string` 처리 (CH09 §10.3)
- [🟡 Missing / Medium] `InsuTypes` Enum (C/D/G/F): 현재 `string` 처리 (CH09 §10.4)
- [🟢 Missing / Low] 유팜 `보험Types`(26종) / `처방Types`(6종) / `보험구분Types`(9종) / `급여구분Types`(7종): 이 프로젝트가 EDB 기준을 채택하므로 낮은 우선순위이나, 소스 간 변환 필요 시 참조 필요 (CH09 §10.5~10.8)

### ICostCalcRepository — 누락 4개 메서드

| # | EDB 메서드 | 의미 | CH09 §ref |
|---|-----------|------|-----------|
| 1 | `Get302DrugList(dosDate)` | 302약품 목록 조회 (선별급여 분기용) | CH09 §11.1 #6 |
| 2 | `GetV252List(dosDate)` | V252 질병코드 목록 조회 | CH09 §11.1 #7 |
| 3 | `GetConfigValue(group, key, year)` | 설정값 조회 (연간 상한액 등) | CH09 §11.1 #8 |
| 4 | `GetAccSubSummary(psCode)` | 처방코드 기준 수납 집계 (Receive/Dc/Cfhcdmdamt) | CH09 §11.1 #9 |

- [🟠 Missing / High] `Get302DrugList`: 302약품(선별급여) 분기 없으면 해당 약품 본인부담 계산 오류 (CH09 §11.1 #6)
- [🟠 Missing / High] `GetV252List`: V252 판별 보조 리스트 없으면 산정특례 등급 분기 의존성 증가 (CH09 §11.1 #7)
- [🟠 Missing / High] `GetConfigValue`: 본인부담상한액 연간 기준값 조회 불가 (CH09 §11.1 #8)
- [🟡 Missing / Medium] `GetAccSubSummary`: 수납 집계(봉투요금·할인·처방전 조제수가) 없으면 `PbCfhcdmdamt` 등 출력 불가 (CH09 §11.1 #9)

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] `CalcOptions.mediIllnessInfo` vs `MediIllnessM`: CH09 §6에서 마스터 조회 후 사용하는 `SeSickNoType` 필드(V252 등급 "0"/"1"/"4")가 `MediIllnessInfo.grade?: number`로 표현되어 있어 타입이 불일치함. 원본은 string("0"/"1"/"4"), 구현은 `number` — V252 등급 4는 0과 동일 취급이지만 숫자 `4`로 오류 없이 처리되는지 불명 (`src/lib/calc-engine/types.ts:MediIllnessInfo:L62-L72`)

- [🟠 Insufficient / High] `InsuRate.v2520` / `v2521`: CH09 §5.1에서 `V2520`은 "등급 0/4 본인부담률"로 정의되는데, 현재 필드명 `v2520`은 등급 0만 암시하여 "4도 포함"임이 코드에 드러나지 않음. 오적용 가능성 존재 (`src/lib/calc-engine/types.ts:InsuRate:L168-L174`)

- [🟡 Insufficient / Medium] `WageListItem` vs `PrsWageListM`: CH09 §7에서 `PrsWageListM.Sum = Cnt * Price` (10원 절사 후) 로 정의하나, `WageListItem.sum: number`에 절사 적용 여부가 명시되지 않음. 또한 `WageListItem`에는 `name` 필드가 추가되어 있고 `AddType`("" / "S")이 누락됨 (`src/lib/calc-engine/types.ts:WageListItem:L181-L189`)

- [🟡 Insufficient / Medium] `ICalcRepository.getHolidayType?`: 반환 타입이 `'lunar_new_year' | 'chuseok' | 'holiday' | null`로 정의되어 있으나, CH09 §11.1 #4의 `SelectManageInOutTime`(약국 영업시간 InTime/OutTime 반환)과 의미·반환형이 다름 — 야간 판별은 영업시간 기준이나 현재는 명절 유형 반환으로 대체됨 (`src/lib/calc-engine/types.ts:ICalcRepository:L280-L283`)

- [🟡 Insufficient / Medium] `CalcOptions.insuDose?: number` vs EDB `InsuDose: string`: CH09 §2.3에서 `int` 권고이며 현재 `number`로 구현되어 있어 방향은 맞으나, `undefined`(0이면 자동) vs `null` 처리 기준이 불명 (`src/lib/calc-engine/types.ts:CalcOptions:L89`)

---

## 6. 기타 관찰 사항

1. **`ICalcRepository` 이름 불일치**: CH09 §11에서 `ICostCalcRepository`로 명명하나 우리 구현은 `ICalcRepository`임. 기능이 일치하는 한 이름은 허용 가능하지만, 향후 C# 포팅 참조 시 혼동 소지가 있음.

2. **`CalcResult` 역할 과부하**: CH09 §8의 `PrsBillM`(청구서·식별자 포함)과 §9의 `CalcResultWage`(조제료 세분)가 모두 단일 `CalcResult`에 통합되어 있음. CH09 §13.4의 권고(`BillResult` + `CalcResultWage` + `WageItems` 분리)와 구조가 다름. 추후 Phase 3 청구서 출력 구현 시 리팩토링 필요.

3. **`MediWageM` 타입 부재**: `ICalcRepository.getSugaFeeMap()`이 `Map<string, { price: number; name: string }>`를 반환하여 딕셔너리 조회는 가능하나, CH09 §4.1의 `BuildDictionaries()` 패턴·`DueDate` 버전 관리가 없음. 다중 적용일 이력이 필요한 경우 확장 불가.

4. **`InsuranceType` 통합 Enum 미구현**: CH09 §13.4 다이어그램에서 `InsuranceType (26값, UPH 보험Types 통합)`을 Enum으로 명시하나, 현재 구현에 없음. 소스 간 변환 로직 구현 시 이 Enum이 없으면 UPH 포팅이 어려움.

5. **`PD_SUM` 자동계산**: CH09 §3.2에서 `(int)(amount * PD_PRICE + 0.5)` (원 미만 4사5입) 공식을 규정하나, 현재 `DrugItem`에 자동계산 로직 또는 readonly 속성이 없음. 호출 측에서 직접 계산하는지 확인 필요.

6. **`age: number` vs `Age: string`**: CH09 §2.3 권고에서 int 사용을 권고하나 월 단위 필요 시 string 유지도 허용함. 현재 `CalcOptions.age: number`는 권고 방향과 일치하나 6세 미만 판별에서 월 단위(예: 5세 11개월) 처리 가능 여부 확인 필요.

7. **`CalcOptions.mediIllnessB?: string` 누락 여부**: types.ts L144에는 선언되어 있으나 CH09 §2.1 #13의 `MediIllnessB`와 동일. 일치 확인됨 — 누락 없음.

---

*참조 문서: `C:\Projects\DSNode\약제비 분석용\output\CH09_데이터모델.md` (2026-04-03)*
*참조 구현: `src/lib/calc-engine/types.ts` (284줄, 2026-04-06 분석 기준)*
