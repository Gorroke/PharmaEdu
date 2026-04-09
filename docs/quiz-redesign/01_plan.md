# 퀴즈 시스템 개선 — 작업 계획

작성: 2026-04-08
전제: **기존 quiz_question / quiz_templates / drug_master 시드는 전부 초기화 후 새로 넣는다.**

## 목표

1. 임상적으로 말되는 처방 조합만 생성 (영유아에 항고혈압제 X)
2. 단순 계산 외에 다양한 문제 유형 (multi_step / error_spot / fill_blank / matching) 자동 생성
3. 교육 시스템답게 맥락(시나리오) 있는 문제
4. **무한 생성 가능성**(랜덤 파라미터)과 **교육성**의 양립

## 전략 — wipe & reseed

기존 시드를 보존할 필요 없으므로:
- 새 마이그레이션 추가 안 함, **seed.sql 재작성**으로 끝냄
- 단, drug_master에 `clinical_group` 컬럼이 없으므로 신규 마이그레이션 1개 필요
- 또는 `drug_master` 자체를 재설계 (apply_year, is_powder 외에 group 필드 추가)

## 1. drug_master 재설계

### 추가 컬럼
- `clinical_group VARCHAR(30)` — 임상 그룹 (e.g. `cold`, `hypertension`, `diabetes`, `pediatric_uri`, `chronic_pain`)
- `age_min SMALLINT` / `age_max SMALLINT` — 적합 연령 범위 (NULL=무관)
- `typical_dose NUMERIC(4,2)` — 표준 1회 투약량 (랜덤화 시 ±변동)
- `typical_dnum SMALLINT` — 표준 1일 투여횟수
- `typical_dday_min/max SMALLINT` — 표준 처방일수 범위

### 임상 그룹 예시 (10~12개 정도)
| group | 설명 | 대표 ATC | 연령 |
|---|---|---|---|
| `cold_adult` | 성인 감기 (해열진통+항히스타민+진해) | analgesic, antitussive, antihist | 12+ |
| `cold_pediatric` | 소아 감기 (시럽 위주) | antitussive, antihist | 0~12 |
| `pediatric_uri_abx` | 소아 상기도 항생제 | antibiotic | 0~12 |
| `hypertension_mono` | 고혈압 단일제 | antihypertensive | 30+ |
| `hypertension_combo` | 고혈압 복합 (HTN+이뇨) | antihypertensive, diuretic | 40+ |
| `diabetes_t2` | 2형 당뇨 (메트포민±) | antidiabetic | 30+ |
| `htn_dm_combo` | 고혈압+당뇨 만성 동반 | antihypertensive, antidiabetic | 50+ |
| `gerd_acute` | 위염/역류 단기 | antacid, ppi | 20+ |
| `chronic_pain` | 만성통증 (NSAID 장기) | analgesic | 40+ |
| `elderly_polypharmacy` | 노인 다약제 (5종+) | mixed | 65+ |

### 시드 분량
- 그룹당 약품 3~6종 → 총 40~60 entries

## 2. quiz_templates 재설계

### 컬럼 추가 (마이그레이션)
기존 컬럼 충분하지만 시나리오 라벨이 없음:
- `scenario_label VARCHAR(60)` — "감기 처방", "고혈압 단독", "노인 다약제" 등 사용자에게도 노출되는 라벨

또는 `param_schema` JSONB에 `scenarioLabel` 키만 추가해도 됨 (마이그레이션 회피).

### param_schema 확장
```json
{
  "age": {"min": 30, "max": 60},
  "drugCount": {"min": 1, "max": 2},
  "dayRange": {"min": 14, "max": 30},
  "doseChoices": [1],
  "dnumChoices": [1, 2],
  "scenarioLabel": "고혈압 단독 만성 처방",
  "clinicalGroups": ["hypertension_mono"]
}
```

### drug_pool_filter 활용
- `clinicalGroups: ["cold_adult"]` 형태로 필터링 → template-generator가 해당 그룹의 약품만 픽

### 시나리오별 템플릿 (난이도 × 시나리오 × 유형)
약 30~40개 템플릿:

| 난이도 | 시나리오 | 가능 유형 |
|---|---|---|
| 1 | 성인 감기 단일 처방 | drug-amount, copay, multi-step |
| 1 | 위염 단기 처방 | drug-amount, copay |
| 2 | 고혈압 단독 만성 | total, copay, multi-step |
| 2 | 소아 감기 (6세 미만 가산) | copay, multi-step, error-spot |
| 2 | 소아 항생제 + 시럽 | copay, fill-blank |
| 3 | 고혈압+당뇨 동반 | total, copay, multi-step |
| 3 | 노인 다약제 (65+) | copay, error-spot, multi-step |
| 3 | 의료급여 1종 환자 | copay, multi-step |
| 3 | 보훈 환자 | copay |

## 3. template-generator 확장

