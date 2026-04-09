# Winpharm 검증 결과

> 생성일: 2026-04-08

## 전체 요약

- 총 125건 / PASS **61건** / FAIL 61건 / ERROR 3건
- **일치율 48.8%**

## 카테고리별 일치율

| 카테고리 | 건수 | PASS | FAIL | ERROR | 일치율 | 평균차이 |
|---|---|---|---|---|---|---|
| CAT01_C10 | 3 | 3 | 0 | 0 | 100% | - |
| CAT02_C20_65-74 | 3 | 3 | 0 | 0 | 100% | - |
| CAT03_C20_75plus | 3 | 3 | 0 | 0 | 100% | - |
| CAT04_D10_Mcode | 3 | 3 | 0 | 0 | 100% | - |
| CAT05_D20_general | 3 | 1 | 2 | 0 | 33% | 53025원 |
| CAT06_D40_Bcode | 3 | 2 | 1 | 0 | 67% | 2780원 |
| CAT07_D80_exempt | 3 | 1 | 2 | 0 | 33% | 3010원 |
| CAT08_G10_bohun_exempt | 3 | 1 | 2 | 0 | 33% | 3390원 |
| CAT10_G20_bohun | 3 | 2 | 1 | 0 | 67% | 3390원 |
| CAT11_E10_vcode_H024 | 3 | 2 | 1 | 0 | 67% | 26290원 |
| CAT12_E20_vcode_H124 | 3 | 2 | 1 | 0 | 67% | 21020원 |
| CAT13_B024_etc | 3 | 0 | 3 | 0 | 0% | 50973원 |
| CAT14_saturday_H024 | 3 | 0 | 3 | 0 | 0% | 12090원 |
| CAT15_holiday_H024 | 3 | 0 | 3 | 0 | 0% | 11840원 |
| CAT16_under6_H024 | 3 | 1 | 2 | 0 | 33% | 3160원 |
| CAT17_age65to74_H024 | 3 | 3 | 0 | 0 | 100% | - |
| CAT18_age75plus_H024 | 3 | 3 | 0 | 0 | 100% | - |
| CAT19_child_holiday | 3 | 0 | 3 | 0 | 0% | 3340원 |
| CAT21_D10_Mcode_1000 | 3 | 3 | 0 | 0 | 100% | - |
| CAT23_D20_age65 | 3 | 2 | 1 | 0 | 67% | 9800원 |
| CAT24_G20_Etc3 | 3 | 2 | 1 | 0 | 67% | 7860원 |
| CAT26_100pct_self | 3 | 0 | 3 | 0 | 0% | 17147원 |
| CAT27_covid19 | 3 | 0 | 3 | 0 | 0% | 3120원 |
| CAT28_self_injection | 3 | 3 | 0 | 0 | 100% | - |
| CAT29_sanje | 3 | 2 | 1 | 0 | 67% | 3680원 |
| CAT30_V103 | 3 | 0 | 3 | 0 | 0% | 8020원 |
| CAT31_V252 | 3 | 0 | 3 | 0 | 0% | 8510원 |
| CAT32_V206 | 3 | 0 | 0 | 3 | 0% | - |
| CAT33_V246 | 3 | 0 | 3 | 0 | 0% | 19487원 |
| CAT35_seonbyulgup_diffamt | 3 | 2 | 1 | 0 | 67% | 2610원 |
| CAT38_chaedung_applied | 3 | 0 | 3 | 0 | 0% | 191877원 |
| CAT39_chaedung_nonapplied | 3 | 3 | 0 | 0 | 100% | - |
| CAT40_chaedung_with_vcode | 2 | 0 | 2 | 0 | 0% | 134520원 |
| CAT44_holiday_general | 3 | 0 | 3 | 0 | 0% | 12943원 |
| CAT45_weekday_control | 3 | 3 | 0 | 0 | 100% | - |
| CAT46_days1 | 3 | 3 | 0 | 0 | 100% | - |
| CAT47_days7 | 3 | 1 | 2 | 0 | 33% | 6335원 |
| CAT48_days15 | 3 | 1 | 2 | 0 | 33% | 8350원 |
| CAT49_days30 | 3 | 2 | 1 | 0 | 67% | 18430원 |
| CAT50_days60 | 3 | 1 | 2 | 0 | 33% | 16380원 |
| CAT51_bohun_Zcode | 3 | 1 | 2 | 0 | 33% | 3390원 |
| CAT53_bohun_Etc2_Zcode | 3 | 2 | 1 | 0 | 67% | 3390원 |

## FAIL 분석

