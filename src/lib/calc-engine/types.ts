/**
 * calc-engine/types.ts
 * TypeScript 타입 정의 — C# CalcOptions, CalcResult, DrugItem, InsuRate 포팅
 */

// ─── 열거형 ──────────────────────────────────────────────────────────────────

/** 보험급여구분 (DrugItem.InsuPay) */
export type InsuPayType =
  | 'covered'    // 1 = 급여 (일반)  → 01항
  | 'nonCovered' // 0 = 비급여       → W항
  | 'fullSelf'   // 9 = 100% 본인부담 → U항
  | 'partial50'  // 2 = 선별급여 50% → A항
  | 'partial80'  // 3 = 선별급여 80% → B항
  | 'partial30'  // 4 = 선별급여 30% → D항
  | 'partial90'  // 5 = 선별급여 90% → E항
  | 'veteran100';// 6 = 보훈 100/100 → V항 (CH01 §4-1, B-1 구조 신설)

/** 복용구분 (DrugItem.Take) */
export type TakeType =
  | 'internal'  // 0 = 내복
  | 'external'  // 1 = 외용
  | 'injection';// 2 = 주사

// ─── DrugItem ────────────────────────────────────────────────────────────────

/**
 * 처방 약품 1건
 * C# DrugItem 포팅 (핵심 필드만)
 */
export interface DrugItem {
  /** 약품코드 (EDI코드, 9자리) */
  code: string;
  /** 보험급여구분 */
  insuPay: InsuPayType;
  /** 복용구분 */
  take: TakeType;
  /** 단가 (원) */
  price: number;
  /** 1회투약량 */
  dose: number;
  /** 1일투여횟수 */
  dNum: number;
  /** 총투여일수 */
  dDay: number;
  /** 포장단위 (0=미적용) */
  pack?: number;
  /** 산제여부 ("1"=산제) */
  isPowder?: string;
  /** 마약/향정 ("3"=마약, "4"=향정) */
  spec?: string;
  /** 보험약품여부 (true=보험등재) */
  insuDrug?: boolean;

  // ── [B-11] EXTYPE 필터 + Del_Yn 분기 ────────────────────────────────────
  /**
   * 제외유형 (EXTYPE) — DB: PD_EXTYPE
   * - "1" : 심사 제외 약품 → 약품금액 합산에서 제외 (skip)
   * - "9" : 100% 본인부담 → 2020.03.01 이후 합산 제외 (skip), 이전은 계산 포함
   * - ""  : 해당 없음 (일반 처리)
   * 근거: C# DispensingFeeCalculator.cs:ClassifyDrugs():L334-L335,
   *       ch01_analyst.md §CH01 §5-3, §7-4
   */
  exType?: string;

  /**
   * 보험등재 상태 코드 (Del_Yn) — 비즈팜 DB 필드
   * DB 조회 계층(상위)에서 단가/급여구분을 결정하는 데 사용하는 상태 코드.
   * calc-engine은 이미 결정된 price/insuPay를 수령하는 구조(EDB 방식)이므로
   * 대부분의 분기는 상위 계층 책임. calc-engine에서는 'F'(폐기) 입력 시
   * 비급여 강제전환 여부를 Optional로 처리.
   * - (없음/"") : 정상 등재
   * - "M"       : 미삭제 (경고, 계산 정상 진행)
   * - "G"       : 급여정지 (경고, 계산 정상 진행)
   * - "P"       : 100% 본인부담 → U항 배치 (상위 계층에서 insuPay='fullSelf'로 설정)
   * - "A"       : 산재+의료급여 전용 (상위 계층에서 조건 미충족 시 비급여 전환)
   * - "B"       : 의료급여 전용 (상위 계층에서 조건 미충족 시 비급여 전환)
   * - "C"       : 산재 전용 (상위 계층에서 조건 미충족 시 비급여 전환)
   * - "F"       : 폐기 → 보험 불가, 강제 비급여 전환
   * 근거: CH01_약품금액_계산.md §3-3, ch01_analyst.md §CH01 §3-3,
   *       CH01_CH07_소스간_모순_충돌_분석.md §CH01-M01 [비즈팜]
   */
  delYn?: string;
}

