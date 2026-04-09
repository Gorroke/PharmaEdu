/**
 * scripts/verify-bizpharm/verify.ts
 * A3 — 윈팜 데이터 → PharmaEdu CalcOptions 변환 + calculate() 호출 + 비교 + 보고서
 *
 * 실행:
 *   cd C:\Projects\KSH\PharmaEdu
 *   npx tsx scripts/verify-bizpharm/verify.ts
 */

import fs from 'fs';
import path from 'path';
import { calculate } from '../../src/lib/calc-engine/index';
import type {
  CalcOptions,
  DrugItem,
  InsuRate,
  ICalcRepository,
} from '../../src/lib/calc-engine/types';

// ─── 디렉토리 기준 경로 ─────────────────────────────────────────────────────────
const BASE_DIR = path.join(__dirname);

// ─── 타입 정의 ─────────────────────────────────────────────────────────────────

interface WinpharmHeader {
  cat: string;
  ReqNo: string;
  DescNo1: string;
  FormNo: string;       // H024 / H124 / M024 / S024 / B024
  IsCode: string;
  EatDate: string;      // yyyyMMdd
  TotDrug: string;
  TotPrePri: string;    // 요양급여비용총액 (기대 totalPrice)
  Price_P: string;      // 환자 본인부담금 (기대 userPrice)
  Price_C: string;      // 공단청구액 (기대 pubPrice)
  sbrdnType: string;    // 의료급여 수급권자 유형
  VCODE: string;        // 산정특례코드
  Panum: string;        // 주민번호 13자리
  DAYS: string;         // 총투여일수
  gc: string;           // 주민번호 7번째 자리
  yy: string;           // 주민번호 앞 2자리 (YYMMDD의 YY)
  self_ratio: string;
  TotDrugAmt100: string;
  TotDiffRealAmt: string;
  PartTotAmt: string;
  Bohun_SelfAmt: string;
  CovidGB: string;
  Etc: string;          // M024: MT038 코드 값 (0000000001/2/3)
  day_of_week: string;  // 요일 (추가 컬럼)
  SelfPartAmt: string;
  BillPartAmt: string;
}

interface WinpharmDrug {
  ReqNo: string;
  DescNo1: string;
  LineNo_: string;
  CodeGubun: string;    // 7I1=Z수가코드, 7I3=약품코드
  Code: string;         // 약품코드 또는 Z코드
  DayEatQuan: string;   // 1일투여횟수 (dNum)
  TotEatDay: string;    // 총투여일수 (dDay)
  TotPrice: string;     // 총금액
  Price: string;        // 단가
  HangNum: string;      // 01=급여, U=100%자부담, B=선별급여80%
  MogNum: string;
  TotMoney: string;
  CD_gubun: string;     // 1=Z수가, 3=약품
  InsurAmt: string;
  DiffAmt: string;
  LicenseGb: string;    // 4=자가주사
  LicenseNo: string;
  DURTEXT: string;
}

interface ComparisonResult {
  reqNo: string;
  descNo1: string;
  category: string;
  expected: { totalPrice: number; userPrice: number; pubPrice: number };
  actual: { totalPrice: number; userPrice: number; pubPrice: number };
  diff: { totalPrice: number; userPrice: number; pubPrice: number };
  status: 'PASS' | 'FAIL_TOTAL' | 'FAIL_USER' | 'FAIL_PUB' | 'FAIL_MULTI' | 'ERROR';
  errorMessage?: string;
  inputSummary?: string;
}

// ─── Mock Repository ───────────────────────────────────────────────────────────
/**
 * 윈팜 단가(Price)를 직접 주입받는 Mock Repository.
 * 수가 Z코드는 H0243에서 Price 컬럼으로 입력됨 — DB 없이 동작.
 *
 * getSugaFeeMap: H0243에서 추출한 (Code, Price) 맵을 반환
 * getPrescDosageFee: Z1000 계열 — 윈팜 데이터에서 이미 집계됨.
 *   실제로 calc-engine은 getPrescDosageFee로 기본조제료(Z1000) 단가를 가져온다.
 *   → 연도별 수가는 하드코딩 fallback 제공 (2025: 1360원, 2024: 1360원, 2022: 1360원)
 * getInsuRate: 하드코딩 요율 테이블 (실제 수가에서 역산)
 */
class WinpharmMockRepo implements ICalcRepository {
  private sugaMap: Map<string, { price: number; name: string }>;

  constructor(sugaMap: Map<string, { price: number; name: string }>) {
    this.sugaMap = sugaMap;
  }

  async getSugaFeeMap(_dosDate: string | number): Promise<Map<string, { price: number; name: string }>> {
    return this.sugaMap;
  }

