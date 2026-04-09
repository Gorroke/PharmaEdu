-- ============================================================
-- seeds/quiz_redesign.sql
-- 퀴즈 시스템 시드 데이터 (clean-slate 재시드)
--
-- 실행 전제: 마이그레이션 20260408000001_quiz_redesign.sql 가 적용된 상태.
-- 본 스크립트는 quiz_category / drug_master / quiz_question / quiz_templates
-- 4개 테이블에 시드를 삽입한다.
--
-- 멱등성: 각 섹션 시작에 DELETE 가 있어 여러 번 실행 가능.
-- ============================================================

-- ============================================================
-- 1. quiz_category (12 개 — CH01~CH12)
-- ============================================================
DELETE FROM quiz_category;

INSERT INTO quiz_category (slug, name, description, icon, order_idx, chapter) VALUES
('basic-calc',     '기본 계산',     '약품금액 · 조제료 등 처방전 계산의 기초',         'calculator', 1,  'CH01'),
('drug-amount',    '약품금액 산출', '단가 × 투약량 × 횟수 × 일수, 사사오입 규칙',     'pill',       2,  'CH02'),
('dispensing-fee', '조제료',        'Z코드 기반 조제 수가 산정',                         'receipt',    3,  'CH03'),
('rounding',       '반올림 · 절사', '4사5입과 10원 단위 절사 규칙',                     'sigma',      4,  'CH04'),
('copayment',      '본인부담금',    '보험별 / 연령별 본인부담률 적용',                    'wallet',     5,  'CH05'),
('insu-type',      '보험 유형',     'C10/D10/G10/V10 등 보험 종별 특성',                'shield',     6,  'CH06'),
('surcharge',      '가산',          '야간 · 토요 · 소아심야 · 산제 가산',                'plus',       7,  'CH07'),
('special-case',   '특수 케이스',   '영유아 · 노인 · 의료급여 등 특수 산정',             'star',       8,  'CH08'),
('data-model',     '데이터 모델',   'CalcOptions / DrugItem / Enum 정의',                'database',   9,  'CH09'),
('claim-form',     '명세서',        '항번호 · 청구 명세서 구조',                         'file-text',  10, 'CH10'),
('insurance-rate', '보험 수가',     'suga 테이블 / insurance_rate 구조',                  'percent',    11, 'CH11'),
('integration',    '통합 시나리오', '복합 처방 · 만성질환 · 영유아 시나리오',           'puzzle',     12, 'CH12');

-- ============================================================
-- 2. drug_master  (약 50 건, 11 개 임상 그룹)
--
-- 임상 그룹 일람:
--   cold_adult            성인 감기 (해열진통 + 항히스타민 + 진해)
--   cold_pediatric        소아 감기 (시럽 위주, 6세 미만 가능)
--   pediatric_uri_abx     소아 상기도 항생제
--   pediatric_ent         소아 비염 / 축농증
--   hypertension_mono     고혈압 단일제 (성인)
--   hypertension_combo    고혈압 복합 (HTN + 이뇨제)
--   diabetes_t2           2형 당뇨 (메트포민 등)
--   htn_dm_combo          고혈압 + 당뇨 동반 (만성)
--   gerd_acute            위염 / 역류 단기
--   chronic_pain          만성 통증 (NSAID 장기)
--   elderly_polypharmacy  노인 다약제 (5종 이상)
-- ============================================================
DELETE FROM drug_master;

INSERT INTO drug_master
  (edi_code, name, unit_price, insu_pay_type, is_powder, atc_class, clinical_group, age_min, age_max, typical_dose, typical_dnum, typical_dday_min, typical_dday_max, apply_year)
VALUES

-- ── cold_adult (성인 감기) ─────────────────────────────────────
('100100010', '타이레놀정 500mg',      80,  'C', false, 'analgesic',   'cold_adult', 12, NULL, 1,   3, 3, 7,  2026),
('100100020', '판콜에이정',           120,  'C', false, 'cold_combo',  'cold_adult', 12, NULL, 1,   3, 3, 5,  2026),
('100100030', '코푸시럽',             180,  'C', false, 'antitussive', 'cold_adult', 12, NULL, 1,   3, 3, 7,  2026),
('100100040', '알레그라정 120mg',     220,  'C', false, 'antihist',    'cold_adult', 12, NULL, 1,   1, 5, 7,  2026),
('100100050', '액티피드정',            95,  'C', false, 'antihist',    'cold_adult', 12, NULL, 1,   3, 3, 5,  2026),
('100100060', '뮤코펙트정 30mg',       90,  'C', false, 'mucolytic',   'cold_adult', 12, NULL, 1,   3, 5, 7,  2026),