// ─── SectionTotals ───────────────────────────────────────────────────────────

/**
 * 항별 분리 집계 결과 (B-1 — drug-amount.ts:calcDrugAmountSum 확장)
 *
 * 법정 전자청구 명세서 항번호 체계 (CH10 §Step3-4, CH01 §4-1):
 *   - 01항: 급여 일반약품 (InsuPayType='covered')
 *   - A항:  선별급여 50% (InsuPayType='partial50')
 *   - B항:  선별급여 80% (InsuPayType='partial80')
 *   - D항:  선별급여 30% (InsuPayType='partial30')
 *   - E항:  선별급여 90% (InsuPayType='partial90')
 *   - U항:  100% 본인부담 (InsuPayType='fullSelf')
 *   - V항:  보훈 100/100 (InsuPayType='veteran100')
 *   - W항:  비급여 (InsuPayType='nonCovered')
 *
 * 근거: C# DispensingFeeCalculator.cs:AssembleResult():L1796-L1824
 *        99_FINAL_REPORT.md §6.1, §7 B-1
 */
export interface SectionTotals {
  /** 01항: 급여 일반약품 합계 (원) */
  section01: number;
  /** A항: 선별급여 50% 합계 (원) */
  sectionA: number;
  /** B항: 선별급여 80% 합계 (원) */
  sectionB: number;
  /** D항: 선별급여 30% 합계 (원) */
  sectionD: number;
  /** E항: 선별급여 90% 합계 (원) */
  sectionE: number;
  /** U항: 100% 본인부담 합계 (원) */
  sectionU: number;
  /** V항: 보훈 100/100 합계 (원) */
  sectionV: number;
  /** W항: 비급여 합계 (원) */
  sectionW: number;
}

// ─── MediIllnessInfo ─────────────────────────────────────────────────────────

/**
 * 산정특례 질병코드 상세 정보 (V252/V103 등)
 * C# MediIllnessInfo 포팅
 */
export interface MediIllnessInfo {
  /** 질병코드 (V103, V252 등) */
  code: string;
  /** 본인부담율 (%) */
  rate: number;
  /** V252 계열 여부 */
  isV252: boolean;
  /** 등급 (V252 0~9) */
  grade?: number;
  /** 설명 */
  description?: string;
}

// ─── CalcOptions ─────────────────────────────────────────────────────────────

/**
 * 계산 엔진 입력 파라미터
 * C# CalcOptions MVP 서브셋
 */
export interface CalcOptions {
  /** 조제일자 (yyyyMMdd) */
  dosDate: string;
  /** 조제시간 (HHmm, 야간판정용) */
  dosTime?: string;
  /** 보험코드 (C10/D10/G10/F10/E10 등) */
  insuCode: string;
  /** 환자나이 */
  age: number;
  /** 보험투여일수 (0이면 자동) */
  insuDose?: number;
  /** 토요일 가산 */
  isSaturday?: boolean;
  /** 야간 가산 */
  isNight?: boolean;
  /** 공휴일 가산 */
  isHolyDay?: boolean;
  /** 심야 가산 (6세 미만 전용) */
  isMidNight?: boolean;
  /** 처방 약품 리스트 */
  drugList: DrugItem[];
  /** 질병코드 (V252 산정특례 등) */
  mediIllness?: string;

  // ── [NEW] 보훈 관련 ────────────────────────────────────────────────────────
  /** 보훈코드 (M10~M90) — veteran.ts */
  bohunCode?: string;
  /** 요양기관기호 — isBohunHospital() 판정 */
  hospCode?: string;
  /** 위탁 여부 (G10=비위탁, G20=위탁) — veteran.ts */
  isMPVBill?: boolean;
  /** 심사기관 여부 — veteran.ts M81~M83 후처리 분기 */
  isSimSa?: boolean;

  // ── [NEW] 의료급여 관련 ────────────────────────────────────────────────────
  /** B014/B030 등 수급권자 유형 — medical-aid.ts */
  sbrdnType?: string;
  /** 건강생활유지비 잔액 (원) — medical-aid.ts */
  eHealthBalance?: number;
  /** 보건기관 처방전 여부 — medical-aid.ts */
  isHealthCenterPresc?: boolean;
  /** 의료급여 등급 ('5' → 면제) — medical-aid.ts */
  hgGrade?: string;

