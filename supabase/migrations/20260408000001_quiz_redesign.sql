-- ============================================================
-- Migration: 20260408000001_quiz_redesign.sql
-- Purpose : 퀴즈 시스템 통합 재설계 (clean slate)
--
--   - quiz_category    : 카테고리 (CH01~CH12)
--   - quiz_question    : 정적 문제 (payload/hints/code_glossary/drug_refs 포함)
--   - drug_master      : 약품 마스터 (clinical_group, 연령/투약 패턴 포함)
--   - quiz_templates   : 동적 템플릿 (scenario_label, 다양 type 지원)
--   - RPC get_random_questions
--
-- 본 마이그레이션은 기존 동일 이름 객체를 모두 DROP 후 재생성한다.
-- 이전 마이그레이션 002~007 (quiz/drug 관련) 의 super-set 이며,
-- 이 파일 단독 실행으로 퀴즈 시스템 DB 가 완성된다.
-- ============================================================

-- ── 0. 기존 객체 제거 (idempotent) ─────────────────────────────
DROP FUNCTION IF EXISTS get_random_questions(integer);
DROP TABLE    IF EXISTS quiz_templates CASCADE;
DROP TABLE    IF EXISTS quiz_question  CASCADE;
DROP TABLE    IF EXISTS quiz_category  CASCADE;
DROP TABLE    IF EXISTS drug_master    CASCADE;

-- ============================================================
-- 1. quiz_category
-- ============================================================
CREATE TABLE quiz_category (
  id          BIGSERIAL    PRIMARY KEY,
  slug        VARCHAR(40)  UNIQUE NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  description TEXT,
  icon        VARCHAR(40),
  order_idx   SMALLINT,
  chapter     VARCHAR(8)
);

COMMENT ON TABLE  quiz_category         IS '퀴즈 카테고리 — 챕터 매핑 + UI 노출 메타';
COMMENT ON COLUMN quiz_category.slug    IS 'URL slug (basic-calc, copayment 등)';
COMMENT ON COLUMN quiz_category.chapter IS '연결 챕터 (CH01~CH12)';

ALTER TABLE quiz_category ENABLE ROW LEVEL SECURITY;
CREATE POLICY "공개 읽기" ON quiz_category FOR SELECT USING (true);

CREATE INDEX idx_quiz_category_chapter   ON quiz_category(chapter);
CREATE INDEX idx_quiz_category_order_idx ON quiz_category(order_idx);

