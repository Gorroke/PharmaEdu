-- ============================================================
-- Migration: 20260406000007_quiz_templates.sql
-- Purpose : 동적 퀴즈 템플릿 테이블 생성
--           (DB 기반 동적 퀴즈 생성기 — 난이도/유형별 파라미터 풀)
-- Created : 2026-04-08  (Phase 8, Team P2-I)
-- ============================================================

-- ── 동적 퀴즈 템플릿 ───────────────────────────────────────────
CREATE TABLE quiz_templates (
  id               BIGSERIAL PRIMARY KEY,
  template_type    VARCHAR(40) NOT NULL,    -- 'calc-copay', 'calc-total', 'calc-drug-amount', etc.
  difficulty       SMALLINT NOT NULL,        -- 1=쉬움, 2=보통, 3=어려움
  insu_code_pool   TEXT[] NOT NULL,          -- ['C10','D10','G10']
  param_schema     JSONB NOT NULL,           -- {age:{min,max}, drugCount:{min,max}, dayRange:{min,max}, priceRange:{min,max}}
  prompt_template  TEXT NOT NULL,            -- with {age}, {insuName}, {drugList}, {question} placeholders
  answer_field     VARCHAR(20) NOT NULL,     -- 'totalPrice'|'userPrice'|'drugAmount'
  hint_template    JSONB,                    -- optional ["힌트1","힌트2"]
  drug_pool_filter JSONB,                    -- optional {atc_class:["analgesic","antibiotic"]}
  enabled          BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quiz_templates IS '동적 퀴즈 템플릿 — 난이도/유형별 파라미터 풀로 무한 문제 생성';
COMMENT ON COLUMN quiz_templates.template_type    IS '템플릿 유형 (calc-copay, calc-total, calc-drug-amount 등)';
COMMENT ON COLUMN quiz_templates.difficulty       IS '난이도: 1=쉬움, 2=보통, 3=어려움';
COMMENT ON COLUMN quiz_templates.insu_code_pool   IS '사용 가능한 보험 코드 풀';
COMMENT ON COLUMN quiz_templates.param_schema     IS '파라미터 범위 스키마 (age, drugCount, dayRange, priceRange)';
COMMENT ON COLUMN quiz_templates.prompt_template  IS '문제 본문 템플릿 ({varname} 치환 형식)';
COMMENT ON COLUMN quiz_templates.answer_field     IS '정답 필드 (totalPrice|userPrice|drugAmount)';
COMMENT ON COLUMN quiz_templates.hint_template    IS '점진적 힌트 배열 (JSONB)';
COMMENT ON COLUMN quiz_templates.drug_pool_filter IS '약품 풀 필터 (atc_class 등, JSONB)';
COMMENT ON COLUMN quiz_templates.enabled          IS '활성화 여부';

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE quiz_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 읽기" ON quiz_templates
  FOR SELECT USING (true);

-- ── 인덱스 ─────────────────────────────────────────────────────
CREATE INDEX idx_quiz_templates_difficulty ON quiz_templates (difficulty);
CREATE INDEX idx_quiz_templates_type       ON quiz_templates (template_type);