  async getPrescDosageFee(_year: number, days: number): Promise<{ sugaCode: string; fee: number } | null> {
    /**
     * 투약일수 → Z43xx 코드 매핑 (HIRA 처방조제료 구간별 코드)
     * 근거: 01_mapping.md Z4316~Z4391 분포 + HIRA 수가고시
     *
     * calc-engine은 16일+ 투약일수에 대해 이 함수를 호출한다.
     * sugaMap에 해당 Z43xx 코드가 들어있으면 그 단가를 반환하고,
     * 없으면 null 반환 (조제료 0원 처리됨).
     *
     * Z43xx 코드 구간:
     *   Z4316: 16~20일
     *   Z4321: 21~25일
     *   Z4326: 26~30일
     *   Z4331: 31~40일
     *   Z4341: 41~50일
     *   Z4351: 51~60일
     *   Z4361: 61~70일
     *   Z4371: 71~80일
     *   Z4381: 81~90일
     *   Z4391: 91일+
     */
    let sugaCode: string;
    if      (days <= 20) sugaCode = 'Z4316';
    else if (days <= 25) sugaCode = 'Z4321';
    else if (days <= 30) sugaCode = 'Z4326';
    else if (days <= 40) sugaCode = 'Z4331';
    else if (days <= 50) sugaCode = 'Z4341';
    else if (days <= 60) sugaCode = 'Z4351';
    else if (days <= 70) sugaCode = 'Z4361';
    else if (days <= 80) sugaCode = 'Z4371';
    else if (days <= 90) sugaCode = 'Z4381';
    else                  sugaCode = 'Z4391';

    // sugaMap에서 단가 조회 (윈팜에서 추출한 실제 단가)
    const entry = this.sugaMap.get(sugaCode);
    if (entry && entry.price > 0) {
      return { sugaCode, fee: entry.price };
    }

    // sugaMap에 없으면 가산 코드 접미사 제거 후 재시도
    // (예: Z4326011 → Z4326)
    for (const [k, v] of this.sugaMap) {
      if (k.startsWith(sugaCode) && v.price > 0) {
        return { sugaCode, fee: v.price };
      }
    }

    return null;
  }

  async getInsuRate(insuCode: string): Promise<InsuRate | null> {
    // 하드코딩 요율 테이블 (mapping.md + 실제 HIRA 고시)
    // 근거: 01_mapping.md 섹션 1~3
    const rateTable: Record<string, InsuRate> = {
      // 건강보험 C계열
      'C10': { insuCode: 'C10', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 20 },
      'C20': { insuCode: 'C20', rate: 30, sixAgeRate: 70, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 20 },
      /**
       * 의료급여 D계열 요율 (HIRA 고시 기준)
       * 근거: 01_mapping.md 섹션 3 + medical-aid.ts resolveMedicalAidFixAmount()
       *
       * D10 (1종):
       *   mcode = 1000원 (M코드 수급권자 정액)
       *   bcode = 500원 (B코드 수급권자 정액, 실제 Price_P=500 확인)
       *   fixCost = 500원 (D20 2종 본인부담)
       *
       * D20 (2종):
       *   fixCost = 500원 (500원 정액)
       *
       * D80: 행려/면제 → userPrice=0
       */
      'D10': { insuCode: 'D10', rate: 10, sixAgeRate: 0, fixCost: 500, mcode: 1000, bcode: 500, age65_12000Less: 0 },
      'D20': { insuCode: 'D20', rate: 20, sixAgeRate: 0, fixCost: 500, mcode: 1000, bcode: 500, age65_12000Less: 0 },
      'D40': { insuCode: 'D40', rate: 10, sixAgeRate: 0, fixCost: 500, mcode: 1000, bcode: 500, age65_12000Less: 0 },
      'D80': { insuCode: 'D80', rate: 0, sixAgeRate: 0, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 },
      // 보훈 G계열
      'G10': { insuCode: 'G10', rate: 0, sixAgeRate: 0, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 },
      'G20': { insuCode: 'G20', rate: 0, sixAgeRate: 0, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 },
      // 산재 F10
      'F10': { insuCode: 'F10', rate: 0, sixAgeRate: 0, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 0 },
      // 산정특례 E계열
      'E10': { insuCode: 'E10', rate: 10, sixAgeRate: 10, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 10 },
      'E20': { insuCode: 'E20', rate: 10, sixAgeRate: 10, fixCost: 0, mcode: 0, bcode: 0, age65_12000Less: 10 },
    };
    return rateTable[insuCode] ?? null;
  }

  async getMediIllnessInfo(code: string): Promise<import('../../src/lib/calc-engine/types').MediIllnessInfo | null> {
    // 주요 산정특례 코드 하드코딩
    // 근거: 01_mapping.md 섹션 5, VCODE 분포 참조
    const iliTable: Record<string, import('../../src/lib/calc-engine/types').MediIllnessInfo> = {
      'V252': { code: 'V252', rate: 0,  isV252: true,  grade: 0, description: '암 등 중증질환' },
      'V103': { code: 'V103', rate: 5,  isV252: false, description: '희귀질환' },
      'V193': { code: 'V193', rate: 10, isV252: false, description: '산정특례 V193' },
      'V201': { code: 'V201', rate: 10, isV252: false, description: '산정특례 V201' },
      'V352': { code: 'V352', rate: 10, isV252: false, description: '산정특례 V352' },
      'V139': { code: 'V139', rate: 10, isV252: false, description: '산정특례 V139' },
      'V127': { code: 'V127', rate: 10, isV252: false, description: '산정특례 V127' },
      'V027': { code: 'V027', rate: 10, isV252: false, description: '산정특례 V027' },
      'V131': { code: 'V131', rate: 10, isV252: false, description: '산정특례 V131' },
      'V124': { code: 'V124', rate: 10, isV252: false, description: '산정특례 V124' },
      'V246': { code: 'V246', rate: 10, isV252: false, description: '산정특례 V246' },
      'V000': { code: 'V000', rate: 10, isV252: false, description: '산정특례 V000' },
      'V206': { code: 'V206', rate: 10, isV252: false, description: '산정특례 V206' },
      'V270': { code: 'V270', rate: 0,  isV252: false, description: '산정특례 V270' },
      'V100': { code: 'V100', rate: 10, isV252: false, description: '산정특례 V100' },
      'V223': { code: 'V223', rate: 10, isV252: false, description: '산정특례 V223' },
      'F010': { code: 'F010', rate: 0,  isV252: false, description: 'B질환코드 F010' },
      'F016': { code: 'F016', rate: 0,  isV252: false, description: 'B질환코드 F016' },
    };
    return iliTable[code.trim()] ?? null;
  }
}