### CAT05_D20_general — 2025100002|00081
- 입력: insuCode=D20, dosDate=20251031, age=56, drugs=2종, NIGHT
- 기대: totalPrice=56450, userPrice=500, pubPrice=55950
- 실제: totalPrice=152700, userPrice=500, pubPrice=152200
- 차이: totalPrice +96250, pubPrice +96250
- 상태: **FAIL_MULTI**

### CAT05_D20_general — 2025100002|00194
- 입력: insuCode=D20, dosDate=20251030, age=68, drugs=3종, HOL
- 기대: totalPrice=39550, userPrice=500, pubPrice=39050
- 실제: totalPrice=29750, userPrice=500, pubPrice=29250
- 차이: totalPrice -9800, pubPrice -9800
- 상태: **FAIL_MULTI**

### CAT06_D40_Bcode — 2025100002|00011
- 입력: insuCode=D10, dosDate=20251028, age=77, drugs=7종, sbrdnType=B009, NIGHT
- 기대: totalPrice=353630, userPrice=500, pubPrice=353130
- 실제: totalPrice=350850, userPrice=500, pubPrice=350350
- 차이: totalPrice -2780, pubPrice -2780
- 상태: **FAIL_MULTI**

### CAT07_D80_exempt — 2022040002|00152
- 입력: insuCode=D80, dosDate=20220410, age=63, drugs=4종, HOL
- 기대: totalPrice=19660, userPrice=0, pubPrice=19660
- 실제: totalPrice=16650, userPrice=0, pubPrice=16650
- 차이: totalPrice -3010, pubPrice -3010
- 상태: **FAIL_MULTI**

### CAT07_D80_exempt — 2022040003|00152
- 입력: insuCode=D80, dosDate=20220410, age=63, drugs=4종, HOL
- 기대: totalPrice=19660, userPrice=0, pubPrice=19660
- 실제: totalPrice=16650, userPrice=0, pubPrice=16650
- 차이: totalPrice -3010, pubPrice -3010
- 상태: **FAIL_MULTI**

### CAT08_G10_bohun_exempt — 2025100003|00018
- 입력: insuCode=G10, dosDate=20251031, age=80, drugs=14종, NIGHT
- 기대: totalPrice=429190, userPrice=0, pubPrice=429190
- 실제: totalPrice=425800, userPrice=0, pubPrice=425800
- 차이: totalPrice -3390, pubPrice -3390
- 상태: **FAIL_MULTI**

### CAT08_G10_bohun_exempt — 2025100003|00012
- 입력: insuCode=G10, dosDate=20251030, age=91, drugs=15종, HOL
- 기대: totalPrice=246420, userPrice=0, pubPrice=246420
- 실제: totalPrice=243030, userPrice=0, pubPrice=243030
- 차이: totalPrice -3390, pubPrice -3390
- 상태: **FAIL_MULTI**

### CAT10_G20_bohun — 2025100003|00005
- 입력: insuCode=G20, dosDate=20251030, age=79, drugs=16종, NIGHT
- 기대: totalPrice=308520, userPrice=0, pubPrice=308520
- 실제: totalPrice=305130, userPrice=0, pubPrice=305130
- 차이: totalPrice -3390, pubPrice -3390
- 상태: **FAIL_MULTI**

### CAT11_E10_vcode_H024 — 2025100001|02502
- 입력: insuCode=C10, dosDate=20251031, age=53, drugs=8종, vcode=V223
- 기대: totalPrice=81360, userPrice=8100, pubPrice=73260
- 실제: totalPrice=89050, userPrice=26700, pubPrice=62350
- 차이: totalPrice +7690, userPrice +18600, pubPrice -10910
- 상태: **FAIL_MULTI**

### CAT12_E20_vcode_H124 — 2025080002|00155
- 입력: insuCode=D20, dosDate=20250804, age=44, drugs=5종, vcode=V252
- 기대: totalPrice=195190, userPrice=5850, pubPrice=189340
- 실제: totalPrice=215600, userPrice=6460, pubPrice=209140
- 차이: totalPrice +20410, userPrice +610, pubPrice +19800
- 상태: **FAIL_MULTI**

### CAT13_B024_etc — 2018060004|00001
- 입력: insuCode=G10, dosDate=20180620, age=67, drugs=4종
- 기대: totalPrice=190350, userPrice=28500, pubPrice=95180
- 실제: totalPrice=170100, userPrice=0, pubPrice=170100
- 차이: totalPrice -20250, userPrice -28500, pubPrice +74920
- 상태: **FAIL_MULTI**

