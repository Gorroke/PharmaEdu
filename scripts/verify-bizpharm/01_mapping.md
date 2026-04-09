# Winpharm → PharmaEdu calc-engine 매핑표

> 작성일: 2026-04-07  
> 조사 대상: Winpharm DB (SQL Server 로컬)  
> H0241 총 행 수: 1,670,372  
> H0243 총 행 수: 6,496,264  

---

## 1. 보험구분 (FormNo → insuCode)

Winpharm의 보험구분 식별자는 `IsCode`(8자리 숫자, 2종류만 존재)가 아니라 **`FormNo`** 컬럼에 인코딩되어 있다.  
`IsCode`는 요양기관기호(숫자)로 추정되며 보험유형 구분에 사용할 수 없다.

| Winpharm FormNo | 의미 | 행 수 | 우리 insuCode |
|---|---|---|---|
| H024 | 처방조제 × 건강보험 | 1,576,205 | C10 |
| H124 | 처방조제 × 의료급여 | 68,617 | D10 (sbrdnType 기반 세분화) |
| M024 | 처방조제 × 보훈 | 25,289 | G10/G20 (Etc 값으로 구분) |
| S024 | 처방조제 × 산재 | 249 | F10 |
| B024 | 처방조제 × 기타(보훈변형?) | 12 | 미확인 |
| H025 / H125 | 직접조제 | 0 | H025/H125 (DB에 없음) |

**주의:** `IsCode` 컬럼은 숫자형 8자리 기관코드(예: 11832240, 12840343)이며 보험유형 구분 불가. 실제 보험유형 구분은 `FormNo` 사용.

---

## 2. 보훈코드 (어디서 추출?)

보훈 bohunCode(M10~M90)에 해당하는 컬럼이 H0241에 **명시적으로 없다**.

| 컬럼 | 내용 | 보훈 관련성 |
|---|---|---|
| `FormNo` = 'M024' | 보훈 서식 여부 | 보훈 해당 여부 (G계열) |
| `Etc` | M024에서 '0000000001'(약 24,385건), '0000000002'(640건), '0000000003'(27건) | MT038 값으로 추정 (1=국비 전상군경 §폐지전, 2=타질환 조제분) |
| `TEMP1` | M024에서 'A' 1건 확인 | MT038 'A'(도서벽지 60% 감면)으로 추정 |
| `Bohun_SelfAmt` | 보훈 자기부담금 → 전체 0 (미사용) | bohunCode 직접 저장 없음 |
| `BohunPartAmt` | 전체 0 | 미사용 |

**결론:** Winpharm H0241에는 CalcOptions.bohunCode(M10~M90)에 직접 대응하는 컬럼이 없다.  
보훈 G10/G20 구분(위탁 여부)도 Winpharm에서 확인 불가 — isMPVBill 매핑 불가.  
`Etc` 컬럼의 '0000000001'/2/3 값이 MT038 코드와 유사하나 정확한 매핑 근거 미확보.

---

## 3. 의료급여 구분 (sbrdnType → sbrdnType)

| Winpharm sbrdnType | 의미 | 행 수 | FormNo | 우리 CalcOptions.sbrdnType |
|---|---|---|---|---|
| (공백/NULL) | 비의료급여 또는 미기재 | 1,652,789 | H024 주로 | 해당 없음 |
| M001 | 의료급여 수급권자 유형 M001 | 3,922 | H124 | 'M001' (CalcOptions.sbrdnType) |
| M016 | 의료급여 수급권자 유형 M016 | 2,531 | H124 | 'M016' |
| M005 | 의료급여 수급권자 유형 M005 | 2,192 | H124 | 'M005' |
| B009 | 의료급여 수급권자 유형 B009 | 2,922 | H124 | 'B009' |
| M015 | 의료급여 수급권자 유형 M015 | 1,652 | H124 | 'M015' |
| M019 | | 935 | H124 | 'M019' |
| M018 | | 579 | H124 | 'M018' |
| M003 | | 356 | H124 | 'M003' |
| B005 | | 1,839 | H124 | 'B005' |
| M017 | | 161 | H124 | 'M017' |
| M002 | | 141 | H124 | 'M002' |
| B006 | | 70 | H124 | 'B006' |
| M008 | | 63 | H124 | 'M008' |
| B002 | | 33 | H124 | 'B002' |
| B001 | | 171 | H124 | 'B001' |
| B008 | | 9 | H124 | 'B008' |
| B004 | | 3 | H124 | 'B004' |
| M007 | | 3 | H124 | 'M007' |
| M006 | | 1 | H124 | 'M006' |

