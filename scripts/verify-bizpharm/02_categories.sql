-- ============================================================
-- 02_categories.sql
-- PharmaEdu calc-engine 검증 A2: 80 카테고리 x TOP 3 추출
-- DB: Winpharm (SELECT ONLY)
-- 생성일: 2026-04-07
-- ============================================================
-- [스키마 메모]
-- H0241: 명세서 헤더
--   FormNo: H024=건강보험, H124=의료급여, M024=보훈
--   sbrdnType: 의료급여 세부구분 (M001=1종, B005/B009=B코드 등)
--   VCODE: 산정특례코드 (V103, V252 등)
--   EatDate: YYYYMMDD 형식의 조제일
--   Panum: 주민번호 13자리 (7번째 자리 gc: 1/2=1900년대, 3/4=2000년대)
--   Price_P: 본인부담금, TotPrePri: 총처방금액
--   PartTotAmt: 차등수가 합계 (>0이면 차등수가 적용)
--   TotDrugAmt100: 100% 본인부담 금액
--   TotDiffRealAmt: 선별급여 차액
-- H0243: 명세서 약품 줄
--   HangNum: 01=내복, 02=외용, U=수가
--   CodeGubun: 7I1=약품, 7I3=수가
-- ============================================================

-- ============================================================
-- [분류 1] 보험구분 베이스라인 (FormNo + 나이/비율 기반)
-- ============================================================

-- CAT01: C10 건강보험 일반 (H024, 30% 본인부담, 65세 미만)
-- gc=1,2이면서 yy>=60 (1960년 이후생 = 65세 미만 기준 2025년)
-- 또는 gc=3,4 (2000년대생)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.sbrdnType IS NULL OR RTRIM(h1.sbrdnType) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
  AND CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) BETWEEN 29.0 AND 31.0
  AND (
    (SUBSTRING(h1.Panum,7,1) IN ('1','2') AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) >= 60)
    OR SUBSTRING(h1.Panum,7,1) IN ('3','4')
  )
  AND DATEPART(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) NOT IN (7)
  AND NOT EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
ORDER BY h1.EatDate DESC;

-- CAT02: C20 건강보험 노인 65~74세 (H024, ~20% 본인부담, 1951~1960년생)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
  AND SUBSTRING(h1.Panum,7,1) IN ('1','2')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) BETWEEN 51 AND 60
  AND DATEPART(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) NOT IN (7)
  AND NOT EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
ORDER BY h1.EatDate DESC;

-- CAT03: C20 건강보험 노인 75세 이상 (H024, 1950년 이전생)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
  AND SUBSTRING(h1.Panum,7,1) IN ('1','2')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) <= 50
  AND DATEPART(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) NOT IN (7)
  AND NOT EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
ORDER BY h1.EatDate DESC;

-- CAT04: D10 의료급여 1종 (H124, M코드 sbrdnType)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND RTRIM(h1.sbrdnType) LIKE 'M%'
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
ORDER BY h1.EatDate DESC;

-- CAT05: D20 의료급여 2종 (H124, 일반 - sbrdnType 비어있음)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND (h1.sbrdnType IS NULL OR RTRIM(h1.sbrdnType) = '')
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND h1.Price_P > 0
  AND h1.TotPrePri > 0
ORDER BY h1.EatDate DESC;

-- CAT06: D40 의료급여 B코드 (H124, sbrdnType LIKE 'B%')
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND RTRIM(h1.sbrdnType) LIKE 'B%'
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
ORDER BY h1.EatDate DESC;

-- CAT07: D80 의료급여 면제 (H124, Price_P=0, sbrdnType 비어있음)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND (h1.sbrdnType IS NULL OR RTRIM(h1.sbrdnType) = '')
  AND h1.Price_P = 0
  AND h1.TotPrePri > 0
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
ORDER BY h1.EatDate DESC;

-- CAT08: G10 보훈 (M024 - 전체)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000001'
ORDER BY h1.EatDate DESC;