### CAT13_B024_etc — 2018030004|00001
- 입력: insuCode=G10, dosDate=20180314, age=67, drugs=4종
- 기대: totalPrice=219190, userPrice=32800, pubPrice=109600
- 실제: totalPrice=198450, userPrice=0, pubPrice=198450
- 차이: totalPrice -20740, userPrice -32800, pubPrice +88850
- 상태: **FAIL_MULTI**

### CAT13_B024_etc — 2017120004|00001
- 입력: insuCode=G10, dosDate=20171213, age=66, drugs=4종
- 기대: totalPrice=204390, userPrice=30600, pubPrice=102200
- 실제: totalPrice=184360, userPrice=0, pubPrice=184360
- 차이: totalPrice -20030, userPrice -30600, pubPrice +82160
- 상태: **FAIL_MULTI**

### CAT14_saturday_H024 — 2025100001|00208
- 입력: insuCode=C10, dosDate=20251025, age=76, drugs=5종, SAT
- 기대: totalPrice=23260, userPrice=6900, pubPrice=16360
- 실제: totalPrice=26950, userPrice=8000, pubPrice=18950
- 차이: totalPrice +3690, userPrice +1100, pubPrice +2590
- 상태: **FAIL_MULTI**

### CAT14_saturday_H024 — 2025100001|00580
- 입력: insuCode=C10, dosDate=20251025, age=74, drugs=6종, SAT
- 기대: totalPrice=175900, userPrice=52700, pubPrice=123200
- 실제: totalPrice=188170, userPrice=56400, pubPrice=131770
- 차이: totalPrice +12270, userPrice +3700, pubPrice +8570
- 상태: **FAIL_MULTI**

### CAT14_saturday_H024 — 2025100001|00749
- 입력: insuCode=C10, dosDate=20251025, age=46, drugs=3종, SAT
- 기대: totalPrice=132310, userPrice=39600, pubPrice=92710
- 실제: totalPrice=144220, userPrice=43200, pubPrice=101020
- 차이: totalPrice +11910, userPrice +3600, pubPrice +8310
- 상태: **FAIL_MULTI**

### CAT15_holiday_H024 — 2025100001|00079
- 입력: insuCode=C10, dosDate=20251008, age=77, drugs=6종, HOL, NIGHT
- 기대: totalPrice=220350, userPrice=66100, pubPrice=154250
- 실제: totalPrice=221350, userPrice=66400, pubPrice=154950
- 차이: totalPrice +1000, userPrice +300, pubPrice +700
- 상태: **FAIL_MULTI**

### CAT15_holiday_H024 — 2025100001|00080
- 입력: insuCode=C10, dosDate=20251008, age=77, drugs=3종, HOL
- 기대: totalPrice=222080, userPrice=66600, pubPrice=155480
- 실제: totalPrice=196760, userPrice=59000, pubPrice=137760
- 차이: totalPrice -25320, userPrice -7600, pubPrice -17720
- 상태: **FAIL_MULTI**

### CAT15_holiday_H024 — 2025100001|00228
- 입력: insuCode=C10, dosDate=20251008, age=75, drugs=3종, HOL
- 기대: totalPrice=186860, userPrice=56000, pubPrice=130860
- 실제: totalPrice=187860, userPrice=56300, pubPrice=131560
- 차이: totalPrice +1000, userPrice +300, pubPrice +700
- 상태: **FAIL_MULTI**

### CAT16_under6_H024 — 2025100001|02366
- 입력: insuCode=C10, dosDate=20251031, age=3, drugs=5종
- 기대: totalPrice=18660, userPrice=3900, pubPrice=14760
- 실제: totalPrice=20670, userPrice=4300, pubPrice=16370
- 차이: totalPrice +2010, userPrice +400, pubPrice +1610
- 상태: **FAIL_MULTI**

> ... 외 41건 FAIL (지면상 생략)


## ERROR 분석

- **2010120001|02738** (CAT32_V206): 약품 행 없음 (DrugItem 변환 결과 0건)
- **2010090001|02589** (CAT32_V206): 약품 행 없음 (DrugItem 변환 결과 0건)
- **2010090009|02590** (CAT32_V206): 약품 행 없음 (DrugItem 변환 결과 0건)

## 종합 진단

