# 퀴즈 시스템 개선 — 현황 분석

작성: 2026-04-08
상태: 분석 완료, 계획 단계

## 두 개의 퀴즈 시스템이 병존

### A. 정적 퀴즈 (`quiz_question` 테이블)
- 경로: `/quiz/play`
- 챕터 태그(CH01~CH12), 8개 question_type 지원
- seed.sql 880~ 줄: matching/ordering 등 교육적으로 잘 만든 문제 다수
  - 예: "Z코드 ↔ 조제료 항목 매칭", "가산 우선순위 정렬", "보험코드 ↔ 본인부담률 매칭"
- 힌트/code_glossary/drug_refs 채워져 있음
- **이 부분은 유지/확장 방향**

### B. 동적 퀴즈 (`/api/quiz/generate` → `/quiz/dynamic`)
- 두 개의 생성기:
  - `dynamic-generator.ts` — 하드코딩 legacy
  - `template-generator.ts` — `quiz_templates` DB 템플릿 기반
- **유형 단 3개**: `calc-drug-amount`, `calc-total`, `calc-copay` — 전부 숫자 입력 계산
- `quiz_templates` 시드(seed.sql 1100~1167) 9개 = **3 type × 3 난이도**, 다양성 0
- 답은 calc-engine으로 합성해서 무한 생성

## "얼토당토없음" 의 진짜 원인

`buildDrugList()` (dynamic-generator.ts:186) — drug_master에서 **완전 무작위로 N개 픽**:
- 5세 영유아한테 항고혈압제 + 항당뇨제 + 항생제 5종 처방 같은 게 나옴
- 단가/투약량/일수도 독립 랜덤 → 임상적으로 말도 안 되는 조합
- ATC class 기반 그룹핑 없음 (`drug_pool_filter.atc_class` 컬럼은 있지만 시드에서 안 씀)
- 연령-약품 적합성 검증 없음

## 큰 낭비: 신규 인프라가 동적 생성기에 안 연결됨

Phase 8에서 다 만들어놨는데 **사용 안 됨**:
- 렌더러 7개 (Matching/Ordering/FillBlank/ErrorSpot/MultiStep/MultipleChoice/Numeric)
  - 위치: `src/lib/quiz/renderers/`
- `evaluator.ts` — 8개 type 정답 비교 로직
- `quiz_question.payload` JSONB 컬럼 (마이그레이션 006)
- `quiz_templates.template_type`은 'etc.'까지 허용하는 VARCHAR(40)

→ `template-generator.ts:25` 에서 type을 `'calc-copay' | 'calc-total' | 'calc-drug-amount'` 로 **하드코딩** — 다른 type 추가 불가.

## 핵심 파일 위치

| 영역 | 경로 |
|---|---|
| 정적 퀴즈 시드 | `supabase/seed.sql` (876~1098 줄) |
| 동적 템플릿 시드 | `supabase/seed.sql` (1100~1167 줄) |
| drug_master 시드 | `supabase/seed.sql` (852~ 줄) |
| 동적 생성기 (legacy) | `src/lib/quiz/dynamic-generator.ts` |
| 동적 생성기 (template) | `src/lib/quiz/template-generator.ts` |
| API 라우트 | `src/app/api/quiz/generate/route.ts` |
| 렌더러 | `src/lib/quiz/renderers/` |
| Evaluator | `src/lib/quiz/evaluator.ts` |
| drug_master 마이그레이션 | `supabase/migrations/20260406000005_drug_master_and_hints.sql` |
| payload 컬럼 | `supabase/migrations/20260406000006_quiz_question_payload.sql` |
| quiz_templates 테이블 | `supabase/migrations/20260406000007_quiz_templates.sql` |