**비고:** `Etc` 컬럼이 H124에서 1=1종, 2=2종 수급권자 구분으로 사용되는 것으로 추정  
(H124 Etc=1이 다수, Etc=2가 소수 — `sbrdnType` B/M계열과 함께 해석 필요).  
M계열 sbrdnType은 보훈이 아니라 **의료급여 수급권자 유형**이다 (모두 FormNo=H124에서 발생).

---

## 4. 연령 (Panum에서 추출)

CalcOptions.age 및 6세/65세/75세 연령 분기는 `Panum` + `EatDate` 조합으로 산출.

| 항목 | 추출 방법 |
|---|---|
| 생년월일 | Panum[1..6] = YYMMDD |
| 세기 구분 | Panum[8] = '1','2','5','6' → 1900년대; '3','4','7','8' → 2000년대; '9','0' → 외국인 |
| 나이 계산 | DATEDIFF(YEAR, 생년월일, EatDate) — 생일 지남 여부로 ±1 보정 필요 |
| 외국인 처리 | Panum[8] = '9' 또는 '0' → 별도 로직 필요 |

**Panum 분포:**
- 전체: 1,670,328건 (길이 8 이상)
- 2000년대 이후 출생(3/4/7/8): 249,999건
- 1900년대 출생(1/2/5/6): 427,595건
- 외국인(9/0): 992,734건

**6세 미만 직접 COUNT:** SQL DATE 변환 오류로 직접 집계 불가 (CAST 오류) — 실제 검증 시 Python/C# 레벨에서 계산 권장.  
**연령별 계산은 Panum 기반이며, Winpharm DB에서 직접 집계하기 어렵다.**

---

## 5. 산정특례 (VCODE / ConsidNo)

| Winpharm 컬럼 | 의미 | 우리 CalcOptions 필드 |
|---|---|---|
| `VCODE` | 특정기호 코드 (V103, V252, V193 등) | `mediIllness` / `mediIllnessInfo.code` |
| `ConsidNo` | 산정특례 등록번호 (8자리) | 직접 대응 필드 없음 (참고용) |

**VCODE 상위 분포:**

| VCODE | 행 수 |
|---|---|
| V193 | 63,341 |
| V252 | 46,802 |
| V201 | 8,160 |
| V352 | 6,351 |
| V139 | 4,186 |
| V127 | 3,933 |
| V027 | 3,689 |
| V131 | 3,389 |
| V124 | 2,944 |
| V000 | 1,273 |
| V246 | 620 |
| V103 | 323 |
| F010 | 645 |
| F016 | 504 |

**ConsidNo 현황:**  
- 값 있음: 1,383,758건 (82.8%) — VCODE 코드값이 들어 있음 (예: 'V001    ')
- 공백/NULL: 286,614건 (17.2%)
- 실제 등록번호(8자리 숫자)가 아니라 VCODE 값이 중복 저장된 것으로 보임

---

## 6. 코로나19 / 비대면 (CovidMeet / CovidGB)

| Winpharm 컬럼 | 값 | 의미 | 행 수 | 우리 CalcOptions 필드 |
|---|---|---|---|---|
| `CovidMeet` | NULL | 해당 없음 | 1,479,103 | - |
| `CovidMeet` | '0' | 미해당(기재) | 144,877 | isNonFace=false |
| `CovidMeet` | '1' | 코로나19 비대면 조제 | 187 | isNonFace=true (추정) |
| `CovidMeet` | ' ' | 공백(구버전) | 46,205 | - |
| `CovidGB` | NULL | 해당 없음 | 1,500,222 | - |
| `CovidGB` | '0' | 미해당 | 144,932 | - |
| `CovidGB` | ' ' | 공백 | 25,218 | - |

**코로나 약품 648903860:** H0243에서 0건 — 해당 DB에 코로나치료제 처방 없음.

---

## 7. 휴일/시간 구분 (Z수가코드 + EatDate + EatDateT)

Winpharm에는 야간/공휴일/명절 전용 컬럼이 없다. **H0243의 Z수가코드**로 역추적한다.

| 가산 유형 | H0243 수가코드 | 행 수 | 우리 CalcOptions 필드 |
|---|---|---|---|
| 명절(설/추석) 조제 | Z4010 | 425 | isHolyDay=true (명절 공휴일) |
| 공휴일 조제 | Z4100 | 1,299 (+관련코드) | isHolyDay=true |
| 야간 조제 (토요일 오후) | Z4130 | 310 (+관련코드) | isNight=true 또는 isSaturday=true |
| 토요일 (반일가산) | Z4010 계열 | 일부 | isSaturday=true (확인 필요) |