-- CAT09: G20 보훈 기타 (M024, Etc=0000000002)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000002'
ORDER BY h1.EatDate DESC;

-- CAT10: E10 건강보험 산정특례 (VCODE 있음, H024)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND h1.VCODE IS NOT NULL AND RTRIM(h1.VCODE) <> ''
  AND RTRIM(h1.VCODE) LIKE 'V%'
  AND CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) BETWEEN 8.0 AND 12.0
ORDER BY h1.EatDate DESC;

-- CAT11: E20 의료급여 산정특례 (H124, VCODE 있음)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND h1.VCODE IS NOT NULL AND RTRIM(h1.VCODE) <> ''
  AND RTRIM(h1.VCODE) LIKE 'V%'
ORDER BY h1.EatDate DESC;

-- CAT12: F10 건강보험 (FormNo=B024 - 기타 공비)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'B024'
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 2] 가산
-- ============================================================

-- CAT13: 야간가산 (평일 야간 - EatDate 조건으로 대체 불가, 처방일자로 요일만 확인)
-- 야간/토요/공휴 가산은 별도 컬럼 없음 -> EatDate 기반 토요일만 식별 가능
-- 야간가산: Winpharm에서 직접 식별 불가 (EatDate만 있고 시간 없음)
-- -> 조제 건수 중 토요일 조제분으로 대체
-- CAT13: 토요일 조제 (Saturday) H024
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  DATENAME(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) AS day_of_week,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND DATEPART(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) = 7
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
ORDER BY h1.EatDate DESC;

-- CAT14: 일요/공휴 조제 H024
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  DATENAME(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) AS day_of_week,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
ORDER BY h1.EatDate DESC;

-- CAT15: 6세 미만 + 건강보험 (H024, gc=3/4 이고 2019년 이후생)
-- 2025년 기준 6세 미만 = 2019년 이후 출생
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND SUBSTRING(h1.Panum,7,1) IN ('3','4')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) >= 19
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
ORDER BY h1.EatDate DESC;

-- CAT16: 65~74세 건강보험 (H024, gc=1/2, yy=51~60)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND SUBSTRING(h1.Panum,7,1) IN ('1','2')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) BETWEEN 51 AND 60
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
ORDER BY h1.EatDate DESC;

-- CAT17: 75세 이상 건강보험 (H024, gc=1/2, yy<=50)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND SUBSTRING(h1.Panum,7,1) IN ('1','2')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) <= 50
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
ORDER BY h1.EatDate DESC;

-- CAT18: 소아 + 공휴일 (H024, 6세 미만, 공휴일)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  DATENAME(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) AS day_of_week,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND SUBSTRING(h1.Panum,7,1) IN ('3','4')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) >= 19
  AND EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 3] 의료급여 세부
-- ============================================================

-- CAT19: D10 + sbrdnType=B (B코드 1500원 정액)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND RTRIM(h1.sbrdnType) LIKE 'B%'
  AND h1.Price_P = 1500
ORDER BY h1.EatDate DESC;

-- CAT20: D10 + sbrdnType='' (Mcode 미해당, 정액 1000원)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND (h1.sbrdnType IS NULL OR RTRIM(h1.sbrdnType) = '')
  AND h1.Price_P BETWEEN 900 AND 1100
ORDER BY h1.EatDate DESC;

-- CAT21: D10 + B014 정률 30% (B코드 중 30% 정률)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND RTRIM(h1.sbrdnType) = 'B014'
ORDER BY h1.EatDate DESC;

-- CAT22: D20 + 65세 (H124, sbrdnType 비어있음, 65세 이상)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  SUBSTRING(h1.Panum,7,1) AS gc, SUBSTRING(h1.Panum,1,2) AS yy,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND (h1.sbrdnType IS NULL OR RTRIM(h1.sbrdnType) = '')
  AND SUBSTRING(h1.Panum,7,1) IN ('1','2')
  AND CAST(SUBSTRING(h1.Panum,1,2) AS INT) <= 60
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
ORDER BY h1.EatDate DESC;