-- ============================================================
-- 2. quiz_question
-- ============================================================
CREATE TABLE quiz_question (
  id             BIGSERIAL    PRIMARY KEY,
  chapter        VARCHAR(8)   NOT NULL,
  difficulty     SMALLINT     NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  question_type  VARCHAR(20)  NOT NULL,
  question       TEXT         NOT NULL,
  choices        JSONB,
  correct_answer TEXT         NOT NULL,
  explanation    TEXT         NOT NULL,
  tags           TEXT[],
  payload        JSONB,
  hints          JSONB,
  code_glossary  JSONB,
  drug_refs      JSONB,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  quiz_question                IS '정적 퀴즈 문제 (시드 고정)';
COMMENT ON COLUMN quiz_question.question_type  IS 'multiple_choice | numeric | true_false | matching | ordering | fill_blank | error_spot | multi_step';
COMMENT ON COLUMN quiz_question.choices        IS '객관식/OX 선택지 (JSONB string[])';
COMMENT ON COLUMN quiz_question.correct_answer IS '정답 (유형별 직렬화 — 인덱스/숫자/JSON)';
COMMENT ON COLUMN quiz_question.payload        IS '유형별 추가 데이터 (matching pairs / ordering items / fill_blank slots / multi_step steps 등)';
COMMENT ON COLUMN quiz_question.hints          IS '단계별 점진적 힌트 (JSON 배열)';
COMMENT ON COLUMN quiz_question.code_glossary  IS '코드/약어 용어집 ([{code, name, note}])';
COMMENT ON COLUMN quiz_question.drug_refs      IS '참조 약품 ([{code, name}])';

ALTER TABLE quiz_question ENABLE ROW LEVEL SECURITY;
CREATE POLICY "공개 읽기" ON quiz_question FOR SELECT USING (true);

CREATE INDEX idx_quiz_question_chapter    ON quiz_question(chapter);
CREATE INDEX idx_quiz_question_difficulty ON quiz_question(difficulty);
CREATE INDEX idx_quiz_question_type       ON quiz_question(question_type);

-- ============================================================
-- 3. drug_master
-- ============================================================
CREATE TABLE drug_master (
  edi_code         VARCHAR(9)   PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  unit_price       INTEGER      NOT NULL CHECK (unit_price >= 0),
  insu_pay_type    CHAR(1)      NOT NULL DEFAULT 'C',
  is_powder        BOOLEAN      NOT NULL DEFAULT false,
  atc_class        VARCHAR(20),
  clinical_group   VARCHAR(30),
  age_min          SMALLINT,
  age_max          SMALLINT,
  typical_dose     NUMERIC(4,2) NOT NULL DEFAULT 1,
  typical_dnum     SMALLINT     NOT NULL DEFAULT 1,
  typical_dday_min SMALLINT     NOT NULL DEFAULT 1,
  typical_dday_max SMALLINT     NOT NULL DEFAULT 7,
  apply_year       SMALLINT     NOT NULL DEFAULT 2026,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  drug_master                 IS '약품 마스터 — 임상 그룹 기반 처방 시뮬레이션';
COMMENT ON COLUMN drug_master.edi_code        IS 'EDI 청구 코드 (9자리)';
COMMENT ON COLUMN drug_master.insu_pay_type   IS 'C=급여, N=비급여, S=선별급여';
COMMENT ON COLUMN drug_master.atc_class       IS 'ATC 분류 (analgesic, antibiotic, antihypertensive 등)';
COMMENT ON COLUMN drug_master.clinical_group  IS '임상 그룹 (cold_adult, hypertension_mono 등) — 함께 처방되는 약품 묶음';
COMMENT ON COLUMN drug_master.age_min         IS '최소 적합 연령 (NULL=무관)';
COMMENT ON COLUMN drug_master.age_max         IS '최대 적합 연령 (NULL=무관)';
COMMENT ON COLUMN drug_master.typical_dose    IS '표준 1회 투약량';
COMMENT ON COLUMN drug_master.typical_dnum    IS '표준 1일 투여횟수';
COMMENT ON COLUMN drug_master.typical_dday_min IS '표준 처방일수 하한';
COMMENT ON COLUMN drug_master.typical_dday_max IS '표준 처방일수 상한';

ALTER TABLE drug_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "공개 읽기" ON drug_master FOR SELECT USING (true);

CREATE INDEX idx_drug_master_clinical_group ON drug_master(clinical_group);
CREATE INDEX idx_drug_master_atc_class      ON drug_master(atc_class);
CREATE INDEX idx_drug_master_apply_year     ON drug_master(apply_year);

-- ============================================================
-- 4. quiz_templates
-- ============================================================
CREATE TABLE quiz_templates (
  id               BIGSERIAL    PRIMARY KEY,
  template_type    VARCHAR(40)  NOT NULL,
  difficulty       SMALLINT     NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  scenario_label   VARCHAR(60),
  insu_code_pool   TEXT[]       NOT NULL,
  param_schema     JSONB        NOT NULL,
  prompt_template  TEXT         NOT NULL,
  answer_field     VARCHAR(20)  NOT NULL,
  hint_template    JSONB,
  drug_pool_filter JSONB,
  enabled          BOOLEAN      NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE  quiz_templates                  IS '동적 퀴즈 템플릿 — 시나리오 + 파라미터 풀로 무한 문제 생성';
COMMENT ON COLUMN quiz_templates.template_type    IS 'calc-copay | calc-total | calc-drug-amount | multi-step | error-spot | fill-blank';
COMMENT ON COLUMN quiz_templates.scenario_label   IS '시나리오 라벨 ("성인 감기", "고혈압 단독" 등) — UI 노출';
COMMENT ON COLUMN quiz_templates.insu_code_pool   IS '사용 보험 코드 풀';
COMMENT ON COLUMN quiz_templates.param_schema     IS '파라미터 범위 ({age, drugCount, dayRange, doseChoices, dnumChoices, ...})';
COMMENT ON COLUMN quiz_templates.prompt_template  IS '프롬프트 템플릿 ({difficultyLabel}, {insuName}, {ageDesc}, {drugListText}, {questionText} 치환)';
COMMENT ON COLUMN quiz_templates.answer_field     IS 'totalPrice | userPrice | drugAmount | multiStep | errorSpot | fillBlank';
COMMENT ON COLUMN quiz_templates.hint_template    IS '점진적 힌트 배열';
COMMENT ON COLUMN quiz_templates.drug_pool_filter IS '약품 풀 필터 — {clinicalGroups:[...], atc_class:[...]}';

ALTER TABLE quiz_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "공개 읽기" ON quiz_templates FOR SELECT USING (true);

CREATE INDEX idx_quiz_templates_difficulty ON quiz_templates(difficulty);
CREATE INDEX idx_quiz_templates_type       ON quiz_templates(template_type);
CREATE INDEX idx_quiz_templates_enabled    ON quiz_templates(enabled);

-- ============================================================
-- 5. RPC: get_random_questions(n)
-- ============================================================
CREATE OR REPLACE FUNCTION get_random_questions(n INTEGER)
RETURNS SETOF quiz_question
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT * FROM quiz_question
  ORDER BY random()
  LIMIT GREATEST(0, COALESCE(n, 0));
$$;

GRANT EXECUTE ON FUNCTION get_random_questions(INTEGER) TO anon, authenticated;

COMMENT ON FUNCTION get_random_questions(INTEGER) IS 'DB-side 무작위 N개 문제 샘플링 (lib/quiz/client.ts 에서 호출)';