  // ── [NEW] 자동차보험 관련 ──────────────────────────────────────────────────
  /** 할증율 (%) — auto-insurance.ts */
  addRat?: number;

  // ── [NEW] 직접조제 ────────────────────────────────────────────────────────
  /** 직접조제 여부 — direct-dispensing.ts */
  isDirectDispensing?: boolean;

  // ── [NEW] 비대면/복약상담 ─────────────────────────────────────────────────
  /** 비대면 조제 여부 — counseling.ts */
  isNonFace?: boolean;
  /** 복약상담 제공 여부 — counseling.ts */
  hasCounseling?: boolean;
  /** 달빛어린이약국 여부 — counseling.ts */
  isDalbitPharmacy?: boolean;

  // ── [NEW] 산정특례 ────────────────────────────────────────────────────────
  /** 상세 특정기호 정보 — exemption.ts */
  mediIllnessInfo?: MediIllnessInfo;
  /** B코드 질병코드 (F008 코로나 등) */
  mediIllnessB?: string;

  // ── [NEW] 장려금/기타 ─────────────────────────────────────────────────────
  /** 대체조제/사용장려금 합계 (원) */
  incentiveSum?: number;
  /** 연간 누적 본인부담액 (본인부담상한제용) — safety-net.ts */
  yearlyAccumulated?: number;
  /** 소득분위 (1~10, 본인부담상한제용) — safety-net.ts */
  incomeDecile?: number;

  // ── [B-7] CalcOptions 누락 필드 추가 (C# CalcOptions.cs 포팅) ─────────────
  /** 성별 ('M'=남, 'F'=여) — C# CalcOptions.cs:L32 */
  sex?: string;
  /** 처방코드/처방전발급번호 an(13) — C# CalcOptions.cs:L35 */
  psCode?: string;
  /** 환자 ID — C# CalcOptions.cs:L38 (연간 상한제 쿼리에 필요) */
  custId?: string;
  /** 실투여일수 — C# CalcOptions.cs:L51 (보험투여일수와 별개) */
  realDose?: number;
  /** 실투여일수 사용 여부 — C# CalcOptions.cs:L85 */
  isRealDose?: boolean;
  /** 임신 여부 — C# CalcOptions.cs:L88 */
  isPregnant?: boolean;
  /** 의약품 안전사용(DUR) 체크 결과 코드 — C# CalcOptions.cs:L95
   *  'U'=비대면, 'D'=DUR경고, ''=정상 등 */
  drugSafeYN?: string;
  /** 산제 여부 ('Y'/'N') — C# CalcOptions.cs:L98 */
  powderYN?: string;
  /** 자가주사 여부 ('Y'/'N') — C# CalcOptions.cs:L104 */
  selfInjYN?: string;
  /** 특수공비 대상 여부 (302/101/102 재배분) — C# CalcOptions.cs:L107 */
  specialPub?: string;
  /** 비급여 약품 만료 여부 ('Y'/'N') — C# CalcOptions.cs:L109
   *  원본 주석 인코딩 깨짐("鍮꾧툒 ?ㅻ챸") — 비급여 유효기간 만료 플래그로 추정 */
  nPayExpYN?: string;
  /** 등급 토요일 진입 여부 — C# CalcOptions.cs:L112 */
  gradeSatIn?: boolean;
  /** 비급여 반올림 유형 — C# CalcOptions.cs:L122 (NPayRoundType enum 대응)
   *  'Floor10'|'Floor100'|'Round100'|'Ceil100'|'None'|'Round10' */
  nPayRoundType?: string;
  /** 보훈 비급여 사용자 여부 — C# CalcOptions.cs:L137 */
  isBohunNpayUser?: boolean;
  /** 비급여 F10 반올림 여부 ('Y'/'N') — C# CalcOptions.cs:L140 */
  nPayRoundF10YN?: string;
  /** 희귀질환 여부 — C# CalcOptions.cs:L147 */
  isRare?: boolean;
  /** 보험급여 정부보조 여부 (G계열) — C# CalcOptions.cs:L150 */
  isInsuGovG?: boolean;
  /** 보훈병원 여부 — C# CalcOptions.cs:L153 (hospCode 기반 동적 판정도 가능) */
  isBohunHospital?: boolean;
  /** 산정특례 34조 여부 — C# CalcOptions.cs:L156 */
  isSpec34?: boolean;
  /** 조제료 없음 여부 — C# CalcOptions.cs:L159 */
  isNoWage?: boolean;
  /** 조제 내역 여부 ('Y'/'N') — C# CalcOptions.cs:L162 */
  indYN?: string;
  /** 조제료 가산 체크 여부 — C# CalcOptions.cs:L165 */
  wageCommChk?: boolean;
  /** 비급여 조제료 유형 코드 — C# CalcOptions.cs:L175 */
  nPayWageType?: string;
  /** 비급여 기본조제료 미산정 여부 — C# CalcOptions.cs:L178 */
  nPayNoBaseWage?: boolean;
  /** 비급여 마약조제료 여부 — C# CalcOptions.cs:L181 */
  nPayNarcoticWage?: boolean;
  /** 비급여 조제료만 청구 여부 — C# CalcOptions.cs:L184 */
  nPayOnlyWage?: boolean;
  /** 학생 여부 — C# CalcOptions.cs:L194 */
  isStudent?: boolean;
  /** 재가급여 여부 — C# CalcOptions.cs:L197 */
  isHomeCare?: boolean;
  /** 선별급여 여부 — C# CalcOptions.cs:L200 */
  isSelectMedi?: boolean;
  /** 노숙인 여부 — C# CalcOptions.cs:L203 */
  isHomeless?: boolean;
  /** 면제 질환 여부 — C# CalcOptions.cs:L206 */
  isExemptDisease?: boolean;