**EatDateT 컬럼:**
- 0~600 범위의 숫자 → **조제 시간(분, 0=자정, 540=오전9시, 1080=오후6시 기준)**으로 추정
- 평균 약 41.6분 → 범위가 분 단위이면 오전 1시경이 평균이 되므로 **단위 불명확**
- 실제 의미: 조제 시작 시각의 분 단위 또는 HHmm을 분으로 환산한 값이 아님
- Z4130(야간) 가산이 있는 명세서의 EatDateT = 1로 확인 → **EatDateT가 야간 여부 플래그일 가능성(0=주간, 1=야간)**은 낮고, 이 값은 CalcOptions.dosTime(HHmm)과 직접 매핑 불가

**CalcOptions.isSaturday / isNight / isHolyDay 추출 방법:**
- isSaturday: `DATEPART(WEEKDAY, CAST(EatDate AS DATE)) = 7`
- isHolyDay: H0243에 Z4100 수가코드 존재 여부
- isNight: H0243에 Z4130 수가코드 존재 여부
- 명절(설/추석): H0243에 Z4010 수가코드 존재 여부 (확인 필요)
- dosTime: EatDateT 컬럼 — 분 단위로 추정하나 야간 판정에 직접 사용하기 어렵다

---

## 8. CalcOptions 필드 매핑 (H0241 기반)

| Winpharm 컬럼 | 타입 | 우리 CalcOptions 필드 | 변환 로직 |
|---|---|---|---|
| `EatDate` | char(8) | `dosDate` | 직접 사용 (yyyyMMdd 동일 형식) |
| `EatDateT` | decimal | `dosTime` | 분 단위 → HHmm 변환 필요 (불확실) |
| `FormNo` | char(4) | `insuCode` | 'H024'→'C10', 'H124'→'D10', 'M024'→'G10', 'S024'→'F10' |
| `Panum` | char(13) | `age` | 생년월일 추출 후 조제일자와 차이 계산 |
| `Panum` | char(13) | `sex` | Panum[8] 홀수=남(M), 짝수=여(F) |
| `sbrdnType` | char(4) | `sbrdnType` | 직접 사용 (RTRIM 처리) |
| `VCODE` | varchar(4) | `mediIllness` | 직접 사용 (RTRIM) |
| `ConsidNo` | char(8) | `mediIllness` | VCODE와 중복; ConsidNo에 V코드 저장된 경우 있음 |
| `CovidMeet` | char(1) | `isNonFace` | '1'→true |
| `FormNo` | char(4) | `isDirectDispensing` | DB에 H025/H125 없음 → 상시 false |
| `TEMP1` | varchar(12) | `mt038` | 'A'→'A', 'D'/'Y'='1'?로 추정 (불확실) |
| `Etc` | varchar(100) | 참고용 | H124: 1종/2종 구분; M024: MT038 코드 값 |
| `TotDiffRealAmt` | money | `(차등수가)` | 3건만 존재 — 사실상 미사용 |
| `Bohun_SelfAmt` | money | `bohunCode` | 전체 0 — 보훈 자부담금 없음 |
| `ReqGubun` | char(1) | `(미매핑)` | '1'=재진, '2'=초진?, 대부분 공백 |
| `ICD1`, `ICD2` | char(6) | `(참고)` | 질병분류코드 — 직접 대응 없음 |
| `SanInDate` | char(8) | `(참고)` | 산정특례 등록일 |

**없는 필드:**
- `bohunCode` (M10~M90): Winpharm에 없음
- `isMPVBill`: Winpharm에 없음
- `isSimSa`: Winpharm에 없음
- `hospCode`: Winpharm에 없음
- `eHealthBalance`: Winpharm에 없음
- `isHealthCenterPresc`: Winpharm에 없음
- `hgGrade`: Winpharm에 없음
- `addRat` (자동차보험 할증): Winpharm에 없음
- `yearlyAccumulated` / `incomeDecile`: Winpharm에 없음
- `isMidNight` (심야 가산): Winpharm에 없음

---

## 9. DrugItem 필드 매핑 (H0243 기반)

