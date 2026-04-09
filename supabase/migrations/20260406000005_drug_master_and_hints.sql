-- ============================================================
-- Migration: 20260406000005_drug_master_and_hints.sql
-- Purpose : 약품 마스터 테이블 생성 + quiz_question 힌트 컬럼 확장
--           (퀴즈 동적 생성 및 학습용 가상 약품 카탈로그 지원)
-- Created : 2026-04-08  (Phase 8, Team P0-A)
-- ============================================================

-- ── 약품 마스터 ────────────────────────────────────────────────
CREATE TABLE drug_master (
  edi_code      VARCHAR(9)   PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  unit_price    INTEGER      NOT NULL CHECK (unit_price >= 0),
  insu_pay_type CHAR(1)      NOT NULL DEFAULT 'C',  -- C=급여, N=비급여, S=선별
  is_powder     BOOLEAN      NOT NULL DEFAULT false,
  atc_class     VARCHAR(20),                         -- 'analgesic', 'antibiotic', 'antacid', 'antihypertensive', 'antidiabetic', 'antitussive' 등
  apply_year    SMALLINT     NOT NULL DEFAULT 2026,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE drug_master IS '약품 마스터 — 퀴즈 동적 생성 및 학습용 가상 약품 카탈로그';
COMMENT ON COLUMN drug_master.edi_code      IS 'EDI 청구 코드 (9자리)';
COMMENT ON COLUMN drug_master.name          IS '약품명 (한글)';
COMMENT ON COLUMN drug_master.unit_price    IS '단가 (원, 0 이상)';
COMMENT ON COLUMN drug_master.insu_pay_type IS '보험 지불 구분: C=급여, N=비급여, S=선별급여';
COMMENT ON COLUMN drug_master.is_powder     IS '산제 여부 (true=산제, false=일반)';
COMMENT ON COLUMN drug_master.atc_class     IS 'ATC 분류 (진통제, 항생제 등)';
COMMENT ON COLUMN drug_master.apply_year    IS '약가 적용 연도';

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE drug_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 읽기" ON drug_master
  FOR SELECT USING (true);

-- ── 인덱스 ─────────────────────────────────────────────────────
CREATE INDEX idx_drug_master_atc_class  ON drug_master (atc_class);
CREATE INDEX idx_drug_master_apply_year ON drug_master (apply_year);

-- ── quiz_question 힌트 컬럼 확장 ───────────────────────────────
ALTER TABLE quiz_question ADD COLUMN IF NOT EXISTS hints         JSONB;
ALTER TABLE quiz_question ADD COLUMN IF NOT EXISTS code_glossary JSONB;
ALTER TABLE quiz_question ADD COLUMN IF NOT EXISTS drug_refs     JSONB;

COMMENT ON COLUMN quiz_question.hints         IS '단계별 힌트 배열 (점진적 공개용 JSON)';
COMMENT ON COLUMN quiz_question.code_glossary IS '문제 내 코드/약어 용어집 (key-value JSON)';
COMMENT ON COLUMN quiz_question.drug_refs     IS '문제에서 참조하는 drug_master.edi_code 배열';