-- CAT23: D80 행려 전액면제 (H124, Price_P=0, sbrdnType='')
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124'
  AND (h1.sbrdnType IS NULL OR RTRIM(h1.sbrdnType) = '')
  AND h1.Price_P = 0
  AND h1.TotPrePri > 0
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 4] 보훈
-- ============================================================

-- CAT24~31: G10 + M10/M20/M30/M50/M60/M61/M83/M90
-- Winpharm M024에서 보훈 세부코드(M10~M90)는 별도 컬럼 없음
-- Etc 컬럼으로 구분 (0000000001 = 주요 보훈, 0000000002 = 기타)
-- -> 가능한 범위에서 추출, 세부 M코드는 식별 불가

-- CAT24: G10 + Etc=0000000001 (보훈 주요 대상)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000001'
  AND h1.Price_P = 0
ORDER BY h1.EatDate DESC;

-- CAT25: G10 + Etc=0000000001 + 본인부담 있음
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000001'
  AND h1.Price_P > 0
ORDER BY h1.EatDate DESC;

-- CAT26: G20 + Etc=0000000002 (보훈 기타)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000002'
ORDER BY h1.EatDate DESC;

-- CAT27: G20 + Etc=0000000003 (보훈 세부3)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000003'
ORDER BY h1.EatDate DESC;

-- CAT28: 보훈 MT038 컬럼 존재 여부 확인
-- NOTE: H0241에 MT038 컬럼 없음 -> 0건 보고
-- SELECT 0 AS ReqNo, '보훈MT038없음' AS note;

-- ============================================================
-- [분류 5] 특수 약품
-- ============================================================

-- CAT29: 내복+외용 혼합 명세서
SELECT TOP 3 h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate, h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C, h1.VCODE, h1.DAYS
FROM H0241 h1
WHERE EXISTS (
  SELECT 1 FROM H0243 x WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1 AND x.HangNum='01' AND x.CodeGubun='7I1'
)
AND EXISTS (
  SELECT 1 FROM H0243 x WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1 AND x.HangNum='02' AND x.CodeGubun='7I1'
)
ORDER BY h1.EatDate DESC;

-- CAT30: 100% 본인부담 약품 포함 명세서
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.TotDrugAmt100 > 0
ORDER BY h1.EatDate DESC;

-- CAT31: 코로나19 (CovidGB 값 있는 경우)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.CovidGB, h1.CovidMeet,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt
FROM H0241 h1
WHERE RTRIM(h1.CovidGB) IN ('1','2','3') OR RTRIM(h1.CovidMeet) IN ('1','2','3')
ORDER BY h1.EatDate DESC;

-- CAT32: 자가투여 주사제 (LicenseGb=4 in H0243)
SELECT TOP 3 h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate, h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C, h1.VCODE, h1.DAYS
FROM H0241 h1
WHERE EXISTS (
  SELECT 1 FROM H0243 x
  WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1 AND x.LicenseGb='4'
)
ORDER BY h1.EatDate DESC;

-- CAT33: 산제 포함 명세서 (CD_GOODS_LOWDOSE에 등록된 코드)
SELECT TOP 3 h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate, h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C, h1.VCODE, h1.DAYS
FROM H0241 h1
WHERE EXISTS (
  SELECT 1 FROM H0243 x
  JOIN CD_GOODS_LOWDOSE gl ON x.Code = gl.lowdcode OR x.Code = gl.highdcode
  WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1
)
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 6] 산정특례
-- ============================================================

-- CAT34: V103
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE RTRIM(h1.VCODE) = 'V103'
ORDER BY h1.EatDate DESC;

-- CAT35: V252
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE RTRIM(h1.VCODE) = 'V252'
ORDER BY h1.EatDate DESC;

-- CAT36: V206 (데이터 4건밖에 없음)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE RTRIM(h1.VCODE) = 'V206'
ORDER BY h1.EatDate DESC;

-- CAT37: V246
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE RTRIM(h1.VCODE) = 'V246'
ORDER BY h1.EatDate DESC;