| Winpharm 컬럼 | 타입 | 우리 DrugItem 필드 | 변환 로직 |
|---|---|---|---|
| `Code` | char(9) | `code` | RTRIM 처리 |
| `HangNum` | char(2) | `insuPay` | '01'→'covered', '02'(수가)→제외, 'U '→'fullSelf', 'B '→'partial80' |
| `CD_gubun` | char(1) | `take` | '1'=수가(Z코드), '3'=약품(내복/주사/외용) — 약품 내 추가 구분 없음 |
| `DayEatQuan` | float | `dNum` | 직접 사용 (1일투여횟수) |
| `TotEatDay` | float | `dDay` | 직접 사용 (총투여일수) |
| `OneEatQuan` | money | `dose` | 1회투약량 |
| `Price` | float | `price` | 단가 |
| `TotPrice` | float | `(검증용)` | 약품총금액 = price × dose × dNum × dDay (round) |
| `TotMoney` | float | `(검증용)` | 총금액 합계 |
| `CodeGubun` | char(3) | 구분 | '7I1'=Z수가코드, '7I3'=약품코드 |
| `InsurAmt` | money | `(검증용)` | 보험적용금액 (선별급여 시 50%/80% 등 적용 후 금액) |
| `DiffAmt` | money | `(검증용)` | 차등수가 금액 (3건만 > 0) |
| `PS_Type` | char(1) | `spec` 추정 | ' '=일반, '1'=마약?, '3','4','9' 등 — 7,282건 존재 |
| `JX999` | char(700) | `(참고)` | 특정내역 문자열 (대부분 NULL) |

**HangNum 실제 분포:**

| HangNum | 행 수 | InsuPayType 매핑 |
|---|---|---|
| 02 | 4,038,118 | Z수가코드(비급여) — CodeGubun='7I1' |
| 01 | 2,401,258 | covered (급여 일반약품) |
| U | 56,798 | fullSelf (100% 본인부담) |
| B | 90 | partial80 (선별급여 80%) |
| A, D, E | 0 | partial50/30/90 — DB에 없음 |
| V | 0 | veteran100 — DB에 없음 |

**CD_gubun 실제 분포:**

| CD_gubun | 의미 | 행 수 |
|---|---|---|
| 1 | Z수가코드 행 | 4,038,118 |
| 3 | 약품 행 (내복/주사/외용 구분 없음) | 2,458,146 |

**take(TakeType) 추출 문제:** CD_gubun='3'인 약품 행에서 내복/외용/주사 구분 정보가 없다. 약품 EDI코드 앞 자리로 구분하거나 별도 마스터 테이블 참조 필요.

---

## 10. CalcResult 검증 필드 (실제값과 비교)

| Winpharm 컬럼 | 우리 CalcResult 필드 | 비교 방식 | 비고 |
|---|---|---|---|
| `TotPrePri` | `totalPrice` | 정확 일치 | trunc10 적용 결과 |
| `Price_P` | `userPrice` | 정확 일치 | 환자 본인부담금 |
| `Price_C` | `pubPrice` | 정확 일치 | 공단(+보훈청) 청구액 |
| `Price_P + Price_C` | `totalPrice` | 항등 확인 | 검증: 전 샘플에서 일치 확인됨 |
| `TotDrugAmt100` | `sumInsuDrug100` + `totalPrice100` | 참고 | 50,769건 존재 |
| `PartTotAmt` | `sumInsuDrug50 + sumInsuDrug80 + ...` | 선별급여 총액 | 90건 존재 |
| `SelfPartAmt` | `underUser` | 선별급여 본인부담 합계 | 90건 존재 |
| `BillPartAmt` | `underInsu` | 선별급여 공단부담 합계 | 90건 존재 |
| `Bohun_SelfAmt` | `mpvaPrice` 또는 `realPrice` | 보훈 자부담 | 전체 0 — 검증 불가 |
| `Real_Summary_Amt` | `realPrice` 추정 | 실수납금? | 미확인 |

**검증 우선순위:**
1. `Price_P` = `userPrice` — 환자부담금 (가장 중요)
2. `TotPrePri` = `totalPrice` — 요양급여비용총액
3. `Price_C` = `pubPrice` — 공단청구액

---

## 11. 카테고리별 데이터 존재 여부

