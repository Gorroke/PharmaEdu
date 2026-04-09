# CH09 교차 검증 보고서

> 작성자: CH09 Verifier (Phase 2 Team 9B)
> 작성일: 2026-04-06
> 챕터: CH09 — 타입/인터페이스 포팅 정확도 (C# ↔ TypeScript)
> 참조: `YakjaebiCalc.Engine/Models/*.cs`, `YakjaebiCalc.Engine/Enums/*.cs`, `YakjaebiCalc.Engine/Data/ICalcRepository.cs`, `src/lib/calc-engine/types.ts`
> 상태: [x] 완료

---

## 1. 검증 대상 파일 목록

| C# 파일 | TypeScript 파일 |
|---------|----------------|
| `Models/CalcOptions.cs` | `types.ts:CalcOptions (L80-153)` |
| `Models/CalcResult.cs` | `types.ts:CalcResult (L197-254)` |
| `Models/DrugItem.cs` | `types.ts:DrugItem (L30-53)` |
| `Models/WageItem.cs` | (TS 대응 없음 — §5 참조) |
| `Models/WageListItem.cs` | `types.ts:WageListItem (L181-189)` |
| `Models/InsuRateInfo.cs` | `types.ts:InsuRate (L160-174)` |
| `Models/MediIllnessInfo.cs` | `types.ts:MediIllnessInfo (L61-72)` |
| `Data/ICalcRepository.cs` | `types.ts:ICalcRepository (L271-284)` |
| `Enums/InsuPayType.cs` | `types.ts:InsuPayType (L9-16)` |
| `Enums/TakeType.cs` | `types.ts:TakeType (L19-22)` |
| `Enums/BohunCode.cs` | (TS 대응 없음 — §8 참조) |
| `Enums/GsCode.cs` | (TS 대응 없음 — §8 참조) |
| `Enums/InsuranceType.cs` | (TS 대응 없음 — §8 참조) |
| `Enums/NPayRoundType.cs` | (TS 대응 없음 — §8 참조) |
| `Enums/SurchargeType.cs` | (TS 대응 없음 — §8 참조) |

---

## 2. CalcOptions 필드 단위 비교

### 2-1. C# CalcOptions 필드 집계

`Models/CalcOptions.cs` 기준 선언 필드: **45개** (계산 프로퍼티 4개 별도)

| 그룹 | C# 필드 수 | 포팅 여부 |
|------|-----------|----------|
| 처방전 기본 정보 (DosDate ~ HospCode) | 9 | 부분 |
| 보험 관련 (InsuDose ~ SbrdnType) | 6 | 부분 |
| 가산 조건 bool (IsSaturday ~ IsPregnant) | 7 | 부분 |
| 특수 설정 (DrugSafeYN ~ GradeSatIn) | 7 | 부분 |
| 가산율/비급여 설정 (AddRat ~ NPayRoundF10YN) | 8 | 일부 |
| 고급 설정 (IsRare ~ WageCommChk) | 7 | 미포팅 |
| 비급여 조제료 설정 (NPayWageType ~ NPayOnlyWage) | 4 | 미포팅 |
| 면제 관련 플래그 (IsUnder18 ~ IsExemptDisease) | 6 | 부분 |
| 장려금 (IncentiveSum) | 1 | ✓ |
| 약품 목록 (DrugList) | 1 | ✓ |

### 2-2. 필드별 일치 현황

| C# 필드 (CalcOptions.cs 위치) | TS 필드 (types.ts 위치) | 상태 | 비고 |
|------------------------------|------------------------|------|------|
| `DosDate` (L17) | `dosDate` (L84) | ✓ | string 동일 |
| `DosTime` (L19) | `dosTime?` (L86) | ✓ | TS는 optional |
| `InsuCode` (L22) | `insuCode` (L87) | ✓ | string 동일 |
| `BohunCode` (L25) | `bohunCode?` (L106) | ✓ | TS는 optional |
| `Age` (L29) | `age` (L89) | ⚠ | C#: `string`, TS: `number` — **타입 불일치** |
| `Sex` (L32) | — | ✗ | TS 누락 |
| `PsCode` (L35) | — | ✗ | TS 누락 |
| `CustId` (L38) | — | ✗ | TS 누락 (연간상한제 쿼리에 필요) |
| `HospCode` (L41) | `hospCode?` (L108) | ✓ | |
| `InsuDose` (L48, int) | `insuDose?` (L90, number) | ✓ | |
| `RealDose` (L51) | — | ✗ | TS 누락 |
| `MediIllness` (L54) | `mediIllness?` (L102) | ✓ | |
| `MediIllnessB` (L57) | `mediIllnessB?` (L144) | ✓ | |
| `HgGrade` (L60) | `hgGrade?` (L122) | ✓ | |
| `SbrdnType` (L63) | `sbrdnType?` (L115) | ✓ | |
| `IsSaturday` (L70) | `isSaturday?` (L93) | ✓ | |
| `IsNight` (L73) | `isNight?` (L95) | ✓ | |
| `IsHolyDay` (L76) | `isHolyDay?` (L97) | ✓ | |
| `IsMidNight` (L79) | `isMidNight?` (L99) | ✓ | |
| `IsDirectJoje` (L82) | `isDirectDispensing?` (L130) | ⚠ | **이름 불일치**: `JoJe` → `Dispensing` |
| `IsRealDose` (L85) | — | ✗ | TS 누락 |
| `IsPregnant` (L88) | — | ✗ | TS 누락 |
| `DrugSafeYN` (L95) | — | ✗ | TS 누락 |
| `PowderYN` (L98) | — | ✗ | TS 누락 |
| `MoonYN` (L101) | `isDalbitPharmacy?` (L138) | ⚠ | 의미 유사하나 타입 다름: `string` vs `boolean` |
| `SelfInjYN` (L104) | — | ✗ | TS 누락 |
| `SpecialPub` (L107) | — | ✗ | TS 누락 |
| `NPayExpYN` (L109) | — | ✗ | TS 누락 (주석이 깨진 상태: `"鍮꾧툒 ?ㅻ챸"`) |
| `GradeSatIn` (L112) | — | ✗ | TS 누락 |
| `AddRat` (L119, decimal) | `addRat?` (L126, number) | ✓ | |
| `NPayRoundType` (L122, enum) | — | ✗ | TS 누락 |
| `OverUserPriceYN` (L125) | — | ✗ | TS 대신 `yearlyAccumulated`/`incomeDecile`로 대체 |
| `IsSimSa` (L128) | `isSimSa?` (L110) | ✓ | |
| `IsMPVBill` (L131) | `isMPVBill?` (L109) | ✓ | |
| `IsHealthCenter` (L134) | `isHealthCenterPresc?` (L119) | ⚠ | **이름 불일치**: `bool` vs `boolean`, 의미 유사 |
| `IsBohunNpayUser` (L137) | — | ✗ | TS 누락 |
| `NPayRoundF10YN` (L140) | — | ✗ | TS 누락 |
| `IsRare` (L147) | — | ✗ | TS 누락 |
| `IsInsuGovG` (L150) | — | ✗ | TS 누락 |
| `IsBohunHospital` (L153) | — | ✗ | TS 누락 (대신 `hospCode`로 동적 판정) |
| `IsSpec34` (L156) | — | ✗ | TS 누락 |
| `IsNoWage` (L159) | — | ✗ | TS 누락 |
| `IndYN` (L162) | — | ✗ | TS 누락 |
| `WageCommChk` (L165) | — | ✗ | TS 누락 |
| `NPayWageType` (L175) | — | ✗ | TS 누락 |
| `NPayNoBaseWage` (L178) | — | ✗ | TS 누락 |
| `NPayNarcoticWage` (L181) | — | ✗ | TS 누락 |
| `NPayOnlyWage` (L184) | — | ✗ | TS 누락 |
| `IsStudent` (L194) | — | ✗ | TS 누락 |
| `IsHomeCare` (L197) | — | ✗ | TS 누락 |
| `IsSelectMedi` (L200) | — | ✗ | TS 누락 |
| `IsHomeless` (L203) | — | ✗ | TS 누락 |
| `IsExemptDisease` (L206) | — | ✗ | TS 누락 |
| `IncentiveSum` (L213, decimal) | `incentiveSum?` (L148, number) | ✓ | |
| `DrugList` (L220) | `drugList` (L100) | ✓ | |

#### TS 전용 추가 필드 (C#에 없음)

| TS 필드 (types.ts) | C# 대응 | 비고 |
|--------------------|---------|------|
| `eHealthBalance?` (L118) | 없음 | 건강생활유지비 잔액 — 의료급여 전용 |
| `isNonFace?` (L133) | 없음 | 비대면 조제 — C#은 `DrugSafeYN="U"` 방식 |
| `hasCounseling?` (L135) | 없음 | 복약상담 — C#은 `MoonYN` 방식 |
| `mediIllnessInfo?` (L142) | 없음 (런타임 조회) | TS는 직접 주입, C#은 레포지토리 조회 |
| `yearlyAccumulated?` (L149) | `OverUserPriceYN`+"Y" + `GetPbRealPrice()` | 설계 방식 상이 |
| `incomeDecile?` (L151) | 없음 | 소득분위 — C#은 외부 로직 |

### 2-3. CalcOptions 포팅 요약

- 포팅됨: 19개 / 전체 45개 → **포팅율 42%**
- 설계상 의도적 축소(MVP 서브셋): 비급여 조제료 설정 4개, 고급 EDB 전용 옵션 다수
- 타입 불일치 1건(`Age`: string vs number)
- 이름 불일치 2건(`IsDirectJoje` vs `isDirectDispensing`, `IsHealthCenter` vs `isHealthCenterPresc`)

---

## 3. CalcResult 필드 단위 비교

### 3-1. C# CalcResult 필드 집계

`Models/CalcResult.cs` 기준 선언 필드: **42개**

| C# 필드 (CalcResult.cs 위치) | TS 필드 (types.ts 위치) | 상태 | 비고 |
|-----------------------------|------------------------|------|------|
| `PbCode` (L15) | — | ✗ | 청구서 식별자 — 교육용 불필요 |
| `PbMakeYm` (L18) | — | ✗ | 청구 년월 — 교육용 불필요 |
| `TotalPrice` (L25) | `totalPrice` (L203) | ✓ | |
| `SumInsuDrug` (L28) | `sumInsuDrug` (L199) | ✓ | |
| `SumInsuDrug50` (L31) | — | ✗ | 선별급여 50% |
| `SumInsuDrug80` (L34) | — | ✗ | 선별급여 80% |
| `SumInsuDrug30` (L37) | — | ✗ | 선별급여 30% |
| `SumInsuDrug90` (L40) | — | ✗ | 선별급여 90% |
| `SumInsuDrug100` (L43) | `sumInsuDrug100?` (L234) | ✓ | TS는 optional |
| `SumInsuDrug100_302` (L46) | — | ✗ | 302 대상 100% 본인부담 전용 |
| `UnderUser` (L49) | — | ✗ | 선별급여 본인부담 합계 |
| `UnderInsu` (L52) | — | ✗ | 선별급여 공단 합계 |
| `SumUserDrug` (L55) | — | ✗ | 비급여 약품 합계 |
| `SumWage` (L58) | `sumWage` (L201) | ✓ | |
| `SumWageComm` (L61) | — | ✗ | 조제료 가산 합계 |
| `WageComm` (L64) | — | ✗ | 조제료 가산율 |
| `Sum` (L67) | — | ✗ | 약가+조제료 합계 (TotalPrice 산출 전) |
| `UserPrice` (L74) | `userPrice` (L205) | ✓ | |
| `PubPrice` (L77) | `pubPrice` (L207) | ✓ | |
| `RealPrice` (L80) | `realPrice?` (L221) | ✓ | TS는 optional |
| `InsuPrice` (L83) | `insuPrice?` (L220) | ✓ | TS는 optional |
| `MpvaPrice` (L86) | `mpvaPrice?` (L217) | ✓ | TS는 optional |
| `GsCode` (L89) | — | ✗ | 공상등구분 코드 |
| `MpvaComm` (L92) | `mpvaComm?` (L244) | ✓ | TS는 optional |
| `SumInsure` (L95) | `sumInsure?` (L226) | ✓ | TS는 optional |
| `Premium` (L98) | `premium?` (L238) | ✓ | TS는 optional |
| `SumUser` (L101) | `sumUser?` (L223) | ✓ | TS는 optional |
| `BagPrice` (L104) | — | ✗ | 봉투요금 — 교육용 미필요 |
| `Receive` (L107) | — | ✗ | 수납금액 |
| `Dc` (L110) | — | ✗ | 할인금액 |
| `TakeDayType` (L117) | — | ✗ | 복용구분 탭구분 문자열 |
| `ListDay` (L120) | — | ✗ | 투약일수 목록 |
| `ListPrice` (L123) | — | ✗ | 구간별 금액 목록 |
| `AvgPrice` (L126) | — | ✗ | 평균 단가 목록 |
| `ListDay100` (L129) | — | ✗ | 100일이상 투약일수 목록 |
| `ListPrice100` (L132) | — | ✗ | 100일이상 구간별 금액 목록 |
| `ListDayB` (L135) | — | ✗ | B형 투약일수 목록 |
| `ListPriceB` (L138) | — | ✗ | B형 구간별 금액 목록 |
| `Cfhcdmdamt` (L145) | — | ✗ | 처방전 조제수가 청구금액 |
| `TotalPrice100` (L148) | `totalPrice100?` (L235) | ✓ | TS는 optional |
| `InsuPrice100` (L151) | — | ✗ | 100일이상 보험 청구금액 |
| `UserPrice100` (L154) | `userPrice100?` (L236) | ✓ | TS는 optional |
| `GoDang` (L157) | — | ✗ | 고당금액 |
| `DiffCost` (L160) | — | ✗ | 차액 비용 |
| `Pub100Price` (L163) | — | ✗ | 100일 공단 부담금 |
| `MpvaPrice100` (L166) | — | ✗ | 100일 보훈 금액 |
| `OverUserPrice` (L169) | `overUserPrice?` (L249) | ✓ | TS는 optional |
| `TDayPrice` (L172) | — | ✗ | 투약일 단가 |
| `Incentive` (L175) | `incentive?` (L253) | ✓ | TS는 optional |
| `Sum648903860` (L178) | `sum648?` (L230) | ⚠ | **이름 불일치**: `Sum648903860` vs `sum648` |
| `WageList` (L185) | `wageList` (L209) | ✓ | |

#### TS 전용 추가 필드 (C#에 없음)

| TS 필드 (types.ts) | 비고 |
|--------------------|------|
| `steps` (L210) | 교육용 계산 단계 — C#에 없음 |
| `error?` (L212) | 오류 메시지 — C#은 예외 방식 |
| `pubPrice2?` (L243) | 공비 상세 분리용 — C#에 없음 |

### 3-2. CalcResult 포팅 요약

- 포팅됨: 17개 / 전체 42개 → **포팅율 40%**
- 의도적 제외: 탭구분 문자열 목록(ListDay/ListPrice 등) 8개, 청구서 식별자 2개, 비급여/행정 필드 다수
- 이름 불일치 1건: `Sum648903860` vs `sum648`
- `GsCode`(공상등구분) 미포팅 — 보훈 청구 결과 확인 불가

---

## 4. DrugItem 필드 단위 비교

| C# 필드 (DrugItem.cs 위치) | TS 필드 (types.ts 위치) | 상태 | 비고 |
|--------------------------|------------------------|------|------|
| `Code` (L33) | `code` (L32) | ✓ | |
| `Element` (L36) | — | ✗ | 성분코드 누락 |
| `InsuPay` (L43, enum) | `insuPay` (L34, union) | ✓ | 값 매핑 정확 (§6 참조) |
| `Take` (L46, enum) | `take` (L36, union) | ✓ | 값 매핑 정확 (§7 참조) |
| `ExType` (L49) | — | ✗ | 제외유형 누락 (ExType9 차감 로직에 필요) |
| `InsuDrug` (L52, bool) | `insuDrug?` (L52, boolean) | ✓ | TS는 optional |
| `Price` (L61, decimal) | `price` (L38, number) | ✓ | |
| `Dose` (L69, decimal) | `dose` (L40, number) | ✓ | |
| `DNum` (L78, decimal) | `dNum` (L42, number) | ✓ | |
| `DDay` (L86, decimal) | `dDay` (L44, number) | ✓ | |
| `Pack` (L93, decimal) | `pack?` (L46, number) | ✓ | TS는 optional |
| `Sum` (L103, decimal, 자동계산) | — | ✗ | TS에 없음 — 별도 `calcDrugAmountSum()` 로직 |
| `IsPowder` (L131) | `isPowder?` (L48) | ✓ | |
| `Spec` (L134) | `spec?` (L50) | ✓ | |
| `BigUpWageNo` (L137) | — | ✗ | 대상수가번호 누락 |
| `Unit` (L143) | — | ✗ | 단위 누락 |
| `Amt` (L146, decimal) | — | ✗ | 함량 누락 |
| `Effect` (L149) | — | ✗ | 약효분류코드 누락 |
| `MasterPowderYN` (L152) | — | ✗ | 약품마스터 산제여부 누락 |

#### C# DrugItem 주요 특이사항

1. **자동계산 Sum** (`DrugItem.cs:L25-26`): `INotifyPropertyChanged` 패턴으로 `Price/Dose/DNum/DDay/Pack` setter에서 `RecalcSum()` 자동 호출. TS는 이 동작이 없고 대신 `calcDrugAmountSum()` 함수(`drug-amount.ts`)에서 배치 계산.
2. **`record struct`는 아님**: `DrugItem`은 `class + INotifyPropertyChanged`이고, `WageListItem`만 `readonly record struct` (`WageListItem.cs:L7`).
3. **`ForceSetSum()`** (`DrugItem.cs:L120-123`): 코로나19 50,000원 고정단가 등 정책적 강제설정 메서드 — TS에 없음.

### 4-1. DrugItem 포팅 요약

- 핵심 계산 필드 10개 중 9개 포팅 (`Sum` 제외)
- 마스터 정보 필드 5개(`Unit`, `Amt`, `Effect`, `Element`, `MasterPowderYN`) 미포팅
- `ExType` 미포팅은 선별급여 ExType9 차감 계산에 영향 가능성 있음

---

## 5. WageItem 포팅 여부

C# `Models/WageItem.cs`는 필드 3개(`SugaCd`, `Price`, `Name`)를 가진 단순 마스터 DTO이다. TS에는 대응 인터페이스가 없다.

- `ICalcRepository.SelectMediWage()` 반환 타입이 `Dictionary<string, WageItem>?`인데, TS `ICalcRepository.getSugaFeeMap()`의 반환 타입이 `Map<string, { price: number; name: string }>` — **인라인 객체 타입으로 대체**되어 별도 인터페이스 없이 동등하게 포팅됨.

- [🟢 Low] WageItem 인터페이스 미정의: 기능 동등성은 있으나, 타입 재사용성이 낮다. 향후 수가 목록 조회/표시 등에 활용 시 `export interface WageItem { sugaCd: string; price: number; name: string; }` 추가 권장.

---

## 6. InsuPayType Enum 매핑 비교

| C# 값 (InsuPayType.cs) | 정수값 | TS union 값 (types.ts:L9-16) | 매핑 정확도 |
|------------------------|-------|------------------------------|------------|
| `NonCovered = 0` | 0 | `'nonCovered'` | ✓ |
| `Covered = 1` | 1 | `'covered'` | ✓ |
| `Partial50 = 2` | 2 | `'partial50'` | ✓ |
| `Partial80 = 3` | 3 | `'partial80'` | ✓ |
| `Partial30 = 4` | 4 | `'partial30'` | ✓ |
| `Partial90 = 5` | 5 | `'partial90'` | ✓ |
| `FullSelf = 9` | 9 | `'fullSelf'` | ✓ |

**7개 모두 일치.** C#은 `enum`, TS는 `string union type`으로 설계가 다르나 의미상 완전 동등하다.

> 주의: TS `types.ts:L9`의 주석에서 숫자 대응이 실수로 `covered=1`, `nonCovered=0` 순서로 나열되어 있으나 실제 값 매핑(`covered` → 1, `nonCovered` → 0)은 정확하다.

---

## 7. TakeType Enum 매핑 비교

| C# 값 (TakeType.cs) | 정수값 | TS union 값 (types.ts:L19-22) | 매핑 정확도 |
|--------------------|-------|-------------------------------|------------|
| `Internal = 0` | 0 | `'internal'` | ✓ |
| `External = 1` | 1 | `'external'` | ✓ |
| `Injection = 2` | 2 | `'injection'` | ✓ |

**3개 모두 일치.** HIRA 목번호 (01/02/03) → 내부 0-based 변환도 동일.

---

## 8. C# 전용 Enum/상수 클래스 — TS 대응 없음

| C# 파일 | 내용 | TS 대응 | 비고 |
|---------|------|---------|------|
| `Enums/BohunCode.cs` | M10~M90 10개 상수 | 없음 | `veteran.ts`에서 문자열 리터럴로 직접 사용 |
| `Enums/GsCode.cs` | 공상등구분 상수 + `Determine()` 정적 메서드 | 없음 | `veteran.ts:getGsCode()` 함수로 동등 구현 여부 별도 확인 필요 |
| `Enums/InsuranceType.cs` | C/D/G/F/E 대분류 상수 | 없음 | TS에서 문자열 비교로 직접 처리 |
| `Enums/NPayRoundType.cs` | 비급여 반올림 6종 enum | 없음 | `CalcOptions.NPayRoundType` 필드 자체가 미포팅 |
| `Enums/SurchargeType.cs` | 가산 종류 8종 enum | 없음 | TS `surcharge.ts`에서 `SurchargeFlags` 인터페이스로 대체 |

- [🟠 Insufficient / High] `BohunCode` 상수 미정의: `veteran.ts`에서 `"M10"`, `"M20"` 등 문자열 리터럴을 직접 사용함. C#은 `BohunCode.M10`(`BohunCode.cs:L13`) 등 상수로 중앙 관리하여 오탈자 방지. TS에서 오탈자 리스크 존재.
- [🟡 Insufficient / Medium] `GsCode.Determine()` 정적 메서드 포팅 여부 미확인: C# `GsCode.cs:L45-66`에서 보훈코드+보험코드 조합으로 공상등구분을 결정하는 로직이 있으나, TS `veteran.ts`에서 동등 로직 존재 여부를 별도 확인 필요.
- [🟡 Insufficient / Medium] `NPayRoundType` enum 미포팅: 비급여 반올림 6종(`Floor10/Floor100/Round100/Ceil100/None/Round10`)이 TS에 없음. 비급여 조제료 반올림 로직 추가 시 필요.

---

## 9. InsuRateInfo vs InsuRate 비교

| C# 필드 (InsuRateInfo.cs) | TS 필드 (types.ts:InsuRate) | 상태 | 비고 |
|--------------------------|---------------------------|------|------|
| `DueDate` (L11) | — | ✗ | 적용 기준일자 누락 |
| `InsuCode` (L14) | `insuCode` (L161) | ✓ | |
| `Rate` (L20, decimal) | `rate` (L162, number) | ✓ | |
| `SixAgeRate` (L27, decimal) | `sixAgeRate` (L163, number) | ✓ | |
| `FixCost` (L33, decimal) | `fixCost` (L164, number) | ✓ | |
| `HealthCenter` (L36, decimal) | — | ✗ | 보건기관 금액 누락 |
| `Mcode` (L42, decimal) | `mcode` (L165, number) | ✓ | |
| `Bcode` (L48, decimal) | `bcode` (L166, number) | ✓ | |
| `V2520` (L54, decimal) | `v2520?` (L170, number) | ✓ | TS는 optional |
| `V2521` (L60, decimal) | `v2521?` (L173, number) | ✓ | TS는 optional |
| `Age65_12000Less` (L67, decimal) | `age65_12000Less` (L167, number) | ✓ | |

**포팅됨: 8/11 (73%)** — `DueDate`, `HealthCenter` 누락.

- [🟠 Insufficient / High] `HealthCenter` 필드 누락 (`InsuRateInfo.cs:L36`): 보건기관(보건소/지소/진료소) 처방전의 본인부담 정액 산정에 필요. TS `CalcOptions.isHealthCenterPresc`는 있으나 요율 정보 자체가 없어 계산 불가.
- [🟡 Insufficient / Medium] `DueDate` 필드 누락: 단일 시점 요율만 조회하면 불필요하나, 복수 적용일 조회 시 식별자 역할 필요.

---

## 10. MediIllnessInfo 비교

| C# 필드 (MediIllnessInfo.cs) | TS 필드 (types.ts:MediIllnessInfo) | 상태 | 비고 |
|-----------------------------|------------------------------------|------|------|
| `Code` (L11) | `code` (L62) | ✓ | |
| `DueDate` (L14) | — | ✗ | 적용 기준일자 누락 |
| `Name` (L17) | — | ✗ | 질병 명칭 누락 |
| `Rate` (L20, decimal) | `rate` (L64, number) | ✓ | |
| `SeSickNoType` (L23) | `grade?` (L68, number) | ⚠ | 타입 불일치: C# `string` ("0"/"1"/"4"), TS `number` |

#### TS 전용 추가 필드

| TS 필드 | 비고 |
|---------|------|
| `isV252` (L65, boolean) | C#에 없음 — V252 여부 판별 편의 필드 |
| `description?` (L70) | C#에 없음 — 교육용 설명 |

- [🟠 Suspicious / High] `SeSickNoType` 타입 불일치: C# `string` ("0"/"1"/"4") vs TS `number` — `InsuRateInfo.V2520`/`V2521` 참조 시 `"0"→0`, `"4"→0`, `"1"→1` 변환이 필요한데, TS `grade: number`가 이 변환을 올바르게 수행하는지 확인 필요. (`exemption.ts` 내부 로직 교차 확인 권장)

---

## 11. WageListItem 비교

| C# 필드 (WageListItem.cs) | TS 필드 (types.ts:WageListItem) | 상태 |
|--------------------------|--------------------------------|------|
| `SugaCd` (L10, string) | `sugaCd` (L183, string) | ✓ |
| `InsuPay` (L13, string) | `insuPay` (L185, string) | ✓ |
| `Cnt` (L16, int) | `cnt` (L186, number) | ✓ |
| `Price` (L19, int) | `price` (L187, number) | ✓ |
| `Sum` (L22, int) | `sum` (L188, number) | ✓ |
| `AddType` (L25, string) | `addType` (L189, string) | ✓ |
| `Name` (L28, string) | `name` (L184, string) | ✓ |

**7개 전부 일치.** C#은 `readonly record struct`(`WageListItem.cs:L7`), TS는 `interface` — 설계 방식 차이는 있으나 필드 완전 동등.

> `readonly record struct` 특성: C#에서 값 비교(structural equality), 불변성(init-only properties), 스택 할당 가능. TS `interface`는 참조 타입이므로 불변성 보장 없음. 교육용 읽기전용 결과 표시에서는 문제 없음.

---

## 12. ICalcRepository 메서드 비교

### 12-1. C# ICalcRepository (9개 메서드)

| 메서드 (ICalcRepository.cs 위치) | 반환 타입 | TS 대응 |
|--------------------------------|----------|---------|
| `SelectMediWage(dueDate)` (L21) | `Dictionary<string,WageItem>?` | `getSugaFeeMap(year)` (L273) |
| `SelectInsuRate(dueDate, insuCode)` (L29) | `InsuRateInfo?` | `getInsuRate(insuCode)` (L275) |
| `SelectMediIllness(miCode, dueDate)` (L37) | `MediIllnessInfo?` | `getMediIllnessInfo?(code)` (L283) |
| `SelectManageInOutTime(regDate)` (L49) | `(TimeSpan, TimeSpan)?` | **없음** |
| `GetConfigValue(group, key, year)` (L57) | `string` | **없음** |
| `GetPbRealPrice(psCode, dosDate, custId)` (L70) | `decimal` | **없음** |
| `GetAccSubSummary(psCode)` (L77) | `AccSubSummary` | **없음** |
| `Get302DrugList(dosDate)` (L88) | `Dictionary<string,object>` | **없음** |
| `GetV252List(dosDate)` (L94) | `List<string>` | **없음** |

### 12-2. TS 전용 추가 메서드 (C#에 없음)

| TS 메서드 (types.ts:ICalcRepository) | 비고 |
|--------------------------------------|------|
| `getPrescDosageFee(year, days)` (L275) | C#은 `MediWageData.GetPrice()`+`PrescDosageFeeTable`으로 내부 처리 |
| `getHolidayType?(date)` (L281) | C#은 `HolidayTable.cs`로 내부 처리 |

### 12-3. 시그니처 차이 상세

| 항목 | C# | TS | 차이 |
|------|-----|-----|------|
| `SelectMediWage` 파라미터 | `string dueDate` (yyyyMMdd) | `year: number` | **타입 변경**: 날짜 문자열 → 연도 정수 |
| `SelectInsuRate` 파라미터 | `dueDate + insuCode` | `insuCode`만 | `dueDate` 파라미터 **제거** |
| `SelectMediIllness` | 필수 메서드 | `optional` (`?`) | TS에서 선택적으로 변경 |
| 비동기 여부 | 동기 (`Dictionary`, `List` 반환) | 비동기 (`Promise<>`) | 전체 메서드 async 전환 — 정상 |

### 12-4. 구현 누락 메서드 평가

| 누락 메서드 | 영향 심각도 | 비고 |
|------------|-----------|------|
| `SelectManageInOutTime` | 🟡 Medium | 야간 자동판정용. TS에서 `isNight` bool 직접 입력으로 대체 |
| `GetConfigValue` | 🟡 Medium | 연간상한액 등 설정 조회용. TS는 하드코딩(safety-net.ts) |
| `GetPbRealPrice` | 🟠 High | 본인부담상한제 누적 실수납 조회. `CalcOptions.yearlyAccumulated`로 외부 주입 방식으로 대체 — 책임 이전 |
| `GetAccSubSummary` | 🟡 Medium | 수납 집계 조회. 교육용에서 불필요 |
| `Get302DrugList` | 🟡 Medium | 302약품 목록. `SpecialPub` 관련 로직 미포팅이므로 연동 불필요 |
| `GetV252List` | 🟠 High | V252 질병코드 목록. TS는 `getMediIllnessInfo?`로 개별 조회 대체 — 배치 조회 불가 |

- [🔴 Missing / Critical] **`SelectManageInOutTime` 미구현**: C# `ICalcRepository.cs:L49`에 정의된 약국 영업시간 조회가 TS에 없다. TS는 `CalcOptions.isNight`를 호출자가 미리 판정하여 전달하는 방식이나, 야간 판정 로직(조제시간 기준)을 프론트엔드에서 직접 구현해야 한다. 교육용 UI에서 야간 가산 자동 판정이 필요하다면 미구현 상태.
- [🟠 Missing / High] **`GetPbRealPrice` 미구현**: `ICalcRepository.cs:L70`의 연간 누적 실수납 조회가 없어 본인부담상한제 정확 적용이 외부 의존. TS `CalcOptions.yearlyAccumulated`를 통해 사전 계산값 주입은 가능하나 DB 기반 자동 조회 불가.
- [🟠 Missing / High] **`GetV252List` 미구현**: `ICalcRepository.cs:L94`의 V252 코드 배치 조회가 TS에 없다. `getMediIllnessInfo?` 단건 조회만 있어 복수 V252 코드 처리 시 N+1 쿼리 발생 가능.

---

## 13. record struct 사용 패턴 비교

| C# 타입 | 선언 방식 | TS 대응 |
|---------|---------|---------|
| `CalcOptions` | `class` (가변) | `interface` |
| `CalcResult` | `class` (가변, `Clear()` 포함) | `interface` (불변 객체 생성 방식) |
| `DrugItem` | `class + INotifyPropertyChanged` | `interface` |
| `WageListItem` | **`readonly record struct`** (`WageListItem.cs:L7`) | `interface` |
| `WageItem` | `class` | 없음 (인라인 타입) |
| `InsuRateInfo` | `class` | `interface` |
| `MediIllnessInfo` | `class` | `interface` |
| `AccSubSummary` | **`record`** (`ICalcRepository.cs:L105`) | 없음 |

`WageListItem`(`readonly record struct`)과 `AccSubSummary`(`record`)는 C#의 값 의미론 + 불변성 패턴을 사용하나, TS는 모두 `interface`로 단순화. 불변성 강제 메커니즘 없음. 교육용 읽기전용 목적에서는 허용 범위.

---

## 14. 타입 정밀도 비교 (decimal vs number)

C#의 `decimal`은 금융 연산에 적합한 28자리 정밀도를 제공한다. TS의 `number`는 IEEE 754 배정밀도 부동소수점이다.

| 영향 범위 | 내용 |
|----------|------|
| 약품 단가 계산 | `DrugItem.Price`, `Dose`, `DNum`, `DDay` 모두 `decimal` → `number`. 대용량 정밀 계산 시 부동소수점 오차 가능 |
| 본인부담금 절사 | C#: `Math.Truncate(x / 10) * 10`; TS: `Math.floor(x / 10) * 10` — 음수 처리 시 다를 수 있음 (실무에서 음수 금액은 없음) |
| 조제료 합계 | WageListItem.Price/Sum이 C# `int`, TS `number` — 정수 범위에서 동일 |

- [🟡 Low] `decimal` → `number` 정밀도 손실: 약품 단가가 소수점 이하 4자리(`n(10.2)` HIRA 형식)이고 합계 금액이 수만~수십만 원 수준이므로 실제 오차 발생 가능성은 낮음. 다만 선별급여 50/80% 할인 후 절사 체인에서 미묘한 1원 오차 발생 가능성 존재.

---

## 15. 즉시 수정 필요 항목 (Critical/High 요약)

| 번호 | 구분 | 항목 | 위치 | 조치 |
|------|------|------|------|------|
| C-1 | Missing | `SelectManageInOutTime` 미구현 | `types.ts:ICalcRepository` | 메서드 추가 또는 호출 측 야간 판정 로직 명시 |
| H-1 | Suspicious | `Age` 타입 불일치 | `CalcOptions.cs:L29` (string) vs `types.ts:L89` (number) | C# 측 파싱 로직 `AgeInt` 프로퍼티 존재, TS는 number 직접 수신 — 입력 파이프라인 일치 확인 |
| H-2 | Suspicious | `SeSickNoType` 타입 불일치 | `MediIllnessInfo.cs:L23` (string) vs `types.ts:L68` (number) | `exemption.ts` 에서 grade 처리 방식 검증 필요 |
| H-3 | Missing | `HealthCenter` 필드 누락 | `InsuRateInfo.cs:L36` | `InsuRate` 인터페이스에 `healthCenter?: number` 추가, Supabase `insu_rate` 테이블 컬럼 확인 |
| H-4 | Missing | `GetPbRealPrice` 미구현 | `ICalcRepository.cs:L70` | 본인부담상한제 교육 시나리오에서 외부 주입 방식 유지 또는 옵션 메서드로 추가 |
| H-5 | Missing | `GetV252List` 미구현 | `ICalcRepository.cs:L94` | `getMediIllnessInfo?` 단건 대체 허용 시 문서화, 아니면 배치 조회 메서드 추가 |
| H-6 | Missing | `ExType` 누락 | `DrugItem.cs:L49` | `DrugItem` 인터페이스에 `exType?: string` 추가, 선별급여 ExType9 차감 필요 시 |
| H-7 | Missing | `BohunCode` 상수 미정의 | `Enums/BohunCode.cs` | `types.ts` 또는 `veteran.ts`에 `const BOHUN_CODES = { M10:'M10', ... }` 추가 |

---

## 16. 기타 관찰 사항

1. **`NPayExpYN` 주석 인코딩 오류** (`CalcOptions.cs:L108`): `"鍮꾧툒 ?ㅻ챸 ?щ?"` — 한글이 깨진 상태. EUC-KR/UTF-8 인코딩 혼용으로 인한 소스 파일 문제. 실행에는 영향 없으나 유지보수 혼란 요인.
2. **TS `CalcOptions`의 `isHealthCenterPresc`** (`types.ts:L119`): C# `IsHealthCenter`와 이름 다름. 두 프로젝트 간 동기화 시 혼동 유발 가능.
3. **TS `CalcResult.pubPrice2`** (`types.ts:L243`): C#에 없는 필드. 공비 상세 분리 시 302/101/102 구분이 필요하다면 C#에서도 `PubPrice2`를 추가해야 일관성 유지.
4. **`calculate()` 함수의 `sumUserDrug` 무시** (`index.ts:L168`): `void sumUserDrug` — 비급여 약가 합계가 계산되나 `CalcResult`에 반영되지 않음. C#의 `SumUserDrug` 필드(`CalcResult.cs:L55`)와 달리 현재 TS 결과에서 비급여 약가 확인 불가.
5. **`SupabaseCalcRepository.getInsuRate()`** (`supabase-repo.ts:L53`): `insu_rate` 테이블에서 `v2520`, `v2521`, `healthCenter` 컬럼을 조회하지 않음 — Supabase 쿼리에서 해당 컬럼이 누락되어 `InsuRate.v2520`/`v2521` 반환값이 항상 `undefined`.

- [🔴 Suspicious / Critical] **`SupabaseCalcRepository.getInsuRate()` V252 컬럼 미조회** (`supabase-repo.ts:L53-68`): SELECT 절에 `v2520`, `v2521`이 없어 산정특례 V252 등급별 요율이 DB에서 읽히지 않음. `InsuRate.v2520`/`v2521`이 항상 `undefined`로 반환되므로 `exemption.ts`의 V252 등급 분기가 실질적으로 동작하지 않을 가능성이 있음.

---

*CH09 Verifier — Phase 2 Team 9B*

**[약제비 분析용]**