  // ── [B-10] MT038 특정내역 ─────────────────────────────────────────────────
  /**
   * MT038 특정내역 (보훈위탁 G20 약국 전용)
   * - "1" = 2018.01.01 이전 일부본인부담대상 전상군경등 국비질환분 (2018.01.01부터 폐지)
   * - "2" = 국비환자 타질환 조제분 (2013.01.01 이후)
   * - "A" = 60% 감면 도서벽지 내 약국 조제분
   * - ""  = 해당 없음
   * 근거: 2025 작성요령 p.593, p.604, p.616, p.697; CH12 §5.4~5.6
   * C# CalcOptions.cs:Mt038
   */
  mt038?: string;
}

// ─── InsuRate ────────────────────────────────────────────────────────────────

/**
 * 보험요율 마스터 (insu_rate 테이블 1행)
 */
export interface InsuRate {
  insuCode: string;
  rate: number;
  sixAgeRate: number;
  fixCost: number;
  mcode: number;
  bcode: number;
  age65_12000Less: number;

  // ── [NEW] V252 산정특례 등급별 요율 ─────────────────────────────────────
  /** V252 0등급 요율 (%) — exemption.ts */
  v2520?: number;
  /** V252 1등급 요율 (%) — exemption.ts */
  v2521?: number;
}

// ─── WageListItem ─────────────────────────────────────────────────────────────

/**
 * 수가 항목 1건 (조제료 세부내역)
 */
export interface WageListItem {
  sugaCd: string;
  name: string;
  insuPay: string;
  cnt: number;
  price: number;
  sum: number;
  addType: string;
}

// ─── CalcResult ──────────────────────────────────────────────────────────────

/**
 * 계산 결과
 * C# CalcResult MVP 서브셋
 */
export interface CalcResult {
  /** 약품금액 합계 (급여) */
  sumInsuDrug: number;
  /** 조제료 합계 */
  sumWage: number;
  /** 요양급여비용총액1 = trunc10(약가+조제료) */
  totalPrice: number;
  /** 본인일부부담금 */
  userPrice: number;
  /** 청구액 = totalPrice - userPrice */
  pubPrice: number;
  /** 수가 항목별 결과 리스트 */
  wageList: WageListItem[];
  /** 계산 단계 설명 (교육용) */
  steps: CalcStep[];
  /** 오류 메시지 (있을 경우) */
  error?: string;