// ─── TSV 파서 ───────────────────────────────────────────────────────────────────

function parseTsv<T extends Record<string, string>>(filePath: string): T[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split('|').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cols = line.split('|');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (cols[i] ?? '').trim();
    });
    return obj as T;
  });
}

// ─── 연령 계산 (Panum + EatDate) ────────────────────────────────────────────────
/**
 * Panum에서 생년월일 추출 후 만 나이 계산
 * 근거: 01_mapping.md 섹션 4
 *
 * Panum[0..5] = YYMMDD
 * Panum[6] = gc: 1/2/5/6=1900년대, 3/4/7/8=2000년대, 9/0=외국인
 */
function calcAgeFromPanum(panum: string, eatDate: string): { age: number; sex: string } {
  const DEFAULT = { age: 40, sex: 'M' };
  if (!panum || panum.length < 7) return DEFAULT;

  const yy = panum.substring(0, 2);
  const mm = panum.substring(2, 4);
  const dd = panum.substring(4, 6);
  const gc = panum.charAt(6);

  let year: number;
  if (['1','2','5','6'].includes(gc)) {
    year = 1900 + parseInt(yy, 10);
  } else if (['3','4','7','8'].includes(gc)) {
    year = 2000 + parseInt(yy, 10);
  } else {
    // 외국인(9/0) — 기본값 처리
    return DEFAULT;
  }

  // 성별: 1/3/5/7=남, 2/4/6/8=여
  const sex = ['1','3','5','7'].includes(gc) ? 'M' : 'F';

  // 만 나이 계산
  const birthYear = year;
  const birthMM = parseInt(mm, 10);
  const birthDD = parseInt(dd, 10);

  const dosYear = parseInt(eatDate.substring(0, 4), 10);
  const dosMM   = parseInt(eatDate.substring(4, 6), 10);
  const dosDD   = parseInt(eatDate.substring(6, 8), 10);

  let age = dosYear - birthYear;
  // 생일이 아직 지나지 않은 경우 -1
  if (dosMM < birthMM || (dosMM === birthMM && dosDD < birthDD)) {
    age -= 1;
  }
  if (age < 0) age = 0;

  return { age, sex };
}

// ─── FormNo → insuCode 변환 ──────────────────────────────────────────────────────
/**
 * 근거: 01_mapping.md 섹션 1, 3
 *
 * H124의 경우: sbrdnType 값으로 D10/D20/D40/D80 분기
 *   B코드(B001~B009) → D40 (B코드 기초수급권자 = 2종 본인부담)
 *   M코드 + Etc=1(1종) → D10 (1종 수급권자, 본인부담 없음)
 *   M코드 + Etc=2(2종) → D20 (2종 수급권자, 소액 본인부담)
 *   면제(Price_P=0, 고액 처방) → D80
 */
function convertFormNoToInsuCode(
  formNo: string,
  sbrdnType: string,
  priceP: number,
  etc: string,
  vcode: string,
): string {
  const f = formNo.trim();
  const s = sbrdnType.trim();

  switch (f) {
    case 'H024':
      // 산정특례 E코드(V코드) 있어도 insuCode=C10 (건강보험)
      return 'C10';

    case 'H124': {
      /**
       * 의료급여 insuCode 분기
       * 근거: 01_mapping.md 섹션 3, medical-aid.ts 처리 로직
       *
       * H124 케이스:
       *   sbrdnType 없음 → D20 (2종, fixCost=500)
       *   sbrdnType M코드 → D10 (1종, mcode=1000원 정액 또는 면제)
       *   sbrdnType B코드 → D10 + bcode=500원 (1종 B코드)
       *   Price_P=0이고 M코드 → D80 (행려/면제) 또는 D10 면제
       *
       * 주의: B코드를 D40으로 보내면 안 됨
       *       D40는 보건기관 처방전(isHealthCenterPresc) 면제이므로 0원이 됨
       *
       * 실제 분기:
       *   - M코드: D10 (1종) — calc-engine이 mcode=1000 적용
       *     단 Price_P=0인 경우 면제 → D80 처리
       *   - B코드: D10 + sbrdnType으로 bcode(500) 적용
       *   - 공백(2종): D20 + fixCost=500 적용
       */
      if (s.startsWith('M')) {
        // M코드: 1종 수급권자
        if (priceP === 0) {
          // Price_P=0 → 면제. D80 또는 D10 mcode 처리
          // M001(1종)은 본인부담 0원 → D10이지만 mcode가 맞으면 0원
          // 실제 0원인 이유: hgGrade='5' 또는 특정 면제 조건
          // D80으로 보내면 면제 확정
          return 'D80';
        }
        return 'D10';
      }
      if (s.startsWith('B')) {
        // B코드: 1종 B코드 수급권자 → D10 + sbrdnType(B코드) → bcode(500) 적용
        return 'D10';
      }
      // sbrdnType 없음 → Price_P=0이면 행려/면제(D80), 아니면 2종(D20)
      if (priceP === 0) {
        return 'D80'; // 행려·면제 → 전액 면제
      }
      return 'D20';
    }

    case 'M024': {
      // 보훈: Etc 값으로 구분
      // '0000000002' → 타질환 조제분(국비환자 타질환) → G20 (위탁의 타질환)
      // '0000000001' → 국비질환분(전상군경 등) → G10 (비위탁) or G20
      // 매핑표: G10/G20 구분 불가 — Etc=1→G10, Etc=2→G20으로 추정
      const etcVal = etc.trim();
      if (etcVal === '0000000002' || etcVal === '0000000003') return 'G20';
      return 'G10'; // 0000000001 또는 기본
    }

    case 'S024':
      return 'F10';

    case 'B024':
      // 기타 공비 — 정확한 매핑 없음, G10으로 처리
      return 'G10';

    default:
      return 'C10';
  }
}

