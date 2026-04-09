# CH03 구현 분석 보고서

> 작성자: CH03 Analyst (Phase 2 Team 3A)
> 작성일: 2026-04-06
> 챕터: CH03 — 조제료 수가 계산
> 상태: [x] 완료

---

## 1. 챕터 개요

- **챕터 제목**: 조제료 수가 계산 로직 통합
- **핵심 주제**: 약국 조제료(기본조제료 + 약품조제료 + 특수조제료)를 이루는 9개 수가항목의 Z코드 결정 및 금액 산출 로직. 비즈팜(VB6), 유팜(C#), EDB(C#), 공단 문서 4소스를 통합 정리한 명세이다.
- **다루는 계산 로직 범위**:
  - Z1000 → Z2000 → Z3000 → Z4xxx → Z5000 → Z7001 → ZH/ZC → ZE100 순서의 9개 항목 산정 파이프라인
  - Holiday_gb 값(N/0/1/5/6/7/8/3)에 따른 Z코드 접미사 매핑
  - 처방조제(Z41xx/Z43xx) vs 직접조제(Z42xx)의 코드 체계 및 일수 배수 차이
  - 비급여 조제료 차액 산정(보충 A), 보훈 특례(보충 B), 조제료 미산정 조건(보충 C)
  - 투약일수 결정(부록 A), Holiday_gb 결정(부록 B), EDB 심야→야간 다운그레이드(부록 C), 2024년 점수표(부록 D)
  - 관련 법령/고시: 건강보험 요양급여비용 고시(2024.07.01 기준), 직접조제 수가 체계(의약분업 예외)

---

## 2. 우리 구현 매핑

| 파일 경로 | 총 라인 수 | 이 챕터 관련 함수 목록 | 비고 |
|----------|-----------|----------------------|------|
| `src/lib/calc-engine/dispensing-fee.ts` | 359 | `calcDispensingFee()`, `buildSurcharge()`, `classifyDrugs()`, `z1000Code()`, `z2000Code()`, `z3000Code()`, `z4InternalCode()`, `z4ExternalCode()`, `z4BothCode()`, `z5000Code()` | 처방조제 파이프라인 허브 |
| `src/lib/calc-engine/modules/modes/direct-dispensing.ts` | 510 | `calcDirectDispensing()`, `calcDirectDosageFee()`, `isDirectDispensingMode()`, `z4200Code()`, `z4220Code()`, `z4221Code()`, `z5DosageCode()` | 직접조제 전용 모듈 |
| `src/lib/calc-engine/modules/modes/counseling.ts` | 322 | `calcCounseling()`, `calcCounselingFee()`, `calcMoonChildBonus()`, `getNonFaceDispensingCode()`, `isNonFaceMode()` | Z7001/ZC001~ZC004 |
| `src/lib/calc-engine/surcharge.ts` | 288 | `determineSurcharge()`, `getSurchargeSuffix()` | Holiday_gb 결정 |
| `src/lib/calc-engine/modules/surcharges/powder.ts` | 226 | `calcPowderSurchargeFromCtx()`, `hasPowderDrug()` | Z4010 가루약 가산 |
| `src/lib/calc-engine/modules/surcharges/saturday-split.ts` | 307 | `applySaturdaySurchargeRows()` | Z2000030/Z3000030/Z41xx030 |
| `src/lib/calc-engine/modules/surcharges/seasonal.ts` | 250 | `calcSeasonalSurcharge()` | ZE100 명절 |

### 미구현 영역

- `ZH001~ZH004` 코로나19 관련료 — CH03 §3-8 참조: 코드베이스에 대응 함수 없음
- 비급여 조제료 차액 산정 로직 — CH03 보충 A §A-4: `Max(비급여산정값 - 급여산정값, 0)` 처리 없음
- 보훈 감면(30/50/60/90) 시 기본조제료 0원 처리 — CH03 보충 B §B-1~B-2: `dispensing-fee.ts`에 미구현
- 보훈 1일 2회 이상 내방 특례 — CH03 보충 B §B-3: 내복조제료 차감 및 외용/주사조제료 제거 미구현
- 급여/비급여 조제료 미산정 조건 전체 — CH03 보충 C §C-1~C-5: `calcDispensingFee()` 진입 전 검증 로직 없음
- Z5xxx 일수별 의약품관리료 가산 — CH03 §3-5: `dispensing-fee.ts`의 처방조제 경로에서 `z5000Code(sc)` 1회만 호출, 일수별 가산 행(Z5xxx) 미산정
- Z4130 주사조제료 — CH03 §3-4(d): 처방조제 경로에서 자가투여주사제 코드 미구현
- 팩단위 전용 코드 Z4100(처방)/Z4201 처방조제 경로 — CH03 §3-4(e): `dispensing-fee.ts`에 팩단위 분기 없음

---

## 3. 챕터 요구사항 vs 우리 구현

| 챕터 §          | 요구사항 요약                                           | 우리 구현 위치                                                                 | 상태 | 비고 |
|----------------|--------------------------------------------------------|------------------------------------------------------------------------------|------|------|
| CH03 §2        | 9개 항목을 Z1000→ZE100 순서로 산정                      | `dispensing-fee.ts:calcDispensingFee():L248-L356`                            | ⚠    | ZH 미포함 |
| CH03 §3-1      | Z1000 약국관리료: 방문당 1회, 가산 없음                  | `dispensing-fee.ts:z1000Code():L93`                                          | ✓    |      |
| CH03 §3-2      | Z2000 Holiday_gb별 6개 코드 매핑                        | `dispensing-fee.ts:z2000Code():L98`                                          | ✓    |      |
| CH03 §3-2      | Z2000 chkDate=False 시 Z2000050만 분기                  | `dispensing-fee.ts:z2000Code()`                                              | ✗    | chkDate(2000.09.01) 분기 없음 |
| CH03 §3-3      | Z3000 Holiday_gb별 3개 코드 매핑 (6세미만 단독은 Z3000)  | `dispensing-fee.ts:z3000Code():L111`                                         | ✓    |      |
| CH03 §3-4(a)   | Z4120 외용만: ChkDosage=1 고정                          | `dispensing-fee.ts:z4ExternalCode():L149`                                    | ✓    |      |
| CH03 §3-4(b)   | Z41xx 내복(1~15일) 코드 직접 결정                        | `dispensing-fee.ts:z4InternalCode():L124`                                    | ✓    |      |
| CH03 §3-4(b)   | Z43xx 내복(16일 이상) 테이블 조회                        | `dispensing-fee.ts:calcDispensingFee():L281-L305`                            | ⚠    | Z4116 fallback 임시 처리, Z43xx 테이블 조회는 `repo.getPrescDosageFee()` 위임 |
| CH03 §3-4(c)   | Z4121 내복+외용 동시조제료 Holiday_gb 매핑               | `dispensing-fee.ts:z4BothCode():L156`                                        | ⚠    | 비즈팜 버그패턴(`"1","7"`/`"5","8"`) 미재현, 정상패턴 사용 — 상세는 §7-1 참조 |
| CH03 §3-4(d)   | Z4130 자가투여주사조제료 산정                            | —                                                                            | ✗    | 누락 |
| CH03 §3-4(e)   | Z4100 팩단위 처방조제 코드                              | —                                                                            | ✗    | `dispensing-fee.ts` 팩단위 분기 없음 |
| CH03 §3-4(f)   | Z4010 가루약 가산 (2023.11.01 이후 Z41xx100 신체계)      | `dispensing-fee.ts:L262-L328`, `powder.ts`                                   | ✓    |      |
| CH03 §3-5      | Z5000 기본료 + Z5xxx 일수별 가산 2단계 구조              | `dispensing-fee.ts:z5000Code():L163`, `direct-dispensing.ts:z5DosageCode()` | ⚠    | 처방조제 경로: Z5000 1회만, Z5xxx 가산 행 없음 |
| CH03 §3-5      | Z5001 마약 포함 시 코드 치환                            | `direct-dispensing.ts:_calcDirectDispensingImpl():L471`                      | ⚠    | 직접조제 경로만 구현, 처방조제 경로 미구현 |
| CH03 §3-5      | Z5011 병팩 처리                                         | —                                                                            | ✗    | 미구현 |
| CH03 §3-6      | Z7001 야간조제관리료 (처방조제+달빛어린이)               | `counseling.ts:calcCounselingFee():L127`                                     | ✓    |      |
| CH03 §3-7      | ZC001~ZC004 비대면조제관리료 우선순위 결정               | `counseling.ts:getNonFaceDispensingCode():L201`                              | ✓    |      |
| CH03 §3-7      | ZC 시행일 2023.06.01 분기                               | `counseling.ts:getNonFaceDispensingCode():L204` (`_dosDate` 미사용)          | ⚠    | 시행일 분기 미구현(TODO 주석 있음) |
| CH03 §3-8      | ZH001~ZH004 코로나19 관련료                             | —                                                                            | ✗    | 누락 |
| CH03 §3-9      | ZE100 명절조제지원금                                    | `seasonal.ts:calcSeasonalSurcharge()`                                        | ✓    |      |
| CH03 §4-1      | 주사제만(일반)/자가투여 분기표                           | `dispensing-fee.ts:calcDispensingFee():L239-L246`                            | ⚠    | 자가투여 여부 구분 없이 Z5000만 적용, Z4130 미산정 |
| CH03 §4-2      | 기본조제료 0원 처리 3가지 조건                          | `dispensing-fee.ts:L234-L246`                                                | ⚠    | `coveredCount=0` 조건만, 비급여주사+자가투여 조건 등 미처리 |
| CH03 §5-1      | 처방조제 vs 직접조제 코드 체계 분리                     | `dispensing-fee.ts:L183-L194`, `direct-dispensing.ts`                        | ✓    |      |
| CH03 §5-2      | 직접조제: 내복조제료 = 단가 × 최대내복투약일수           | `direct-dispensing.ts:calcDirectDosageFee():L249`                            | ✓    |      |
| CH03 §5-3      | 직접조제 일일2회내방 시 Z1000/Z2000=0원                 | `direct-dispensing.ts`                                                       | ✗    | 일일2회내방 분기 없음 |
| CH03 §5-4      | 처방조제 달빛어린이 Z7001 전용                           | `counseling.ts:calcCounselingFee():L134`                                     | ✓    |      |
| CH03 보충 A §A-1~A-3 | 비급여조제료Types 5종 환경설정                    | —                                                                            | ✗    | 누락 |
| CH03 보충 A §A-4 | 비급여 내복/내외용동시 차액 산정 로직                   | —                                                                            | ✗    | 누락 |
| CH03 보충 A §A-5 | 비급여 마약 의약품관리료(Z5001) 분기                    | —                                                                            | ✗    | 누락 |
| CH03 보충 B §B-1 | 보훈 감면(30/50/60/90) 기본조제료 0원 처리              | —                                                                            | ✗    | 누락 |
| CH03 보충 B §B-3 | 보훈 국비100/감면100/고엽제 1일2회내방 특례             | —                                                                            | ✗    | 누락 |
| CH03 보충 C §C-1 | 급여 조제료 미산정 3조건                                | `dispensing-fee.ts:L234` (coveredCount=0만)                                  | ⚠    | 약사본인조제, 조제료산정안함 조건 미구현 |
| CH03 보충 C §C-2 | 비급여 조제료 미산정 3조건                              | —                                                                            | ✗    | 누락 |
| CH03 부록 A    | 투약일수 결정 로직 (조제일수인정, 가루약 조제일수)       | `dispensing-fee.ts:classifyDrugs():L51` (약품 maxInternalDay만)              | ⚠    | 조제일수인정 플래그/가루약 별도 조제일수 미처리 |
| CH03 부록 B    | Holiday_gb 결정 4단계 로직                             | `surcharge.ts:determineSurcharge()`                                           | ⚠    | 별도 섹션(surcharge.ts) 분석 필요, 세부 검증은 본 보고서 범위 외 |
| CH03 부록 C    | EDB 심야→야간 다운그레이드(age>=6)                      | —                                                                            | ✗    | 코드베이스에 명시적 다운그레이드 로직 없음 |
| CH03 부록 D    | 2024년 처방조제 점수표 (참고)                           | — (수가 DB에서 관리)                                                          | ✓    | 하드코딩 필요 없음, DB 로드 방식 적합 |

---

## 4. 누락 항목 (Missing)

- [🔴 Missing / Critical] **ZH001~ZH004 코로나19 관련료**: 코로나19 치료제 처방 시 필수 산정 항목이 코드베이스에 전혀 없음. 청구 누락 시 반송 사유 발생 (CH03 §3-8)
- [🔴 Missing / Critical] **비급여 조제료 차액 산정**: `Max(비급여산정값 - 급여산정값, 0)` 로직 전무. 내복조제료/내외용동시조제료 이중 산정 가능성 있음 (CH03 보충 A §A-4)
- [🔴 Missing / Critical] **급여 조제료 미산정 조건 2~3번**: 약사본인조제 플래그, `조제료산정안함` + `조제료미산정Type` 조건이 `calcDispensingFee()` 진입 전에 검증되지 않음 (CH03 보충 C §C-1)
- [🟠 Missing / High] **비급여 조제료 미산정 조건 전체**: 비급여 경로가 현재 완전히 미구현 상태이며, 미산정 조건 검증도 없음 (CH03 보충 C §C-2)
- [🟠 Missing / High] **보훈 감면 기본조제료 0원 처리**: 보훈_감면30/50/60/90 시 Z1000/Z2000/Z3000을 0원으로 처리해야 하나, `calcDispensingFee()`는 보훈 보험유형을 참조하지 않음 (CH03 보충 B §B-1~B-2)
- [🟠 Missing / High] **보훈 1일2회내방 특례**: 기본료 전부 0원 + 내복조제료 차감 + 외용/주사조제료 제거. 처리 범위가 매우 넓으나 코드베이스에 없음 (CH03 보충 B §B-3)
- [🟠 Missing / High] **Z4130 주사조제료 (자가투여주사제)**: 처방조제 경로에서 자가투여주사제 존재 시 Z4130 산정 누락. 현재는 자가주사 여부 구분 없이 Z5000만 산정 후 종료 (CH03 §3-4(d))
- [🟠 Missing / High] **Z5xxx 의약품관리료 일수별 가산 행 (처방조제 경로)**: `dispensing-fee.ts`는 `z5000Code(sc)` 1회만 호출. Z5010(외용전용), Z5010~Z5291(내복일수별) 별도 행 미추가. 직접조제 경로(`direct-dispensing.ts:z5DosageCode()`)는 구현됨 (CH03 §3-5)
- [🟠 Missing / High] **Z5001 처방조제 경로 마약 분기**: `dispensing-fee.ts`의 처방조제 Z5 산정 시 항상 `Z5000`만 사용. 마약/향정 포함 시 Z5001로 치환 로직 없음 (CH03 §3-5)
- [🟠 Missing / High] **Z5011 병팩 처방**: 모든 내복약이 팩단위일 때 Z5011 적용 로직 없음, 처방/직접 양 경로 모두 해당 (CH03 §3-5)
- [🟠 Missing / High] **Z4100 처방조제 팩단위 내복 코드**: 처방조제 경로에서 전체 내복약 팩단위 판정 및 Z4100 코드 전환 없음 (CH03 §3-4(e))
- [🟡 Missing / Medium] **직접조제 일일2회내방 Z1000/Z2000 0원**: `direct-dispensing.ts`에 `isDoubleVisit` 플래그 처리 없음 (CH03 §5-3)
- [🟡 Missing / Medium] **EDB 심야→야간 다운그레이드**: 6세 이상 심야 시 `isMidNight=false, isNight=true`로 전환하는 로직이 코드베이스에 없음. `surcharge.ts` 또는 입력 전처리 단계에서 처리 필요 (CH03 부록 C)
- [🟡 Missing / Medium] **비급여조제료Types 환경설정 5종**: 비급여 약품에 대한 조제료 적용 범위 설정(모두적용/내복약/외용약/적용안함/주사제) 구현 없음 (CH03 보충 A §A-1)
- [🟢 Missing / Low] **비급여기본조제료미산정 옵션**: TRUE 시 비급여 기본조제기술료/복약지도료/약국관리료 미산정 환경설정 미구현 (CH03 보충 A §A-2)

---

## 5. 부족 항목 (Insufficient)

- [🟠 Insufficient / High] **Z2000 chkDate(2000.09.01) 분기 미구현**: `z2000Code()`는 `chkDate=False` 경로가 없어 2000.09.01 이전 처방도 현재 코드 체계를 적용함. 공단 명세에서 `chkDate=False`이면 공휴일(5/7)만 Z2000050을 사용해야 함 (`dispensing-fee.ts:z2000Code():L98-L108`; CH03 §3-2)
- [🟠 Insufficient / High] **주사제만 처방 분기에서 자가투여 구분 누락**: `isInjectionOnly` 판정 후 자가투여 여부(`isSelfInjection`)를 보지 않고 바로 Z5000만 산정. Z4130 산정 조건(자가투여=TRUE)과 기본조제료 0원 조건(자가투여=FALSE)의 분기가 없음 (`dispensing-fee.ts:calcDispensingFee():L239-L246`; CH03 §3-4(d), §4-1)
- [🟠 Insufficient / High] **급여 조제료 미산정 조건 1번만 부분 구현**: `coveredCount === 0` 체크는 "급여 약품이 없으면 미산정"에 해당하나, `약사본인조제여부=TRUE` 및 `조제료산정안함+미산정Type` 조건은 미처리. 또한 조건 3번(약품별 조제료산정여부 로직)도 없음 (`dispensing-fee.ts:L234`; CH03 보충 C §C-1)
- [🟠 Insufficient / High] **투약일수 결정 단순화**: `classifyDrugs()`에서 `maxInternalDay`를 `Math.floor(drug.dDay)` 최대값으로만 결정. `조제일수인정=1` 플래그 우선 사용 및 팩수량/향정/코로나19치료제 필터링 미적용 (`dispensing-fee.ts:classifyDrugs():L51`; CH03 부록 A §A-1)
- [🟡 Insufficient / Medium] **Z4BothCode(Z4121) 토요(holidayGb="3") 처리**: `dispensing-fee.ts:z4BothCode():L159`에서 `'Z4121030'`을 반환하나, CH03 §3-4(c)에 토요 가산 분기 명세가 없음. 처방조제 Z4121의 토요 가산 코드(`Z4121030`) 존재 여부 확인 필요 (CH03 §3-4(c))
- [🟡 Insufficient / Medium] **ZC 비대면 시행일 2023.06.01 분기 누락**: `getNonFaceDispensingCode()`의 `_dosDate` 파라미터가 미사용 상태. 2023.06.01 이전 처방에도 ZC 코드 산정 가능성 있음 (`counseling.ts:getNonFaceDispensingCode():L204`; CH03 §3-7)
- [🟡 Insufficient / Medium] **처방조제 경로 coveredDrug 분류 단순화**: `isCovered()` 판정 시 `partial30/partial50/partial80/partial90`은 포함하나, `보훈전액본인부담`에 해당하는 `insuPay` 값 매핑이 명확하지 않음. 보훈 전액본인부담 약품이 최대내복조제일수 계산에서 제외될 수 있음 (`dispensing-fee.ts:classifyDrugs():L62-L69`; CH03 부록 A §A-1)
- [🟡 Insufficient / Medium] **신체계 산제 16일 이상 코드 처리**: `usePowderNewCode=true` + `maxInternalDay > 15`일 때 `baseCode = 'Z4116'`으로 하드코딩. 실제로는 16일 이상 구간별 Z43xx 코드여야 하며, 신체계 산제 접미사(`100`)까지 붙어야 함 (`dispensing-fee.ts:calcDispensingFee():L266-L268`; CH03 §3-4(b)(f))
- [🟢 Insufficient / Low] **Z4BothCode 추가 변경 시 직접조제와 불일치 위험**: 처방조제의 `z4BothCode()`와 직접조제의 `z4221Code()`가 동일 패턴이나 별도 함수로 분리되어 있음. 추후 명세 변경 시 양쪽 동시 수정 누락 위험 (CH03 §5-1)

---

## 6. 기타 관찰 사항

- **Z4121 Holiday_gb 비즈팜 버그 패턴 미재현 — 의도적으로 정상 패턴 채택**: CH03 §7-1에서 비즈팜 원본의 `Z4121` 매핑(`"1","7"`=010, `"5","8"`=050)이 다른 Z코드(`"1","8"`=야간, `"5","7"`=공휴일)와 불일치하는 버그 가능성이 지적되어 있다. `dispensing-fee.ts:z4BothCode():L157-L158`은 정상 패턴(`"1","8"` 야간, `"5","7"` 공휴)을 따르고 있어 적절한 판단이다. 단, 비즈팜과의 호환이 필요한 경우 별도 처리 필요.

- **비즈팜과의 토요가산 불일치 처리**: 비즈팜 VB6 소스에는 토요가산 로직이 없으나, 유팜/EDB에는 구현되어 있다. `saturday-split.ts`를 통해 구현이 존재하며, 유팜/EDB 기준을 따르는 것이 타당하다. `dispensing-fee.ts`에서 처방조제 경로의 Z4121, Z4120에 대한 토요 가산 행 추가 여부 확인 필요 (CH03 §7-2 (2)).

- **calcMoonChildBonus() price=0 반환 — 미완성 상태**: `counseling.ts:calcMoonChildBonus():L175`는 `price: 0`을 반환하며 "Integration Lead가 교체" 주석이 남아 있다. `calcCounseling()`에서 sugaMap으로 재조회하여 보완하나, 단가가 sugaMap에 없으면 달빛어린이 추가 가산이 누락된다.

- **달빛어린이 추가 가산 코드 불명확**: `calcMoonChildBonus()`에서 Z7001 코드를 재사용하고 있으나, CH03 §3-6에서 Z7001은 야간조제관리료이다. 달빛어린이 소아야간 추가 가산 전용 코드가 별도로 존재하는지 확인 필요.

- **ZH(코로나19) 미구현의 현재 영향**: ZH 코드는 코로나19 유행기(2020~2023) 정책 수가로, 현재(2026년 기준) 사용 빈도가 낮으나 소급 계산 또는 레거시 처방 처리를 지원해야 한다면 구현 필요. 이력 조회 기능 범위에 따라 우선순위 재검토.

- **처방조제/직접조제 Z5 의약품관리료 처리 불일치**: 직접조제 경로(`direct-dispensing.ts`)는 Z5000 기본료와 `z5DosageCode()` 일수별 가산 두 행을 모두 산정하나, 처방조제 경로(`dispensing-fee.ts`)는 `addWage('Z5000', 1)` 단일 행만 산정. 동일 항목임에도 처리가 분리되어 일관성 없음. 처방조제 경로에도 `z5DosageCode()` 패턴 적용 필요.

- **ICalcRepository.getPrescDosageFee() 존재 의존**: 16일 이상 내복조제료 코드를 `repo.getPrescDosageFee(year, days)`에서 조회하나, 이 메서드가 `ICalcRepository` 인터페이스에 실제 정의되어 있는지, `SupabaseCalcRepository`에서 구현되어 있는지 검증 필요 (`dispensing-fee.ts:L282`).

- **`direct-dispensing.ts`의 `insuDose` 결정 로직**: `insuDose = opt.insuDose && opt.insuDose > 0 ? opt.insuDose : Math.max(drugs.maxInternalDay, drugs.maxExternalDay)`. 직접조제에서는 내복일수와 외용일수의 최대값을 투약일수로 사용하는데, CH03 부록 A에서 직접조제의 투약일수 결정 명세가 별도로 없어 처방조제 기준 동일 적용 여부 확인 필요.