| 카테고리 | H0241 행 수 | SQL 조건 | 비고 |
|---|---|---|---|
| 건강보험 (C10) | 1,576,205 | FormNo='H024' | 주력 데이터 |
| 의료급여 (D10+) | 68,617 | FormNo='H124' | sbrdnType으로 세분화 |
| 보훈 (G계열) | 25,289 | FormNo='M024' | G10/G20 구분 불가 |
| 산재 (F10) | 249 | FormNo='S024' | 소량 |
| 기타 B024 | 12 | FormNo='B024' | 미확인 유형 |
| 100% 본인부담 | 50,769 | TotDrugAmt100 > 0 | H0241 기준 |
| 100% 본인부담 약품행 | 56,798 | H0243 HangNum='U ' | |
| 선별급여(B항 80%) | 90 | H0243 HangNum='B ' | A/D/E항 없음 |
| V252 산정특례 | 46,802 | RTRIM(VCODE)='V252' | |
| V193 (다른 특례) | 63,341 | RTRIM(VCODE)='V193' | 최다 |
| 코로나 비대면 | 187 | CovidMeet='1' | |
| 코로나 약품 648903860 | 0 | H0243 Code='648903860' | DB에 없음 |
| 명절 가산 | 425 | H0243 Code='Z4010    ' | |
| 공휴일 가산 | 1,299 | H0243 Code='Z4100    ' | |
| 야간 가산 | 310 | H0243 Code='Z4130    ' | |
| 토요일 조제 | 73,859 | WEEKDAY(EatDate)=7 | Z4010과 불일치 — 토요일 가산 미청구 많음 |
| 자가주사 관련 | 37,244+ | H0243 Code='Z5001    ' 등 | Z5001이 최다 |
| 차등수가 | 3 | TotDiffRealAmt > 0 | 사실상 없음 |

---

## 12. 발견된 제약 / 누락

### 매핑 불가 항목 (Winpharm에 해당 컬럼 없음)

| CalcOptions 필드 | 이유 |
|---|---|
| `bohunCode` (M10~M90) | 보훈코드 전용 컬럼 없음. FormNo='M024'로 보훈 여부만 확인 가능 |
| `isMPVBill` | 보훈 위탁/비위탁 구분 컬럼 없음 |
| `isSimSa` | 심사기관 여부 컬럼 없음 |
| `hospCode` | 요양기관기호 컬럼 없음 (IsCode는 기관코드로 추정되나 활용 미확인) |
| `eHealthBalance` | 건강생활유지비 잔액 없음 |
| `isHealthCenterPresc` | 보건기관 처방전 여부 없음 |
| `hgGrade` | 의료급여 등급 없음 |
| `addRat` | 자동차보험 할증률 없음 |
| `yearlyAccumulated` | 연간 누적 본인부담액 없음 |
| `incomeDecile` | 소득분위 없음 |
| `isMidNight` | 심야 가산 전용 컬럼 없음 |
| `dosTime` (정확한 HHmm) | EatDateT가 분 단위로 추정되나 야간 판정에 직접 활용 불확실 |

### 데이터 품질 이슈

| 항목 | 내용 |
|---|---|
| `take` (TakeType) | H0243 CD_gubun='3' 약품에서 내복/외용/주사 구분 정보 없음 — EDI코드 마스터 필요 |
| `IsCode` | 8자리 숫자 기관코드(2종류), 보험유형 구분으로 사용 불가 |
| `EatDateT` | 0~600 범위 — 분 단위이면 0=자정(00:00), 600=10:00이나 평균 41.6분으로 야간 패턴과 불일치 |
| `선별급여 A/D/E 항` | DB에 HangNum 'A ', 'D ', 'E '가 0건 — partial50/30/90 검증 불가 |
| `보훈 V항` | DB에 HangNum 'V ' 0건 — veteran100 검증 불가 |
| `직접조제 (H025/H125)` | DB에 0건 — isDirectDispensing 검증 불가 |
| `bohunCode` | DB에 없어 보훈 M10~M90 분기 전체 검증 불가 |
| `코로나 약품 648903860` | DB에 없어 drug-648 모듈 검증 불가 |
| `차등수가` | TotDiffRealAmt > 0인 행 3건만 존재 — 통계적 검증 불가 |
| `ConsidNo` | 실제 등록번호가 아닌 VCODE 값이 저장된 경우 존재 |
| `sbrdnType` 'M계열' | 보훈(G계열)이 아닌 의료급여(H124) 수급권자 유형임을 주의 |

### 검증 가능한 핵심 항목

| 항목 | 방법 |
|---|---|
| `totalPrice` vs `TotPrePri` | H0241 전체 직접 비교 (1.67M건) |
| `userPrice` vs `Price_P` | H0241 전체 직접 비교 |
| `pubPrice` vs `Price_C` | H0241 전체 직접 비교 |
| V252 산정특례 계산 | 46,802건 (VCODE='V252') |
| 의료급여 D10 계산 | 68,617건 (FormNo='H124') |
| 100% 본인부담 U항 | 50,769건 / 56,798행 |
| 선별급여 B항 80% | 90건 (소량) |

---

*이 문서의 모든 행 수는 `sqlcmd -S "(local)" -d Winpharm -E` 로 직접 조회한 결과이며, 추측이 포함된 경우 명시함.*