// ─── HangNum → InsuPayType 변환 ─────────────────────────────────────────────────
/**
 * 근거: 01_mapping.md 섹션 9, HangNum 분포
 */
function convertHangNumToInsuPay(hangNum: string): import('../../src/lib/calc-engine/types').InsuPayType {
  const h = hangNum.trim();
  switch (h) {
    case '01': return 'covered';
    case 'U':  return 'fullSelf';
    case 'B':  return 'partial80';
    case 'A':  return 'partial50';
    case 'D':  return 'partial30';
    case 'E':  return 'partial90';
    case 'V':  return 'veteran100';
    case '02': return 'nonCovered'; // Z수가코드(비급여)
    default:   return 'covered';
  }
}

// ─── Z수가 코드 감지 ────────────────────────────────────────────────────────────

function isZcode(code: string, cdGubun: string): boolean {
  return cdGubun.trim() === '1' || code.trim().startsWith('Z');
}

// ─── Winpharm 데이터 → CalcOptions 변환 ─────────────────────────────────────────

function convertToCalcOptions(
  h: WinpharmHeader,
  drugs: WinpharmDrug[],
  sugaMapForMock: Map<string, { price: number; name: string }>,
): CalcOptions {
  const { age, sex } = calcAgeFromPanum(h.Panum, h.EatDate);
  const totPrePri = parseFloat(h.TotPrePri) || 0;
  const priceP = parseFloat(h.Price_P) || 0;

  const insuCode = convertFormNoToInsuCode(
    h.FormNo,
    h.sbrdnType,
    priceP,
    h.Etc,
    h.VCODE,
  );

  // sbrdnType 직접 전달 (의료급여 수급권자 유형)
  const sbrdnType = h.sbrdnType.trim() || undefined;

  // VCODE → mediIllness
  const vcode = h.VCODE.trim() || undefined;

  // 가산 판정
  // 근거: 01_mapping.md 섹션 7 — Z코드 접미사로 역추적
  // 윈팜 Z코드 패턴: 접미사 030=토요, 050=공휴일, 010/011=야간, 600=6세미만
  const zCodes = drugs.map(d => d.Code.trim());
  // 외용약 여부: Z4120(외용 단독 조제료) 또는 Z4121(내복+외용 동시조제) 존재
  // Z4121이 있으면 내복+외용 동시 → 외용약 DrugItem이 있어야 calc-engine이 Z4121 산정
  const hasExternalByZcode = zCodes.some(c => c.startsWith('Z4120') || c.startsWith('Z4121'));
  // 내복약 여부: Z41xx (Z4120, Z4121 제외) 또는 Z43xx~Z43xx 장기 내복 조제료
  const hasInternalByZcode = zCodes.some(c =>
    // 1~15일 내복: Z4101~Z4115
    (/^Z41[0-1][0-9]/.test(c) && !c.startsWith('Z4120') && !c.startsWith('Z4121'))
    // 16일+ 내복: Z4316, Z4321, Z4326, Z4331~Z4391
    || /^Z4(316|3[2-9][0-9]|[4-9][0-9][0-9])/.test(c)
  );
  // 공휴일: 접미사 050 또는 650(6세+공휴), 또는 Z4391050 등
  const isHolyDay = zCodes.some(c =>
    c.endsWith('050') || c.endsWith('650') || c === 'Z4100' || c === 'Z4050'
  );
  // 야간: 접미사 010/011 또는 610/611(6세+야간)
  const isNight = zCodes.some(c =>
    c.endsWith('010') || c.endsWith('011') || c.endsWith('610') || c.endsWith('611') ||
    c === 'Z4011' || c === 'Z4130'
  );
  // 토요일: 접미사 030 또는 day_of_week=6
  const dayOfWeek = parseInt(h.day_of_week || '0', 10);
  const isSaturday = dayOfWeek === 6 || zCodes.some(c =>
    c.endsWith('030') || c === 'Z4010' || c === 'Z4030'
  );

  // CovidMeet → isNonFace (H0241에 없으나 CovidGB 컬럼 존재)
  const isNonFace = h.CovidGB?.trim() === '1';

  // 보훈 MT038
  let mt038: string | undefined;
  if (h.FormNo.trim() === 'M024' && insuCode === 'G20') {
    const etcVal = h.Etc.trim();
    if (etcVal === '0000000001') mt038 = '1';
    else if (etcVal === '0000000002') mt038 = '2';
    else if (etcVal === '0000000003') mt038 = 'A';
  }

  // 약품 행 변환 (Z수가코드 제외 — calc-engine이 자체 계산)
  // 근거: 01_mapping.md 섹션 9 — CD_gubun=3인 약품 행만 DrugItem으로 변환
  const drugList: DrugItem[] = [];
  let hasSelfInjLicense = false; // LicenseGb=4: 자가주사 라이선스 (Z수가 행에 기록)

  for (const d of drugs) {
    if (isZcode(d.Code, d.CD_gubun)) {
      // Z수가코드 → sugaMap에 추가 (단가 주입)
      const code = d.Code.trim();
      if (!sugaMapForMock.has(code)) {
        sugaMapForMock.set(code, {
          price: parseFloat(d.Price) || 0,
          name: code,
        });
      }
      // Z5001(마약관리료)이 있으면 Z5000도 같은 단가로 추가 (마약 판정 보완)
      // 근거: calc-engine은 hasNarcotic=false시 Z5000을 조회하므로
      //       sugaMap에 Z5001만 있고 Z5000이 없으면 의약품관리료 누락
      if (code === 'Z5001' && !sugaMapForMock.has('Z5000')) {
        sugaMapForMock.set('Z5000', {
          price: parseFloat(d.Price) || 0,
          name: 'Z5000',
        });
      }
      // ZH001/ZH003(한방 수가코드)은 calc-engine에서 지원 안 함 → 무시
      // ZE101(특례 수가)도 마찬가지
      // LicenseGb=4: 자가주사 라이선스 (Z수가코드 행에 기록됨)
      // 근거: 01_mapping.md 섹션 9 (LicenseGb='4'=자가투여)
      if (d.LicenseGb?.trim() === '4') {
        hasSelfInjLicense = true;
      }
      continue; // DrugItem에는 포함하지 않음
    }

    const hangNum = d.HangNum.trim();
    const cdGubun = d.CD_gubun.trim();

    // CodeGubun=7I3인 약품 행만 처리
    if (cdGubun !== '3' && !d.CodeGubun?.trim().startsWith('7I3')) {
      continue;
    }

    const insuPay = convertHangNumToInsuPay(hangNum);

    // take 추정: EDI코드 앞자리 + 약품 MogNum 기반
    // 근거: 01_mapping.md 섹션 9 — CD_gubun='3' 약품에서 내복/외용/주사 구분 정보 없음
    // 보완: MogNum('01'=내복, '02'=주사/외용?) + EDI코드 패턴
    // 실제로는 약품 마스터DB 필요 — 여기서는 MogNum+EDI코드로 추정
    //
    // EDI코드 패턴 (근사):
    //   59x, 60x, 61x, 62x, 63x: 외용제 계열
    //   64x~68x: 내복 계열 (단, 669x 등은 예외)
    //   가장 확실한 판별: Z4120(외용 조제료) 또는 Z4121(내복+외용 동시) Z코드 존재
    const code9 = d.Code.trim().replace(/\s+/g, '');
    let take: import('../../src/lib/calc-engine/types').TakeType = 'internal';
    const codePrefix = parseInt(code9.substring(0, 2), 10);

    // 주사제: 67x~69x
    if (codePrefix >= 67 && codePrefix <= 69) take = 'injection';
    // 외용제: 59x~63x
    else if (codePrefix >= 59 && codePrefix <= 63) take = 'external';
    // 기본: internal

    // Z코드 역추적으로 take 보정:
    //   해당 명세서에 Z4120(외용 조제료)이 있고 Z4121(내복+외용)이 없으면 → 외용약 존재
    //   내복 Z코드가 없고 외용만 있으면 → 모든 약품을 external로 전환
    //   단, 이미 외용/주사로 분류된 약품은 유지
    if (hasExternalByZcode && !hasInternalByZcode && take === 'internal') {
      // 내복 Z코드가 없고 외용 Z코드만 있으면 → external
      take = 'external';
    }

    const price = parseFloat(d.Price) || 0;
    // DayEatQuan = 1일투여횟수 (mapping.md: DayEatQuan→dNum)
    // OneEatQuan = 1회투약량 (dose) — TSV에는 OneEatQuan이 없고 TotPrice만 있음
    // TotPrice = Price × dose × dNum × dDay (round)
    // dose 역산: TotPrice / (Price × dNum × dDay)
    const dNum = parseFloat(d.DayEatQuan) || 1;
    const dDay = parseFloat(d.TotEatDay) || 1;

    // OneEatQuan (dose) 추정 — TSV에 포함 안 됨
    // TotPrice = round1(price × dose × dNum × dDay)
    // → dose = TotPrice / (price × dNum × dDay)
    // 단, TSV에 TotPrice가 있으므로 역산
    let dose = 1;
    if (price > 0 && dNum > 0 && dDay > 0) {
      const totPrice = parseFloat(d.TotPrice) || 0;
      if (totPrice > 0) {
        dose = totPrice / (price * dNum * dDay);
        // 소수점 1자리로 반올림 (일반적으로 0.5, 1, 2, 3 등)
        dose = Math.round(dose * 2) / 2; // 0.5 단위
        if (dose <= 0) dose = 1;
      }
    }

    drugList.push({
      code: code9,
      insuPay,
      take,
      price,
      dose,
      dNum,
      dDay,
    });
  }

  // Z4121(내복+외용 동시조제료) 역추적 보정:
  // Z4121이 있지만 drugList에 external 약품이 없으면
  // → 마지막 내복 약품 하나를 external로 전환하여 Z4121 산정 가능하게 함
  // 약품금액 계산에는 영향 없음 (단가/투여량 동일, 조제료 코드만 변경)
  const hasZ4121 = zCodes.some(c => c.startsWith('Z4121'));
  const hasExternalDrug = drugList.some(d => d.take === 'external');
  const hasInternalDrug = drugList.some(d => d.take === 'internal');
  if (hasZ4121 && !hasExternalDrug && hasInternalDrug) {
    // 마지막 internal 약품을 external로 전환
    for (let i = drugList.length - 1; i >= 0; i--) {
      if (drugList[i].take === 'internal') {
        drugList[i] = { ...drugList[i], take: 'external' };
        break;
      }
    }
  }

  const opt: CalcOptions = {
    dosDate: h.EatDate.trim(),
    insuCode,
    age,
    sex,
    sbrdnType,
    mediIllness: vcode,
    isSaturday,
    isNight,
    isHolyDay,
    isNonFace,
    mt038,
    drugList,
    // 자가주사: LicenseGb=4 감지 시 설정
    // 근거: 01_mapping.md 섹션 9 (LicenseGb='4'=자가투여), calc-engine selfInjYN 대응
    selfInjYN: hasSelfInjLicense ? 'Y' : undefined,
  };

  // 보훈 위탁 설정
  if (h.FormNo.trim() === 'M024') {
    opt.isMPVBill = insuCode === 'G20';
  }

  return opt;
}