-- CAT38: V270 (0건 예상)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE RTRIM(h1.VCODE) = 'V270'
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 7] 선별급여
-- ============================================================

-- CAT39: 선별급여 A항 50% (TotDiffRealAmt > 0, 오래된 데이터)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.TotDiffRealAmt > 0
ORDER BY h1.EatDate DESC;

-- CAT40: 선별급여 약품 포함 (H0243 DiffAmt > 0)
SELECT TOP 3 h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate, h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C, h1.TotDiffRealAmt
FROM H0241 h1
WHERE EXISTS (
  SELECT 1 FROM H0243 x
  WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1 AND x.DiffAmt > 0
)
ORDER BY h1.EatDate DESC;

-- CAT41~43: 선별급여 B/D/E/U 항은 TotDiffRealAmt>0에서 비율로 구분
-- (현재 DB에 최근 데이터 없음 -> 0건 예상)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo,
  h1.EatDate, h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.TotDiffRealAmt,
  h3.Code, h3.TotPrice, h3.InsurAmt, h3.DiffAmt,
  CAST(h3.InsurAmt*100.0/NULLIF(h3.TotPrice,0) AS DECIMAL(5,1)) AS insur_ratio
FROM H0241 h1
JOIN H0243 h3 ON h1.ReqNo=h3.ReqNo AND h1.DescNo1=h3.DescNo1
WHERE h3.DiffAmt > 0 AND h3.TotPrice > 0
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 8] 특수공비
-- ============================================================

-- CAT44: 특수공비 302 (M024에서 수가코드 Z계열 있는 명세서)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND EXISTS (
    SELECT 1 FROM H0243 x
    WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1
      AND RTRIM(x.Code) LIKE 'Z%'
  )
  AND RTRIM(h1.Etc) = '0000000001'
ORDER BY h1.EatDate DESC;

-- CAT45: 특수공비 101 (M024 기타 케이스)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000001'
  AND h1.Price_P > 0
  AND h1.TotPrePri > 0
ORDER BY h1.EatDate ASC;

-- CAT46: 특수공비 102 (M024 + Etc=0000000002 + Z코드 없는)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS, h1.Etc,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'M024'
  AND RTRIM(h1.Etc) = '0000000002'
  AND EXISTS (
    SELECT 1 FROM H0243 x
    WHERE x.ReqNo=h1.ReqNo AND x.DescNo1=h1.DescNo1
      AND RTRIM(x.Code) LIKE 'Z%'
  )
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 9] 명절
-- ============================================================

-- CAT47: 2024 추석 당일 및 전후 (9/16~18) - 0건 예상
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate,
  h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C,
  h1.VCODE, h1.DAYS
FROM H0241 h1
WHERE h1.EatDate IN ('20240916','20240917','20240918')
ORDER BY h1.EatDate;

-- CAT48: 2025 설날 (1/28~30) - 0건 예상
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate,
  h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C,
  h1.VCODE, h1.DAYS
FROM H0241 h1
WHERE h1.EatDate IN ('20250128','20250129','20250130')
ORDER BY h1.EatDate;

-- CAT49: 2025 추석 (10/5~7) - 0건 예상
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate,
  h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C,
  h1.VCODE, h1.DAYS
FROM H0241 h1
WHERE h1.EatDate IN ('20251005','20251006','20251007')
ORDER BY h1.EatDate;

-- CAT50: 공휴일 당일 조제 (일반 공휴일)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate,
  h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C,
  h1.VCODE, h1.DAYS,
  DATENAME(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) AS day_of_week
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
  AND h1.EatDate >= '20240101'
ORDER BY h1.EatDate DESC;