  // ── [NEW] 3자배분 ─────────────────────────────────────────────────────────
  /** 보훈청 청구액 — veteran.ts */
  mpvaPrice?: number;
  /** 공단 청구액 (= pubPrice와 다를 수 있음) — veteran.ts/safety-net.ts */
  insuPrice?: number;
  /** 실수납금 = userPrice - pubPrice */
  realPrice?: number;
  /** 최종 환자수납액 (비급여 포함) */
  sumUser?: number;
  /** 최종 공단청구액 */
  sumInsure?: number;

  // ── [B-2] 선별급여 항별 합계 ─────────────────────────────────────────────
  /**
   * 선별급여 50% 약품 합계 (A항) — sectionTotals.sectionA
   * 근거: C# CalcResult.SumInsuDrug50, DispensingFeeCalculator.cs:L1828
   */
  sumInsuDrug50?: number;
  /**
   * 선별급여 80% 약품 합계 (B항) — sectionTotals.sectionB
   * 근거: C# CalcResult.SumInsuDrug80, DispensingFeeCalculator.cs:L1829
   */
  sumInsuDrug80?: number;
  /**
   * 선별급여 30% 약품 합계 (D항) — sectionTotals.sectionD
   * 근거: C# CalcResult.SumInsuDrug30, DispensingFeeCalculator.cs:L1830
   */
  sumInsuDrug30?: number;
  /**
   * 선별급여 90% 약품 합계 (E항) — sectionTotals.sectionE
   * 근거: C# CalcResult.SumInsuDrug90, DispensingFeeCalculator.cs:L1831
   */
  sumInsuDrug90?: number;
  /**
   * 부분부담(선별급여) 본인부담금 합계 = trunc10(RoundToInt(A×50%)+RoundToInt(B×80%)+RoundToInt(D×30%)+RoundToInt(E×90%))
   * 근거: C# CalcResult.UnderUser, DispensingFeeCalculator.cs:L1836-L1840
   */
  underUser?: number;
  /**
   * 부분부담(선별급여) 공단부담 합계 = trunc10(A+B+D+E) - underUser
   * 근거: C# CalcResult.UnderInsu, DispensingFeeCalculator.cs:L1843-L1845
   */
  underInsu?: number;

  // ── [B-3] 요양급여비용총액2 ──────────────────────────────────────────────
  /**
   * 요양급여비용총액2 = trunc10(총액1 + U항 본인부담금총액)
   * 전자청구 필수 항목
   * 근거: C# 99_FINAL_REPORT §B-3; CH07 R13; CH05 §8.1
   */
  totalPrice2?: number;

  // ── [NEW] 특수약품 ────────────────────────────────────────────────────────
  /** 648903860 약품금액 합계 — drug-648.ts */
  sum648?: number;
  /** 100% 자부담 약품금액 합계 */
  sumInsuDrug100?: number;
  /** 100% 약품 총액 */
  totalPrice100?: number;
  /** 100% 약품 환자분 */
  userPrice100?: number;

  // ── [B-5] 특수공비 302/101/102 재배분 ────────────────────────────────────
  /**
   * 100% 약품 공비 전환금액 (특수공비 302/101 재배분 결과)
   * 근거: C# CalcResult.Pub100Price, CopaymentCalculator.cs:L1009-L1016
   */
  pub100Price?: number;

  // ── [NEW] 자동차보험 할증 ─────────────────────────────────────────────────
  /** 자동차보험 할증액 — auto-insurance.ts */
  premium?: number;

  // ── [NEW] 공비 관련 ──────────────────────────────────────────────────────
  /** 공비 상세 (302/101/102 분리 시) */
  pubPrice2?: number;
  /** 보훈 비급여 감면분 — MpvaComm (C# CopaymentCalculator.CalcMpvaComm 포팅) */
  mpvaComm?: number;

  // ── [C-9] MpvaComm 산출용 비급여 합계 ────────────────────────────────────
  /**
   * 비급여 약품 합계 (SumUserDrug) — C# CalcResult.SumUserDrug 포팅
   * 비급여약품합계 + 비급여수가(SumWageComm)가 MpvaComm 산출 모수이다.
   * 근거: CopaymentCalculator.cs:L1207-L1208
   */
  sumUserDrug?: number;
  /**
   * 비급여 수가 가산 합계 (SumWageComm) — C# CalcResult.SumWageComm 포팅
   * DispensingFeeCalculator에서 산출되는 비급여조제료/가산 합계.
   * 현재 TS 파이프라인에서 미산출 시 0으로 처리.
   * 근거: CopaymentCalculator.cs:L1207-L1208
   */
  sumWageComm?: number;