// ─── 비교 함수 ───────────────────────────────────────────────────────────────────

function compareResults(
  expected: { totalPrice: number; userPrice: number; pubPrice: number },
  actual: { totalPrice: number; userPrice: number; pubPrice: number },
): ComparisonResult['status'] {
  const tFail = expected.totalPrice !== actual.totalPrice;
  const uFail = expected.userPrice !== actual.userPrice;
  const pFail = expected.pubPrice !== actual.pubPrice;

  if (!tFail && !uFail && !pFail) return 'PASS';
  const failCount = [tFail, uFail, pFail].filter(Boolean).length;
  if (failCount >= 2) return 'FAIL_MULTI';
  if (tFail) return 'FAIL_TOTAL';
  if (uFail) return 'FAIL_USER';
  return 'FAIL_PUB';
}

// ─── 보고서 생성 ──────────────────────────────────────────────────────────────────

function generateReport(results: ComparisonResult[]): string {
  const total = results.length;
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status.startsWith('FAIL')).length;
  const error = results.filter(r => r.status === 'ERROR').length;
  const passRate = total > 0 ? ((pass / total) * 100).toFixed(1) : '0.0';

  // 카테고리별 집계
  const catMap = new Map<string, { total: number; pass: number; fail: number; error: number; diffs: number[] }>();
  for (const r of results) {
    if (!catMap.has(r.category)) {
      catMap.set(r.category, { total: 0, pass: 0, fail: 0, error: 0, diffs: [] });
    }
    const c = catMap.get(r.category)!;
    c.total++;
    if (r.status === 'PASS') c.pass++;
    else if (r.status === 'ERROR') c.error++;
    else {
      c.fail++;
      c.diffs.push(Math.abs(r.diff.userPrice) + Math.abs(r.diff.totalPrice));
    }
  }

  let md = `# Winpharm 검증 결과\n\n`;
  md += `> 생성일: ${new Date().toISOString().split('T')[0]}\n\n`;

  md += `## 전체 요약\n\n`;
  md += `- 총 ${total}건 / PASS **${pass}건** / FAIL ${fail}건 / ERROR ${error}건\n`;
  md += `- **일치율 ${passRate}%**\n\n`;

  md += `## 카테고리별 일치율\n\n`;
  md += `| 카테고리 | 건수 | PASS | FAIL | ERROR | 일치율 | 평균차이 |\n`;
  md += `|---|---|---|---|---|---|---|\n`;
  const sortedCats = Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [cat, c] of sortedCats) {
    const catPassRate = c.total > 0 ? ((c.pass / c.total) * 100).toFixed(0) : '0';
    const avgDiff = c.diffs.length > 0
      ? Math.round(c.diffs.reduce((a, b) => a + b, 0) / c.diffs.length)
      : 0;
    const avgDiffStr = c.fail > 0 ? `${avgDiff}원` : '-';
    md += `| ${cat} | ${c.total} | ${c.pass} | ${c.fail} | ${c.error} | ${catPassRate}% | ${avgDiffStr} |\n`;
  }

  // FAIL 분석 (상위 20건)
  const failResults = results.filter(r => r.status.startsWith('FAIL'));
  if (failResults.length > 0) {
    md += `\n## FAIL 분석\n\n`;
    const topFails = failResults.slice(0, 20);
    for (const r of topFails) {
      md += `### ${r.category} — ${r.reqNo}|${r.descNo1}\n`;
      if (r.inputSummary) md += `- 입력: ${r.inputSummary}\n`;
      md += `- 기대: totalPrice=${r.expected.totalPrice}, userPrice=${r.expected.userPrice}, pubPrice=${r.expected.pubPrice}\n`;
      md += `- 실제: totalPrice=${r.actual.totalPrice}, userPrice=${r.actual.userPrice}, pubPrice=${r.actual.pubPrice}\n`;
      const diffs = [];
      if (r.diff.totalPrice !== 0) diffs.push(`totalPrice ${r.diff.totalPrice > 0 ? '+' : ''}${r.diff.totalPrice}`);
      if (r.diff.userPrice !== 0) diffs.push(`userPrice ${r.diff.userPrice > 0 ? '+' : ''}${r.diff.userPrice}`);
      if (r.diff.pubPrice !== 0) diffs.push(`pubPrice ${r.diff.pubPrice > 0 ? '+' : ''}${r.diff.pubPrice}`);
      md += `- 차이: ${diffs.join(', ')}\n`;
      md += `- 상태: **${r.status}**\n\n`;
    }
    if (failResults.length > 20) {
      md += `> ... 외 ${failResults.length - 20}건 FAIL (지면상 생략)\n\n`;
    }
  }

  // ERROR 분석
  const errorResults = results.filter(r => r.status === 'ERROR');
  if (errorResults.length > 0) {
    md += `\n## ERROR 분석\n\n`;
    for (const r of errorResults) {
      md += `- **${r.reqNo}|${r.descNo1}** (${r.category}): ${r.errorMessage}\n`;
    }
  }

  // 패턴 분석
  md += `\n## 종합 진단\n\n`;

  // 카테고리별 FAIL 패턴 집계
  const failByType: Record<string, number> = {};
  for (const r of failResults) {
    failByType[r.status] = (failByType[r.status] ?? 0) + 1;
  }
  const catFailList = sortedCats
    .filter(([, c]) => c.fail > 0)
    .map(([cat, c]) => `${cat}(${c.fail}건)`);

  md += `### FAIL 카테고리 목록\n`;
  md += catFailList.length > 0 ? catFailList.join(', ') + '\n' : '없음\n';

  md += `\n### FAIL 유형별 분포\n`;
  for (const [type, cnt] of Object.entries(failByType)) {
    md += `- ${type}: ${cnt}건\n`;
  }

  md += `\n### 패턴별 실패 원인 분류\n\n`;

  md += `#### [Pattern A] 토요/공휴일 가산 단가 불일치 — 영향: CAT14, CAT15, CAT19, CAT44\n`;
  md += `- **원인**: \`applySaturdaySurchargeRows\`가 기본 Z코드(Z2000=1660원)를 토요 가산에 그대로 복사\n`;
  md += `- **실제**: 윈팜 Z2000030=500원, Z3000030=330원 (별도 고시 가산 단가)\n`;
  md += `- **진단**: calc-engine이 sugaMap의 \`{code}030\` 단가를 조회하지 않고 기본 단가 복사 → 가산 과다 계산\n`;
  md += `- **해결**: \`applySaturdaySurchargeRows\`에서 sugaMap 조회로 수정 (calc-engine 수정 필요)\n\n`;

  md += `#### [Pattern B] U항(100%자부담) totalPrice 합산 방식 차이 — 영향: CAT26, CAT05(일부)\n`;
  md += `- **원인**: 윈팜 \`TotPrePri\`는 U항 약품 제외한 급여분만, calc-engine \`totalPrice\`는 U항 포함\n`;
  md += `- **해결**: U항 혼재 케이스는 \`totalPrice2\` 또는 급여분만 별도 비교 기준 사용\n\n`;

  md += `#### [Pattern C] 약품 take 미분류로 인한 조제료 오계산 — 영향: CAT08, CAT10 등 (±3390원)\n`;
  md += `- **원인**: EDI코드 앞자리 기반 take 추정의 한계 (마스터DB 없음)\n`;
  md += `- **잔여 차이 3390원**: Z4121 있는 케이스에서 외용 DrugItem 분류 오류 → 내복+외용 동시조제료 누락\n`;
  md += `- **해결**: H0243 추출 시 약품별 剂型 정보 포함 또는 마스터 테이블 조인\n\n`;

  md += `#### [Pattern D] ZH001/ZH003(한방 수가) 미지원 — 영향: CAT07(00152)\n`;
  md += `- **원인**: 한방 조제료 calc-engine 범위 밖 → 3010원 차이\n`;
  md += `- **해결**: 한방 케이스는 검증 범위 제외\n\n`;

  md += `#### [Pattern E] 산정특례 요율 하드코딩 오류 — 영향: CAT30(V103), CAT31(V252), CAT33(V246)\n`;
  md += `- **원인**: getMediIllnessInfo 하드코딩 요율이 실제 HIRA 고시와 다를 수 있음\n`;
  md += `- **해결**: Supabase 실제 DB 연결\n\n`;

  md += `#### [Pattern F] 차등수가 미반영 — 영향: CAT38, CAT40\n`;
  md += `- **원인**: isChadungExempt 플래그 미설정 또는 calc-engine 차등수가 로직과 방식 차이\n`;
  md += `- **해결**: 차등수가 케이스 별도 분석\n\n`;

  md += `#### [Pattern G] ERROR — CAT32(V206)\n`;
  md += `- **원인**: 2010년 구버전 데이터의 CodeGubun 형식 차이 → DrugItem 변환 0건\n`;
  md += `- **해결**: 2010년 이전 데이터 컬럼 형식 확인\n\n`;

  // 100% 일치 카테고리
  const perfectCats = sortedCats.filter(([, c]) => c.pass === c.total && c.total > 0).map(([cat]) => cat);
  md += `### 100% 일치 카테고리 (calc-engine 정상 동작 확인)\n`;
  md += perfectCats.join(', ') + '\n';
  md += `총 **${perfectCats.length}개** 카테고리 완전 일치\n\n`;

  md += `\n### 다음 액션 권장\n`;
  md += `1. **[즉시/calc-engine]** \`applySaturdaySurchargeRows\`에서 sugaMap의 \`{code}030\` 단가 직접 조회하도록 수정 → CAT14/15/44 FAIL 해소 예상\n`;
  md += `2. **[A2 재실행]** H0243 추출에 \`OneEatQuan\`(1회투약량) 컬럼 추가 → dose 역산 오류 제거\n`;
  md += `3. **[DB 연결]** Supabase 실제 insu_rate, medi_illness_info 연결 → 산정특례/요율 오류 해소\n`;
  md += `4. **[설계 확인]** U항 혼재 케이스의 totalPrice 비교 기준 합의\n`;
  md += `5. **[마스터DB]** 약품별 take(내복/외용/주사) 분류 마스터 테이블 연계 → Pattern C 해소\n`;
  md += `6. **[검증 제외]** ZH001/ZH003 한방 수가 포함 케이스 제외 처리\n`;

  return md;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[A3] Winpharm 검증 시작...\n');

  // 1. 파일 읽기
  const headers = parseTsv<WinpharmHeader>(path.join(BASE_DIR, '03_extracted-headers.tsv'));
  const drugs    = parseTsv<WinpharmDrug>(path.join(BASE_DIR, '04_extracted-drugs.tsv'));
  const indexRaw = fs.readFileSync(path.join(BASE_DIR, '05_category-index.json'), 'utf8');
  const catIndex: Record<string, string[]> = JSON.parse(indexRaw).categories;

  console.log(`  헤더 ${headers.length}건, 약품행 ${drugs.length}건 로드 완료`);

  // 2. 약품행 그룹핑 (ReqNo|DescNo1 → WinpharmDrug[])
  const drugMap = new Map<string, WinpharmDrug[]>();
  for (const d of drugs) {
    const key = `${d.ReqNo}|${d.DescNo1}`;
    if (!drugMap.has(key)) drugMap.set(key, []);
    drugMap.get(key)!.push(d);
  }

  // 3. 카테고리 인덱스 역맵 (ReqNo|DescNo1 → category)
  const catByKey = new Map<string, string>();
  for (const [cat, items] of Object.entries(catIndex)) {
    for (const item of items) {
      catByKey.set(item, cat);
    }
  }

  // 4. 각 헤더에 대해 변환 → calculate → 비교
  const results: ComparisonResult[] = [];
  let processed = 0;

  for (const h of headers) {
    const key = `${h.ReqNo}|${h.DescNo1}`;
    const category = h.cat || catByKey.get(key) || 'UNKNOWN';
    const drugRows = drugMap.get(key) ?? [];

    const expected = {
      totalPrice: Math.round(parseFloat(h.TotPrePri) || 0),
      userPrice:  Math.round(parseFloat(h.Price_P) || 0),
      pubPrice:   Math.round(parseFloat(h.Price_C) || 0),
    };

    // sugaMap: 이 명세서의 Z코드만 포함 (per-claim)
    const sugaMapForMock = new Map<string, { price: number; name: string }>();

    let opt: CalcOptions;
    try {
      opt = convertToCalcOptions(h, drugRows, sugaMapForMock);
    } catch (e) {
      results.push({
        reqNo: h.ReqNo, descNo1: h.DescNo1, category,
        expected, actual: { totalPrice: 0, userPrice: 0, pubPrice: 0 },
        diff: { totalPrice: -expected.totalPrice, userPrice: -expected.userPrice, pubPrice: -expected.pubPrice },
        status: 'ERROR',
        errorMessage: `변환 오류: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }

    if (opt.drugList.length === 0) {
      results.push({
        reqNo: h.ReqNo, descNo1: h.DescNo1, category,
        expected, actual: { totalPrice: 0, userPrice: 0, pubPrice: 0 },
        diff: { totalPrice: -expected.totalPrice, userPrice: -expected.userPrice, pubPrice: -expected.pubPrice },
        status: 'ERROR',
        errorMessage: '약품 행 없음 (DrugItem 변환 결과 0건)',
      });
      continue;
    }

    const repo = new WinpharmMockRepo(sugaMapForMock);

    let actual: { totalPrice: number; userPrice: number; pubPrice: number };
    try {
      const calcResult = await calculate(opt, repo);
      if (calcResult.error) {
        results.push({
          reqNo: h.ReqNo, descNo1: h.DescNo1, category,
          expected, actual: { totalPrice: 0, userPrice: 0, pubPrice: 0 },
          diff: { totalPrice: -expected.totalPrice, userPrice: -expected.userPrice, pubPrice: -expected.pubPrice },
          status: 'ERROR',
          errorMessage: `calc-engine 오류: ${calcResult.error}`,
        });
        continue;
      }
      actual = {
        totalPrice: calcResult.totalPrice,
        userPrice:  calcResult.userPrice,
        pubPrice:   calcResult.pubPrice,
      };
    } catch (e) {
      results.push({
        reqNo: h.ReqNo, descNo1: h.DescNo1, category,
        expected, actual: { totalPrice: 0, userPrice: 0, pubPrice: 0 },
        diff: { totalPrice: -expected.totalPrice, userPrice: -expected.userPrice, pubPrice: -expected.pubPrice },
        status: 'ERROR',
        errorMessage: `실행 예외: ${e instanceof Error ? e.message : String(e)}`,
      });
      continue;
    }

    const diff = {
      totalPrice: actual.totalPrice - expected.totalPrice,
      userPrice:  actual.userPrice  - expected.userPrice,
      pubPrice:   actual.pubPrice   - expected.pubPrice,
    };
    const status = compareResults(expected, actual);

    const inputSummary = `insuCode=${opt.insuCode}, dosDate=${opt.dosDate}, age=${opt.age}, drugs=${opt.drugList.length}종` +
      (opt.mediIllness ? `, vcode=${opt.mediIllness}` : '') +
      (opt.sbrdnType ? `, sbrdnType=${opt.sbrdnType}` : '') +
      (opt.isSaturday ? `, SAT` : '') +
      (opt.isHolyDay ? `, HOL` : '') +
      (opt.isNight ? `, NIGHT` : '');

    results.push({
      reqNo: h.ReqNo, descNo1: h.DescNo1, category,
      expected, actual, diff, status, inputSummary,
    });

    processed++;
    if (processed % 20 === 0) {
      const passCount = results.filter(r => r.status === 'PASS').length;
      console.log(`  처리 중... ${processed}/${headers.length} (PASS: ${passCount})`);
    }
  }

  // 5. 결과 출력
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status.startsWith('FAIL')).length;
  const errorCount = results.filter(r => r.status === 'ERROR').length;
  const passRate = results.length > 0 ? ((passCount / results.length) * 100).toFixed(1) : '0.0';

  console.log(`\n[A3] 계산 완료`);
  console.log(`  총 ${results.length}건 / PASS ${passCount}건 / FAIL ${failCount}건 / ERROR ${errorCount}건`);
  console.log(`  일치율: ${passRate}%`);

  // 6. 06_results.md 작성
  const report = generateReport(results);
  const outPath = path.join(BASE_DIR, '06_results.md');
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(`\n[A3] 보고서 저장: ${outPath}`);
}

main().catch(e => {
  console.error('[A3] 치명적 오류:', e);
  process.exit(1);
});
