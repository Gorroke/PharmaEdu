-- ============================================================
-- Migration: 20260406000006_quiz_question_payload.sql
-- Purpose : quiz_question.payload JSONB 컬럼 추가
--           (matching / ordering / fill_blank / error_spot / multi_step
--            등 신규 문제 유형의 렌더러 전용 데이터 저장)
-- Created : 2026-04-08  (Phase 8, Team P1-H)
-- ============================================================

ALTER TABLE quiz_question
  ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN quiz_question.payload IS
  '문제 유형별 추가 데이터 (matching/ordering/fill_blank/error_spot/multi_step 등)';