  // ── [NEW] 본인부담상한제 ──────────────────────────────────────────────────
  /** 상한제 초과금 (공단 전환액) — safety-net.ts */
  overUserPrice?: number;

  // ── [NEW] 장려금 ─────────────────────────────────────────────────────────
  /** 대체조제 장려금 */
  incentive?: number;

  // ── [B-6] 서식번호 ────────────────────────────────────────────────────────
  /**
   * 전자청구 서식번호 (심사청구서 명세서 서식 코드)
   * - H024: 처방조제 × 건강보험
   * - H124: 처방조제 × 의료급여
   * - H025: 직접조제 × 건강보험
   * - H125: 직접조제 × 의료급여
   *
   * 근거: CH10 §Step1-2, ch10_verifier.md §3.3
   */
  formNumber?: string;

  // ── [B-9] 공상등구분 코드 ─────────────────────────────────────────────────
  /**
   * 공상등구분 코드 (HIRA EDI 명세서 필드)
   * C# CalcResult.GsCode 포팅
   * 근거: CH12; C# GsCode.cs
   */
  gsCode?: string;

  // ── [B-10] MT038 출력값 ───────────────────────────────────────────────────
  /**
   * MT038 특정내역 출력값 (보훈위탁 G20 약국 전용)
   * 입력 CalcOptions.mt038에서 날짜분기 적용 후 결정된 실제 기재 값.
   * - "1" = 2018.01.01 이전 (2018 이후 폐지, 빈 문자열 출력)
   * - "2" = 국비환자 타질환 조제분
   * - "A" = 60% 감면 도서벽지 내
   * - ""  = 해당 없음 (G10 또는 MT038 미해당)
   * C# CalcResult.Mt038 포팅
   */
  mt038?: string;

  // ── [B-10] 302 대상 100% 본인부담 보험약 합계 ────────────────────────────
  /**
   * 특수공비 302 선별용 100% 본인부담 보험약 합계
   * C# CalcResult.SumInsuDrug100_302 포팅
   */
  sumInsuDrug100_302?: number;
}

/**
 * 계산 단계 설명 (교육 모드용)
 */
export interface CalcStep {
  title: string;
  formula: string;
  result: number;
  unit: string;
}

// ─── ICalcRepository ─────────────────────────────────────────────────────────

/**
 * 수가 데이터 조회 인터페이스
 */
export interface ICalcRepository {
  /**
   * Z코드별 단가 Map 조회
   * A-8: dosDate 8자리(yyyyMMdd)를 받아 수가 시행일 기준 조회 준비
   * - string: dosDate 8자리 — 향후 DueDate 컬럼 추가 시 MAX(DueDate) <= dosDate 쿼리 사용
   * - number: 연도(레거시, 기존 모듈 호환) — 내부에서 연도 추출하여 apply_year 쿼리
   * 향후 DueDate 컬럼 추가 완료 후 number 오버로드 제거 예정
   */
  getSugaFeeMap(dosDate: string | number): Promise<Map<string, { price: number; name: string }>>;
  /** 투약일수에 해당하는 처방조제료 항목 조회 */
  getPrescDosageFee(year: number, days: number): Promise<{ sugaCode: string; fee: number } | null>;
  /** 보험코드별 요율 조회 */
  getInsuRate(insuCode: string): Promise<InsuRate | null>;

  // ── [NEW] 확장 메서드 ──────────────────────────────────────────────────────
  /** 명절 여부 조회 — seasonal.ts (옵션, 구현 안 해도 됨) */
  getHolidayType?(date: string): Promise<'lunar_new_year' | 'chuseok' | 'holiday' | null>;
  /** MediIllnessInfo 조회 — exemption.ts (옵션, 구현 안 해도 됨) */
  getMediIllnessInfo?(code: string): Promise<MediIllnessInfo | null>;
}