### FAIL 카테고리 목록
CAT05_D20_general(2건), CAT06_D40_Bcode(1건), CAT07_D80_exempt(2건), CAT08_G10_bohun_exempt(2건), CAT10_G20_bohun(1건), CAT11_E10_vcode_H024(1건), CAT12_E20_vcode_H124(1건), CAT13_B024_etc(3건), CAT14_saturday_H024(3건), CAT15_holiday_H024(3건), CAT16_under6_H024(2건), CAT19_child_holiday(3건), CAT23_D20_age65(1건), CAT24_G20_Etc3(1건), CAT26_100pct_self(3건), CAT27_covid19(3건), CAT29_sanje(1건), CAT30_V103(3건), CAT31_V252(3건), CAT33_V246(3건), CAT35_seonbyulgup_diffamt(1건), CAT38_chaedung_applied(3건), CAT40_chaedung_with_vcode(2건), CAT44_holiday_general(3건), CAT47_days7(2건), CAT48_days15(2건), CAT49_days30(1건), CAT50_days60(2건), CAT51_bohun_Zcode(2건), CAT53_bohun_Etc2_Zcode(1건)

### FAIL 유형별 분포
- FAIL_MULTI: 61건

### 패턴별 실패 원인 분류

#### [Pattern A] 토요/공휴일 가산 단가 불일치 — 영향: CAT14, CAT15, CAT19, CAT44
- **원인**: `applySaturdaySurchargeRows`가 기본 Z코드(Z2000=1660원)를 토요 가산에 그대로 복사
- **실제**: 윈팜 Z2000030=500원, Z3000030=330원 (별도 고시 가산 단가)
- **진단**: calc-engine이 sugaMap의 `{code}030` 단가를 조회하지 않고 기본 단가 복사 → 가산 과다 계산
- **해결**: `applySaturdaySurchargeRows`에서 sugaMap 조회로 수정 (calc-engine 수정 필요)

#### [Pattern B] U항(100%자부담) totalPrice 합산 방식 차이 — 영향: CAT26, CAT05(일부)
- **원인**: 윈팜 `TotPrePri`는 U항 약품 제외한 급여분만, calc-engine `totalPrice`는 U항 포함
- **해결**: U항 혼재 케이스는 `totalPrice2` 또는 급여분만 별도 비교 기준 사용

#### [Pattern C] 약품 take 미분류로 인한 조제료 오계산 — 영향: CAT08, CAT10 등 (±3390원)
- **원인**: EDI코드 앞자리 기반 take 추정의 한계 (마스터DB 없음)
- **잔여 차이 3390원**: Z4121 있는 케이스에서 외용 DrugItem 분류 오류 → 내복+외용 동시조제료 누락
- **해결**: H0243 추출 시 약품별 剂型 정보 포함 또는 마스터 테이블 조인

#### [Pattern D] ZH001/ZH003(한방 수가) 미지원 — 영향: CAT07(00152)
- **원인**: 한방 조제료 calc-engine 범위 밖 → 3010원 차이
- **해결**: 한방 케이스는 검증 범위 제외

#### [Pattern E] 산정특례 요율 하드코딩 오류 — 영향: CAT30(V103), CAT31(V252), CAT33(V246)
- **원인**: getMediIllnessInfo 하드코딩 요율이 실제 HIRA 고시와 다를 수 있음
- **해결**: Supabase 실제 DB 연결

#### [Pattern F] 차등수가 미반영 — 영향: CAT38, CAT40
- **원인**: isChadungExempt 플래그 미설정 또는 calc-engine 차등수가 로직과 방식 차이
- **해결**: 차등수가 케이스 별도 분석

#### [Pattern G] ERROR — CAT32(V206)
- **원인**: 2010년 구버전 데이터의 CodeGubun 형식 차이 → DrugItem 변환 0건
- **해결**: 2010년 이전 데이터 컬럼 형식 확인

### 100% 일치 카테고리 (calc-engine 정상 동작 확인)
CAT01_C10, CAT02_C20_65-74, CAT03_C20_75plus, CAT04_D10_Mcode, CAT17_age65to74_H024, CAT18_age75plus_H024, CAT21_D10_Mcode_1000, CAT28_self_injection, CAT39_chaedung_nonapplied, CAT45_weekday_control, CAT46_days1
총 **11개** 카테고리 완전 일치


### 다음 액션 권장
1. **[즉시/calc-engine]** `applySaturdaySurchargeRows`에서 sugaMap의 `{code}030` 단가 직접 조회하도록 수정 → CAT14/15/44 FAIL 해소 예상
2. **[A2 재실행]** H0243 추출에 `OneEatQuan`(1회투약량) 컬럼 추가 → dose 역산 오류 제거
3. **[DB 연결]** Supabase 실제 insu_rate, medi_illness_info 연결 → 산정특례/요율 오류 해소
4. **[설계 확인]** U항 혼재 케이스의 totalPrice 비교 기준 합의
5. **[마스터DB]** 약품별 take(내복/외용/주사) 분류 마스터 테이블 연계 → Pattern C 해소
6. **[검증 제외]** ZH001/ZH003 한방 수가 포함 케이스 제외 처리