-- ── cold_pediatric (소아 감기, 시럽) ───────────────────────────
('100200010', '챔프시럽 (소아용)',    240,  'C', false, 'analgesic',   'cold_pediatric', 0, 12, 1, 3, 3, 5,  2026),
('100200020', '콜대원키즈펜시럽',     280,  'C', false, 'cold_combo',  'cold_pediatric', 1, 12, 1, 3, 3, 5,  2026),
('100200030', '코푸시럽S (소아)',     220,  'C', false, 'antitussive', 'cold_pediatric', 2, 12, 1, 3, 3, 7,  2026),
('100200040', '지르텍시럽',           260,  'C', false, 'antihist',    'cold_pediatric', 2, 12, 1, 1, 5, 7,  2026),
('100200050', '뮤코펙트시럽',         200,  'C', false, 'mucolytic',   'cold_pediatric', 0, 12, 1, 3, 5, 7,  2026),

-- ── pediatric_uri_abx (소아 항생제) ────────────────────────────
('100300010', '오구멘틴듀오시럽',     650,  'C', false, 'antibiotic',  'pediatric_uri_abx', 0, 12, 1, 2, 5, 7,  2026),
('100300020', '세파클러시럽',         480,  'C', false, 'antibiotic',  'pediatric_uri_abx', 1, 12, 1, 3, 5, 7,  2026),
('100300030', '클래리시드시럽',       580,  'C', false, 'antibiotic',  'pediatric_uri_abx', 0, 12, 1, 2, 5, 7,  2026),
('100300040', '아목시실린건조시럽',   320,  'C', false, 'antibiotic',  'pediatric_uri_abx', 0, 12, 1, 3, 5, 7,  2026),

-- ── pediatric_ent (소아 비염/축농증) ───────────────────────────
('100400010', '알레그라시럽',         310,  'C', false, 'antihist',    'pediatric_ent', 2, 12, 1, 1, 5, 14, 2026),
('100400020', '무코다인시럽',         260,  'C', false, 'mucolytic',   'pediatric_ent', 0, 12, 1, 3, 5, 14, 2026),
('100400030', '슈도에페드린시럽',     220,  'C', false, 'decongestant','pediatric_ent', 2, 12, 1, 3, 5, 7,  2026),
('100400040', '나잘스프레이 (소아)',  580,  'C', false, 'nasal_spray', 'pediatric_ent', 6, 12, 1, 2, 7, 14, 2026),

-- ── hypertension_mono (고혈압 단일) ────────────────────────────
('200100010', '노바스크정 5mg',       125,  'C', false, 'antihtn',     'hypertension_mono', 30, NULL, 1, 1, 28, 90, 2026),
('200100020', '아타칸정 8mg',         155,  'C', false, 'antihtn',     'hypertension_mono', 30, NULL, 1, 1, 28, 90, 2026),
('200100030', '코자정 50mg',          145,  'C', false, 'antihtn',     'hypertension_mono', 30, NULL, 1, 1, 28, 90, 2026),
('200100040', '디오반정 80mg',        185,  'C', false, 'antihtn',     'hypertension_mono', 30, NULL, 1, 1, 28, 90, 2026),
('200100050', '트윈스타정 40/5mg',    420,  'C', false, 'antihtn',     'hypertension_mono', 30, NULL, 1, 1, 28, 90, 2026),

-- ── hypertension_combo (고혈압 복합) ───────────────────────────
('200200010', '코디오반정 80/12.5mg', 280,  'C', false, 'antihtn',     'hypertension_combo', 40, NULL, 1, 1, 28, 90, 2026),
('200200020', '아모잘탄정 5/50mg',    310,  'C', false, 'antihtn',     'hypertension_combo', 40, NULL, 1, 1, 28, 90, 2026),
('200200030', '엑스포지정 5/80mg',    380,  'C', false, 'antihtn',     'hypertension_combo', 40, NULL, 1, 1, 28, 90, 2026),
('200200040', '다이크로짇정 25mg',     45,  'C', false, 'diuretic',    'hypertension_combo', 40, NULL, 1, 1, 28, 60, 2026),

-- ── diabetes_t2 (2형 당뇨) ─────────────────────────────────────
('200300010', '다이아벡스정 500mg',    50,  'C', false, 'antidm',      'diabetes_t2', 30, NULL, 1, 2, 30, 90, 2026),
('200300020', '글리메피리드정 2mg',    65,  'C', false, 'antidm',      'diabetes_t2', 30, NULL, 1, 1, 30, 90, 2026),
('200300030', '자누비아정 100mg',     720,  'C', false, 'antidm',      'diabetes_t2', 30, NULL, 1, 1, 30, 90, 2026),
('200300040', '트라젠타정 5mg',       695,  'C', false, 'antidm',      'diabetes_t2', 30, NULL, 1, 1, 30, 90, 2026),
('200300050', '포시가정 10mg',        850,  'C', false, 'antidm',      'diabetes_t2', 30, NULL, 1, 1, 30, 90, 2026),