-- CAT51: 평일 (대조군 - 공휴일/토요일 제외)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.EatDate,
  h1.TotDrug, h1.TotPrePri, h1.Price_P, h1.Price_C,
  h1.VCODE, h1.DAYS,
  DATENAME(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) AS day_of_week
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND DATEPART(WEEKDAY, CAST(SUBSTRING(h1.EatDate,1,4)+'-'+SUBSTRING(h1.EatDate,5,2)+'-'+SUBSTRING(h1.EatDate,7,2) AS DATE)) NOT IN (7)
  AND NOT EXISTS (
    SELECT 1 FROM CD_HOLIDAY hol
    WHERE hol.Hol_Year = SUBSTRING(h1.EatDate,1,4)
      AND LTRIM(RTRIM(hol.Hol_Mon)) = CAST(CAST(SUBSTRING(h1.EatDate,5,2) AS INT) AS VARCHAR)
      AND LTRIM(RTRIM(hol.Hol_Day)) = CAST(CAST(SUBSTRING(h1.EatDate,7,2) AS INT) AS VARCHAR)
  )
  AND h1.EatDate >= '20250101'
  AND (h1.VCODE IS NULL OR RTRIM(h1.VCODE) = '')
  AND (h1.TotDrugAmt100 IS NULL OR h1.TotDrugAmt100 = 0)
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 10] 차등수가
-- ============================================================

-- CAT52: 차등수가 적용 (PartTotAmt > 0)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt, h1.SelfPartAmt, h1.BillPartAmt,
  CAST(h1.SelfPartAmt*100.0/NULLIF(h1.PartTotAmt,0) AS DECIMAL(5,1)) AS part_self_ratio,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.PartTotAmt > 0
ORDER BY h1.EatDate DESC;

-- CAT53: 차등수가 미적용 (PartTotAmt = 0 or NULL) - 대조군
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt, h1.SelfPartAmt, h1.BillPartAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND (h1.PartTotAmt IS NULL OR h1.PartTotAmt = 0)
  AND h1.EatDate >= '20250101'
ORDER BY h1.EatDate DESC;

-- CAT54: 차등수가 + 산정특례 복합
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt, h1.SelfPartAmt, h1.BillPartAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.PartTotAmt > 0
  AND h1.VCODE IS NOT NULL AND RTRIM(h1.VCODE) <> ''
ORDER BY h1.EatDate DESC;

-- CAT55: 차등수가 + 의료급여 (H124 + PartTotAmt > 0)
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt, h1.SelfPartAmt, h1.BillPartAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H124' AND h1.PartTotAmt > 0
ORDER BY h1.EatDate DESC;

-- ============================================================
-- [분류 11] 투약일수
-- ============================================================

-- CAT56: 투약일수 1일
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND CAST(h1.DAYS AS INT) = 1
  AND h1.EatDate >= '20240101'
ORDER BY h1.EatDate DESC;

-- CAT57: 투약일수 7일
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND CAST(h1.DAYS AS INT) = 7
  AND h1.EatDate >= '20240101'
ORDER BY h1.EatDate DESC;

-- CAT58: 투약일수 15일
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND CAST(h1.DAYS AS INT) = 15
  AND h1.EatDate >= '20240101'
ORDER BY h1.EatDate DESC;

-- CAT59: 투약일수 30일
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND CAST(h1.DAYS AS INT) = 30
  AND h1.EatDate >= '20240101'
ORDER BY h1.EatDate DESC;

-- CAT60: 투약일수 60일
SELECT TOP 3
  h1.ReqNo, h1.DescNo1, h1.FormNo, h1.IsCode,
  h1.EatDate, h1.TotDrug, h1.TotPrePri,
  h1.Price_P, h1.Price_C, h1.sbrdnType, h1.VCODE,
  h1.Panum, h1.DAYS,
  CAST(h1.Price_P*100.0/NULLIF(h1.TotPrePri,0) AS DECIMAL(5,1)) AS self_ratio,
  h1.TotDrugAmt100, h1.TotDiffRealAmt, h1.PartTotAmt,
  h1.Bohun_SelfAmt, h1.CovidGB
FROM H0241 h1
WHERE h1.FormNo = 'H024'
  AND CAST(h1.DAYS AS INT) = 60
  AND h1.EatDate >= '20240101'
ORDER BY h1.EatDate DESC;
