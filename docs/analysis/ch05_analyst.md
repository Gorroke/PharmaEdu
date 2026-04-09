# CH05 구현 분석 보고서

> 작성자: CH05 Analyst (Phase 2 Team 5A)
> 작성일: 2026-04-06
> 챕터: CH05 — 보험유형별 본인부담금
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 보험유형별 본인부담금
- **핵심 주제**: 약국 처방조제 약제비의 본인부담금은 보험유형(건강보험 C / 의료급여 D / 보훈 G / 자동차보험 F / 산재 E)에 따라 산출 방식이 완전히 다르다. 총약제비(10원 미만 절사)를 기준으로, 보험유형·나이·특정기호·수급권자유형 등을 조합하여 최종 본인일부부담금을 결정한다.
- **다루는 계산 로직 범위**:
  - 총약제비(요양급여비용총액1) = trunc10(약가+조제료)
  - 건강보험(C): 일반 30%, 65세 이상 3구간(정액/20%/30%), 6세미만 21%, 차상위(C31/C32), 산정특례(V252 계열·중증·희귀), 공상(C21)
  - 의료급여(D): 1종 Mcode·Bcode 정액, 2종 FixCost, B014 30% 정률, B030 면제, V103 면제, 5등급 면제, 건강생활유지비 차감
  - 보훈(G): M10~M90 감면율, M20/M61 이중감면, M81~M83 보훈병원, 3자배분(UserPrice/MpvaPrice/InsuPrice)
  - 자동차보험(F): 100% 환자 부담 + 할증(addRat)
  - 산재(E): 0% (전액 공단 부담)
  - U항(100/100 본인부담), 선별급여(A/B/D/E항) 독립 계산
  - 절사 규칙 총괄 (보험유형별)
  - 관련 법령: 국민건강보험법 시행령 별표2, 의료급여법 시행령 별표1, 국가보훈부 보훈보상대상자 지원에 관한 법률, 건강보험 산정특례 기준 고시

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/copayment.ts` | 237줄 | `calcCopayment()`, `_determineEffectiveRate()`, `_resultToCopay()` | CH05 메인 진입점 |
| `src/lib/calc-engine/modules/insurance/veteran.ts` | 425줄 | `calcVeteran()`, `getBohunRate()`, `getDoubleReductionRate()`, `isBohunHospital()`, `calcMpvaPrice()`(내부) | CH05 §5, CH06 §5~6 |
| `src/lib/calc-engine/modules/insurance/medical-aid.ts` | 305줄 | `calcMedicalAid()`, `resolveMedicalAidFixAmount()`, `applySbrdnTypeModifier()` | CH05 §4 |
| `src/lib/calc-engine/modules/insurance/auto-insurance.ts` | 99줄 | `calcAutoInsurance()` | CH05 §6 |
| `src/lib/calc-engine/modules/insurance/workers-comp.ts` | 91줄 | `calcWorkersComp()` | CH05 §7 |
| `src/lib/calc-engine/modules/special/exemption.ts` | 272줄 | `determineExemptionRate()`, `determineV252RateByGrade()`, `isV252Series()`, `inferExemptionRate()` | CH05 §3.5 |

### 미구현 영역

- `차상위 2종(C32) f028 자립청소년 14% 정률` — 챕터 CH05 §12.2(1). copayment.ts의 C계열 분기에 f028 특정기호 처리 없음.
- `차상위 2종(C32) V252/V352/V452 경증질환 3% (trunc100, 최소 500원)` — 챕터 CH05 §12.2(2). 건강보험 일반 V252(50%)와 차상위 2종 V252(3%)를 구분하는 분기 없음.
- `차상위 2종(C32) F코드 장애인의료비 750원 차감` — 챕터 CH05 §12.2(4). copayment.ts에 F코드 차감 로직 없음.
- `의료급여 1종 면제 7종 (18세미만, 임산부, 가정간호 등)` — 챕터 CH05 §12.4. medical-aid.ts에는 hgGrade=5/B030/V103만 처리되며, 나이·임산부·가정간호 등 면제 판정 로직 없음.
- `의료급여 V252 경증질환 3% (최소 500원, trunc10)` — 챕터 CH05 §12.1. calcMedicalAid()에 V252 경증질환 차등제 분기 없음.
- `보훈위탁 국비환자 상세 (공상등구분 4/7, MT038)` — 챕터 CH05 §12.3. veteran.ts에 MT038 분기 없음.
- `비즈팜 gSelfAmt 수납금액 절사 옵션` — 챕터 CH05 §9.3. 수납 표시 목적이므로 청구 계산에는 불필요하나, UI 레이어에도 현재 미구현.
- `선별급여(A/B/D/E항) 독립 계산` — 챕터 CH05 §8.3. `100/100미만본인부담금 = trunc10(A×50%+B×80%+D×30%+E×90%)` 처리 함수 없음.
- `U항(100/100 본인부담) 및 요양급여비용총액2 산출` — 챕터 CH05 §8.1. copayment.ts는 총액1만 처리하며 총액2(총액1+U항) 산출 없음.
- `토요가산 지원금 차감` — 챕터 CH05 §11.3. calcMedicalAid/calcCopayment 모두 토요가산 차감 없음.
- `장려금(대체조제·사용장려금) 차감 후 기준액 적용` — 챕터 CH05 §11.2. calcCopayment() 파라미터에 장려금 항목 없음. 호출자가 사전 차감 후 전달해야 하나 인터페이스에 명시되지 않음.

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 § | 요구사항 요약 | 우리 구현 위치 | 상태 | 비고 |
|--------|-------------|--------------|------|------|
| CH05 §2 | 총약제비 = trunc10(약가+조제료) | `copayment.ts:calcCopayment():L60` | ✓ | |
| CH05 §3.1 | C10 30%, trunc100 | `copayment.ts:calcCopayment():L175` | ✓ | |
| CH05 §3.2 | 65세 3구간: ≤10,000 정액1,000 / ≤12,000 20% / >12,000 30% | `copayment.ts:calcCopayment():L127-L153` | ✓ | rate.fixCost/age65_12000Less DB 의존 |
| CH05 §3.2 | 65세 총약제비 < 정액 시 총약제비 자체 적용 | `copayment.ts:calcCopayment():L129` | ✓ | `Math.min(totalPrice, fixCost)` |
| CH05 §3.3 | 6세미만 21% = 30%×70%, trunc100 | `copayment.ts:calcCopayment():L165-L172` | ✓ | |
| CH05 §3.4 | C31 차상위1종 0원 | `copayment.ts` → `rate.rate=0` 전달 전제 | ⚠ | copayment.ts 자체에 C31/C32 insuCode 분기 없음 — CalcOptions/InsuRate로 0 세팅 필요 |
| CH05 §3.4 | C32 차상위2종 처방조제 정액 500원 | `copayment.ts` → `rate.fixCost=500` + 별도 정액 분기 전제 | ⚠ | C32 정액 분기 코드 없음. 현재 trunc100(500×rate%) 로 오산출 가능 |
| CH05 §3.4(f028) | 차상위2종 f028 자립청소년 14% 정률 | — | ✗ | 미구현 |
| CH05 §3.5 | V252 50% / V352 40% / V452 30% | `exemption.ts:determineExemptionRate():L162-L173` | ✓ | v2520 DB값 우선, 없으면 고정 |
| CH05 §3.5 | V252 등급별(0등급 v2520 / 1등급 v2521) | `exemption.ts:determineV252RateByGrade():L218-L228` | ✓ | |
| CH05 §3.5 | 중증(제4조) 5% | `exemption.ts:STATIC_RATE_MAP + /^V0\d\d$/` | ✓ | |
| CH05 §3.5 | 희귀/중증난치(제5조) 10% | `exemption.ts:STATIC_RATE_MAP + /^V1\d\d$/` | ✓ | |
| CH05 §3.5 | 결핵(제5조의2) 0% | `exemption.ts:STATIC_RATE_MAP[V254]=0` | ✓ | |
| CH05 §3.5 | V252 우선순위가 산정특례 우선 | `copayment.ts:_determineEffectiveRate():L217-L233` | ✓ | effectiveCopayRate >= 0이면 65세/6세 분기보다 우선 처리 |
| CH05 §3.6 | C21 공상 0원 | `copayment.ts` → `rate.rate=0` 전달 전제 | ⚠ | insuCode C21 전용 분기 없음 |
| CH05 §4.1 | D10 Mcode 정액 | `medical-aid.ts:resolveMedicalAidFixAmount():L222-L225` | ✓ | |
| CH05 §4.1 | D20 FixCost 정액 | `medical-aid.ts:resolveMedicalAidFixAmount():L228` | ✓ | |
| CH05 §4.1 | D10 Bcode 분기 (sbrdnType 'B'로 시작) | `medical-aid.ts:resolveMedicalAidFixAmount():L217-L219` | ✓ | |
| CH05 §4.1 | 행려(D80/D90) 0원 | `medical-aid.ts:calcMedicalAid():L124-L132` | ✓ | |
| CH05 §4.1 | 보건기관 처방전 0원 | `medical-aid.ts:calcMedicalAid():L78-L86` | ✓ | |
| CH05 §4.1 | 총약제비 < 정액 시 총약제비 자체 본인부담 | `medical-aid.ts:calcMedicalAid():L155-L161` | ✓ | trunc10(totalPrice) |
| CH05 §4.2 | B014 30% 정률, trunc10 (2019.01.01~) | `medical-aid.ts:calcMedicalAid():L135-L149` | ✓ | dosDate 날짜 분기 포함 |
| CH05 §4.3 | B030 전액면제 (2022.03.22~) | `medical-aid.ts:calcMedicalAid():L102-L110` | ✓ | dosDate 날짜 분기 포함 |
| CH05 §4.4 | V103 질병코드 전액면제 | `medical-aid.ts:calcMedicalAid():L89-L98` | ✓ | mediIllness 또는 mediIllnessB 둘 다 체크 |
| CH05 §4.5 | 5등급(hgGrade=5) 전액면제 | `medical-aid.ts:calcMedicalAid():L113-L121` | ✓ | |
| CH05 §4.6 | 건강생활유지비(eHealth) 차감 — D10 1종 | `medical-aid.ts:calcMedicalAid():L175-L187` | ✓ | eHealthBalance 필드 |
| CH05 §4(12.1) | 의료급여 V252 경증질환 3% 차등제 | — | ✗ | 미구현 |
| CH05 §4(12.4) | 의료급여 1종 면제 7종 | — | ✗ | 미구현 |
| CH05 §5.1 | 보훈코드별 감면율 (M10~M90) | `veteran.ts:getBohunRate():L128-L146` | ✓ | 2018.01.01 날짜 분기 포함 |
| CH05 §5.2 | 보훈 본인부담 기본 공식 (trunc100) | `veteran.ts:calcVeteran():L328-L340` | ✓ | |
| CH05 §5.3 | M10 국비 100% 0원 | `veteran.ts:calcVeteran():L291-L293` | ✓ | |
| CH05 §5.4 | M20 이중감면 (G타입, 2018이후90%/이전80%) | `veteran.ts:calcVeteran():L300-L312` | ✓ | MpvaPrice=0, MpvaComm은 Integration Lead 처리 |
| CH05 §5.5 | M61 고엽제 역산 | `veteran.ts:calcVeteran():L314-L324` | ✓ | normalUser - userPrice = mpvaPrice |
| CH05 §5.6 | M81~M83 보훈병원 6곳 전용 처리 | `veteran.ts:calcVeteran():L362-L381`, `isBohunHospital():L189-L192` | ✓ | 비위탁 시 환자0원+mpvaPrice가산 |
| CH05 §5.7 | 비즈팜 조합기호 유무 분기 | — | — | 비즈팜 고유 로직. 우리는 insuCode(G10 등)로 판별하므로 동일 결과로 처리 가능. 비적용 |
| CH05 §5.8 | 보훈 + 65세 정액 미적용 확인 | `veteran.ts:calcVeteran()` — 65세 정액 분기 없음 | ✓ | veteran.ts는 65세 정액을 처리하지 않음 (CH05 §5.8 준수) |
| CH05 §5(12.3) | 보훈위탁 국비환자 MT038 분기 | — | ✗ | 미구현 |
| CH05 §6 | F 자동차보험 100% + trunc10 | `auto-insurance.ts:calcAutoInsurance():L56` | ✓ | |
| CH05 §6 | 자동차보험 할증(addRat) | `auto-insurance.ts:calcAutoInsurance():L61` | ✓ | round1(총액×addRat/100) |
| CH05 §7 | E 산재 0원 | `workers-comp.ts:calcWorkersComp():L62` | ✓ | E10/E20 공통 |
| CH05 §8.1 | U항 100/100 본인부담금 및 요양급여비용총액2 | — | ✗ | 미구현 |
| CH05 §8.2 | 비급여(W항) 조제료 귀속 | — | ✗ | 미구현 |
| CH05 §8.3 | 선별급여(A/B/D/E항) 독립 본인부담 trunc10 | — | ✗ | 미구현 |
| CH05 §9.1 | 절사 규칙: C=100원, D=10원, G=100원, F=10원, E=0원 | copayment.ts/각 모듈 | ✓ | 규칙 준수 (단, D 정액 처리 시 trunc10 적용 — §4.1 총약제비<정액 케이스) |
| CH05 §11.1 | 본인부담 산정 조건 판정 우선순위 | `copayment.ts:calcCopayment():L83-L114` (모듈 위임 순서) | ✓ | 보훈M코드 우선 → G → D → F → E → C |
| CH05 §11.2 | 장려금 차감 후 기준액 | `copayment.ts:calcCopayment()` 파라미터 | ⚠ | 함수 시그니처에 장려금 항목 없음. 호출자 사전 차감 전제이나 미명시 |
| CH05 §11.3 | 토요가산 지원금 차감 | — | ✗ | 미구현 |
| CH05 §12.2 | 차상위2종 f028 14%, V252 3%, F코드 장애인의료비 | — | ✗ | 미구현 |

---

## 4. 누락 항목 (Missing)

- [🔴 Critical] **선별급여 독립 본인부담 계산**: A×50%+B×80%+D×30%+E×90%를 trunc10 처리하는 함수가 없음. 선별급여 약제가 포함된 처방에서 본인부담금이 완전히 누락됨 (CH05 §8.3)
- [🔴 Critical] **U항 100/100 본인부담금 및 요양급여비용총액2 산출**: 100/100 본인부담 약제가 포함된 처방에서 요양급여비용총액2 산출 불가. 조제료 귀속 처리도 없음 (CH05 §8.1)
- [🔴 Critical] **의료급여 V252 경증질환 3% 차등제**: calcMedicalAid()에 V252 코드 분기가 없어, 의료급여 환자가 상급종합/종합병원에서 받은 처방에서 V252(3%, 최소500원)가 전혀 적용되지 않음 (CH05 §12.1)
- [🟠 High] **차상위2종(C32) C계열 본인부담 분기 미구현**: copayment.ts에 insuCode='C32' 전용 분기 없음. 현재 rate.fixCost/rate.rate 값에 완전히 의존하므로, 호출자가 잘못된 요율을 전달하면 정액 500원이 아닌 30%로 오산출됨 (CH05 §3.4)
- [🟠 High] **차상위2종 f028 자립청소년 14% 정률**: 처방전 특정기호 'f028' 처리 없음. 해당 환자 500원 대신 14%로 계산해야 함 (CH05 §12.2(1))
- [🟠 High] **보훈위탁 국비환자 MT038 분기**: 공상등구분 4/7 + MT038='2'(일부본인부담대상 전상군경) 처리 없음. 해당 환자는 타질환 조제 시 10% 본인부담인데 현재 0원으로 처리됨 (CH05 §12.3)
- [🟠 High] **의료급여 1종 면제 7종**: 18세미만, 임산부, 가정간호 등 면제 판정 로직이 calcMedicalAid()에 없음. 해당 환자는 500원 본인부담이 발생하면 안 됨 (CH05 §12.4)
- [🟠 High] **장려금 차감 인터페이스 미명시**: calcCopayment() 시그니처에 장려금 파라미터 없음. 호출자가 사전 차감한다는 계약이 코드상 보장되지 않음 (CH05 §11.2)
- [🟡 Medium] **토요가산 지원금 차감**: calcMedicalAid/calcCopayment 모두 토요가산 차감 없음 (CH05 §11.3)
- [🟡 Medium] **차상위2종 V252 경증질환 3% (최소500원, trunc100)**: copayment.ts의 C계열 V252 처리는 일반 50%만 적용되며 차상위2종의 3% 특례가 없음 (CH05 §12.2(2))
- [🟡 Medium] **차상위2종 F코드 장애인의료비 750원 차감**: 본인부담금에서 장애인의료비를 차감하는 로직 없음 (CH05 §12.2(4))
- [🟢 Low] **비급여(W항) 조제료 귀속**: 보험+비보험 혼재 시 비급여 조제료 분리 로직 없음 (CH05 §8.2)

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] **C31/C32/C21 insuCode 분기**: copayment.ts는 insuCode의 첫 글자 'C'이면 일반 C10 로직으로 처리. C31(0원), C32(정액500원), C21(공상0원)이 모두 호출자가 rate.rate=0 또는 rate.fixCost=500을 올바르게 세팅해야만 올바른 결과가 나옴. 코드 안에 insuCode 기반 명시적 분기가 없어 실수 여지가 큼 (`src/lib/calc-engine/copayment.ts:calcCopayment():L117`)
- [🟠 Insufficient / High] **산정특례 적용 우선순위와 65세 정액 충돌 케이스**: 65세이고 effectiveCopayRate >= 0인 경우, 산정특례가 65세 정액보다 우선 처리되어 trunc100(totalPrice×exemptionRate%)가 적용됨. 그런데 65세+V252(30%)면 9,800원에 대해 정액 1,000원이 유리한데 산정특례 30%가 적용되어 2,900원이 됨. CH05 §11.1 우선순위 상 산정특례 > 65세 정액이 맞는지 재검토 필요 (`copayment.ts:calcCopayment():L125-L154`)
- [🟡 Insufficient / Medium] **exemption.ts ZERO_RATE_CODES 목록 불완전**: V193/V124/V001 3개만 명시. DB MediIllness.Rate=0인 결핵 코드(V254 등은 STATIC_RATE_MAP에 있지만, V215·V216 등 기타 0% 코드는 누락 가능) (`exemption.ts:L41-L45`)
- [🟡 Insufficient / Medium] **medical-aid.ts 의료급여 D10 정액 절사 방식**: 총약제비 >= 정액 시 `trunc10(fixAmt)` 적용 (L165). mcode가 500원이면 trunc10(500)=500으로 문제 없으나, 500원이 아닌 다른 값일 때 trunc10이 적절한지 CH05 §9.1(D=10원절사) 기준으로 재검토 필요 (`medical-aid.ts:resolveMedicalAidFixAmount():L165`)
- [🟡 Insufficient / Medium] **veteran.ts M20 G타입 비G타입 분기**: CH05 §5.4에 따르면 M20은 G타입에서만 유효(비G타입은 감면율 0%). 그러나 calcVeteran()에는 비G타입 insuCode에서 bohunCode='M20'이 들어오는 경우의 처리가 없음. copayment.ts:L85에서 bohunCode가 M으로 시작하면 calcVeteran()으로 분기하므로 C10+M20 조합에서 오작동 가능 (`veteran.ts:calcVeteran():L300-L312`)
- [🟢 Insufficient / Low] **workers-comp.ts E20 특수 조건**: E20(산재 후유증) 특수 조건 발생 시 분기점이 있으나 현재는 E10과 동일 처리. 향후 법령 변경 대비용 TODO만 존재 (`workers-comp.ts:calcWorkersComp():L57`)

---

## 6. 기타 관찰 사항

### 비즈팜 VB6 이중등호(=) 버그 회피 여부

CH05 §5.9에서 지적한 비즈팜 VB6 버그:
```vb
Insur_Self_Amt = Insur_Self_Amt = Int((Int(Insur_Amt * 50/100 * 0.1) * 10) * 10/100)
```
이 버그는 VB6에서 `A = (A = B)` 비교식으로 해석되어 Boolean(0/-1) 값이 대입되는 문제다. 우리 TypeScript 구현(`veteran.ts`)은 산술식을 `=` 단일 대입으로만 사용하며, TypeScript의 정적 타입(number)으로 Boolean 혼입을 컴파일 타임에 차단한다. **이 버그는 우리 구현에서 발생하지 않는다.**

### 절사 규칙 총괄 (보험유형별) — 구현 현황

| 대상 | 규격(CH05 §9.1) | 우리 구현 | 일치 여부 |
|------|----------------|----------|----------|
| 요양급여비용총액1 | 10원 절사 | `trunc10()` in copayment.ts:L60 | ✓ |
| 건강보험(C) 본인부담 | 100원 절사 | `trunc100()` in copayment.ts:L156/175 | ✓ |
| 의료급여(D) 본인부담 정률(B014) | 10원 절사 | `trunc10()` in medical-aid.ts:L137 | ✓ |
| 의료급여(D) 본인부담 정액 | 절사없음(고정금액) | `trunc10(fixAmt)` — 주의: 정액에 trunc10 적용 | ⚠ |
| 보훈(G) 본인부담 일반 | 100원 절사 | `trunc100()` in veteran.ts:L297/L303 | ✓ |
| 보훈(G) 본인부담 감면30/50/60/90% | 10원 절사 | `trunc10()` in veteran.ts:L336 | ✓ |
| 보훈청구액(MpvaPrice) | 10원 절사 | `trunc10()` in veteran.ts:L222/L224 | ✓ |
| 자보(F) 본인부담 | 10원 절사 | `trunc10()` in auto-insurance.ts:L56 | ✓ |
| 산재(E) | 0원 | hardcoded 0 in workers-comp.ts:L62 | ✓ |
| 선별급여 100/100미만 본인부담 | 10원 절사 | **미구현** | ✗ |

> 의료급여 정액(`fixAmt`)에 `trunc10(fixAmt)` 적용은 fixAmt가 500/1000 등 10의 배수일 때는 무해하나, 규격상 정액은 절사 없이 고정금액이어야 하므로 개념적으로 불일치.

### 산정특례 처리 분기 흐름

`copayment.ts:calcCopayment()`의 C계열 분기에서 산정특례 → 65세 → 6세미만 → 일반 순서로 처리된다(L120-L182). CH05 §11.1 우선순위 상 산정특례는 65세 정액보다 선행하므로 흐름 자체는 규격과 일치한다. 다만 V452(30%)와 65세 2구간(20%)이 동시에 적용될 경우 어느 쪽이 더 유리한지에 대한 min 처리가 없다. 공단 기준으로는 가장 낮은 율 선택이 원칙이므로 향후 검토 필요.

### D10 mcode 기본값 불일치 가능성

`resolveMedicalAidFixAmount()`에서 `rate.mcode > 0 ? rate.mcode : 1000` (L224). CH05 §4.1에 따르면 현행 Mcode=500원(1종 기본)인데, 코드 내 fallback 값이 1000으로 되어 있어 rate DB가 0으로 잘못 세팅될 경우 500원 대신 1000원이 적용될 수 있다. CH05 §12.5 수정이력("2종은 500원")에 따르면 1종도 500원으로 통일되었을 가능성이 높으므로 fallback 1000 재검토 필요.

### C계열 분기 직접 구현 권고

현재 C31/C32/C21은 copayment.ts에 별도 분기 없이 호출자가 rate 필드를 올바르게 채워야 동작한다. 다른 보험유형(D→medical-aid, G→veteran, F→auto-insurance, E→workers-comp)은 모두 모듈로 분리되어 있어 일관성을 위해 C계열도 `calcHealthInsurance()` 모듈 분리를 권고한다.

### CH06 의존성

보훈 3자배분(MpvaPrice/InsuPrice/MpvaComm)은 CH06과 긴밀히 연계된다. veteran.ts의 M20 MpvaComm 처리("MpvaPrice=0, Integration Lead가 MpvaComm으로 전환")는 현재 미완성이며 CH06 분석과 연계하여 완성 필요.