-- ── htn_dm_combo (고혈압+당뇨 동반) ────────────────────────────
-- 이 그룹은 위 hypertension_mono + diabetes_t2 조합으로도 만들 수 있어
-- 별도 약품 시드는 최소만. 아토르바스타틴(스타틴) 추가.
('200400010', '리피토정 20mg',        260,  'C', false, 'statin',      'htn_dm_combo', 50, NULL, 1, 1, 30, 90, 2026),
('200400020', '크레스토정 10mg',      310,  'C', false, 'statin',      'htn_dm_combo', 50, NULL, 1, 1, 30, 90, 2026),

-- ── gerd_acute (위염/역류 단기) ────────────────────────────────
('300100010', '넥시움정 20mg',        730,  'C', false, 'ppi',         'gerd_acute', 18, NULL, 1, 1, 14, 28, 2026),
('300100020', '란스톤LFDT정 30mg',    520,  'C', false, 'ppi',         'gerd_acute', 18, NULL, 1, 1, 14, 28, 2026),
('300100030', '가스모틴정 5mg',       110,  'C', false, 'prokinetic',  'gerd_acute', 18, NULL, 1, 3, 7,  14, 2026),
('300100040', '무코스타정 100mg',      90,  'C', false, 'gastromuc',   'gerd_acute', 18, NULL, 1, 3, 7,  14, 2026),
('300100050', '겔포스현탁액',         180,  'C', false, 'antacid',     'gerd_acute', 12, NULL, 1, 3, 7,  14, 2026),

-- ── chronic_pain (만성 통증, NSAID 장기) ───────────────────────
('400100010', '쎄레브렉스캡슐 200mg', 540,  'C', false, 'nsaid_cox2',  'chronic_pain', 30, NULL, 1, 1, 14, 60, 2026),
('400100020', '록소닌정 60mg',        180,  'C', false, 'nsaid',       'chronic_pain', 30, NULL, 1, 3, 7,  30, 2026),
('400100030', '낙센정 250mg',         110,  'C', false, 'nsaid',       'chronic_pain', 30, NULL, 1, 2, 7,  30, 2026),
('400100040', '울트라셋이알서방정',   320,  'C', false, 'opioid_mild', 'chronic_pain', 30, NULL, 1, 2, 7,  30, 2026),
('400100050', '뉴트리브정',           160,  'C', false, 'gastromuc',   'chronic_pain', 30, NULL, 1, 2, 14, 60, 2026),

-- ── elderly_polypharmacy (노인 다약제) ─────────────────────────
-- 이 그룹은 위 그룹들 약품을 그대로 활용. 별도 시드는 노인 특이 약품만.
('500100010', '아리셉트정 5mg',       950,  'C', false, 'dementia',    'elderly_polypharmacy', 65, NULL, 1, 1, 30, 90, 2026),
('500100020', '프로페시아정',         480,  'N', false, 'misc',        'elderly_polypharmacy', 65, NULL, 1, 1, 30, 90, 2026),
('500100030', '알닥톤정 25mg',         60,  'C', false, 'diuretic',    'elderly_polypharmacy', 65, NULL, 1, 1, 30, 60, 2026),
('500100040', '플라빅스정 75mg',      890,  'C', false, 'antiplatelet','elderly_polypharmacy', 65, NULL, 1, 1, 30, 90, 2026),
('500100050', '오메가3캡슐',          180,  'N', false, 'misc',        'elderly_polypharmacy', 65, NULL, 1, 1, 30, 60, 2026);


-- ============================================================
-- 3. quiz_question  (정적 — 약 50 건, 다양 유형)
--
-- 분배:
--   multiple_choice (객관식)   : 18
--   numeric          (숫자)    :  6
--   true_false       (OX)      :  4
--   matching         (매칭)    :  8
--   ordering         (정렬)    :  4
--   fill_blank       (빈칸)    :  4
--   error_spot       (오류찾기): 3
--   multi_step       (단계계산): 3
-- ============================================================
DELETE FROM quiz_question;

-- (시드는 다음 단계에서 작성 — 마이그레이션 + drug_master 가 먼저 적용되어야 검증 가능)


-- ============================================================
-- 4. quiz_templates  (동적 템플릿 — 시나리오 기반)
-- ============================================================
DELETE FROM quiz_templates;

-- (시드는 다음 단계에서 작성)