### A. 약품 선택 로직 수정
- `applyDrugPoolFilter` 에 `clinicalGroups` 분기 추가
- `buildDrugListFromMaster` 가 `typical_dose / typical_dnum / typical_dday` 사용 (랜덤 ±20% 변동)

### B. 새 question type 지원

#### multi_step (가장 우선)
calc-engine 결과를 단계별로 분해해서 4개 빈칸:
```
(1) 약품금액 합계 = ___
(2) 조제료 합계 = ___
(3) 총액1 = ___
(4) 본인부담금 = ___
```
- payload: `{ steps: ["약품금액","조제료","총액1","본인부담금"] }`
- correct_answer: `{"step1": 12340, "step2": 4030, "step3": 16370, "step4": 4910}`
- 평가: `evaluateMultiStep` 이 각 단계 ±1 허용 (이미 구현됨)

#### error_spot
의도적으로 한 단계의 결과를 ±10~50원 변조:
```
다음 명세서에서 잘못 계산된 항목을 고르시오.
(1) 약품금액 12,340원
(2) 조제료 4,030원
(3) 총액1 16,380원   ← 정답 (실제 16,370)
(4) 본인부담금 4,910원
```
- payload: `{ steps: [{label, value}, ...] }`
- correct_answer: 인덱스 문자열 ("2")

#### fill_blank
```
요양급여비용 총액 = ___ + ___ = ___
```
- payload: `{ template: "약품금액 ___ + 조제료 ___ = 총액 ___", labels: ["b1","b2","b3"] }`
- correct_answer: `{"b1": "12340", "b2": "4030", "b3": "16370"}`

### C. type 하드코딩 제거
`template-generator.ts:25` 에서 union 확장:
```ts
type TemplateType =
  | 'calc-copay' | 'calc-total' | 'calc-drug-amount'
  | 'multi-step' | 'error-spot' | 'fill-blank';
```
+ switch 분기 추가 (정답/payload 합성)

## 4. 마이그레이션 vs seed.sql 재작성

### 필요한 마이그레이션 (1개)
`20260408000001_clinical_groups.sql`:
```sql
ALTER TABLE drug_master
  ADD COLUMN clinical_group VARCHAR(30),
  ADD COLUMN age_min SMALLINT,
  ADD COLUMN age_max SMALLINT,
  ADD COLUMN typical_dose NUMERIC(4,2) DEFAULT 1,
  ADD COLUMN typical_dnum SMALLINT DEFAULT 1,
  ADD COLUMN typical_dday_min SMALLINT DEFAULT 1,
  ADD COLUMN typical_dday_max SMALLINT DEFAULT 7;

CREATE INDEX idx_drug_master_clinical_group ON drug_master(clinical_group);
```

### seed.sql 재작성 범위
- 852~ : drug_master DELETE + 새로운 약품 40~60건 INSERT (clinical_group 채워서)
- 1100~ : quiz_templates DELETE + 새로운 시나리오 템플릿 30~40건 INSERT
- 876~1098 : quiz_question (정적) — **유지**? 아니면 같이 재작성?
  - **결정 필요**: 유저는 "있던거 다 초기화" 라고 했음. 정적 퀴즈도 같이 재작성할 것인가?
  - 잠정: 정적 퀴즈도 챕터별로 더 알차게 재작성 (별도 단계)

## 작업 단계

| Step | 작업 | 산출물 |
|---|---|---|
| 1 | 마이그레이션 작성 (clinical_group 컬럼) | `20260408000001_clinical_groups.sql` |
| 2 | drug_master seed 재작성 (40~60건, 그룹별) | `seed.sql` 패치 |
| 3 | template-generator 확장 (clinicalGroups 필터) | `template-generator.ts` |
| 4 | template-generator 확장 (multi_step 지원) | `template-generator.ts` + 라우트 |
| 5 | quiz_templates seed 재작성 (시나리오 30+) | `seed.sql` 패치 |
| 6 | template-generator 확장 (error_spot, fill_blank) | `template-generator.ts` |
| 7 | dynamic page 렌더러 분기 (DynamicQuestion → QuizQuestion 정합) | `/quiz/dynamic/page.tsx` |
| 8 | (선택) dynamic-generator legacy 폐기 | 파일 삭제 + route 정리 |
| 9 | (선택) 정적 quiz_question 재작성 | `seed.sql` 패치 |

## 미결정 사항 (유저 확인 필요)

- **Q1**: 정적 `quiz_question` 시드도 같이 재작성? 아니면 동적만?
- **Q2**: legacy `dynamic-generator.ts` 폐기 OK? (template 단일화)
- **Q3**: `/quiz/dynamic` 페이지 — 현재 숫자 입력만 지원. multi_step/error_spot 오면 렌더러 교체 필요. 작업해도 됨?
- **Q4**: 마이그레이션 추가 vs 기존 005 마이그레이션 수정? (이미 적용된 환경이면 추가가 안전)
